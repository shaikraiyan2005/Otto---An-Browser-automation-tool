# Perception on any site — without relying on ARIA

Confidence: H = primary source/docs read; M = secondary/partial; L = estimate/inference.

## Key point
ARIA is optional. DOM, layout boxes, computed style and hit-testing exist on **every** HTML page — that is what every hint tool (Vimium, Tridactyl, Browser Use, Bitwarden) actually uses. ARIA only adds confidence. Pixels are needed only for canvas, non-scriptable pages and frames we cannot enter.

**Reconciliation with 10-lightweight-performance (zero idle cost):** the strongest div-soup signal (an `addEventListener` hook) must run at `document_start`, before page scripts — it cannot be added on demand later. Resolution:
- **Default (on-demand injection):** no hook. Use framework probes at snapshot time (React `__reactProps$`, Vue `_vei`, Svelte `events` symbols, jQuery `_data` — readable any time from MAIN world), `onclick`/`jsaction` attributes, `cursor:pointer` roots, tabindex, icon rule. Only vanilla-JS `addEventListener` listeners are missed.
- **Opt-in sites** (user marks "always help here", via `registerContentScripts`): tiny MAIN-world hook at `document_start` for full listener coverage.
- **Retry path:** if a page scores poorly, offer "reload with deep scan" which registers the hook for that origin and reloads.

## 1. Interactivity without ARIA — what existing tools do
- **Browser Use v0.1.40 buildDomTree.js (H):** tags `a, button, details, embed, input, menu, menuitem, object, select, textarea, canvas, summary`; role list; tabindex ≠ -1; `aria-expanded/pressed/selected/checked`; `onclick`, `ng-click`, `@click`, `v-on:click`; contenteditable, draggable; visibility via offset size/display/visibility; occlusion via center `elementFromPoint`; WeakMap cache. (`getEventListeners` is DevTools-only → undefined.)
- **Browser Use v0.2.5 (forked by Nanobrowser, Page Agent) (H):** computed `cursor` first (`pointer, move, grab, text, zoom-in…`); native tags rejected when cursor `not-allowed/no-drop/wait/progress` or disabled/readonly/inert; then contenteditable, `btn`/`dropdown-toggle`, `data-toggle=dropdown`, `aria-haspopup`, roles, `on{click,mousedown,mouseup,dblclick}`; nested child kept only if "distinct" (interactive tag, `data-testid/cy/test`, class `btn|clickable|menu|item|entry|link`).
- **Browser Use current CDP `clickable_elements.py` (H):** JS click listener → iframe >100×100 → label/span wrapping a control (≤2 levels) → search heuristic (`search|find|query|glass|lookup`) → AX props → tags → `on*`/tabindex → role → **icon rule 10–50 px with class/role/onclick/data-action/aria-label** → `cursor:pointer`.
- **Vimium link_hints.js (H):** skips `aria-disabled`; `<area>` maps; AngularJS `ng-click` if `.ng-scope`; `[onclick]`; roles; contenteditable; **Google `jsaction` `click:ns.action`**; per-tag rules; `button|btn` classes flagged possible false positive, dropped if a descendant is hinted; `tabindex>=0` second-class; occlusion at center + corners; recurses open shadow roots. No `addEventListener` hook (M).
- **Tridactyl dom.ts (H):** wraps `addEventListener/removeEventListener` (Firefox `exportFunction`), tracks `click, mousedown, mouseup, mouseover` (Set capped 1000); `[class*='button']`, `[tabindex]`; `isUnobscured` samples 25/50/75%.
- **Vimium C extend_click.ts (H):** MAIN-world hook for `click|mousedown|pointerdown|dblclick` + `onclick`/`onmousedown` setters; CustomEvent `VimiumCClickable` with node indexes; patches `Function.prototype.toString`; wiki warns hook "might break some JS frameworks".

