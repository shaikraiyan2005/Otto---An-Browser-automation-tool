"use client";

import { useState } from "react";
import { useCase } from "@/playground/useCase";

type Kind = "text" | "email" | "tel" | "date" | "number" | "url" | "select" | "radio" | "textarea" | "file" | "checkbox";
interface F {
  id: string;
  label: string;
  label2: string;
  kind: Kind;
  options?: string[];
}

const SECTIONS: [string, string, F[]][] = [
  [
    "Personal information",
    "About you",
    [
      { id: "firstName", label: "First name", label2: "Given name", kind: "text" },
      { id: "lastName", label: "Last name", label2: "Family name", kind: "text" },
      { id: "preferredName", label: "Preferred name", label2: "What should we call you?", kind: "text" },
      { id: "email", label: "Email", label2: "Email address", kind: "email" },
      { id: "phone", label: "Phone", label2: "Mobile number", kind: "tel" },
      { id: "dob", label: "Date of birth", label2: "Birth date", kind: "date" },
    ],
  ],
  [
    "Address",
    "Where do you live?",
    [
      { id: "line1", label: "Address line 1", label2: "Street address", kind: "text" },
      { id: "line2", label: "Address line 2", label2: "Apartment, suite, etc.", kind: "text" },
      { id: "city", label: "City", label2: "Town / City", kind: "text" },
      { id: "state", label: "State", label2: "State / Province", kind: "text" },
      { id: "zip", label: "ZIP code", label2: "Postal code", kind: "text" },
      { id: "country", label: "Country", label2: "Country of residence", kind: "select", options: ["Canada", "India", "United Kingdom", "United States"] },
    ],
  ],
  [
    "Experience",
    "Your work",
    [
      { id: "company", label: "Current company", label2: "Employer", kind: "text" },
      { id: "title", label: "Current job title", label2: "Your role", kind: "text" },
      { id: "years", label: "Years of experience", label2: "Total years of professional experience", kind: "number" },
      { id: "currentSalary", label: "Current salary (USD)", label2: "Current annual compensation", kind: "number" },
      { id: "expectedSalary", label: "Expected salary (USD)", label2: "Desired annual compensation", kind: "number" },
      { id: "notice", label: "Notice period", label2: "How soon can you start?", kind: "select", options: ["Immediately", "15 days", "30 days", "60 days", "90 days"] },
      { id: "authorization", label: "Work authorization", label2: "Work permit status", kind: "select", options: ["US Citizen", "Green Card", "H-1B", "Other"] },
      { id: "sponsorship", label: "Will you require visa sponsorship?", label2: "Do you need sponsorship now or in the future?", kind: "radio", options: ["Yes", "No"] },
    ],
  ],
  [
    "Education",
    "Education history",
    [
      { id: "school", label: "School / University", label2: "Institution", kind: "text" },
      { id: "degree", label: "Degree", label2: "Highest qualification", kind: "select", options: ["High School", "Associate", "Bachelor of Arts", "Bachelor of Science", "Master's", "PhD"] },
      { id: "field", label: "Field of study", label2: "Major", kind: "text" },
      { id: "gradYear", label: "Graduation year", label2: "Year graduated", kind: "number" },
    ],
  ],
  [
    "Links",
    "Online presence",
    [
      { id: "linkedin", label: "LinkedIn profile", label2: "LinkedIn", kind: "url" },
      { id: "github", label: "GitHub", label2: "GitHub profile URL", kind: "url" },
      { id: "portfolio", label: "Portfolio", label2: "Portfolio / work samples", kind: "url" },
    ],
  ],
  [
    "Questions",
    "A few questions",
    [
      { id: "why", label: "Why do you want to join Acme?", label2: "What excites you about this role?", kind: "textarea" },
      { id: "about", label: "Tell us about yourself", label2: "Introduce yourself briefly", kind: "textarea" },
      { id: "resume", label: "Resume", label2: "Upload your CV", kind: "file" },
      { id: "marketing", label: "Send me news about future openings", label2: "Keep me posted about new jobs", kind: "checkbox" },
    ],
  ],
];

