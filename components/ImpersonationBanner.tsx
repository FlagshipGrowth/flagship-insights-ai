import { getUserContext } from "@/lib/user-context";
import { exitImpersonation } from "@/lib/impersonation";

/** Renders nothing unless the real signed-in user is an owner currently previewing another
 * account (see lib/user-context.ts's getUserContext) — cache()-wrapped, so this doesn't cost an
 * extra DB round trip beyond whatever the page itself already looked up. */
export async function ImpersonationBanner() {
  const ctx = await getUserContext();
  if (!ctx?.impersonating) return null;

  return (
    <div
      style={{
        background: "var(--ink, #0B0D12)",
        color: "var(--paper, #F6F3EC)",
        padding: "8px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span>
        Viewing as <strong>{ctx.email}</strong> ({ctx.role})
      </span>
      <form action={exitImpersonation}>
        <button type="submit">Exit</button>
      </form>
    </div>
  );
}
