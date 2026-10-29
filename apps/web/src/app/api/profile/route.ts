import { PROFILE_KEYS, ProfileUpdate } from "@otto/shared";
import { body, json, options, route } from "@/lib/http";
import { getProfile, setProfile } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = route(async () => json({ profile: await getProfile(), keys: PROFILE_KEYS }));

export const PUT = route(async (req: Request) => {
  const { profile } = await body(req, ProfileUpdate);
  const clean = Object.fromEntries(Object.entries(profile).filter(([k, v]) => k.trim() && v.trim() !== ""));
  return json({ profile: await setProfile(clean), keys: PROFILE_KEYS });
});
