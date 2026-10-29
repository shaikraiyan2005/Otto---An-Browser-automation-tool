import { DEFAULT_SETTINGS, type Profile, type Settings } from "@otto/shared";
import { db } from "./db";

export const DEMO_PROFILE: Profile = {
  "honorific-prefix": "Ms",
  "given-name": "Ada",
  "additional-name": "Grace",
  "family-name": "Lovelace",
  name: "Ada Lovelace",
  nickname: "Ada",
  bday: "1990-12-10",
  sex: "Female",
  pronouns: "she/her",
  email: "ada.lovelace@example.com",
  tel: "+14155550123",
  "street-address": "221 Analytical Engine Way, Apt 5",
  "address-line1": "221 Analytical Engine Way",
  "address-line2": "Apt 5",
  "address-level2": "San Francisco",
  "address-level1": "California",
  "postal-code": "94107",
  country: "US",
  organization: "Babbage Labs",
  "organization-title": "Senior Software Engineer",
  "years-experience": "8",
  "current-salary": "150000",
  "expected-salary": "175000",
  "notice-period": "30 days",
  "work-authorization": "US Citizen",
  "requires-sponsorship": "No",
  school: "University of London",
  degree: "Bachelor of Science",
  "field-of-study": "Mathematics",
  "graduation-year": "2012",
  gpa: "3.8",
  url: "https://ada.dev",
  linkedin: "https://linkedin.com/in/adalovelace",
  github: "https://github.com/adalovelace",
  portfolio: "https://ada.dev/work",
  twitter: "@adalovelace",
  "resume-file": "sample-resume.pdf",
  "cover-letter":
    "I build reliable systems that turn complex ideas into simple tools. I would love to bring that experience to your team.",
  summary:
    "Senior software engineer with 8 years of experience building developer tools, data pipelines and web applications.",
};

export async function getProfile(): Promise<Profile> {
  let rows = await db.profileField.findMany();
  if (rows.length === 0) {
    await db.profileField.createMany({ data: Object.entries(DEMO_PROFILE).map(([key, value]) => ({ key, value })) });
    rows = await db.profileField.findMany();
  }
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setProfile(profile: Profile) {
  const entries = Object.entries(profile);
  await db.$transaction([
    db.profileField.deleteMany({ where: { key: { notIn: entries.map(([k]) => k) } } }),
    ...entries.map(([key, value]) =>
      db.profileField.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  ]);
  return getProfile();
}

export async function getSettings(): Promise<Settings> {
  const row = await db.setting.findUnique({ where: { id: 1 } });
  const envModel = process.env.OTTO_MODEL;
  const base = { ...DEFAULT_SETTINGS, ...(envModel ? { model: envModel } : {}) };
  return { ...base, ...((row?.json as Partial<Settings>) ?? {}) };
}

export async function setSettings(s: Settings) {
  const json = { ...s } as Record<string, string | number | boolean>;
  await db.setting.upsert({ where: { id: 1 }, create: { id: 1, json }, update: { json } });
  return getSettings();
}
