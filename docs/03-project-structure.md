# 03 — Project structure

A npm monorepo. Two apps, two packages.

```
otto/  (repo root = E:\VS CODE\WORK\browser-automation)
├─ package.json                 workspace scripts: dev, build, test, lint, e2e
├─ package.json (workspaces)   apps/*, packages/*
├─ tsconfig.base.json           strict TS settings shared by all projects
├─ biome.json                   lint + format
├─ .gitignore                   node_modules, .output, .next, apps/web/data/*.db, .env.local
├─ README.md
├─ brand/                       logo SVGs + palette (done)
├─ docs/                        this plan
├─ research/                    research behind the decisions
│
├─ packages/
│  ├─ shared/                   ── types + zod schemas used everywhere
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ profile.ts          PROFILE_KEYS catalogue (key, label, group, synonyms, example) + ProfileSchema
│  │     ├─ field.ts            FieldDescriptor, WidgetKind, FieldKind, LabelSource
│  │     ├─ mapping.ts          Mapping, MapRequest, MapResponse (zod, used for Claude structured output)
│  │     ├─ recipe.ts           Recipe, RecipeStep, Locator, Fingerprint
│  │     ├─ run.ts              RunReport, FillResult, Timings
│  │     ├─ summary.ts          SummarizeRequest, PageSummary (zod)
│  │     ├─ ask.ts              AskRequest, AskResponse, ElementContext, Action (zod)
│  │     ├─ messages.ts         typed protocol panel ⇄ background ⇄ engine
│  │     └─ settings.ts         Settings (model, effort, deepScan, autoSaveRecipes…)
│  │
│  └─ core/                     ── the engine (plain TS, runs inside web pages)
│     ├─ src/
│     │  ├─ index.ts            public API: scan(), fill(), extractText(), startPicker(), resolveRecipe()
│     │  ├─ refs.ts             ref registry: Map<ref, WeakRef<Element>>
│     │  ├─ dom/
│     │  │  ├─ walk.ts          deep walk: open + closed shadow roots, same-origin iframes, TreeWalker pruning
│     │  │  ├─ visibility.ts    checkVisibility, rect, viewport, clipping, elementFromPoint hit test
│     │  │  ├─ honeypot.ts      trap-field detection (hidden, off-screen, tiny, "leave blank")
│     │  │  ├─ interactive.ts   clickable scoring (cursor:pointer roots, tabindex, onclick, jsaction, icon rule)
│     │  │  ├─ settle.ts        waitForSettle(): mutation-quiet + network-quiet + aria-busy, with timeout
│     │  │  └─ chunk.ts         yieldToMain() = scheduler.yield ?? setTimeout(0)
│     │  ├─ fields/
│     │  │  ├─ extract.ts       candidates → FieldDescriptor[]
│     │  │  ├─ widget.ts        detectWidget(): native/react-select/mui/antd/radix/headless/select2/flatpickr/mask/rich/file/…
│     │  │  ├─ labels.ts        label cascade: labels/aria → Chromium-style inference → geometry → attributes
│     │  │  ├─ section.ts       nearest heading / fieldset legend (billing vs shipping)
│     │  │  ├─ options.ts       read options of select / radio group / listbox
│     │  │  └─ serialize.ts     compact one-line-per-field format for the AI
│     │  ├─ match/
│     │  │  ├─ autocomplete.ts  HTML autocomplete token → profile key
│     │  │  ├─ dictionary.ts    regex patterns (EN + a few languages) per profile key
│     │  │  ├─ rules.ts         matchByRules(fields, profile) → Mapping[] + leftovers
│     │  │  └─ format.ts        value formatting: dates (field format), phone, country names/codes, splitting names
│     │  ├─ fill/
│     │  │  ├─ primitives.ts    setNativeValue, dispatchInputEvents, pointerClick, pressKey, typeText,
│     │  │  │                   pasteText, setFiles, blur
│     │  │  ├─ engine.ts        queue + escalation ladder + per-field budget + progress events
│     │  │  ├─ verify.ts        settle → read-back → error detection (aria-invalid, :invalid, error text)
│     │  │  └─ adapters/
│     │  │     ├─ index.ts      ordered registry; first adapter whose matches() is true wins
│     │  │     ├─ native-text.ts  input/textarea (all frameworks)
│     │  │     ├─ native-select.ts
│     │  │     ├─ native-date.ts  date / time / datetime-local / month / week
│     │  │     ├─ check-radio.ts  checkbox, radio group, ARIA checkbox/radio/switch
│     │  │     ├─ range.ts        input range + ARIA slider
│     │  │     ├─ aria-combobox.ts generic combobox/listbox (fallback for most custom dropdowns)
│     │  │     ├─ react-select.ts
│     │  │     ├─ mui.ts          MUI Select (hidden native input shortcut) + Autocomplete + X DatePicker
│     │  │     ├─ antd.ts         AntD Select (virtual list) + DatePicker (type + Enter)
│     │  │     ├─ radix.ts        Radix Select (PointerEvents with pointerType mouse)
│     │  │     ├─ headless.ts     Headless UI Listbox/Combobox
│     │  │     ├─ select2.ts      Select2 / Chosen (native select + change)
│     │  │     ├─ flatpickr.ts    via main-world bridge, fallback typing + Enter
│     │  │     ├─ masked.ts       per-character typing with execCommand('insertText')
│     │  │     ├─ rich-text.ts    contenteditable / ProseMirror / Lexical / Quill (insertText, paste)
│     │  │     └─ file.ts         input[type=file] + drop zones (DataTransfer)
│     │  ├─ recipe/
│     │  │  ├─ signature.ts     formSig / altSig / fieldSig (Chromium-style hashes)
│     │  │  ├─ locators.ts      ranked locators (testid, role+name, label, placeholder, id, name, xpath)
│     │  │  ├─ fingerprint.ts   capture fingerprint; Similo-lite similarity score
│     │  │  └─ resolve.ts       resolve steps → resolved / healed / broken
│     │  ├─ text/
│     │  │  └─ extract.ts       Readability → text + outline (headings, forms, tables count)
│     │  ├─ picker/
│     │  │  ├─ overlay.ts       closed-shadow-root overlay, hover highlight, Alt+↑ parent
│     │  │  └─ context.ts       ElementContext builder (trimmed outerHTML, text, fields inside)
│     │  └─ actions/
│     │     └─ run.ts           execute AI actions (fill/click/select/check) with the same adapters
│     └─ test/                  Vitest + happy-dom unit tests (labels, rules, signatures, fingerprint)
│
├─ apps/
│  ├─ web/                      ── Next.js: FRONTEND (dashboard, playground) + BACKEND (/api)
│  │  ├─ .env.example           ANTHROPIC_API_KEY=, OTTO_MODEL=claude-opus-5-5
│  │  ├─ next.config.ts
│  │  ├─ prisma.config.ts
│  │  ├─ prisma/                schema.prisma (PostgreSQL)
│  │  ├─ public/
│  │  │  ├─ brand/              copies of the logo SVGs
│  │  │  └─ playground/         static HTML cases: plain.html, vue.html, jquery-select2.html,
│  │  │                         flatpickr.html, legacy-table.html, frame-child.html
│  │  ├─ middleware.ts          CORS for chrome-extension:// and moz-extension:// origins on /api/*
│  │  └─ src/
│  │     ├─ app/
│  │     │  ├─ layout.tsx       shell: sidebar nav with mark + "otto", theme toggle
│  │     │  ├─ page.tsx         Overview
│  │     │  ├─ profile/page.tsx
│  │     │  ├─ recipes/page.tsx
│  │     │  ├─ recipes/[id]/page.tsx
│  │     │  ├─ runs/page.tsx
│  │     │  ├─ runs/[id]/page.tsx
│  │     │  ├─ settings/page.tsx
│  │     │  ├─ playground/page.tsx          list of cases + latest scores
│  │     │  ├─ playground/[case]/page.tsx   renders a React case (or links to a static one)
│  │     │  └─ api/
│  │     │     ├─ health/route.ts
│  │     │     ├─ profile/route.ts
│  │     │     ├─ settings/route.ts
│  │     │     ├─ recipes/route.ts
│  │     │     ├─ recipes/[id]/route.ts
│  │     │     ├─ recipes/lookup/route.ts
│  │     │     ├─ runs/route.ts
│  │     │     ├─ runs/[id]/route.ts
│  │     │     ├─ map/route.ts
│  │     │     ├─ summarize/route.ts
│  │     │     ├─ ask/route.ts
│  │     │     └─ playground/score/route.ts  stores a playground score
│  │     ├─ components/         ui/ (shadcn), Logo.tsx, Nav.tsx, StatCard.tsx, DataTable.tsx, JsonView.tsx
│  │     ├─ playground/
│  │     │  ├─ cases.ts         registry: id, title, stack, expected values, which widgets
│  │     │  ├─ Scorer.tsx       "Check result" panel; exposes window.__ottoScore()
│  │     │  └─ cases/           one component per React case (see 07-playground.md)
│  │     └─ lib/
│  │        ├─ db/schema.ts     Prisma models
│  │        ├─ db/index.ts      connection + seed (demo profile)
│  │        ├─ ai/client.ts     Anthropic client + helpers (parse, usage logging)
│  │        ├─ ai/prompts.ts    system prompts for map / summarize / ask
│  │        └─ http.ts          json(), error(), zod body parsing
│  │
│  └─ extension/                ── WXT Chrome extension
│     ├─ wxt.config.ts          manifest, modules (@wxt-dev/module-react, auto-icons)
│     ├─ assets/otto-app-icon.svg
│     └─ src/
│        ├─ entrypoints/
│        │  ├─ background.ts    open side panel on action click; ENSURE_ENGINE; relay; re-inject on failure
│        │  ├─ engine.ts        defineUnlistedScript → boots packages/core message handlers (ISOLATED)
│        │  ├─ main-world.ts    defineUnlistedScript → framework bridge (MAIN), talks via CustomEvent
│        │  └─ sidepanel/
│        │     ├─ index.html
│        │     ├─ main.tsx
│        │     ├─ App.tsx       header (mark + otto + connection dot) + tabs
│        │     ├─ tabs/PageTab.tsx   summarize + ask follow-up
│        │     ├─ tabs/FillTab.tsx   scan → preview → fill → results → save recipe
│        │     ├─ tabs/PickTab.tsx   picker → prompt → answer/actions
│        │     └─ tabs/LogTab.tsx    last runs, timings, LLM calls
│        ├─ lib/
│        │  ├─ api.ts           backend client (base URL from settings, default http://localhost:3000)
│        │  ├─ messaging.ts     @webext-core/messaging protocol from packages/shared
│        │  ├─ tab.ts           current tab tracking (onActivated / onUpdated)
│        │  └─ run.ts           builds RunReport, posts to /api/runs
│        └─ styles.css          Tailwind + tokens (same as web)
│
└─ e2e/                         Playwright: load extension, open playground cases, assert scores
   ├─ playwright.config.ts
   └─ cases.spec.ts
```

## Workspace scripts (root `package.json`)

| Script | Does |
|---|---|
| `npm run dev` | `concurrently` → `npm run dev -w @otto/web` + `npm run dev -w @otto/extension` |
| `npm run build` | build shared → core → web → extension |
| `npm test` | Vitest in `packages/core` |
| `npm run e2e` | Playwright against `localhost:3000` with the built extension |
| `npm run db:push` | `prisma db push` for the PostgreSQL schema |
| `npm run typecheck` | Biome check |

## Package names

`@otto/shared`, `@otto/core`, `@otto/web`, `@otto/extension`. Internal packages are consumed as TypeScript source (`"main": "src/index.ts"`, with `transpilePackages` in Next and WXT/Vite handling the extension) — no separate build step during development.
