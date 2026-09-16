import { PendingToolPage } from "@/components/PendingToolPage";

export default async function AccountHealthPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return (
    <PendingToolPage
      brandId={brandId}
      title="Account Health"
      description="Buy Box, hijacker, and suppression alerts are coming here."
    />
  );
}
