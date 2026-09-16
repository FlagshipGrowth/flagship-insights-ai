import { PendingToolPage } from "@/components/PendingToolPage";

export default async function PnlPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return (
    <PendingToolPage
      brandId={brandId}
      title="P&L"
      description="A full profit & loss breakdown is coming here — for now, Performance's tiles cover revenue, PPC spend/sales, refund rate, and margin-related metrics."
    />
  );
}
