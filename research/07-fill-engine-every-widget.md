# Fill engine: how an MV3 content script fills every input type

Confidence: H = read in primary source; M = partial source / well known; L = inferred / closed source.

## 0. Universal rules
1. **Isolated vs MAIN world (H).** DOM + events shared; JS expandos not. Isolated world cannot see `__reactProps$*`, `__reactFiber$*`, `el._flatpickr`, `el.ckeditorInstance`, jQuery `$.data`, `tinymce`, `Quill.find`, Inputmask's patched `value`. Use `chrome.scripting.executeScript({world:'MAIN', func, args})` or `content_scripts[].world:"MAIN"` (111+), bridge via `postMessage`/CustomEvent. job_app_filler calls React props directly in MAIN: `getReactProps(el).onChange({target:el})`, `.onClick({preventDefault(){}})`, `.onDrop({dataTransfer:{files:[f]}})`, `.onKeyDown({key:'Tab', target:{value}})`.
2. **Plain `el.value = x` works with React from the isolated world (M-H).** React's tracker patches `value` only on the MAIN-world JS wrapper; isolated assignment hits the native setter, tracker keeps old value, next bubbling `input` looks like a change. That is why Bitwarden's `element.value = value` works. Native-prototype-setter trick only needed in MAIN world. (Consistent with 04/03: both routes reach the native setter.)
3. **Synthetic events are `isTrusted=false`.** None of react-select, MUI, rc-select, Radix, Headless UI, Select2, imask, ProseMirror, Lexical check `isTrusted`. They do check `button===0`, `pointerType==='mouse'`, `which===1`, `keyCode`, `defaultPrevented`, `isComposing`. Always pass full init dicts: `{bubbles:true, cancelable:true, composed:true, button:0, buttons:1, pointerType:'mouse', pointerId:1, isPrimary:true, clientX, clientY, view:window}`; keyboard `{key, code, keyCode, which}`. Anti-bot code does check `isTrusted` → CDP case.
4. **`document.execCommand('insertText', false, s)` (M-H)** works on focused inputs/textareas/contenteditable, uses real selection, fires UA `input` with `inputType:'insertText'`; Chrome fires no `beforeinput` for it. Lexical explicitly handles its dangling `input`.

## 1. How real autofill products fill
- **Bitwarden (H, `insert-autofill-content.service.ts`):** `click()` → `focus()` → keydown/keyup (restore value if changed) → `element.value = value` (checkbox/radio: `checked = true` for `"true","y","1","yes","✓"`; non-form: `innerText`) → keydown/keyup → `input` → `change` (bubbling) → 200 ms animation class. 20 ms between actions; no blur; no special `<select>` branch.
- **Chromium autofill (H, `web_form_control_element.cc`):** input/textarea: focus if not focused → keydown → `SetAutofillValue` (fires `input` then `change`) → keyup → blur if wasn't focused. Select: focus → set → input/change → blur. Then `SetSelectionRange(len,len)`.
- **Canonical sequence:** focus → keydown → set value → input → change → keyup → blur.
- **1Password, Simplify, Teal (L):** closed source; appear Bitwarden-like + per-ATS adapters.
- **berellevy/job_app_filler (H):** Workday detection via `div[starts-with(@data-automation-id,'formField-')]` + `button[@aria-haspopup='listbox']` (dropdown), `div[@data-automation-id='multiSelectContainer']` (prompt), `input[@aria-label='Month'|'Day'|'Year']` (date), `div[@data-automation-id='file-upload-drop-zone']` (file), two radios (boolean).
  - Workday dropdown: `button.click()` → list `//ul[@id=button.aria-controls]` → option React `onClick({preventDefault(){}})` → close (2 clicks) → read `button.innerText`.
  - Workday prompt: React `onKeyDown({key:'Tab', target:{value}})` → wait 500 ms → click first `div[@data-automation-id='promptOption']` if several.
  - Workday date parts: `el.value = String(n-1)` → keydown ArrowUp (keyCode) → `el.click()`.
  - Workday files: React `onDrop({dataTransfer:{files:[file]}, preventDefault(){}, stopPropagation(){}})`.
  - Greenhouse (react-select `select__`): clear via indicator `onMouseDown` → open → `div[starts-with(@class,'select__option')]` by text `.click()` → read `select__single-value`. File: `reactProps.onChange({target:{files:[file]}})`.
