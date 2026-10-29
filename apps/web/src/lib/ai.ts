import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Usage } from "@otto/shared";
import type { z } from "zod";
import { HttpError } from "./http";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}

export async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  user: string;
  model: string;
  effort: "low" | "medium" | "high";
  maxTokens: number;
}): Promise<{ data: z.infer<S>; usage: Usage }> {
  const started = Date.now();
  let res;
  try {
    res = await anthropic().messages.parse({
      model: opts.model,
      max_tokens: opts.maxTokens,
      output_config: { effort: opts.effort, format: zodOutputFormat(opts.schema) },
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.user }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "rate limited");
    if (e instanceof Anthropic.AuthenticationError) throw new HttpError(401, "invalid ANTHROPIC_API_KEY");
    if (e instanceof Anthropic.APIConnectionError) throw new HttpError(503, "cannot reach Claude");
    if (e instanceof Anthropic.APIError) throw new HttpError(502, e.message);
    if (e instanceof Error && /credentials|api key|apiKey/i.test(e.message)) throw new HttpError(401, "ANTHROPIC_API_KEY missing");
    throw e;
  }
  if (res.stop_reason === "refusal") throw new HttpError(422, "model declined the request");
  if (res.stop_reason === "max_tokens") throw new HttpError(502, "model output truncated");
  if (!res.parsed_output) throw new HttpError(502, "model returned unparseable output");
  return {
    data: res.parsed_output as z.infer<S>,
    usage: {
      model: res.model,
      tokensIn: res.usage.input_tokens,
      tokensOut: res.usage.output_tokens,
      cacheRead: res.usage.cache_read_input_tokens ?? 0,
      ms: Date.now() - started,
    },
  };
}
