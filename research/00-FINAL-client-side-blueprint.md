# Client-Side AI Form-Filling & Page Assistant — Implementation Blueprint

Date: 2026-10-29. Synthesizes research files 01–07 in this folder plus the user-supplied docs in `inputs/`. Detailed evidence, code and sources live in the numbered files; this document is the decision layer.

| File | Content |
|---|---|
| 01-research-report.md | First deep-research run (market, caching, Antigravity, select-then-prompt) |
| 02-critic-issues-and-fixes.md | Critic review: 22 problems + fixes, first architecture |
| 03-cross-review-user-docs.md | Cross-review of user docs: keepers, errors, contradictions, client-side drops |
| 04-client-side-implementation-research.md | Second deep-research run: Nanobrowser, Page Agent, CDP, iframes, shadow DOM |
| 05-mv3-lifecycle-and-delivery.md | MV3 lifetime, storage, permissions, CWS policy, alternative delivery |
| 06-local-ai-vault-self-healing.md | On-device AI, encrypted vault, Similo++/Healenium/Playwright healing, signatures |
| 07-fill-engine-every-widget.md | Per-widget fill algorithms from library source, fill-engine design |

| 08-perception-without-aria.md | Finding controls and labels on any site without ARIA; visual fallback |
| 09-edge-cases.md | ~90 edge-case websites/situations with detection and fixes |
| 10-lightweight-performance.md | Zero-idle-cost injection, fast scanning, performance budget |
| 11-cross-browser.md | Chrome, Edge, Brave, Opera, Firefox, Safari, mobile, fallbacks |

## v2 revisions (2026-10-29) — these override the sections below where they conflict

1. **No automation framework in the product.** Playwright is test-harness only; the product is plain content scripts. `chrome.debugger` stays Pro-only.
2. **Zero idle cost:** no manifest `content_scripts`. Engine (<50 KB) injected on demand via `activeTab` + `scripting.executeScript` from a user gesture (toolbar, shortcut, context menu, side panel). Top frame + specific `frameIds` only. MutationObserver only while the assistant is open. (10)
3. **Perception does not depend on ARIA.** DOM + layout + computed style + hit-testing exist on every HTML page. Signals: native controls, `cursor:pointer` roots, tabindex, `onclick`/`jsaction`, framework handler probes (React `__reactProps$`, Vue `_vei`, Svelte `events`, jQuery `_data`), icon rule; labels via Chromium `InferLabelForElement` cascade + geometry fallback. ARIA only raises confidence. Optional per-site MAIN-world `addEventListener` hook for opted-in sites / "deep scan". (08)
4. **Visual fallback only on escalation:** Flutter semantics, Docs/Sheets DOM shell, pdf.js first; then `captureVisibleTab` (≤2/s) + nano YOLO GUI detector (~3–6 MB) + PP-OCRv5 mobile (~20 MB) in the model host; Gemini Nano / cloud set-of-marks only to name unlabeled icons. Avoid AGPL OmniParser. (08)
5. **Rules first, models optional:** autocomplete + regex + synonyms + fuzzy match resolve most fields; embeddings/Nano/cloud only for leftovers; repeat visits = 0 model calls. (10)
6. **Every browser:** shared `core/` (pure TS IIFE: extractor, matcher, filler, vault) + `ai/` provider interface (Chrome Prompt API, Edge Phi-4-mini, WebGPU/WASM, Apple Foundation Models via native handler, companion, rules-only) + thin WXT `shell/` per browser (Chromium sidePanel/offscreen; Firefox sidebar_action/event page; Safari popup + in-page overlay). Capability registry at startup; UI greys out missing features. Bookmarklet/userscript build of `core/` for DuckDuckGo, Chrome Android, locked-down machines. (11)
7. **Rollout:** Chrome Web Store (covers Brave/Vivaldi/Arc/Yandex/Opera helper) → Edge → Firefox desktop + Android → Safari macOS + iOS ($99/yr) → Opera store + Orion → userscript/bookmarklet → companion, Samsung Internet. (11)
8. **Edge-case handling in v1:** restricted-page guard, inject-and-retry-once, orphan/update safety, honeypot/visibility filter, hard never-fill list, settle detection + SPA/Turbo/HTMX/bfcache, hydration-safe filling, occlusion/topmost-modal, multi-page/postback flows, task binding by `{tabId, documentId, frameId}`, clear environment messages. (09)
9. **Durable state** is IndexedDB / `storage.local`; `storage.session` only for hot state and the session key. (03 C9)

---

## 1. Decisions

