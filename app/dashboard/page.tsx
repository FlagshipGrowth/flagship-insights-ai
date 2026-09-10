import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getBrandsForClient, getBrandMetrics, PERIODS, type Period } from "@/lib/metrics";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; period?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/sign-in");
  if (isInternalStaff(ctx)) redirect("/internal");
  if (!ctx.clientId) {
    return <main style={{ padding: 24 }}>Your account isn't linked to a client yet — contact Flagship Growth.</main>;
  }

  const brands = await getBrandsForClient(ctx.clientId);
  const { brand: brandParam, period: periodParam } = await searchParams;
  const brand = (brands.find((b: any) => b.id === brandParam) ?? brands[0]) as
    | { id: string; name: string; channels_enabled: string[] }
    | undefined;
  const period: Period = (PERIODS as string[]).includes(periodParam ?? "") ? (periodParam as Period) : "mtd";

  if (!brand) {
    return <main style={{ padding: 24 }}>No brands are set up on your account yet.</main>;
  }

  const metrics = await getBrandMetrics(brand.id, period);

  return (
    <main style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{brand.name}</h1>
        <UserButton />
      </header>
      <nav style={{ marginBottom: 16, display: "flex", gap: 16 }}>
        {PERIODS.map((p) => (
          <a key={p} href={`/dashboard?brand=${brand.id}&period=${p}`} style={{ fontWeight: p === period ? 700 : 400 }}>
            {p.toUpperCase()}
          </a>
        ))}
        <a href="/connections" style={{ marginLeft: "auto" }}>
          Connections
        </a>
      </nav>
      {metrics.length === 0 ? (
        <p>
          No metrics yet for this period —{" "}
          {brand.channels_enabled.length === 0
            ? "no channels connected yet."
            : "sync hasn't produced data for this range yet."}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th>Metric</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m: any, i: number) => (
              <tr key={i}>
                <td>{m.channel}</td>
                <td>{m.metric_key}</td>
                <td>{m.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
