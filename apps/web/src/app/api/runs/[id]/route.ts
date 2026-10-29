import { db } from "@/lib/db";
import { fail, json, options, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const run = await db.run.findUnique({ where: { id: (await ctx.params).id } });
  return run ? json({ run }) : fail("not found", 404);
});
