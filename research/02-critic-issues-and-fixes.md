# Critic Review: Issues, Fixes, Gap-Fill, Revised Architecture

Confidence: H = primary doc/code verified; M = secondary or partial primary; L = inference / single weak source.

**Bottom line.** The "LLM understands once → cache/compile → replay" core is right, but all three cited implementations (Stagehand cache, Skyvern codegen, workflow-use) are server-side and none transfers directly to a Chrome MV3 extension. The report also missed the hardest parts: reliable field filling, PII isolation from the LLM, MV3 constraints, and on-device models.

## A. Issues with the research report

| # | Issue | Fix |
|---|---|---|
| A1 | Core pattern relies on server-side tools. Stagehand cache = Browserbase-only; Skyvern = Playwright codegen; workflow-use = "not for production". MV3 bans remote/generated code. | Store replay as declarative action JSON (field fingerprint + profile key + widget adapter id), run by a local interpreter. No generated code. |
| A2 | Cache key (instruction + AX tree) misses constantly on SPAs. | Key on (origin, path pattern, form signature, step) like Chromium `FormSignature`/`FieldSignature`. Validate hits with Similo-style multi-attribute locator scoring. |
| A3 | Architecture/batching/security guidance from one vendor-founder preprint (arXiv 2511.19477), n=1. | Triangulate with shipping products and Chromium/Firefox autofill code. Go further than batching: one LLM call maps all fields to profile keys. |
| A4 | WAREX numbers are GPT-4o-era, generic harnesses. | Treat as qualitative; still build retry/reload/wait in code. |
| A5 | State-of-the-art angle was blog-heavy; no consumer-agent claims survived. | Filled in Section C. |
| A6 | Antigravity "AX snapshot" refutation likely only reflects the docs page; Chrome DevTools MCP has `take_snapshot` returning an a11y tree with uids. | Re-check chrome-devtools-mcp README. |
| A7 | Page scan & summarize not researched. | Readability.js / DOM distillation → Chrome Summarizer API (stable Chrome 138) on-device → cloud fallback for long pages. |
| A8 | No coverage of local models, routing, PII, field matching, MV3, iframes, shadow DOM, screens, CWS policy. | Section B. |
| A9 | Select-then-prompt only covers dev-tool source mapping; impossible on production sites. | End-user product needs an element-picker overlay producing fingerprint + context. Source mapping only for optional dev mode. |
| A10 | No cost/latency numbers, no eval plan. | Build internal benchmark (~50 real forms + WebArena/Mind2Web form subset). Track fill accuracy, wrong-fill rate, p50/p95 latency, $/form. |
| A11 | acebuilder.ai unchecked. | It is Aceternity's AI landing-page builder (hosted, beta): "point at a section and run a skill" over Aceternity UI Pro blocks. Low reference value. [H] |

## B. Product / engineering problems and solutions

