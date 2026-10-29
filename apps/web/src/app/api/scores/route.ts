import { ScoreInput } from "@otto/shared";
import { db } from "@/lib/db";
import { body, json, options, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** Latest score per case, plus the last 200 scores. */
export const GET = route(async () => {
  const scores = await db.score.findMany({ orderBy: { createdAt: "desc" }, take: 200, omit: { details: true } });
  const latest: Record<string, (typeof scores)[number]> = {};
  for (const s of scores) latest[s.caseId] ??= s;
  return json({ latest, scores });
});

export const POST = route(async (req: Request) => {
  const s = await body(req, ScoreInput);
  const score = await db.score.create({ data: { ...s, details: (s.details ?? {}) as object } });
  return json({ id: score.id });
});
