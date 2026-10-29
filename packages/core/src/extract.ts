import type { FieldDescriptor, FieldKind, Fingerprint, ScanResult, WidgetKind } from "@otto/shared";
import { collectHeadings, collectRoots, isVisible, queryAll, rectOf, sectionOf, textOf, xpathOf } from "./dom";
import { groupLabel, labelFor, radioOptionLabel } from "./labels";
import { register } from "./registry";
import { clean, hash, isHashy, norm } from "./util";

const CANDIDATES = [
  "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image])",
  "select",
  "textarea",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[role=combobox]",
  "[role=textbox]",
  "[role=spinbutton]",
  "button[aria-haspopup=listbox]",
].join(",");

const TRAP_RE = /(honeypot|^hp[_-]|leave (this |it )?(field )?(blank|empty)|do not (fill|complete)|bot.?(field|trap)|fax_?only)/i;
const CONSENT_RE = /\b(terms|agree|consent|privacy|marketing|newsletter|subscribe|offers|promotion|news about|keep me posted|updates? about|email me)\b/i;
const SENSITIVE_RE = /(password|passcode|\bpin\b|one.?time|otp|verification code|card number|credit card|\bcvv\b|\bcvc\b|security code|captcha|social security|\bssn\b)/i;

interface Built {
  el: Element;
  root: Element;
  widget: WidgetKind;
  group?: HTMLInputElement[];
}

/** Figure out what kind of widget an element belongs to and which element is its visible root. */
function detect(el: Element): Built | null {
  const tag = el.localName;
  const input = el as HTMLInputElement;
  const type = (input.type || "").toLowerCase();

  if (tag === "input" && type === "file") {
    let root: Element = el;
    for (let n = el.parentElement, i = 0; n && i < 3; n = n.parentElement, i++) {
      if (isVisible(n)) {
        root = n;
        break;
      }
    }
    return { el, root, widget: "file" };
  }
  if (tag === "select") {
    const s2 = el.classList.contains("select2-hidden-accessible") && el.nextElementSibling?.classList.contains("select2");
    if (s2) return { el, root: el.nextElementSibling!, widget: "select2" };
    const chosen = el.nextElementSibling?.classList.contains("chosen-container");
    if (chosen) return { el, root: el.nextElementSibling!, widget: "chosen" };
    if (el.getAttribute("aria-hidden") === "true") return null; // radix / headless hidden select bubbles
    return { el, root: el, widget: "native-select" };
  }
  if (tag === "input" && type === "checkbox") return { el, root: el, widget: "checkbox" };
  if (tag === "input" && type === "radio") return { el, root: el, widget: "radio-group" };
  if (tag === "input" && type === "range") return { el, root: el, widget: "range" };

  const ant = el.closest(".ant-select");
  if (ant) return { el: ant.querySelector("input") ?? el, root: ant.querySelector(".ant-select-selector") ?? ant, widget: "antd-select" };
  const antDate = el.closest(".ant-picker");
  if (antDate) return { el: antDate.querySelector("input") ?? el, root: antDate, widget: "antd-date" };
  const muiDate = el.closest(".MuiPickersInputBase-root, .MuiPickersTextField-root");
  if (muiDate) {
    const root = el.closest(".MuiPickersInputBase-root") ?? muiDate;
    const hidden = root.querySelector("input");
    return { el: hidden ?? el, root, widget: "mui-date" };
  }
  if (el.closest(".MuiAutocomplete-root") && tag === "input") return { el, root: el, widget: "mui-autocomplete" };
  if (el.classList.contains("MuiSelect-select") || (tag === "input" && el.classList.contains("MuiSelect-nativeInput"))) {
    const root = el.closest(".MuiInputBase-root");
    const trigger = root?.querySelector(".MuiSelect-select") ?? el;
    return { el: trigger, root: trigger, widget: "mui-select" };
  }
  if (tag === "input" && el.getAttribute("role") === "combobox" && el.closest("[class*='-control']") && el.closest("[class*='-container']")) {
    return { el, root: el.closest("[class*='-control']")!, widget: "react-select" };
  }
  if (el.hasAttribute("data-headlessui-state") || /^headlessui-/.test(el.id)) return { el, root: el, widget: "headless" };
  if (tag === "button" && el.getAttribute("role") === "combobox") {
    const radix = el.nextElementSibling?.matches("select[aria-hidden=true]") || el.hasAttribute("data-radix-collection-item") || /^radix-/.test(el.id);
    return { el, root: el, widget: radix ? "radix-select" : "combobox" };
  }
  if (tag === "input" && el.classList.contains("flatpickr-input")) return { el, root: el, widget: "flatpickr" };
  if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox") {
    if (el.closest(".select2-container")) return null; // handled via the native select
    return { el, root: el, widget: "combobox" };
  }
  if ((el as HTMLElement).isContentEditable && tag !== "input" && tag !== "textarea") {
    if (el.parentElement?.closest("[contenteditable='true'],[contenteditable='']")) return null;
    return { el, root: el, widget: "rich-text" };
  }
  if (el.getAttribute("role") === "spinbutton" && el.closest(".MuiPickersSectionList-root")) return null;
  if (tag === "input" && ["date", "month", "time", "datetime-local", "week"].includes(type)) return { el, root: el, widget: "native-date" };
  if (tag === "input" || tag === "textarea") {
    const ph = input.placeholder ?? "";
    const masked = /_/.test(input.value) || /_{2,}|#{2,}|9{3,}/.test(ph) || el.hasAttribute("data-mask") || el.hasAttribute("data-inputmask");
    return { el, root: el, widget: masked ? "masked" : "native-text" };
  }
  if (el.getAttribute("role") === "textbox") return { el, root: el, widget: "rich-text" };
  return null;
}

