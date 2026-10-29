import type { FileValue, FillResult, Mapping, WidgetKind } from "@otto/shared";
import { isVisible, queryAll, collectRoots, scrollIntoViewIfNeeded, textOf } from "./dom";
import { radioOptionLabel } from "./labels";
import { lookup, type Entry } from "./registry";
import { bestOption, digits, nextFrame, norm, similarity, sleep } from "./util";

/* ------------------------------------------------------------------ primitives */

function protoOf(el: Element) {
  if (el instanceof HTMLTextAreaElement) return HTMLTextAreaElement.prototype;
  if (el instanceof HTMLSelectElement) return HTMLSelectElement.prototype;
  return HTMLInputElement.prototype;
}

export function setNativeValue(el: Element, value: string) {
  const desc = Object.getOwnPropertyDescriptor(protoOf(el), "value");
  if (desc?.set) desc.set.call(el, value);
  else (el as HTMLInputElement).value = value;
}

function fire(el: Element, type: string, init: EventInit = {}) {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, composed: true, ...init }));
}

function fireInput(el: Element, data: string | null) {
  el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: false, composed: true, inputType: "insertText", data }));
}

function focus(el: Element) {
  (el as HTMLElement).focus?.({ preventScroll: true });
  el.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
}

function blur(el: Element) {
  el.dispatchEvent(new FocusEvent("focusout", { bubbles: true, composed: true }));
  (el as HTMLElement).blur?.();
}

const KEYCODES: Record<string, number> = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, Tab: 9, " ": 32, Backspace: 8, Home: 36 };

export function pressKey(el: Element, key: string, opts: { alt?: boolean } = {}) {
  const code = key.length === 1 ? (key === " " ? "Space" : `Key${key.toUpperCase()}`) : key;
  const keyCode = KEYCODES[key] ?? key.toUpperCase().charCodeAt(0);
  for (const type of ["keydown", "keyup"]) {
    const ev = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, composed: true, altKey: opts.alt });
    Object.defineProperty(ev, "keyCode", { get: () => keyCode });
    Object.defineProperty(ev, "which", { get: () => keyCode });
    el.dispatchEvent(ev);
  }
}

/** Full pointer + mouse sequence at the element centre. Many widgets check button/pointerType, few check isTrusted. */
export function pointerClick(el: Element) {
  scrollIntoViewIfNeeded(el);
  const r = el.getBoundingClientRect();
  const base = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, view: window, button: 0 };
  const ptr = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true };
  // a real pointer moves before it presses; some widgets (Radix) ignore a release that never moved
  el.dispatchEvent(new PointerEvent("pointermove", ptr));
  el.dispatchEvent(new MouseEvent("mousemove", base));
  el.dispatchEvent(new PointerEvent("pointerover", ptr));
  el.dispatchEvent(new PointerEvent("pointerenter", { ...ptr, bubbles: false }));
  el.dispatchEvent(new MouseEvent("mouseover", base));
  el.dispatchEvent(new PointerEvent("pointerdown", { ...ptr, buttons: 1 }));
  el.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
  (el as HTMLElement).focus?.({ preventScroll: true });
  el.dispatchEvent(new PointerEvent("pointerup", ptr));
  el.dispatchEvent(new MouseEvent("mouseup", base));
  el.dispatchEvent(new MouseEvent("click", base));
}

/** Types text the way a user would: execCommand('insertText') per character, keeps masks and editors happy. */
export async function typeText(el: Element, text: string, opts: { clear?: boolean } = { clear: true }) {
  focus(el);
  if (opts.clear) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select();
    else selectContents(el);
  }
  for (const ch of text) {
    const ok = document.execCommand("insertText", false, ch);
    if (!ok && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      setNativeValue(el, el.value + ch);
      fireInput(el, ch);
    }
  }
}

function selectContents(el: Element) {
  const sel = getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

async function waitFor<T>(fn: () => T | null | undefined | false, ms = 1200, every = 40): Promise<T | null> {
  const end = performance.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (performance.now() > end) return null;
    await sleep(every);
  }
}

/* ------------------------------------------------------------------ helpers */

const OPTION_SEL = [
  "[role=option]",
  "[id*='-option-']",
  ".ant-select-item-option",
  ".select2-results__option",
  "li.active-result",
  "mat-option",
  ".MuiAutocomplete-option",
  "[cmdk-item]",
].join(",");

