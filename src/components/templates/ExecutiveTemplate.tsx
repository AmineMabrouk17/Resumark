"use client";

import { TEMPLATES } from "@/lib/templates";
import {
  ResumeDocumentView,
  type TemplateProps,
} from "@/components/templates/ResumeDocumentView";

/**
 * Executive (PRD §10.5).
 * The largest name, the most prominent professional title and the airiest
 * leading of any template. Hierarchy is carried by size and tracking alone, so
 * it stays ATS-safe.
 */
export function ExecutiveTemplate(props: TemplateProps) {
  return <ResumeDocumentView {...props} className={TEMPLATES.executive.className} />;
}
