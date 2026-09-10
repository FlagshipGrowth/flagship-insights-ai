import { redirect } from "next/navigation";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getBrandsForClient } from "@/lib/metrics";

// Statuses reflect docs/phase1-amazon-application.md and SPEC.md §3/§9 — update here as
// each platform's approval actually moves, don't let this drift from the real status.
const PLATFORM_STATUS: Record<string, string> = {
  amazon: "Pending Amazon SP-API/Ads developer approval.",
  meta: "Not started — built out as clients need it.",
  google: "Not started — built out as clients need it.",
  walmart: "Not started — built out as clients need it.",
  quickbooks: "Deprioritized — least important integration right now.",
};

export default async function ConnectionsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/sign-in");
  if (isInternalStaff(ctx)) redirect("/internal");
  if (!ctx.clientId) {
    return <main style={{ padding: 24 }}>Your account isn't linked to a client yet.</main>;
  }

  const brands = await getBrandsForClient(ctx.clientId);

  return (
    <main style={{ padding: 24 }}>
      <h1>Connections</h1>
      <p>
        <a href="/dashboard">&larr; Back to dashboard</a>
      </p>
      {brands.map((b: any) => (
        <section key={b.id} style={{ marginBottom: 24 }}>
          <h2>{b.name}</h2>
          <ul>
            {Object.entries(PLATFORM_STATUS).map(([channel, status]) => (
              <li key={channel} style={{ marginBottom: 8 }}>
                <strong>{channel}</strong>: {status}{" "}
                <button disabled title="Not available until the platform application is approved">
                  Connect
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
