import { PendingToolPage } from "@/components/PendingToolPage";

export default async function AdsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return (
    <PendingToolPage
      brandId={brandId}
      title="Ads"
      description="A dedicated PPC campaign/target breakdown is coming here — for now, Performance's tiles cover PPC spend, PPC sales, ACOS, TACOS, ROAS, and CPC."
    />
  );
}
