import { z } from "zod";

/* ---------- /api/map ---------- */

export const MapRequest = z.object({
  page: z.object({ url: z.string(), title: z.string() }),
  fields: z.array(z.object({ ref: z.string(), line: z.string() })),
  profile: z.record(z.string(), z.string()),
  allowGenerate: z.boolean(),
});
export type MapRequest = z.infer<typeof MapRequest>;

export const MapOutput = z.object({
  mappings: z.array(
    z.object({
      ref: z.string(),
      source: z.enum(["profile", "generated", "skip"]),
      key: z.string().nullable(),
      value: z.string().nullable(),
      confidence: z.number(),
      reason: z.string(),
    }),
  ),
});
export type MapOutput = z.infer<typeof MapOutput>;

/* ---------- /api/summarize ---------- */

export const SummarizeRequest = z.object({
  url: z.string(),
  title: z.string(),
  text: z.string(),
  headings: z.array(z.string()),
  forms: z.number(),
  tables: z.number(),
  links: z.number(),
});
export type SummarizeRequest = z.infer<typeof SummarizeRequest>;

export const PageSummary = z.object({
  purpose: z.string(),
  keyPoints: z.array(z.string()),
  entities: z.array(z.object({ name: z.string(), type: z.string() })),
  actions: z.array(z.string()),
  risks: z.array(z.string()),
  readingTimeMin: z.number(),
});
export type PageSummary = z.infer<typeof PageSummary>;

/* ---------- /api/ask ---------- */

export const AskRequest = z.object({
  prompt: z.string().min(1),
  page: z.object({ url: z.string(), title: z.string(), text: z.string() }),
  element: z
    .object({
      ref: z.string(),
      tag: z.string(),
      text: z.string(),
      html: z.string(),
      path: z.string(),
      headings: z.array(z.string()),
    })
    .nullable(),
  fields: z.array(z.object({ ref: z.string(), line: z.string() })),
  clickables: z.array(z.object({ ref: z.string(), line: z.string() })),
  profile: z.record(z.string(), z.string()),
});
export type AskRequest = z.infer<typeof AskRequest>;

export const AskOutput = z.object({
  answer: z.string(),
  actions: z.array(
    z.object({
      op: z.enum(["fill", "select", "check", "click"]),
      ref: z.string(),
      value: z.string().nullable(),
      why: z.string(),
    }),
  ),
});
export type AskOutput = z.infer<typeof AskOutput>;

/* ---------- storage ---------- */

export const ProfileUpdate = z.object({ profile: z.record(z.string(), z.string()) });

export const SettingsSchema = z.object({
  model: z.string(),
  effortMap: z.enum(["low", "medium", "high"]),
  effortSummarize: z.enum(["low", "medium", "high"]),
  effortAsk: z.enum(["low", "medium", "high"]),
  autoSaveRecipes: z.boolean(),
  confidenceAutofill: z.number().min(0).max(1),
  allowGenerate: z.boolean(),
});

export const RunReportSchema = z.object({
  kind: z.enum(["fill", "replay", "summarize", "ask"]),
  url: z.string(),
  origin: z.string(),
  caseId: z.string().nullish(),
  model: z.string().nullish(),
  fieldsFound: z.number().int(),
  filled: z.number().int(),
  verified: z.number().int(),
  failed: z.number().int(),
  skipped: z.number().int(),
  llmCalls: z.number().int(),
  tokensIn: z.number().int(),
  tokensOut: z.number().int(),
  cacheRead: z.number().int(),
  recipeId: z.string().nullish(),
  healed: z.number().int(),
  timings: z.object({
    scan: z.number(),
    match: z.number(),
    ai: z.number(),
    fill: z.number(),
    total: z.number(),
  }),
  details: z.unknown(),
});

export const RecipeInput = z.object({
  id: z.string().optional(),
  origin: z.string(),
  path: z.string(),
  formSig: z.string(),
  title: z.string(),
  steps: z.array(z.record(z.string(), z.unknown())),
  stats: z.object({ runs: z.number(), healed: z.number(), lastRunAt: z.number() }),
});

export const ScoreInput = z.object({
  caseId: z.string(),
  correct: z.number().int(),
  wrong: z.number().int(),
  empty: z.number().int(),
  trapViolations: z.number().int(),
  total: z.number().int(),
  details: z.unknown(),
});
