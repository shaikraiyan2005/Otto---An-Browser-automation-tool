import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Usage } from "@otto/shared";
import { z } from "zod";
import { HttpError } from "./http";

type Effort = "low" | "medium" | "high";

interface StructuredOpts<S extends z.ZodType> {
  schema: S;
  system: string;
  user: string;
  model: string;
  effort: Effort;
  maxTokens: number;
}

const isGemini = (model: string) => model.startsWith("gemini");

export function hasCredentials(model = process.env.OTTO_MODEL ?? "") {
  if (isGemini(model)) return Boolean(process.env.GEMINI_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}

/** One structured (JSON) call. Models named gemini-* go to Google, everything else to Claude. */
export function structured<S extends z.ZodType>(opts: StructuredOpts<S>): Promise<{ data: z.infer<S>; usage: Usage }> {
  return isGemini(opts.model) ? gemini(opts) : claude(opts);
}

/* ---------------------------------------------------------------- Claude */

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

async function claude<S extends z.ZodType>(opts: StructuredOpts<S>): Promise<{ data: z.infer<S>; usage: Usage }> {
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

/* ---------------------------------------------------------------- Gemini (REST, structured output) */

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number };
  modelVersion?: string;
  error?: { code: number; message: string };
}

function jsonSchema(schema: z.ZodType) {
  const s = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

async function gemini<S extends z.ZodType>(opts: StructuredOpts<S>): Promise<{ data: z.infer<S>; usage: Usage }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(401, "GEMINI_API_KEY missing");
  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema(opts.schema),
        maxOutputTokens: opts.maxTokens,
        thinkingConfig: { thinkingLevel: opts.effort },
      },
    }),
  }).catch(() => {
    throw new HttpError(503, "cannot reach Gemini");
  });
  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    const msg = body.error?.message ?? `Gemini ${res.status}`;
    throw new HttpError(res.status === 429 ? 429 : res.status === 401 || res.status === 403 ? 401 : 502, msg);
  }
  const cand = body.candidates?.[0];
  if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") throw new HttpError(422, "model declined the request");
  if (cand?.finishReason === "MAX_TOKENS") throw new HttpError(502, "model output truncated");
  const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(502, "model returned unparseable output");
  }
  const checked = opts.schema.safeParse(parsed);
  if (!checked.success) throw new HttpError(502, "model output did not match the schema");
  const u = body.usageMetadata ?? {};
  return {
    data: checked.data as z.infer<S>,
    usage: {
      model: body.modelVersion ?? opts.model,
      tokensIn: u.promptTokenCount ?? 0,
      tokensOut: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      cacheRead: u.cachedContentTokenCount ?? 0,
      ms: Date.now() - started,
    },
  };
}