### Listener sources (MAIN world only; isolated world can't see page expandos)
| Source | Read | Notes |
|---|---|---|
| `addEventListener` hook | wrap at `document_start`, `WeakMap<EventTarget, Set<type>>` | vanilla, Angular Renderer2 (M), Vue 3, jQuery direct, Svelte `on:`; misses root delegation and pre-hook listeners |
| React 17+ | `__reactProps$*` → `onClick/onMouseDown/onChange`; fallback `__reactFiber$` `.memoizedProps` | delegates to root; future flag `enableInternalInstanceMap` may hide expandos (H/M) |
| Vue 3 | symbol `description==='_vei'` invoker map | also native listeners (H); Vue 2 `el.__vue__` (M) |
| Svelte 5 | symbol `description==='events'` | delegated to root (H) |
| jQuery | `jQuery._data(el,'events')` | delegated entries on ancestor (M) |
| Angular | `ng.getListeners(el)` dev only | prod → hook (M) |
| Inline | `[onclick]`, `[jsaction*="click:"]` | readable from isolated world |

Hook cost negligible; risks: `toString` fingerprinting, function identity, missed pre-injection listeners. Ignore delegation roots (`document`, `body`, `html`, `#root`, `#app`, or subtree >~50 candidates).

### Ranked signals (L)
- **Strong:** native control, contenteditable, `tabindex>=0`, recorded click/mousedown/pointerdown listener or framework `onClick`, `jsaction` click, `[onclick]`, ARIA widget role.
- **Medium:** `cursor:pointer` **root** (pointer and parent not pointer — dedupes nested spans), icon rule (10–50 px with svg/img/i), `aria-haspopup`/`aria-expanded`, class/id tokens after **hash filtering** (`/^(css|sc|jsx|emotion|_)?-?[a-zA-Z0-9_-]{5,}$/` when mixed digits/case dropped; keep `btn`, `menu`, `close`, `search`, Tailwind `cursor-pointer`).
- **Weak:** `data-testid/cy/qa` (good for naming), span/li inside pointer region.
- **Negative:** disabled, inert, `aria-disabled`, `pointer-events:none`, `not-allowed`, off-viewport/occluded, <4 px.

## 2. Labels without `<label>`/ARIA
### Chromium `InferLabelForElement` (H, `form_autofill_util.cc`)
1. **Previous siblings:** skip comments/img/br; coalesce text, b, strong, span, font; at `<p>`/`<label>` take its text; other element → stop.
2. Placeholder; **overlaying successor** (next sibling whose bounds overlap the input — floating labels).
3. `aria-labelledby`, `aria-label`.
4. **Ancestors** (each tag once, stop at FIELDSET): LABEL text; DIV → **DivTable** (alternate previous siblings and parents, skip divs containing controls, stop at dd/div/fieldset/li/td/table); TD → **TableColumn** then **TableRow** (same columns, colspan-aware); DD → preceding DT; LI text.
5. `value` attribute if unchanged.
Text rules: skip script/noscript/style; stop at option/controls; depth 10; valid only if a char outside whitespace and `+*:-–()/.`.

### Firefox LabelUtils (H)
`<label>` only; unbound labels assigned to nearest control in document order; doesn't cross form/fieldset. Weaker for div soup.

### Bitwarden (H)
Multiple label channels per field: `label-tag`, `label-left` (previous siblings, climbing), `label-right`, `label-top` (same `cellIndex` previous row), `aria-label`, `data-label`, `placeholder`, `title`, all `dataset`. Visibility: ancestor opacity <0.1, display/visibility/collapse, hiding `clip-path`, <10×10, center `elementFromPoint` must hit field or its label; IntersectionObserver threshold 0.9999 for off-screen.

### Recommended cascade (record which method produced each label)
1. `el.labels`, `aria-labelledby`, `aria-label`, `title`, `placeholder`, `alt`, SVG `<title>`.
2. Chromium cascade + fieldset `<legend>` prefix.
3. **Geometry:** visible text runs (Range rects) within ~200 px; left-of-field same row (vertical overlap ≥50%, gap <150 px); above (horizontal overlap, gap <40 px); penalize text nearer another field (greedy/Hungarian one-to-one); prefer short text ending `:`/`*`.
4. De-hashed `name`/`id`/`autocomplete`/`data-testid` (split camelCase, `_`, `-`).
5. OCR crop left/above field (vision layer).
Library: `dom-accessibility-api` `computeAccessibleName` (~10 kB, M). Don't rely on `Element.computedName`.

