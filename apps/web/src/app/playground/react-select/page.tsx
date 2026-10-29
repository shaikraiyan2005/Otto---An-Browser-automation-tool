"use client";

import { useState } from "react";
import Select from "react-select";
import { useCase } from "@/playground/useCase";

type Opt = { value: string; label: string };
const opts = (xs: string[]): Opt[] => xs.map((x) => ({ value: x.toLowerCase().replace(/\W+/g, "-"), label: x }));
const COUNTRIES = opts(["Argentina", "Australia", "Brazil", "Canada", "France", "Germany", "India", "Japan", "Mexico", "Spain", "United Kingdom", "United States"]);
const STATES = opts(["Alabama", "Arizona", "California", "Colorado", "Florida", "Georgia", "New York", "Texas", "Washington"]);
const DEGREES = opts(["High School", "Associate Degree", "Bachelor of Arts", "Bachelor of Science", "Master of Science", "PhD"]);

export default function ReactSelectCase() {
  const [country, setCountry] = useState<Opt | null>(null);
  const [state, setState] = useState<Opt | null>(null);
  const [degree, setDegree] = useState<Opt | null>(null);
  useCase("react-select", () => ({ country: country?.label ?? "", state: state?.label ?? "", degree: degree?.label ?? "" }));
  return (
    <div className="min-h-screen bg-white py-12 font-sans text-neutral-800">
      <div className="mx-auto grid max-w-md gap-5">
        <h1 className="text-2xl font-semibold">Where are you based?</h1>
        <label className="grid gap-1 text-sm" id="lbl-country">
          Country
          <Select inputId="country" aria-labelledby="lbl-country" options={COUNTRIES} value={country} onChange={setCountry} isClearable />
        </label>
        <label className="grid gap-1 text-sm" id="lbl-state">
          State / Province
          <Select inputId="state" aria-labelledby="lbl-state" options={STATES} value={state} onChange={setState} />
        </label>
        <label className="grid gap-1 text-sm" id="lbl-degree">
          Highest degree
          <Select inputId="degree" aria-labelledby="lbl-degree" options={DEGREES} value={degree} onChange={setDegree} menuPortalTarget={typeof document !== "undefined" ? document.body : null} />
        </label>
      </div>
    </div>
  );
}
