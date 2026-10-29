"use client";

import { useState } from "react";
import { IMaskInput } from "react-imask";
import { useCase } from "@/playground/useCase";

const cls = "w-full rounded border border-amber-300 bg-white px-3 py-2 font-mono";

export default function MaskedCase() {
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [zip, setZip] = useState("");
  const [email, setEmail] = useState("");
  useCase("masked", () => ({ phone, dob, zip, email }));
  return (
    <div className="min-h-screen bg-amber-50 py-12 font-sans">
      <div className="mx-auto grid max-w-sm gap-4">
        <h1 className="text-xl font-bold text-amber-900">Patient intake</h1>
        <label className="grid gap-1 text-sm">
          Mobile phone
          <IMaskInput mask="+1 (000) 000-0000" placeholder="+1 (___) ___-____" lazy={false} value={phone} onAccept={(v: string) => setPhone(v)} className={cls} />
        </label>
        <label className="grid gap-1 text-sm">
          Date of birth (MM/DD/YYYY)
          <IMaskInput mask="00/00/0000" placeholder="MM/DD/YYYY" value={dob} onAccept={(v: string) => setDob(v)} className={cls} />
        </label>
        <label className="grid gap-1 text-sm">
          ZIP code
          <IMaskInput mask="00000" placeholder="_____" value={zip} onAccept={(v: string) => setZip(v)} className={cls} />
        </label>
        <label className="grid gap-1 text-sm">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={cls} />
        </label>
      </div>
    </div>
  );
}
