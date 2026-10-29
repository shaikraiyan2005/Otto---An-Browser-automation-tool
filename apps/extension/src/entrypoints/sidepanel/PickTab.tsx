import { fieldLine } from "@otto/core";
import type { AskOutput, ElementContext, EngineEvent, FillResult } from "@otto/shared";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { send } from "@/lib/tab";
import type { Ctx } from "./App";
import { Dot, Err, Spinner, statusTone } from "./ui";

const MAX_ACTIONS = 25;

export function PickTab({ ctx }: { ctx: Ctx }) {
  const [picking, setPicking] = useState(false);
  const [el, setEl] = useState<ElementContext | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<AskOutput | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<FillResult[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const on = (msg: EngineEvent) => {
      if (msg?.type === "otto:picked") {
        setEl(msg.context);
        setPicking(false);
        setOut(null);
        setDone([]);
      } else if (msg?.type === "otto:pick:cancel") setPicking(false);
    };
    browser.runtime.onMessage.addListener(on);
    return () => {
      browser.runtime.onMessage.removeListener(on);
      send(ctx.tabId, 0, { type: "otto:pick:stop" }).catch(() => {});
    };
  }, [ctx.tabId]);

  async function start() {
    setError("");
    setPicking(true);
    await send(ctx.tabId, 0, { type: "otto:pick:start" });
  }

  async function ask() {
    if (!el || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setOut(null);
    setDone([]);
    const t0 = performance.now();
    try {
      const scope = await send(ctx.tabId, 0, { type: "otto:scope", ref: el.ref });
      const page = await send(ctx.tabId, 0, { type: "otto:text" });
      const r = await api.ask({
        prompt,
        page: { url: page.url, title: page.title, text: page.text.slice(0, 6000) },
        element: { ref: el.ref, tag: el.tag, text: el.text, html: el.html, path: el.path, headings: el.headings },
        fields: scope.fields.map((f) => ({ ref: f.ref, line: fieldLine(f) })),
        clickables: scope.clickables,
        profile: {},
      });
      const actions = r.actions.slice(0, MAX_ACTIONS);
      setOut({ answer: r.answer, actions });
      setChosen(new Set(actions.map((_, i) => i).filter((i) => actions[i].op !== "click")));
      ctx.log({ at: Date.now(), kind: "ask", label: prompt, ms: performance.now() - t0, ai: 1, ok: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  async function run() {
    if (!out) return;
    const actions = out.actions.filter((_, i) => chosen.has(i));
    const values = actions
      .filter((a) => a.op !== "click")
      .map((a) => ({ ref: a.ref, source: "ai" as const, value: a.op === "check" ? String(a.value ?? "true") : (a.value ?? ""), confidence: 0.8, enabled: true }));
    setBusy(true);
    try {
      const r = await send(ctx.tabId, 0, { type: "otto:actions", actions, values });
      setDone(r.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  const status = (ref: string) => done.find((d) => d.ref === ref)?.status;

  return (
    <div className="grid gap-3">
      <button className={picking ? "btn" : "btn-primary"} onClick={picking ? () => send(ctx.tabId, 0, { type: "otto:pick:stop" }).then(() => setPicking(false)) : start}>
        {picking ? "Esc" : "Pick element"}
      </button>
      {el && (
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="font-mono text-[11px] text-muted">{el.path}</div>
          <p className="mt-1 line-clamp-4 text-[12.5px]">{el.text || `<${el.tag}>`}</p>
        </div>
      )}
      {el && (
        <div className="flex gap-2">
          <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask or instruct" />
          <button className="btn" onClick={ask} disabled={busy || !prompt.trim()}>
            {busy ? <Spinner /> : "↵"}
          </button>
        </div>
      )}
      {error && <Err>{error}</Err>}
      {out && (
        <div className="grid gap-2">
          <div className="whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[12.5px] leading-relaxed">{out.answer}</div>
          {out.actions.length > 0 && (
            <>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {out.actions.map((a, i) => (
                  <li key={`${a.ref}-${i}`} className="flex items-center gap-2 px-3 py-2">
                    <input
                      type="checkbox"
                      className="accent-current"
                      checked={chosen.has(i)}
                      onChange={(e) => {
                        const n = new Set(chosen);
                        if (e.target.checked) n.add(i);
                        else n.delete(i);
                        setChosen(n);
                      }}
                    />
                    <span className="w-12 shrink-0 font-mono text-[11px]">{a.op}</span>
                    <span className="flex-1 truncate text-[12px]" title={a.why}>
                      {a.value ?? a.why}
                    </span>
                    {status(a.ref) && <Dot tone={statusTone(status(a.ref))} />}
                  </li>
                ))}
              </ul>
              <button className="btn-primary" onClick={run} disabled={busy || chosen.size === 0}>
                Run {chosen.size}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
