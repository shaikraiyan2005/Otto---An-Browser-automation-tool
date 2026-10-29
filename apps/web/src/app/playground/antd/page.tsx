"use client";

import { DatePicker, Input, Radio, Select } from "antd";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useCase } from "@/playground/useCase";

const COUNTRY_NAMES = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria", "Bangladesh", "Belgium", "Bolivia", "Brazil",
  "Bulgaria", "Cambodia", "Canada", "Chile", "China", "Colombia", "Croatia", "Czechia", "Denmark", "Egypt", "Estonia", "Finland",
  "France", "Germany", "Ghana", "Greece", "Hungary", "Iceland", "India", "Indonesia", "Ireland", "Israel", "Italy", "Japan", "Kenya",
  "Latvia", "Lithuania", "Malaysia", "Mexico", "Morocco", "Nepal", "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan",
  "Peru", "Philippines", "Poland", "Portugal", "Romania", "Saudi Arabia", "Singapore", "Slovakia", "South Africa", "South Korea",
  "Spain", "Sri Lanka", "Sweden", "Switzerland", "Thailand", "Turkey", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Uruguay", "Vietnam", "Zambia",
];

export default function AntdCase() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<string>();
  const [dob, setDob] = useState<Dayjs | null>(null);
  const [sponsorship, setSponsorship] = useState("");

  useCase("antd", () => ({ fullName, email, country: country ?? "", dob: dob ? dob.format("YYYY-MM-DD") : "", sponsorship }));

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", padding: 48 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", background: "#fff", padding: 32, borderRadius: 8, display: "grid", gap: 16 }}>
        <h2 style={{ margin: 0 }}>Visa application</h2>
        <label style={{ display: "grid", gap: 6 }}>
          Full name
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Email
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div style={{ display: "grid", gap: 6 }}>
          <span id="ant-country">Country of residence</span>
          <Select
            aria-labelledby="ant-country"
            showSearch
            placeholder="Select a country"
            value={country}
            onChange={setCountry}
            options={COUNTRY_NAMES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <span>Date of birth</span>
          <DatePicker value={dob} onChange={setDob} format="YYYY-MM-DD" />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <span>Will you require visa sponsorship?</span>
          <Radio.Group value={sponsorship} onChange={(e) => setSponsorship(e.target.value)}>
            <Radio value="yes">Yes</Radio>
            <Radio value="no">No</Radio>
          </Radio.Group>
        </div>
      </div>
    </div>
  );
}
