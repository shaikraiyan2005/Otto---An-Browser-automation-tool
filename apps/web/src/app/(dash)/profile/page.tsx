import { PROFILE_KEYS } from "@otto/shared";
import { getProfile } from "@/lib/store";
import { ProfileEditor } from "./ProfileEditor";

export default async function ProfilePage() {
  return <ProfileEditor initial={await getProfile()} keys={PROFILE_KEYS} />;
}
