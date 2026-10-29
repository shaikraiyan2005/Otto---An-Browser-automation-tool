/** Per-frame element registry. Refs are small counters; nothing is written into the page DOM. */
export interface Entry {
  el: Element;
  /** visible root of the widget (trigger, container) */
  root: Element;
  /** for radio groups */
  group?: HTMLInputElement[];
}

let seq = 0;
const byRef = new Map<string, Entry>();
const byEl = new WeakMap<Element, string>();

export function register(el: Element, root: Element, group?: HTMLInputElement[]): string {
  const existing = byEl.get(el);
  if (existing && byRef.get(existing)?.el === el) {
    byRef.set(existing, { el, root, group });
    return existing;
  }
  const ref = String(++seq);
  byRef.set(ref, { el, root, group });
  byEl.set(el, ref);
  return ref;
}

export const lookup = (ref: string) => byRef.get(ref);

export function refOf(el: Element) {
  return byEl.get(el);
}

export function prune() {
  for (const [ref, e] of byRef) if (!e.el.isConnected) byRef.delete(ref);
}
