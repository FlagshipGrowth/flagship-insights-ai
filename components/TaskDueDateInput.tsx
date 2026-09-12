"use client";

import { useSavedFeedback } from "./useSavedFeedback";

export function TaskDueDateInput({
  taskId,
  currentDueDate,
  action,
}: {
  taskId: string;
  currentDueDate: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const { saved, run } = useSavedFeedback();

  return (
    <div style={{ position: "relative" }}>
      <input
        type="date"
        name="dueDate"
        defaultValue={currentDueDate ? currentDueDate.slice(0, 10) : ""}
        onChange={(e) => {
          const formData = new FormData();
          formData.set("taskId", taskId);
          formData.set("dueDate", e.target.value);
          run(action, formData);
        }}
      />
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