- **andrewmillercode/Autofill-Jobs (H, isolated):** files via DataTransfer + change; Workday multiselect: set value + `setAttribute('value')` → input/change → Enter keydown/keyup (keyCode 13) → wait ~1 s → pick from `.ReactVirtualized__Grid__innerScrollContainer` by `aria-label`; dropdown buttons opened with `mouseup` + Enter.

## 2. Custom dropdowns / comboboxes
Detection: `role=combobox`, `aria-haspopup=listbox`, `aria-expanded`, `aria-controls`/`aria-owns`, `aria-activedescendant`; options `role=option` (often portaled); class prefixes `select__`, `css-*-control`, `MuiSelect-`, `MuiAutocomplete-`, `ant-select`, `rc-select`, `select2-`, `chosen-`, `data-radix-*`, `data-headlessui-state`, Workday `data-automation-id`.

| Library | Open | Select | Notes |
|---|---|---|---|
| react-select (H) | `mousedown` on Control; indicator needs button 0; or focus input + ArrowDown | option `onClick`; menu mousedown button 0; Enter (not IME 229); Tab if `tabSelectsValue` | Searchable: type (`input`) filters + opens. Portal only with `menuPortalTarget`. |
| MUI Select (H) | `mousedown` on `[role=combobox]`, button 0; Space/Arrows/Enter | MenuItem `onClick`; menu in `.MuiPopover-root ul[role=listbox]` | **Shortcut:** hidden `input.MuiSelect-nativeInput` `onChange` matches option **value** — set value + input/change. |
| MUI Autocomplete (H) | input `mousedown` button 0, typing, ArrowDown | option click or Enter | Blur without selection clears text (`clearOnBlur`); freeSolo Enter commits. |
| AntD / rc-select (H/M) | `mousedown` on `.ant-select-selector`; typing | `.ant-select-item-option` click; Enter/Tab | **Virtualized** — type to filter first or ArrowDown until `aria-activedescendant` matches; portal `.ant-select-dropdown`. |
| Radix Select (H) | `pointerdown` only if button 0, no ctrl, `pointerType==='mouse'`; else `click` | item `pointerup` (mouse) else click; Enter/Space on the item | Needs real `PointerEvent` pointerType mouse; bare `.click()` won't open. Hidden native `<select aria-hidden>` is form-only. |
| Headless UI v2 (H) | `pointerdown` (mouse, left) or click; Space/Arrows (Enter submits form) | option `onClick`; Enter | Quick-release on pointerup >200 ms & 5 px. |
| Select2 (H) | jQuery `mousedown` `.select2-selection`, `which===1` | `mouseup` on `.select2-results__option--selectable` | Easiest: `select.value=v` + native `change`. Searchable: type in `.select2-search__field` + mouseup. |
| Chosen (M) | `mousedown` on `.chosen-single`/`.chosen-choices` | `mouseup` on `li.active-result` | Or native select value + `change` + `new Event('chosen:updated')`. |
| Workday (H) | `button[aria-haspopup=listbox]` click or type + Enter/Tab | `div[data-automation-id=promptOption]` click / React onClick | Virtualized; verify `[data-automation-id=selectedItem]`. |
| Angular mat-select (M) | click `.mat-mdc-select-trigger`; Enter/Space/Alt+ArrowDown | `mat-option` click in `.cdk-overlay-container` | |

