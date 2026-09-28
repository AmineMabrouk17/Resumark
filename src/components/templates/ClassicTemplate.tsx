"use client";

import { TEMPLATES } from "@/lib/templates";
import {
  ResumeDocumentView,
  type TemplateProps,
} from "@/components/templates/ResumeDocumentView";

/**
 * Classic — the default template (PRD §10.1).
 * Single column, black/gray typography, clear hierarchy, minimal decoration.
 */
export function ClassicTemplate(props: TemplateProps) {
  return <ResumeDocumentView {...props} className={TEMPLATES.classic.className} />;
}
