import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getStore } from "@netlify/blobs";
import { getUserContext } from "@/lib/user-context";
import { provisionClientOrg } from "@/lib/clients";

async function createOrganizationWithLogo(formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const companyName = (formData.get("companyName") as string)?.trim();
  if (!companyName) return;

  let logoBlobKey: string | null = null;
  const logo = formData.get("logo") as File | null;
  if (logo && logo.size > 0) {
    const store = getStore("client-logos");
    logoBlobKey = `${crypto.randomUUID()}-${logo.name}`;
    await store.set(logoBlobKey, await logo.arrayBuffer(), { metadata: { contentType: logo.type } });
  }

  // Created directly via the Backend SDK (not the client-side <CreateOrganization> widget) so
  // the logo can be attached in this same request instead of racing the organization.created
  // webhook, which still fires afterward and is a safe no-op here (provisionClientOrg is
  // idempotent on both the client and brand rows).
  const clerk = await clerkClient();
  const org = await clerk.organizations.createOrganization({ name: companyName, createdBy: userId });
  await provisionClientOrg({ name: companyName, clerkOrgId: org.id, logoBlobKey });

  redirect("/dashboard");
}

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
      <form action={createOrganizationWithLogo} encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Company name
          <br />
          <input type="text" name="companyName" required style={{ width: "100%" }} />
        </label>
        <label>
          Logo (optional)
          <br />
          <input type="file" name="logo" accept="image/*" />
        </label>
        <button type="submit" style={{ alignSelf: "flex-start" }}>
          Create organization
        </button>
      </form>
    </main>
  );
}
