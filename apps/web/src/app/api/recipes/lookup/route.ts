import { db } from "@/lib/db";
import { fail, json, options, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** Exact form signature first, then every recipe saved for the same origin + path (the panel picks the best by healing score). */
export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const origin = q.get("origin");
  const path = q.get("path") ?? "/";
  const formSig = q.get("formSig");
  if (!origin) return fail("origin required");
  const exact = formSig ? await db.recipe.findFirst({ where: { origin, formSig }, orderBy: { updatedAt: "desc" } }) : null;
  const candidates = exact
    ? []
    : await db.recipe.findMany({ where: { origin, path }, orderBy: { updatedAt: "desc" }, take: 5 });
  return json({ exact, candidates });
});
