import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getOutboundReport, getReweightSuggestion } from "@/lib/outbound-report";
import { saveWeightsAndRescore } from "@/lib/outbound";
import { AB_VARIABLE_LABELS } from "@/lib/outbound-ab";
import { SIGNAL_KEYS, SIGNAL_LABELS, type ScoringWeights } from "@/lib/outbound-scoring";

async function applySuggestionAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const weights = Object.fromEntries(SIGNAL_KEYS.map((k) => [k, Number(formData.get(k))])) as unknown as ScoringWeights;
  await saveWeightsAndRescore(weights, "Monthly re-weighting from reply data", ctx.email);
  revalidatePath("/internal/crm/outbound/report");
  revalidatePath("/internal/crm/outbound");
}

const pct = (v: number | null) => (v === null ? "–" : `${(v * 100).toFixed(1)}%`);

export default async function OutboundReportPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const { days: daysParam } = await searchParams;
  const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 7;
  const [r, reweight] = await Promise.all([getOutboundReport(days), getReweightSuggestion()]);

  const newBrands = r.newBrandsPerDay.reduce((s, d) => s + d.brands, 0);
  const sent = r.touchesPerDay.reduce((s, d) => s + d.email + d.linkedin + d.instagram, 0);

  return (
    <main style={{ maxWidth: 1000 }}>
      <a href="/internal/crm/outbound" className="back-link">
        &larr; Back to Outbound
      </a>
      <h1 style={{ marginBottom: 8 }}>Outbound report</h1>
      <nav className="pill-nav">
        {[7, 30, 90].map((d) => (
          <a key={d} href={`?days=${d}`} className={days === d ? "active" : ""}>
            Last {d} days
          </a>
        ))}
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          ["New brands contacted", newBrands, `${(newBrands / days).toFixed(1)}/day`],
          ["Messages sent", sent, `${(sent / days).toFixed(1)}/day`],
          ["Calls booked", r.callsBooked, "prospects marked Call booked"],
          ["Cost per booked call", r.costPerBookedCall === null ? "–" : `$${r.costPerBookedCall.toFixed(0)}`, `$${(r.helium10Spend + r.toolSpend).toFixed(0)} spend`],
        ].map(([label, value, sub]) => (
          <div key={label as string} className="card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{label}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{sub}</div>
          </div>
        ))}
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>By channel</h2>
        <div className="table-scroll">
          <table className="table-dense">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Messages sent</th>
                <th>Brands contacted</th>
                <th>Interested</th>
                <th>Positive reply rate</th>
              </tr>
            </thead>
            <tbody>
              {r.channels.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--muted)" }}>
                    Nothing sent in this period.
                  </td>
                </tr>
              )}
              {r.channels.map((c) => (
                <tr key={c.channel}>
                  <td>{c.channel}</td>
                  <td>{c.sent}</td>
                  <td>{c.brandsContacted}</td>
                  <td>{c.positiveReplies}</td>
                  <td>{pct(c.positiveRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.steps.length > 0 && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", fontSize: "0.85rem" }}>By sequence step</summary>
            <table className="table-dense">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Channel</th>
                  <th>Sent</th>
                  <th>Interested replies</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {r.steps.map((s) => (
                  <tr key={`${s.stepDay}-${s.channel}`}>
                    <td>{s.stepDay}</td>
                    <td>{s.channel}</td>
                    <td>{s.sent}</td>
                    <td>{s.positiveReplies}</td>
                    <td>{pct(s.positiveRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>By tier (all time)</h2>
        <div className="table-scroll">
          <table className="table-dense">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Prospects</th>
                <th>Contacted</th>
                <th>Audits sent</th>
                <th>Replied</th>
                <th>Interested</th>
                <th>Booked</th>
                <th>Audit-to-call</th>
              </tr>
            </thead>
            <tbody>
              {r.tiers.map((t) => (
                <tr key={t.tier}>
                  <td>{t.tier}</td>
                  <td>{t.prospects}</td>
                  <td>{t.contacted}</td>
                  <td>{t.auditsSent}</td>
                  <td>{t.replied}</td>
                  <td>{t.interested}</td>
                  <td>{t.booked}</td>
                  <td>{pct(t.auditToCallRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>A/B tests (day 1 email)</h2>
        <p style={{ marginTop: 0 }}>
          <small style={{ color: "var(--muted)" }}>
            One variable at a time. A winner is called on interested replies (never opens) once every variant has its minimum
            sends; it becomes the default and a new challenger starts.
          </small>
        </p>
        {r.tests.length === 0 && <small style={{ color: "var(--muted)" }}>The first test starts with the first enrollment.</small>}
        {r.tests.map((t) => (
          <div key={t.id} style={{ borderTop: "1px solid var(--paper-2)", padding: "10px 0" }}>
            <strong>{AB_VARIABLE_LABELS[t.variable]}</strong>{" "}
            <span className={`badge ${t.status === "running" ? "badge-medium" : "badge-approved"}`}>{t.status}</span>{" "}
            <small style={{ color: "var(--muted)" }}>
              started {new Date(t.startedAt).toLocaleDateString()} · needs {t.minSendsPerVariant} sends per variant
            </small>
            <ul style={{ fontSize: "0.85rem", margin: "6px 0 0", paddingLeft: 18 }}>
              {t.variants.map((v) => (
                <li key={v.id}>
                  {t.winnerVariantId === v.id && "🏆 "}
                  <strong>{v.label}</strong>: {v.content}{" "}
                  <span style={{ color: "var(--muted)" }}>
                    · {v.positiveReplies}/{v.sends} interested ({pct(v.positiveRate)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Scoring re-weight (monthly)</h2>
        <p style={{ marginTop: 0 }}>
          <small style={{ color: "var(--muted)" }}>
            Compares each signal&apos;s average score for brands that replied interested against the rest, and moves weight toward
            the signals that actually predict interest (half-way, so one month can&apos;t swing it). Based on {reweight.contacted}{" "}
            contacted brands, {reweight.positives} interested.
          </small>
        </p>
        <table className="table-dense" style={{ marginBottom: 10 }}>
          <thead>
            <tr>
              <th>Signal</th>
              <th>Avg (interested)</th>
              <th>Avg (others)</th>
              <th>Current weight</th>
              <th>Suggested</th>
            </tr>
          </thead>
          <tbody>
            {reweight.lift.map((l) => (
              <tr key={l.key}>
                <td>{SIGNAL_LABELS[l.key]}</td>
                <td>{l.positiveAvg.toFixed(2)}</td>
                <td>{l.otherAvg.toFixed(2)}</td>
                <td>{reweight.current[l.key]}</td>
                <td>{reweight.suggested ? reweight.suggested[l.key] : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {reweight.suggested ? (
          <form action={applySuggestionAction}>
            {SIGNAL_KEYS.map((k) => (
              <input key={k} type="hidden" name={k} value={reweight.suggested![k]} />
            ))}
            <button type="submit">Apply suggested weights and rescore</button>
          </form>
        ) : (
          <small style={{ color: "var(--muted)" }}>
            Not enough data yet: needs at least 150 contacted brands and 15 interested replies.
          </small>
        )}
      </section>
    </main>
  );
}
