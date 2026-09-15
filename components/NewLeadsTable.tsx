"use client";

import { useState } from "react";

export interface NewLeadRow {
  id: string;
  companyName: string;
  source: string | null;
  estimatedValue: number | null;
  isHot: boolean;
}

/** Full-width triage table for leads still in "New" — deliberately not a Kanban column (that
 * couldn't scale once a bulk upload landed 60+ leads in it at once). Checkboxes + a "Move
 * selected to" bar let an owner triage a whole batch out of New in a couple of clicks instead of
 * one dropdown at a time. Per-row/bulk actions are called directly as plain async functions
 * (Server Action references passed down as props) rather than via <form action> — the delete
 * confirm and the bulk id list are only known at click time on the client, not at bind time. */
export function NewLeadsTable({
  leads,
  stages,
  stageLabels,
  toggleHotAction,
  moveOneAction,
  deleteAction,
  bulkMoveAction,
}: {
  leads: NewLeadRow[];
  stages: readonly string[];
  stageLabels: Record<string, string>;
  toggleHotAction: (leadId: string) => Promise<void>;
  moveOneAction: (leadId: string, stage: string) => Promise<void>;
  deleteAction: (leadId: string) => Promise<void>;
  bulkMoveAction: (leadIds: string[], stage: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState(stages.find((s) => s !== "new") ?? stages[0]);
  const [pending, setPending] = useState(false);
  const allSelected = leads.length > 0 && selected.size === leads.length;

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div>
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
          padding: "8px 10px",
        }}
      >
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)))}
        />
        <small style={{ color: "var(--muted)" }}>{selected.size > 0 ? `${selected.size} selected` : "Select all"}</small>
        <span style={{ flex: 1 }} />
        <small>Move selected to:</small>
        <select value={bulkStage} onChange={(e) => setBulkStage(e.target.value)} style={{ fontSize: "0.85rem" }}>
          {stages
            .filter((s) => s !== "new")
            .map((s) => (
              <option key={s} value={s}>
                {stageLabels[s]}
              </option>
            ))}
        </select>
        <button
          type="button"
          disabled={selected.size === 0 || pending}
          onClick={async () => {
            setPending(true);
            await bulkMoveAction(Array.from(selected), bulkStage);
            setSelected(new Set());
            setPending(false);
          }}
        >
          {pending ? "Moving…" : "Move"}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {leads.length === 0 ? (
          <p style={{ margin: 0, padding: "10px 12px" }}>
            <small style={{ color: "var(--muted)" }}>No new leads to triage.</small>
          </p>
        ) : (
          <div style={{ maxHeight: 560, overflowY: "auto" }}>
            {leads.map((lead, i) => (
              <div
                key={lead.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "5px 10px",
                  fontSize: "0.85rem",
                  borderBottom: i < leads.length - 1 ? "1px solid var(--paper-2)" : "none",
                }}
              >
                <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleOne(lead.id)} />
                <button
                  type="button"
                  onClick={() => toggleHotAction(lead.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.9rem", lineHeight: 1 }}
                >
                  {lead.isHot ? "🔥" : "⚪️"}
                </button>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                  {lead.companyName}
                </span>
                <span style={{ color: "var(--muted)", flexShrink: 0, minWidth: 90, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lead.source ?? "—"}
                </span>
                <span style={{ flexShrink: 0, minWidth: 60, textAlign: "right" }}>
                  {lead.estimatedValue !== null ? `$${lead.estimatedValue.toLocaleString()}` : ""}
                </span>
                <select
                  defaultValue="new"
                  onChange={(e) => moveOneAction(lead.id, e.target.value)}
                  style={{ fontSize: "0.78rem", padding: "1px 2px", maxWidth: 100 }}
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {stageLabels[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete the lead for ${lead.companyName}? This cannot be undone.`)) {
                      deleteAction(lead.id);
                    }
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#DC2626", fontSize: "0.9rem", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
