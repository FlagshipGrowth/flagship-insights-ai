import { redirect } from "next/navigation";
import { getUserContext, isInternalStaff, isOwner } from "@/lib/user-context";
import { getPendingUsersCount } from "@/lib/user-approvals";
import { InternalSidebar } from "@/components/InternalSidebar";

// Shared app shell for every /internal page — a persistent left nav rather than each page being
// a standalone centered document. Individual pages keep their own isOwner()/role gating for the
// specific actions they allow; this layout only enforces the coarse "is staff at all" gate so a
// client account gets bounced before the shell even renders.
export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");

  const owner = isOwner(ctx);
  const pendingUsersCount = owner ? await getPendingUsersCount() : 0;

  return (
    <div className="app-shell">
      <InternalSidebar owner={owner} pendingUsersCount={pendingUsersCount} email={ctx.email} />
      <div className="app-content">{children}</div>
    </div>
  );
}
