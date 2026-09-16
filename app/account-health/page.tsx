import { PendingClientToolPage } from "@/components/PendingClientToolPage";

export default async function AccountHealthPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const { brand } = await searchParams;
  return (
    <PendingClientToolPage
      brand={brand}
      title="Account Health"
      description="Buy Box, hijacker, and suppression alerts are coming here."
    />
  );
}