1. **Delivery: Chrome MV3 extension is the core.** It is the only option that works on the user's own logged-in tabs, installs in one click, and needs no backend. Same package ships to Edge/Brave. (05)
2. **No `debugger` permission in the main listing.** It cannot be optional, triggers a "read and change all data" warning and a non-dismissable infobar, and slows review. Default fill is DOM-level from content scripts; trusted CDP input lives in a separate "Pro / Trusted Input" build or the companion. (05, 07)
3. **Phase 2 add-ons:** optional native-messaging desktop companion (real file paths, OS input, local Ollama/llama.cpp, local MCP), and a Firefox port (no debugger, `sidebar_action`, `background.scripts`). Defer Safari, Electron/Tauri, bookmarklets. (05)
4. **No server anywhere.** No hosted browsers, no backend DB, no relay. Cloud LLMs only via user's own key (BYOK) called directly from the extension, opt-in per site. (03 D)
5. **AI decides, code acts.** The LLM returns JSON action plans/mappings; bundled code executes them. Never `eval` model output (CWS remote-code ban). (05)
6. **Personal values never reach any LLM.** Models see field descriptors and profile **key names** only; values are substituted locally at fill time. (02 B14, 06)
7. **Record once → replay deterministically → heal only broken steps.** Steps are declarative JSON keyed by Chromium-style form/field signatures with multi-attribute fingerprints. (06)

## 2. What we take from existing tools

| Source | Take | Leave |
|---|---|---|
| **Nanobrowser** (MV3, open source) | Side-panel agent; element IDs bound to exact nodes (stale ID fails, never mis-targets); pre-action checks: visible, stable, enabled, not covered; Ask/Auto modes; per-site Allow/Ask/Block; local models via Ollama/LM Studio; BYOK. | Relying on the model to *notice* sensitive actions — add deterministic gates. Debugger-only control (infobar). |
| **Bitwarden** | Fill sequence (click, focus, keys, value, input, change); `local-backed-session-storage` vault-lock pattern; shadow-host hydration tracking; passkey PRF unlock. | — |
| **Chromium autofill** | Event order focus → keydown → value → input → change → keyup → blur; FormSignature/FieldSignature; `autocomplete` + regex heuristics. | — |
| **job_app_filler / Autofill-Jobs** | Workday/Greenhouse adapters; sequential fill queue; MAIN-world React-prop calls. | — |
| **Alibaba Page Agent / Browser Use** | Text-indexed DOM snapshot (buildDomTree lineage), no screenshots by default; paint-order occlusion filtering. Browser Use = reference for companion path. | Server/Python runtime in core. |
| **Stagehand / Skyvern / workflow-use** | Concept: AI once → cache → replay → fallback. | Their server caches/codegen. |
| **Playwright** | Locator priority + `selectorGenerator.ts` scoring. | Playwright runtime in extension. |
| **Similo++ / Healenium / mabl** | Weighted multi-attribute healing; ancestor-path LCS; commit heal only after success. | — |
| **Google Gemini-in-Chrome security** | Origin sets, action critic on metadata, confirmations, injection classifier. | — |
| **Antigravity / Chrome DevTools MCP** | a11y snapshot with uids + on-demand screenshots; recordings → our local audit screenshots. | CDP-over-port model (Chrome 136 blocks default profile). |
| **Select-then-prompt tools** (React Grab, v0, Onlook, Lovable) | Picker overlay → element fingerprint + subtree + crop as prompt context. Source mapping only for optional localhost dev mode. | — |

## 3. Architecture

```
┌──────────────── Chrome MV3 extension ────────────────────────────────────────┐
│ Side panel (UI + agent loop, long-lived)    Offscreen doc (WORKERS)           │
│   chat, summary, fill preview/diff,           Transformers.js embeddings,      │
│   confirmations, picker results               WebLLM (opt-in), Argon2 WASM,    │
│                                               unlocked vault DEK in memory     │
│ Service worker = stateless router (events, permissions, alarms, nav events)   │
│ IndexedDB: encrypted profile · mappings · step recipes · run journal ·        │
│            episodic log · audit log          storage.session: hot state only  │
├──────────────── per frame (all_frames, match_origin_as_fallback) ────────────┤
│ ISOLATED content script: scanner, snapshotter, fill engine, verifier,         │
│   gates, picker overlay, MutationObserver, readiness checks                   │
│ MAIN-world bridge: React/Vue props, flatpickr/CKEditor/TinyMCE APIs,          │
│   submit() wrap, Navigation API hooks, WebMCP document.modelContext           │
└──────────────────────────────────────────────────────────────────────────────┘
   optional ─ Pro build: chrome.debugger TrustedBridge (CDP input, OOPIF, file set)
   optional ─ Native companion: Ollama/llama.cpp, OS input, file dialogs, local MCP
   optional ─ BYOK cloud LLM (descriptors + key names only)
```

