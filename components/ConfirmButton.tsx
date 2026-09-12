"use client";

/** A plain form-submit button gated behind a native confirm() — for actions that hard-delete
 * data with no undo (removing someone's access, deleting a brand). Not a replacement for a real
 * "type the name to confirm" flow, just a lightweight guard against a misclick. */
export function ConfirmButton({
  confirmText,
  children,
  style,
  className,
}: {
  confirmText: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      style={style}
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
