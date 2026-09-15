import { redirect } from "next/navigation";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getAllClients } from "@/lib/brands";
import { getAccountManagerUsers } from "@/lib/staff";
import { getDb } from "@/lib/db";
import { seedOnboardingTasks } from "@/lib/onboarding-tasks";

async function createBrand(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;

  const brandName = (formData.get("brandName") as string)?.trim();
  const clientId = (formData.get("clientId") as string) || null;
  const newClientName = (formData.get("newClientName") as string)?.trim() || null;
  const accountManagerUserId = (formData.get("accountManagerUserId") as string) || null;
  const slackChannelId = (formData.get("slackChannelId") as string)?.trim() || null;
  if (!brandName) return;
  if (!clientId && !newClientName) return;

  const sql = getDb();
  let finalClientId = clientId;
  if (!finalClientId) {
    // Left without a clerk_org_id — the same "pre-seeded, not yet linked" shape the Clerk
    // organization.created webhook already knows how to adopt (matched by name) once this client
    // actually signs up, instead of creating a duplicate client row at that point.
    const inserted = await sql`insert into clients (name) values (${newClientName}) returning id`;
    finalClientId = inserted[0].id;
  }

  const newBrand = await sql`
    insert into brands (client_id, name, channels_enabled)
    values (${finalClientId}, ${brandName}, '{}')
    returning id
  `;
  const brandId = newBrand[0].id;
  await seedOnboardingTasks(brandId);

  if (accountManagerUserId) {
    await sql`
      insert into account_manager_assignments (user_id, client_id)
      values (${accountManagerUserId}, ${finalClientId})
      on conflict do nothing
    `;
  }
  if (slackChannelId) {
    await sql`update brands set slack_channel_id = ${slackChannelId} where id = ${brandId}`;
  }

  redirect(`/internal/brand/${brandId}`);
}

export default async function NewBrandPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const clients = await getAllClients();
  const accountManagers = await getAccountManagerUsers();

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; All brands
      </a>
      <h1 style={{ marginBottom: 24 }}>Add a new brand</h1>

      <div className="card" style={{ maxWidth: 560 }}>
        <form action={createBrand} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            Brand name
            <br />
            <input name="brandName" required style={{ width: "100%" }} />
          </label>

          <label>
            Client
            <br />
            <select name="clientId" defaultValue="" style={{ width: "100%" }}>
              <option value="">— Create a new client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            New client name
            <br />
            <input name="newClientName" style={{ width: "100%" }} />
            <br />
            <small style={{ color: "var(--muted)" }}>Only used if "Create a new client" is selected above.</small>
          </label>

          <label>
            Account manager
            <br />
            <select name="accountManagerUserId" defaultValue="" style={{ width: "100%" }}>
              <option value="">Unassigned</option>
              {accountManagers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            Slack channel ID
            <br />
            <input name="slackChannelId" placeholder="C0123ABC456" style={{ width: "100%" }} />
            <br />
            <small style={{ color: "var(--muted)" }}>
              Optional — find it in Slack: open the channel → channel name → "About" tab → scroll to the bottom.
              Can also be set later from the brand's own page.
            </small>
          </label>

          <button type="submit" style={{ alignSelf: "flex-start" }}>
            Create brand
          </button>
        </form>
      </div>
      <p style={{ marginTop: 16 }}>
        <small style={{ color: "var(--muted)" }}>
          This seeds the standard ~38-task onboarding checklist automatically.
        </small>
      </p>
    </main>
  );
}
