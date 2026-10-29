"use client";

import type { Profile, ProfileKeyMeta } from "@otto/shared";
import { useMemo, useState } from "react";
import { PageTitle } from "@/components/Shell";

export function ProfileEditor({ initial, keys }: { initial: Profile; keys: ProfileKeyMeta[] }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState("");

  const groups = useMemo(() => {
    const g = new Map<string, ProfileKeyMeta[]>();
    for (const k of keys) g.set(k.group, [...(g.get(k.group) ?? []), k]);
    const custom = Object.keys(draft).filter((k) => !keys.some((m) => m.key === k));
    if (custom.length)
      g.set(
        "Custom",
        custom.map((key) => ({ key, label: key.replace(/^custom:/, ""), group: "Custom", format: "text", synonyms: [] })),
      );
    return [...g.entries()];
  }, [keys, draft]);

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  async function save() {
    setBusy(true);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: draft }),
    });
    const data = await res.json();
    setSaved(data.profile);
    setDraft(data.profile);
    setBusy(false);
  }

  function addCustom() {
    const slug = newKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return;
    setDraft({ ...draft, [`custom:${slug}`]: draft[`custom:${slug}`] ?? " " });
    setNewKey("");
  }

  return (
    <>
      <PageTitle
        right={
          <div className="flex gap-2">
            {dirty && (
              <button className="btn" onClick={() => setDraft(saved)} disabled={busy}>
                Reset
              </button>
            )}
            <button className="btn-primary" onClick={save} disabled={!dirty || busy}>
              Save
            </button>
          </div>
        }
      >
        Profile
      </PageTitle>
      <div className="grid max-w-4xl gap-6">
        {groups.map(([group, items]) => (
          <section key={group} className="card">
            <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">{group}</h2>
            <div className="divide-y divide-line">
              {items.map((m) => (
                <label key={m.key} className="grid grid-cols-[180px_1fr_160px] items-center gap-4 px-5 py-2">
                  <span className="text-sm">{m.label}</span>
                  {m.format === "longtext" ? (
                    <textarea
                      className="input h-20 py-2"
                      value={draft[m.key] ?? ""}
                      onChange={(e) => setDraft({ ...draft, [m.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      className="input"
                      value={draft[m.key] ?? ""}
                      onChange={(e) => setDraft({ ...draft, [m.key]: e.target.value })}
                    />
                  )}
                  <code className="truncate text-right font-mono text-xs text-muted">{m.key}</code>
                </label>
              ))}
            </div>
          </section>
        ))}
        <div className="flex gap-2">
          <input
            className="input max-w-xs"
            placeholder="custom field"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
          />
          <button className="btn" onClick={addCustom}>
            Add
          </button>
        </div>
      </div>
    </>
  );
}
