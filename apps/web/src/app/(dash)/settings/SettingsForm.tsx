"use client";

import type { Settings } from "@otto/shared";
import { useState } from "react";
import { PageTitle } from "@/components/Shell";

const MODELS = ["gemini-3-flash-preview", "gemini-3.5-flash", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const EFFORTS = ["low", "medium", "high"] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] items-center gap-4 px-5 py-3">
      <span className="text-sm">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-primary" : "bg-line"}`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-primary-fg transition-transform ${value ? "translate-x-4.5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  async function save() {
    const res = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
    const next = await res.json();
    setS(next);
    setSaved(next);
  }

  const effort = (k: "effortMap" | "effortSummarize" | "effortAsk") => (
    <div className="inline-flex rounded-lg border border-line p-0.5">
      {EFFORTS.map((e) => (
        <button
          key={e}
          onClick={() => set(k, e)}
          className={`rounded-md px-3 py-1 text-xs ${s[k] === e ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}
        >
          {e}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <PageTitle right={<button className="btn-primary" disabled={!dirty} onClick={save}>Save</button>}>Settings</PageTitle>
      <div className="card max-w-3xl divide-y divide-line">
        <Row label="Model">
          <select className="input max-w-xs" value={s.model} onChange={(e) => set("model", e.target.value)}>
            {[...new Set([s.model, ...MODELS])].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Row>
        <Row label="Effort · field mapping">{effort("effortMap")}</Row>
        <Row label="Effort · summaries">{effort("effortSummarize")}</Row>
        <Row label="Effort · ask">{effort("effortAsk")}</Row>
        <Row label="Auto-select confidence">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.confidenceAutofill}
              onChange={(e) => set("confidenceAutofill", Number(e.target.value))}
              className="w-48 accent-current"
            />
            <span className="font-mono text-xs">{s.confidenceAutofill.toFixed(2)}</span>
          </div>
        </Row>
        <Row label="Generate free-text answers">
          <Toggle value={s.allowGenerate} onChange={(v) => set("allowGenerate", v)} />
        </Row>
        <Row label="Save recipes automatically">
          <Toggle value={s.autoSaveRecipes} onChange={(v) => set("autoSaveRecipes", v)} />
        </Row>
      </div>
    </>
  );
}
