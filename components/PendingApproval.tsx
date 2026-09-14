import { UserButton } from "@clerk/nextjs";

/** Shown instead of the real dashboard for a client whose account is still awaiting admin
 * approval (users.status = 'pending' — see migration 0025 and /internal/approvals). */
export function PendingApproval() {
  return (
    <main style={{ maxWidth: 480 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Thanks for signing up</h1>
        <UserButton />
      </header>
      <p>Your account is pending review and you will be notified once approved.</p>
    </main>
  );
}
