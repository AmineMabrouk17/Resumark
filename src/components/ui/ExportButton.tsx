"use client";

import { documentTitleFromMarkdown, printResume } from "@/lib/print";

/**
 * PDF export (PRD §22, AC-08): the browser's own print engine.
 * No canvas, no image based PDF, no third party service.
 */
export function ExportButton({
  markdown,
  onResult,
}: {
  markdown: string;
  onResult: (error: string | null) => void;
}) {
  return (
    <button
      type="button"
      className="header-button header-button--primary"
      onClick={() => {
        const result = printResume({ title: documentTitleFromMarkdown(markdown) });
        if (result.ok) {
          onResult(null);
          return;
        }
        onResult(
          result.reason === "unsupported"
            ? "Printing is not available in this browser. Use your browser menu › Print › Save as PDF instead."
            : "The print dialog could not be opened. Please try again.",
        );
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4.5 6V2.5h7V6M4.5 12H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1.5" strokeLinecap="round" />
        <rect x="4.5" y="9.5" width="7" height="4" rx="0.75" />
      </svg>
      <span>Export PDF</span>
    </button>
  );
}
