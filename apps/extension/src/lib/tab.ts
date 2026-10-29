import type { EngineRequest, EngineResponses, FieldDescriptor, Mapping } from "@otto/shared";

const RESTRICTED = /^(chrome|chrome-extension|edge|about|devtools|view-source|chrome-untrusted|moz-extension):|^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/;

export function isRestricted(url?: string) {
  return !url || RESTRICTED.test(url);
}

export async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

export async function inject(tabId: number) {
  await browser.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["/engine.js"] }).catch(() => {});
}

async function frames(tabId: number) {
  const all = await browser.webNavigation.getAllFrames({ tabId }).catch(() => null);
  return (all ?? [{ frameId: 0, url: "" }]).filter((f) => !isRestricted(f.url) || f.frameId === 0).map((f) => f.frameId);
}

export async function send<T extends EngineRequest["type"]>(
  tabId: number,
  frameId: number,
  msg: Extract<EngineRequest, { type: T }>,
): Promise<EngineResponses[T]> {
  const go = () => browser.tabs.sendMessage(tabId, msg, { frameId }) as Promise<EngineResponses[T]>;
  try {
    const r = await go();
    if (r === undefined) throw new Error("no receiver");
    return r;
  } catch {
    await inject(tabId);
    return go();
  }
}

const split = (ref: string) => {
  const i = ref.indexOf(":");
  return { frameId: Number(ref.slice(0, i)), local: ref.slice(i + 1) };
};

/** Scan every frame and merge; refs become "frameId:localRef". */
export async function scanTab(tabId: number) {
  await inject(tabId);
  const ids = await frames(tabId);
  const results = await Promise.all(
    ids.map(async (frameId) => {
      try {
        const r = await (browser.tabs.sendMessage(tabId, { type: "otto:scan" }, { frameId }) as Promise<EngineResponses["otto:scan"]>);
        return r ? { ...r, frameId } : null;
      } catch {
        return null;
      }
    }),
  );
  const ok = results.filter((r): r is NonNullable<typeof r> => Boolean(r && Array.isArray(r.fields)));
  const top = ok.find((r) => r.frameId === 0) ?? ok[0];
  const fields: FieldDescriptor[] = ok.flatMap((r) => r.fields.map((f) => ({ ...f, frameId: r.frameId, ref: `${r.frameId}:${f.ref}` })));
  return {
    fields,
    url: top?.url ?? "",
    title: top?.title ?? "",
    caseId: ok.find((r) => r.caseId)?.caseId,
    elements: ok.reduce((a, r) => a + r.elements, 0),
    ms: Math.max(0, ...ok.map((r) => r.ms)),
  };
}

/** Group mappings by frame and fill each frame in order. */
export async function fillTab(tabId: number, mappings: Mapping[]) {
  const byFrame = new Map<number, Mapping[]>();
  for (const m of mappings) {
    const { frameId, local } = split(m.ref);
    byFrame.set(frameId, [...(byFrame.get(frameId) ?? []), { ...m, ref: local }]);
  }
  const results = [];
  for (const [frameId, ms] of [...byFrame.entries()].sort((a, b) => a[0] - b[0])) {
    const r = await send(tabId, frameId, { type: "otto:fill", mappings: ms });
    results.push(...(r?.results ?? []).map((x) => ({ ...x, ref: `${frameId}:${x.ref}` })));
  }
  return results;
}

export async function highlightTab(tabId: number, refs: string[], status?: Record<string, string>) {
  const byFrame = new Map<number, string[]>();
  for (const r of refs) {
    const { frameId, local } = split(r);
    byFrame.set(frameId, [...(byFrame.get(frameId) ?? []), local]);
  }
  for (const frameId of await frames(tabId)) {
    const local = byFrame.get(frameId) ?? [];
    const st = status ? Object.fromEntries(local.map((l) => [l, status[`${frameId}:${l}`] ?? "pending"])) : undefined;
    browser.tabs.sendMessage(tabId, local.length ? { type: "otto:highlight", refs: local, status: st } : { type: "otto:clear" }, { frameId }).catch(() => {});
  }
}

export async function clearTab(tabId: number) {
  for (const frameId of await frames(tabId)) browser.tabs.sendMessage(tabId, { type: "otto:clear" }, { frameId }).catch(() => {});
}