| # | Problem | Sev | Solutions | Conf |
|---|---|---|---|---|
| B1 | MV3 service worker killed after ~30s idle | Critical | Stateless SW; run state in `chrome.storage.session`; long runs held in side panel or offscreen document; extenders: active debugger session / WebSocket (116+), long-lived ports (110+), `chrome.alarms` 30s (120+); idempotent, resumable steps. | H |
| B2 | `chrome.debugger` shows "started debugging this browser" infobar on all tabs | High | Default to content scripts. Attach debugger on demand only for trusted input (`Input.dispatchKeyEvent`/`dispatchMouseEvent`), full screenshots, `Accessibility.getFullAXTree`, `DOMDebugger.getEventListeners`, OOPIF via `Target.setAutoAttach {flatten:true}`; detach after. Enterprise policy install avoids banner. | H/M |
| B3 | CSP + remote-code ban | High | Declarative interpreter; adapters bundled in package; `chrome.userScripts` only for power users; `chrome.scripting.executeScript({world:'MAIN'})` for page-world access. | M-H |
| B4 | Shadow DOM | High | Recursive TreeWalker over `shadowRoot`; closed roots via `chrome.dom.openOrClosedShadowRoot(el)` (Chrome 88+); MutationObserver for late hydration (see Bitwarden `shadow-host-hydration-tracker.ts`); locators store host chain (Playwright `>>` model). | H |
| B5 | Cross-origin iframes | High | `content_scripts` with `all_frames:true`, `match_about_blank`, `match_origin_as_fallback`; per-frame agents report to top frame by `frameId`; `chrome.webNavigation.getAllFrames`; offset coordinate mapping. Payment iframes (Stripe/Adyen) filled only from explicit card vault, never from LLM. | H |
| B6 | Canvas apps (Docs, Sheets, Figma) | Med | Detect canvas-dominant pages → vision + set-of-marks; prefer app APIs (Sheets/Docs REST, Figma plugin API); Docs canvas annotation requires Google allowlist (`_docs_annotate_canvas_by_ext`); keyboard-driven actions in Sheets. | M |
| B7 | React/Vue/Angular controlled inputs ignore `el.value=` | Critical | Native prototype setter: `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v)` + bubbling `input`/`change` + `focus`/`blur`; checkboxes via `click()`; fallback CDP `Input.insertText`; always read back. | H |
| B8 | Custom dropdowns, comboboxes, date pickers, masks | Critical | Widget-adapter registry detected by ARIA role + class signatures (react-select, MUI, Select2, Chosen, Headless UI, flatpickr, react-datepicker, AntD). Flow: open → type filter → wait listbox (MutationObserver catches body portals) → fuzzy-match option → click → verify. Dates: type locale format first, calendar second. Masks: trusted char-by-char typing. | M |
| B9 | Multi-step / wizard forms | High | State machine per form-signature step, persisted in `chrome.storage.session`; rescan on `webNavigation.onCommitted`/`onHistoryStateUpdated` + Navigation API; classify Next/Continue buttons; pause on review/submit pages. | M |
| B10 | CAPTCHA / bot detection | High | Never solve; detect reCAPTCHA/hCaptcha/Turnstile and hand off to user. Real user profile = real fingerprint. CWS (Aug 2026) bans extensions bypassing safeguards. | M |
| B11 | Responsive layouts / screen sizes | High | Act on DOM/AX semantics, not pixels; `checkVisibility()` + rect + `elementFromPoint` occlusion test; `scrollIntoView` before acting; layout-independent locators; scale screenshot coords by `devicePixelRatio` and `chrome.tabs.getZoom`. Side panel narrows viewport and may trigger mobile breakpoints → offer popup-window mode. | M |
| B12 | Field semantic matching | Critical | Cascade: (1) `autocomplete` tokens; (2) Chromium/Firefox multilingual regex heuristics on name/id/label/placeholder/aria; (3) label resolution (`label for`, wrapping label, `aria-labelledby`, preceding text, th, legend); (4) local classifier/embeddings (Transformers.js MiniLM, Mozilla Fathom); (5) LLM only for leftovers, constrained to enum of profile keys + `unknown`. Learn per-site corrections keyed by field signature. | H/M |
| B13 | PII storage | Critical | `chrome.storage.local` is plaintext. Encrypt with WebCrypto AES-GCM; key via Argon2id (WASM) / PBKDF2 600k, or WebAuthn PRF passkey; unlocked key only in `chrome.storage.session` with auto-lock; sensitivity tiers (card/SSN/passport need re-auth); local-first, optional E2E sync. | H |
| B14 | Prompt injection & profile exfiltration | Critical | Never send PII values to the LLM — only field descriptors + profile key names; substitute values locally. Bind PII to the invoking tab's origin (Google "Agent Origin Sets"). Separate action critic on metadata only (Google "User Alignment Critic"). Strip hidden/low-contrast text. Injection classifier. Confirm submit/pay/send. Block new-origin navigation/network during fill. | H |
| B15 | Latency & cost | High | Routing ladder: L0 cache + heuristics (0 tokens, <50ms) → L1 Gemini Nano via Prompt API (stable 138, extensions) + Summarizer API → L2 small cloud model (Haiku/Flash class) → L3 large model + screenshot. Nano needs capable desktop hardware; feature-detect `availability()`. WebLLM opt-in only. Prompt caching for static prefixes. Compact snapshots with numeric refs. | H/M |
| B16 | SPA cache invalidation / page change | High | Debounced MutationObserver; Navigation API/history hooks in MAIN world; recompute form signature, invalidate only changed step. Similo multi-attribute locators (72 vs 146 failures, ~4ms/lookup; VON-Similo 94.7%). Self-heal by score before LLM; write back healed locators. | H |
| B17 | Bad AX tree on poor markup | High | Hybrid snapshot: AX role/name + DOM heuristics (`cursor:pointer`, onclick, tabindex, CDP event listeners); paint-order/occlusion filtering (Browser Use `DOMSnapshot.captureSnapshot includePaintOrder`); set-of-marks vision fallback. | M-H |
| B18 | Hallucinated fills | Critical | Schema-constrained output; per-field confidence, leave low-confidence empty + highlight; never invent missing values — ask user and save to memory; read-back; format validation (libphonenumber etc.); no auto-submit by default. | M |
| B19 | Trust / confirmation UX | High | Preview overlay with per-field source-key chips; diff/accept panel; undo snapshot; activity log; per-site autonomy (suggest / fill / fill+submit); sensitive-action confirmation. | M |
| B20 | Legal: GDPR, ToS, CWS policy | High | CWS Limited Use + privacy policy + disclosure; disclose LLM upload; zero-retention DPA with LLM vendor; EU region; redact third-party PII; per-site ToS denylist; user-initiated runs. Needs counsel. | M |
| B21 | Network / transient faults | Med | Code-level retry with backoff; network-idle wait; reload on error pages; expose "retry" to the LLM. | M |
| B22 | Chrome absorbing the feature | High (strategic) | Chrome testing "Find and fill with Gemini"; WebMCP (`document.modelContext`, Chrome 146 preview / ~149 origin trial). Differentiate: cross-browser, user-owned memory, power/B2B workflows. Consume WebMCP tools when present. | M |

