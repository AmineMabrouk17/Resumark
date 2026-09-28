/**
 * PDF export through the browser's native print engine (PRD §22, §23, AC-08).
 *
 * No html2canvas / jsdf / canvas / third-party PDF service: `window.print()`
 * produces vector text that stays selectable, searchable and clickable.
 *
 * One thing the app cannot control, and which the verification harness works
 * around: Chromium's print dialog has a "Headers and footers" checkbox that is
 * **on by default** and that no web API can turn off. Those headers are drawn
 * into the page margin, *not* into the content box, so the document still fits
 * the same number of A4 pages — but the *paper* the user ends up with has a URL
 * and a date in it, and the harness cannot assert their absence. The user has
 * to untick one box. This is the single largest gap between what the code
 * promises and what the exported file looks like, and it is a browser default
 * rather than a defect here.
 */

export type PrintResult = {
  ok: boolean;
  /** Present when printing could not be started; never a raw error object. */
  reason?: "unsupported" | "failed";
};

export function isPrintSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.print === "function" &&
    typeof document !== "undefined"
  );
}

/** Best effort filename for the browser's "Save as PDF" dialog. */
export function documentTitleFromMarkdown(markdown: string): string {
  const heading = markdown
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .find((line) => /^#[ \t]+\S/.test(line));
  const name = heading?.replace(/^#+[ \t]*/, "").replace(/[ \t]+#+[ \t]*$/, "").trim();
  return name ? `${name} — Resume` : "Resume";
}

export type PrintOptions = {
  /** Used as the print job / suggested file name. */
  title?: string;
  /** Notified once the print dialog closed (or after `restoreDelayMs`). */
  onAfterPrint?: () => void;
};

export function printResume(options: PrintOptions = {}): PrintResult {
  if (typeof window === "undefined" || !isPrintSupported()) {
    return { ok: false, reason: "unsupported" };
  }

  const previousTitle = document.title;
  if (options.title) document.title = options.title;

  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restore);
    options.onAfterPrint?.();
  };

  try {
    window.addEventListener("afterprint", restore);
    window.print();
    // Safari does not always fire `afterprint`; make sure the title is restored.
    window.setTimeout(restore, 60_000);
  } catch {
    restore();
    return { ok: false, reason: "failed" };
  }

  return { ok: true };
}