### 3.1 Capture & page understanding
- Prefer **WebMCP** tools if `document.modelContext` exposes them (most reliable path). (05)
- Otherwise build a **compact hybrid snapshot**: interactive elements with numeric refs, role, accessible name, label, state; array format `[id, roleCode, name, {attrs}]`; drop invisible nodes **except functional hidden inputs**; strip hidden/low-contrast text (injection defense); collapse wrapper chains. (03 A1–A2)
- Shadow DOM: TreeWalker + `chrome.dom.openOrClosedShadowRoot(el)` for closed roots; store host chain in locators. Iframes: per-frame scripts report to top frame by `frameId`; cross-origin OOPIFs need host permission per origin (or CDP flat sessions in Pro build, Chrome 125+, re-attach per level). (04)
- Canvas / poor AX tree → screenshot (`captureVisibleTab`) + set-of-marks; local UI-DETR-1 detector optional. (03 A20)
- Summaries: Readability-style distill → Chrome **Summarizer API** (stable 138) → cloud fallback; output schema: purpose, entities, actions, forms, tables, risks. (02 A7, 03 A12)

### 3.2 Field understanding — routing ladder (stop at first confident answer)
1. Deterministic: `autocomplete` tokens, `type`, `inputmode`, localized regex on name/id/label/placeholder/aria, label resolution, nearest heading/section, saved mapping by (FormSig, FieldSig). Accept ≥0.9.
2. Local embeddings (bge-small / MiniLM q8, offscreen). Accept top-1 ≥~0.75, margin ≥0.1.
3. **Gemini Nano Prompt API** (extensions, Chrome 138+, if `available`): batched, enum `responseConstraint`, temp 0.
4. Local server (Ollama/LM Studio, probe 300 ms).
5. WebLLM opt-in (Qwen3-1.7B q4f16_1, ~2 GB VRAM).
6. Cloud BYOK opt-in per site: descriptors + key names only, digits ≥5 masked, static prompt prefix first for caching.
- Output always `{ref, profileKey|unknown, confidence}`; confidence tiers **autofill / suggest / ask**; never invent values — ask the user and save. (06 a, 03 A15)

### 3.3 Memory (all local)
- **Profile:** typed schema aligned to `autocomplete` tokens + custom fields, synonyms, locale formats, per-field "never autofill", sensitivity tiers T0–T3.
- **Site memory:** learned field mappings by signature; user corrections override.
- **Workflow memory:** step recipes (schema in 06 c).
- **Episodic:** past runs, failures, heals — for resume and "why did this fail".
- Long agent runs: compaction at ~80% context + last 3–5 steps; ledger holds key names, never values. (03 A11, A17)

### 3.4 Fill engine (07)
Detector → AdapterRegistry (site adapters: Workday, Greenhouse, Lever, iCIMS, Ashby; widget adapters: react-select, MUI Select/Autocomplete, AntD/rc-select, Radix, Headless UI, Select2, Chosen, mat-select, MUI X / rc-picker / react-datepicker / flatpickr, imask/cleave/react-input-mask/Inputmask, ProseMirror/Lexical/Draft/Quill/CKEditor/TinyMCE, dropzone/file; generic native + ARIA) → Primitives → MainWorldBridge → TrustedBridge → Verifier.

Per-field escalation (stop at first verified rung, 3–5 s budget):
1. adapter (isolated) → 2. generic ARIA/native → 3. per-char `execCommand('insertText')` → 4. MAIN-world library API → 5. CDP trusted input (Pro/companion) → 6. `needs_user` + highlight.

Key rules: canonical event order focus → keydown → value → input → change → keyup → blur; full `PointerEvent` init dicts (`button:0, pointerType:'mouse'`); fill sequentially via queue; re-detect after each fill; read back after a settle tick and check `aria-invalid`/validity/error text; checkboxes via `click()`; files via `DataTransfer`.

Readiness before every action: element stable across 2 rAFs, `scrollIntoView({block:'center'})`, not covered (`elementFromPoint`), network quiet (MAIN-world fetch/XHR counter, <2 in-flight for 500 ms) + no mutations 200 ms. (03 A3–A4)

### 3.5 Replay & self-healing (06 c)
- Step record: action, `valueRef` (key name), origin, urlPattern, form `{sig, altSig, structSig, fieldSigs}`, ranked locators (testid, role+name, label, placeholder, id, Robula XPath), Similo++ fingerprint + ancestor path + optional embedding, `dangerous`, stats, heal history.
- Validate: same FormSig → stored locators; altSig/structSig match → only vanished fields suspect; no match → heal each step.
- Heal: ranked locators → Similo++ + embedding + ancestor-LCS scoring → accept if score ≥ θ and margin ≥ δ → ambiguous → model picks among top 3 or ask user → **never auto-heal dangerous steps** → **commit heal only after step + postcondition succeed** → 2 failed heals → agent mode for that step only.
- Stuck control: 20-action hash window, page fingerprint, nudge at 3, abort at 5 repeats/stagnant pages, backoff 250 ms × 2^n (max 3) for transient errors, checkpoint restore.

