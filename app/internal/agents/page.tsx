import { redirect } from "next/navigation";
import { getUserContext, isOwner } from "@/lib/user-context";

function AgentCard({
  name,
  status,
  statusVariant,
  description,
  facts,
  href,
  linkLabel,
}: {
  name: string;
  status: string;
  statusVariant: "approved" | "medium" | "pending";
  description: string;
  facts: { label: string; value: string }[];
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{name}</h3>
        <span className={`badge badge-${statusVariant}`}>{status}</span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: "0.9rem", lineHeight: 1.5 }}>{description}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: href ? 12 : 0 }}>
        {facts.map((f) => (
          <div key={f.label} style={{ display: "flex", gap: 8, fontSize: "0.8rem" }}>
            <span style={{ color: "var(--muted)", minWidth: 90, flexShrink: 0 }}>{f.label}</span>
            <span>{f.value}</span>
          </div>
        ))}
      </div>
      {href && (
        <a href={href} style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          {linkLabel ?? "Open →"}
        </a>
      )}
    </div>
  );
}

function PlannedCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="card" style={{ opacity: 0.8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{name}</h3>
        <span className="badge badge-pending">Planned</span>
      </div>
      <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

export default async function AgentsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  return (
    <main style={{ maxWidth: 1000 }}>
      <header style={{ marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>Agents</h1>
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 24 }}>
        <small>The AI agents working across Flagship's own operations and client brands — what each one does, how it's triggered, and what's next.</small>
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 12 }}>Active</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <AgentCard
            name="Meta Ad Manager"
            status="Active"
            statusVariant="approved"
            description="Reviews Flagship Growth's own Meta Ads account, calls out real performance shifts (cost-per-lead, CTR, dead stretches), and drafts one new on-brand creative test a week — generated from our real brand guidelines, uploaded to Meta, and always left paused for manual review. It never activates an ad, never edits a live campaign, and never touches any account but our own."
            facts={[
              { label: "Scope", value: "Flagship's own ad account only (1287113856507273)" },
              { label: "Trigger", value: "Scheduled — daily metrics sync at 6:23am, full review Mondays 7:51am" },
              { label: "Safeguards", value: "Read-only on existing ads · new creative always paused, never activated" },
            ]}
            href="/internal/marketing"
            linkLabel="View recommendations →"
          />
          <AgentCard
            name="SEO Listing Agent"
            status="Active"
            statusVariant="medium"
            description="Drafts Amazon listing copy for a client's product — researches the brand's own site plus keyword and competitor data (Data Dive, Helium10), then writes title options, bullets, description, backend search terms, and alt text, with a built-in Amazon-compliance check. Delivers the draft to a shared Google Sheet for the account manager to review; nothing publishes to Amazon automatically."
            facts={[
              { label: "Scope", value: "Per-product, any client brand" },
              { label: "Trigger", value: "Manual — /seo-listing in Slack, or a CSV bulk upload from a brand's page" },
              { label: "Output", value: "Draft in a shared Google Sheet, reviewed and published by an AM" },
            ]}
          />
          <AgentCard
            name="TikTok Shop Strategist"
            status="Active (reporting only)"
            statusVariant="medium"
            description="Pulls TikTok Shop performance (GMV, affiliate funnel, shop health) from each brand's Euka and Reacher accounts into that brand's dashboard, alongside a structured strategy brief the account team maintains (audience, creator fit, economics, guardrail envelope). Outreach automation, creator messaging, and A/B testing are built into the design but not live — no campaign, message, or spend action happens without a separate sign-off, per the module spec."
            facts={[
              { label: "Scope", value: "TUBR, Smood Sweets, Jax Athletics — SuperMush explicitly excluded" },
              { label: "Trigger", value: "Scheduled — daily metrics sync" },
              { label: "Blocked on", value: "Euka connections for these 3 brands (only SuperMush is connected today)" },
            ]}
            href="/internal"
            linkLabel="Open a brand's page →"
          />
          <AgentCard
            name="Sellerise Insights"
            status="Active"
            statusVariant="approved"
            description="Pulls real Amazon seller-analytics data from Sellerise into each brand's dashboard — revenue, margin, PPC, payouts, Subscribe & Save, reviews, and keyword rank all show up as the brand's real 'amazon' channel data. Diagnostic findings (Smart Alerts, PPC waste, inventory risk, sales-change drivers, reimbursement highlights, keyword rank drops, search-term harvesting opportunities) post as internal-only recommendations on each brand's page — clients only ever see the core numbers, never the raw diagnosis."
            facts={[
              { label: "Scope", value: "16 brand rows across 14 Sellerise accounts, including SuperMush's Amazon business" },
              { label: "Trigger", value: "Scheduled — daily sync" },
              { label: "Visibility", value: "Core metrics client-visible; all diagnosis internal-only" },
            ]}
            href="/internal"
            linkLabel="Open a brand's page →"
          />
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: 4 }}>Planned</h2>
        <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 12 }}>
          <small>Not built yet — next up as the underlying data or integrations come online.</small>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <PlannedCard
            name="Employee Performance Agent"
            description="Summarizes task completion, timelines, and output per employee for Admin View, once the task system tracks completed_at/completed_by."
          />
          <PlannedCard
            name="QuickBooks Financial Agent"
            description="Surfaces P&L, cash flow, and other financial insights into Admin View automatically — blocked on registering a QuickBooks Developer app."
          />
          <PlannedCard
            name="CRM Follow-up Agent"
            description="Watches the sales pipeline for stale leads and drafts follow-up outreach for review, instead of leads going quiet in the New/Hot queue."
          />
          <PlannedCard
            name="Google Analytics Agent"
            description="Would extend Marketing Efforts with site traffic and conversion data alongside Meta Ads — blocked until a Google Analytics connector is added to this workspace."
          />
        </div>
      </section>
    </main>
  );
}
