# Cross-review: user research docs vs 01/02 (client-side constraint applied)

Reviewed: `inputs/user-deep-research-report.md` (deep), `inputs/user-ai-browser-automation-architecture.md` (arch), `inputs/user-pasted-hybrid-agent-research.md` (hybrid), `01-research-report.md`, `02-critic-issues-and-fixes.md`. 14 claims spot-checked on the web.

- **deep**: mostly generic, several misattributions, little new engineering.
- **arch**: most useful, but has fabricated-looking numbers, a wrong "dual-engine" Antigravity claim, and a real React fill **code bug**.
- **hybrid**: sound, agrees with 02; its backend stack is out of scope.
- **Fixes to our own docs**: 02 B10 overstates the CWS policy (C8); 02's use of `chrome.storage.session` for run state breaks the persistence requirement (C9).

## A. Unique ideas worth keeping

### From arch
| # | Idea | Client-side adaptation |
|---|---|---|
| A1 | Compact array snapshot: `[id, roleCode, name, {attrs}]`, short role codes (`btn`, `tbox`, `lbl`, `lnk`), label→input links (`{"for":3}`), merged text, empty attrs dropped, versioned `"v":1` | Wire format for the compact hybrid snapshot. Token savings plausible; exact numbers vendor-only. |
| A2 | Pruning: strip script/style/meta/svg internals; drop display:none / visibility:hidden / opacity 0 / zero-size nodes **except functional hidden form inputs**; collapse single-child wrapper chains | Exception matters: custom checkboxes/radios/selects hide the real `<input>` behind a styled proxy. |
| A3 | Layout-stability gate: bbox unchanged across 2 consecutive `requestAnimationFrame`s; `scrollIntoView({block:'center'})` first | Cheap, in-page; fixes misclicks during font/banner/hydration shifts. |
| A4 | Composite readiness: <2 in-flight requests for 500 ms (`networkidle2`) + no mutations for 200 ms + target attached, non-zero size, not under skeleton/backdrop | Without debugger: MAIN-world fetch/XHR counter + `PerformanceObserver('resource')` or non-blocking `chrome.webRequest`. |
| A5 | Stagnation detection: hash (normalized snapshot + URL) after each action; escalate retry nudge → Escape + close overlays + backtrack to last checkpoint → abort with screenshot | Tune thresholds ourselves (3/5/8 not from source). Persist checkpoints. |
| A6 | `Accessibility.getFullAXTree` includes shadow content incl. closed roots; `DOM.getDocument`/`describeNode` with `pierce:true` | Second route to closed shadow DOM when debugger already attached. |
| A7 | Picker ancestor choice: `elementFromPoint` → `composedPath()` → nearest component boundary (landmarks, styling boundary, React `__reactFiber$*` keys, present in prod) → package subtree + layout + styles | Answers "which ancestor did the user mean". |
| A8 | Spotlighting / provenance delimiters (`<untrusted_external_content origin=…>`) + planner/executor split with plan-conformance check | Defense in depth only, not a fix. Chrome agent-security guidance recommends it. |
| A9 | Agent never makes programmatic network calls for the page; all state changes via visible UI | Execution-layer rule; pairs with "no new origins". |
| A10 | Single-token logits scoring (A/B/C candidates, one forward pass) | Only with local model exposing logits (WebLLM offscreen or llama.cpp companion). Experimental. |
| A11 | Memory compaction at 80% context + last 3–5 step window (intent, tool call, DOM delta, result) | Confirmed in Lumen README. Ledger stores profile **key names**, never values. |

### From hybrid
| # | Idea | Note |
|---|---|---|
| A12 | Page-summary output schema: purpose, entities, actions, forms, tables, risks | Adopt as summarizer output schema. |
| A13 | Schema-constrained extraction scoped to a picker-selected DOM subtree | Cheaper, safer than whole page. |
| A14 | Per-field "never autofill" flag | Add to profile schema. |
| A15 | Formal confidence tiers: autofill / suggest / ask, per-site thresholds | |
| A16 | Matching features: nearest heading/section + historical mappings | Disambiguates billing vs shipping "Address". |
| A17 | Four memory types: profile, site, workflow, episodic | Episodic enables resume and failure explanations. |
| A18 | Picker recipe lifecycle: hover → select → classify → prompt → plan → confirm → execute → validate → save; semantic identity = role, accessible name, nearby text, DOM path, visual box | |
| A19 | MVP phasing: copilot → smart fill → resilient workflows → team/enterprise | Team phase redefined client-only (D12). |

