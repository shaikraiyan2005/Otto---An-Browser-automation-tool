import { apiBase } from "@/lib/api";
import { Dot } from "./ui";

export interface LogItem {
  at: number;
  kind: string;
  label: string;
  ms: number;
  ai: number;
  ok: boolean;
  runId?: string;
}

export function LogTab({ items }: { items: LogItem[] }) {
  if (!items.length) return <p className="text-muted">—</p>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {items.map((i) => (
        <li key={i.at} className="flex items-center gap-2 px-3 py-2">
          <Dot tone={i.ok ? "ok" : "bad"} />
          <span className="w-16 shrink-0 font-mono text-[11px] text-muted">{new Date(i.at).toLocaleTimeString()}</span>
          <span className="w-14 shrink-0">{i.kind}</span>
          <span className="flex-1 truncate text-muted">{i.label}</span>
          <span className="font-mono text-[11px] text-muted">
            {Math.round(i.ms)}ms · {i.ai}ai
          </span>
          {i.runId && (
            <a className="font-mono text-[11px] underline" href={`${apiBase()}/runs/${i.runId}`} target="_blank" rel="noreferrer">
              ↗
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
