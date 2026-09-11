"use client";

import { useState } from "react";

export function MarginCalculator() {
  const [price, setPrice] = useState("");
  const [cogs, setCogs] = useState("");
  const [referralPct, setReferralPct] = useState("15");
  const [fbaFee, setFbaFee] = useState("");
  const [otherCosts, setOtherCosts] = useState("");

  const p = parseFloat(price) || 0;
  const c = parseFloat(cogs) || 0;
  const refPct = parseFloat(referralPct) || 0;
  const fba = parseFloat(fbaFee) || 0;
  const other = parseFloat(otherCosts) || 0;

  const referralFee = p * (refPct / 100);
  const totalCosts = c + referralFee + fba + other;
  const profit = p - totalCosts;
  const marginPct = p > 0 ? (profit / p) * 100 : 0;

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Sell price ($)
          <br />
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label>
          COGS per unit ($)
          <br />
          <input type="number" min="0" step="0.01" value={cogs} onChange={(e) => setCogs(e.target.value)} />
        </label>
        <label>
          Amazon referral fee (%)
          <br />
          <input
            type="number"
            min="0"
            step="0.1"
            value={referralPct}
            onChange={(e) => setReferralPct(e.target.value)}
          />
        </label>
        <label>
          FBA fulfillment fee ($)
          <br />
          <input type="number" min="0" step="0.01" value={fbaFee} onChange={(e) => setFbaFee(e.target.value)} />
        </label>
        <label>
          Other costs per unit ($)
          <br />
          <input
            type="number"
            min="0"
            step="0.01"
            value={otherCosts}
            onChange={(e) => setOtherCosts(e.target.value)}
          />
        </label>
      </div>

      <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--paper-2)" }} />

      <p>
        <strong>Profit per unit:</strong> ${profit.toFixed(2)}
      </p>
      <p>
        <strong>Margin:</strong> {marginPct.toFixed(1)}%
      </p>
      <small>
        Manual calculator for now. Once Amazon SP-API is connected, price/fee data can be pulled automatically
        per SKU instead of typed in.
      </small>
    </div>
  );
}
