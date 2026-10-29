import { RunsTable } from "@/components/RunsTable";
import { Dot, PageTitle, Stat } from "@/components/Shell";
import { hasCredentials } from "@/lib/ai";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/store";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export default async function Overview() {
  const [runs, scores, recipes, settings] = await Promise.all([
    db.run.findMany({ orderBy: { createdAt: "desc" }, take: 300, omit: { details: true } }),
    db.score.findMany({ orderBy: { createdAt: "desc" }, take: 500, omit: { details: true } }),
    db.recipe.count(),
    getSettings(),
  ]);

  const latest = new Map<string, (typeof scores)[number]>();
  for (const s of scores) if (!latest.has(s.caseId)) latest.set(s.caseId, s);
  const ls = [...latest.values()];
  const correct = ls.reduce((a, s) => a + s.correct, 0);
  const total = ls.reduce((a, s) => a + s.total, 0);
  const traps = ls.reduce((a, s) => a + s.trapViolations, 0);

  const fills = runs.filter((r) => r.kind === "fill" || r.kind === "replay");
  const replays = fills.filter((r) => r.kind === "replay");

  return (
    <>
      <PageTitle
        right={
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Dot tone="ok" />
              db
            </span>
            <span className="flex items-center gap-1.5">
              <Dot tone={hasCredentials(settings.model) ? "ok" : "bad"} />
              {settings.model}
            </span>
          </div>
        }
      >
        Overview
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Field accuracy" value={total ? pct(correct / total) : "—"} />
        <Stat label="Trap fills" value={ls.length ? traps : "—"} />
        <Stat label="AI calls / form" value={fills.length ? avg(fills.map((r) => r.llmCalls)).toFixed(2) : "—"} />
        <Stat label="Avg fill ms" value={fills.length ? Math.round(avg(fills.map((r) => r.msTotal))) : "—"} />
        <Stat label="Replay share" value={fills.length ? pct(replays.length / fills.length) : "—"} />
        <Stat label="Recipes" value={recipes} />
      </div>
      <div className="card mt-6 overflow-hidden">
        <RunsTable runs={runs.slice(0, 25)} />
      </div>
    </>
  );
}
