import type { ElementContext } from "@otto/shared";
import { cssPath, rectOf } from "./dom";
import { register } from "./registry";
import { clean } from "./util";

let host: HTMLElement | null = null;
let current: Element | null = null;
let stack: Element[] = [];
let cleanup: (() => void) | null = null;

function deepest(x: number, y: number): Element | null {
  let el = document.elementFromPoint(x, y);
  while (el?.shadowRoot) {
    const inner = el.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === el) break;
    el = inner;
  }
  return el;
}

function trimHtml(el: Element) {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll("script,style,svg,noscript,iframe").forEach((n) => n.remove());
  copy.querySelectorAll("*").forEach((n) => {
    for (const a of [...n.attributes]) if (a.name === "style" || a.name.startsWith("on") || a.value.length > 120) n.removeAttribute(a.name);
  });
  const html = copy.outerHTML.replace(/\s+/g, " ");
  return html.length > 6000 ? `${html.slice(0, 6000)}…` : html;
}

function headingsAbove(el: Element) {
  const out: string[] = [];
  for (const h of document.querySelectorAll("h1,h2,h3,h4,legend")) {
    if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING || h.contains(el)) out.push(clean(h.textContent, 80));
  }
  return out.slice(-3);
}

export function contextOf(el: Element): ElementContext {
  return {
    ref: register(el, el),
    frameId: 0,
    tag: el.localName,
    text: clean((el as HTMLElement).innerText ?? el.textContent, 3000),
    html: trimHtml(el),
    path: cssPath(el),
    headings: headingsAbove(el),
    rect: rectOf(el),
  };
}

export function startPicker(onPick: (c: ElementContext) => void, onCancel: () => void) {
  stopPicker();
  host = document.createElement("otto-picker");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
  const shadow = host.attachShadow({ mode: "closed" });
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;border:1.5px solid #0a0a0a;background:rgba(10,10,10,.08);border-radius:4px;transition:all 60ms;pointer-events:none;box-shadow:0 0 0 1px #fafafa";
  const tag = document.createElement("div");
  tag.style.cssText = "position:fixed;font:500 11px/1 ui-monospace,monospace;background:#0a0a0a;color:#fafafa;padding:4px 6px;border-radius:4px;pointer-events:none;white-space:nowrap";
  shadow.append(box, tag);
  document.documentElement.appendChild(host);

  const paint = () => {
    if (!current) return;
    const r = current.getBoundingClientRect();
    Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    tag.textContent = `${current.localName}${current.id ? `#${current.id}` : ""} · ${Math.round(r.width)}×${Math.round(r.height)}`;
    Object.assign(tag.style, { left: `${Math.max(4, r.left)}px`, top: `${Math.max(4, r.top - 22)}px` });
  };
  const move = (ev: PointerEvent) => {
    const el = deepest(ev.clientX, ev.clientY);
    if (el && el !== host && el !== current) {
      current = el;
      stack = [];
      paint();
    }
  };
  const click = (ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    const el = current;
    stopPicker();
    if (el) onPick(contextOf(el));
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      stopPicker();
      onCancel();
    } else if (ev.altKey && ev.key === "ArrowUp" && current?.parentElement && current.parentElement !== document.documentElement) {
      stack.push(current);
      current = current.parentElement;
      paint();
      ev.preventDefault();
    } else if (ev.altKey && ev.key === "ArrowDown" && stack.length) {
      current = stack.pop()!;
      paint();
      ev.preventDefault();
    }
  };
  const block = (ev: Event) => {
    ev.preventDefault();
    ev.stopPropagation();
  };
  addEventListener("pointermove", move, { capture: true, passive: true });
  addEventListener("click", click, true);
  addEventListener("mousedown", block, true);
  addEventListener("pointerdown", block, true);
  addEventListener("keydown", key, true);
  addEventListener("scroll", paint, true);
  cleanup = () => {
    removeEventListener("pointermove", move, true);
    removeEventListener("click", click, true);
    removeEventListener("mousedown", block, true);
    removeEventListener("pointerdown", block, true);
    removeEventListener("keydown", key, true);
    removeEventListener("scroll", paint, true);
  };
}

export function stopPicker() {
  cleanup?.();
  cleanup = null;
  host?.remove();
  host = null;
  current = null;
}
