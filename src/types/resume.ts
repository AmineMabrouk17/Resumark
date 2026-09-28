/**
 * Resumark data model (PRD §33).
 *
 * Markdown is the single source of truth: the app never converts it into a
 * structured resume schema. The state below is only "which text + which look".
 */

export const RESUME_TEMPLATES = [
  "classic",
  "modern",
  "minimal",
  "editorial",
  "executive",
] as const;

export type ResumeTemplate = (typeof RESUME_TEMPLATES)[number];

export type ResumeState = {
  markdown: string;
  template: ResumeTemplate;
  onePage: boolean;
};

export const DEFAULT_TEMPLATE: ResumeTemplate = "classic";

export function isResumeTemplate(value: unknown): value is ResumeTemplate {
  return (
    typeof value === "string" && (RESUME_TEMPLATES as readonly string[]).includes(value)
  );
}
