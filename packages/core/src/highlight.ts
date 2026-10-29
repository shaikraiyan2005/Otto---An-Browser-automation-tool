import { lookup } from "./registry";

let host: HTMLElement | null = null;
let layer: HTMLElement | null = null;
let raf = 0;
let tracked: { ref: string; tone: string }[] = [];

const TONE: Record<string, string> = {
  pending: "#0a0a0a",
  verified: "#16a34a",
  failed: "#dc2626",
  skipped: "#a3a3a3",
  focus: "#0a0a0a",
};

function ensure() {
  if (host?.isConnected) return;
  host = document.createElement("otto-highlight");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646";
  const shadow = host.attachShadow({ mode: "closed" });
  layer = document.createElement("div");
  shadow.appendChild(layer);
  document.documentElement.appendChild(host);
}

function paint() {
  if (!layer) return;
  layer.replaceChildren(
    ...tracked.flatMap(({ ref, tone }) => {
      const e = lookup(ref);
      if (!e?.root.isConnected) return [];
      const r = e.root.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return [];
      const d = document.createElement("div");
      const c = TONE[tone] ?? TONE.pending;
      d.style.cssText = `position:fixed;left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;border:1.5px solid ${c};border-radius:6px;box-shadow:0 0 0 2px rgba(250,250,250,.7)${tone === "focus" ? ";background:rgba(10,10,10,.06)" : ""}`;
      return [d];
    }),
  );
  raf = requestAnimationFrame(paint);
}

export function highlight(items: { ref: string; tone: string }[]) {
  tracked = items;
  ensure();
  cancelAnimationFrame(raf);
  paint();
}

export function clearHighlight() {
  cancelAnimationFrame(raf);
  tracked = [];
  host?.remove();
  host = null;
  layer = null;
}
