import { db } from "@/lib/db";
import { fail, json, options, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const recipe = await db.recipe.findUnique({ where: { id: (await ctx.params).id } });
  return recipe ? json({ recipe }) : fail("not found", 404);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  await db.recipe.delete({ where: { id: (await ctx.params).id } }).catch(() => null);
  return json({ ok: true });
});
