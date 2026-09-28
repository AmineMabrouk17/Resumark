"use client";

import { TEMPLATES } from "@/lib/templates";
import {
  ResumeDocumentView,
  type TemplateProps,
} from "@/components/templates/ResumeDocumentView";

/**
 * Modern (PRD §10.2).
 * Stronger visual hierarchy, one subtle accent colour, still text based.
 */
export function ModernTemplate(props: TemplateProps) {
  return <ResumeDocumentView {...props} className={TEMPLATES.modern.className} />;
}
