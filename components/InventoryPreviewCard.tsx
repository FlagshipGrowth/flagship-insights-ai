import type { InventoryPreview } from "@/lib/reports";

function weeksLeftColor(weeks: number | null): string | undefined {
  if (weeks == null) return undefined;
  if (weeks <= 4) return "#DC2626";
  if (weeks <= 8) return "#D97706";
  return "#16A34A";
}

export function InventoryPreviewCard({ preview, reportUrl }: { preview: InventoryPreview; reportUrl?: string }) {
  return (
    <section className="card" style={{ marginBottom: 24, maxWidth: 720 }}>
      <h2>Inventory</h2>
      <div style={{ display: "flex", gap: 32, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{preview.totalSkus}</div>
          <small style={{ color: "var(--muted)" }}>Total SKUs</small>
        </div>
        <div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{preview.totalAvailable.toLocaleString()}</div>
          <small style={{ color: "var(--muted)" }}>Total Available</small>
        </div>
        <div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: preview.criticalSkus > 0 ? "#D97706" : undefined }}>
            {preview.criticalSkus}
          </div>
          <small style={{ color: "var(--muted)" }}>Critical (≤4 wks)</small>
        </div>
      </div>

      <p style={{ marginBottom: 8 }}>
        <small>Lowest weeks of stock first</small>
      </p>
      <div className="table-scroll">
        <table className="table-dense">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Title</th>
              <th>Available</th>
              <th>Wkly Avg</th>
              <th>Weeks Left</th>
            </tr>
          </thead>
          <tbody>
            {preview.items.map((item) => (
              <tr key={`${item.region}-${item.asin ?? item.sku}`}>
                <td>
                  {item.sku ?? item.asin ?? "—"}
                  {item.region ? ` (${item.region})` : ""}
                </td>
                <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }} title={item.title ?? undefined}>
                  {item.title ?? "—"}
                </td>
                <td>{item.availableFba ?? "—"}</td>
                <td>{item.wklyAvg ?? "—"}</td>
                <td style={{ fontWeight: 700, color: weeksLeftColor(item.weeksLeft) }}>{item.weeksLeft ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reportUrl && (
        <p style={{ marginTop: 12 }}>
          <a href={reportUrl} target="_blank" rel="noopener noreferrer">
            View full inventory report →
          </a>
        </p>
      )}
    </section>
  );
}