## 3. Visibility, occlusion, paint order
- `el.checkVisibility({opacityProperty:true, visibilityProperty:true, contentVisibilityAuto:true})` — Baseline Mar 2024 (H); no viewport/occlusion info.
- `elementFromPoint`/`elementsFromPoint` (and `shadowRoot.elementFromPoint`): one layout then µs each (L); sample center + 2–4 inset points; respects `pointer-events:none`; viewport only.
- IntersectionObserver for bulk viewport membership; IO v2 `trackVisibility` costly/conservative (M).
- Browser Use paint-order filter needs CDP `DOMSnapshot` paint orders (H); client substitute = `elementsFromPoint` at sample points (exact stacking at those points).
- Batch recipe: one read pass → size/viewport/`checkVisibility` filter → ≤5 hit tests per survivor → dedupe nested (keep outer unless child "distinct"). ~5–30 ms for 1–3k candidates (L).
- Clipping: intersect with ancestors having `overflow` ≠ visible.

## 4. Visual fallback
### Semantic escape hatches first
| Surface | Hatch | Conf |
|---|---|---|
| Flutter web (CanvasKit/skwasm) | click hidden `flt-semantics-placeholder` → `flt-semantics-host` tree with roles/labels; text fields become real inputs when focused; HTML renderer removed | H/M |
| Google Docs | canvas; `_docs_annotate_canvas_by_ext` honored only for allowlisted extension IDs; menus/toolbar/dialogs are DOM; typing goes to hidden `docs-texteventtarget-iframe` contenteditable | H/M |
| Google Sheets | grid canvas; Name Box + formula bar + menus DOM — type `B7` + Enter in Name Box, read/write via formula bar | M |
| Figma, WebGL, Miro | shell DOM, canvas opaque; plugin API not available to extensions | M |
| Closed shadow roots | `chrome.dom.openOrClosedShadowRoot(el)` or MAIN `attachShadow` hook | H/M |
| Cross-origin iframes | per-frame scripts with host permission, merge by `frameId` with rect offsets; without permission → pixels | H |
| Chrome PDF viewer | not injectable → fetch URL + pdf.js, or capture + OCR | M |
| Images/SVG of text | alt/aria-label/`<title>`, then OCR | H/L |

### Pixel pipeline
- `chrome.tabs.captureVisibleTab` quota **2 calls/s** (Chrome 92+) (H). Divide by `devicePixelRatio`.
- Detectors:
  - OmniParser v2 `icon_detect` YOLO, 40.6 MB, **AGPL**; full pipeline 0.6–0.8 s/frame on server GPUs (H).
  - UI-DETR-1 (RF-DETR-M, MIT): WebClick 70.8% vs 58.8%; ~0.82 s/image server GPU; no ONNX — heavy for browser (H).
  - Salesforce GPA-GUI-Detector YOLO, MIT, no metrics (H).
  - **Practical:** YOLOv8n/11n-class GUI detector (~6 MB FP32 / ~3 MB FP16) via onnxruntime-web; YOLOv8n 640² WASM ~30 ms on M1 (M); WebGPU first shader compile ~200–400 ms (M); 100–400 ms low-end (L).
- OCR:
  - Tesseract.js: eng traineddata ~2 MB, ~15 MB code+data; v5 worker 311→164 MB; ~0.3–2 s per screen (L); reuse one worker (H).
  - **PP-OCRv5 mobile ONNX:** det 4.6 MB + rec 15.8 MB (Latin rec 7.7 MB) (H); better on UI text; ~100–300 ms/screen (L).
  - `TextDetector` (Shape Detection) still flagged — don't rely (M).
- Gemini Nano Prompt API image input: extensions since 138 (H); multimodal on web Chrome 148, extension default status unclear (M); use for naming a crop / choosing among numbered marks, not pixel localization; seconds per call (L).
- Set-of-Marks: numbered boxes (DOM + detector) on screenshot + text list to planner.

