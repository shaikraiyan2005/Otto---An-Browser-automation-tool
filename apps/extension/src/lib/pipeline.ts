import { buildSteps, fieldLine, formatFor, formSignature, matchByRules, normalizeAddress, resolveSteps } from "@otto/core";
import type { FieldDescriptor, FillResult, Mapping, Profile, Recipe, RunReport, Settings } from "@otto/shared";
import { api } from "./api";
import { fillTab, scanTab } from "./tab";

export interface Plan {
  tabId: number;
  url: string;
  title: string;
  caseId?: string;
  fields: FieldDescriptor[];
  mappings: Mapping[];
  recipe: Recipe | null;
  healed: number;
  broken: number;
  llmCalls: number;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  model: string | null;
  t: { scan: number; match: number; ai: number };
  aiError?: string;
}

const now = () => performance.now();

async function attachFiles(fields: FieldDescriptor[], mappings: Mapping[]) {
  for (const m of mappings) {
    const f = fields.find((x) => x.ref === m.ref);
    if (f?.kind === "file" && m.enabled && m.value && !m.file) {
      try {
        m.file = await api.file(m.value);
      } catch {
        m.enabled = false;
        m.reason = "file not found";
      }
    }
  }
}

function fromRecipe(recipe: Recipe, fields: FieldDescriptor[], profile: Profile) {
  const res = resolveSteps(recipe.steps, fields);
  const mappings: Mapping[] = [];
  let healed = 0;
  let broken = 0;
  for (const r of res) {
    if (r.status === "broken") {
      broken++;
      continue;
    }
    const step = recipe.steps[r.stepIndex];
    const f = fields.find((x) => x.ref === r.ref)!;
    const raw = step.key ? profile[step.key] : step.value;
    if (raw == null) {
      broken++;
      continue;
    }
    const value = step.key ? formatFor(f, step.key, raw) : raw;
    if (value == null) {
      broken++;
      continue;
    }
    if (r.status === "healed") healed++;
    mappings.push({
      ref: r.ref,
      source: "recipe",
      key: step.key ?? null,
      value,
      confidence: r.score,
      reason: r.status === "healed" ? `recipe · re-located (${r.score})` : "recipe",
      enabled: true,
    });
  }
  return { mappings, healed, broken };
}

/** Scan → recipe → rules → AI (leftovers only, one call). */
export async function plan(tabId: number, profile: Profile, settings: Settings, only?: Set<string>): Promise<Plan> {
  const t0 = now();
  const scanned = await scanTab(tabId);
  const t1 = now();
  const fields = only ? scanned.fields.filter((f) => !only.has(f.fieldSig + f.label)) : scanned.fields;
  const origin = new URL(scanned.url).origin;
  const path = new URL(scanned.url).pathname;

  let recipe: Recipe | null = null;
  let mappings: Mapping[] = [];
  let healed = 0;
  let broken = 0;
  if (!only) {
    try {
      const { exact, candidates } = await api.lookup(origin, path, formSignature(origin, fields));
      const pool = exact ? [exact] : candidates;
      let best: ReturnType<typeof fromRecipe> | null = null;
      for (const r of pool) {
        const res = fromRecipe(r, fields, profile);
        if (res.mappings.length >= r.steps.length * 0.5 && (!best || res.mappings.length > best.mappings.length)) {
          best = res;
          recipe = r;
        }
      }
      if (best) ({ mappings, healed, broken } = best);
    } catch {}
  }

  const taken = new Set(mappings.map((m) => m.ref));
  const rest = fields.filter((f) => !taken.has(f.ref));
  const rules = matchByRules(rest, profile);
  mappings.push(...rules.mappings);
  const t2 = now();

  const p: Plan = {
    tabId,
    url: scanned.url,
    title: scanned.title,
    caseId: scanned.caseId,
    fields,
    mappings,
    recipe,
    healed,
    broken,
    llmCalls: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheRead: 0,
    model: null,
    t: { scan: t1 - t0 + scanned.ms * 0, match: t2 - t1, ai: 0 },
  };

  const leftovers = rules.leftovers.filter((f) => f.kind !== "file");
  if (leftovers.length) {
    const ta = now();
    try {
      const { mappings: ai, usage } = await api.map({
        page: { url: scanned.url, title: scanned.title },
        fields: leftovers.map((f) => ({ ref: f.ref, line: fieldLine(f) })),
        profile: {},
        allowGenerate: settings.allowGenerate,
      });
      p.llmCalls = 1;
      if (usage) {
        p.tokensIn = usage.tokensIn;
        p.tokensOut = usage.tokensOut;
        p.cacheRead = usage.cacheRead;
        p.model = usage.model;
      }
      for (const m of ai) {
        const f = leftovers.find((x) => x.ref === m.ref);
        if (!f || m.source === "skip") continue;
        const value = m.source === "profile" && m.key && profile[m.key] != null ? (formatFor(f, m.key, profile[m.key]) ?? m.value) : m.value;
        if (!value) continue;
        p.mappings.push({
          ref: m.ref,
          source: m.source === "generated" ? "generated" : "ai",
          key: m.key,
          value,
          confidence: m.confidence,
          reason: m.reason,
          enabled: m.confidence >= settings.confidenceAutofill,
        });
      }
    } catch (e) {
      p.aiError = e instanceof Error ? e.message : String(e);
    }
    p.t.ai = now() - ta;
  }
  normalizeAddress(p.mappings, profile);
  await attachFiles(fields, p.mappings);
  const order = new Map(fields.map((f, i) => [f.ref, i]));
  p.mappings.sort((a, b) => (order.get(a.ref) ?? 0) - (order.get(b.ref) ?? 0));
  return p;
}

