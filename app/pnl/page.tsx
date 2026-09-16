import { PendingClientToolPage } from "@/components/PendingClientToolPage";

export default async function PnlPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const { brand } = await searchParams;
  return (
    <PendingClientToolPage
      brand={brand}
      title="P&L"
      description="A full profit & loss breakdown is coming here — for now, the Home tab's Performance tiles cover revenue, PPC spend/sales, refund rate, and margin-related metrics."
    />
  );
}