function visibleOptions(listboxId?: string | null): HTMLElement[] {
  const roots = collectRoots(document).roots;
  let opts: HTMLElement[] = [];
  if (listboxId) {
    const lb = document.getElementById(listboxId);
    if (lb) opts = [...lb.querySelectorAll<HTMLElement>(OPTION_SEL)];
  }
  if (!opts.length) opts = queryAll<HTMLElement>(roots, OPTION_SEL);
  return opts.filter((o) => isVisible(o) && o.getAttribute("aria-disabled") !== "true");
}

const optionText = (o: Element) => (o.getAttribute("title") || o.textContent || "").trim();

function editableInput(e: Entry): HTMLInputElement | null {
  const cand = e.el instanceof HTMLInputElement ? e.el : e.root.querySelector("input");
  if (!cand || cand.readOnly || cand.type === "hidden" || cand.disabled) return null;
  return cand as HTMLInputElement;
}

const wantList = (value: string) => [value, value.split(/[,(]/)[0].trim()].filter(Boolean);

/* ------------------------------------------------------------------ adapters */

type Adapter = (e: Entry, value: string, m: Mapping) => Promise<void>;

const nativeText: Adapter = async (e, value) => {
  const el = e.el;
  focus(el);
  setNativeValue(el, value);
  fireInput(el, value);
  fire(el, "change");
  blur(el);
};

const typed: Adapter = async (e, value) => {
  await typeText(e.el, value);
  fire(e.el, "change");
  blur(e.el);
};

const masked: Adapter = async (e, value) => {
  const el = e.el as HTMLInputElement;
  const template = el.value.includes("_") ? el.value : el.placeholder || "";
  const slots = (template.match(/[_09#]/g) ?? []).length;
  let raw = value.replace(/[^0-9a-z]/gi, "");
  if (/^\d+$/.test(raw) && slots && raw.length > slots) raw = raw.slice(-slots);
  await typeText(el, raw);
  blur(el);
};

const nativeSelect: Adapter = async (e, value) => {
  const sel = e.el as HTMLSelectElement;
  const opts = [...sel.options];
  let i = bestOption(opts.map((o) => o.text), wantList(value));
  if (i < 0) i = bestOption(opts.map((o) => o.value), [value]);
  if (i < 0) throw new Error(`no option matches "${value}"`);
  focus(sel);
  setNativeValue(sel, opts[i].value);
  fire(sel, "input");
  fire(sel, "change");
  blur(sel);
};

const checkbox: Adapter = async (e, value) => {
  const el = e.el as HTMLInputElement;
  const want = /^(true|yes|1|y|on|checked)$/i.test(value.trim());
  if (el.checked !== want) el.click();
};

const radioGroup: Adapter = async (e, value) => {
  const group = e.group ?? [e.el as HTMLInputElement];
  const labels = group.map(radioOptionLabel);
  let i = bestOption(labels, wantList(value));
  if (i < 0) i = bestOption(group.map((r) => r.value), [value]);
  if (i < 0) throw new Error(`no choice matches "${value}"`);
  if (!group[i].checked) group[i].click();
};

const nativeDate: Adapter = async (e, value) => {
  const el = e.el as HTMLInputElement;
  focus(el);
  setNativeValue(el, value);
  fireInput(el, value);
  fire(el, "change");
  blur(el);
};

const range: Adapter = async (e, value) => {
  const el = e.el as HTMLInputElement;
  const n = Math.min(Number(el.max || 100), Math.max(Number(el.min || 0), Number(value)));
  setNativeValue(el, String(n));
  fireInput(el, String(n));
  fire(el, "change");
};

/** Generic combobox / listbox: open → (type to filter) → click best option → verify. */
const combobox: Adapter = async (e, value) => {
  const trigger = e.root;
  const input = editableInput(e);
  const listboxId = () => (e.el.getAttribute("aria-controls") || trigger.getAttribute("aria-controls"));

  pointerClick(trigger);
  if (input) {
    focus(input);
    let opts = await waitFor(() => (visibleOptions(listboxId()).length ? true : null), 400);
    for (const q of [value, value.split(" ")[0]]) {
      setNativeValue(input, q);
      fireInput(input, q);
      await sleep(120);
      opts = await waitFor(() => (visibleOptions(listboxId()).some((o) => similarity(optionText(o), value) > 0.5) ? true : null), 900);
      if (opts) break;
    }
  }
  let options = await waitFor(() => {
    const o = visibleOptions(listboxId());
    return o.length ? o : null;
  }, 1500);
  if (!options) {
    pressKey(input ?? trigger, "ArrowDown");
    options = await waitFor(() => {
      const o = visibleOptions(listboxId());
      return o.length ? o : null;
    }, 800);
  }
  if (!options) throw new Error("listbox did not open");
  const i = bestOption(options.map(optionText), wantList(value), 0.6);
  if (i < 0) {
    pressKey(input ?? trigger, "Escape");
    throw new Error(`no option matches "${value}"`);
  }
  pointerClick(options[i]);
  await sleep(60);
};

const select2: Adapter = nativeSelect;

const muiSelect: Adapter = async (e, value, m) => {
  const native = e.root.parentElement?.querySelector<HTMLInputElement>("input.MuiSelect-nativeInput");
  // the hidden input's value must be an option *value*, which we only know after opening, so use the listbox
  void native;
  await combobox(e, value, m);
};

const antdDate: Adapter = async (e, value) => {
  const input = e.el as HTMLInputElement;
  pointerClick(input);
  focus(input);
  setNativeValue(input, value);
  fireInput(input, value);
  await sleep(50);
  pressKey(input, "Enter");
  await sleep(50);
  pressKey(input, "Escape");
  blur(input);
};

const muiDate: Adapter = async (e, value, m) => {
  const hidden = e.root.querySelector<HTMLInputElement>("input");
  if (hidden) {
    setNativeValue(hidden, value);
    fireInput(hidden, value);
    fire(hidden, "change");
    return;
  }
  await typed(e, value, m);
};

const flatpickr: Adapter = async (e, value) => {
  const el = e.el as HTMLInputElement;
  focus(el);
  setNativeValue(el, value);
  fireInput(el, value);
  pressKey(el, "Enter");
  fire(el, "change");
  blur(el);
};

const richText: Adapter = async (e, value) => {
  const el = e.el as HTMLElement;
  focus(el);
  selectContents(el);
  const ok = document.execCommand("insertText", false, value);
  if (!ok || !norm(el.textContent).includes(norm(value).slice(0, 20))) {
    const dt = new DataTransfer();
    dt.setData("text/plain", value);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true, composed: true }));
  }
  if (!norm(el.textContent).includes(norm(value).slice(0, 20))) el.textContent = value;
  fireInput(el, value);
  blur(el);
};

function fileFrom(v: FileValue) {
  const bin = atob(v.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], v.name, { type: v.type });
}

