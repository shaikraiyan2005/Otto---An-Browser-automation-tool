import { MapOutput, MapRequest } from "@otto/shared";
import { structured } from "@/lib/ai";
import { body, json, options, route } from "@/lib/http";
import { MAP_SYSTEM } from "@/lib/prompts";
import { getProfile, getSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const POST = route(async (req: Request) => {
  const input = await body(req, MapRequest);
  if (input.fields.length === 0) return json({ mappings: [], usage: null });
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  const allowGenerate = input.allowGenerate && settings.allowGenerate;

  const user = [
    `Page: ${input.page.title} — ${input.page.url}`,
    `Generation allowed: ${allowGenerate ? "yes" : "no"}`,
    "",
    "Profile values:",
    ...Object.entries(profile).map(([k, v]) => `${k} = ${v}`),
    "",
    "Fields:",
    ...input.fields.map((f) => f.line),
  ].join("\n");

  const { data, usage } = await structured({
    schema: MapOutput,
    system: MAP_SYSTEM,
    user,
    model: settings.model,
    effort: settings.effortMap,
    maxTokens: 4000 + input.fields.length * 150,
  });

  const refs = new Set(input.fields.map((f) => f.ref));
  const mappings = data.mappings.filter((m) => refs.has(m.ref) && (allowGenerate || m.source !== "generated"));
  return json({ mappings, usage });
});
