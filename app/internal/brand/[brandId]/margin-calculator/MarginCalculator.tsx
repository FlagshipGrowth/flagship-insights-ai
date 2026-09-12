"use client";

import { useMemo, useState } from "react";
import { saveMarginInputsAction } from "./actions";
import type { SavedMarginInputs } from "@/lib/margin";

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

const numStr = (n: number | null | undefined) => (n != null ? String(n) : "");

// Saved values (from a previous "Save") win; anything never saved falls back to the catalog's
// own msrp/cost_landed and a sensible 15% referral default.
function initialRow(product: Product, saved: SavedMarginInputs | undefined): RowInputs {
  return {
    price: saved?.price != null ? numStr(saved.price) : numStr(product.msrp),
    cogs: saved?.cogs != null ? numStr(saved.cogs) : numStr(product.costLanded),
    referralPct: saved?.referralPct != null ? numStr(saved.referralPct) : "15",
    returns: numStr(saved?.returns),
    adsSpend: numStr(saved?.adsSpend),
    fbaFee: numStr(saved?.fbaFee),
    inbound: numStr(saved?.inbound),
    storage: numStr(saved?.storage),
    fulfillmentCost: numStr(saved?.fulfillmentCost),
  };
}

function num(v: string): number {
  return parseFloat(v) || 0;
}

function numOrNull(v: string): number | null {
  return v.trim() === "" ? null : parseFloat(v);
}

// SKU, Title, and Price stay pinned on the left while the fee/profit columns scroll underneath
// — otherwise there's no way to tell which product a given Profit/Margin belongs to once you've
// scrolled right. Widths are fixed (not just maxWidth) so every row's sticky cells line up at
// the same offset regardless of content length.
const STICKY_COLS = {
  sku: { width: 90, left: 0 },
  title: { width: 200, left: 90 },
  price: { width: 76, left: 290 },
} as const;

function stickyStyle(col: keyof typeof STICKY_COLS, extra?: React.CSSProperties): React.CSSProperties {
  const { width, left } = STICKY_COLS[col];
  return {
    position: "sticky",
    left,
    width,
    minWidth: width,
    maxWidth: width,
    background: "#fff",
    zIndex: 1,
    ...(col === "price" ? { borderRight: "2px solid var(--paper-2)" } : {}),
    ...extra,
  };
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

export function MarginCalculator({
  brandId,
  products,
  savedInputs,
}: {
  brandId: string;
  products: Product[];
  savedInputs: SavedMarginInputs[];
}) {
  const [view, setView] = useState<View>("fba");
  const [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [rows, setRows] = useState<Record<string, RowInputs>>(() => {
    const savedById = new Map(savedInputs.map((s) => [s.productId, s]));
    return Object.fromEntries(products.map((p) => [p.id, initialRow(p, savedById.get(p.id))]));
  });

  function update(id: string, field: keyof RowInputs, value: string) {
    setSaveState("idle");
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

  async function handleSave() {
    setSaveState("saving");
    const entries = products.map((p) => {
      const r = rows[p.id];
      return {
        productId: p.id,
        price: numOrNull(r.price),
        cogs: numOrNull(r.cogs),
        referralPct: numOrNull(r.referralPct),
        fbaFee: numOrNull(r.fbaFee),
        inbound: numOrNull(r.inbound),
        storage: numOrNull(r.storage),
        fulfillmentCost: numOrNull(r.fulfillmentCost),
        returns: numOrNull(r.returns),
        adsSpend: numOrNull(r.adsSpend),
      };
    });
    try {
      const result = await saveMarginInputsAction(brandId, entries);
      setSaveState(result.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.title ?? "").toLowerCase().includes(q) ||
        (p.asin ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <nav className="pill-nav" style={{ margin: 0 }}>
          <a onClick={() => setView("fba")} className={view === "fba" ? "active" : ""} style={{ cursor: "pointer" }}>
            FBA
          </a>
          <a onClick={() => setView("fbm")} className={view === "fbm" ? "active" : ""} style={{ cursor: "pointer" }}>
            FBM
          </a>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="search"
            placeholder="Search SKU, title, or ASIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <button type="button" onClick={handleSave} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving…" : "Save"}
          </button>
          {saveState === "saved" && <small style={{ color: "var(--accent-blue)" }}>Saved</small>}
          {saveState === "error" && <small style={{ color: "#b00" }}>Save failed — try again</small>}
        </div>
      </div>

      {products.length === 0 ? (
        <p>No products synced yet — add some in the Catalog first.</p>
      ) : filtered.length === 0 ? (
        <p>No products match "{search}".</p>
      ) : (
        <div className="card table-scroll" style={{ padding: 0 }}>
          <table className="table-dense">
            <thead>
              <tr>
                <th style={stickyStyle("sku")}>SKU</th>
                <th style={stickyStyle("title")}>Title</th>
                <th style={stickyStyle("price")}>Price</th>
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
              {filtered.map((p) => {
                const r = rows[p.id];
                const { profit, marginPct } = compute(r);
                return (
                  <tr key={p.id}>
                    <td style={stickyStyle("sku")}>{p.sku ?? "—"}</td>
                    <td
                      style={stickyStyle("title", { overflow: "hidden", textOverflow: "ellipsis" })}
                      title={p.title ?? undefined}
                    >
                      {p.title ?? "—"}
                    </td>
                    <td style={stickyStyle("price")}>
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
