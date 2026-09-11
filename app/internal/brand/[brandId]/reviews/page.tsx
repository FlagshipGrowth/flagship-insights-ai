import { PendingToolPage } from "@/components/PendingToolPage";

export default async function ReviewsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return (
    <PendingToolPage
      brandId={brandId}
      title="Reviews"
      description="Review monitoring (ratings, new review alerts, sentiment) needs Amazon SP-API access to pull real review data — still pending approval (see docs/phase1-amazon-application.md)."
    />
  );
}