### Acting on canvas
- Synthetic sequence on `elementFromPoint(x,y)`: `pointerover, pointerenter, pointerdown, mousedown, focus, pointerup, mouseup, click` with clientX/Y, button, buttons, `pointerId:1`, `pointerType:'mouse'`, bubbles, composed. Many canvas apps accept (M); fails for `isTrusted` checks and user-activation-gated actions (H).
- Text: `execCommand('insertText')` or native setter + `input` on focused hidden editors (Docs, Monaco, Flutter input) (M).
- Trusted: `chrome.debugger` (Pro), infobar.

## 5. Layered pipeline (cheapest first)
```
L0  MAIN-world hooks (opt-in sites only; document_start): addEventListener map, attachShadow record
    Default on-demand: framework probes at snapshot time (React/Vue/Svelte/jQuery), jsaction/onclick
L1  DOM candidate scan incl. open/closed shadow roots, same-origin frames; per-frame for cross-origin   ~5–40 ms
L2  Visibility/occlusion: checkVisibility → rect/viewport/clip → elementFromPoint 3–5 pts → dedupe       ~5–30 ms
L3  Naming: accname → Chromium cascade → geometry → de-hashed attrs                                       ~5–20 ms
L4  Escape hatches: Flutter semantics, Docs/Sheets DOM shell + Name Box, pdf.js
L5  Vision on escalation: captureVisibleTab (≤2/s) → YOLO-n GUI + PP-OCR mobile (ORT-web WebGPU→WASM),
    merge with DOM (IoU>0.5 same; detector-only = visual-only element)                                    ~0.1–1 s
L6  Nano multimodal or cloud LLM set-of-marks to name/disambiguate unlabeled icons
```
**Escalate to L5 when:** canvas/embed/object/`flt-glass-pane` covers >30% (5×5 `elementFromPoint` grid); <3 candidates per 1000 px² with non-trivial text; cross-origin frame >100×100 unresponsive; PDF viewer or image-dominant page; action had no effect (no mutation/URL change in 1–2 s).
**L6 when** an element stays unlabeled after L3 and the planner needs it. **L4 when** fingerprints match (`flt-*`, `docs.google.com`, `.kix-`, PDF viewer).

Expected coverage (L): L0–L3 ~90–95% of actionable controls on mainstream HTML incl. div soup/hashed classes; +L4 Flutter/Docs/Sheets basics; +L5 most of the rest at lower precision. Residual: `isTrusted`-gated actions, fine canvas manipulation (Figma drawing).

## Code sketches
**MAIN-world hook** (opt-in origins; `run_at: document_start`, `world: MAIN`):
```js
(() => {
  const L = new WeakMap(), T = new Set(['click','mousedown','mouseup','pointerdown','pointerup','touchstart','keydown','dblclick']);
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) {
    if (T.has(t) && this instanceof Element) (L.get(this) || L.set(this, new Map()).get(this)).set(t, ((L.get(this).get(t))|0) + 1);
    return add.call(this, t, f, o);
  };
  EventTarget.prototype.removeEventListener = function (t, f, o) {
    const m = L.get(this); if (m && m.has(t)) { const n = m.get(t) - 1; n > 0 ? m.set(t, n) : m.delete(t); }
    return rem.call(this, t, f, o);
  };
  const closed = new WeakSet(), as = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (i) { const r = as.call(this, i); if (i?.mode === 'closed') { closed.add(this); this.__xRoot = r; } return r; };
  document.addEventListener('__x_snap', () => {
    for (const el of document.querySelectorAll('*')) {
      let h = L.get(el)?.size > 0;
      if (!h) { const k = Object.keys(el).find(k => k.startsWith('__reactProps$'));
        const p = k && el[k]; h = !!(p && (p.onClick || p.onMouseDown || p.onPointerDown || p.onChange)); }
      if (!h) for (const s of Object.getOwnPropertySymbols(el)) {
        const d = s.description; if ((d === '_vei' || d === 'events') && el[s] && Object.keys(el[s]).length) { h = true; break; } }
      if (h) el.setAttribute('data-x-js', '1'); else el.removeAttribute('data-x-js');
    }
    document.dispatchEvent(new CustomEvent('__x_done'));
  });
})();
```
Skip delegation roots; prefer an index map over attribute writes (attributes trigger MutationObservers).

