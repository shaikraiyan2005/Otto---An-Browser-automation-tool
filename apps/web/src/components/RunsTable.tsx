import Link from "next/link";
import { Dot, Empty } from "./Shell";

export interface RunRow {
  id: string;
  kind: string;
  url: string;
  caseId: string | null;
  fieldsFound: number;
  filled: number;
  verified: number;
  failed: number;
  healed: number;
  llmCalls: number;
  msTotal: number;
  createdAt: Date | string;
}

const host = (u: string) => {
  try {
    const x = new URL(u);
    return x.host + x.pathname;
  } catch {
    return u;
  }
};

export function RunsTable({ runs }: { runs: RunRow[] }) {
  if (!runs.length) return <Empty />;
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="th">Time</th>
          <th className="th">Kind</th>
          <th className="th">Page</th>
          <th className="th text-right">Fields</th>
          <th className="th text-right">Verified</th>
          <th className="th text-right">Failed</th>
          <th className="th text-right">Healed</th>
          <th className="th text-right">AI</th>
          <th className="th text-right">ms</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id} className="hover:bg-surface-2">
            <td className="td font-mono text-xs text-muted">
              <Link href={`/runs/${r.id}`}>{new Date(r.createdAt).toLocaleString()}</Link>
            </td>
            <td className="td">
              <span className="flex items-center gap-2">
                <Dot tone={r.failed ? "bad" : r.kind === "replay" ? "muted" : "ok"} />
                {r.kind}
              </span>
            </td>
            <td className="td max-w-80 truncate">
              <Link href={`/runs/${r.id}`}>{r.caseId ?? host(r.url)}</Link>
            </td>
            <td className="td text-right font-mono">{r.fieldsFound}</td>
            <td className="td text-right font-mono">{r.verified}</td>
            <td className="td text-right font-mono">{r.failed}</td>
            <td className="td text-right font-mono">{r.healed}</td>
            <td className="td text-right font-mono">{r.llmCalls}</td>
            <td className="td text-right font-mono">{r.msTotal}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
