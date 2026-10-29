import type { FieldDescriptor, Fingerprint, Mapping, RecipeStep, StepResolution } from "@otto/shared";
import { ruleKey } from "./match";
import { hash, jaccard, norm, similarity } from "./util";

export function formSignature(origin: string, fields: FieldDescriptor[]) {
  const names = fields.filter((f) => !f.trap).map((f) => norm(f.name || f.label).replace(/\d{5,}/g, ""));
  return hash(`${origin}|${names.join("&")}`);
}

export function buildSteps(fields: FieldDescriptor[], mappings: Mapping[], verified: Set<string>): RecipeStep[] {
  const byRef = new Map(fields.map((f) => [f.ref, f]));
  return mappings
    .filter((m) => m.enabled && m.source !== "skip" && verified.has(m.ref) && byRef.has(m.ref))
    .map((m) => {
      const f = byRef.get(m.ref)!;
      return {
        key: m.key ?? null,
        value: m.key ? undefined : m.value,
        source: m.source,
        widget: f.widget,
        kind: f.kind,
        fieldSig: f.fieldSig,
        label: f.label,
        fp: f.fp,
      };
    });
}

/** Similo-style weighted similarity between a stored fingerprint and a live one (0..1). */
export function fpScore(a: Fingerprint, b: Fingerprint): number {
  let sum = 0;
  let wsum = 0;
  const add = (w: number, s: number | null) => {
    if (s === null) return;
    sum += w * s;
    wsum += w;
  };
  const both = (x: string, y: string) => (x || y ? similarity(x, y) : null);
  add(2.8, both(a.label, b.label));
  add(2.8, both(a.name, b.name));
  add(2.7, a.tag === b.tag && a.type === b.type ? 1 : 0);
  add(2.0, a.autocomplete || b.autocomplete ? (a.autocomplete === b.autocomplete ? 1 : 0) : null);
  add(1.5, a.neighborText.length || b.neighborText.length ? jaccard(a.neighborText, b.neighborText) : null);
  add(1.4, both(a.section, b.section));
  add(1.0, both(a.placeholder, b.placeholder));
  add(1.0, both(a.ariaLabel, b.ariaLabel));
  add(1.2, Math.max(0, 1 - Math.hypot(a.rect.x - b.rect.x, a.rect.y - b.rect.y) / 800));
  add(0.5, both(a.id, b.id));
  add(0.2, similarity(a.xpath, b.xpath));
  return wsum ? sum / wsum : 0;
}

/**
 * Resolve every recipe step against the live fields.
 * ok      = same field signature and label
 * healed  = found again by its profile key (rules) or by fingerprint similarity
 * broken  = needs AI (or the user)
 */
export function resolveSteps(steps: RecipeStep[], fields: FieldDescriptor[], threshold = 0.62, margin = 0.06): StepResolution[] {
  const live = fields.filter((f) => !f.trap && !f.blocked);
  const used = new Set<string>();
  const out: StepResolution[] = [];

  steps.forEach((s, stepIndex) => {
    const exact = live.filter((f) => !used.has(f.ref) && f.fieldSig === s.fieldSig && f.widget === s.widget && norm(f.label) === norm(s.label));
    if (exact.length === 1) {
      used.add(exact[0].ref);
      out.push({ stepIndex, status: "ok", ref: exact[0].ref, score: 1 });
      return;
    }
    if (s.key) {
      const byKey = live.filter((f) => !used.has(f.ref) && ruleKey(f)?.key === s.key);
      if (byKey.length === 1) {
        used.add(byKey[0].ref);
        out.push({ stepIndex, status: "healed", ref: byKey[0].ref, score: 0.9 });
        return;
      }
    }
    const scored = live
      .filter((f) => !used.has(f.ref) && f.kind === s.kind)
      .map((f) => ({ f, score: fpScore(s.fp, f.fp) }))
      .sort((a, b) => b.score - a.score);
    const [best, second] = scored;
    if (best && best.score >= threshold && (!second || best.score - second.score >= margin)) {
      used.add(best.f.ref);
      out.push({ stepIndex, status: "healed", ref: best.f.ref, score: Number(best.score.toFixed(3)) });
      return;
    }
    out.push({ stepIndex, status: "broken", score: best ? Number(best.score.toFixed(3)) : 0 });
  });
  return out;
}
