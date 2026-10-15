// The "who's sending you this" half of the prospect-facing audit page, built from Flagship's
// overview deck (Joey, 2026-10-15): stats, partner badges, channel pitch, main-image case studies,
// the first-30-days plan, brand partners, and the founders. Images in public/outbound/ were cut
// from that deck. Results quoted here are the ones published in the deck or on
// flagshipgrowth.com/work; don't add numbers that aren't in either.

const STATS = [
  { value: "$650M+", label: "Generated for clients" },
  { value: "200+", label: "Brand partners scaled" },
  { value: "30+ yrs", label: "Combined operator experience" },
  { value: "10+", label: "Marketplaces & channels" },
];

const h2 = { fontSize: "1.35rem", margin: "0 0 6px" } as const;
const lede = { color: "var(--muted)", marginTop: 0, marginBottom: 16, lineHeight: 1.5 } as const;
const section = { marginBottom: 44 } as const;

export function FlagshipHeader({ companyName }: { companyName: string }) {
  return (
    <header style={{ background: "var(--ink)", color: "var(--paper)", borderRadius: 16, padding: "22px 24px", marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lockup-paper.svg" alt="Flagship Growth" style={{ height: 26 }} />
        <span style={{ fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-lime)" }}>
          Prepared for {companyName}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 20 }}>
        {STATS.map((s) => (
          <div key={s.label}>
            <div style={{ fontFamily: "var(--font-heading), system-ui, sans-serif", fontSize: "1.7rem", fontWeight: 700, color: "var(--paper)" }}>{s.value}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--accent-lime)" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <p style={{ margin: "18px 0 0", fontSize: "0.92rem", lineHeight: 1.5, color: "var(--paper-2)" }}>
        Amazon, Walmart and TikTok Shop account management for consumer brands, run by operators who&apos;ve done it at scale.
      </p>
    </header>
  );
}

const CHANNELS = [
  {
    key: "amazon" as const,
    name: "Amazon",
    body: "300M+ active customers on the largest ecommerce platform in the world. 1P or 3P: listing optimization, PPC, inventory forecasting and growth strategy.",
  },
  {
    key: "walmart" as const,
    name: "Walmart",
    body: "120M+ shoppers a month on Walmart.com, and not everyone is a Prime customer. Be where your customers are, optimized for conversion.",
  },
  {
    key: "tiktokShop" as const,
    name: "TikTok Shop",
    body: "A highly engaged, fast-growing audience and a real shot at a viral moment. Content strategy, creator engagement and ads, from launch to scale.",
  },
];

export function ChannelsSection({ walmart, tiktokShop }: { walmart: boolean | null; tiktokShop: boolean | null }) {
  const status = { amazon: true, walmart, tiktokShop };
  return (
    <section style={section}>
      <h2 style={h2}>One team across every channel you sell on</h2>
      <p style={lede}>We run all three under one account manager, so inventory, content and ads stay in sync.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {CHANNELS.map((c) => {
          const on = status[c.key];
          return (
            <div key={c.key} className="card" style={{ margin: 0, borderColor: on === false ? "var(--accent-blue)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <strong style={{ fontSize: "1.05rem" }}>{c.name}</strong>
                <small style={{ color: on === false ? "var(--accent-blue)" : "var(--muted)", fontWeight: 600 }}>
                  {on === true ? "You're here" : on === false ? "Open opportunity" : ""}
                </small>
              </div>
              <p style={{ fontSize: "0.88rem", lineHeight: 1.5, marginBottom: 0 }}>{c.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CaseStudiesSection() {
  return (
    <section style={section}>
      <h2 style={h2}>What a better main image does</h2>
      <p style={lede}>Two tests we ran for brands in your aisle. The main image is the first thing a shopper sees in search.</p>
      <figure className="card" style={{ margin: "0 0 14px", padding: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/outbound/opopop-ab.jpg" alt="Opopop main image A/B test, old versus new" style={{ width: "100%", borderRadius: 10 }} />
        <figcaption style={{ marginTop: 10, lineHeight: 1.5 }}>
          <strong>Opopop.</strong> We A/B tested a new main image that shows the flavors and calls out a &ldquo;No Burn
          Guarantee&rdquo;, answering a complaint shoppers raised about competitors. Units sold from search rose 25% and
          revenue 22%.
        </figcaption>
      </figure>
      <figure className="card" style={{ margin: 0, padding: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/outbound/ramen-bae-before-after.jpg" alt="Ramen Bae main image before and after" style={{ width: "100%", borderRadius: 10 }} />
        <figcaption style={{ marginTop: 10, lineHeight: 1.5 }}>
          <strong>Ramen Bae.</strong> Adding the &ldquo;#1 ramen toppings brand&rdquo; and &ldquo;Viral on TikTok&rdquo;
          proof to the main image improved units sold from search.
        </figcaption>
      </figure>
    </section>
  );
}

const FIRST_30_DAYS = [
  { title: "Inventory management", detail: "Weekly PO management, shipped vs on-hand, FC optimization." },
  { title: "Marketing roadmap & KPIs", detail: "Forecast, promotional calendar and the numbers we'll hold ourselves to." },
  { title: "Listing audit & SEO", detail: "Branded and non-branded keywords, title and description, competitive analysis." },
  { title: "Brand guidelines & assets", detail: "Lifestyle and product photos, infographics, mobile-first creative and video." },
  { title: "Brand Registry", detail: "Protect the brand and unlock trademark-owner tools." },
  { title: "A+ content", detail: "Enhanced branded content that answers objections and sells the line." },
  { title: "Paid advertising", detail: "Budget, launch optimized campaigns, and feed early learnings back fast." },
  { title: "Review support", detail: "A review audit and strategy for steady, compliant review growth." },
];

export function First30DaysSection() {
  return (
    <section style={section}>
      <h2 style={h2}>What the first 30 days look like</h2>
      <p style={lede}>Fast, high-impact deliverables first, then the long-term work: bundles, testing and external traffic.</p>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {FIRST_30_DAYS.map((s, i) => (
          <li key={s.title} className="card" style={{ margin: 0 }}>
            <small style={{ color: "var(--accent-blue)", fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</small>
            <div style={{ fontWeight: 700, margin: "2px 0 4px" }}>{s.title}</div>
            <div style={{ fontSize: "0.86rem", lineHeight: 1.45 }}>{s.detail}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const RESULTS = [
  { brand: "Opopop", result: "+97% YoY units, +89% YoY revenue on Amazon + Walmart" },
  { brand: "Rationale Brewing", result: "4x sales in 3 months, #5 in category, Amazon's Choice on its top keyword" },
  { brand: "SuperMush", result: "+74% YoY units, +42% YoY revenue across a 5-SKU line" },
  { brand: "Hapad", result: "Buy Box 50% → 96%, conversion 10% → 23%, $554K+ in sales" },
  { brand: "Wink (Carhartt)", result: "87% fewer item-level suppressions in 60 days" },
  { brand: "Mac Energy", result: "Top 50 in energy drinks within the first week of launch" },
];

export function BrandPartnersSection() {
  return (
    <section style={section}>
      <h2 style={h2}>Brands we&apos;ve grown</h2>
      <div className="card" style={{ padding: 10, marginBottom: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/outbound/brand-partners.jpg" alt="Flagship Growth brand partners" style={{ width: "100%", borderRadius: 8 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        {RESULTS.map((r) => (
          <div key={r.brand} style={{ borderLeft: "3px solid var(--accent-blue)", paddingLeft: 10 }}>
            <strong>{r.brand}</strong>
            <div style={{ fontSize: "0.86rem", lineHeight: 1.45 }}>{r.result}</div>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 14, marginBottom: 0 }}>
        <a href="https://www.flagshipgrowth.com/work">See the full case studies →</a>
      </p>
    </section>
  );
}

const FOUNDERS = [
  {
    name: "Joey Giazzon",
    role: "Co-founder · 10+ years in ecommerce",
    photo: "/outbound/joey.jpg",
    bio: "Launched private label brands in sporting goods, then ran Amazon strategy at a 150+ person agency, growing a 10-client portfolio from $30M to $50M a year across grocery, beauty, health, home and toys.",
  },
  {
    name: "Vinny Alvarez",
    role: "Co-founder · 13+ years as an operator",
    photo: "/outbound/vinny.jpg",
    bio: "Launched brands in toys and grocery, then grew an agency's Amazon division from $90M to $500M+ in managed revenue and wrote the growth playbooks its strategists ran on.",
  },
];

const TEAM = ["Advertising", "Marketing", "Catalog", "SEO", "Brand protection", "Account health", "Inventory"];

export function TeamSection() {
  return (
    <section style={section}>
      <h2 style={h2}>Who you&apos;d work with</h2>
      <p style={lede}>
        A dedicated account manager is your quarterback, backed by specialists in every function. Powered by people,
        supercharged by AI.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 14 }}>
        {FOUNDERS.map((f) => (
          <div key={f.name} className="card" style={{ margin: 0, display: "flex", gap: 14, alignItems: "flex-start" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.photo} alt={f.name} style={{ width: 84, height: 96, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
            <div>
              <strong>{f.name}</strong>
              <div style={{ fontSize: "0.78rem", color: "var(--accent-blue)", fontWeight: 600 }}>{f.role}</div>
              <p style={{ fontSize: "0.86rem", lineHeight: 1.45, margin: "6px 0 0" }}>{f.bio}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {TEAM.map((t) => (
          <span key={t} className="badge">{t}</span>
        ))}
      </div>
    </section>
  );
}

export function PartnerBadges() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/outbound/amazon-spn-verified-partner.jpg" alt="Amazon SPN Verified Partner" style={{ height: 64, borderRadius: 10 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/outbound/tiktok-shop-certified-agency.jpg" alt="TikTok Shop Certified Agency" style={{ height: 64, borderRadius: 10 }} />
      <small style={{ color: "var(--paper-2)", maxWidth: 320, lineHeight: 1.45 }}>
        Amazon SPN Verified Partner and TikTok Shop Certified Agency.
      </small>
    </div>
  );
}
