import { fail, json, options, route } from "@/lib/http";
import { CASES, caseById } from "@/playground/cases";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (id === "all") return json({ cases: CASES });
  const c = caseById(id);
  return c ? json(c) : fail("unknown case", 404);
});
