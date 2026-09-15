import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getLeads, getOwnerUsers, createLead, updateLeadStage, deleteLead, LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/leads";
import { AddLeadModal } from "@/components/AddLeadModal";
import { LeadStageSelect } from "@/components/LeadStageSelect";
import { ConfirmButton } from "@/components/ConfirmButton";

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

async function deleteLeadAction(leadId: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await deleteLead(leadId);
  revalidatePath("/internal/crm");
}

export default async function CrmPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const [leads, owners] = await Promise.all([getLeads(), getOwnerUsers()]);
  const totalPipelineValue = leads
    .filter((l) => l.stage !== "won" && l.stage !== "lost")
    .reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; Back
      </a>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>CRM</h1>
        <AddLeadModal owners={owners} action={createLeadAction} />
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 24 }}>
        <small>Flagship's own new-business pipeline — separate from client accounts. Open pipeline value: ${totalPipelineValue.toLocaleString()}.</small>
      </p>

      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
        {LEAD_STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage);
          return (
            <div key={stage} style={{ minWidth: 240, flex: "0 0 240px" }}>
              <h3 style={{ marginBottom: 8 }}>
                {LEAD_STAGE_LABELS[stage]} <small style={{ color: "var(--muted)" }}>({stageLeads.length})</small>
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 60 }}>
                {stageLeads.map((lead) => {
                  const boundMove = moveLeadAction.bind(null, lead.id);
                  const boundDelete = deleteLeadAction.bind(null, lead.id);
                  return (
                    <div key={lead.id} className="card" style={{ padding: 12 }}>
                      <div style={{ fontFamily: "var(--font-heading), system-ui, sans-serif", fontWeight: 700 }}>
                        {lead.companyName}
                      </div>
                      {lead.contactName && <small style={{ color: "var(--muted)" }}>{lead.contactName}</small>}
                      {lead.estimatedValue !== null && (
                        <div>
                          <small>${lead.estimatedValue.toLocaleString()}</small>
                        </div>
                      )}
                      {lead.assignedToEmail && (
                        <div>
                          <small style={{ color: "var(--muted)" }}>{lead.assignedToEmail}</small>
                        </div>
                      )}
                      {lead.notes && (
                        <p style={{ margin: "6px 0 0" }}>
                          <small>{lead.notes}</small>
                        </p>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <LeadStageSelect stage={lead.stage} stages={LEAD_STAGES} labels={LEAD_STAGE_LABELS} action={boundMove} />
                      </div>
                      <form action={boundDelete} style={{ marginTop: 6 }}>
                        <ConfirmButton
                          className="secondary"
                          style={{ borderColor: "#DC2626", color: "#DC2626", fontSize: "0.8rem", padding: "4px 8px" }}
                          confirmText={`Delete the lead for ${lead.companyName}? This cannot be undone.`}
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
