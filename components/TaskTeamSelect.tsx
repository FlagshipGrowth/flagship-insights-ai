"use client";

import { TEAMS } from "@/lib/teams";
import { useSavedFeedback } from "./useSavedFeedback";

export function TaskTeamSelect({
  taskId,
  currentTeam,
  action,
}: {
  taskId: string;
  currentTeam: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const { saved, run } = useSavedFeedback();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select
        name="team"
        defaultValue={currentTeam ?? ""}
        onChange={(e) => {
          const formData = new FormData();
          formData.set("taskId", taskId);
          formData.set("team", e.target.value);
          run(action, formData);
        }}
      >
        <option value="">Unassigned team</option>
        {TEAMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {saved && <small style={{ color: "#16A34A", fontWeight: 600 }}>Saved ✓</small>}
    </div>
  );
}
