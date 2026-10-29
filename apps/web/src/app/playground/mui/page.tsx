"use client";

import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useCase } from "@/playground/useCase";

const COUNTRIES = [
  ["CA", "Canada"],
  ["DE", "Germany"],
  ["IN", "India"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
];
const CITIES = ["Austin", "Boston", "Chicago", "Los Angeles", "New York", "San Francisco", "Seattle"];

export default function MuiCase() {
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [dob, setDob] = useState<Dayjs | null>(null);
  const [gender, setGender] = useState("");
  const [marketing, setMarketing] = useState(false);

  useCase("mui", () => ({
    firstName,
    lastName,
    email,
    country,
    city: city ?? "",
    dob: dob?.isValid() ? dob.format("YYYY-MM-DD") : "",
    gender,
    marketing,
  }));

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div style={{ maxWidth: 520, margin: "48px auto", display: "grid", gap: 20, fontFamily: "Roboto, sans-serif" }}>
        <h1 style={{ fontWeight: 400 }}>Create your account</h1>
        <TextField label="First name" value={firstName} onChange={(e) => setFirst(e.target.value)} />
        <TextField label="Last name" value={lastName} onChange={(e) => setLast(e.target.value)} />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormControl fullWidth>
          <InputLabel id="country-label">Country</InputLabel>
          <Select labelId="country-label" label="Country" value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map(([v, l]) => (
              <MenuItem key={v} value={v}>
                {l}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Autocomplete options={CITIES} value={city} onChange={(_, v) => setCity(v)} renderInput={(p) => <TextField {...p} label="City" />} />
        <DatePicker label="Date of birth" value={dob} onChange={setDob} />
        <FormControl>
          <FormLabel id="gender-label">Gender</FormLabel>
          <RadioGroup row aria-labelledby="gender-label" value={gender} onChange={(e) => setGender(e.target.value)}>
            <FormControlLabel value="female" control={<Radio />} label="Female" />
            <FormControlLabel value="male" control={<Radio />} label="Male" />
            <FormControlLabel value="other" control={<Radio />} label="Other" />
          </RadioGroup>
        </FormControl>
        <FormControlLabel control={<Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />} label="Send me marketing emails" />
      </div>
    </LocalizationProvider>
  );
}
