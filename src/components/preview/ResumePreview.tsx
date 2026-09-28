"use client";

import { useRef, type CSSProperties } from "react";

import type { FitStatus } from "@/hooks/useOnePageFit";
import { usePreviewScale } from "@/hooks/usePreviewScale";
import { PAGE } from "@/lib/onePage";
import type { ResumeOutline } from "@/lib/markdown/resumeOutline";
import { TEMPLATE_COMPONENTS } from "@/components/templates";
import type { ResumeTemplate } from "@/types/resume";

export type ResumePreviewProps = {
  outline: ResumeOutline;
  template: ResumeTemplate;
  onePage: boolean;
  fit: FitStatus;
  /** Ref callback for the measured resume element. */
  onDocumentRef: (element: HTMLElement | null) => void;
};

/**
 * Page counter chip (PRD §15, §16).
 *
 * The chip reports *fit*, not which mode produced it: a resume that fits on one
 * page fits in both modes, so it gets the same label and the same colour
 * either way. Saturation is reserved for the two states that mean something.
 *
 * The `data-*` attributes expose the *measured* state, which is what the print
 * verification harness and the end-to-end checks assert on — the visible label
 * is only a summary of them.
 */
function PageBadge({ fit, level }: { fit: FitStatus; level: number }) {
  const state = fit.overflow ? "over" : fit.pageCount === 1 ? "one" : "many";
  return (
    <span
      className={`page-badge page-badge--${state}`}
      title="Pages the resume needs at the current density"
      data-page-count={fit.pageCount}
      data-density-level={level}
      data-content-height={Math.round(fit.contentHeight)}
      data-overflow={fit.overflow ? "true" : "false"}
      data-measured={fit.contentHeight > 0 ? "true" : "false"}
    >
      {fit.overflow
        ? "Over 1 page"
        : fit.pageCount === 1
          ? "1 page"
          : `${fit.pageCount} pages`}
    </span>
  );
}

/**
 * A4 preview (PRD §7, §16, §26).
 *
 * The sheet is a real 210 × 297 mm box with the same 12mm/15mm padding as the
 * print margins, so the screen preview and the exported PDF share one layout.
 * Page boundaries are drawn as rules every 297 mm, which shows natural
 * pagination in Normal mode without duplicating the document.
 */
export function ResumePreview({
  outline,
  template,
  onePage,
  fit,
  onDocumentRef,
}: ResumePreviewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const zoom = usePreviewScale(stageRef);
  const TemplateComponent = TEMPLATE_COMPONENTS[template];

  /*
   * The badge has to describe what is actually on the sheet. In Normal mode the
   * document is rendered at level 0 whatever the engine last decided, so the
   * One Page level and overflow flag are both meaningless until One Page is
   * switched on.
   */
  const level = onePage ? fit.level : 0;
  const shown: FitStatus = onePage
    ? fit
    : { ...fit, level: 0, overflow: false };

  return (
    <>
      <div className="pane-bar pane-bar--preview no-print">
        <span>Preview</span>
        <span className="pane-bar__hint">
          A4 · {PAGE.widthMm} × {PAGE.heightMm} mm · {PAGE.marginYMm}/{PAGE.marginXMm} mm
          margins
        </span>
      </div>

      <div className="preview-stage" ref={stageRef}>
        <div
          className="preview-sheet"
          style={{ "--preview-zoom": zoom } as CSSProperties}
        >
          <TemplateComponent
            outline={outline}
            densityLevel={level}
            documentRef={onDocumentRef}
          />
        </div>
      </div>

      <div className="preview-footer no-print">
        <PageBadge fit={shown} level={level} />

        {onePage && fit.overflow ? (
          /*
           * `role="status"` announces this, so the text must not embed a number
           * that changes on every keystroke — that re-announces a 40-word
           * sentence while the user is mid-edit. The exact count is on the chip.
           */
          <p className="page-warning" role="status">
            <span aria-hidden="true">⚠</span>
            <span>
              <strong>This resume is too long for one page.</strong>
              It does not fit on a single A4 sheet even at the most compact
              readable layout — shorten the content to fit. Nothing has been
              hidden, cropped or scaled.
            </span>
          </p>
        ) : onePage ? (
          <p className="page-hint">
            One Page mode: {fit.label.toLowerCase()}
            {level > 0 ? " applied to fit a single A4 sheet." : " — no changes needed."}
          </p>
        ) : (
          <p className="page-hint">
            Normal mode: the resume flows across A4 pages when exported.
          </p>
        )}
      </div>
    </>
  );
}
