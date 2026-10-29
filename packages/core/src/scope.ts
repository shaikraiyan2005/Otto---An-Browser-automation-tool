import type { FieldDescriptor } from "@otto/shared";
import { isVisible, textOf } from "./dom";
import { lookup, register } from "./registry";
import { clean } from "./util";

const CLICKABLE = "a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],input[type=submit],input[type=button],summary,[onclick],[tabindex='0']";

/** Fields and clickables inside a picked element, for select-and-prompt. */
export function scopeOf(ref: string, fields: FieldDescriptor[]) {
  const e = lookup(ref);
  if (!e) return { fields: [], clickables: [] };
  const inside = fields.filter((f) => {
    const fe = lookup(f.ref);
    return fe && (e.el.contains(fe.el) || e.el.contains(fe.root));
  });
  const clickables: { ref: string; line: string }[] = [];
  const seen = new Set<Element>();
  for (const el of e.el.querySelectorAll(CLICKABLE)) {
    if (clickables.length >= 40) break;
    if (seen.has(el) || !isVisible(el)) continue;
    seen.add(el);
    const label = clean(textOf(el, undefined, 80) || el.getAttribute("aria-label") || (el as HTMLInputElement).value || el.getAttribute("title"), 80);
    if (!label) continue;
    clickables.push({ ref: register(el, el), line: `${register(el, el)}|${el.localName}|${label}` });
  }
  return { fields: inside, clickables };
}

/** Visible text only (hidden and near-invisible text is a common prompt-injection hiding place). */
export function visibleText(root: Element = document.body, max = 20000): string {
  const out: string[] = [];
  let len = 0;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n && len < max; n = tw.nextNode()) {
    const p = n.parentElement;
    const s = n.nodeValue?.trim();
    if (!p || !s || p.closest("script,style,noscript,template,[aria-hidden=true]")) continue;
    const cs = getComputedStyle(p);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.1 || parseFloat(cs.fontSize) < 4) continue;
    out.push(s);
    len += s.length;
  }
  return out.join(" ").slice(0, max);
}
