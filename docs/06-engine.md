# 06 — Engine (`packages/core`)

The engine is the part that has to work on any website. It runs inside the page as `engine.js` (ISOLATED world), with a small helper `main-world.js` (MAIN world) for framework internals.

## 1. Scan pipeline

```
scan(scope?) ─► walk ─► candidates ─► visible? ─► honeypot? ─► widget ─► labels ─► section ─► options ─► descriptor
                │                                                                                       │
                └── yields to the page every ~8 ms (scheduler.yield ?? setTimeout 0) ──────────────────────┘
```

### 1.1 Walk (`dom/walk.ts`)
- `TreeWalker(root, SHOW_ELEMENT)`, reject subtrees of `script, style, noscript, template, svg` (except `svg` inside buttons), and of `[hidden]`, `inert`.
- For each element: if `el.shadowRoot` → walk it; else if `chrome.dom.openOrClosedShadowRoot(el)` → walk it (closed roots).
- `iframe` / `frame`: if `contentDocument` is readable → walk it (same origin). Otherwise record `{ frameUrl, rect }` so the background can inject into that frame.
- Cap: 50 000 visited elements; record `truncated: true` if hit.

### 1.2 Candidates
Field candidates:
- `input` (except `type=hidden|submit|button|reset|image`), `select`, `textarea`
- `[contenteditable="" | "true" | "plaintext-only"]` roots
- ARIA widgets: `[role=combobox|listbox|textbox|checkbox|radio|switch|slider|spinbutton|radiogroup]`
- Library roots detected by signature (see widget table) even when the real input is hidden

Clickable candidates (for Pick and actions): scored by `dom/interactive.ts` — native controls, `tabindex ≥ 0`, `onclick`, `jsaction*="click:"`, `cursor:pointer` roots (pointer and parent not pointer), icon rule (10–50 px with svg/img), framework handler probe via main-world.

### 1.3 Visibility and honeypots (`dom/visibility.ts`, `dom/honeypot.ts`)
One batched read pass (no DOM writes):
- `el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })`
- `getBoundingClientRect()`: width & height ≥ 4 px
- Hit test after `scrollIntoView` only at fill time (scan uses rect + clipping by `overflow` ancestors).

A field is a **honeypot** (never filled, shown as "trap" in preview) if any of: not visible but not a known widget's hidden input; off-screen (`left/top < −1000`); 1×1 size; `tabindex=-1` + `aria-hidden=true`; name/id/label matches `/(honeypot|hp_|leave.*blank|do not fill|website2|url2|fax_only)/i`.

Exception: hidden **real inputs behind custom widgets** (MUI `nativeInput`, Radix hidden select, styled checkbox) are not honeypots — the widget detector claims them first.

### 1.4 Widget detection (`fields/widget.ts`)

Ordered; first match wins.

| Widget | Signals |
|---|---|
| `react-select` | ancestor `[class*="-control"]` with sibling `[class*="-indicatorContainer"]`, or class prefix `select__` / `react-select__` |
| `mui-select` | `.MuiSelect-select[role=combobox]` + sibling `input.MuiSelect-nativeInput` |
| `mui-autocomplete` | `.MuiAutocomplete-root input` |
| `mui-date` | `.MuiPickersSectionList-root` or `.MuiPickersInputBase-root` |
| `antd-select` | `.ant-select` |
| `antd-date` | `.ant-picker` |
| `radix-select` | `button[role=combobox][data-radix-collection-item]` or `[data-radix-select-trigger]`, `aria-controls` → `[data-radix-select-viewport]` |
| `headless` | `[data-headlessui-state]` + `role=combobox|listbox` |
| `select2` / `chosen` | `.select2-container` / `.chosen-container` next to a `select` |
| `flatpickr` | `input.flatpickr-input` |
| `masked` | `data-mask`, `inputmode=numeric` + placeholder with `_`/`9`/`#`, or imask/cleave classes; confirmed at fill time |
| `rich-text` | contenteditable root; `.ProseMirror`, `[data-lexical-editor]`, `.ql-editor`, `.ck-editor__editable`, `.public-DraftEditor-content` |
| `file` | `input[type=file]`, `[class*=dropzone]` with hidden file input |
| `native-date` | `input[type=date|time|datetime-local|month|week]` |
| `check-radio` | `input[type=checkbox|radio]`, `[role=checkbox|radio|switch]` |
| `range` | `input[type=range]`, `[role=slider]` |
| `native-select` | `select` |
| `aria-combobox` | any other `role=combobox` / `aria-haspopup=listbox` |
| `native-text` | everything else that accepts text |

