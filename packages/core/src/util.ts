export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export async function yieldToMain() {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise<void>((r) => setTimeout(r, 0));
}

export const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-[\]./]+/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9@+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const clean = (s: string | null | undefined, max = 120) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export const digits = (s: string) => s.replace(/\D/g, "");

/** FNV-1a 32-bit, hex. Fast, sync, good enough for form/field signatures. */
export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export const similarity = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
};

export function jaccard(a: string[], b: string[]) {
  const A = new Set(a.flatMap((x) => norm(x).split(" ")).filter(Boolean));
  const B = new Set(b.flatMap((x) => norm(x).split(" ")).filter(Boolean));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter || 1);
}

/** Best option for a wanted value: exact → startsWith → contains → fuzzy. Returns index or -1. */
export function bestOption(options: string[], wanted: string[], min = 0.72) {
  const opts = options.map(norm);
  const wants = wanted.map(norm).filter(Boolean);
  for (const w of wants) {
    const i = opts.indexOf(w);
    if (i >= 0) return i;
  }
  for (const w of wants) {
    const i = opts.findIndex((o) => o.startsWith(w) || (o.length > 2 && w.startsWith(o)));
    if (i >= 0) return i;
  }
  for (const w of wants) {
    if (w.length < 3) continue;
    const i = opts.findIndex((o) => o.includes(w));
    if (i >= 0) return i;
  }
  let best = -1;
  let score = min;
  opts.forEach((o, i) => {
    for (const w of wants) {
      const s = similarity(o, w);
      if (s > score) {
        score = s;
        best = i;
      }
    }
  });
  return best;
}

export const isHashy = (token: string) =>
  /^(css|sc|jsx|emotion|tw|svelte)-/.test(token) || (/\d/.test(token) && /[a-z]/i.test(token) && token.length >= 6) || token.length > 30;
