"use client";

import { useState } from "react";

const HIDDEN_KEYS = new Set(["honey"]);

/** Small icon button + popup showing exactly what the contact form submitted, verbatim — for
 * leads that came from the public contact form (app/api/leads/from-contact-form/route.ts stores
 * the full posted body as raw_submission). Not rendered at all for leads without one (manually
 * added or bulk-uploaded leads never have this). Same fixed-overlay modal pattern as
 * AddLeadModal. */
export function ViewSubmissionModal({ companyName, submission }: { companyName: string; submission: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(submission).filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== "" && v !== null && v !== undefined);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View original form submission"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.85rem", lineHeight: 1, flexShrink: 0 }}
      >
        🔗
      </button>
      {open && (
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
            <h3 style={{ marginTop: 0 }}>Form submission — {companyName}</h3>
            {entries.length === 0 ? (
              <p>
                <small style={{ color: "var(--muted)" }}>Nothing was captured for this submission.</small>
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {entries.map(([key, value]) => (
                  <div key={key} style={{ display: "flex", gap: 10, fontSize: "0.85rem", borderBottom: "1px solid var(--paper-2)", paddingBottom: 6 }}>
                    <span style={{ width: 110, flexShrink: 0, color: "var(--muted)", fontFamily: "monospace" }}>{key}</span>
                    <span style={{ wordBreak: "break-word" }}>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
