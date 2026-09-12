"use client";

import { useState } from "react";

interface Product {
  id: string;
  sku: string | null;
  asin: string | null;
  title: string | null;
  costLanded: number | null;
  msrp: number | null;
}

type View = "fba" | "fbm";

interface RowInputs {
  price: string;
  cogs: string;
  referralPct: string;
  returns: string;
  adsSpend: string;
  fbaFee: string;
  inbound: string;
  storage: string;
  fulfillmentCost: string;
}

function defaultRow(product: Product): RowInputs {
  return {
    price: product.msrp != null ? String(product.msrp) : "",
    cogs: product.costLanded != null ? String(product.costLanded) : "",
    referralPct: "15",
    returns: "",
    adsSpend: "",
    fbaFee: "",
    inbound: "",
    storage: "",
    fulfillmentCost: "",
  };
}

function num(v: string): number {
  return parseFloat(v) || 0;
}

// Narrow, borderless inputs so a row of 8+ of them still reads as a spreadsheet cell, not a form.
function Cell({ value, onChange, width = 64 }: { value: string; onChange: (v: string) => void; width?: number }) {
  return (
    <input
      type="number"
      step="0.01"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width, padding: "3px 6px", fontSize: "0.82rem" }}
    />
  );
}

export function MarginCalculator({ products }: { products: Product[] }) {
  const [view, setView] = useState<View>("fba");
  const [rows, setRows] = useState<Record<string, RowInputs>>(() =>
    Object.fromEntries(products.map((p) => [p.id, defaultRow(p)]))
  );

  function update(id: string, field: keyof RowInputs, value: string) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function compute(r: RowInputs) {
    const price = num(r.price);
    const cogs = num(r.cogs);
    const referralFee = price * (num(r.referralPct) / 100);
    const returns = num(r.returns);
    const ads = num(r.adsSpend);

    const costs =
      view === "fba"
        ? cogs + num(r.fbaFee) + referralFee + num(r.inbound) + num(r.storage) + returns + ads
        : cogs + referralFee + num(r.fulfillmentCost) + returns + ads;

    const profit = price - costs;
    const marginPct = price > 0 ? (profit / price) * 100 : 0;
    return { profit, marginPct };
  }

  return (
    <>
      <nav className="pill-nav" style={{ marginBottom: 16 }}>
        <a onClick={() => setView("fba")} className={view === "fba" ? "active" : ""} style={{ cursor: "pointer" }}>
          FBA
        </a>
        <a onClick={() => setView("fbm")} className={view === "fbm" ? "active" : ""} style={{ cursor: "pointer" }}>
          FBM
        </a>
      </nav>

      {products.length === 0 ? (
        <p>No products synced yet — add some in the Catalog first.</p>
      ) : (
        <div className="card table-scroll" style={{ padding: 0 }}>
          <table className="table-dense">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Title</th>
                <th>Price</th>
                <th>COGS</th>
                <th>Referral %</th>
                {view === "fba" ? (
                  <>
                    <th>FBA fee</th>
                    <th>Inbound</th>
                    <th>Storage</th>
                  </>
                ) : (
                  <th>Fulfillment</th>
                )}
                <th>Returns</th>
                <th>Ads</th>
                <th>Profit $</th>
                <th>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const r = rows[p.id];
                const { profit, marginPct } = compute(r);
                return (
                  <tr key={p.id}>
                    <td>{p.sku ?? "—"}</td>
                    <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }} title={p.title ?? undefined}>
                      {p.title ?? "—"}
                    </td>
                    <td>
                      <Cell value={r.price} onChange={(v) => update(p.id, "price", v)} />
                    </td>
                    <td>
                      <Cell value={r.cogs} onChange={(v) => update(p.id, "cogs", v)} />
                    </td>
                    <td>
                      <Cell value={r.referralPct} onChange={(v) => update(p.id, "referralPct", v)} width={52} />
                    </td>
                    {view === "fba" ? (
                      <>
                        <td>
                          <Cell value={r.fbaFee} onChange={(v) => update(p.id, "fbaFee", v)} />
                        </td>
                        <td>
                          <Cell value={r.inbound} onChange={(v) => update(p.id, "inbound", v)} />
                        </td>
                        <td>
                          <Cell value={r.storage} onChange={(v) => update(p.id, "storage", v)} />
                        </td>
                      </>
                    ) : (
                      <td>
                        <Cell value={r.fulfillmentCost} onChange={(v) => update(p.id, "fulfillmentCost", v)} />
                      </td>
                    )}
                    <td>
                      <Cell value={r.returns} onChange={(v) => update(p.id, "returns", v)} />
                    </td>
                    <td>
                      <Cell value={r.adsSpend} onChange={(v) => update(p.id, "adsSpend", v)} />
                    </td>
                    <td style={{ fontWeight: 600, color: profit < 0 ? "#b00" : undefined }}>${profit.toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: profit < 0 ? "#b00" : undefined }}>{marginPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
