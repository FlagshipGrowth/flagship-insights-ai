import type { Tier } from "@/lib/outbound-scoring";

const VARIANT: Record<Tier, string> = { A: "badge-high", B: "badge-medium", C: "badge-low" };

export function OutboundTierBadge({ tier }: { tier: Tier | null }) {
  if (!tier) return <span style={{ color: "var(--muted)" }}>–</span>;
  return <span className={`badge ${VARIANT[tier]}`}>Tier {tier}</span>;
}
