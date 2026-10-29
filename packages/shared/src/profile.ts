export type ProfileFormat = "text" | "date" | "phone" | "country" | "email" | "url" | "number" | "boolean" | "longtext" | "file";

export interface ProfileKeyMeta {
  key: string;
  label: string;
  group: string;
  format: ProfileFormat;
  synonyms: string[];
}

const k = (key: string, label: string, group: string, format: ProfileFormat, synonyms: string[]): ProfileKeyMeta => ({
  key,
  label,
  group,
  format,
  synonyms,
});

export const PROFILE_KEYS: ProfileKeyMeta[] = [
  k("honorific-prefix", "Title", "Identity", "text", ["salutation", "prefix", "mr mrs ms"]),
  k("given-name", "First name", "Identity", "text", ["first name", "forename", "given name", "fname", "first"]),
  k("additional-name", "Middle name", "Identity", "text", ["middle name", "middle initial", "mname"]),
  k("family-name", "Last name", "Identity", "text", ["last name", "surname", "family name", "lname", "last"]),
  k("name", "Full name", "Identity", "text", ["full name", "your name", "name", "applicant name", "legal name"]),
  k("nickname", "Preferred name", "Identity", "text", ["preferred name", "nickname", "goes by"]),
  k("bday", "Date of birth", "Identity", "date", ["date of birth", "birth date", "birthday", "dob"]),
  k("sex", "Gender", "Identity", "text", ["gender", "sex"]),
  k("pronouns", "Pronouns", "Identity", "text", ["pronouns"]),
  k("email", "Email", "Contact", "email", ["email", "e-mail", "mail", "email address"]),
  k("tel", "Phone", "Contact", "phone", ["phone", "telephone", "mobile", "cell", "contact number", "phone number"]),
  k("street-address", "Street address", "Address", "text", ["street address", "address"]),
  k("address-line1", "Address line 1", "Address", "text", ["address line 1", "address 1", "street", "address1", "house"]),
  k("address-line2", "Address line 2", "Address", "text", ["address line 2", "address 2", "apartment", "suite", "unit", "apt", "address2"]),
  k("address-level2", "City", "Address", "text", ["city", "town", "locality"]),
  k("address-level1", "State", "Address", "text", ["state", "province", "region", "county"]),
  k("postal-code", "Postal code", "Address", "text", ["postal code", "zip", "zip code", "postcode", "pin code", "pincode"]),
  k("country", "Country", "Address", "country", ["country", "nation", "country of residence"]),
  k("organization", "Company", "Work", "text", ["company", "employer", "organization", "organisation", "current company"]),
  k("organization-title", "Job title", "Work", "text", ["job title", "title", "position", "role", "designation", "current title"]),
  k("years-experience", "Years of experience", "Work", "number", ["years of experience", "experience", "total experience", "years"]),
  k("current-salary", "Current salary", "Work", "number", ["current salary", "current ctc", "salary"]),
  k("expected-salary", "Expected salary", "Work", "number", ["expected salary", "expected ctc", "desired salary", "salary expectation"]),
  k("notice-period", "Notice period", "Work", "text", ["notice period", "availability", "start date", "available from"]),
  k("work-authorization", "Work authorization", "Work", "text", ["work authorization", "authorized to work", "work permit", "visa status"]),
  k("requires-sponsorship", "Requires sponsorship", "Work", "boolean", ["sponsorship", "require sponsorship", "visa sponsorship"]),
  k("school", "School", "Education", "text", ["school", "university", "college", "institution"]),
  k("degree", "Degree", "Education", "text", ["degree", "qualification"]),
  k("field-of-study", "Field of study", "Education", "text", ["field of study", "major", "discipline", "specialization"]),
  k("graduation-year", "Graduation year", "Education", "number", ["graduation year", "year of graduation", "passing year", "graduated"]),
  k("gpa", "GPA", "Education", "text", ["gpa", "cgpa", "grade"]),
  k("url", "Website", "Links", "url", ["website", "personal website", "homepage", "url"]),
  k("linkedin", "LinkedIn", "Links", "url", ["linkedin", "linkedin profile", "linkedin url"]),
  k("github", "GitHub", "Links", "url", ["github", "github profile", "github url"]),
  k("portfolio", "Portfolio", "Links", "url", ["portfolio", "portfolio url", "work samples"]),
  k("twitter", "X / Twitter", "Links", "url", ["twitter", "x handle", "x profile"]),
  k("resume-file", "Resume", "Documents", "file", ["resume", "cv", "curriculum vitae", "upload resume"]),
  k("cover-letter", "Cover letter", "Documents", "longtext", ["cover letter", "motivation", "why do you want", "about you"]),
  k("summary", "About me", "Documents", "longtext", ["about", "summary", "bio", "introduce yourself", "tell us about yourself"]),
];

export const PROFILE_KEY_SET = new Set(PROFILE_KEYS.map((p) => p.key));

export const profileMeta = (key: string) => PROFILE_KEYS.find((p) => p.key === key);

export type Profile = Record<string, string>;

export const COUNTRIES: Record<string, string[]> = {
  US: ["United States", "United States of America", "USA", "U.S.", "America"],
  GB: ["United Kingdom", "UK", "Great Britain", "England", "Britain"],
  IN: ["India", "Bharat"],
  CA: ["Canada"],
  AU: ["Australia"],
  DE: ["Germany", "Deutschland"],
  FR: ["France"],
  ES: ["Spain"],
  IT: ["Italy"],
  NL: ["Netherlands", "Holland"],
  SG: ["Singapore"],
  AE: ["United Arab Emirates", "UAE"],
  JP: ["Japan"],
  CN: ["China"],
  BR: ["Brazil"],
  MX: ["Mexico"],
  IE: ["Ireland"],
  SE: ["Sweden"],
  CH: ["Switzerland"],
  NZ: ["New Zealand"],
};

export function countryNames(value: string): string[] {
  const v = value.trim();
  const code = v.toUpperCase();
  if (COUNTRIES[code]) return [code, ...COUNTRIES[code]];
  for (const [c, names] of Object.entries(COUNTRIES)) {
    if (names.some((n) => n.toLowerCase() === v.toLowerCase())) return [c, ...names];
  }
  return [v];
}
