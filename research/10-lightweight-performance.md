# Lightweight, fast, low-memory extension — performance research

Confidence: H = primary source confirmed; M = credible secondary; L = engineering estimate — **measure every L number**.
Not found anywhere: buildDomTree.js timings for 5k/50k nodes; official Gemini Nano create/clone latency; SW cold start or per-isolated-world memory.

## 1. Injection strategy
**Field data (DebugBear, 1,004 extensions) — H:** Evernote 368 ms CPU/page (4.3 MB scripts); Honey 825 ms on ecommerce, ~0.5 s later first paint; Ubersuggest 7.5 MB, +1.6 s CPU; Pocket 2 MB, +110 ms. Grammarly cut ~500 → ~100 ms by loading full engine only on some sites (sentinel + lazy engine). `document_start` scripts (Outreach, LastPass) delay rendering. https://www.debugbear.com/blog/chrome-extension-performance-2021 · https://www.debugbear.com/blog/2020-chrome-extension-performance-report

**Bitwarden lesson (M):** always-on MutationObserver + field rescans cause lag (ExtJS grids, drag jank via `requestIdleCallbackPolyfill`, #12031/#11077; one report `getShadowRoot` 92 s). Users fix by blocking domains. → Always-on observing is the main way form fillers slow pages.

**Recommended:**
- **No manifest `content_scripts`.** `activeTab` + `scripting`; on gesture (toolbar, context menu, `commands` shortcut, omnibox, side panel) `chrome.scripting.executeScript({target:{tabId, allFrames:false}, files:['engine.js']})`. Zero idle cost per tab, no install warning (H). https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- Iframes: `activeTab` clearly covers main frame only (M). Inject into specific `frameIds` (after `webNavigation.getAllFrames`) + host permission. Never `allFrames:true` by default (one isolated world + parse per frame).
- Passive features (badge, known sites): `registerContentScripts` only for opted-in origins, narrow `matches`, `persistAcrossSessions:true`; sentinel <5 KB, `document_idle`, no MutationObserver at startup, one cheap check (`document.forms.length` / `querySelector('input[type=password],form')`), load engine on focus/invoke.
- Lazy engine: prefer second `executeScript({files:['engine.js']})` from SW over dynamic `import()` (import needs `web_accessible_resources` → fingerprintable; `use_dynamic_url:true` mitigates, Chrome 130 fix).
- Isolated-world idle cost (L): sub-ms to few ms compile + few hundred KB–1 MB V8 context; scales with bundle size × tabs × frames.

## 2. DOM scanning speed
- Candidates: scoped `querySelectorAll('input,select,textarea,button,[contenteditable],[role=...]')` (native). Structure: `TreeWalker` `SHOW_ELEMENT` + `FILTER_REJECT` pruning. Avoid recursive JS over `childNodes` (buildDomTree.js style: style + rect per node).
- Shadow DOM: `querySelectorAll` doesn't pierce; collect open roots during walk, cap work; `chrome.dom.openOrClosedShadowRoot` only where needed.
- Layout thrashing (H, web.dev): one read phase (`getBoundingClientRect`, `getComputedStyle`, `checkVisibility({checkOpacity:true, checkVisibilityCSS:true})`), writes later in rAF. One forced layout per scan OK.
- Viewport visibility in bulk: one `IntersectionObserver`, disconnect after first callback.
- DOM size: Lighthouse warns >~800 nodes, errors >~1,400; Gmail/Jira 5k–50k (H). https://web.dev/articles/dom-size-and-interactivity
- Chunking: long task >50 ms; slices ~8–10 ms or 500–1,000 nodes; `await scheduler.yield()` (Chrome 129+), fallback `setTimeout(0)` (H). https://developer.chrome.com/blog/use-scheduler-yield. `requestIdleCallback` only for optional prefetch (can starve; Bitwarden jank). `scheduler.postTask(fn,{priority:'background'})` for cache writes.
- Incremental: MutationObserver **only while assistant open**, `{childList, subtree, attributes, attributeFilter:['disabled','hidden','aria-hidden','style','class','type']}`, debounce 100–250 ms, rescan only nearest form/region; disconnect on close.
- `WeakMap<Element, Meta>` cache with counter ids; never write `data-*` attributes into page DOM.
- buildDomTree.js (L): expect hundreds of ms on tens of thousands of nodes; gains from no highlights, scoping, qSA candidates, batched reads, no XPath. Browser Use moved to CDP `DOMSnapshot.captureSnapshot` (not available to content scripts). Timing fork for own benchmark: https://glama.ai/mcp/servers/@GroundNG/QA-MCP/blob/30d22f25f3f0149388cec75f49ae7b8f1bf11bc1/src/dom/buildDomTree.js

## 3. Token / LLM efficiency
- Reported (M/L): AX-style snapshots 5–10× smaller than HTML, up to 30–50×; Playwright MCP 200–400 tokens simple pages, login form ~3.8k vs 15k+ HTML; D2Snap 67% vs 65% GUI baseline (arXiv 2508.04412).
- **Form-only encoding:** one line per field `id|kind|label|name/autocomplete|required|options(≤10)|current` → ~10–25 tokens/field, 30-field form ~0.5–1k tokens (L). Dedupe option lists, cap text ~80 chars, scope to form/viewport.
- Skip LLM for `autocomplete`-tagged fields (often >50% on checkout/sign-up, L). Batch remaining into one schema-constrained call.
- Prompt caching: static system/schema/profile-key block first, per-page fields last (Claude `cache_control` reads ~10% price). Nano: `clone()` primed session.
- Stream JSON lines; fill each field as it arrives.
- Speculative: on panel open start snapshot + deterministic mapping, pre-warm model/connection.
- Mapping cache: `origin + path pattern + form fingerprint` → `fieldId → profileKey` in IndexedDB; hit = zero model calls.
- Targets: cache/rule <150 ms; cloud <1.5 s TTFT streamed; Nano warm <2–3 s.

## 4. On-device model cost
- **Gemini Nano** (H requirements, L latency): desktop only, ≥22 GB free, >4 GB VRAM or 16 GB RAM + 4 cores. Keep sessions, `clone()`, `destroy()`. `responseConstraint` + `omitResponseConstraintInput`. Estimates: first create ~0.5–3 s, warm clone tens of ms, small structured output ~1–5 s. **Optional fallback, not default fast path.**
- **Transformers.js MiniLM-L6** (M, Xenova benchmark, seq 512 fp32): batch 1 ~507–532 ms WASM vs ~10–46 ms WebGPU; batch 32 WebGPU ~365 ms. Short labels q8 WASM SIMD ~5–15 ms/string (L). Sizes MiniLM q8 ~23 MB, bge-small q8 ~34 MB. Cold start ~0.5–2 s (L).
- Run in offscreen document (`WORKERS`) or side panel, never SW or content script. One offscreen doc per extension (H).
- WASM threads need `crossOriginIsolated`: manifest `cross_origin_embedder_policy: {value:"require-corp"}`, `cross_origin_opener_policy: {value:"same-origin"}` (H, side effects). Single-thread SIMD fine for small embedders.
- Unload: `closeDocument()` after 60–120 s idle; `session.destroy()`; verify memory in Task Manager (reports of incomplete reclaim, M).
- **Cheaper alternative:** rules + autocomplete + synonym dictionary + fuzzy match resolves most fields with no model. Add embeddings only if accuracy data justifies.

## 5. Bundle size and memory
- Sentinel <5 KB gzip, no framework. Engine <50 KB min (<15 KB gzip), vanilla TS. In-page UI: Preact (~4 KB) or Lit (~5–6 KB); React+ReactDOM ~45 KB gzip — keep rich UI in side panel (one process per window, not per tab).
- Overlay: one host, `attachShadow({mode:'closed'})`, created on invoke, `adoptedStyleSheets`, `position:fixed; contain:strict`, transform-only updates in rAF, removed on close.
- Side panel ~20–60 MB (L), load on demand.
- SW (H): 30 s idle, 5 min per event, 30 s fetch wait. Cold start ~50–200 ms (L). Register listeners synchronously, lazy-import heavy modules, no top-level await/IDB opens, no keep-alive hacks; stream through a port while panel active.
- IndexedDB (L): small get/put 1–5 ms; first open 5–30 ms; batch writes per transaction.
- Messaging: `runtime.sendMessage`/ports JSON-serialize (no transfer); 1 MB ≈ several ms each side (L). Snapshots <50 KB, field lists not DOM, one long-lived port, send diffs. Transferables only page↔own worker.

## 6. Measuring
- Chrome Task Manager (Shift+Esc): SW / offscreen / side panel rows; content-script memory in tab process (compare on/off).
- DevTools Performance: invoke-to-fill trace; long tasks; "Forced reflow"; INP Live Metrics.
- Memory panel: heap snapshots in content-script context, detached nodes.
- Perfetto / `chrome://tracing` with `extensions`, `v8`, `blink`.
- Lighthouse/DebugBear-style A/B with `--load-extension` on ~20 form-heavy sites (Gmail, Workday, Salesforce, checkout, 50k-node page) — test harness only.
- In code: `performance.mark/measure`; dev `PerformanceObserver({type:'longtask'})` fails CI on >50 ms.
- CI: size-limit bundle budget; compile-time regression gate >10%.

## Performance budget
| Metric | Budget |
|---|---|
| Idle per tab (not invoked) | 0 bytes injected, 0 ms CPU, 0 observers |
| Idle per tab (opted-in sentinel) | <5 KB, <1 ms, <0.5 MB, no MutationObserver |
| Service worker | idle until event; cold start <100 ms; no top-level work |
| Engine bundle | <50 KB min (<15 KB gzip); UI chunk <15 KB |
| Invoke → engine ready | <50 ms |
| Invoke → snapshot (2k–5k nodes) | <30 ms, no task >50 ms |
| Invoke → snapshot (50k nodes) | <150 ms total, chunks <10 ms |
| Incremental rescan | <10 ms/batch |
| Snapshot size | <1.5k tokens/form; <4k tokens/viewport |
| First fill, cache/rule hit | <100 ms |
| First fill, cloud streamed | <1.5 s p50; full form <3 s |
| First fill, Nano warm | <3 s (pre-warmed on panel open) |
| Fill writes | rAF-batched; <2 ms/field incl. events |
| Memory while active | content script <5 MB; side panel <50 MB; offscreen+embedder <150 MB, closed after 120 s idle |
| LLM calls on repeat visit | 0 (cache hit rate >80%) |
| Host INP regression after fill | <10 ms |

## Architecture checklist
1. No manifest `content_scripts`; `activeTab` + `scripting`; invoke via action/shortcut/context menu/side panel.
2. Optional opt-in sentinel via `registerContentScripts`, loads engine via `executeScript` on demand.
3. Top frame only; specific `frameIds` for iframe forms.
4. Scoped `querySelectorAll` + TreeWalker for labels; capped shadow-root collection; batched reads, rAF writes.
5. `scheduler.yield()` chunks ~8 ms.
6. Bulk `IntersectionObserver` / `checkVisibility`.
7. `WeakMap` cache, counter ids, no DOM attribute writes.
8. MutationObserver only while active, debounced, region-scoped.
9. Deterministic first; one batched, schema-constrained, streamed LLM call for the rest.
10. Stable prompt prefix; warm on panel open.
11. IndexedDB mapping cache → zero model calls on repeat visits.
12. Models only in offscreen/side panel; COOP/COEP for threads; destroy/close when idle.
13. SW: sync listeners, lazy imports, port streaming, no keep-alive hacks.
14. Preact/Lit/vanilla closed-Shadow-DOM overlay on invoke; rich UI in side panel.
15. Compact field lists + diffs over one port.
16. CI: size-limit, long-task gate, A/B Lighthouse with `--load-extension`; Task Manager check before release.
