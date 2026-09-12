"use client";

import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/task-priority";
import { useSavedFeedback } from "./useSavedFeedback";

export function TaskPrioritySelect({
  taskId,
  currentPriority,
  action,
}: {
  taskId: string;
  currentPriority: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const { saved, run } = useSavedFeedback();

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <select
        name="priority"
        defaultValue={currentPriority ?? ""}
        style={{ width: "100%" }}
        onChange={(e) => {
          const formData = new FormData();
          formData.set("taskId", taskId);
          formData.set("priority", e.target.value);
          run(action, formData);
        }}
      >
        <option value="">No priority</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {TASK_PRIORITY_LABELS[p]}
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
