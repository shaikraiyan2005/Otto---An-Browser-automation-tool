import { AskOutput, AskRequest } from "@otto/shared";
import { structured } from "@/lib/ai";
import { body, json, options, route } from "@/lib/http";
import { ASK_SYSTEM } from "@/lib/prompts";
import { getProfile, getSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const POST = route(async (req: Request) => {
  const a = await body(req, AskRequest);
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  const user = [
    `Page: ${a.page.title} — ${a.page.url}`,
    a.element
      ? [`Selected element: <${a.element.tag}> at ${a.element.path}`, `Headings above: ${a.element.headings.join(" / ")}`, "<element_html>", a.element.html, "</element_html>"].join("\n")
      : ["No element selected. Page text:", "<page_text>", a.page.text.slice(0, 20000), "</page_text>"].join("\n"),
    "",
    "Fields (ref|kind|label|attributes):",
    ...a.fields.map((f) => f.line),
    "",
    "Clickables (ref|label):",
    ...a.clickables.map((c) => c.line),
    "",
    "Profile values:",
    ...Object.entries(profile).map(([k, v]) => `${k} = ${v}`),
    "",
    `User request: ${a.prompt}`,
  ].join("\n");
  const { data, usage } = await structured({
    schema: AskOutput,
    system: ASK_SYSTEM,
    user,
    model: settings.model,
    effort: settings.effortAsk,
    maxTokens: 8000,
  });
  const refs = new Set([...a.fields.map((f) => f.ref), ...a.clickables.map((c) => c.ref)]);
  const actions = data.actions.filter((x) => refs.has(x.ref));
  return json({ answer: data.answer, actions, usage });
});