## C. Gap-fill

### C1. How consumer agents read pages
- **Claude in Chrome**: `read_page` injects a DOM walker building an ARIA-role tree with ref IDs (depth ~15, char cap); `find` for NL element search; screenshots via CDP; `chrome.debugger` for trusted input (hence infobar). [M, reverse-engineered]
- **Gemini in Chrome**: security architecture public (planner, User Alignment Critic, Agent Origin Sets, injection classifier, confirmations); page-reading internals not public. [H security / L reading]
- **ChatGPT Atlas**: uses ARIA roles/labels; publisher FAQ tells sites to improve ARIA. [M-H]
- **Perplexity Comet**: closed; Brave's research implies text extraction + screenshot OCR. [M]
- **Nanobrowser** (open-source MV3 extension): Planner/Navigator/Validator agents; DOM extraction derived from Browser Use `buildDomTree.js`; BYO key. Best reference codebase. [M]
- **Browser Use**: CDP `DOMSnapshot` + AX tree + paint-order filtering → indexed clickable list. [M]
- **Antigravity**: Chrome DevTools MCP over remote debugging to a dedicated Chrome; `take_snapshot` a11y tree with uids; on-demand screenshots; WebM recordings. Dev-tool setup; only transferable to an extension via `chrome.debugger`. [M]
- **Common pattern**: compact AX/ARIA tree with stable refs as primary input, screenshots as supplement, execution in code.

### C2. acebuilder.ai
Aceternity UI landing-page builder: chat, templates, blocks, "point at a section, run a skill", downloadable source. Selection mechanism undocumented. Onlook and React Grab are better references. [H]

