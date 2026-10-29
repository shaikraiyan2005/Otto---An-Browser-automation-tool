import type { PageSummary } from "@otto/shared";
import { useState } from "react";
import { api } from "@/lib/api";
import { send } from "@/lib/tab";
import type { Ctx } from "./App";
import { Err, Spinner } from "./ui";

export function PageTab({ ctx }: { ctx: Ctx }) {
  const [summary, setSummary] = useState<PageSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  async function summarize() {
    setBusy(true);
    setError("");
    const t0 = performance.now();
    try {
      const page = await send(ctx.tabId, 0, { type: "otto:text" });
      const { summary: s, usage } = await api.summarize(page);
      setSummary(s);
      ctx.log({ at: Date.now(), kind: "summary", label: page.title, ms: performance.now() - t0, ai: 1, ok: true });
      api
        .run({
          kind: "summarize",
          url: page.url,
          origin: new URL(page.url).origin,
          model: usage.model,
          fieldsFound: 0,
          filled: 0,
          verified: 0,
          failed: 0,
          skipped: 0,
          llmCalls: 1,
          tokensIn: usage.tokensIn,
          tokensOut: usage.tokensOut,
          cacheRead: usage.cacheRead,
          healed: 0,
          timings: { scan: 0, match: 0, ai: usage.ms, fill: 0, total: performance.now() - t0 },
          details: { summary: s },
        })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  async function ask() {
    if (!q.trim()) return;
    setBusy(true);
    setError("");
    try {
      const page = await send(ctx.tabId, 0, { type: "otto:text" });
      const r = await api.ask({ prompt: q, page: { url: page.url, title: page.title, text: page.text.slice(0, 20000) }, element: null, fields: [], clickables: [], profile: {} });
      setAnswer(r.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-3">
      <button className="btn-primary" onClick={summarize} disabled={busy}>
        {busy && !q ? <Spinner /> : null}
        Summarize
      </button>
      {error && <Err>{error}</Err>}
      {summary && (
        <article className="grid gap-3 rounded-xl border border-line bg-surface p-3">
          <p className="text-[13px] font-medium leading-snug">{summary.purpose}</p>
          <ul className="grid gap-1.5">
            {summary.keyPoints.map((k) => (
              <li key={k} className="flex gap-2 text-[12.5px] leading-snug">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-fg" />
                {k}
              </li>
            ))}
          </ul>
          {summary.actions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {summary.actions.map((a) => (
                <span key={a} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px]">
                  {a}
                </span>
              ))}
            </div>
          )}
          {summary.risks.length > 0 && (
            <ul className="grid gap-1 border-t border-line pt-2">
              {summary.risks.map((r) => (
                <li key={r} className="text-[12px] text-bad">
                  {r}
                </li>
              ))}
            </ul>
          )}
          <div className="font-mono text-[10px] text-muted">{summary.readingTimeMin} min</div>
        </article>
      )}
      <div className="flex gap-2">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask about this page" />
        <button className="btn" onClick={ask} disabled={busy || !q.trim()}>
          {busy && q ? <Spinner /> : "↵"}
        </button>
      </div>
      {answer && <div className="whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[12.5px] leading-relaxed">{answer}</div>}
    </div>
  );
}