### From deep
| # | Idea | Note |
|---|---|---|
| A20 | UI-DETR-1 (RF-DETR-M, open weights) as local UI element detector; self-reported 70.8 vs OmniParser 58.8 on WebClick | ONNX/WebGPU in offscreen doc or companion → local set-of-marks. https://huggingface.co/blog/paulml/ui-detr-1 |
| A21 | OS-level input fallback via desktop companion | Only route for native file pickers / OS dialogs. File inputs: DataTransfer → `input.files`, or CDP `DOM.setFileInputFiles`; companion last resort. |
| A22 | Ask for human review when uncertain | Already implied in 02. |

## B. Wrong / suspect claims

| # | Doc | Claim | Verdict | Evidence |
|---|---|---|---|---|
| B1 | arch | "Antigravity Dual-Engine" (BrowserMCP + Playwright CLI skill) is built-in | **Wrong.** Codelab is a user's manual setup; Antigravity has a separate built-in browser agent (Chrome DevTools MCP). | https://codelabs.developers.google.com/agentic-ui-automation-with-antigravity · https://antigravity.google/docs/commands/browser/ |
| B2 | arch | `setNativeInputValue()` calls `tracker.setValue(newValue)` | **Bug.** Makes tracker == DOM value → React suppresses onChange. Correct: native prototype setter + bubbling `input`; optionally `tracker.setValue(oldValue)`. Do not copy. | https://github.com/facebook/react/issues/10135 |
| B3 | arch | React overrides setter on `HTMLInputElement.prototype` | **Wrong detail.** React defines tracking on the node instance; that is why the prototype setter bypasses it. | React `inputValueTracking.js` |
| B4 | arch | Per-step latency/token table for browser-use, Stagehand, Fast Browser Use, Lumen, WebBrain | **Unsupported/likely fabricated.** Sources give no such per-step figures. Drop numbers. | https://www.browserbase.com/blog/stagehand-v3 · https://github.com/APUS-AI-Lab/fast-browser-use · https://github.com/omxyz/lumen |
| B5 | arch | Stagehand v3 uses native CDP, no Playwright, handles iframes/shadow | **Correct**, but still a Node/server library. | Stagehand v3 blog |
| B6 | arch | CDP `Input.dispatch*` = OS/hardware events | **Overstated.** Injected into Chromium's input pipeline; `isTrusted:true` but not OS-level. | chrome.debugger docs |
| B7 | arch | `Target.setAutoAttach {flatten:true}` reaches all cross-origin frames | **Incomplete.** Needs Chrome 125+ via chrome.debugger; not recursive; session cancelled when user opens DevTools. | chrome.debugger docs |
| B8 | arch | VulpineOS token figures (42,832 → 2,942, −93.1%) | Vendor marketing, n unstated. Anecdote. | https://vulpineos.com/product/optimized-dom |
| B9 | arch | SHA-256 state hash + 3/5/8 thresholds from Lumen | **Misattributed.** Lumen uses three-layer stuck detection, backtrack at level 8+. 80% compaction is correct. | Lumen README |
| B10 | arch | WebBrain/OpenBrowser specs | Unverified (source 403). | — |
| B11 | arch | Anti-bot: override `navigator.webdriver`, fake `window.chrome`, Bézier mouse, jitter | **Inappropriate.** Real Chrome profile already has `webdriver` false; stealth conflicts with ToS and CWS review. Drop. | — |
| B12 | arch | 70–90% token reduction | Plausible, unbenchmarked. | — |
| B13 | arch | Planner "Sonnet or GPT-4o", fast "Haiku or Qwen" | Outdated for Oct 2026; use routing ladder with Gemini Nano. | — |
| B14 | hybrid | Chrome agent-security URL | **Verified**, but WebMCP-specific (Jun 2026). Recommends size caps, `untrustedContentHint`, spotlighting, origin restriction, confirmations, classifiers, critic LLM, PII only when strictly needed. | https://developer.chrome.com/docs/agents/security |
| B15 | deep | "Gumloop's Browser Use" | **Misattribution.** Browser Use is independent OSS; Gumloop extension is record-and-replay. | https://gumloop.com/blog/feature-alert-gumloop-chrome-extension |
| B16 | deep | Stagehand AGPL | **Wrong.** Stagehand MIT; Skyvern AGPL-3.0. | https://github.com/browserbase/stagehand |
| B17 | deep | "Alibaba ~91% classification accuracy" | **Misattributed** to ReDraw (IEEE TSE 2018). | https://arxiv.org/pdf/2008.05132 |
| B18 | deep | Form filling cuts time 35–40% | Unsourced. Drop. | — |
| B19 | deep | Gemini summarize icon "in development" | Outdated; shipped 2025. | 9to5google Dec 2025 |
| B20 | deep | "Cloudflare Browser Run" | Name unverified (Browser Rendering exists); server-side anyway. | — |
| B21 | deep | Microsoft Foundry Browser Automation | Real, but hosted Playwright Workspaces; server-side. | Microsoft Learn |
| B22 | deep | Composite, Denker.ai, MemoryLake claims | Unverified vendor claims. | — |
| B23 | deep | Antigravity "UI Grade 7/10" demo | Anecdote; "review policies" = user approval gates. | — |

