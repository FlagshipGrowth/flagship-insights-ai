"use client";

import { TASK_STATUSES } from "@/lib/task-status";
import { useSavedFeedback } from "./useSavedFeedback";

export function TaskStatusSelect({
  taskId,
  currentStatus,
  action,
}: {
  taskId: string;
  currentStatus: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const { saved, run } = useSavedFeedback();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => {
          const formData = new FormData();
          formData.set("taskId", taskId);
          formData.set("status", e.target.value);
          run(action, formData);
        }}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      {saved && <small style={{ color: "#16A34A", fontWeight: 600 }}>Saved ✓</small>}
    </div>
  );
}
