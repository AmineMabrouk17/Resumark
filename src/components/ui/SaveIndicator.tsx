"use client";

import type { SaveStatus } from "@/hooks/useResumeState";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Local persistence feedback (PRD §27, §27a, §35). */
export function SaveIndicator({
  status,
  autosave,
}: {
  status: SaveStatus;
  autosave: boolean;
}) {
  /*
   * Autosave off is reported as a warning, not as a neutral state. The chosen
   * semantics are destructive — nothing is written, so a reload discards the
   * session — and the only honest thing the status line can do is say so
   * before the user finds out the expensive way. A neutral grey here would be
   * the same silence that makes a lost resume a bug report.
   */
  const off = !autosave;

  const label = off
    ? "Autosave off"
    : !status.persistent
      ? "Storage unavailable"
      : status.saving
        ? "Saving…"
        : status.savedAt
          ? `Saved ${formatTime(status.savedAt)}`
          : "Autosave on";

  const tone = off ? "warn" : status.persistent ? "ok" : "error";

  const hint = off
    ? "Nothing is being written to this browser. Reloading or closing the tab will discard your changes — copy your Markdown out, or turn Autosave back on. Ctrl/Cmd + S is disabled while autosave is off, so that the saved copy always matches what the switch promises."
    : status.persistent
      ? "Your resume is saved in this browser (Ctrl/Cmd + S to save now)."
      : "This browser blocks local storage — your resume is kept in memory only.";

  return (
    <span className="save-status" data-tone={tone} role="status" aria-live="polite" title={hint}>
      {label}
    </span>
  );
}