function kindOf(b: Built, label: string): FieldKind {
  const t = ((b.el as HTMLInputElement).type || "").toLowerCase();
  switch (b.widget) {
    case "checkbox":
      return "boolean";
    case "radio-group":
    case "native-select":
    case "select2":
    case "chosen":
    case "combobox":
    case "react-select":
    case "mui-select":
    case "mui-autocomplete":
    case "antd-select":
    case "radix-select":
    case "headless":
      return "choice";
    case "native-date":
    case "mui-date":
    case "antd-date":
    case "flatpickr":
      return "date";
    case "file":
      return "file";
    case "rich-text":
      return "longtext";
    case "range":
      return "range";
  }
  if (b.el.localName === "textarea") return "longtext";
  if (t === "email") return "email";
  if (t === "tel") return "tel";
  if (t === "url") return "url";
  if (t === "number") return "number";
  if (/date of birth|birth ?date|\bdob\b/i.test(label)) return "date";
  return "text";
}

function dateFormatOf(b: Built): string | undefined {
  if (b.widget === "native-date") return "YYYY-MM-DD";
  const ph = (b.el as HTMLInputElement).placeholder || "";
  const src = b.widget === "mui-date" ? (b.root.textContent ?? "") : ph;
  const m = src.toUpperCase().match(/(DD|MM|YYYY|YY)[/.\- ](DD|MM)[/.\- ](DD|MM|YYYY|YY)/);
  if (m) return m[0].replace(/YY(?!YY)/, "YY");
  if (b.widget === "flatpickr" || b.widget === "antd-date") return "YYYY-MM-DD";
  return undefined;
}

function optionsOf(b: Built): string[] | undefined {
  if (b.el.localName === "select") {
    return [...(b.el as HTMLSelectElement).options]
      .filter((o) => o.value !== "" && !/^(-+|select.*|choose.*|please.*)$/i.test(o.text.trim()))
      .map((o) => clean(o.text, 60));
  }
  if (b.group) return b.group.map(radioOptionLabel);
  return undefined;
}

function classify(label: string, b: Built): { trap?: string; blocked?: string } {
  const el = b.el as HTMLInputElement;
  const all = `${label} ${el.name ?? ""} ${el.id}`;
  if (TRAP_RE.test(all)) return { trap: "honeypot name/label" };
  const ac = (el.getAttribute("autocomplete") ?? "").toLowerCase();
  if (el.type === "password" || ac.startsWith("cc-") || ac === "one-time-code" || ac.includes("password") || SENSITIVE_RE.test(label)) {
    return { blocked: "sensitive" };
  }
  if (b.widget === "checkbox" && CONSENT_RE.test(label)) return { blocked: "consent" };
  return {};
}

function neighborText(root: Element): string[] {
  const out: string[] = [];
  let n: Element | null = root;
  for (let i = 0; n && i < 3 && out.length < 3; i++, n = n.parentElement) {
    const prev = n.previousElementSibling;
    if (prev && !prev.querySelector("input,select,textarea")) {
      const t = textOf(prev, undefined, 60);
      if (t) out.push(t);
    }
  }
  return out;
}

function fingerprint(b: Built, label: string, section: string): Fingerprint {
  const el = b.el as HTMLInputElement;
  return {
    tag: el.localName,
    type: (el.type ?? "").toLowerCase(),
    id: el.id && !isHashy(el.id) ? el.id : "",
    name: el.getAttribute("name") ?? "",
    classes: [...b.root.classList].filter((c) => !isHashy(c)).slice(0, 6),
    ariaLabel: el.getAttribute("aria-label") ?? "",
    role: el.getAttribute("role") ?? "",
    autocomplete: el.getAttribute("autocomplete") ?? "",
    label,
    placeholder: el.getAttribute("placeholder") ?? "",
    neighborText: neighborText(b.root),
    section,
    xpath: xpathOf(b.root),
    rect: rectOf(b.root),
  };
}

