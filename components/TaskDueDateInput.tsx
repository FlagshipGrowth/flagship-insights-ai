"use client";

export function TaskDueDateInput({
  taskId,
  currentDueDate,
  action,
}: {
  taskId: string;
  currentDueDate: string | null;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="taskId" value={taskId} />
      <input
        type="date"
        name="dueDate"
        defaultValue={currentDueDate ? currentDueDate.slice(0, 10) : ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
