import type { Rect } from "@otto/shared";
import { clean } from "./util";

type Root = Document | ShadowRoot;

/** Opens closed shadow roots when running as an extension content script. */
function shadowOf(el: Element): ShadowRoot | null {
  if (el.shadowRoot) return el.shadowRoot;
  if (!el.localName.includes("-")) return null;
  const dom = (globalThis as { chrome?: { dom?: { openOrClosedShadowRoot?: (e: Element) => ShadowRoot | null } } }).chrome?.dom;
  try {
    return dom?.openOrClosedShadowRoot?.(el) ?? null;
  } catch {
    return null;
  }
}

export interface Walk {
  roots: Root[];
  elements: number;
  truncated: boolean;
}

const MAX_ELEMENTS = 60000;

/** Collects the document plus every open/closed shadow root. Iframes are scanned by their own engine instance. */
export function collectRoots(doc: Document = document): Walk {
  const roots: Root[] = [doc];
  let elements = 0;
  let truncated = false;
  const visit = (root: Root) => {
    const tw = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (++elements > MAX_ELEMENTS) {
        truncated = true;
        return;
      }
      const sr = shadowOf(n as Element);
      if (sr && !roots.includes(sr)) {
        roots.push(sr);
        visit(sr);
      }
    }
  };
  visit(doc);
  return { roots, elements, truncated };
}

export function queryAll<T extends Element = Element>(roots: Root[], sel: string): T[] {
  const out: T[] = [];
  for (const r of roots) out.push(...(r.querySelectorAll(sel) as NodeListOf<T>));
  return out;
}

export function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
}

export function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  if (r.right + scrollX < -200 || r.bottom + scrollY < -200) return false;
  const anyEl = el as Element & { checkVisibility?: (o: object) => boolean };
  if (anyEl.checkVisibility && !anyEl.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  if (!anyEl.checkVisibility) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
  }
  return true;
}

const SKIP_TEXT = "script,style,noscript,template,svg,select,option,textarea,input,button";

/** Visible-ish text of a node, excluding form controls and anything matching `exclude`. */
export function textOf(node: Node | null, exclude?: string, max = 200): string {
  if (!node) return "";
  const parts: string[] = [];
  let len = 0;
  const skip = exclude ? `${SKIP_TEXT},${exclude}` : SKIP_TEXT;
  const tw = (node.ownerDocument ?? document).createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t && len < max; t = tw.nextNode()) {
    const c = t.parentElement?.closest(skip);
    if (c && c !== node && node.contains(c)) continue;
    const s = t.nodeValue?.trim();
    if (s) {
      parts.push(s);
      len += s.length;
    }
  }
  return clean(parts.join(" "), max);
}

export function byIdInRoot(el: Element, id: string): Element | null {
  const root = el.getRootNode() as Root;
  return (root as Document).getElementById?.(id) ?? root.querySelector?.(`#${CSS.escape(id)}`) ?? document.getElementById(id);
}

export function xpathOf(el: Element): string {
  const parts: string[] = [];
  for (let n: Element | null = el; n && n.nodeType === 1 && parts.length < 12; n = n.parentElement) {
    let i = 1;
    for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.localName === n.localName) i++;
    parts.unshift(`${n.localName}[${i}]`);
  }
  return `/${parts.join("/")}`;
}

export function cssPath(el: Element): string {
  const parts: string[] = [];
  for (let n: Element | null = el; n && parts.length < 5; n = n.parentElement) {
    let p = n.localName;
    if (n.id && !/\d{3,}/.test(n.id)) {
      parts.unshift(`${p}#${n.id}`);
      break;
    }
    const cls = [...n.classList].filter((c) => c.length < 25 && !/\d/.test(c)).slice(0, 2);
    if (cls.length) p += `.${cls.join(".")}`;
    parts.unshift(p);
  }
  return parts.join(" > ");
}

const HEADING_SEL = "h1,h2,h3,h4,h5,h6,legend,[role=heading]";

export function collectHeadings(roots: Root[]): Element[] {
  return queryAll(roots, HEADING_SEL).filter((h) => (h.textContent ?? "").trim().length > 0);
}

/** Nearest heading before `el` in document order (same root). */
export function sectionOf(el: Element, headings: Element[]): string {
  let best: Element | null = null;
  const root = el.getRootNode();
  for (const h of headings) {
    if (h.getRootNode() !== root && root !== document) continue;
    const pos = h.compareDocumentPosition(el);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING || pos & Node.DOCUMENT_POSITION_CONTAINED_BY) best = h;
  }
  return best ? clean(best.textContent, 60) : "";
}

export function scrollIntoViewIfNeeded(el: Element) {
  const r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" as ScrollBehavior });
  }
}
