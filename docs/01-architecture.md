# 01 — Architecture

## 1. Goals of the prototype

The prototype must prove, with numbers, that the architecture from the research works:

1. otto can **find and understand form fields on any site**, including sites with no labels or ARIA.
2. otto can **fill every common input type** so that the site's framework actually registers the value.
3. **Rules handle most fields**; the AI handles only the leftovers, in one batched call.
4. A **saved recipe** refills a known form with **zero AI calls**, and **repairs itself** when the layout changes.
5. It stays **light**: nothing runs on a page until the user invokes otto.
6. **Page summary** and **select-and-prompt** work on real pages.

Everything else (encryption, store publishing, Safari, Pro debugger build, visual fallback) is out of scope for now — see `09-checklist.md`.

## 2. Components

```
                         ┌────────────────────────────── apps/web (Next.js) ───────────────────────────────┐
                         │                                                                                  │
                         │  FRONTEND (React, App Router)            BACKEND (Route Handlers, Node runtime)   │
                         │  /            overview                  /api/health                              │
                         │  /profile     edit profile              /api/profile        GET PUT              │
                         │  /recipes     saved form recipes        /api/recipes        GET POST DELETE      │
                         │  /runs        run history + metrics     /api/recipes/lookup GET                  │
                         │  /settings    model, behaviour          /api/runs           GET POST             │
                         │  /playground  test forms + scoring      /api/map            POST  (Claude)       │
                         │                                         /api/summarize      POST  (Claude)       │
                         │                                         /api/ask            POST  (Claude)       │
                         │                                         /api/settings       GET PUT              │
                         │                                                │                                 │
                         │                                     lib/db (Drizzle + SQLite)  lib/ai (SDK)      │
                         └────────────────────────────────────────────────┬─────────────────────────────────┘
                                                                          │ fetch (CORS allows extension origin)
┌──────────────────────────────────── apps/extension (WXT, Chrome MV3) ───┴────────────────────────────────────┐
│                                                                                                               │
│  SIDE PANEL (React)                BACKGROUND (service worker)                 PAGE (per tab, on demand)       │
│  tabs: Page · Fill · Pick · Log    - opens side panel on toolbar click         engine.js  (ISOLATED world)     │
│  - calls backend API               - injects engine.js / main-world.js          = packages/core bundled        │
│  - sends commands to the tab  ───► - relays messages panel ⇄ tab  ──────────►  main-world.js (MAIN world)     │
│  - shows preview, results          - knows nothing else (stateless)             framework probes, adapters     │
│                                                                                                               │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

packages/core    engine logic: walk DOM, visibility, labels, field extraction, widget detection,
                 rule matcher, fill primitives + adapters, verifier, form signature, fingerprint/heal,
                 compact serializer, readable-text extractor, element picker
packages/shared  zod schemas + TS types shared by web and extension (API contracts, profile keys,
                 FieldDescriptor, Recipe, RunReport)
```

### Who owns what

| Concern | Owner | Why there |
|---|---|---|
| Reading and changing the page | `packages/core` running as `engine.js` in the tab | Only code inside the page can see its DOM. |
| Framework internals (React props, flatpickr instance) | `main-world.js` | Isolated world cannot see page JavaScript objects. |
| UI the user interacts with | Side panel (extension) | One process per window, not per tab; survives page navigation. |
| Message routing, injection | Background service worker | Has `scripting` / `tabs` APIs; must stay stateless (Chrome kills it after 30 s idle). |
| Profile, recipes, run logs, settings | Backend (SQLite) | Visible and editable in the dashboard; survives extension reloads. |
| AI calls | Backend (`/api/map`, `/api/summarize`, `/api/ask`) | API key stays in `.env.local`; one place to change prompts and model. |
| Measuring success | Playground pages + `/runs` | Known expected values → automatic scoring. |

## 3. Design principles (carried over from the research)

1. **Nothing runs until invoked.** No manifest `content_scripts`. The engine is injected with `chrome.scripting.executeScript` when the user opens the side panel / clicks an action. (`research/10`)
2. **No ARIA dependency.** Perception uses DOM + layout + computed style + hit-testing; ARIA only adds confidence. (`research/08`)
3. **AI decides, code acts.** The AI returns JSON (`mappings`, `actions`); the engine executes it. Never `eval` model output.
4. **Rules first.** `autocomplete` tokens → regex dictionary → synonyms → AI for leftovers only.
5. **Verify everything.** A field counts as filled only after a read-back after the page settles.
6. **Never auto-submit.** otto fills; the user clicks submit (or confirms in the panel).
7. **Recipes are data, not code.** JSON steps with multi-attribute fingerprints.

## 4. Data model (summary — full schema in `04-backend-api.md`)

```ts
Profile        { key: ProfileKey, value: string }[]        // e.g. given-name, email, address-line1, linkedin, …
FieldDescriptor{ ref, frameId, kind, widget, label, labelSource, name, idAttr, autocomplete,
                 placeholder, type, required, options?, section, rect, fingerprint }
Mapping        { ref, source: 'rule'|'recipe'|'ai'|'user', key?: ProfileKey, value: string,
                 confidence: number, reason?: string }
FillResult     { ref, status: 'filled'|'verified'|'failed'|'skipped', rung: number, ms, error? }
Recipe         { id, origin, pathPattern, formSig, altSig, steps: RecipeStep[], stats }
RecipeStep     { fieldSig, key?, value?, widget, locators[], fingerprint, dangerous }
RunReport      { id, url, kind: 'fill'|'replay'|'summarize'|'ask', fieldsFound, filled, verified,
                 failed, llmCalls, tokensIn, tokensOut, timings{scan,match,fill,verify}, details }
```

