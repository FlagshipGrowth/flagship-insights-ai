import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import {
  getLeads,
  getOwnerUsers,
  createLead,
  updateLeadStage,
  bulkUpdateLeadStage,
  deleteLead,
  setLeadHot,
  toggleLeadHot,
  updateLeadValue,
  updateLeadSource,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
} from "@/lib/leads";
import { AddLeadModal } from "@/components/AddLeadModal";
import { LeadStageSelect } from "@/components/LeadStageSelect";
import { ConfirmButton } from "@/components/ConfirmButton";
import { LeadsTable } from "@/components/LeadsTable";

const PIPELINE_STAGES = LEAD_STAGES.filter((s) => s !== "new");

async function createLeadAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await createLead(formData);
  revalidatePath("/internal/crm");
}

async function moveLeadAction(leadId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const stage = formData.get("stage") as string;
  await updateLeadStage(leadId, stage);
  revalidatePath("/internal/crm");
}

async function moveOnePlainAction(leadId: string, stage: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await updateLeadStage(leadId, stage);
  revalidatePath("/internal/crm");
}

async function bulkMoveLeadsAction(leadIds: string[], stage: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await bulkUpdateLeadStage(leadIds, stage);
  revalidatePath("/internal/crm");
}

async function deleteLeadAction(leadId: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await deleteLead(leadId);
  revalidatePath("/internal/crm");
}

async function toggleHotAction(leadId: string, currentlyHot: boolean) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await setLeadHot(leadId, !currentlyHot);
  revalidatePath("/internal/crm");
}

async function toggleHotPlainAction(leadId: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await toggleLeadHot(leadId);
  revalidatePath("/internal/crm");
}

async function updateValueAction(leadId: string, value: number | null) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await updateLeadValue(leadId, value);
  revalidatePath("/internal/crm");
}

async function updateSourceAction(leadId: string, source: string | null) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await updateLeadSource(leadId, source);
  revalidatePath("/internal/crm");
}

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "pipeline" ? "pipeline" : tabParam === "hot" ? "hot" : "new";

  const [leads, owners] = await Promise.all([getLeads(), getOwnerUsers()]);
  const newLeads = leads.filter((l) => l.stage === "new");
  const hotLeads = leads.filter((l) => l.isHot);
  const totalPipelineValue = leads
    .filter((l) => l.stage !== "won" && l.stage !== "lost")
    .reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);

  const toTableRow = (l: (typeof leads)[number]) => ({
    id: l.id,
    companyName: l.companyName,
    contactName: l.contactName,
    email: l.email,
    assignedToEmail: l.assignedToEmail,
    notes: l.notes,
    source: l.source,
    estimatedValue: l.estimatedValue,
    isHot: l.isHot,
    stage: l.stage,
  });

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; Back
      </a>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>CRM</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/internal/crm/bulk-upload">Bulk upload leads</a>
          <AddLeadModal owners={owners} action={createLeadAction} />
        </div>
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 16 }}>
        <small>Flagship's own new-business pipeline — separate from client accounts. Open pipeline value: ${totalPipelineValue.toLocaleString()}.</small>
      </p>

      <nav className="pill-nav">
        <a href="?tab=new" className={tab === "new" ? "active" : ""}>
          New ({newLeads.length})
        </a>
        <a href="?tab=hot" className={tab === "hot" ? "active" : ""}>
          🔥 Hot ({hotLeads.length})
        </a>
        <a href="?tab=pipeline" className={tab === "pipeline" ? "active" : ""}>
          Pipeline ({leads.length - newLeads.length})
        </a>
      </nav>

      {tab === "new" && (
        <LeadsTable
          leads={newLeads.map(toTableRow)}
          stages={LEAD_STAGES}
          stageLabels={LEAD_STAGE_LABELS}
          toggleHotAction={toggleHotPlainAction}
          moveOneAction={moveOnePlainAction}
          deleteAction={deleteLeadAction}
          bulkMoveAction={bulkMoveLeadsAction}
          updateValueAction={updateValueAction}
          updateSourceAction={updateSourceAction}
        />
      )}

      {tab === "hot" && (
        <LeadsTable
          leads={hotLeads.map(toTableRow)}
          stages={LEAD_STAGES}
          stageLabels={LEAD_STAGE_LABELS}
          toggleHotAction={toggleHotPlainAction}
          moveOneAction={moveOnePlainAction}
          deleteAction={deleteLeadAction}
          bulkMoveAction={bulkMoveLeadsAction}
          updateValueAction={updateValueAction}
          updateSourceAction={updateSourceAction}
        />
      )}

      {tab === "pipeline" && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} style={{ minWidth: 240, flex: "0 0 240px" }}>
                <h3 style={{ marginBottom: 6, fontSize: "0.95rem" }}>
                  {LEAD_STAGE_LABELS[stage]} <small style={{ color: "var(--muted)" }}>({stageLeads.length})</small>
                </h3>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  {stageLeads.length === 0 ? (
                    <p style={{ margin: 0, padding: "8px 10px" }}>
                      <small style={{ color: "var(--muted)" }}>—</small>
                    </p>
                  ) : (
                    stageLeads.map((lead, i) => {
                      const boundMove = moveLeadAction.bind(null, lead.id);
                      const boundDelete = deleteLeadAction.bind(null, lead.id);
                      const boundToggleHot = toggleHotAction.bind(null, lead.id, lead.isHot);
                      const titleParts = [lead.contactName, lead.email, lead.assignedToEmail && `Assigned: ${lead.assignedToEmail}`, lead.notes].filter(Boolean);
                      return (
                        <div
                          key={lead.id}
                          title={titleParts.join(" · ")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 8px",
                            fontSize: "0.78rem",
                            borderBottom: i < stageLeads.length - 1 ? "1px solid var(--paper-2)" : "none",
                          }}
                        >
                          <form action={boundToggleHot}>
                            <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.85rem", lineHeight: 1 }}>
                              {lead.isHot ? "🔥" : "⚪️"}
                            </button>
                          </form>
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                            {lead.companyName}
                          </span>
                          <span style={{ color: "var(--muted)", flexShrink: 0 }}>
                            {lead.estimatedValue !== null ? `$${lead.estimatedValue.toLocaleString()}` : ""}
                          </span>
                          <LeadStageSelect stage={lead.stage} stages={LEAD_STAGES} labels={LEAD_STAGE_LABELS} action={boundMove} />
                          <form action={boundDelete}>
                            <ConfirmButton
                              confirmText={`Delete the lead for ${lead.companyName}? This cannot be undone.`}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#DC2626", fontSize: "0.9rem", lineHeight: 1 }}
                            >
                              ×
                            </ConfirmButton>
                          </form>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
