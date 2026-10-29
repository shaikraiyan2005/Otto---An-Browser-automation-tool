import type { FieldDescriptor } from "@otto/shared";
import { describe, expect, it } from "vitest";
import { formatDate, formatFor, matchByRules, ruleKey } from "../src/match";
import { resolveSteps } from "../src/recipe";
import { fieldLine } from "../src/serialize";
import { bestOption } from "../src/util";

const fp = { tag: "input", type: "text", id: "", name: "", classes: [], ariaLabel: "", role: "", autocomplete: "", label: "", placeholder: "", neighborText: [], section: "", xpath: "", rect: { x: 0, y: 0, w: 100, h: 20 } };

function field(p: Partial<FieldDescriptor>): FieldDescriptor {
  return { ref: "1", frameId: 0, kind: "text", widget: "native-text", label: "", labelSource: "label", required: false, rect: fp.rect, fieldSig: "x", fp: { ...fp, label: p.label ?? "" }, ...p };
}

const profile = {
  "given-name": "Ada",
  "family-name": "Lovelace",
  name: "Ada Lovelace",
  email: "ada@example.com",
  country: "US",
  bday: "1990-12-10",
  "address-line1": "221 Engine Way",
  "address-line2": "Apt 5",
  "street-address": "221 Engine Way, Apt 5",
  "organization-title": "Engineer",
  "requires-sponsorship": "No",
  "cover-letter": "Hello",
};

describe("ruleKey", () => {
  it("prefers the longest synonym", () => {
    expect(ruleKey(field({ label: "Last name" }))?.key).toBe("family-name");
    expect(ruleKey(field({ label: "First name" }))?.key).toBe("given-name");
    expect(ruleKey(field({ label: "Full name" }))?.key).toBe("name");
  });
  it("uses autocomplete first", () => {
    expect(ruleKey(field({ label: "Something", autocomplete: "email" }))).toEqual({ key: "email", confidence: 0.95 });
  });
  it("keeps long-text questions away from short keys", () => {
    expect(ruleKey(field({ label: "What excites you about this role?", kind: "longtext" }))?.key).toBe("summary");
    expect(ruleKey(field({ label: "Tell us about yourself", kind: "longtext" }))?.key).toBe("summary");
  });
  it("detects honorific selects by options", () => {
    expect(ruleKey(field({ label: "Title", kind: "choice", options: ["Mr", "Ms", "Dr"] }))?.key).toBe("honorific-prefix");
  });
});

describe("formatFor", () => {
  it("formats dates to the field format", () => {
    expect(formatDate("1990-12-10", "MM/DD/YYYY")).toBe("12/10/1990");
    expect(formatFor(field({ kind: "date", dateFormat: "DD/MM/YYYY" }), "bday", "1990-12-10")).toBe("10/12/1990");
  });
  it("picks the option text for countries", () => {
    expect(formatFor(field({ kind: "choice", options: ["Canada", "United States", "India"] }), "country", "US")).toBe("United States");
    expect(formatFor(field({ kind: "choice", options: ["Canada"] }), "country", "US")).toBeNull();
  });
});

describe("matchByRules", () => {
  it("skips traps and sensitive fields, maps the rest", () => {
    const fields = [
      field({ ref: "a", label: "First name" }),
      field({ ref: "b", label: "Website", trap: "hidden" }),
      field({ ref: "c", label: "Password", blocked: "sensitive" }),
      field({ ref: "d", label: "Favourite colour" }),
    ];
    const r = matchByRules(fields, profile);
    expect(r.mappings.find((m) => m.ref === "a")?.value).toBe("Ada");
    expect(r.mappings.find((m) => m.ref === "b")?.source).toBe("skip");
    expect(r.mappings.find((m) => m.ref === "c")?.enabled).toBe(false);
    expect(r.leftovers.map((f) => f.ref)).toEqual(["d"]);
  });
  it("turns street address into line 1 when line 2 exists", () => {
    const r = matchByRules([field({ ref: "a", label: "Street address" }), field({ ref: "b", label: "Address line 2" })], profile);
    expect(r.mappings.find((m) => m.ref === "a")?.value).toBe("221 Engine Way");
  });
});

describe("recipes", () => {
  it("heals a renamed field by its profile key", () => {
    const steps = [{ key: "given-name", source: "rule" as const, widget: "native-text" as const, kind: "text" as const, fieldSig: "old", label: "First name", fp: { ...fp, label: "First name", name: "first" } }];
    const live = [field({ ref: "9", label: "Given name", fieldSig: "new", fp: { ...fp, label: "Given name", name: "applicant[first]" } })];
    expect(resolveSteps(steps, live)[0]).toMatchObject({ status: "healed", ref: "9" });
  });
});

describe("helpers", () => {
  it("serializes a field compactly", () => {
    expect(fieldLine(field({ ref: "f3", label: "Country", kind: "choice", options: ["A", "B"], required: true }))).toBe("f3|choice|Country|req|opts: A; B");
  });
  it("matches options fuzzily", () => {
    expect(bestOption(["Bachelor of Arts", "Bachelor of Science"], ["bachelor of science"])).toBe(1);
  });
});
