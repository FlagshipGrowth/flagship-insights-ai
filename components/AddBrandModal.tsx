"use client";

import { useState } from "react";

export interface BrandPickerOption {
  id: string;
  name: string;
  clientName: string;
}

/** "Add Brand" on /internal's Manage Users table — a popup checklist over every brand in the
 * system (not a form for typing new ones). Checking a brand grants this specific user visibility
 * into it in addition to their own client's brands — purely additive, multiple users (even across
 * different clients) can be granted the same brand; it never reassigns the brand's own client_id.
 * `action` is a Server Action already bound to this row's userId (app/internal/page.tsx). */
export function AddBrandModal({
  userLabel,
  brands,
  selectedIds,
  action,
}: {
  userLabel: string;
  brands: BrandPickerOption[];
  selectedIds: string[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setChecked(new Set(selectedIds));
          setOpen(true);
        }}
      >
        Add Brand
      </button>
    );
  }

  const allChecked = brands.length > 0 && checked.size === brands.length;

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
        <h3 style={{ marginTop: 0 }}>Brand access for {userLabel}</h3>
        <p style={{ marginTop: 0 }}>
          <small style={{ color: "var(--muted)" }}>
            Select every brand this user should be able to see — use Select all for an employee who should see every
            client.
          </small>
        </p>
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
          }}
        >
          {brands.length > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setChecked(allChecked ? new Set() : new Set(brands.map((b) => b.id)))}
              style={{ marginBottom: 8 }}
            >
              {allChecked ? "Deselect all" : "Select all"}
            </button>
          )}
          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {brands.length === 0 ? (
              <p>No brands exist yet.</p>
            ) : (
              brands.map((b) => (
                <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="brandId"
                    value={b.id}
                    checked={checked.has(b.id)}
                    onChange={(e) => {
                      const next = new Set(checked);
                      if (e.target.checked) next.add(b.id);
                      else next.delete(b.id);
                      setChecked(next);
                    }}
                  />
                  {b.name} <small style={{ color: "var(--muted)" }}>({b.clientName})</small>
                </label>
              ))
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit">Save</button>
            <button type="button" className="secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
