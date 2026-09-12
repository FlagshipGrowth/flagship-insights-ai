// Parses the KPI summary from the Reconciliation (shipment reimbursement) report pages at
// reports.flagshipgrowth.com. Only some brands have one — checked live per brand rather than
// assuming the `-reconciliation` slug always exists (see migration 0014).

export interface ReconciliationSummary {
  valueRecovered: number | null;
  totalShipments: number | null;
  shipmentDiscrepancy: number | null;
  casesResolved: number | null;
}

const KPI_LABEL_TO_KEY: Record<string, keyof ReconciliationSummary> = {
  "Value Recovered": "valueRecovered",
  "Total Shipments": "totalShipments",
  "Shipment Discrepancy": "shipmentDiscrepancy",
  "Cases Resolved": "casesResolved",
};

export function parseReconciliationReport(html: string): ReconciliationSummary | null {
  const out: ReconciliationSummary = {
    valueRecovered: null,
    totalShipments: null,
    shipmentDiscrepancy: null,
    casesResolved: null,
  };
  let found = false;
  for (const match of html.matchAll(/<div class="kpi-value"[^>]*>([^<]*)<\/div>\s*<div class="kpi-label">([^<]*)<\/div>/g)) {
    const [, rawValue, label] = match;
    const key = KPI_LABEL_TO_KEY[label.trim()];
    if (!key) continue;
    const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(num)) {
      out[key] = num;
      found = true;
    }
  }
  return found ? out : null;
}

export async function fetchReconciliationReport(url: string): Promise<ReconciliationSummary | null> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch reconciliation report ${url} (${res.status})`);
  }
  const html = await res.text();
  return parseReconciliationReport(html);
}
