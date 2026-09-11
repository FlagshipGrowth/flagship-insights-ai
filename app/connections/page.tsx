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
  if (!ctx) redirect("/onboarding");
  if (isInternalStaff(ctx)) redirect("/internal");
  if (!ctx.clientId) {
    return <main>Your account isn't linked to a client yet.</main>;
  }

  const brands = await getBrandsForClient(ctx.clientId);

  return (
    <main>
      <a href="/dashboard" className="back-link">
        &larr; Back to dashboard
      </a>
      <h1 style={{ marginBottom: 24 }}>Connections</h1>
      {brands.map((b: any) => (
        <section key={b.id} className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
          <h2>{b.name}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {Object.entries(PLATFORM_STATUS).map(([channel, status]) => (
              <li
                key={channel}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--paper-2)",
                }}
              >
                <span>
                  <strong style={{ textTransform: "capitalize" }}>{channel}</strong>
                  <br />
                  <small>{status}</small>
                </span>
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
