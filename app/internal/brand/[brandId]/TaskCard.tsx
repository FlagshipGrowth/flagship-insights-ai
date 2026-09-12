"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/Badge";
import { TaskStatusSelect } from "@/components/TaskStatusSelect";
import { TaskTeamSelect } from "@/components/TaskTeamSelect";
import { TaskDueDateInput } from "@/components/TaskDueDateInput";
import { useSavedFeedback } from "@/components/useSavedFeedback";
import { formatDateOnly } from "@/lib/dates";

interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  assignee: string | null;
  team: string | null;
  due_date: string | null;
  created_at: string;
}

interface Comment {
  id: string;
  author: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
}

export function TaskCard({
  task,
  comments,
  isLast,
  boundUpdateStatus,
  boundUpdateTeam,
  boundUpdateDueDate,
  boundDeleteTask,
  boundAddComment,
}: {
  task: Task;
  comments: Comment[];
  isLast?: boolean;
  boundUpdateStatus: (formData: FormData) => Promise<void>;
  boundUpdateTeam: (formData: FormData) => Promise<void>;
  boundUpdateDueDate: (formData: FormData) => Promise<void>;
  boundDeleteTask: (formData: FormData) => void;
  boundAddComment: (formData: FormData) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const { saved: commentSaved, run: runAddComment } = useSavedFeedback();

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "8px 14px",
          borderBottom: isLast ? "none" : "1px solid var(--paper-2)",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            title={task.title}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
              color: "var(--ink)",
              cursor: "pointer",
              textAlign: "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            <strong style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{task.title}</strong>
          </button>
          {comments.length > 0 && (
            <small style={{ color: "var(--muted)", flexShrink: 0 }}>💬 {comments.length}</small>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <small
            style={{
              color: "var(--muted)",
              width: 80,
              textAlign: "right",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.assignee ?? "Unassigned"}
          </small>
          <small style={{ color: "var(--muted)", width: 76, textAlign: "right", flexShrink: 0 }}>
            {task.due_date ? formatDateOnly(task.due_date) : "—"}
          </small>
          <div style={{ width: 110 }}>
            <TaskStatusSelect taskId={task.id} currentStatus={task.status} action={boundUpdateStatus} />
          </div>
          <div style={{ width: 150 }}>
            <TaskTeamSelect taskId={task.id} currentTeam={task.team} action={boundUpdateTeam} />
          </div>
          <form action={boundDeleteTask}>
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" className="secondary">
              Delete
            </button>
          </form>
        </div>
      </div>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <h3 style={{ margin: 0 }}>{task.title}</h3>
              <button type="button" className="secondary" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>

            {task.category && (
              <p style={{ marginTop: 8 }}>
                <small style={{ color: "var(--muted)" }}>{task.category}</small>
              </p>
            )}

            {task.description && <p>{task.description}</p>}

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", margin: "12px 0" }}>
              <div>
                <small style={{ color: "var(--muted)" }}>Status</small>
                <br />
                <TaskStatusSelect taskId={task.id} currentStatus={task.status} action={boundUpdateStatus} />
              </div>
              <div>
                <small style={{ color: "var(--muted)" }}>Team</small>
                <br />
                <TaskTeamSelect taskId={task.id} currentTeam={task.team} action={boundUpdateTeam} />
              </div>
              <div>
                <small style={{ color: "var(--muted)" }}>Assignee</small>
                <br />
                {task.assignee ?? "Unassigned"}
              </div>
              <div>
                <small style={{ color: "var(--muted)" }}>Due date</small>
                <br />
                <TaskDueDateInput taskId={task.id} currentDueDate={task.due_date} action={boundUpdateDueDate} />
              </div>
              <div>
                <small style={{ color: "var(--muted)" }}>Created</small>
                <br />
                {new Date(task.created_at).toLocaleDateString()}
              </div>
            </div>

            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--paper-2)" }} />

            <h4 style={{ marginBottom: 8 }}>Comments</h4>
            {comments.length === 0 ? (
              <p>
                <small style={{ color: "var(--muted)" }}>No comments yet.</small>
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                {comments.map((c) =>
                  c.isSystem ? (
                    <div key={c.id}>
                      <small style={{ color: "var(--muted)", fontStyle: "italic" }}>
                        {c.author} {c.body} · {new Date(c.createdAt).toLocaleString()}
                      </small>
                    </div>
                  ) : (
                    <div key={c.id}>
                      <small style={{ fontWeight: 600 }}>{c.author}</small>{" "}
                      <small style={{ color: "var(--muted)" }}>{new Date(c.createdAt).toLocaleString()}</small>
                      <p style={{ margin: "2px 0 0" }}>{c.body}</p>
                    </div>
                  )
                )}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const body = commentRef.current?.value.trim();
                if (!body) return;
                const formData = new FormData();
                formData.set("taskId", task.id);
                formData.set("body", body);
                await runAddComment(boundAddComment, formData);
                if (commentRef.current) commentRef.current.value = "";
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <textarea ref={commentRef} rows={2} placeholder="Add a comment…" required style={{ width: "100%" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="submit" style={{ alignSelf: "flex-start" }}>
                  Post comment
                </button>
                {commentSaved && <small style={{ color: "#16A34A", fontWeight: 600 }}>Saved ✓</small>}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
