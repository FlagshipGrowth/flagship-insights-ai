import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getBrandName } from "@/lib/seo";
import { getStrategyBrief, saveStrategyBrief } from "@/lib/brand-strategy";

async function saveAction(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;
  await saveStrategyBrief(brandId, ctx.id, formData);
  revalidatePath(`/internal/brand/${brandId}/tiktok-strategy`);
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  type = "textarea",
}: {
  label: string;
  name: string;
  defaultValue: string | number | null;
  hint?: string;
  type?: "textarea" | "text" | "number";
}) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      {hint && (
        <div style={{ marginBottom: 4 }}>
          <small style={{ color: "var(--muted)" }}>{hint}</small>
        </div>
      )}
      {type === "textarea" ? (
        <textarea name={name} defaultValue={defaultValue ?? ""} rows={3} style={{ width: "100%" }} />
      ) : (
        <input type={type} name={name} defaultValue={defaultValue ?? ""} style={{ width: "100%" }} />
      )}
    </label>
  );
}

export default async function TikTokStrategyPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");
  if (!(await canStaffAccessBrand(ctx, brandId))) redirect("/internal");

  const brandName = await getBrandName(brandId);
  if (!brandName) redirect("/internal");

  const brief = await getStrategyBrief(brandId);
  const boundSave = saveAction.bind(null, brandId);

  return (
    <main>
      <a href={`/internal/brand/${brandId}`} className="back-link">
        &larr; {brandName}
      </a>
      <h1 style={{ marginBottom: 4 }}>TikTok Shop strategy brief — {brandName}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 4 }}>
        <small>
          The account team's working reference for this brand's TikTok Shop presence — audience, creator fit,
          economics, and the guardrail envelope the TikTok Shop Strategist agent can act within once it goes live.
          No agent drafts or edits this yet.
        </small>
      </p>
      {brief?.updatedAt && (
        <p style={{ marginTop: 0, marginBottom: 20 }}>
          <small>
            Last updated {new Date(brief.updatedAt).toLocaleString()}
            {brief.updatedByEmail ? ` by ${brief.updatedByEmail}` : ""}
          </small>
        </p>
      )}

      <form action={boundSave} className="card" style={{ maxWidth: 680 }}>
        <h2 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Audience & product</h2>
        <Field label="Ideal customer profile" name="icp" defaultValue={brief?.icp ?? null} />
        <Field label="Ideal influencer / creator profile" name="creatorProfile" defaultValue={brief?.creatorProfile ?? null} />
        <Field
          label="Margin / profitability targets"
          name="marginTargets"
          defaultValue={brief?.marginTargets ?? null}
          hint="Target margin, TACoS ceiling, or whatever this brand actually tracks."
        />
        <Field label="Hero SKUs" name="heroSkus" defaultValue={brief?.heroSkus ?? null} hint="Which products to lead outreach with." />

        <h2 style={{ fontSize: "0.95rem", margin: "20px 0 12px" }}>Guardrail envelope</h2>
        <p style={{ marginTop: 0 }}>
          <small style={{ color: "var(--muted)" }}>
            What the agent can act on without asking, once outreach automation is signed off. Anything outside this
            goes to the account team as a draft first.
          </small>
        </p>
        <Field label="Approved commission range" name="commissionRange" defaultValue={brief?.commissionRange ?? null} type="text" />
        <Field
          label="Message templates"
          name="messageTemplates"
          defaultValue={brief?.messageTemplates ?? null}
          hint="Approved outreach copy/angles the agent can use as-is."
        />
        <Field label="Daily send cap" name="dailySendCap" defaultValue={brief?.dailySendCap ?? null} type="number" />
        <Field
          label="Budget ceiling ($)"
          name="budgetCeiling"
          defaultValue={brief?.budgetCeiling ?? null}
          type="number"
          hint="Includes contest budgets, if this brand is on Euka's Growth plan."
        />

        <button type="submit">Save</button>
      </form>
    </main>
  );
}