**Generic combobox algorithm**
1. `scrollIntoView({block:'center'})`, `focus()`.
2. Full pointer sequence at center: `pointerover, pointerenter, mouseover, pointerdown, mousedown, focus, pointerup, mouseup, click`.
3. Wait (MutationObserver, ≤~1 s) for `aria-expanded=true` or visible `[role=listbox]`.
4. Not open → ArrowDown → Alt+ArrowDown → Space/Enter.
5. Editable → type query (insertText or setter + input) to filter (needed for virtualized lists).
6. Find listbox via `aria-controls`/`aria-owns` else newest visible `[role=listbox]`; match option text exact → startsWith → fuzzy.
7. `scrollIntoView` + full pointer sequence on option (covers onClick, pointerup, mouseup libraries).
8. Fallback: ArrowDown until `aria-activedescendant`/`[aria-selected=true]` matches, Enter.
9. Fallback: MAIN-world adapter (React props).
10. Fallback: CDP `Input.dispatchMouseEvent`.
11. Verify displayed value, `aria-expanded=false`, hidden input value.

## 3. Date pickers
- **Native** (H): date `yyyy-mm-dd`, datetime-local `yyyy-mm-ddThh:mm`, month `yyyy-mm`, week `yyyy-Www`, time `HH:mm[:ss]`; invalid → `''`. Set + input + change + blur; verify `el.value === wanted && el.validity.valid`.
- **react-datepicker** (M): input `onChange` parses with `dateFormat`. Set display-format string + `input`, then Escape/Tab/blur. Fallback: navigate month/year, click `.react-datepicker__day[aria-label*="..."]`.
- **MUI X v7/v8** (H): detect `.MuiPickersSectionList-root` with `span[role=spinbutton][contenteditable]` + hidden `input.MuiPickersInputBase-input[aria-hidden]`. **Best:** set full formatted string (e.g. `MM/DD/YYYY`) on hidden input + `input` → `updateValueFromValueStr`. Alt: select all sections (Ctrl+A) + synthetic `paste` ClipboardEvent. Alt: per-section insertText digits. v6 single input: CDP insertText per digit. Verify hidden input + `aria-valuetext`.
- **AntD / rc-picker** (H): setter + `input` with exact `format` string, then **Enter** (blur does not commit; invalid reverted). Mask format: dispatch `paste` ClipboardEvent (`onFormatPaste`).
- **flatpickr** (H): `.flatpickr-input` often readonly; `altInput` hides original. Best MAIN: `el._flatpickr.setDate(value, true, fmt)`. Isolated with `allowInput`: set value + keydown `keyCode:13` (or blur). Readonly: MAIN API or click `.flatpickr-day[aria-label="October 29, 2026"]`.
- **Calendar-only fallback:** open, read header month/year, next/prev until match, click day by `aria-label`, verify.

## 4. Masked inputs
| Library | Mechanism | Synthetic `input` OK? | Strategy |
|---|---|---|---|
| imask (H) | keydown (saves selection), input, beforeinput, blur | Yes | focus → `setSelectionRange(0,len)` → keydown → set **raw** chars → input → blur |
| cleave.js (M) | input reformats | Yes | raw digits + input |
| react-input-mask (M) | onChange diff vs previous value/selection | Flaky | select all + delete, then per-char `execCommand('insertText')` or CDP insertText |
| Inputmask (M) | patches `value` in MAIN | Partly | MAIN `el.inputmask.setValue(v)` / `$(el).val(v).trigger('change')`; isolated per-char insertText |

Generic: detect mask (placeholder `_`/`9`/`#` or reformat after test) → strip to raw → focus, select all, per char keydown + `execCommand('insertText')` + keyup → verify normalized value → escalate to CDP `Input.insertText` per char.

## 5. contenteditable / rich text
Ladder: focus + select all → `execCommand('insertText')` → synthetic `paste` (`DataTransfer` text/plain + text/html, `ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})`) → `InputEvent('beforeinput',{inputType:'insertText',data,…})` → MAIN editor API → CDP `Input.insertText`.

