import { RunReportSchema } from "@otto/shared";
import { db } from "@/lib/db";
import { body, json, options, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const limit = Math.min(Number(q.get("limit") ?? 100), 500);
  const kind = q.get("kind") ?? undefined;
  const caseId = q.get("caseId") ?? undefined;
  const runs = await db.run.findMany({
    where: { kind, caseId },
    orderBy: { createdAt: "desc" },
    take: limit,
    omit: { details: true },
  });
  return json({ runs });
});

export const POST = route(async (req: Request) => {
  const r = await body(req, RunReportSchema);
  const run = await db.run.create({
    data: {
      kind: r.kind,
      url: r.url,
      origin: r.origin,
      caseId: r.caseId ?? null,
      model: r.model ?? null,
      recipeId: r.recipeId ?? null,
      fieldsFound: r.fieldsFound,
      filled: r.filled,
      verified: r.verified,
      failed: r.failed,
      skipped: r.skipped,
      healed: r.healed,
      llmCalls: r.llmCalls,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      cacheRead: r.cacheRead,
      msScan: Math.round(r.timings.scan),
      msMatch: Math.round(r.timings.match),
      msAi: Math.round(r.timings.ai),
      msFill: Math.round(r.timings.fill),
      msTotal: Math.round(r.timings.total),
      details: (r.details ?? {}) as object,
    },
  });
  return json({ id: run.id });
});