## C. Contradictions resolved

| # | Contradiction | Resolution |
|---|---|---|
| C1 | How Antigravity drives the browser | 01/02 correct: built-in agent via Chrome DevTools MCP/CDP. |
| C2 | Primary execution: CDP (arch) vs content scripts (02) | **Content scripts first** (native setter, read back), CDP trusted typing as escalation for masked inputs, isTrusted checks, stubborn OOPIFs. |
| C3 | React fill code | 02 correct; arch snippet buggy. |
| C4 | Vision role | AX/DOM-first; vision only for canvas/poor AX/ambiguity; prefer local detector + set-of-marks indexes, never raw coordinates. |
| C5 | Memory store: vector DB vs keyed | Keyed store `(origin, path pattern, form signature, step)` primary; embeddings only for label→profile-key leftovers; optional vectors in IndexedDB. |
| C6 | PII in compaction ledger | Never send values; ledger stores `{ref → profileKey, status}`. |
| C7 | Injection defense | Spotlighting + hidden-text pruning are layers; hard guarantees only from execution layer. Claim none as a fix. |
| C8 | CAPTCHA/bot detection | Keep hand-off. **Correct 02 B10**: Aug 2026 CWS rule targets bypassing **AI-platform** safeguards, not site bot detection. Reason to avoid evasion = ToS/legal + CWS deceptive-behavior review. https://www.androidauthority.com/chrome-web-store-extension-stricter-rules-3684115/ |
| C9 | Run state in `chrome.storage.session` | `storage.session` is in-memory, cleared on browser restart and extension reload/update. **Move run journal to IndexedDB**, written after every step. Keep only the unlocked crypto key in `storage.session`. Rehydrate and resume idempotently on SW wake. |
| C10 | Fixed viewport 1440×900 (arch) | Extension can't fix viewport. Act on semantics, re-resolve after resize, popup-window mode. |
| C11 | Stagehand caching versions | v4 cache Browserbase-only, cached act() replays with self-healing off. Copy concept only. |
| C12 | Stagehand license | MIT (borrowable with attribution); Skyvern AGPL (not for closed product). |
| C13 | Token savings 70–93% | Directional; measure on own benchmark. |

## D. Drop or change for client-side constraint

**Drop**
1. Backend Node/Python, Postgres, Redis, server vector DB → IndexedDB (encrypted profile, mappings, run journal, episodic log) + `chrome.storage.local` for small settings.
2. Hosted browsers (Browserbase, Kernel, Steel, Anchor, Browserless, Hyperbrowser, Cloudflare, Bright Data, Foundry, Skyvern cloud) — patterns only.
3. Stagehand v4 server cache, Skyvern codegen — declarative JSON steps instead.
4. Direct CDP WebSocket headless background workflows / `--headless=new` — only in optional desktop companion driving user's own Chrome.
5. Stealth techniques and CAPTCHA solvers (2Captcha).
6. Cloud session replay → local audit log + local failure screenshots in IndexedDB.
7. Docker/CI headless runs.

**Change**
8. Playwright runtime → content scripts + `chrome.debugger` in extension; Playwright/Patchright only in optional Native Messaging companion (file dialogs, OS input, local GPU models).
9. OmniParser → UI-DETR-1 ONNX/WebGPU in offscreen doc, else companion, else redacted cloud vision.
10. Cloud LLM calls only direct from client with BYOK or user OAuth; never embed vendor key; no relay server. Keep local-first ladder.
11. Telemetry and E2E sync need a server → local metrics + user-initiated export; `chrome.storage.sync` for non-PII settings only (~100 KB).
12. Team/enterprise → signed import/export recipe files + enterprise policy-installed extension (no debugger banner).
13. Run state → IndexedDB, written every step.
14. LangChain/MemoryLake memory → typed local profile + keyed site/workflow/episodic stores.
15. Network-idle readiness without debugger (MAIN-world fetch/XHR counter, `PerformanceObserver`, non-blocking `webRequest`).
