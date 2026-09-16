import { PendingToolPage } from "@/components/PendingToolPage";

export default async function CreativePage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return (
    <PendingToolPage
      brandId={brandId}
      title="Creative"
      description="Ad creative assets and performance are coming here."
    />
  );
}
