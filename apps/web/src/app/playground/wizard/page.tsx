"use client";

import { useState } from "react";
import { useCase } from "@/playground/useCase";

const STEPS: [string, [string, string, string?][]][] = [
  ["About you", [["firstName", "First name"], ["lastName", "Last name"], ["email", "Email", "email"]]],
  ["Contact", [["phone", "Phone", "tel"], ["address", "Street address"], ["city", "City"]]],
  ["Profiles", [["linkedin", "LinkedIn"], ["github", "GitHub"]]],
];

export default function Wizard() {
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useCase("wizard", () => v);
  const [title, fields] = STEPS[step];
  const next = () => {
    const missing = fields.filter(([k]) => !v[k]?.trim());
    if (missing.length) return setError(`Required: ${missing.map((m) => m[1]).join(", ")}`);
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  return (
    <div className="min-h-screen bg-indigo-50 py-12 font-sans text-indigo-950">
      <form className="mx-auto grid max-w-md gap-4 rounded-2xl bg-white p-8" onSubmit={(e) => e.preventDefault()}>
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s[0]} className={`h-1 flex-1 rounded ${i <= step ? "bg-indigo-600" : "bg-indigo-100"}`} />
          ))}
        </div>
        <h1 className="text-lg font-semibold">
          Step {step + 1} of {STEPS.length}: {title}
        </h1>
        {fields.map(([k, label, type]) => (
          <label key={k} className="grid gap-1 text-sm">
            {label}
            <input type={type ?? "text"} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="rounded-lg border border-indigo-200 px-3 py-2" />
          </label>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-between">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="rounded-lg px-4 py-2 text-sm disabled:opacity-40">
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" data-testid="next">
              Next
            </button>
          ) : (
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
              Submit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
