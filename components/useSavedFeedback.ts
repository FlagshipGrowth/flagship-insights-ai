"use client";

import { useState } from "react";

/** Shows a brief "Saved" confirmation after a server action (invoked directly, not via a plain
 * form submission) resolves — used by every inline task editor (status/team/due date/comments)
 * so a change doesn't just silently take effect with no feedback. */
export function useSavedFeedback() {
  const [saved, setSaved] = useState(false);

  async function run(action: (formData: FormData) => Promise<void>, formData: FormData) {
    await action(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return { saved, run };
}