### 3.6 Persistence (05)
- Agent loop runs in the side panel / offscreen document; SW only routes.
- Run journal in **IndexedDB**, written every step: `planned → applying → applied → verified`.
- On wake: for `applying` steps, re-read DOM; matches → verified, else re-apply. Idempotent actions only; preconditions for non-idempotent ones.
- **Never auto re-submit after a crash.**
- `storage.session` only for hot state and the session key (cleared on restart/update — by design locks the vault).

### 3.7 Vault & privacy (06 b)
- Random 256-bit DEK, AES-GCM per record (fresh IV, AAD). KEK per unlock method: Argon2id (WASM) or PBKDF2-SHA256 ≥600k; passkey PRF (test from extension origin; password fallback); optional PIN.
- Unlocked DEK as non-extractable CryptoKey in offscreen memory; auto-lock via `chrome.alarms` + `chrome.idle`.
- Content scripts get only the values for one fill, after: user invoked on this tab; frame origin == invoked origin; tier allows (T2/T3 re-prompt); `sender.origin`/`frameId` match.
- T3 (card/bank) never to any LLM; only into `autocomplete="cc-*"` or after explicit confirmation; payment iframes opt-in.

### 3.8 Safety gates (deterministic backstop)
Confirm before: any submit (capture-phase `submit` listener + MAIN-world `HTMLFormElement.prototype.submit/requestSubmit` wrap), `input[type=password]`, `autocomplete` `cc-*`/`transaction-*`/`one-time-code`, button text/aria matching pay/place order/purchase/buy/submit/send/confirm/transfer/delete/sign (localized), cross-origin `action`/`formaction`. Also: no navigation/network to new origins mid-task; agent never makes network calls on the page's behalf; spotlight untrusted content; CAPTCHA/2FA → hand off to user; per-site ToS denylist; hash-chained encrypted audit log. Treat WebMCP tool descriptions as untrusted.

### 3.9 Permissions (05)
`activeTab`, `scripting`, `sidePanel`, `offscreen`, `storage`, `unlimitedStorage`, `alarms`, `idle`; `optional_host_permissions: ["https://*/*"]` requested per site in a user gesture; `webNavigation` optional-worthy (history warning); `nativeMessaging` optional; `debugger` only in Pro build. CSP `extension_pages`: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';`. `minimum_chrome_version` ≥ 120 (138 for Prompt API features, feature-detected).

### 3.10 UI
Side panel chat + page summary; inline field highlights with key chips and confidence colors; diff/accept panel with per-field toggles; undo snapshot; per-site autonomy (suggest / fill / fill+submit); element-picker overlay (`elementFromPoint` → `composedPath()` → component-boundary ancestor → fingerprint + subtree + crop) for "select and prompt"; popup-window fallback when side panel is unsupported or shifts breakpoints.

## 4. Build phases
1. **Copilot:** extension skeleton, side panel, snapshotter, summary (Summarizer API + BYOK fallback), picker overlay, schema extraction from selected region.
2. **Smart fill:** vault, profile UI, field-understanding ladder, fill engine with generic + top widget adapters, verifier, gates, preview/diff, audit log.
3. **Resilient workflows:** recorder, step recipes, signatures, Similo++ healing, IndexedDB journal + resume, stuck control, site adapters (Workday, Greenhouse…).
4. **Expand:** Pro trusted-input build, native companion, Firefox port, WebMCP consumption, import/export signed recipes, enterprise policy install.

Build a benchmark early: ~50 real forms across React, Vue, Angular, plain HTML/PHP, ATS portals, government sites and checkouts. Track fill accuracy, wrong-fill rate, heal success, LLM calls/form, p50/p95 latency, $/form.

## 5. Honest limits
- "Every field filled perfectly" is not achievable on every site. Widget adapters are a long tail and need ongoing upkeep; the `needs_user` rung is part of the design.
- Without the debugger, sites that check `isTrusted` (rare, mostly anti-bot) and some masked inputs/OOPIFs need the Pro build or companion.
- Prompt injection is unsolved industry-wide; gates and keys-only prompts reduce impact, not eliminate it.
- Gemini Nano needs capable desktop hardware; many users will fall back to embeddings + BYOK.
- Chrome itself is moving here (Gemini in Chrome, "Find and fill with Gemini", WebMCP). Differentiate on local memory, cross-browser, reliability on hard widgets, replayable workflows.
- Unverified items to test before committing: Nano quality/context on field mapping; PRF from `chrome-extension://`; Nanobrowser internals beyond README; several widget libraries marked M in 07; legal review (GDPR, ToS, CWS Limited Use).
