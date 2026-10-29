import type { AskOutput, MapOutput, PageSummary, Profile, ProfileKeyMeta, Recipe, RunReport, Settings, Usage } from "@otto/shared";

let base = "http://localhost:3000";

export async function loadBase() {
  try {
    const s = await browser.storage.local.get("api");
    if (typeof s.api === "string" && s.api) base = s.api;
  } catch {}
  return base;
}

export const apiBase = () => base;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${res.status}`);
  return data as T;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

export interface Health {
  ok: boolean;
  db: string;
  hasApiKey: boolean;
  model: string | null;
}

export const api = {
  health: () => call<Health>("/api/health"),
  profile: () => call<{ profile: Profile; keys: ProfileKeyMeta[] }>("/api/profile"),
  settings: () => call<Settings>("/api/settings"),
  map: (body: unknown) => post<{ mappings: MapOutput["mappings"]; usage: Usage | null }>("/api/map", body),
  summarize: (body: unknown) => post<{ summary: PageSummary; usage: Usage }>("/api/summarize", body),
  ask: (body: unknown) => post<AskOutput & { usage: Usage }>("/api/ask", body),
  lookup: (origin: string, path: string, formSig: string) =>
    call<{ exact: Recipe | null; candidates: Recipe[] }>(
      `/api/recipes/lookup?origin=${encodeURIComponent(origin)}&path=${encodeURIComponent(path)}&formSig=${formSig}`,
    ),
  saveRecipe: (r: Omit<Recipe, "id"> & { id?: string }) => post<{ recipe: Recipe }>("/api/recipes", r),
  run: (r: RunReport) => post<{ id: string }>("/api/runs", r),
  async file(name: string) {
    const res = await fetch(`${base}/${name.replace(/^\//, "")}`);
    if (!res.ok) throw new Error(`file ${name} not found`);
    const blob = await res.blob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { name: name.split("/").pop() ?? "file", type: blob.type || "application/octet-stream", base64: btoa(bin) };
  },
};
