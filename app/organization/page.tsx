import { redirect } from "next/navigation";
import { OrganizationProfile } from "@clerk/nextjs";
import { getUserContext, isInternalStaff } from "@/lib/user-context";

// Clerk's prebuilt OrganizationProfile handles invites and member roles entirely on its own —
// this satisfies SPEC.md §1/§2's "a client account can invite teammates" with no extra
// backend beyond the webhook that already syncs membership into `users`.
export default async function OrganizationPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (isInternalStaff(ctx)) redirect("/internal");

  return (
    <main style={{ display: "flex", justifyContent: "center" }}>
      <OrganizationProfile />
    </main>
  );
}
