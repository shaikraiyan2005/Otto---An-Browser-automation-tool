import { notFound } from "next/navigation";
import { Dot, PageTitle, Stat } from "@/components/Shell";
import { db } from "@/lib/db";

interface FieldRow {
  ref: string;
  label: string;
  source: string;
  value: string;
  status: string;
  rung: number;
  ms: number;
  error?: string;
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const run = await db.run.findUnique({ where: { id: (await params).id } });
  if (!run) notFound();
  const details = (run.details ?? {}) as { fields?: FieldRow[]; summary?: unknown; answer?: string };
  const phases = [
    ["scan", run.msScan],
    ["match", run.msMatch],
    ["ai", run.msAi],
    ["fill", run.msFill],
  ] as const;
  const sum = Math.max(1, phases.reduce((a, [, v]) => a + v, 0));

  return (
    <>
      <PageTitle>
        <span className="font-mono text-base">{run.caseId ?? run.url}</span>
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Kind" value={run.kind} />
        <Stat label="Fields" value={run.fieldsFound} />
        <Stat label="Verified" value={run.verified} />
        <Stat label="Failed" value={run.failed} />
        <Stat label="AI calls" value={run.llmCalls} />
        <Stat label="Total ms" value={run.msTotal} />
      </div>

      <div className="card mt-6 p-4">
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
          {phases.map(([k, v], i) => (
            <div key={k} style={{ width: `${(v / sum) * 100}%`, opacity: 1 - i * 0.2 }} className="bg-fg" />
          ))}
        </div>
        <div className="mt-3 flex gap-6 font-mono text-xs text-muted">
          {phases.map(([k, v]) => (
            <span key={k}>
              {k} {v}
            </span>
          ))}
          <span>
            tokens {run.tokensIn}/{run.tokensOut} · cache {run.cacheRead}
          </span>
          {run.model && <span>{run.model}</span>}
        </div>
      </div>

      {details.fields?.length ? (
        <div className="card mt-6 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Field</th>
                <th className="th">Source</th>
                <th className="th">Value</th>
                <th className="th">Status</th>
                <th className="th text-right">Rung</th>
                <th className="th text-right">ms</th>
              </tr>
            </thead>
            <tbody>
              {details.fields.map((f) => (
                <tr key={f.ref}>
                  <td className="td max-w-64 truncate">{f.label}</td>
                  <td className="td font-mono text-xs">{f.source}</td>
                  <td className="td max-w-72 truncate font-mono text-xs">{f.value}</td>
                  <td className="td">
                    <span className="flex items-center gap-2" title={f.error}>
                      <Dot tone={f.status === "verified" ? "ok" : f.status === "failed" ? "bad" : "muted"} />
                      {f.status}
                    </span>
                  </td>
                  <td className="td text-right font-mono">{f.rung}</td>
                  <td className="td text-right font-mono">{f.ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <pre className="card mt-6 overflow-auto p-4 font-mono text-xs text-muted">{JSON.stringify(run.details, null, 2)}</pre>
    </>
  );
}
