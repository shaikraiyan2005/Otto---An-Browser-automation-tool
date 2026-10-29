"use client";

import { useEffect, useRef, useState } from "react";
import { useCase } from "@/playground/useCase";

export default function DynamicCase() {
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sponsorship, setSponsorship] = useState("");
  const [authorization, setAuthorization] = useState("");
  const wiped = useRef(false);
  useCase("dynamic", () => ({ email, phone, sponsorship, authorization }));

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Simulates a late re-render that resets the first value typed into "email" once (like a hydration reset).
  useEffect(() => {
    if (email && !wiped.current) {
      wiped.current = true;
      const t = setTimeout(() => setEmail(""), 300);
      return () => clearTimeout(t);
    }
  }, [email]);

  if (!loaded) return <div className="grid min-h-screen place-items-center font-sans text-neutral-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-white py-12 font-sans text-neutral-900">
      <form className="mx-auto grid max-w-md gap-4" onSubmit={(e) => e.preventDefault()}>
        <h1 className="text-xl font-semibold">Eligibility check</h1>
        <label className="grid gap-1 text-sm">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border border-neutral-300 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded border border-neutral-300 px-3 py-2" />
        </label>
        <fieldset className="grid gap-1 text-sm">
          <legend>Do you require visa sponsorship?</legend>
          <label className="flex gap-2">
            <input type="radio" name="sp" value="yes" checked={sponsorship === "yes"} onChange={(e) => setSponsorship(e.target.value)} /> Yes
          </label>
          <label className="flex gap-2">
            <input type="radio" name="sp" value="no" checked={sponsorship === "no"} onChange={(e) => setSponsorship(e.target.value)} /> No
          </label>
        </fieldset>
        {sponsorship === "no" && (
          <label className="grid gap-1 text-sm">
            Current work authorization status
            <input value={authorization} onChange={(e) => setAuthorization(e.target.value)} className="rounded border border-neutral-300 px-3 py-2" />
          </label>
        )}
      </form>
    </div>
  );
}
