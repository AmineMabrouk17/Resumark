"use client";

import { TEMPLATES } from "@/lib/templates";
import {
  ResumeDocumentView,
  type TemplateProps,
} from "@/components/templates/ResumeDocumentView";

/**
 * Editorial (PRD §10.4).
 * A serif masthead and widely tracked section titles, with more leading than
 * the other templates — the look of a printed journal rather than a form.
 * Still one column of real text, so ATS parsing is unaffected.
 */
export function EditorialTemplate(props: TemplateProps) {
  return <ResumeDocumentView {...props} className={TEMPLATES.editorial.className} />;
}