const file: Adapter = async (e, _value, m) => {
  if (!m.file) throw new Error("no file data");
  const input = e.el as HTMLInputElement;
  const dt = new DataTransfer();
  dt.items.add(fileFrom(m.file));
  input.files = dt.files;
  fire(input, "input");
  fire(input, "change");
};

const ADAPTERS: Record<WidgetKind, Adapter> = {
  "native-text": nativeText,
  "native-select": nativeSelect,
  "native-date": nativeDate,
  checkbox,
  "radio-group": radioGroup,
  range,
  combobox,
  "react-select": combobox,
  "mui-select": muiSelect,
  "mui-autocomplete": combobox,
  "mui-date": muiDate,
  "antd-select": combobox,
  "antd-date": antdDate,
  "radix-select": combobox,
  headless: combobox,
  select2,
  chosen: nativeSelect,
  flatpickr,
  masked,
  "rich-text": richText,
  file,
};

/* ------------------------------------------------------------------ verify */

export function readBack(e: Entry, widget: WidgetKind): string {
  const el = e.el as HTMLInputElement;
  switch (widget) {
    case "checkbox":
      return el.checked ? "true" : "false";
    case "radio-group": {
      const r = (e.group ?? [el]).find((x) => x.checked);
      return r ? radioOptionLabel(r) : "";
    }
    case "native-select":
    case "select2":
    case "chosen": {
      const s = e.el as HTMLSelectElement;
      return s.selectedIndex >= 0 && s.value ? s.options[s.selectedIndex].text : "";
    }
    case "file":
      return el.files?.[0]?.name ?? "";
    case "rich-text":
      return (e.el.textContent ?? "").trim();
    case "mui-date":
      return e.root.querySelector("input")?.value ?? "";
    case "combobox":
    case "react-select":
    case "mui-select":
    case "mui-autocomplete":
    case "antd-select":
    case "radix-select":
    case "headless": {
      const inputVal = e.el instanceof HTMLInputElement ? e.el.value : "";
      const container = e.root.closest(".ant-select") ?? e.root.closest("[class*='-container']") ?? e.root;
      return [inputVal, textOf(container, "[role=listbox],[role=option],[class*='-menu']", 200)].filter(Boolean).join(" ");
    }
    default:
      return el.value ?? "";
  }
}

