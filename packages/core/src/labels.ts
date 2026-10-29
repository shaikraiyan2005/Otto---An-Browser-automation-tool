import type { LabelSource } from "@otto/shared";
import { byIdInRoot, textOf } from "./dom";
import { clean, isHashy } from "./util";

const CONTROL = "input,select,textarea,[contenteditable=''],[contenteditable='true'],[role=combobox],[role=listbox],[role=textbox],[role=radiogroup]";
const WIDGET_NOISE = "[role=listbox],[role=option],[class*='-menu'],[class*='-control'],.ant-select,.MuiInputBase-root,.MuiAutocomplete-root,.select2-container,[aria-hidden='true']";

const ok = (s: string) => /[\p{L}\p{N}]/u.test(s) && s.length <= 120;

function labelsText(el: Element): string {
  const labels = (el as HTMLInputElement).labels;
  if (!labels?.length) return "";
  return clean([...labels].map((l) => textOf(l, WIDGET_NOISE)).filter(Boolean).join(" "), 100);
}

function ariaText(el: Element): string {
  const ids = el.getAttribute("aria-labelledby");
  if (ids) {
    const t = clean(
      ids
        .split(/\s+/)
        .map((id) => {
          const n = byIdInRoot(el, id);
          return n && n !== el ? textOf(n, WIDGET_NOISE) : "";
        })
        .filter(Boolean)
        .join(" "),
      100,
    );
    if (ok(t)) return t;
  }
  return clean(el.getAttribute("aria-label"), 100);
}

/** Text in previous siblings, walking up while the ancestor holds only this field (Chromium-style inference). */
function siblingText(el: Element, stopAt: Element | null): string {
  let node: Element | null = el;
  for (let depth = 0; node && depth < 5 && node !== stopAt; depth++) {
    for (let s = node.previousSibling; s; s = s.previousSibling) {
      if (s.nodeType === Node.TEXT_NODE) {
        const t = clean(s.nodeValue, 100);
        if (ok(t)) return t;
        continue;
      }
      if (s.nodeType !== Node.ELEMENT_NODE) continue;
      const e = s as Element;
      if (e.matches("br,hr,img,script,style")) continue;
      if (e.matches(CONTROL) || e.querySelector(CONTROL)) return "";
      const t = textOf(e, WIDGET_NOISE, 100);
      if (ok(t)) return t;
    }
    const parent: Element | null = node.parentElement;
    if (!parent || parent.matches("form,body,fieldset")) break;
    // the parent's own leading text (e.g. `<div>Gender: <label>..`)
    node = parent;
  }
  return "";
}

/** Closest container label for widgets whose control is nested (MUI FormControl, AntD form item…). */
function containerLabel(el: Element): string {
  let n: Element | null = el.parentElement;
  for (let depth = 0; n && depth < 4; depth++, n = n.parentElement) {
    const lab = n.querySelector(":scope > label, :scope > .MuiFormLabel-root, :scope > [class*='label' i]:not(input)");
    if (lab && !lab.contains(el) && !lab.querySelector(CONTROL)) {
      const t = textOf(lab, WIDGET_NOISE, 100);
      if (ok(t)) return t;
    }
    if (n.querySelectorAll(CONTROL).length > 3) break;
  }
  return "";
}

function humanize(s: string | null) {
  if (!s) return "";
  const t = s
    .replace(/\[|\]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !isHashy(w) && !/^(txt|ddl|inp|fld|ctl\d*|input|field)$/i.test(w))
    .join(" ");
  return clean(t, 60);
}

export function labelFor(el: Element, root: Element): { label: string; source: LabelSource } {
  for (const e of root === el ? [el] : [el, root]) {
    const l = labelsText(e);
    if (ok(l)) return { label: l, source: "label" };
    const a = ariaText(e);
    if (ok(a)) return { label: a, source: "aria" };
  }
  const wrap = el.closest("label");
  if (wrap) {
    const t = textOf(wrap, WIDGET_NOISE, 100);
    if (ok(t)) return { label: t, source: "label" };
  }
  const title = clean(el.getAttribute("title"), 100);
  if (ok(title)) return { label: title, source: "title" };

  const cont = containerLabel(root);
  if (cont) return { label: cont, source: "ancestor" };

  const td = root.closest("td");
  if (td) {
    const prev = td.previousElementSibling;
    if (prev) {
      const t = textOf(prev, undefined, 100);
      if (ok(t)) return { label: t, source: "table" };
    }
  }
  const sib = siblingText(root, root.closest("form"));
  if (sib) return { label: sib, source: "sibling" };

  const ph = clean(el.getAttribute("placeholder"), 100);
  if (ok(ph) && !/^[_#9\s()+\-/.]+$/.test(ph)) return { label: ph, source: "placeholder" };

  const attr = humanize(el.getAttribute("name")) || humanize(el.id);
  if (ok(attr)) return { label: attr, source: "attribute" };
  return { label: "", source: "none" };
}

/** Label for a radio group: legend, aria group label, the container's own text, or the text before it. */
export function groupLabel(radios: HTMLInputElement[]): string {
  const first = radios[0];
  const fs = first.closest("fieldset");
  const legend = fs?.querySelector("legend");
  if (legend) return clean(legend.textContent, 100);
  const rg = first.closest("[role=radiogroup]");
  if (rg) {
    const a = ariaText(rg);
    if (ok(a)) return a;
  }
  let container: Element | null = first.parentElement;
  while (container && !radios.every((r) => container!.contains(r))) container = container.parentElement;
  if (!container) return "";
  for (const n of container.childNodes) {
    if (n.nodeType === Node.TEXT_NODE && ok(clean(n.nodeValue))) return clean(n.nodeValue, 100).replace(/:$/, "");
    if (n.nodeType === Node.ELEMENT_NODE && !(n as Element).querySelector("input") && !(n as Element).matches("input,label")) {
      const t = textOf(n, undefined, 100);
      if (ok(t)) return t.replace(/:$/, "");
    }
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).querySelector("input")) break;
  }
  return siblingText(container, container.closest("form"));
}

export function radioOptionLabel(r: HTMLInputElement): string {
  const l = r.labels?.[0] ?? r.closest("label");
  const t = l ? textOf(l, undefined, 60) : "";
  return t || r.value;
}