| Editor | Notes |
|---|---|
| ProseMirror / Tiptap (H) | paste handler reads clipboardData; DOMObserver catches execCommand. Detect `.ProseMirror`; MAIN `editor.commands.setContent`. |
| Lexical (H) | beforeinput-driven; paste → `PASTE_COMMAND`; handles execCommand. `[data-lexical-editor]`; MAIN `el.__lexicalEditor.update(...)`. |
| Draft.js (M) | `onPaste`; Chrome `onBeforeInput` from legacy `textInput`: `e=document.createEvent('TextEvent'); e.initTextEvent('textInput',true,true,window,text)`. `.public-DraftEditor-content`. |
| Quill (M) | paste + MutationObserver; MAIN `Quill.find(c).setText()`. `.ql-editor`. |
| CKEditor 5 (M) | beforeinput/paste; MAIN `el.ckeditorInstance.setData(html)`. `.ck-editor__editable`. |
| TinyMCE (M) | iframe (about:blank/srcdoc) → `all_frames` + `match_about_blank`/`match_origin_as_fallback`, or same-origin `contentDocument`; MAIN `tinymce.get(id).setContent(html)` + `editor.save()`. |

Verify `root.innerText` + hidden textarea if present.

## 6. File uploads
- `input[type=file]` (H): `dt=new DataTransfer(); dt.items.add(new File([blob],name,{type})); input.files=dt.files;` + bubbling `input` + `change`. Works isolated, incl. hidden inputs.
- react-dropzone (H/M): hidden input route works; else `dragenter`/`dragover`/`drop` `DragEvent` with `dataTransfer:dt`.
- Workday: MAIN `onDrop`, or `input[data-automation-id=file-upload-input-ref]` files + change.
- CDP `DOM.setFileInputFiles({files:[absPath], backendNodeId})`: needs **"Allow access to file URLs"** enabled (else `"Not allowed"`, `dom_handler.cc`) and a real path — e.g. `chrome.downloads.download` blob → `DownloadItem.filename`. Heavy; last rung only.
- Verify `files.length`, filename in UI, required error gone, async upload done.

## 7. Radio, checkbox, slider, frameworks
- Checkbox/radio (H): if `el.checked !== want` → `el.click()` (React listens to `click`; never set `.checked` silently). Hidden styled input: `input.click()` or click `label[for]`. ARIA `role=checkbox|radio|switch`: pointer sequence + Space. Match radio by label text.
- `input[type=range]` (H): clamp to min/max/step, set + input + change. ARIA slider (M): MUI has real range input; Radix etc.: focus thumb, Home, N× ArrowRight/PageUp; verify `aria-valuenow`; drag fallback via CDP (synthetic `setPointerCapture` fails).
- Angular (M-H): `(input)` → onChange, `(blur)` → touched; checkbox/radio/select use `(change)`. Always end with blur.
- Vue 3 (H): text `input` (skipped while composing), `.lazy` `change`, select/checkbox/radio `change`. Fire both.
- Svelte (M): text `input`; select/checkbox/radio `change`; range both.
- Knockout (M): `value` binding on `change`; `textInput` on `input`.
- jQuery (H): `.on()` uses native listeners, so native dispatch reaches handlers (no `.trigger` extra data).
- Native `<select>` (H): set value / `option.selected` (match text then value) + input + change.

**Canonical text sequence:** focus (+click) → keydown → set value (MAIN native setter / isolated `.value`) → `InputEvent('input',{inputType:'insertText',data:v,bubbles:true})` → keyup → change → blur/focusout.

