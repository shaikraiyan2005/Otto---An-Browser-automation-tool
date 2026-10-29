import { ENGINE_VERSION } from "@otto/shared";
import { hasCredentials } from "@/lib/ai";
import { db } from "@/lib/db";
import { json, options, route } from "@/lib/http";
import { getSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = route(async () => {
  let database = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }
  const settings = database === "ok" ? await getSettings() : null;
  return json({
    ok: database === "ok",
    db: database,
    hasApiKey: hasCredentials(),
    model: settings?.model ?? process.env.OTTO_MODEL ?? null,
    version: ENGINE_VERSION,
  });
});
