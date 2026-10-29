import { RecipeInput } from "@otto/shared";
import { db } from "@/lib/db";
import { body, json, options, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = route(async () => {
  const recipes = await db.recipe.findMany({ orderBy: { updatedAt: "desc" } });
  return json({ recipes });
});

export const POST = route(async (req: Request) => {
  const r = await body(req, RecipeInput);
  const data = {
    origin: r.origin,
    path: r.path,
    formSig: r.formSig,
    title: r.title,
    steps: r.steps as object[],
    stats: r.stats,
  };
  const existing =
    (r.id && (await db.recipe.findUnique({ where: { id: r.id } }))) ||
    (await db.recipe.findFirst({ where: { origin: r.origin, path: r.path, formSig: r.formSig } }));
  const recipe = existing
    ? await db.recipe.update({ where: { id: existing.id }, data })
    : await db.recipe.create({ data });
  return json({ recipe });
});
