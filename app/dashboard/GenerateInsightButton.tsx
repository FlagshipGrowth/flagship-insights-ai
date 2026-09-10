"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Calls the standalone Netlify background function directly (not a Next.js API route) —
// it lives in netlify/functions/generate-insights-background.ts alongside sync-nightly, since
// it's the same kind of long-running, non-page-request work.
export function GenerateInsightButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch("/.netlify/functions/generate-insights-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("idle");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? "Generating…" : "Generate insight"}
      </button>
      {status === "error" && (
        <p style={{ color: "#a00" }}>
          Couldn't generate an insight — likely no ANTHROPIC_API_KEY set, or no data synced yet.
        </p>
      )}
    </div>
  );
}
