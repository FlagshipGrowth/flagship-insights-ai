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
    <div style={{ position: "relative", width: "100%" }}>
      <select
        name="team"
        defaultValue={currentTeam ?? ""}
        style={{ width: "100%" }}
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
      {saved && (
        <small
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            whiteSpace: "nowrap",
            color: "#16A34A",
            fontWeight: 600,
            background: "#fff",
            zIndex: 1,
          }}
        >
          Saved ✓
        </small>
      )}
    </div>
  );
}
