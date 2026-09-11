import { PendingToolPage } from "@/components/PendingToolPage";

export default async function ReimbursementsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return (
    <PendingToolPage
      brandId={brandId}
      title="Reimbursements"
      description="FBA reimbursement tracking (lost/damaged inventory claims) comes directly from Amazon's own records via SP-API — still pending approval (see docs/phase1-amazon-application.md). There's no manual substitute for this one; it needs the real connection."
    />
  );
}
