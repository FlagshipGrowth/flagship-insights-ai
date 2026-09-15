"use client";

import { useState } from "react";

/** "+ Add lead" popup on /internal/crm — same modal pattern as AddBrandModal. `action` is the
 * createLead Server Action, already gated/wrapped in app/internal/crm/page.tsx. */
export function AddLeadModal({
  owners,
  action,
}: {
  owners: { id: string; email: string }[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        + Add lead
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
        <h3 style={{ marginTop: 0 }}>Add lead</h3>
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <label>
            Company name
            <br />
            <input name="companyName" required style={{ width: "100%" }} />
          </label>
          <label>
            Contact name
            <br />
            <input name="contactName" style={{ width: "100%" }} />
          </label>
          <label>
            Email
            <br />
            <input type="email" name="email" style={{ width: "100%" }} />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1 }}>
              Source
              <br />
              <input name="source" placeholder="Referral, inbound, ..." style={{ width: "100%" }} />
            </label>
            <label style={{ flex: 1 }}>
              Est. value ($)
              <br />
              <input type="number" name="estimatedValue" placeholder="Defaults to 2,750" style={{ width: "100%" }} />
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" name="isHot" />
            🔥 Hot lead
          </label>
          <label>
            Assigned to
            <br />
            <select name="assignedToId" defaultValue="" style={{ width: "100%" }}>
              <option value="">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notes
            <br />
            <textarea name="notes" rows={2} style={{ width: "100%" }} />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
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
