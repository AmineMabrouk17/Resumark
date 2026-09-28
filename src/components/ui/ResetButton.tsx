"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/** Reset action (PRD §29) — always behind a confirmation. */
export function ResetButton({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="header-button header-button--ghost"
        onClick={() => setOpen(true)}
      >
        Reset
      </button>
      <ConfirmDialog
        open={open}
        title="Reset this resume?"
        description="Your saved resume will be deleted, and the example Markdown, the Classic template and Normal page mode will be restored. This cannot be undone."
        confirmLabel="Delete and reset"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onReset();
        }}
      />
    </>
  );
}
