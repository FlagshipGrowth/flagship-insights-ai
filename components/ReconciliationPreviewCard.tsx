import type { ReconciliationPreview } from "@/lib/reports";

export function ReconciliationPreviewCard({ summary, reportUrl }: { summary: ReconciliationPreview; reportUrl?: string }) {
  return (
    <section className="card" style={{ marginBottom: 24, maxWidth: 720 }}>
      <h2>Reconciliation</h2>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#16A34A" }}>
            {summary.valueRecovered != null ? `$${summary.valueRecovered.toLocaleString()}` : "—"}
          </div>
          <small style={{ color: "var(--muted)" }}>Value Recovered</small>
        </div>
        <div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{summary.totalShipments ?? "—"}</div>
          <small style={{ color: "var(--muted)" }}>Total Shipments</small>
        </div>
        <div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{summary.shipmentDiscrepancy ?? "—"}</div>
          <small style={{ color: "var(--muted)" }}>Shipment Discrepancy</small>
        </div>
        <div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{summary.casesResolved ?? "—"}</div>
          <small style={{ color: "var(--muted)" }}>Cases Resolved</small>
        </div>
      </div>

      {reportUrl && (
        <p style={{ marginTop: 12 }}>
          <a href={reportUrl} target="_blank" rel="noopener noreferrer">
            View full reconciliation report →
          </a>
        </p>
      )}
    </section>
  );
}
