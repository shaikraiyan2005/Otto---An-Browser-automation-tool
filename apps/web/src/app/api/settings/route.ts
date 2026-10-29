import { SettingsSchema } from "@otto/shared";
import { body, json, options, route } from "@/lib/http";
import { getSettings, setSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = route(async () => json(await getSettings()));

export const PUT = route(async (req: Request) => json(await setSettings(await body(req, SettingsSchema))));
