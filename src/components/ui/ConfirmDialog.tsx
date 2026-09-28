"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Selects the app shell itself, never a nested match, so it can be `inert`. */
const APP_SHELL = ".app-shell";

/**
 * Accessible confirmation dialog (PRD §29): focus moves into the dialog,
 * Tab is trapped, Escape and the backdrop cancel, focus returns to the opener.
 *
 * Portalled to `document.body` so the rest of the app can be made `inert`. The
 * dialog is a *child* of the header that opens it, so without the portal the
 * only thing that could be inert is the dialog's own ancestor — which would
 * inert the dialog too. The `no-print` class is therefore now load-bearing
 * rather than inherited from the header.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  /*
   * `inert` and focus restoration live in one effect, in one order, because the
   * order is load-bearing.
   *
   * `aria-modal` tells assistive technology the rest of the page is
   * unavailable; it does nothing for pointer, keyboard or forced-colours users.
   * `inert` is what actually removes the background from the tab order, the
   * click target and the accessibility tree.
   *
   * And `inert` also makes `focus()` a no-op on everything inside it. These were
   * two effects, and React runs cleanups in declaration order — so the focus
   * restoration fired while the shell was still inert, silently did nothing, and
   * left focus stranded on `<body>` after every Escape. Focus now returns after
   * the attribute is gone, in the same block, where the sequence is readable.
   */
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const shell = document.querySelector(APP_SHELL);
    shell?.setAttribute("inert", "");

    /*
     * Focus the dialog, not a button. Landing on "Reset everything" would put
     * a destructive action under the user's finger before they have read the
     * question; the first Tab then reaches Cancel, which is where a dialog the
     * user only needs to dismiss should start.
     */
    dialogRef.current?.focus();

    return () => {
      shell?.removeAttribute("inert");
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="dialog-backdrop no-print"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0]!;
          const last = focusable[focusable.length - 1]!;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 className="dialog__title" id={titleId}>
          {title}
        </h2>
        <p className="dialog__body" id={descriptionId}>
          {description}
        </p>
        <div className="dialog__actions">
          <button type="button" className="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
