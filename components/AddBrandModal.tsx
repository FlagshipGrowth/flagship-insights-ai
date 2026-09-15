"use client";

import { useState } from "react";

/** Popup version of "Add Brand" on /internal's Manage Users table — lets an owner create several
 * brands for one client in a single submission (a client often needs more than one storefront:
 * Amazon US, Amazon CA, Walmart, ...) instead of visiting /internal/brands/new once per brand.
 * `action` is a Server Action already bound to this row's clientId (app/internal/page.tsx). */
export function AddBrandModal({ clientName, action }: { clientName: string; action: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [rowIds, setRowIds] = useState<number[]>([0]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Add Brand
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,13,18,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={() => setOpen(false)}
    >
      <div className="card" style={{ maxWidth: 480, width: "100%", margin: 16 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Add brand{rowIds.length > 1 ? "s" : ""} for {clientName}</h3>
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
            setRowIds([0]);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {rowIds.map((id, i) => (
            <input key={id} name="brandName" placeholder={`Brand name ${i + 1}`} required={i === 0} style={{ width: "100%" }} />
          ))}
          <button type="button" className="secondary" onClick={() => setRowIds([...rowIds, Date.now()])} style={{ alignSelf: "flex-start" }}>
            + Add another brand
          </button>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="submit">Create</button>
            <button type="button" className="secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
