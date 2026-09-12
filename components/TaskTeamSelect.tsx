"use client";

import { TEAMS } from "@/lib/teams";

export function TaskTeamSelect({
  taskId,
  currentTeam,
  action,
}: {
  taskId: string;
  currentTeam: string | null;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="taskId" value={taskId} />
      <select
        name="team"
        defaultValue={currentTeam ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Unassigned team</option>
        {TEAMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </form>
  );
}
