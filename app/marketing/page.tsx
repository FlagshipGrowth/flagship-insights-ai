import { PendingClientToolPage } from "@/components/PendingClientToolPage";

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const { brand } = await searchParams;
  return (
    <PendingClientToolPage
      brand={brand}
      title="Marketing"
      description="Off-Amazon marketing performance (Meta, TikTok Shop, etc.) is coming here."
    />
  );
}
