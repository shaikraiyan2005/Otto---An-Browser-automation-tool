"use client";

import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import * as RSelect from "@radix-ui/react-select";
import { useState } from "react";
import { useCase } from "@/playground/useCase";

const COUNTRIES = ["Canada", "India", "United Kingdom", "United States"];
const DEGREES = ["High School", "Bachelor of Arts", "Bachelor of Science", "Master of Science", "PhD"];
const CITIES = ["Austin", "Boston", "Denver", "San Diego", "San Francisco", "San Jose", "Seattle"];

export default function RadixHeadless() {
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [degree, setDegree] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  useCase("radix-headless", () => ({ email, country, degree, city: city ?? "" }));
  const filtered = CITIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="min-h-screen bg-zinc-950 py-16 font-sans text-zinc-100">
      <div className="mx-auto grid max-w-md gap-6">
        <h1 className="text-2xl font-semibold">Onboarding</h1>
        <label className="grid gap-2 text-sm">
          Email address
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-md bg-zinc-900 px-3 py-2 ring-1 ring-zinc-700" />
        </label>

        <div className="grid gap-2 text-sm">
          <span id="radix-country">Country</span>
          <RSelect.Root value={country} onValueChange={setCountry}>
            <RSelect.Trigger aria-labelledby="radix-country" className="flex items-center justify-between rounded-md bg-zinc-900 px-3 py-2 ring-1 ring-zinc-700">
              <RSelect.Value placeholder="Pick a country" />
            </RSelect.Trigger>
            <RSelect.Portal>
              <RSelect.Content position="popper" sideOffset={4} className="z-50 rounded-md bg-zinc-800 p-1 text-sm text-zinc-100 ring-1 ring-zinc-700">
                <RSelect.Viewport>
                  {COUNTRIES.map((c) => (
                    <RSelect.Item key={c} value={c} className="cursor-pointer rounded px-3 py-1.5 outline-none data-[highlighted]:bg-zinc-700">
                      <RSelect.ItemText>{c}</RSelect.ItemText>
                    </RSelect.Item>
                  ))}
                </RSelect.Viewport>
              </RSelect.Content>
            </RSelect.Portal>
          </RSelect.Root>
        </div>

        <div className="grid gap-2 text-sm">
          <span>Degree</span>
          <Listbox value={degree} onChange={setDegree}>
            <ListboxButton className="rounded-md bg-zinc-900 px-3 py-2 text-left ring-1 ring-zinc-700">{degree || "Choose degree"}</ListboxButton>
            <ListboxOptions anchor="bottom start" className="z-50 w-[var(--button-width)] rounded-md bg-zinc-800 p-1 ring-1 ring-zinc-700">
              {DEGREES.map((d) => (
                <ListboxOption key={d} value={d} className="cursor-pointer rounded px-3 py-1.5 data-[focus]:bg-zinc-700">
                  {d}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Listbox>
        </div>

        <div className="grid gap-2 text-sm">
          <span>City</span>
          <Combobox value={city} onChange={setCity} onClose={() => setQuery("")}>
            <ComboboxInput
              aria-label="City"
              displayValue={(c: string | null) => c ?? ""}
              onChange={(e) => setQuery(e.target.value)}
              className="rounded-md bg-zinc-900 px-3 py-2 ring-1 ring-zinc-700"
            />
            <ComboboxOptions anchor="bottom start" className="z-50 w-[var(--input-width)] rounded-md bg-zinc-800 p-1 ring-1 ring-zinc-700 empty:invisible">
              {filtered.map((c) => (
                <ComboboxOption key={c} value={c} className="cursor-pointer rounded px-3 py-1.5 data-[focus]:bg-zinc-700">
                  {c}
                </ComboboxOption>
              ))}
            </ComboboxOptions>
          </Combobox>
        </div>
      </div>
    </div>
  );
}
