import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuditByToken, type AuditFix } from "@/lib/outbound-audit";
import { getUserContext, isOwner } from "@/lib/user-context";

// The prospect-facing audit: the asset every Tier A/B outbound sequence links to. Anyone with the
// link can view an approved audit (no sign-in); a draft or rejected one only renders for owners
// previewing it from the CRM, with a banner saying so. Prints cleanly, so "Save as PDF" covers the
// plan's "link or PDF".

const BOOKING_URL = "https://calendly.com/joey-flagshipgrowth/30min";

export const metadata: Metadata = {
  title: "Amazon listing audit · Flagship Growth",
  robots: { index: false, follow: false },
};

const CHANNEL_LABEL = { walmart: "Walmart", tiktok_shop: "TikTok Shop", both: "Walmart and TikTok Shop" } as const;

function FixList({ title, fixes }: { title: string; fixes: AuditFix[] }) {
  if (fixes.length === 0) return null;
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: "1.15rem", marginBottom: 10 }}>{title}</h2>
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        {fixes.map((f, i) => (
          <li key={i} style={{ marginBottom: 10 }}>
            <strong>{f.title}</strong>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.5 }}>{f.detail}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const fmtNum = (n: number | null) => (n === null ? "–" : n.toLocaleString());
const fmtPrice = (n: number | null) => (n === null ? "–" : `$${n.toFixed(2)}`);

export default async function AuditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const audit = await getAuditByToken(token);
  if (!audit) notFound();

  const isPreview = audit.status !== "approved";
  if (isPreview) {
    const ctx = await getUserContext();
    if (!ctx || !isOwner(ctx)) notFound();
  }

  const f = audit.findings;
  const date = new Date(audit.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <main style={{ maxWidth: 820 }}>
      {isPreview && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--accent-blue)" }}>
          <strong>{audit.status === "rejected" ? "Rejected draft" : "Draft preview"}.</strong> Only owners can see this
          page until the audit is approved.{" "}
          <a href={`/internal/crm/outbound/${audit.prospectId}`}>Review it in the CRM →</a>
        </div>
      )}

      <p style={{ margin: 0, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
        {audit.kind === "launch" ? "Marketplace launch audit" : "Amazon listing audit"} · {audit.companyName} · {date}
      </p>
      <h1 style={{ fontSize: "2rem", lineHeight: 1.15, margin: "8px 0 14px" }}>{audit.headline}</h1>
      <p style={{ fontSize: "1.05rem", lineHeight: 1.6, marginTop: 0, marginBottom: 28 }}>{f.summary}</p>

      {(audit.hasMainImageConcept || audit.originalImageUrl) && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.15rem", marginBottom: 10 }}>Main image</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {audit.originalImageUrl && (
              <figure className="card" style={{ margin: 0, padding: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={audit.originalImageUrl} alt={`${audit.companyName} current main image`} style={{ width: "100%", aspectRatio: "1", objectFit: "contain", background: "#fff", borderRadius: 8 }} />
                <figcaption style={{ fontSize: "0.82rem", marginTop: 8, color: "var(--muted)" }}>Today</figcaption>
              </figure>
            )}
            {audit.hasMainImageConcept && (
              <figure className="card" style={{ margin: 0, padding: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/outbound/audit-image/${audit.shareToken}`} alt={`${audit.companyName} main image concept`} style={{ width: "100%", aspectRatio: "1", objectFit: "contain", background: "#fff", borderRadius: 8 }} />
                <figcaption style={{ fontSize: "0.82rem", marginTop: 8, color: "var(--muted)" }}>
                  Concept: your real product photo rebuilt to our main-image standards. AI-generated for illustration
                  only, not a finished asset.
                </figcaption>
              </figure>
            )}
          </div>
          {f.mainImageNotes && <p style={{ fontSize: "0.92rem", lineHeight: 1.5 }}>{f.mainImageNotes}</p>}
        </section>
      )}

      {f.keywordGaps.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.15rem", marginBottom: 4 }}>Keywords your competitors rank for and you don&apos;t</h2>
          <div className="card table-scroll" style={{ padding: 0, marginTop: 10 }}>
            <table className="table-dense">
              <thead>
                <tr>
                  <th>Search term</th>
                  <th>Searches / mo</th>
                  <th>Who ranks</th>
                  <th>You</th>
                </tr>
              </thead>
              <tbody>
                {f.keywordGaps.map((k) => (
                  <tr key={k.keyword}>
                    <td>{k.keyword}</td>
                    <td>{fmtNum(k.monthlySearchVolume)}</td>
                    <td style={{ whiteSpace: "normal" }}>{k.competitorsRanking || "–"}</td>
                    <td>{k.brandRank === null ? "Not ranking" : `#${k.brandRank}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {f.competitorBenchmark.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.15rem", marginBottom: 4 }}>How you compare</h2>
          <div className="card table-scroll" style={{ padding: 0, marginTop: 10 }}>
            <table className="table-dense">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Price</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                  <th>BSR</th>
                  <th>Images</th>
                </tr>
              </thead>
              <tbody>
                {f.competitorBenchmark.map((c, i) => (
                  <tr key={i} style={c.isBrand ? { background: "var(--paper-2)", fontWeight: 600 } : undefined}>
                    <td>{c.isBrand ? `${c.name} (you)` : c.name}</td>
                    <td>{fmtPrice(c.price)}</td>
                    <td>{c.rating === null ? "–" : c.rating.toFixed(1)}</td>
                    <td>{fmtNum(c.reviewCount)}</td>
                    <td>{c.bsr === null ? "–" : `#${c.bsr.toLocaleString()}`}</td>
                    <td style={{ whiteSpace: "normal", minWidth: 180 }}>{c.imageNote ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <FixList title="Image stack: highest-impact fixes" fixes={f.imageStackFixes} />
      <FixList title="A+ content" fixes={f.aPlusFixes} />
      <FixList title="Sponsored ads gaps" fixes={f.adsGaps} />

      {f.launchOpportunity && (
        <section className="card" style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.15rem", marginTop: 0 }}>The {CHANNEL_LABEL[f.launchOpportunity.channel]} opportunity</h2>
          <p style={{ lineHeight: 1.5 }}>{f.launchOpportunity.estimate}</p>
          <p style={{ lineHeight: 1.5, marginBottom: 0 }}>{f.launchOpportunity.plan}</p>
        </section>
      )}

      <section className="card" style={{ background: "var(--ink)", color: "var(--paper)", marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.2rem", marginTop: 0, color: "var(--paper)" }}>Want us to walk you through this?</h2>
        <p style={{ lineHeight: 1.5 }}>
          Flagship Growth runs Amazon, Walmart and TikTok Shop for CPG brands. This is a small slice of what we look at
          for our own clients. Grab 30 minutes and we&apos;ll go through what we&apos;d fix first.
        </p>
        <a href={BOOKING_URL} style={{ display: "inline-block", background: "var(--accent-lime)", color: "var(--ink)", padding: "10px 18px", borderRadius: 999, fontWeight: 700, textDecoration: "none" }}>
          Book a call with Joey →
        </a>
      </section>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
        Based on public listing data and third-party estimates as of {date}. Figures are estimates, not guarantees.
      </p>
    </main>
  );
}