export function JobForm({ v2 }: { v2: boolean }) {
  const [v, setV] = useState<Record<string, string | boolean>>({});
  useCase(v2 ? "job-application-v2" : "job-application", () => v);
  const set = (id: string, val: string | boolean) => setV((p) => ({ ...p, [id]: val }));
  const sections = v2 ? [SECTIONS[0], SECTIONS[2], SECTIONS[1], SECTIONS[4], SECTIONS[3], SECTIONS[5]] : SECTIONS;
  const name = (id: string) => (v2 ? `candidate[${id.toLowerCase()}]` : id.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`));
  const dom = (id: string) => (v2 ? `c-${id}-x7` : `job-${id}`);

  const field = (f: F) => {
    const label = v2 ? f.label2 : f.label;
    const common = { id: dom(f.id), name: name(f.id) };
    const input = "w-full rounded-md border border-slate-300 px-3 py-2";
    switch (f.kind) {
      case "select":
        return (
          <label key={f.id} className="grid gap-1 text-sm" htmlFor={common.id}>
            {label}
            <select {...common} className={input} value={(v[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)}>
              <option value="">Select…</option>
              {f.options!.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        );
      case "radio":
        return (
          <fieldset key={f.id} className="grid gap-1 text-sm">
            <legend>{label}</legend>
            <div className="flex gap-4">
              {f.options!.map((o) => (
                <label key={o} className="flex items-center gap-2">
                  <input type="radio" name={common.name} value={o.toLowerCase()} checked={v[f.id] === o.toLowerCase()} onChange={(e) => set(f.id, e.target.value)} />
                  {o}
                </label>
              ))}
            </div>
          </fieldset>
        );
      case "textarea":
        return (
          <label key={f.id} className="grid gap-1 text-sm" htmlFor={common.id}>
            {label}
            <textarea {...common} rows={3} maxLength={600} className={input} value={(v[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} />
          </label>
        );
      case "file":
        return (
          <label key={f.id} className="grid gap-1 text-sm" htmlFor={common.id}>
            {label}
            <input {...common} type="file" onChange={(e) => set(f.id, e.target.files?.[0]?.name ?? "")} />
          </label>
        );
      case "checkbox":
        return (
          <label key={f.id} className="flex items-center gap-2 text-sm">
            <input {...common} type="checkbox" checked={Boolean(v[f.id])} onChange={(e) => set(f.id, e.target.checked)} />
            {label}
          </label>
        );
      default:
        return (
          <label key={f.id} className="grid gap-1 text-sm" htmlFor={common.id}>
            {label}
            <input {...common} type={f.kind} className={input} value={(v[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} />
          </label>
        );
    }
  };

  return (
    <div className={`min-h-screen py-10 font-sans text-slate-900 ${v2 ? "bg-emerald-50" : "bg-slate-50"}`}>
      <form className="mx-auto grid max-w-2xl gap-8" onSubmit={(e) => e.preventDefault()}>
        <h1 className="text-2xl font-bold">{v2 ? "Apply — Senior Engineer" : "Senior Software Engineer · Acme"}</h1>
        {sections.map(([title, title2, fields]) => {
          const body = (
            <section key={title} className="grid gap-4 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold">{v2 ? title2 : title}</h2>
              <div className={v2 ? "grid grid-cols-2 gap-4" : "grid gap-4"}>{fields.map(field)}</div>
            </section>
          );
          return v2 ? (
            <div key={title} className="wrapper">
              <div className="inner">{body}</div>
            </div>
          ) : (
            body
          );
        })}
        <button className="justify-self-start rounded-md bg-slate-900 px-5 py-2 text-white">Submit application</button>
      </form>
    </div>
  );
}
