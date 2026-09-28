"use client";

import { memo, type Ref } from "react";

import { densityStyle } from "@/lib/onePage";
import type { ResumeOutline } from "@/lib/markdown/resumeOutline";
import { ResumeLayout } from "@/components/templates/ResumeLayout";

/** Props every template receives — templates only change presentation. */
export type TemplateProps = {
  /** Structural view of the Markdown (never a copy of the content). */
  outline: ResumeOutline;
  /** One Page compaction level (0 = untouched). */
  densityLevel: number;
  /** Target for the measured resume element (One Page + page count). */
  documentRef?: Ref<HTMLElement>;
};

/**
 * Shared document shell. The templates differ only by `className`,
 * which selects the visual variant defined in `resume.css`.
 *
 * Memoised: rendering the Markdown tree is by far the most expensive render in
 * the app, and the fit status changes on every keystroke (the document is
 * re-measured while it grows). Without the memo each of those measurements
 * would re-parse and re-render the whole resume for a change that only affects
 * the page counter.
 */
export const ResumeDocumentView = memo(function ResumeDocumentView({
  outline,
  densityLevel,
  documentRef,
  className,
}: TemplateProps & { className: string }) {
  return (
    <article
      ref={documentRef}
      className={`resume-document ${className}`}
      style={densityStyle(densityLevel)}
      data-density={densityLevel}
    >
      <ResumeLayout outline={outline} />
    </article>
  );
});
