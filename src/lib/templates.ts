import type { ResumeTemplate } from "@/types/resume";

/**
 * Template registry (PRD §10 / §11).
 *
 * Every template renders the exact same Markdown through the same node
 * renderer — only the CSS class applied to the document root differs, so
 * templates stay consistent and Markdown is never modified.
 */

export type TemplateMeta = {
  id: ResumeTemplate;
  label: string;
  description: string;
  /** Class applied to the resume document root; the look lives in resume.css. */
  className: string;
};

export const TEMPLATES: Record<ResumeTemplate, TemplateMeta> = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Ruled section headings, 11 px body. The safest choice for ATS parsing.",
    className: "resume--classic",
  },
  modern: {
    id: "modern",
    label: "Modern",
    description: "A deep-blue accent bar and the loosest rhythm. Reads well when a human sees it first.",
    className: "resume--modern",
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    description: "Sentence-case headings, hairline rules, 10.5 px body. Fits the most on one page.",
    className: "resume--minimal",
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    description: "Serif masthead, wide-tracked section titles, a printed-journal rhythm.",
    className: "resume--editorial",
  },
  executive: {
    id: "executive",
    label: "Executive",
    description: "Largest name, a prominent title line, and the most generous leading.",
    className: "resume--executive",
  },
};

export const TEMPLATE_LIST: TemplateMeta[] = [
  TEMPLATES.classic,
  TEMPLATES.modern,
  TEMPLATES.minimal,
  TEMPLATES.editorial,
  TEMPLATES.executive,
];