## 5. Feature flows

### 5.1 Fill a form (first visit)

```
User clicks otto icon ─► side panel opens (Fill tab)
Panel ─► background: ensureEngine(tabId)
Background ─► scripting.executeScript(files: engine.js, frameIds: [0])   (+ main-world.js, world: MAIN)
Panel ─► engine: SCAN
Engine: walk DOM (shadow roots, same-origin iframes) → candidates → visibility/honeypot filter
        → widget detection → label cascade → FieldDescriptor[] → formSig
        reply { fields, formSig, timings }
Panel ─► backend GET /api/recipes/lookup?origin&formSig      → none
Panel: rules matcher (packages/core, runs in panel) → mappings for easy fields
Panel ─► backend POST /api/map { leftover fields (compact), page }  → AI mappings (+ generated answers)
Panel: show PREVIEW list (field · value · source · confidence), user can edit/untick
User clicks "Fill"
Panel ─► engine: FILL { mappings }
Engine: queue, one field at a time → adapter → escalation ladder → verify → FillResult[]
Panel: shows results; "Save as recipe" ─► POST /api/recipes
Panel ─► POST /api/runs (RunReport)
```

### 5.2 Fill a form (repeat visit — recipe replay)

```
SCAN → formSig → GET /api/recipes/lookup → recipe found
For each step: resolve element by ranked locators → fingerprint check
   ok      → use it
   missing → heal: score candidates (Similo-lite) → accept if score ≥ θ and margin ≥ δ
             else mark step "needs AI" → only those fields go to /api/map
Preview → Fill → Verify → update recipe (healed locators written back only if verified)
RunReport.llmCalls should be 0 when nothing broke
```

### 5.3 Summarize page

```
Panel ─► engine: EXTRACT_TEXT → Readability article (or main/body fallback), headings, forms, tables count
Panel ─► POST /api/summarize { url, title, text (≤ ~30k chars), outline }
Backend ─► Claude (structured output: purpose, keyPoints[], entities[], actions[], forms[], risks[])
Panel renders summary; "Ask a follow-up" uses /api/ask with the same page context
```

### 5.4 Select and prompt

```
Pick tab ─► engine: START_PICKER → overlay highlights element under cursor (shadow-piercing)
User clicks element (Alt+↑ to select parent) ─► engine returns ElementContext
   { ref, tag, text, outerHTML (trimmed ≤ 4k), fieldsInside[], rect, path, nearbyText }
User types a prompt ("fill this from my profile", "what does this table say?", "click the cheapest plan")
Panel ─► POST /api/ask { prompt, element, page }
Backend ─► Claude → { answer, actions?: [{ op: 'fill'|'click'|'select'|'check', ref, value? }] }
Panel shows answer; if actions exist, shows them as a checklist → user approves → engine executes
```

### 5.5 Messaging contract (panel ⇄ background ⇄ engine)

All messages are typed in `packages/shared/src/messages.ts`:

| Message | From → To | Payload → Reply |
|---|---|---|
| `ENSURE_ENGINE` | panel → bg | `{ tabId }` → `{ ok, frames }` |
| `SCAN` | panel → engine | `{ scope?: ref }` → `{ fields, formSig, altSig, timings }` |
| `FILL` | panel → engine | `{ mappings }` → `{ results }` (streams `FILL_PROGRESS`) |
| `EXTRACT_TEXT` | panel → engine | `{}` → `{ title, text, outline, stats }` |
| `START_PICKER` / `STOP_PICKER` | panel → engine | `{}` → `ElementContext` on click |
| `RUN_ACTIONS` | panel → engine | `{ actions }` → `{ results }` |
| `RESOLVE_RECIPE` | panel → engine | `{ steps }` → `{ resolved, healed, broken }` |
| `HIGHLIGHT` | panel → engine | `{ refs, mode }` → `{}` (preview outlines) |
| `PING` | panel → engine | `{}` → `{ version }` (detect "engine not injected / orphaned") |

The background relays `panel → engine` with `browser.tabs.sendMessage(tabId, msg, { frameId })`. If the reply is "Receiving end does not exist", it re-injects once and retries.

## 6. Element references (`ref`)

The engine keeps `Map<number, WeakRef<Element>>` inside the page. Each candidate gets a counter id (`ref`). Nothing is written into the page DOM (no `data-*` attributes). A ref is valid until the next SCAN. Cross-frame refs are `"${frameId}:${n}"`.

## 7. Frames and shadow DOM

- Same-origin iframes: walked directly from the top frame (`iframe.contentDocument`).
- Cross-origin iframes: the background injects `engine.js` into that `frameId` as well (needs host permission — prototype requests `<all_urls>` host permission to keep this simple). The panel merges per-frame scans.
- Open shadow roots: walked via `el.shadowRoot`.
- Closed shadow roots: `chrome.dom.openOrClosedShadowRoot(el)` (available in content scripts).

## 8. Where the prototype differs from the final product

| Final product (research) | Prototype |
|---|---|
| Encrypted local vault, PII never sent to AI | Profile in SQLite in plain text; profile values may be sent to Claude for generated answers |
| Fully client-side, BYOK | Local Next.js backend holds the API key |
| `activeTab` + per-site optional permissions | `<all_urls>` host permission (simpler injection into iframes) |
| Many browsers via WXT shells | Chrome first; `wxt build -b firefox` as a stretch check |
| Visual fallback, Pro debugger build, WebMCP | Not built; hooks left in the design |
| Deterministic safety gates everywhere | One simple rule: never click submit/pay/send automatically |
