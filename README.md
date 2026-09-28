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

---

# 1. Product Overview

### Product Name

**Resumark**

### Product Type

Markdown-based resume editor with live A4 preview, professional templates, ATS-friendly formatting, and native PDF export.

### Product Goal

Resumark allows users to create professional resumes using Markdown.

The core workflow is:

> **Write Markdown → Preview resume → Choose template → Optionally force one-page layout → Export A4 PDF**

The product should be **fast, simple, professional, ATS-friendly, and developer-oriented**.

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

| Element       | Style        |
| ------------- | ------------ |
| Name          | 24–28px bold |
| Job title     | 12–14px      |
| Section title | 11–14px bold |
| Job title     | 11–12px bold |
| Body          | 9–11px       |
| Metadata      | 9–10px       |
| Links         | 9–10px       |

Avoid excessive:

- colors
- icons
- graphics
- decorative backgrounds
- complex layouts

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
- Wide letter spacing on section titles
- Heavier rules under section titles
- Warm grey typography rather than blue
- Single column, ATS-friendly

---

## 10.5 Executive

Characteristics:

- Largest name of any template
- Most prominent professional title
- Widest letter spacing on section titles
- Single heavy rule closing the masthead
- Senior-facing, calm and uncluttered
- Single column, ATS-friendly

---

All templates must remain single-column and use real selectable text. Two
templates must never render an identical document.

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

The header should contain:

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

### Right

```text
[ Export PDF ]
```

Optional:

```text
[ Reset ]
```

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

Therefore, if the user enables:

```text
☑ One Page
```

and reloads the application, the setting should remain enabled.

The Autosave switch (§27a) is persisted separately and survives a reload in
both states.

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

## Must Have

- Markdown editor
- Monaco editor
- Live preview
- A4 preview
- Classic template
- Template architecture
- Five templates
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

- Modern template
- Minimal template
- Reset button
- Mobile editor/preview tabs
- Page-break optimization
- Better one-page density optimization

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
✓ Classic template works
✓ All five templates are distinct
✓ Template switching works
✓ localStorage persistence works
✓ Autosave switch works
✓ Reset works
✓ Export PDF uses window.print()
✓ Print CSS works
✓ Editor disappears during printing
✓ Header disappears during printing
✓ Text remains selectable
✓ Links remain clickable
✓ Multi-page resumes work
✓ Normal mode works
✓ One Page mode works
✓ One Page setting persists
✓ One Page print output is A4
✓ One Page overflow is detected/warned
✓ One Page mode prioritizes readability
✓ Mobile layout works
✓ No backend is required
✓ TypeScript has no errors
✓ ESLint passes
✓ Production build succeeds
```

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
