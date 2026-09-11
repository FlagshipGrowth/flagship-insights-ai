import { PendingToolPage } from "@/components/PendingToolPage";

export default async function ForecastPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return (
    <PendingToolPage
      brandId={brandId}
      title="Forecast"
      description="Demand forecasting needs real Amazon sales history and inventory velocity — both come from the SP-API connection, which is still pending approval (see docs/phase1-amazon-application.md). Nothing to configure here until that clears."
    />
  );
}
