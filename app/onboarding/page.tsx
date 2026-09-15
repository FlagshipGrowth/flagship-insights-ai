import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getStore } from "@netlify/blobs";
import { getUserContext } from "@/lib/user-context";
import { provisionClientOrg } from "@/lib/clients";

async function createOrganizationWithLogo(formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  let logoBlobKey: string | null = null;
  const logo = formData.get("logo") as File | null;
  if (logo && logo.size > 0) {
    const store = getStore("client-logos");
    logoBlobKey = `${crypto.randomUUID()}-${logo.name}`;
    await store.set(logoBlobKey, await logo.arrayBuffer(), { metadata: { contentType: logo.type } });
  }

  // Clerk still needs an Organization to exist (it's the mechanism the rest of this app's access
  // model is built on — see organizationMembership.created), and `clients.name` needs a value —
  // both just take whatever name the person gave here for now. There's no separate "company
  // name" collected at all: real client/brand setup happens admin-side afterward (see
  // /internal/brands/new and CLAUDE.md's "we create the brand on our end"), so this is just an
  // identity for their account, not a real company record yet.
  //
  // Created directly via the Backend SDK (not the client-side <CreateOrganization> widget) so
  // the logo can be attached in this same request instead of racing the organization.created
  // webhook, which still fires afterward and is a safe no-op here (provisionClientOrg is
  // idempotent on both the client and brand rows).
  const clerk = await clerkClient();
  const org = await clerk.organizations.createOrganization({ name, createdBy: userId });
  await provisionClientOrg({ name, clerkOrgId: org.id, logoBlobKey });

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
      <h1>Finish signing up</h1>
      <p>
        Tell us your name to get started, or ask whoever invited you to add you to their
        account — you'll land here until that happens.
      </p>
      <form action={createOrganizationWithLogo} encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Your name
          <br />
          <input type="text" name="name" required style={{ width: "100%" }} />
        </label>
        <label>
          Logo (optional)
          <br />
          <input type="file" name="logo" accept="image/*" />
        </label>
        <button type="submit" style={{ alignSelf: "flex-start" }}>
          Continue
        </button>
      </form>
    </main>
  );
}
