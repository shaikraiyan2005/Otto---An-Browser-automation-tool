import { countryNames, PROFILE_KEYS, profileMeta, type FieldDescriptor, type Mapping, type Profile } from "@otto/shared";
import { bestOption, digits, norm } from "./util";

/** HTML autocomplete tokens that map 1:1 to profile keys. */
const AUTOCOMPLETE: Record<string, string> = {
  "honorific-prefix": "honorific-prefix",
  "given-name": "given-name",
  "additional-name": "additional-name",
  "family-name": "family-name",
  name: "name",
  nickname: "nickname",
  email: "email",
  tel: "tel",
  "tel-national": "tel",
  "street-address": "street-address",
  "address-line1": "address-line1",
  "address-line2": "address-line2",
  "address-level1": "address-level1",
  "address-level2": "address-level2",
  "postal-code": "postal-code",
  country: "country",
  "country-name": "country",
  organization: "organization",
  "organization-title": "organization-title",
  bday: "bday",
  sex: "sex",
  url: "url",
};

const EXTRA: Record<string, string[]> = {
  "given-name": ["given", "first"],
  "family-name": ["surname", "last"],
  "address-line1": ["street line 1", "address line one"],
  "organization-title": ["your role", "current role"],
  "years-experience": ["years of professional experience", "yrs experience"],
  "address-level1": ["state province"],
  tel: ["phone no", "mobile number", "mobile phone"],
  email: ["email for receipt"],
  "work-authorization": ["authorization status", "work permit status"],
  linkedin: ["linked in"],
  "cover-letter": ["why do you want to join", "why us", "why are you interested"],
  summary: ["about yourself", "about you", "introduce yourself", "professional summary"],
  "resume-file": ["upload your cv", "upload resume"],
};

interface Syn {
  key: string;
  phrase: string;
  words: number;
}

const SYNONYMS: Syn[] = PROFILE_KEYS.flatMap((p) =>
  [...p.synonyms, p.label, ...(EXTRA[p.key] ?? [])].map((s) => ({ key: p.key, phrase: norm(s), words: norm(s).split(" ").length })),
).filter((s) => s.phrase.length > 1);

const LONG_KEYS = new Set(PROFILE_KEYS.filter((p) => p.format === "longtext").map((p) => p.key));
const NUMBER_KEYS = new Set(["years-experience", "current-salary", "expected-salary", "graduation-year", "gpa"]);

const has = (hay: string, phrase: string) => ` ${hay} `.includes(` ${phrase} `);

/** Best profile key for a text blob: longest phrase wins (so "last name" beats "name"). */
function keyFromText(text: string, allow: (k: string) => boolean): { key: string; len: number } | null {
  const t = norm(text);
  if (!t) return null;
  let best: { key: string; len: number } | null = null;
  for (const s of SYNONYMS) {
    if (!allow(s.key) || !has(t, s.phrase)) continue;
    const len = s.phrase.length + s.words * 2;
    if (!best || len > best.len) best = { key: s.key, len };
  }
  return best;
}

function allowedFor(f: FieldDescriptor) {
  return (k: string) => {
    if (f.kind === "file") return k === "resume-file";
    if (k === "resume-file") return false;
    if (f.kind === "longtext") return LONG_KEYS.has(k);
    if (LONG_KEYS.has(k)) return false;
    if (f.kind === "date") return k === "bday";
    if (k === "bday") return f.kind === "text";
    if (f.kind === "email") return k === "email";
    if (f.kind === "tel") return k === "tel";
    if (f.kind === "number") return NUMBER_KEYS.has(k);
    return true;
  };
}

