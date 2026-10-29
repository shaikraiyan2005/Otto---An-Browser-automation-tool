import { PageSummary, SummarizeRequest } from "@otto/shared";
import { structured } from "@/lib/ai";
import { body, json, options, route } from "@/lib/http";
import { SUMMARIZE_SYSTEM } from "@/lib/prompts";
import { getSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const POST = route(async (req: Request) => {
  const p = await body(req, SummarizeRequest);
  const settings = await getSettings();
  const user = [
    `URL: ${p.url}`,
    `Title: ${p.title}`,
    `Outline: ${p.headings.slice(0, 40).join(" / ")}`,
    `Forms: ${p.forms}, tables: ${p.tables}, links: ${p.links}`,
    "",
    "<page_text>",
    p.text.slice(0, 60000),
    "</page_text>",
  ].join("\n");
  const { data, usage } = await structured({
    schema: PageSummary,
    system: SUMMARIZE_SYSTEM,
    user,
    model: settings.model,
    effort: settings.effortSummarize,
    maxTokens: 8000,
  });
  return json({ summary: data, usage });
});
