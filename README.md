# Resumark

> **Write Markdown → Preview resume → Choose template → Optionally force one-page layout → Export A4 PDF**

Resumark is a Markdown-based resume editor with a live A4 preview, professional templates,
ATS-friendly formatting, and native PDF export. It is fast, simple, professional,
ATS-friendly, and developer-oriented.

This document is the product requirements document (PRD) for Resumark.

---

## Table of Contents

- [1. Product Overview](#1-product-overview)
- [2. Problem](#2-problem)
- [3. Target Users](#3-target-users)
- [4. Core User Flow](#4-core-user-flow)
- [5. Product Principles](#5-product-principles)
- [6. Markdown Editor](#6-markdown-editor)
- [7. Live Resume Preview](#7-live-resume-preview)
- [8. Markdown Rendering](#8-markdown-rendering)
- [9. Resume Typography](#9-resume-typography)
- [10. Templates](#10-templates)
- [11. Template Switcher](#11-template-switcher)
- [12. Page Mode / One-Page Option](#12-page-mode--one-page-option)
- [13. One-Page Mode Behavior](#13-one-page-mode-behavior)
- [14. One-Page Mode Priority](#14-one-page-mode-priority)
- [15. One-Page Mode Warning](#15-one-page-mode-warning)
- [16. One-Page Preview](#16-one-page-preview)
- [17. Normal Page Mode](#17-normal-page-mode)
- [18. Multi-Page Resumes](#18-multi-page-resumes)
- [19. Page Break Handling](#19-page-break-handling)
- [20. Application Layout](#20-application-layout)
- [21. Header](#21-header)
- [22. PDF Export](#22-pdf-export)
- [23. Print CSS](#23-print-css)
- [24. Print Behavior — Normal Mode](#24-print-behavior--normal-mode)
- [25. Print Behavior — One Page Mode](#25-print-behavior--one-page-mode)
- [26. A4 Preview Component](#26-a4-preview-component)
- [27. Local Persistence](#27-local-persistence)
- [27a. Autosave Switch](#27a-autosave-switch)
- [28. Persist Page Settings](#28-persist-page-settings)
- [29. Reset Resume](#29-reset-resume)
- [30. Responsive Design](#30-responsive-design)
- [31. Tech Stack](#31-tech-stack)
- [32. Architecture](#32-architecture)
- [33. Data Model](#33-data-model)
- [34. Performance](#34-performance)
- [35. Accessibility](#35-accessibility)
- [36. Error Handling](#36-error-handling)
- [37. Default Resume](#37-default-resume)
- [38. MVP Features](#38-mvp-features)
- [39. Non-Goals](#39-non-goals)
- [40. Acceptance Criteria](#40-acceptance-criteria)
- [41. Definition of Done](#41-definition-of-done)
- [42. Success Metric](#42-success-metric)
- [43. Running and Verification](#43-running-and-verification)

---

# 1. Product Overview

### Product Name

**Resumark**

### Product Type

Markdown-based resume editor with live A4 preview, five professional templates, ATS-friendly formatting, and native PDF export.

### Product Goal

Resumark allows users to create professional resumes using Markdown.

The core workflow is:

> **Write Markdown → Preview resume → Choose template → Optionally force one-page layout → Export A4 PDF**

The product should be **fast, simple, professional, ATS-friendly, and developer-oriented**.

### Status

The MVP in §38 is built and verified. `docs/VERIFICATION.md` is the evidence;
§43 is how to reproduce it.

---

# 2. Problem

Traditional resume builders often require users to manually edit many UI fields, use complicated drag-and-drop interfaces, or pay for PDF export.

Developers and technical users may already have their resume content in Markdown and want a simpler workflow.

Resumark solves this by treating **Markdown as the source of truth** while providing a polished visual resume preview.

---

# 3. Target Users

Primary users:

- Software developers
- Engineers
- Students
- Technical professionals
- Designers
- Job seekers comfortable with Markdown

Typical use case:

> A developer has a Markdown resume and wants to quickly turn it into a professional PDF for a job application.

---

# 4. Core User Flow

```text
Open Resumark
      ↓
Markdown resume loaded
      ↓
┌─────────────────────────────┐
│ Markdown Editor │ A4 Preview│
└─────────────────────────────┘
      ↓
Edit Markdown
      ↓
Preview updates instantly
      ↓
Choose template
      ↓
Choose page mode
      ↓
[ Normal ] or [ One Page ]
      ↓
Click "Export PDF"
      ↓
Browser Print Dialog
      ↓
Save as PDF
```

---

# 5. Product Principles

Resumark should follow these principles:

### 5.1 Markdown First

Markdown is the source of truth.

The UI should never force the user to manually manage individual resume fields.

### 5.2 Print First

The browser's native print engine should generate the PDF.

### 5.3 ATS Friendly

Templates should prioritize readable, semantic, text-based content over visual decoration.

### 5.4 Fast

No backend or API should be required for the core workflow.

### 5.5 Professional

The generated PDF should look like a professionally typeset resume rather than a web page screenshot.

---

# 6. Markdown Editor

Resumark must provide a Markdown editor on the left side of the interface.

### Technology

Use:

```text
@monaco-editor/react
```

Monaco should provide a VS Code-like editing experience.

### Features

- Markdown syntax highlighting
- Line numbers
- Keyboard shortcuts
- Auto indentation
- Dark editor theme
- Editable Markdown
- Real-time preview updates

Example:

```markdown
# Amine Mabrouk

Full Stack Developer

## Experience

### Full Stack Developer — Infraway

Jul 2025 – Present

- Built Angular applications
- Developed Laravel APIs
- Integrated S3-compatible storage

## Skills

- Laravel
- Angular
- TypeScript
- Docker
```

---

# 7. Live Resume Preview

The right side of the application displays the rendered resume.

### Requirements

The preview must:

- Use A4 dimensions
- Have a white background
- Be centered inside the application
- Have a subtle shadow in editor mode
- Remove the shadow when printing
- Render Markdown as professional resume content
- Update automatically when Markdown changes

### A4 dimensions

```text
210mm × 297mm
```

---

# 8. Markdown Rendering

Use:

```text
react-markdown
remark-gfm
```

Example:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {markdown}
</ReactMarkdown>
```

Custom rendering must be implemented for resume-specific typography.

### Supported Markdown

```text
# H1
## H2
### H3

Paragraphs

- Bullet lists
- Ordered lists

**Bold**
*Italic*

[Links](https://example.com)

> Blockquotes

`inline code`
```

---

# 9. Resume Typography

The default template should prioritize:

- ATS compatibility
- readability
- compact spacing
- professional appearance
- clear hierarchy

Suggested typography:

| Element            | Style        |
| ------------------ | ------------ |
| Name               | 24–28px bold |
| Professional title | 12–14px      |
| Section title      | 11–14px bold |
| Job title          | 11–12px bold |
| Body               | 9–11px       |
| Metadata           | 9–10px       |
| Links              | 9–10px       |

These ranges are **enforced, not aspirational**: `scripts/design-qa.mjs`
measures each role off the live DOM and fails the build if it falls outside
them, and separately asserts that the hierarchy is monotonic
(name > section title > job title ≥ body).

Avoid excessive:

- colors
- icons
- graphics
- decorative backgrounds
- complex layouts

### Section-heading letter spacing is capped

Section titles are set uppercase with letter spacing, and that spacing has a
**hard ceiling of `0.095em`**. The ceiling was found during the build rather than
chosen as a stylistic preference, and it constrains every template:

At `0.115em` and above, Chromium emits each glyph of a wide-tracked run as its
own positioned text run. A text extractor then reads the gaps as word breaks,
and the exported PDF's text layer spells the heading as `E D U C AT I O N`.
The **rendered page looks correct** — only the text layer is broken. That layer
is what an ATS parser reads, what a search for "Education" matches, and what a
screen reader announces, so the break is a failure of §5.3 while appearing to
satisfy §5.5.

A template must therefore establish its character through type scale, rules and
colour rather than through tracking. The verification harness asserts, for
every shipped template, that each heading survives PDF text extraction as a
single word — see §43.

---

# 10. Templates

Resumark must support multiple templates.

## 10.1 Classic

Default template.

Characteristics:

- Single column
- Black/gray typography
- Clear section hierarchy
- Minimal decoration
- ATS-friendly
- Professional

---

## 10.2 Modern

Characteristics:

- Stronger visual hierarchy
- Subtle accent color
- Modern typography
- Still ATS-friendly

---

## 10.3 Minimal

Characteristics:

- Very compact
- Minimal borders
- High information density
- Suitable for technical resumes

---

## 10.4 Editorial

Characteristics:

- Serif name, professional title and section titles
- Sans-serif body text
- Heavier rules under section titles
- A printed-journal rhythm: 1.25px section rules, 1.75px masthead rule
- Warm grey typography rather than blue
- Single column, ATS-friendly

The serif is **display only**. A full-serif body was the first attempt and was
rejected on measurement: Charter is a narrow face, so 11px of it fits ~137
characters per line against the ~112 the geometry allows. Holding the body in
the sans keeps the measure in range and spends the serif on the roles a reader
identifies the publication by.

## 10.5 Executive

Characteristics:

- Largest name of any template
- Most prominent professional title
- The loosest section gap (19px) and a single heavy rule closing the masthead
- Senior-facing, calm and uncluttered
- Single column, ATS-friendly

Its leading and entry margins are deliberately **not** the loosest available.
1.55 leading with 13px entry margins pushed the example resume 5px onto a
second page, and a user selecting this template should not open on a preview
that looks broken. The airiness is spent on the type scale and the section gap,
where it is visible, rather than on the leading, where it only shows up as an
overflow.

It carries no accent bar. Modern owns that device, and reusing it would make
the two indistinguishable at a glance — which §10's distinctness requirement
exists to prevent.

---

All templates must remain single-column and use real selectable text. Two
templates must never render an identical document.

### Shipped type scale

Recorded so a sixth template has a reference rather than a guess. Every value
is asserted per template by `scripts/design-qa.mjs`:

| Role | Classic | Modern | Minimal | Editorial | Executive |
| --- | --- | --- | --- | --- | --- |
| Name | 27px | 28px | 24px | 27px | 28px |
| Professional title | 12px | 12.5px | 12px | 12px | 13.5px |
| Section title | 13.5px | 14px | 13px | 12.5px | 13px |
| Job title | 11.5px | 12px | 11px | 11.5px | 11.5px |
| Body | 11px | 11px | 10.5px | 11px | 11px |
| Metadata / links | 9.5px | 9.5px | 9px | 9.5px | 9.5px |
| Section tracking | 0.095em | 0.095em | none | 0.09em | 0.085em |
| Section heading case | upper | upper | sentence | upper | upper |
| Display face | sans | sans | sans | **serif** | sans |

Templates differ in **rhythm** as much as in size — that is what makes them
read as different documents rather than five colour schemes. Classic rests on a
17px section gap with ruled headings, Modern adds a 2.5px accent bar and an
18px gap, Minimal drops to 14px with sentence-case headings and an en-dash
entry marker, Editorial uses 1.25px rules over a 16px gap, and Executive takes
a 19px gap with a 2.5px letterhead rule.

---

# 11. Template Switcher

The header should contain:

```text
Template: [ Classic ▼ ]
```

When the user changes the template:

```text
Markdown
   ↓
Same content
   ↓
Different template
```

The Markdown itself must never be modified.

---

# 12. Page Mode / One-Page Option

Resumark must provide a dedicated option allowing the user to request a **one-page resume**.

This is an important product feature.

## UI

Add a control near the template selector:

```text
Page Mode: [ Normal ▼ ]
```

Options:

```text
Normal
One Page
```

Alternatively, this can be implemented as a checkbox:

```text
☐ Fit to one page
```

The preferred UI is a clear toggle/checkbox:

```text
☐ One Page
```

---

# 13. One-Page Mode Behavior

When **One Page** is enabled:

```text
☑ One Page
```

Resumark should attempt to fit the entire resume onto **one A4 page**.

The goal is:

```text
All resume content
        ↓
One A4 page
```

The implementation should dynamically optimize the layout rather than simply cutting off content.

Possible adjustments include:

- reducing vertical spacing
- reducing margins
- reducing heading spacing
- reducing paragraph spacing
- reducing list spacing
- slightly reducing typography sizes
- reducing gaps between sections

### Important

The application must preserve readability.

It should **not** shrink the resume to an unusably tiny font.

---

# 14. One-Page Mode Priority

When fitting the resume into one page, optimize in this order:

```text
1. Reduce excessive whitespace
        ↓
2. Reduce section spacing
        ↓
3. Reduce list spacing
        ↓
4. Reduce paragraph spacing
        ↓
5. Reduce heading spacing
        ↓
6. Reduce page margins
        ↓
7. Slightly reduce typography
```

Avoid aggressive scaling as the first solution.

---

# 15. One-Page Mode Warning

If the content is too large to fit into one page while remaining reasonably readable, Resumark should clearly indicate this.

Example:

```text
⚠ This resume may be too long to fit comfortably on one page.
Consider shortening the content.
```

The application should not silently create an unreadably small resume.

The user remains in control.

---

# 16. One-Page Preview

When One Page mode is active, the preview should visually indicate that the goal is one page.

For example:

```text
┌──────────────────────────┐
│                          │
│       RESUME             │
│                          │
│       Content            │
│       Content            │
│       Content            │
│                          │
│                          │
└──────────────────────────┘

          1 page
```

If content overflows, the UI should communicate that clearly.

Example:

```text
⚠ Content exceeds one page
```

---

# 17. Normal Page Mode

When One Page mode is disabled:

```text
☐ One Page
```

The resume should naturally flow across multiple A4 pages.

For example:

```text
Page 1
────────────
Content
Content
Content

Page 2
────────────
Content
Content
```

This mode should prioritize natural readability over fitting everything onto one page.

---

# 18. Multi-Page Resumes

Resumark must support resumes longer than one page when One Page mode is disabled.

A resume should naturally flow:

```text
Page 1
────────────────
Resume content
Resume content
Resume content

Page 2
────────────────
Remaining content
Remaining content
```

Do not artificially shrink the entire resume when the user has selected Normal mode.

---

# 19. Page Break Handling

Avoid unnecessary breaks between related content.

Use CSS such as:

```css
.resume-section {
  break-inside: avoid;
}

h2 {
  break-after: avoid;
}

h3 {
  break-after: avoid;
}
```

The implementation should try to keep:

```text
Section heading
+
First content
```

together.

Likewise, job titles should not be separated unnecessarily from their bullet points.

---

# 20. Application Layout

## Desktop

```text
┌──────────────────────────────────────────────────────────────┐
│ Resumark  [Template ▼]  [☐ One Page]  [☑ Autosave]  [Export PDF]  │
├─────────────────────────┬────────────────────────────────────┤
│                         │                                    │
│     Markdown Editor     │          A4 Preview                │
│                         │                                    │
│ # Amine Mabrouk         │       ┌────────────────┐           │
│                         │       │                │           │
│ ## Experience           │       │    RESUME      │           │
│                         │       │                │           │
│ - Developer             │       │                │           │
│                         │       └────────────────┘           │
│                         │                                    │
└─────────────────────────┴────────────────────────────────────┘
```

---

# 21. Header

The header contains, in this order:

### Left

```text
Resumark
```

### Center/right

```text
[ Template ▼ ]
```

```text
☐ One Page
```

```text
☑ Autosave
```

```text
Saved 10:20
```

### Right

```text
[ Reset ]
```

```text
[ Export PDF ]
```

The save indicator reports the last successful write, and switches to a
distinct `warn` tone reading `Autosave off` when the switch is off. The warn
tone is not decorative: "not saved" is the one status a user must never miss,
so it is the one status that is never hidden by the responsive rules.

---

# 22. PDF Export

PDF generation must use the browser's native print functionality.

Use:

```tsx
const handleExportPDF = () => {
  window.print();
};
```

Do **not** use:

```text
html2canvas
jspdf
canvas screenshots
image-based PDF generation
```

### Reason

Native browser printing provides:

- crisp text
- selectable text
- searchable text
- vector output
- clickable links
- proper A4 printing support

---

# 23. Print CSS

Implement:

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 15mm;
  }

  body {
    background: white !important;
    color: black !important;
  }

  .no-print {
    display: none !important;
  }

  .resume-page {
    box-shadow: none !important;
    margin: 0 !important;
  }
}
```

The following must be hidden when printing:

- Markdown editor
- Header
- Template selector
- One Page control
- Export button
- Application background
- Other UI elements

Only the resume should appear in the PDF.

---

# 24. Print Behavior — Normal Mode

When One Page mode is disabled:

```text
Normal mode
     ↓
Natural A4 pagination
     ↓
Page 1
Page 2
Page 3...
```

The browser should determine page breaks naturally while respecting the application's break rules.

---

# 25. Print Behavior — One Page Mode

When One Page mode is enabled:

```text
One Page mode
      ↓
Apply compact layout
      ↓
A4
      ↓
All content should fit within one page
```

The print stylesheet must apply the one-page layout.

The exported PDF should contain **one page** whenever the content can reasonably fit.

If the content is too large even after reasonable compaction, the application should warn the user rather than silently destroying readability.

---

# 26. A4 Preview Component

The preview should follow this general structure:

```tsx
<div
  className="
    resume-page
    w-[210mm]
    min-h-[297mm]
    bg-white
    mx-auto
    shadow-lg
    print:shadow-none
    print:mx-0
  "
>
  <ResumeTemplate />
</div>
```

The exact implementation can be adjusted to ensure correct browser printing.

---

# 27. Local Persistence

Resumark must save the current resume in `localStorage`.

Example:

```text
localStorage
    ↓
resumeMarkdown
```

When the application starts:

```text
localStorage exists
       ↓
Load saved resume
```

If no saved resume exists:

```text
Load default example resume
```

No backend is required for the MVP.

---

# 27a. Autosave Switch

> **Amends §27.** §27 states that Resumark "must save the current resume in
> `localStorage`". This section makes that saving **switchable by the user**. It
> is a deliberate departure from a hard requirement, not an oversight, and the
> product consequence is stated here so it is not discovered at runtime.

Add a control next to the One Page toggle:

```text
☑ Autosave
```

## Behavior when Autosave is OFF

```text
Autosave off
    ↓
No write to the resume key
    ↓
Reload or close the tab
    ↓
Session is discarded
```

Specifically:

- Nothing is written to the resume storage key, by any path.
- `Ctrl/Cmd + S` is a no-op while Autosave is off, so the stored copy always
  matches what the switch promises.
- A **previously saved resume is not deleted.** Turning the switch off stops
  future writes; it never destroys what is already stored.
- The switch's own state **is** persisted, under a separate key. A control that
  silently reverted to "on" after a reload would quietly re-save the very
  content the user asked not to save.
- The UI must state the consequence in visible text, not only in a tooltip: a
  `title` attribute is invisible to keyboard users, to touch users, and to
  anyone who simply looks away.

## Behavior when Autosave is ON

This is the §27 behavior, unchanged: the resume is written to `localStorage`
debounced while typing.

---

# 28. Persist Page Settings

The following settings should also be persisted:

```ts
type ResumeState = {
  markdown: string;
  template: ResumeTemplate;
  onePage: boolean;
};
```

They are stored under `resumark:resume:v1`, alongside the Markdown itself.

Therefore, if the user enables:

```text
☑ One Page
```

and reloads the application, the setting should remain enabled.

The Autosave switch (§27a) is persisted **separately**, under
`resumark:prefs:v1`, and survives a reload in both states. The keys are
deliberately distinct: had the preference shared the resume key, toggling it
would have had to rewrite the resume record to record the choice, which is the
one thing §27a forbids while the switch is off.

---

# 29. Reset Resume

Provide:

```text
[ Reset ]
```

When clicked:

```text
Confirm
   ↓
Delete saved resume
   ↓
Restore default Markdown
   ↓
Restore default template
   ↓
Restore default page mode
```

The user should not accidentally lose their resume without confirmation.

---

# 30. Responsive Design

## Desktop

Use:

```text
Editor | Preview
```

---

## Tablet

Use:

```text
Editor
──────
Preview
```

---

## Mobile

Use tabs:

```text
[ Editor ] [ Preview ]
```

Only one panel needs to be visible at a time.

The application must not create unwanted horizontal page scrolling.

---

# 31. Tech Stack

## Framework

Preferred:

```text
Next.js
App Router
TypeScript
```

Alternative:

```text
Vite
React
TypeScript
```

---

## Styling

```text
Tailwind CSS
```

Use:

- responsive utilities
- `print:` modifiers
- custom print CSS
- `@page`

---

## Editor

```text
@monaco-editor/react
```

---

## Markdown

```text
react-markdown
remark-gfm
```

---

## State

Use React state.

Avoid unnecessary state-management libraries.

Do not introduce Redux or Zustand for the MVP.

---

## Persistence

```text
localStorage
```

---

## PDF

```text
window.print()
```

No PDF library is required.

---

# 32. Architecture

```text
src/
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   │
│   ├── editor/
│   │   └── MarkdownEditor.tsx
│   │
│   ├── preview/
│   │   ├── ResumePreview.tsx
│   │   └── MarkdownRenderer.tsx
│   │
│   ├── templates/
│   │   ├── ClassicTemplate.tsx
│   │   ├── ModernTemplate.tsx
│   │   ├── MinimalTemplate.tsx
│   │   ├── EditorialTemplate.tsx
│   │   └── ExecutiveTemplate.tsx
│   │
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Workspace.tsx
│   │
│   └── ui/
│       ├── TemplateSwitcher.tsx
│       ├── OnePageToggle.tsx
│       ├── AutosaveToggle.tsx
│       └── ExportButton.tsx
│
├── lib/
│   ├── storage.ts
│   ├── templates.ts
│   └── print.ts
│
└── types/
    └── resume.ts
```

---

# 33. Data Model

Markdown is the source of truth.

```ts
type ResumeState = {
  markdown: string;
  template: ResumeTemplate;
  onePage: boolean;
};

type ResumeTemplate =
  | "classic"
  | "modern"
  | "minimal"
  | "editorial"
  | "executive";
```

Do not convert the Markdown into a complex JSON resume structure for the MVP.

---

# 34. Performance

Resumark should feel instantaneous.

The primary update pipeline is:

```text
User types
    ↓
React state
    ↓
Markdown parser
    ↓
Resume renderer
```

Requirements:

- No API calls for core functionality
- No backend
- No database
- No authentication
- No server-side PDF generation
- No unnecessary re-renders

The preview should update with minimal perceptible delay.

If Markdown rendering becomes expensive, introduce lightweight debouncing.

---

# 35. Accessibility

The application must provide:

- keyboard-accessible buttons
- visible focus states
- semantic HTML
- accessible labels
- sufficient contrast
- keyboard-accessible template selector
- accessible One Page toggle
- accessible Export button

Optional keyboard shortcut:

```text
Ctrl/Cmd + S
```

This may trigger a local save instead of the browser's default Save dialog.

---

# 36. Error Handling

Invalid Markdown must never crash the application.

If Markdown contains unexpected syntax:

```text
Editor remains usable
        +
Preview renders what it can
```

If `localStorage` is unavailable:

```text
Continue using in-memory state
```

If printing is unavailable:

```text
Display a user-friendly message
```

Never expose raw application errors to the user.

---

# 37. Default Resume

Resumark should include an example Markdown resume.

It should demonstrate:

- Name
- Contact information
- Professional title
- Summary
- Experience
- Education
- Skills
- Projects
- Languages
- Links
- Bullet points
- Dates

Example:

```markdown
# Amine Mabrouk

Full Stack Developer

[Email](mailto:amine@example.com) ·
[LinkedIn](https://linkedin.com) ·
[GitHub](https://github.com)

## Summary

Full Stack Developer specialized in modern web applications
using TypeScript, Angular, Laravel and cloud technologies.

## Experience

### Full Stack Developer — Infraway

Jul 2025 — Present

- Developed Angular applications.
- Built Laravel REST APIs.
- Integrated S3-compatible object storage.
- Improved application performance and reliability.

## Skills

- TypeScript
- Angular
- Laravel
- PHP
- Docker
- Git

## Education

### Software Engineering

University Name
```

---

# 38. MVP Features

Everything in this section shipped. The split below is the order the work
actually landed in, not a wishlist.

## Must Have

- Markdown editor
- Monaco editor
- Live preview
- A4 preview
- Template architecture
- Five distinct templates
- Autosave switch
- Native PDF export
- Print CSS
- localStorage persistence
- Multi-page support
- GFM Markdown
- Responsive layout
- **One Page mode**
- **One Page print styling**
- **One Page overflow warning**
- **Persist One Page setting**

## Should Have

- Modern template — shipped
- Minimal template — shipped
- Reset button, behind a confirmation dialog — shipped
- Mobile editor/preview tabs — shipped
- Page-break optimization (`break-inside: avoid` on headings and entries, not
  on whole sections) — shipped
- Better one-page density optimization: a density ladder rather than a single
  compaction pass — shipped

## Future

- Import `.md`
- Export `.md`
- Import `.docx`
- Import existing PDF
- ATS score
- Job-description matching
- AI resume optimization
- Multiple saved resumes
- Cloud synchronization
- Custom fonts
- Custom colors
- Custom spacing
- Resume version management

---

# 39. Non-Goals

The MVP must **not** include:

- Authentication
- Backend
- Database
- Payments
- AI generation
- Third-party PDF APIs
- Canvas PDF generation
- Screenshot-based PDF generation
- Drag-and-drop resume editing
- Complex resume form builders

The core product remains:

```text
Markdown
   ↓
Professional Resume
   ↓
Optional One-Page Optimization
   ↓
Native A4 PDF
```

---

# 40. Acceptance Criteria

## AC-01 — Markdown Editor

**Given** the user opens Resumark
**When** they edit Markdown
**Then** the editor works like a normal code editor and the preview updates.

---

## AC-02 — Live Preview

**Given** valid Markdown
**When** it is rendered
**Then** it appears inside a professional A4 page.

---

## AC-03 — Template Switching

**Given** the user selects another template
**When** the template changes
**Then** the same Markdown content is rendered using the selected template.

---

## AC-04 — One Page Toggle

**Given** the user enables `One Page`
**When** the preview updates
**Then** the selected template switches to its compact one-page layout.

---

## AC-05 — One Page Output

**Given** the resume can reasonably fit on one page
**When** `One Page` is enabled and the user exports it
**Then** the resulting PDF contains exactly one A4 page.

---

## AC-06 — One Page Overflow

**Given** the resume is too large to fit on one page without unreasonable typography reduction
**When** `One Page` is enabled
**Then** Resumark displays a warning explaining that the content is too long and should be shortened.

It must not silently produce an unreadably tiny resume.

---

## AC-07 — Normal Page Mode

**Given** One Page mode is disabled
**When** the resume exceeds one page
**Then** the content naturally flows across multiple A4 pages.

---

## AC-08 — PDF Export

**Given** the resume is visible
**When** the user clicks `Export PDF`
**Then** `window.print()` opens the native browser print dialog.

---

## AC-09 — PDF Output

The generated PDF must:

- use A4 format
- contain only the resume
- hide the editor
- hide the application header
- hide template controls
- hide the One Page control
- remove shadows
- preserve selectable text
- preserve searchable text
- preserve links
- use professional margins

---

## AC-10 — Persistence

**Given** the user edits their resume
**When** they reload Resumark
**Then** their Markdown, selected template, and One Page setting are restored.

---

## AC-10a — Autosave Switch

**Given** Autosave is off
**When** the user edits the Markdown
**Then** nothing is written to the resume storage key, and a visible warning states that reloading will discard the changes.

**Given** a resume was saved before Autosave was switched off
**When** the user turns Autosave off
**Then** the previously saved resume is still stored, and the Autosave setting itself survives a reload.

---

## AC-11 — Multi-page

**Given** the resume exceeds one A4 page and Normal mode is selected
**When** exported
**Then** the content continues naturally onto additional pages without being clipped.

---

## AC-12 — Responsive

**Given** the user opens Resumark on a mobile device
**When** the viewport becomes narrow
**Then** the application remains usable without unwanted horizontal scrolling.

---

## AC-13 — No Canvas PDF

The implementation must not use:

```text
html2canvas
jspdf
canvas screenshots
image-based PDF generation
```

The PDF must be produced through native browser printing.

---

# 41. Definition of Done

Resumark is ready for MVP release when:

```text
✓ User can write Markdown
✓ Monaco editor works
✓ Markdown renders correctly
✓ Preview updates live
✓ Preview is A4
✓ All five templates are distinct from one another
✓ Template switching never alters the Markdown
✓ localStorage persistence works
✓ Autosave switch works, and off means off
✓ Reset works, behind a confirmation
✓ Export PDF uses window.print()
✓ Print CSS works
✓ Editor disappears during printing
✓ Header disappears during printing
✓ Text remains selectable
✓ Links remain clickable
✓ Every section heading survives PDF extraction as a word
✓ Multi-page resumes print in full, with nothing clipped
✓ Normal mode works
✓ One Page mode works
✓ One Page setting persists
✓ One Page print output is A4
✓ One Page overflow is detected and warned, never cropped
✓ One Page mode prioritizes readability over fitting
✓ Mobile layout works
✓ No backend is required
✓ TypeScript has no errors
✓ ESLint passes
✓ Unit tests pass
✓ Production build succeeds
```

The last four are gates on the code; the rest are gates on the *rendered
document*, verified in a real browser against a real exported PDF. A resume
generator is only as good as the file it produces, so the definition of done
cannot be satisfied by a passing type checker. See §43.

---

# 42. Success Metric

The main success criterion for **Resumark** is:

> **A user can paste an existing Markdown resume, choose a professional template, optionally enable One Page mode, preview it as an A4 document, and save it as a clean PDF in under 60 seconds.**

The core product experience should feel like:

```text
VS Code + Markdown
        +
Professional Resume Preview
        +
One-Page Optimization
        +
Browser Native Print
```

---

# 43. Running and Verification

## Running it

```bash
npm install
npm run dev      # http://localhost:3000  (override with PORT=…)
```

```bash
npm run verify   # typecheck, lint, 48 unit tests, production build
npm start        # serve the static export that was verified
```

## Verifying it

```bash
npm run verify:e2e
```

This is the command that backs §41. It builds the static export, serves it,
drives a real Chromium against it, prints to PDF with the browser's own print
engine, and then inspects the resulting file with `pdfinfo` and `pdftotext` —
the text layer an ATS would read, not a screenshot of what a human would see.

It currently runs **261 checks in 16 groups, plus a design QA pass**, all
green. `design-qa.mjs` is a gate, not a report: it exits non-zero on a
contrast or type-scale regression.

Requirements beyond npm: **poppler** (`pdfinfo`, `pdftotext`) and a
**Chromium** binary. `npm run verify` has no such requirement.

The full evidence, with every measured value and a label distinguishing an
*asserted* claim from a *reported* one, is in
[`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Why it is shaped this way

Three decisions are load-bearing, and each was made after the obvious
alternative failed a check:

**The template lists are read from the shipped `<select>` at run time.** A
hardcoded array is a list someone has to remember to update. The original
harness listed three templates, so when a fourth and fifth were added the
coverage quietly did not extend to them. That is how the letter-spacing
defect in §9 survived: the checks that would have caught it only ever ran
against the two templates that did not have the problem.

**Every check runs against a real artifact.** A synthetic probe of
letter-spacing values in isolation reported all of them clean, while the
actual export split at 0.115em. Measuring the real file is the only version of
that check that means anything.

**A claim is not a gate unless a check asserts it.** A number printed in a
report is not enforced by anything, and treating it as a guarantee is how a
table ends up claiming a font size the stylesheet no longer uses — which is
exactly what happened to Minimal's One Page floor, when a hardcoded table kept
reporting a 10px base after the stylesheet said 10.5px. Every figure in
`docs/VERIFICATION.md` is labelled *asserted*, *reported* or *code fact* for
this reason.
