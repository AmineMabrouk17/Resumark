"use client";

import { TEMPLATES } from "@/lib/templates";
import {
  ResumeDocumentView,
  type TemplateProps,
} from "@/components/templates/ResumeDocumentView";

/**
 * Minimal (PRD §10.3).
 * No rules, tighter rhythm, maximum information density — aimed at technical
 * resumes that need to fit a lot on one page.
 */
export function MinimalTemplate(props: TemplateProps) {
  return <ResumeDocumentView {...props} className={TEMPLATES.minimal.className} />;
}
