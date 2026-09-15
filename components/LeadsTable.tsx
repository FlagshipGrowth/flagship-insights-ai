"use client";

import { useState } from "react";

export interface LeadRow {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  assignedToEmail: string | null;
  notes: string | null;
  source: string | null;
  estimatedValue: number | null;
  isHot: boolean;
  stage: string;
}

/** Full-width, dense triage table — used for both the New tab (leads still at stage "new") and
 * the Hot tab (any lead flagged 🔥, regardless of stage) on /internal/crm. Deliberately not a
 * Kanban column: that couldn't scale once a bulk upload landed 60+ leads in "New" at once.
 * Checkboxes + a "Move selected to" bar let an owner triage a whole batch in a couple of clicks.
 * Per-row/bulk actions are called directly as plain async functions (Server Action references
 * passed down as props) rather than via <form action> — the delete confirm and the bulk id list
 * are only known at click time on the client, not at bind time. */
export function LeadsTable({
  leads,
  stages,
  stageLabels,
  toggleHotAction,
  moveOneAction,
  deleteAction,
  bulkMoveAction,
  updateValueAction,
  updateSourceAction,
}: {
  leads: LeadRow[];
  stages: readonly string[];
  stageLabels: Record<string, string>;
  toggleHotAction: (leadId: string) => Promise<void>;
  moveOneAction: (leadId: string, stage: string) => Promise<void>;
  deleteAction: (leadId: string) => Promise<void>;
  bulkMoveAction: (leadIds: string[], stage: string) => Promise<void>;
  updateValueAction: (leadId: string, value: number | null) => Promise<void>;
  updateSourceAction: (leadId: string, source: string | null) => Promise<void>;
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
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, padding: "8px 10px" }}>
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
            <small style={{ color: "var(--muted)" }}>Nothing here.</small>
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--muted)",
                borderBottom: "1px solid var(--paper-2)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              <span style={{ width: 16 }} />
              <span style={{ width: 16 }} />
              <span style={{ flex: 1 }}>Company</span>
              <span style={{ minWidth: 100, textAlign: "right" }}>Source</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>Value</span>
              <span style={{ minWidth: 100 }}>Stage</span>
              <span style={{ width: 14 }} />
            </div>
            <div style={{ maxHeight: 620, overflowY: "auto" }}>
              {leads.map((lead, i) => {
                const titleParts = [lead.contactName, lead.email, lead.assignedToEmail && `Assigned: ${lead.assignedToEmail}`, lead.notes].filter(Boolean);
                return (
                  <div
                    key={lead.id}
                    title={titleParts.length > 0 ? titleParts.join(" · ") : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 10px",
                      fontSize: "0.85rem",
                      background: i % 2 === 1 ? "var(--paper-2, #f6f3ec)" : "transparent",
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
                    <input
                      type="text"
                      defaultValue={lead.source ?? ""}
                      placeholder="Source"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        updateSourceAction(lead.id, v || null);
                      }}
                      style={{
                        color: "var(--muted)",
                        flexShrink: 0,
                        width: 110,
                        textAlign: "right",
                        fontSize: "0.8rem",
                        padding: "1px 3px",
                      }}
                    />
                    <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, minWidth: 80, justifyContent: "flex-end" }}>
                      <small style={{ color: "var(--muted)" }}>$</small>
                      <input
                        type="number"
                        defaultValue={lead.estimatedValue ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          updateValueAction(lead.id, v ? Number(v) : null);
                        }}
                        style={{ width: 64, fontSize: "0.8rem", padding: "1px 3px", textAlign: "right" }}
                      />
                    </span>
                    <select
                      defaultValue={lead.stage}
                      onChange={(e) => moveOneAction(lead.id, e.target.value)}
                      style={{ fontSize: "0.8rem", padding: "2px 4px", minWidth: 100 }}
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
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#DC2626", fontSize: "1rem", lineHeight: 1, width: 14 }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
