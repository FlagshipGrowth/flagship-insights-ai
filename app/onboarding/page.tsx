import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { CreateOrganization } from "@clerk/nextjs";
import { getUserContext } from "@/lib/user-context";

// Reached when someone is authenticated with Clerk but has no matching `users` row yet —
// either they haven't created/joined an organization, or the Clerk webhook hasn't landed yet.
// This is NOT "not signed in": don't redirect here to /sign-in, that would loop.
export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const ctx = await getUserContext();
  if (ctx) redirect(ctx.clientId ? "/dashboard" : "/internal");

  return (
    <main style={{ maxWidth: 480 }}>
      <h1>Set up your organization</h1>
      <p>
        Create your organization to get started, or ask whoever invited you to add you to
        theirs — you'll land here until that happens.
      </p>
      <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
    </main>
  );
}