function currentValue(b: Built): string {
  const el = b.el as HTMLInputElement;
  if (b.widget === "checkbox") return el.checked ? "true" : "";
  if (b.group) return b.group.find((r) => r.checked)?.value ?? "";
  if (b.el.localName === "select") {
    const s = b.el as HTMLSelectElement;
    return s.value ? clean(s.options[s.selectedIndex]?.text) : "";
  }
  if (b.widget === "rich-text") return clean(b.el.textContent, 80);
  if (b.widget === "masked") return /\d|[a-z]/i.test(el.value) ? el.value : "";
  if (["combobox", "react-select", "mui-select", "radix-select", "headless", "antd-select"].includes(b.widget) && b.el.localName !== "input") {
    return clean(b.el.textContent, 60);
  }
  return clean(el.value ?? "", 80);
}

/** Scan this frame's document (and its shadow roots) for fillable fields. */
export function scan(): ScanResult {
  const t0 = performance.now();
  const walk = collectRoots(document);
  const headings = collectHeadings(walk.roots);
  const seenRoots = new Set<Element>();
  const radioGroups = new Map<string | Element, HTMLInputElement[]>();
  const fields: FieldDescriptor[] = [];

  for (const cand of queryAll(walk.roots, CANDIDATES)) {
    const b = detect(cand);
    if (!b || seenRoots.has(b.root) || seenRoots.has(b.el)) continue;

    if (b.widget === "radio-group") {
      const r = b.el as HTMLInputElement;
      const container = r.closest("[role=radiogroup], .ant-radio-group, fieldset");
      const key: string | Element = r.name ? `${r.form ? "f" : "d"}:${r.name}` : (container ?? r);
      if (radioGroups.has(key)) continue;
      const scope = r.form ?? (r.getRootNode() as Document | ShadowRoot);
      const group = r.name
        ? [...scope.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(r.name)}"]`)]
        : container
          ? [...container.querySelectorAll<HTMLInputElement>("input[type=radio]")]
          : [r];
      radioGroups.set(key, group);
      b.group = group;
      b.root = group.find((x) => isVisible(x) || isVisible(x.labels?.[0] ?? x)) ?? r;
    }

    // visibility: hidden real inputs behind styled widgets are fine, hidden plain inputs are traps
    let visible = isVisible(b.root);
    if (!visible && (b.widget === "checkbox" || b.widget === "radio-group")) {
      const lab = (b.el as HTMLInputElement).labels?.[0] ?? b.el.closest("label");
      visible = Boolean((lab && isVisible(lab)) || b.group?.some((x) => x.labels?.[0] && isVisible(x.labels[0])));
    }
    if (!visible && b.widget === "file") visible = true;
    if (!visible && b.el.getAttribute("aria-hidden") === "true") continue; // claimed hidden input of a custom widget
    if (!visible && b.el.closest("[aria-hidden=true],[hidden],dialog:not([open])")) continue;

    seenRoots.add(b.root);
    seenRoots.add(b.el);
    const { label, source } = b.group ? { label: groupLabel(b.group), source: "label" as const } : labelFor(b.el, b.root);
    const section = sectionOf(b.root, headings);
    const kind = kindOf(b, label);
    const flags = visible ? classify(label, b) : { trap: "hidden" };
    const el = b.el as HTMLInputElement;
    const ref = register(b.el, b.root, b.group);
    const name = el.getAttribute("name") ?? undefined;

    fields.push({
      ref,
      frameId: 0,
      kind,
      widget: b.widget,
      label,
      labelSource: source,
      placeholder: el.getAttribute("placeholder") ?? undefined,
      name,
      idAttr: el.id || undefined,
      autocomplete: el.getAttribute("autocomplete") ?? undefined,
      inputType: el.type || undefined,
      required: el.required || el.getAttribute("aria-required") === "true",
      maxLength: el.maxLength > 0 ? el.maxLength : undefined,
      pattern: el.getAttribute("pattern") ?? undefined,
      dateFormat: kind === "date" ? dateFormatOf(b) : undefined,
      options: optionsOf(b)?.slice(0, 60),
      optionCount: optionsOf(b)?.length,
      section: section || undefined,
      currentValue: currentValue(b) || undefined,
      rect: rectOf(b.root),
      trap: flags.trap,
      blocked: flags.blocked,
      fieldSig: hash(`${norm(name || label)}&${b.widget}`),
      fp: fingerprint(b, label, section),
    });
  }

  fields.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const caseId = document.querySelector<HTMLMetaElement>('meta[name="otto-case"]')?.content;
  return {
    frameId: 0,
    url: location.href,
    title: document.title,
    caseId,
    fields,
    elements: walk.elements,
    truncated: walk.truncated,
    ms: Math.round(performance.now() - t0),
  };
}