### C3. Component-to-source mapping
- React 19 removed `_debugSource` (PR #28265, issue #29092). DevTools now uses owner stacks + source maps; `captureOwnerStack()` in 19.1 (dev only). [H]
- Options: (a) build-time attribute injection (LocatorJS Babel/SWC, `code-inspector-plugin`, `react-dev-inspector`); (b) runtime fiber hooks via bippy installing `__REACT_DEVTOOLS_GLOBAL_HOOK__` from a MAIN-world `document_start` script, then resolving owner stacks via source maps (React Grab approach); (c) Vue dev: `el.__vueParentComponent.type.__file`.
- For this product: only for a localhost developer mode. End-user "select then prompt" = picker overlay → `elementFromPoint` (shadow-piercing) → fingerprint + AX subtree + outerHTML excerpt + cropped screenshot → prompt context.

### C4. MV3 reference architecture
Stateless service worker (router) · side panel UI (chat, previews, long-lived connection) · content scripts in all frames (ISOLATED world) for scan/fill · small MAIN-world script for framework hooks + Navigation API · offscreen document for WASM (Argon2, Transformers.js, WebLLM) · `chrome.debugger` on demand · storage: `chrome.storage.session` for unlocked keys + run state, IndexedDB for encrypted profile + mapping cache.

## D. Revised architecture

1. **Capture** — content script in every frame, pierces open/closed shadow roots. Form extractor (fields, labels, autocomplete, aria, nearby text, rect, visibility, widget type); Readability-style distiller for summaries; WebMCP tools first if present; screenshot and debugger only on demand.
2. **Page understanding** — compact hybrid snapshot (interactive elements, ref IDs, role/name/label/state, occlusion-filtered, hidden text stripped); form signature per form/step; canvas or poor AX → set-of-marks vision.
3. **Memory / profile** — typed schema aligned to autocomplete tokens + custom fields; synonyms and locale formats; AES-GCM encrypted, passphrase/passkey key, session-only unlock, auto-lock; sensitivity tiers; per-site learned mappings; local-first.
4. **Planning & LLM routing** — cache → heuristics → Gemini Nano → small cloud → large + vision. LLM sees descriptors + key names only, never values. One schema-constrained `{ref, profileKey|unknown, confidence}` batch call per form step. Prompt caching.
5. **Action execution** — deterministic interpreter; native-setter fill + events; widget adapters; trusted CDP typing fallback; scroll/hit-test/visibility; read-back; retry/backoff; wait-for-stable (mutation quiet + network idle).
6. **Caching & replay** — key (origin, path pattern, form signature, step); value = declarative steps with multi-attribute fingerprints, profile-key bindings, adapter IDs; validate on load, self-heal by score, LLM repair only the broken step, write back.
7. **Safety** — PII origin binding; action critic on metadata; confirmation gates (submit/pay/send/delete); no new origins mid-task; injection classifier; CAPTCHA/2FA hand-off; ToS denylist; payment-iframe policy; audit log.
8. **UI** — side panel chat + summary; inline field highlights with key chips + confidence colors; diff/accept, undo, per-site autonomy; element-picker overlay for select-then-prompt; popup-window mode.
9. **Evaluation** — form benchmark + consented telemetry: fill accuracy, wrong-fill rate, cache-hit rate, LLM calls/form, p95 latency, $/form.

## E. Remaining open risks
1. Chrome absorbing the feature (Find and fill with Gemini, Gemini agent mode, WebMCP). [M]
2. Gemini Nano hardware gating → cloud cost stays for many users; API availability still shifting. [M]
3. Debugger infobar UX + CWS scrutiny of `debugger` and `<all_urls>` permissions. [M]
4. Prompt injection unsolved industry-wide; mitigations reduce, not remove, risk. [H]
5. Widget-adapter long tail = ongoing maintenance. [H]
6. Canvas/closed apps may stay vision-only and slower. [M]
7. Legal: third-party PII, ToS bans on automation, EU AI Act transparency. [M]
8. Some Section C claims are reverse-engineered/secondary (Claude in Chrome internals, Comet, Nanobrowser lineage, Nano hardware numbers) — re-verify before final decisions.
9. Crowd-sourced mapping sharing raises privacy/CWS issues — ship local-only first. [L]

## Key sources
- Chrome extension SW lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- chrome.debugger: https://developer.chrome.com/docs/extensions/reference/api/debugger
- chrome.dom: https://developer.chrome.com/docs/extensions/reference/api/dom
- Chrome built-in AI: https://developer.chrome.com/docs/ai/built-in-apis · https://developer.chrome.com/docs/ai/summarizer-api
- CWS Limited Use: https://developer.chrome.com/docs/webstore/program-policies/limited-use
- Bitwarden autofill services: https://github.com/bitwarden/clients/tree/main/apps/browser/src/autofill/services
- Chromium autofill: https://chromium.googlesource.com/chromium/src/+/main/components/autofill/core/browser/
- Mozilla Fathom: https://mozilla.github.io/fathom
- Similo: https://arxiv.org/abs/2208.00677 · VON-Similo: https://arxiv.org/abs/2301.03863
- React controlled inputs: https://github.com/facebook/react/issues/10135
- Google agentic security: https://9to5google.com/2025/12/08/gemini-chrome-agentic-security/
- Brave on Comet injection: https://brave.com/blog/comet-prompt-injection/ · https://brave.com/blog/unseeable-prompt-injections/
- Nanobrowser: https://github.com/nanobrowser/nanobrowser
- Playwright ARIA snapshots: https://playwright.dev/docs/aria-snapshots
- React _debugSource removal: https://github.com/facebook/react/issues/29092 · LocatorJS: https://www.locatorjs.com/
- WebMCP: https://blog.logrocket.com/google-web-mcp/
- acebuilder.ai: https://acebuilder.ai
- Antigravity browser docs: https://antigravity.google/docs/commands/browser/
