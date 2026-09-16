import { PendingToolPage } from "@/components/PendingToolPage";

export default async function MarketingPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return (
    <PendingToolPage
      brandId={brandId}
      title="Marketing"
      description="Off-Amazon marketing performance (Meta, TikTok Shop, etc.) is coming here."
    />
  );
}
