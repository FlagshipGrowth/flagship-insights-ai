"use client";

import { useState } from "react";

export interface ClientPickerOption {
  id: string;
  name: string;
}

/** Same interaction pattern as AddBrandModal, one level up — assigns an employee to whole
 * clients (every brand that client owns, including ones added later), rather than picking
 * individual brands. `action` is a Server Action already bound to this row's userId. */
export function AddClientsModal({
  userLabel,
  clients,
  selectedIds,
  action,
}: {
  userLabel: string;
  clients: ClientPickerOption[];
  selectedIds: string[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));

  if (!open) {
    return (
      <button
        type="button"
        className="secondary"
        onClick={() => {
          setChecked(new Set(selectedIds));
          setOpen(true);
        }}
      >
        Add Client
      </button>
    );
  }

  const allChecked = clients.length > 0 && checked.size === clients.length;

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
        <h3 style={{ marginTop: 0 }}>Client access for {userLabel}</h3>
        <p style={{ marginTop: 0 }}>
          <small style={{ color: "var(--muted)" }}>
            Select every client this employee should see — grants all of that client's brands, including ones added
            later. For one specific brand instead, use the "Add Brand" picker on Manage Users.
          </small>
        </p>
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
          }}
        >
          {clients.length > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setChecked(allChecked ? new Set() : new Set(clients.map((c) => c.id)))}
              style={{ marginBottom: 8 }}
            >
              {allChecked ? "Deselect all" : "Select all"}
            </button>
          )}
          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {clients.length === 0 ? (
              <p>No clients exist yet.</p>
            ) : (
              clients.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="clientId"
                    value={c.id}
                    checked={checked.has(c.id)}
                    onChange={(e) => {
                      const next = new Set(checked);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      setChecked(next);
                    }}
                  />
                  {c.name}
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