## 8. Verification
1. Settle: `await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)))`; re-read (controlled components revert). MutationObserver flags reverts.
2. Text: normalized `el.value`, `validity.valid`, `validationMessage`, `:invalid`.
3. ARIA/visual: `aria-invalid="true"`, `aria-describedby`/`aria-errormessage`, `.error`, `[class*=error]`, `.Mui-error`, `.ant-form-item-has-error`, `[data-automation-id*=error]`.
4. Combobox display: `select__single-value`, `.MuiSelect-select`, `.ant-select-selection-item[title]`, `.select2-selection__rendered`, Radix value, Workday `selectedItem`; `aria-expanded=false`; hidden input.
5. Optional MAIN framework state: React fiber `memoizedProps`, Vue `__vueParentComponent`, Angular `ng.getComponent` (dev only).
6. Checked/aria-checked/aria-valuenow; files; rich-text innerText.
7. Done only when read-back matches **and** no new error; else escalate one rung.

## 9. Fill engine design
```
FillEngine
 ├─ Detector: classify(el) -> {kind, adapterId, root, confidence}
 │    signals: tag/type, role/aria-*, class prefixes, data-* (data-automation-id, data-radix-*,
 │    data-headlessui-state, data-lexical-editor), contenteditable, known expandos (MAIN probe)
 ├─ AdapterRegistry (ordered; first matches(el) wins; {matches, fill(el,v,ctx), read(el), verify})
 │    site:   workday, greenhouse, lever, icims, ashby
 │    widget: reactSelect, muiSelect(nativeInput), muiAutocomplete, rcSelect(virtual),
 │            radixSelect(pointer), headlessListbox, select2, chosen, matSelect,
 │            muiXDateField(hidden input), rcPicker(Enter/paste), reactDatepicker, flatpickr(MAIN),
 │            imask/cleave/inputmask, prosemirror/lexical/draft/quill/ckeditor/tinymce(iframe),
 │            dropzone/fileInput
 │    generic: nativeText, nativeSelect, nativeDate, checkbox/radio, range,
 │             ariaCombobox, ariaListbox, ariaSlider, ariaCheckbox, contenteditable
 ├─ Primitives (isolated): pointerClick, key, setText, typeText, paste, drop, setFiles, waitFor, findListbox
 ├─ MainWorldBridge: reactProps call, _flatpickr.setDate, ckeditorInstance.setData,
 │    tinymce.setContent, Quill.find, inputmask.setValue, jQuery .val().trigger()
 ├─ TrustedBridge (chrome.debugger on demand): Input.dispatchMouseEvent, dispatchKeyEvent,
 │    insertText, DOM.setFileInputFiles
 └─ Verifier: settle tick, read vs expected, aria-invalid/validity/error text, revert watch
```
**Escalation per field** (stop at first verified rung; 3–5 s budget): 1 adapter (isolated) → 2 generic ARIA/native → 3 per-char `typeText` → 4 MainWorldBridge → 5 TrustedBridge (CDP) → 6 `needs_user` + highlight + record failure.

**Rules:** fill sequentially via a queue (portals collide); re-detect after each fill (conditional fields); scroll into view first; normalize option matching (case, diacritics, whitespace, synonyms); never set `.checked`/`.value` without events; end text fills with blur — except AntD picker (Enter) and MUI Autocomplete (select option before blur).

## Sources
Bitwarden `insert-autofill-content.service.ts` · Chromium `form_autofill_util.cc`, `web_form_control_element.cc`, `dom_handler.cc` · https://github.com/berellevy/job_app_filler · https://github.com/andrewmillercode/Autofill-Jobs · react-select `Select.tsx` · MUI `SelectInput.js`, `useAutocomplete.js` · MUI X `useField*` · rc-select `OptionList.tsx` · rc-picker `Input.tsx` · Radix `select.tsx` · Headless UI `listbox.tsx` · Select2 `single.js`, `results.js` · flatpickr `index.ts` · imask `input.ts` · Lexical `LexicalEvents.ts` · prosemirror-view `input.ts`. From memory only (M): Chosen, react-input-mask, Inputmask, cleave, Draft.js, Quill, CKEditor 5, TinyMCE, Angular, Vue, Svelte, Knockout, react-datepicker, react-dropzone. Closed (L): 1Password, Simplify, Teal.