export function matches(widget: WidgetKind, readValue: string, wanted: string): boolean {
  const a = norm(readValue);
  const w = norm(wanted);
  if (!w) return true;
  if (!a) return false;
  if (widget === "checkbox") return a === (/^(true|yes|1|y|on)$/i.test(wanted) ? "true" : "false");
  if (widget === "masked") return digits(readValue).length > 0 && (digits(wanted).endsWith(digits(readValue)) || digits(readValue).endsWith(digits(wanted)) || a.includes(w));
  if (widget === "file" || widget === "rich-text") return a.length > 0 && (a.includes(w.slice(0, 15)) || widget === "file");
  if (widget === "native-date" || widget === "mui-date" || widget === "antd-date" || widget === "flatpickr") return digits(a) === digits(w) || digits(a).length >= 8;
  if (["combobox", "react-select", "mui-select", "mui-autocomplete", "antd-select", "radix-select", "headless"].includes(widget)) {
    return a.includes(w) || similarity(a, w) > 0.8 || a.includes(norm(wanted.split(/[,(]/)[0]));
  }
  return a === w || a.includes(w) || similarity(a, w) > 0.9;
}

/* ------------------------------------------------------------------ engine */

export async function fillOne(m: Mapping, widget: WidgetKind): Promise<FillResult> {
  const t0 = performance.now();
  const e = lookup(m.ref);
  if (!e || !e.el.isConnected) return { ref: m.ref, status: "failed", rung: 0, ms: 0, error: "element gone" };
  const rungs: Adapter[] = [ADAPTERS[widget] ?? nativeText];
  if (["native-text", "masked"].includes(widget)) rungs.push(typed);
  if (widget === "rich-text") rungs.push(typed);
  if (widget === "mui-select") rungs.push(combobox);

  let lastErr = "";
  for (let i = 0; i < rungs.length; i++) {
    try {
      scrollIntoViewIfNeeded(e.root);
      await rungs[i](e, m.value, m);
      await nextFrame();
      await sleep(30);
      const got = readBack(e, widget);
      if (matches(widget, got, m.value)) return { ref: m.ref, status: "verified", rung: i + 1, ms: Math.round(performance.now() - t0), readBack: got.slice(0, 120) };
      lastErr = `read back "${got.slice(0, 60)}"`;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  return { ref: m.ref, status: "failed", rung: rungs.length, ms: Math.round(performance.now() - t0), error: lastErr };
}

/** Fills one field at a time (dropdown portals collide in parallel), then re-checks after the page settles. */
export async function fillAll(mappings: Mapping[], widgets: Record<string, WidgetKind>, onProgress?: (r: FillResult) => void) {
  const results: FillResult[] = [];
  for (const m of mappings) {
    if (!m.enabled || m.source === "skip") continue;
    const r = await fillOne(m, widgets[m.ref] ?? "native-text");
    results.push(r);
    onProgress?.(r);
  }
  // late re-renders (hydration, controlled resets) can wipe values: re-check once and refill
  await sleep(450);
  for (const r of results) {
    if (r.status !== "verified") continue;
    const m = mappings.find((x) => x.ref === r.ref)!;
    const e = lookup(r.ref);
    if (!e) continue;
    const widget = widgets[r.ref] ?? "native-text";
    if (!matches(widget, readBack(e, widget), m.value)) {
      const again = await fillOne(m, widget);
      Object.assign(r, again, { rung: again.rung + 10 });
      onProgress?.(r);
    }
  }
  return results;
}

/** Click an element for an approved AI action. Refuses submit / pay / send / delete buttons. */
export function safeClick(ref: string): FillResult {
  const e = lookup(ref);
  if (!e) return { ref, status: "failed", rung: 0, ms: 0, error: "element gone" };
  const text = `${e.el.textContent ?? ""} ${e.el.getAttribute("aria-label") ?? ""} ${(e.el as HTMLInputElement).value ?? ""}`;
  if (/\b(submit|pay|purchase|buy|place order|send|delete|remove|sign|confirm|checkout)\b/i.test(text) || (e.el as HTMLButtonElement).type === "submit") {
    return { ref, status: "skipped", rung: 0, ms: 0, error: "otto never clicks submit/pay/send/delete" };
  }
  pointerClick(e.el);
  return { ref, status: "filled", rung: 1, ms: 0 };
}