Radio groups are merged into one descriptor (`kind: "choice"`, options = each radio's label).

### 1.5 Labels (`fields/labels.ts`)

Cascade; record `labelSource` for debugging:

1. `el.labels` text, `aria-labelledby`, `aria-label`, `title`
2. `placeholder` (kept separately too)
3. Chromium-style inference: previous-sibling text run → parent `label` → div-table walk → `td`/`th` column/row → `dt`/`dd` → `li` → `fieldset > legend` (prefix)
4. Geometry: nearest short text (≤ 80 chars) on the same row to the left (gap ≤ 150 px) or above (gap ≤ 40 px, horizontal overlap); one text ↔ one field
5. Attributes: `name`, `id`, `data-testid`, `autocomplete` split on camelCase / `_` / `-`, after removing hash-like tokens

`section` = nearest preceding heading (`h1–h6`, `[role=heading]`, `legend`, bold text block) within the same form/container — used to tell "billing" from "shipping".

### 1.6 Descriptor

```ts
FieldDescriptor = {
  ref: string, frameId: number,
  kind: "text"|"email"|"tel"|"number"|"date"|"choice"|"multi-choice"|"boolean"|"file"|"rich"|"range",
  widget: WidgetKind, label: string, labelSource: LabelSource, placeholder?: string,
  name?: string, idAttr?: string, autocomplete?: string, inputType?: string,
  required: boolean, maxLength?: number, pattern?: string,
  options?: string[],            // first 50 + count
  section?: string, currentValue?: string,
  rect: { x, y, w, h }, honeypot: boolean,
  fingerprint: Fingerprint       // for recipes (see §5)
}
```

### 1.7 Compact serialization for the AI (`fields/serialize.ts`)

One line per field, ~10–25 tokens:

```
f3|text|First name|name=fname|ac=given-name|req
f7|choice|Country of residence|sec=Billing address|opts: India; United States; United Kingdom; … (+192)
f9|text|Why do you want to join?|textarea|max=500
```

## 2. Matching (`match/*`) — runs in the side panel, not the page

Order, stop at first confident answer per field:

1. **Recipe** step (if a recipe matched) → confidence 0.99.
2. **autocomplete token** → profile key (`given-name`, `email`, `postal-code`, …) → 0.95.
3. **Dictionary** regexes on label / name / id / placeholder, scored, with section bias (billing/shipping) → 0.6–0.9.
4. **input type** hints (`type=email`, `type=tel`) → 0.8.
5. Leftovers → `/api/map` (one call for all leftovers on the page).
6. Never-fill list → `skip`: password, OTP (`one-time-code`), card (`cc-*`), CAPTCHA, consent/terms/marketing checkboxes, honeypots.

`format.ts` converts the stored value into what the field needs:
- Dates: read placeholder/pattern (`DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`), native date → ISO.
- Phone: E.164 vs national digits depending on `maxLength`/placeholder/adjacent country-code select.
- Country: pick the option whose text or value matches code, name or common alias (US / USA / United States of America).
- Names: split full name when only `name` exists, or join when the form has a single "Full name".
- Choice fields: fuzzy match to option text (normalize case, accents, punctuation); below 0.6 similarity → leftover for AI.

## 3. Filling (`fill/*`)

### 3.1 Primitives

```ts
setNativeValue(el, v)   // Object.getOwnPropertyDescriptor(proto,'value').set.call(el, v)
dispatchInputEvents(el, v) // InputEvent('input', {bubbles, composed, inputType:'insertText', data:v}) → Event('change')
pointerClick(el, at?)   // pointerover, pointerenter, mouseover, pointerdown, mousedown, focus,
                        // pointerup, mouseup, click — button:0, buttons:1, pointerType:'mouse', clientX/Y at centre
pressKey(el, key)       // keydown/keypress/keyup with key, code, keyCode, which
typeText(el, text)      // per char: keydown → execCommand('insertText', false, ch) → keyup
pasteText(el, text)     // ClipboardEvent('paste', {clipboardData: DataTransfer(text/plain)})
setFiles(input, files)  // DataTransfer.items.add(File) → input.files = dt.files → input + change
blur(el)                // focusout + blur
```

Canonical text sequence (Chromium autofill order): `focus → keydown → setNativeValue → input → change → keyup → blur`.

### 3.2 Engine loop (`fill/engine.ts`)

- One field at a time (queue) — dropdown portals collide in parallel.
- Before each: `scrollIntoView({ block: "center" })`, wait until rect stable for 2 animation frames, hit-test centre with `elementFromPoint`; if covered by an overlay → report `covered` (don't click through).
- Escalation ladder per field (stop at first verified rung, 4 s budget):
  1. widget adapter
  2. generic adapter for the field kind (native or ARIA)
  3. `typeText` per character
  4. main-world bridge (React props `onChange`, `_flatpickr.setDate`, editor APIs)
  5. give up → `failed` with reason (rung 5 = CDP trusted input is out of scope for the prototype)
- After every fill: re-scan cheaply (new fields often appear) and emit `FILL_PROGRESS`.

### 3.3 Adapters (minimum set for the prototype)

| Adapter | Core algorithm |
|---|---|
| native-text | canonical text sequence; if value reverted after settle → rung 3 |
| native-select | match option by text then value → `select.value=` → input + change |
| native-date | ISO formats per type (`yyyy-mm-dd`, `yyyy-mm`, `HH:mm`) → setNativeValue + events; check `validity.valid` |
| check-radio | if state ≠ wanted → `el.click()` (never set `.checked` silently); ARIA → pointerClick + Space |
| range | clamp to min/max/step → set + input + change; ARIA slider → Home + ArrowRight × n |
| aria-combobox (generic) | pointerClick → wait listbox (MutationObserver ≤ 1 s, also search `document.body` for portals) → if editable type query → find option by text (exact → startsWith → fuzzy) → pointerClick option → verify display + `aria-expanded=false`; fallback ArrowDown until `aria-activedescendant` matches → Enter |
| react-select | mousedown on control → type into input → click `[class*=option]` matching text |
| mui | Select: set hidden `nativeInput` + input/change (value = option `value`); else generic. Autocomplete: type → click option (must select before blur). DatePicker: set hidden input to the displayed format + input |
| antd | Select: mousedown `.ant-select-selector` → type to filter (virtual list) → click `.ant-select-item-option`. DatePicker: type exact format → Enter |
| radix | PointerEvent `pointerdown` with `pointerType:'mouse'` on trigger → option `pointerup` |
| headless | pointerdown/click trigger → click option |
| select2 / chosen | set underlying `select.value` → native `change` (+ `chosen:updated`) |
| flatpickr | main-world `el._flatpickr.setDate(v, true)`; else type + keydown `keyCode:13` |
| masked | strip to raw chars → focus, select all → `typeText` |
| rich-text | focus → select all → `execCommand('insertText')`; fallback synthetic paste; fallback main-world editor API |
| file | build `File` from stored blob/path (prototype: fetch from `/api/files/:id` or a bundled sample PDF) → `setFiles`; drop zones → `dragenter/dragover/drop` with DataTransfer |

### 3.4 Verify (`fill/verify.ts`)

1. Wait one settle tick: `requestAnimationFrame → setTimeout 0`, then up to 300 ms of mutation quiet.
2. Read back per widget (`input.value`, selected option text, displayed chip text, `checked`/`aria-checked`, `files.length`, `innerText`).
3. Errors: `aria-invalid="true"`, `:invalid`, `aria-describedby`/`aria-errormessage` text, nearby `[class*=error]`, `.Mui-error`, `.ant-form-item-has-error`.
4. `verified` only if read-back matches (normalized) and no new error. Re-check once after 1 s (catches hydration resets) → refill once if reverted.

## 4. Main-world bridge (`entrypoints/main-world.ts`)

Communicates with the engine through `CustomEvent("otto:req" | "otto:res")` on `document`, using the ref → element registry shared via a temporary attribute `data-otto-ref` set right before the call and removed right after (only on the target element).

Functions: `reactProps(el)` → call `onChange/onClick/onKeyDown/onDrop`, `flatpickrSet`, `editorSetText` (ProseMirror view / Lexical / Quill / CKEditor / TinyMCE), `vueHasHandlers`, `hasClickHandler(el)` (React `__reactProps$`, Vue `_vei`, Svelte `events` symbol, jQuery `_data`).

Deep scan (settings toggle, stretch): register a MAIN-world `document_start` script for the current origin that hooks `addEventListener` to record click listeners; requires reload.

## 5. Recipes and healing (`recipe/*`)

### 5.1 Signatures (Chromium-style)
- `fieldSig = hash(name + "&" + type)` (hash = first 8 hex of SHA-1 via `crypto.subtle`)
- `formSig = hash(origin + "&" + formName + "&" + fieldNames…)` with runs of ≥ 5 digits stripped
- `altSig = hash(origin + "&" + fieldKinds…)` — same shape, renamed fields

### 5.2 Step

```ts
RecipeStep = {
  key?: ProfileKey, value?: string, widget: WidgetKind, kind: FieldKind,
  fieldSig: string,
  locators: { kind: "testid"|"role-name"|"label"|"placeholder"|"id"|"name"|"xpath", value: string }[],
  fingerprint: { tag, type, id, name, classes[], ariaLabel, role, autocomplete, label, placeholder,
                 text, neighborText[], section, xpath, rect }
}
```

### 5.3 Resolve and heal (`recipe/resolve.ts`)

1. Try locators in order; accept the first unique hit whose fingerprint score ≥ 0.6.
2. Else score every visible candidate of a compatible kind with **Similo-lite**:

| Attribute | Compare | Weight |
|---|---|---|
| label | Levenshtein ratio | 2.8 |
| name | Levenshtein ratio | 2.8 |
| type / widget | equal | 2.7 |
| autocomplete | equal | 2.0 |
| neighborText | word-set overlap | 1.5 |
| section | Levenshtein ratio | 1.4 |
| placeholder / ariaLabel | Jaccard | 1.0 |
| position | 1 − dist/400 px | 1.2 |
| id | Levenshtein ratio | 0.5 |
| xpath | Levenshtein ratio | 0.2 |

   Normalized score = Σw·sim / Σw. Accept best if ≥ 0.70 **and** best − second ≥ 0.08.
3. Else → step `broken` → that field goes to `/api/map` (or the user).
4. After a verified fill, write healed locators/fingerprints back to the recipe (`stats.healedSteps++`).

## 6. Text extraction (`text/extract.ts`)

`new Readability(document.cloneNode(true)).parse()`; if null or < 500 chars, use `main`, `[role=main]`, `article`, else `body.innerText`. Collapse whitespace, drop nav/footer boilerplate, cap 30 000 chars. Outline: `h1–h3` texts, counts of forms, tables, links.

## 7. Picker (`picker/*`)

- Host element with `attachShadow({ mode: "closed" })`, `position: fixed; inset: 0; pointer-events: none; z-index: 2147483647`.
- `pointermove` (capture, passive) → `document.elementsFromPoint` → first element that isn't our host; follow into open shadow roots via `shadowRoot.elementFromPoint`.
- Click (capture, `preventDefault` + `stopPropagation`) confirms; `Alt+↑` parent, `Alt+↓` back to child, `Esc` cancel.
- Context: `outerHTML` trimmed to 4 kB (attributes kept, long text truncated), `innerText` ≤ 2 kB, fields inside (scan scoped to element), rect, short CSS path, 3 nearest headings.

## 8. Performance budget (prototype targets)

| Metric | Target |
|---|---|
| `engine.js` size | < 60 kB minified |
| Scan, normal form page (≤ 5k elements) | < 50 ms |
| Scan, 50k-element page | < 300 ms total, no task > 50 ms |
| Rule matching (50 fields) | < 5 ms |
| Fill per simple field | < 30 ms incl. verify |
| Fill per custom dropdown | < 600 ms |
| Recipe replay, 20 fields, no healing | < 1.5 s, 0 AI calls |

Measured with `performance.now()` around each phase and posted in every RunReport.