export function ruleKey(f: FieldDescriptor): { key: string; confidence: number } | null {
  const allow = allowedFor(f);
  const ac = (f.autocomplete ?? "").toLowerCase().split(/\s+/).pop() ?? "";
  if (AUTOCOMPLETE[ac] && allow(AUTOCOMPLETE[ac])) return { key: AUTOCOMPLETE[ac], confidence: 0.95 };
  if (f.kind === "file") return { key: "resume-file", confidence: 0.8 };

  if (f.options?.some((o) => /^(mr|ms|mrs|miss|dr|prof)\.?$/i.test(o.trim()))) return { key: "honorific-prefix", confidence: 0.9 };

  const fromLabel = keyFromText(f.label, allow);
  if (fromLabel) return { key: fromLabel.key, confidence: fromLabel.len > 8 ? 0.9 : 0.8 };
  const fromAttr = keyFromText(`${f.name ?? ""} ${f.idAttr ?? ""}`, allow);
  if (fromAttr) return { key: fromAttr.key, confidence: 0.75 };
  const fromPh = keyFromText(f.placeholder ?? "", allow);
  if (fromPh) return { key: fromPh.key, confidence: 0.75 };
  if (f.kind === "email") return { key: "email", confidence: 0.85 };
  if (f.kind === "tel") return { key: "tel", confidence: 0.85 };
  return null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(iso: string, fmt = "YYYY-MM-DD"): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return fmt
    .replace("YYYY", y)
    .replace("YY", y.slice(2))
    .replace("MM", mo)
    .replace("DD", d)
    .replace("MMMM", MONTHS[Number(mo) - 1]);
}

/** Convert a stored profile value into what this particular field expects. Returns null if no option fits. */
export function formatFor(f: FieldDescriptor, key: string | null | undefined, raw: string): string | null {
  let value = raw;
  if (key === "country") value = countryNames(raw)[1] ?? raw;
  if (key === "bday" || (f.kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(raw))) value = formatDate(raw, f.dateFormat ?? "YYYY-MM-DD");
  if (key === "tel" && f.maxLength && f.maxLength <= 12) value = digits(raw).slice(-f.maxLength);

  if (f.options?.length) {
    const wants = key === "country" ? countryNames(raw) : key === "address-level1" ? [raw, STATE_CODES[raw] ?? raw] : [value, raw];
    const i = bestOption(f.options, wants);
    return i >= 0 ? f.options[i] : null;
  }
  if (f.kind === "boolean") return /^(yes|true|1|y)$/i.test(raw) ? "true" : "false";
  return value;
}

const STATE_CODES: Record<string, string> = { California: "CA", "New York": "NY", Texas: "TX", Washington: "WA", Arizona: "AZ" };

export interface RuleResult {
  mappings: Mapping[];
  leftovers: FieldDescriptor[];
}

/** Map fields to profile values without AI. Fields that rules cannot decide go to `leftovers`. */
export function matchByRules(fields: FieldDescriptor[], profile: Profile): RuleResult {
  const mappings: Mapping[] = [];
  const leftovers: FieldDescriptor[] = [];
  const keys = new Map<string, string>();
  for (const f of fields) {
    if (f.trap || f.blocked) {
      mappings.push({ ref: f.ref, source: "skip", key: null, value: "", confidence: 1, reason: f.trap ? `trap: ${f.trap}` : `never filled: ${f.blocked}`, enabled: false });
      continue;
    }
    const r = ruleKey(f);
    if (r) keys.set(f.ref, r.key);
    if (!r || profile[r.key] == null || profile[r.key] === "") {
      leftovers.push(f);
      continue;
    }
    const value = formatFor(f, r.key, profile[r.key]);
    if (value == null) {
      leftovers.push(f);
      continue;
    }
    mappings.push({ ref: f.ref, source: "rule", key: r.key, value, confidence: r.confidence, reason: `rule · ${profileMeta(r.key)?.label ?? r.key}`, enabled: true });
  }

  // a single "street address" field means line1 when the form also has a line2 field
  const hasLine2 = [...keys.values()].includes("address-line2");
  if (hasLine2) {
    for (const m of mappings) {
      if (m.key === "street-address" && profile["address-line1"]) {
        m.key = "address-line1";
        m.value = profile["address-line1"];
      }
    }
  }
  return { mappings, leftovers };
}