**Scoring + hit test (isolated):**
```js
const HASH = /^(?=.*\d)(?=.*[a-z])[\w-]{6,}$|^(css|sc|jsx|emotion|tw)-/i;
function score(el, cs, parentCs) {
  const t = el.localName; let s = 0;
  if (/^(a|button|input|select|textarea|summary|details|option)$/.test(t) && !el.disabled && !el.inert) s += 10;
  if (el.isContentEditable) s += 10;
  if (el.tabIndex >= 0 && el.hasAttribute('tabindex')) s += 6;
  if (el.hasAttribute('data-x-js') || el.hasAttribute('onclick') || /(^|\s)click:/.test(el.getAttribute('jsaction')||'')) s += 8;
  if (el.getAttribute('role')) s += 5;
  if (cs.cursor === 'pointer' && parentCs?.cursor !== 'pointer') s += 5;
  const r = el.getBoundingClientRect();
  if (r.width >= 10 && r.width <= 50 && r.height >= 10 && r.height <= 50 && el.querySelector('svg,img,i')) s += 3;
  const toks = (el.className.baseVal ?? el.className).split(/\s+/).filter(k => k && !HASH.test(k));
  if (toks.some(k => /btn|button|clickable|close|menu|toggle|tab|search/i.test(k))) s += 2;
  if (cs.pointerEvents === 'none' || el.getAttribute('aria-disabled') === 'true') s = 0;
  return s;
}
function hittable(el, r) {
  const root = el.getRootNode(); const pts = [[.5,.5],[.25,.25],[.75,.75],[.25,.75],[.75,.25]];
  return pts.some(([fx, fy]) => { const h = root.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy);
    return h && (h === el || el.contains(h) || h.contains(el)); });
}
```
**Geometry label:**
```js
function geoLabel(field, textRuns) {
  const f = field.getBoundingClientRect(); let best = null, bs = Infinity;
  for (const {text, rect: t} of textRuns) {
    if (!text.trim() || text.length > 80) continue;
    const vOverlap = Math.min(f.bottom, t.bottom) - Math.max(f.top, t.top);
    const hOverlap = Math.min(f.right, t.right) - Math.max(f.left, t.left);
    let d = Infinity;
    if (t.right <= f.left + 2 && vOverlap > 0.5 * Math.min(f.height, t.height)) d = f.left - t.right;
    else if (t.bottom <= f.top + 2 && hOverlap > 0) d = (f.top - t.bottom) * 1.2;
    if (d > 200) continue; d -= /[:*]\s*$/.test(text) ? 20 : 0;
    if (d < bs) { bs = d; best = text.trim(); }
  }
  return best;
}
```

## Caveats
[L] numbers need benchmarking; WebGPU varies by device. OmniParser detector is AGPL — prefer MIT models or train a nano detector. React `enableInternalInstanceMap` may hide `__reactProps$` → keep cursor heuristics + hook as backups.

## Sources
Browser Use buildDomTree.js v0.1.40/v0.2.5, `clickable_elements.py`, `paint_order.py` · Vimium `link_hints.js` · Tridactyl `src/lib/dom.ts` · Vimium C `content/extend_click.ts` · React `ReactDOMComponentTree.js` · Vue `runtime-dom/src/modules/events.ts` · Svelte `internal/client/dom/elements/events.js` · Chromium `form_autofill_util.cc` · Firefox `LabelUtils.sys.mjs` · Bitwarden `collect-autofill-content.service.ts`, `dom-element-visibility.service.ts` · MDN checkVisibility · Flutter web accessibility docs, issue #177670 · Chromium `gdocs_script.js` · captureVisibleTab quota thread · OmniParser v2, UI-DETR-1, GPA-GUI-Detector on Hugging Face · Tesseract.js perf docs · PP-OCR ONNX (monkt/paddleocr-onnx) · Prompt API docs / MDN multimodal.
