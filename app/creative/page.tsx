import { PendingClientToolPage } from "@/components/PendingClientToolPage";

export default async function CreativePage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const { brand } = await searchParams;
  return (
    <PendingClientToolPage
      brand={brand}
      title="Creative"
      description="Ad creative assets and performance are coming here."
    />
  );
}
