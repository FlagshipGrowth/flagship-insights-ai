"use client";

/** Auto-submits on change — needs a Client Component boundary for the onChange handler, which a
 * Server Component (app/internal/crm/page.tsx) can't attach directly. */
export function LeadStageSelect({
  stage,
  stages,
  labels,
  action,
}: {
  stage: string;
  stages: readonly string[];
  labels: Record<string, string>;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <select name="stage" defaultValue={stage} onChange={(e) => e.currentTarget.form?.requestSubmit()} style={{ width: "100%" }}>
        {stages.map((s) => (
          <option key={s} value={s}>
            {labels[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
