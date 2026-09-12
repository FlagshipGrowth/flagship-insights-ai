"use client";

import { TASK_STATUSES } from "@/lib/task-status";

export function TaskStatusSelect({
  taskId,
  currentStatus,
  action,
}: {
  taskId: string;
  currentStatus: string;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="taskId" value={taskId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
    </form>
  );
}
