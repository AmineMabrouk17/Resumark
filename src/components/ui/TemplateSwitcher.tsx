"use client";

import { TEMPLATE_LIST } from "@/lib/templates";
import { isResumeTemplate, type ResumeTemplate } from "@/types/resume";

/**
 * Template switcher (PRD §11). A native <select> keeps it keyboard and screen
 * reader accessible for free, and switching never touches the Markdown.
 */
export function TemplateSwitcher({
  value,
  onChange,
}: {
  value: ResumeTemplate;
  onChange: (template: ResumeTemplate) => void;
}) {
  return (
    <span className="header-field">
      <label className="header-field__label" htmlFor="template-select">
        Template
      </label>
      <select
        id="template-select"
        className="header-select"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (isResumeTemplate(next)) onChange(next);
        }}
      >
        {TEMPLATE_LIST.map((template) => (
          <option key={template.id} value={template.id} title={template.description}>
            {template.label}
          </option>
        ))}
      </select>
    </span>
  );
}
