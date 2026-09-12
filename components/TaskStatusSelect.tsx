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
    <div style={{ position: "relative", width: "100%" }}>
      <select
        name="status"
        defaultValue={currentStatus}
        style={{ width: "100%" }}
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
