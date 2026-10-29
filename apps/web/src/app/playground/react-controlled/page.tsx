"use client";

import { useState } from "react";
import { useCase } from "@/playground/useCase";

const FIELDS: [keyof State, string, string?][] = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["email", "Work email", "email"],
  ["phone", "Phone number", "tel"],
  ["company", "Current company"],
  ["jobTitle", "Current title"],
  ["years", "Years of experience", "number"],
  ["linkedin", "LinkedIn URL", "url"],
  ["city", "City"],
  ["zip", "ZIP / Postal code"],
];

type State = Record<"firstName" | "lastName" | "email" | "phone" | "company" | "jobTitle" | "years" | "linkedin" | "city" | "zip", string>;

export default function ReactControlled() {
  const [s, setS] = useState<State>({ firstName: "", lastName: "", email: "", phone: "", company: "", jobTitle: "", years: "", linkedin: "", city: "", zip: "" });
  useCase("react-controlled", () => s);
  return (
    <div className="min-h-screen bg-sky-50 py-12 font-sans text-slate-800">
      <form className="mx-auto grid max-w-xl gap-4 rounded-2xl bg-white p-8 shadow-sm" onSubmit={(e) => e.preventDefault()}>
        <h1 className="text-xl font-bold text-sky-900">Talent network</h1>
        {FIELDS.map(([k, label, type]) => (
          <label key={k} className="grid gap-1 text-sm">
            {label}
            <input
              type={type ?? "text"}
              value={s[k]}
              onChange={(e) => setS((p) => ({ ...p, [k]: e.target.value }))}
              className="rounded-lg border border-sky-200 px-3 py-2"
            />
          </label>
        ))}
        <pre className="rounded-lg bg-slate-900 p-3 text-xs text-sky-200">{JSON.stringify(s, null, 1)}</pre>
      </form>
    </div>
  );
}
