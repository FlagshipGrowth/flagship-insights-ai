"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { TaskStatusSelect } from "./TaskStatusSelect";

interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  assignee: string | null;
  due_date: string | null;
  created_at: string;
}

interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export function TaskCard({
  task,
  comments,
  boundUpdateStatus,
  boundDeleteTask,
  boundAddComment,
}: {
  task: Task;
  comments: Comment[];
  boundUpdateStatus: (formData: FormData) => void;
  boundDeleteTask: (formData: FormData) => void;
  boundAddComment: (formData: FormData) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <strong style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{task.title}</strong>
            </button>
            <Badge variant={task.status}>{task.status.replace("_", " ")}</Badge>
            {comments.length > 0 && <small style={{ color: "var(--muted)" }}>💬 {comments.length}</small>}
          </div>
          {task.description && <p style={{ margin: "4px 0" }}>{task.description}</p>}
          <small>
            {task.assignee ? `${task.assignee}` : "Unassigned"}
            {task.due_date ? ` · due ${new Date(task.due_date).toLocaleDateString()}` : ""}
          </small>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <TaskStatusSelect taskId={task.id} currentStatus={task.status} action={boundUpdateStatus} />
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
                <small style={{ color: "var(--muted)" }}>Assignee</small>
                <br />
                {task.assignee ?? "Unassigned"}
              </div>
              <div>
                <small style={{ color: "var(--muted)" }}>Due date</small>
                <br />
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
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
                {comments.map((c) => (
                  <div key={c.id}>
                    <small style={{ fontWeight: 600 }}>{c.author}</small>{" "}
                    <small style={{ color: "var(--muted)" }}>{new Date(c.createdAt).toLocaleString()}</small>
                    <p style={{ margin: "2px 0 0" }}>{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            <form action={boundAddComment} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="hidden" name="taskId" value={task.id} />
              <textarea name="body" rows={2} placeholder="Add a comment…" required style={{ width: "100%" }} />
              <button type="submit" style={{ alignSelf: "flex-start" }}>
                Post comment
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
