import type { FillResult, Mapping } from "@otto/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { execute, type Outcome, type Plan, plan } from "@/lib/pipeline";
import { highlightTab } from "@/lib/tab";
import type { Ctx } from "./App";
import { Bar, Dot, Err, Spinner, statusTone } from "./ui";

type Phase = "idle" | "planning" | "review" | "filling" | "done";

declare global {
  interface Window {
    __ottoTest?: { fillAll: () => Promise<unknown> };
  }
}

export function FillTab({ ctx }: { ctx: Ctx }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [p, setP] = useState<Plan | null>(null);
  const [results, setResults] = useState<Record<string, FillResult>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState("");
  const planRef = useRef<Plan | null>(null);

  async function scan() {
    setError("");
    setResults({});
    setOutcome(null);
    setPhase("planning");
    try {
      const [{ profile }, settings] = await Promise.all([api.profile(), api.settings()]);
      const next = await plan(ctx.tabId, profile, settings);
      planRef.current = next;
      setP(next);
      setPhase("review");
      highlightTab(ctx.tabId, next.mappings.filter((m) => m.enabled).map((m) => m.ref));
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
      return null;
    }
  }

  async function fill(given?: Plan) {
    const cur = given ?? planRef.current;
    if (!cur) return null;
    setPhase("filling");
    try {
      const settings = await api.settings();
      const out = await execute(cur, settings, (np) => setP({ ...np }));
      setResults(Object.fromEntries(out.results.map((r) => [r.ref, r])));
      setOutcome(out);
      setPhase("done");
      ctx.log({ at: Date.now(), kind: out.report.kind, label: cur.caseId ?? cur.title, ms: out.report.timings.total, ai: out.report.llmCalls, ok: out.report.failed === 0, runId: out.runId });
      return out;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("review");
      return null;
    }
  }

  useEffect(() => {
    window.__ottoTest = {
      fillAll: async () => {
        const pl = await scan();
        if (!pl) return { error: "scan failed" };
        const out = await fill(pl);
        return out ? { report: out.report, runId: out.runId } : { error: "fill failed" };
      },
    };
    return () => {
      window.__ottoTest = undefined;
    };
  });

  const update = (ref: string, patch: Partial<Mapping>) => {
    if (!planRef.current) return;
    planRef.current = { ...planRef.current, mappings: planRef.current.mappings.map((m) => (m.ref === ref ? { ...m, ...patch } : m)) };
    setP(planRef.current);
  };

  const label = (ref: string) => p?.fields.find((f) => f.ref === ref)?.label || "—";
  const enabled = p?.mappings.filter((m) => m.enabled && m.source !== "skip").length ?? 0;
  const counts = outcome?.report;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={scan} disabled={phase === "planning" || phase === "filling"}>
          {phase === "planning" ? <Spinner /> : null}
          Scan
        </button>
        <button className="btn-primary flex-1" onClick={() => fill()} disabled={!p || phase !== "review" || !enabled}>
          {phase === "filling" ? <Spinner /> : null}
          Fill {enabled || ""}
        </button>
      </div>

      {p && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
          <span>{p.fields.length} fields</span>
          {p.recipe && <span>recipe{p.healed ? ` · ${p.healed} healed` : ""}</span>}
          <span>{p.llmCalls} ai</span>
          <span>scan {Math.round(p.t.scan)}ms</span>
          {p.t.ai > 0 && <span>ai {Math.round(p.t.ai)}ms</span>}
        </div>
      )}

      {p?.aiError && <Err>{p.aiError}</Err>}
      {error && <Err>{error}</Err>}

      {p && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {p.mappings.map((m) => {
            const r = results[m.ref];
            const skip = m.source === "skip";
            return (
              <li
                key={m.ref}
                className={`grid grid-cols-[16px_1fr] gap-2 px-3 py-2 ${skip ? "opacity-50" : ""}`}
                onMouseEnter={() => highlightTab(ctx.tabId, [m.ref])}
                onMouseLeave={() => highlightTab(ctx.tabId, p.mappings.filter((x) => x.enabled).map((x) => x.ref), Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.status])))}
              >
                <input type="checkbox" className="mt-1 accent-current" checked={m.enabled} disabled={skip || phase === "filling"} onChange={(e) => update(m.ref, { enabled: e.target.checked })} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12px] text-muted" title={m.reason}>
                      {label(m.ref)}
                    </span>
                    <span className="ml-auto shrink-0 rounded bg-surface-2 px-1 font-mono text-[10px] text-muted">{m.source}</span>
                    {!skip && <Bar value={m.confidence} />}
                    {r && (
                      <span title={r.error}>
                        <Dot tone={statusTone(r.status)} />
                      </span>
                    )}
                  </div>
                  {skip ? (
                    <div className="font-mono text-[11px] text-muted">{m.reason}</div>
                  ) : m.file ? (
                    <div className="truncate font-mono text-[12px]">{m.file.name}</div>
                  ) : (
                    <input className="input mt-1 font-mono text-[12px]" value={m.value} disabled={phase === "filling"} onChange={(e) => update(m.ref, { value: e.target.value, source: "user" })} />
                  )}
                  {r?.status === "failed" && <div className="mt-0.5 truncate font-mono text-[10px] text-bad">{r.error}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {counts && (
        <div className="flex flex-wrap gap-x-3 font-mono text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Dot tone="ok" />
            {counts.verified}
          </span>
          <span className="flex items-center gap-1">
            <Dot tone="bad" />
            {counts.failed}
          </span>
          <span>{Math.round(counts.timings.total)}ms</span>
          {outcome?.savedRecipe && <span>recipe saved</span>}
        </div>
      )}
    </div>
  );
}