export interface Outcome {
  results: FillResult[];
  report: RunReport;
  runId?: string;
  savedRecipe?: boolean;
}

export async function execute(p: Plan, settings: Settings, onPlan?: (p: Plan) => void): Promise<Outcome> {
  const t0 = now();
  let results = await fillTab(p.tabId, p.mappings.filter((m) => m.enabled));

  // new fields can appear after filling (conditional questions, revealed sections)
  const seen = new Set(p.fields.map((f) => f.fieldSig + f.label));
  for (let round = 0; round < 2; round++) {
    const profile = (await api.profile()).profile;
    const extra = await plan(p.tabId, profile, settings, seen);
    const fresh = extra.mappings.filter((m) => m.enabled && m.source !== "skip");
    if (!fresh.length) break;
    extra.fields.forEach((f) => seen.add(f.fieldSig + f.label));
    p.fields.push(...extra.fields);
    p.mappings.push(...extra.mappings);
    p.llmCalls += extra.llmCalls;
    p.tokensIn += extra.tokensIn;
    p.tokensOut += extra.tokensOut;
    p.t.ai += extra.t.ai;
    onPlan?.(p);
    results = results.concat(await fillTab(p.tabId, fresh));
  }
  const tFill = now() - t0;

  const verified = new Set(results.filter((r) => r.status === "verified").map((r) => r.ref));
  const label = new Map(p.fields.map((f) => [f.ref, f.label]));
  const report: RunReport = {
    kind: p.recipe ? "replay" : "fill",
    url: p.url,
    origin: new URL(p.url).origin,
    caseId: p.caseId ?? null,
    model: p.model,
    fieldsFound: p.fields.filter((f) => !f.trap).length,
    filled: results.filter((r) => r.status === "verified" || r.status === "filled").length,
    verified: verified.size,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: p.mappings.filter((m) => !m.enabled || m.source === "skip").length,
    llmCalls: p.llmCalls,
    tokensIn: p.tokensIn,
    tokensOut: p.tokensOut,
    cacheRead: p.cacheRead,
    recipeId: p.recipe?.id ?? null,
    healed: p.healed,
    timings: { scan: p.t.scan, match: p.t.match, ai: p.t.ai, fill: tFill, total: p.t.scan + p.t.match + p.t.ai + tFill },
    details: {
      engine: "0.1.0",
      broken: p.broken,
      aiError: p.aiError,
      fields: p.mappings.map((m) => {
        const r = results.find((x) => x.ref === m.ref);
        return {
          ref: m.ref,
          label: label.get(m.ref) ?? "",
          source: m.source,
          key: m.key,
          value: m.file ? m.file.name : m.value.slice(0, 120),
          status: r?.status ?? (m.enabled ? "pending" : "skipped"),
          rung: r?.rung ?? 0,
          ms: r?.ms ?? 0,
          error: r?.error ?? m.reason,
          readBack: r?.readBack,
        };
      }),
    },
  };

  const out: Outcome = { results, report };
  try {
    out.runId = (await api.run(report)).id;
  } catch {}

  if (settings.autoSaveRecipes && verified.size) {
    const origin = new URL(p.url).origin;
    const steps = buildSteps(p.fields, p.mappings, verified);
    const base = p.recipe;
    try {
      await api.saveRecipe({
        id: base?.id,
        origin,
        path: new URL(p.url).pathname,
        formSig: formSignature(origin, p.fields),
        title: p.title || origin,
        steps,
        stats: { runs: (base?.stats.runs ?? 0) + 1, healed: (base?.stats.healed ?? 0) + p.healed, lastRunAt: Date.now() },
      });
      out.savedRecipe = true;
    } catch {}
  }
  return out;
}
