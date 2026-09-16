import { PendingClientToolPage } from "@/components/PendingClientToolPage";

export default async function AdsPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const { brand } = await searchParams;
  return (
    <PendingClientToolPage
      brand={brand}
      title="Ads"
      description="A dedicated PPC campaign/target breakdown is coming here — for now, the Home tab's Performance tiles cover PPC spend, PPC sales, ACOS, TACOS, ROAS, and CPC."
    />
  );
}
