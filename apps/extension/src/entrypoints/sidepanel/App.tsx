import { useCallback, useEffect, useState } from "react";
import { type Health, api, loadBase } from "@/lib/api";
import { activeTab, clearTab, isRestricted } from "@/lib/tab";
import { FillTab } from "./FillTab";
import { LogTab, type LogItem } from "./LogTab";
import { PageTab } from "./PageTab";
import { PickTab } from "./PickTab";
import { Dot, Mark } from "./ui";

const TABS = ["Fill", "Page", "Pick", "Log"] as const;
type Tab = (typeof TABS)[number];

export interface Ctx {
  tabId: number;
  url: string;
  log: (item: LogItem) => void;
}

export function App() {
  const [tab, setTab] = useState<Tab>("Fill");
  const [health, setHealth] = useState<Health | null | "down">(null);
  const [current, setCurrent] = useState<{ id: number; url: string } | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);

  const refreshTab = useCallback(async () => {
    // test hook: sidepanel.html?target=<url fragment> pins the panel to a specific tab
    const target = new URLSearchParams(location.search).get("target");
    const t = target ? (await browser.tabs.query({})).find((x) => x.url?.includes(target)) : await activeTab();
    if (t?.id != null) setCurrent({ id: t.id, url: t.url ?? "" });
  }, []);

  useEffect(() => {
    loadBase().then(() =>
      api
        .health()
        .then(setHealth)
        .catch(() => setHealth("down")),
    );
    refreshTab();
    const onAct = () => refreshTab();
    const onUpd = (_id: number, info: { url?: string; status?: string }) => {
      if (info.url || info.status === "complete") refreshTab();
    };
    browser.tabs.onActivated.addListener(onAct);
    browser.tabs.onUpdated.addListener(onUpd);
    return () => {
      browser.tabs.onActivated.removeListener(onAct);
      browser.tabs.onUpdated.removeListener(onUpd);
    };
  }, [refreshTab]);

  useEffect(() => {
    const id = current?.id;
    return () => {
      if (id != null) clearTab(id);
    };
  }, [current?.id]);

  const host = (() => {
    try {
      const u = new URL(current?.url ?? "");
      return u.host + u.pathname;
    } catch {
      return "";
    }
  })();

  const down = health === "down";
  const restricted = isRestricted(current?.url);
  const ctx: Ctx | null = current && !restricted && !down ? { tabId: current.id, url: current.url, log: (i) => setLog((l) => [i, ...l].slice(0, 30)) } : null;

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 px-4 pt-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.02em]">
            <Mark size={18} />
            otto
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted" title={health && health !== "down" ? `${health.model ?? ""}` : "backend"}>
            <Dot tone={health == null ? "muted" : down ? "bad" : health.hasApiKey ? "ok" : "warn"} />
            {health == null ? "" : down ? "offline" : (health.model ?? "")}
          </span>
        </div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted">{host}</div>
        <nav className="mt-3 flex gap-4">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b pb-2 text-[13px] ${tab === t ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-4">
        {down ? (
          <p className="font-mono text-[12px] text-muted">npm run dev</p>
        ) : restricted ? (
          <p className="text-muted">—</p>
        ) : !ctx ? null : tab === "Fill" ? (
          <FillTab key={ctx.tabId + ctx.url} ctx={ctx} />
        ) : tab === "Page" ? (
          <PageTab key={ctx.tabId + ctx.url} ctx={ctx} />
        ) : tab === "Pick" ? (
          <PickTab key={ctx.tabId + ctx.url} ctx={ctx} />
        ) : (
          <LogTab items={log} />
        )}
      </main>
    </div>
  );
}
