import Link from "next/link";
import { Dot, PageTitle } from "@/components/Shell";
import { db } from "@/lib/db";
import { CASES } from "@/playground/cases";

export default async function PlaygroundIndex() {
  const scores = await db.score.findMany({ orderBy: { createdAt: "desc" }, take: 500, omit: { details: true } });
  const latest = new Map<string, (typeof scores)[number]>();
  for (const s of scores) if (!latest.has(s.caseId)) latest.set(s.caseId, s);

  return (
    <>
      <PageTitle>Playground</PageTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CASES.map((c) => {
          const s = latest.get(c.id);
          const ok = s && s.correct === s.total && s.trapViolations === 0;
          return (
            <Link key={c.id} href={c.href} target="_blank" className="card group flex flex-col gap-3 p-4 hover:border-fg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.title}</span>
                {c.scored && (
                  <span className="flex items-center gap-2 font-mono text-xs">
                    <Dot tone={!s ? "muted" : ok ? "ok" : s.trapViolations ? "bad" : "warn"} />
                    {s ? `${s.correct}/${s.total}` : `—/${Object.keys(c.expected).length}`}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {c.stack.map((t) => (
                  <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
