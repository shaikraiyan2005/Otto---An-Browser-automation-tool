import type { FieldDescriptor } from "@otto/shared";

/** One compact line per field for the AI (≈10–25 tokens). */
export function fieldLine(f: FieldDescriptor): string {
  const parts = [f.ref, f.kind === "longtext" ? "longtext" : f.kind, f.label || "(no label)"];
  if (f.name && f.name !== f.label) parts.push(`name=${f.name}`);
  if (f.idAttr && f.idAttr !== f.name) parts.push(`id=${f.idAttr}`);
  if (f.autocomplete && f.autocomplete !== "off" && f.autocomplete !== "on") parts.push(`ac=${f.autocomplete}`);
  if (f.placeholder && f.placeholder !== f.label) parts.push(`ph=${f.placeholder}`);
  if (f.section) parts.push(`sec=${f.section}`);
  if (f.dateFormat) parts.push(`fmt=${f.dateFormat}`);
  if (f.required) parts.push("req");
  if (f.maxLength) parts.push(`max=${f.maxLength}`);
  if (f.options?.length) {
    const more = (f.optionCount ?? f.options.length) - f.options.length;
    parts.push(`opts: ${f.options.join("; ")}${more > 0 ? `; …(+${more})` : ""}`);
  }
  return parts.join("|");
}
