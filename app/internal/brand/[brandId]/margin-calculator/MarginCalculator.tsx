"use client";

import { useMemo, useState } from "react";

interface Product {
  id: string;
  sku: string | null;
  asin: string | null;
  title: string | null;
  costLanded: number | null;
  msrp: number | null;
}

type View = "fba" | "fbm";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <br />
      <input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function MarginCalculator({ products }: { products: Product[] }) {
  const [view, setView] = useState<View>("fba");
  const [selectedId, setSelectedId] = useState("");

  const [price, setPrice] = useState("");
  const [cogs, setCogs] = useState("");
  const [referralPct, setReferralPct] = useState("15");
  const [returns, setReturns] = useState("");
  const [adsSpend, setAdsSpend] = useState("");

  // FBA-only cost lines
  const [fbaFee, setFbaFee] = useState("");
  const [inbound, setInbound] = useState("");
  const [storage, setStorage] = useState("");

  // FBM-only cost line
  const [fulfillmentCost, setFulfillmentCost] = useState("");

  function selectProduct(id: string) {
    setSelectedId(id);
    const product = products.find((p) => p.id === id);
    if (product) {
      setPrice(product.msrp != null ? String(product.msrp) : "");
      setCogs(product.costLanded != null ? String(product.costLanded) : "");
    }
  }

  const breakdown = useMemo(() => {
    const p = parseFloat(price) || 0;
    const c = parseFloat(cogs) || 0;
    const refPct = parseFloat(referralPct) || 0;
    const ret = parseFloat(returns) || 0;
    const ads = parseFloat(adsSpend) || 0;
    const referralFee = p * (refPct / 100);

    const lines =
      view === "fba"
        ? [
            { label: "Sale price", value: p, sign: 1 as const },
            { label: "COGS", value: c, sign: -1 as const },
            { label: "FBA fee", value: parseFloat(fbaFee) || 0, sign: -1 as const },
            { label: "Referral fee", value: referralFee, sign: -1 as const },
            { label: "Inbound to Amazon", value: parseFloat(inbound) || 0, sign: -1 as const },
            { label: "Storage", value: parseFloat(storage) || 0, sign: -1 as const },
            { label: "Returns", value: ret, sign: -1 as const },
            { label: "Ads & marketing", value: ads, sign: -1 as const },
          ]
        : [
            { label: "Sale price", value: p, sign: 1 as const },
            { label: "COGS", value: c, sign: -1 as const },
            { label: "Referral fee", value: referralFee, sign: -1 as const },
            { label: "Fulfillment cost", value: parseFloat(fulfillmentCost) || 0, sign: -1 as const },
            { label: "Returns", value: ret, sign: -1 as const },
            { label: "Ads & marketing", value: ads, sign: -1 as const },
          ];

    const profit = lines.reduce((sum, l) => sum + l.value * l.sign, 0);
    const marginPct = p > 0 ? (profit / p) * 100 : 0;
    return { lines, profit, marginPct };
  }, [view, price, cogs, referralPct, returns, adsSpend, fbaFee, inbound, storage, fulfillmentCost]);

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <div className="card" style={{ maxWidth: 420, flex: "1 1 380px" }}>
        <label>
          Product (optional — fills sale price and COGS from the catalog)
          <br />
          <select value={selectedId} onChange={(e) => selectProduct(e.target.value)} style={{ width: "100%" }}>
            <option value="">— Manual entry —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.sku ?? p.asin ?? "no SKU") + " — " + (p.title ?? "untitled")}
              </option>
            ))}
          </select>
        </label>

        <nav className="pill-nav" style={{ margin: "16px 0" }}>
          <a onClick={() => setView("fba")} className={view === "fba" ? "active" : ""} style={{ cursor: "pointer" }}>
            FBA
          </a>
          <a onClick={() => setView("fbm")} className={view === "fbm" ? "active" : ""} style={{ cursor: "pointer" }}>
            FBM
          </a>
        </nav>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <NumberField label="Sale price ($)" value={price} onChange={setPrice} />
          <NumberField label="COGS per unit ($)" value={cogs} onChange={setCogs} />
          <NumberField label="Referral fee (%)" value={referralPct} onChange={setReferralPct} />

          {view === "fba" ? (
            <>
              <NumberField label="FBA fulfillment fee ($)" value={fbaFee} onChange={setFbaFee} />
              <NumberField label="Inbound to Amazon ($)" value={inbound} onChange={setInbound} />
              <NumberField label="Storage ($)" value={storage} onChange={setStorage} />
            </>
          ) : (
            <NumberField label="Fulfillment cost ($)" value={fulfillmentCost} onChange={setFulfillmentCost} />
          )}

          <NumberField label="Returns ($ per unit)" value={returns} onChange={setReturns} />
          <NumberField label="Ads & marketing spend ($ per unit)" value={adsSpend} onChange={setAdsSpend} />
        </div>
      </div>

      <div className="card" style={{ maxWidth: 380, flex: "1 1 320px", alignSelf: "flex-start" }}>
        <h2 style={{ marginTop: 0 }}>Breakdown ({view.toUpperCase()})</h2>
        <table>
          <tbody>
            {breakdown.lines.map((l) => (
              <tr key={l.label}>
                <td>{l.label}</td>
                <td style={{ textAlign: "right" }}>
                  {l.sign < 0 ? "−" : ""}${l.value.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--paper-2)" }} />
        <p>
          <strong>Profit per unit:</strong> ${breakdown.profit.toFixed(2)}
        </p>
        <p>
          <strong>Margin:</strong> {breakdown.marginPct.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
