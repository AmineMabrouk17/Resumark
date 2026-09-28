"use client";

import dynamic from "next/dynamic";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";

import type { FitStatus } from "@/hooks/useOnePageFit";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ResumeOutline } from "@/lib/markdown/resumeOutline";
import { ResumePreview } from "@/components/preview/ResumePreview";
import type { ResumeTemplate } from "@/types/resume";

const MarkdownEditor = dynamic(
  () =>
    import("@/components/editor/MarkdownEditor").then(
      (module) => module.MarkdownEditor,
    ),
  {
    ssr: false,
    loading: () => <div className="editor-skeleton">Loading editor…</div>,
  },
);

type View = "editor" | "preview";

/** Must match the tab breakpoint in `globals.css`. */
const MOBILE_TABS = "(max-width: 767.98px)";

/** Arrow-key order for the tablist. Left/Right only — it is a horizontal list. */
const VIEW_ORDER: readonly View[] = ["editor", "preview"];

export type WorkspaceProps = {
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
  template: ResumeTemplate;
  onePage: boolean;
  outline: ResumeOutline;
  fit: FitStatus;
  onDocumentRef: (element: HTMLElement | null) => void;
};

/**
 * Editor | Preview layout (PRD §20, §30).
 *
 * Desktop: two columns. Tablet: editor above preview. Mobile: tabs with a
 * single visible pane. The panes are never unmounted — only hidden with
 * `visibility`, so the One Page measurement and the printed output never
 * depend on which tab is active.
 */
export function Workspace({
  markdown,
  onMarkdownChange,
  template,
  onePage,
  outline,
  fit,
  onDocumentRef,
}: WorkspaceProps) {
  const [view, setView] = useState<View>("editor");
  const baseId = useId();
  const isTabbed = useMediaQuery(MOBILE_TABS);
  const editorTabRef = useRef<HTMLButtonElement>(null);
  const previewTabRef = useRef<HTMLButtonElement>(null);

  const focusTab = useCallback((next: View) => {
    setView(next);
    (next === "editor" ? editorTabRef : previewTabRef).current?.focus();
  }, []);

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = (delta: number) => {
      const from = VIEW_ORDER.indexOf(view);
      const next = VIEW_ORDER[(from + delta + VIEW_ORDER.length) % VIEW_ORDER.length];
      if (next) focusTab(next);
    };
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab("editor");
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab("preview");
    }
  };

  return (
    <div className="workspace">
      {/*
        Only a real tablist where the panes really are tabs. Above the
        breakpoint both panes are visible at once, so `role="tabpanel"` would
        describe a layout that is not happening and point `aria-labelledby` at
        elements that are not rendered.
      */}
      {isTabbed ? (
        <div
          className="workspace__tabs no-print"
          role="tablist"
          aria-label="Editor and preview"
          onKeyDown={onTabKeyDown}
        >
          <button
            type="button"
            role="tab"
            id={`${baseId}-tab-editor`}
            className="workspace__tab"
            aria-selected={view === "editor"}
            aria-controls={`${baseId}-panel-editor`}
            tabIndex={view === "editor" ? 0 : -1}
            ref={editorTabRef}
            onClick={() => setView("editor")}
          >
            Editor
          </button>
          <button
            type="button"
            role="tab"
            id={`${baseId}-tab-preview`}
            className="workspace__tab"
            aria-selected={view === "preview"}
            aria-controls={`${baseId}-panel-preview`}
            tabIndex={view === "preview" ? 0 : -1}
            ref={previewTabRef}
            onClick={() => setView("preview")}
          >
            Preview
          </button>
        </div>
      ) : null}

      <div className="workspace__panes">
        <section
          className="workspace__pane workspace__pane--editor no-print"
          id={`${baseId}-panel-editor`}
          role={isTabbed ? "tabpanel" : "region"}
          aria-labelledby={isTabbed ? `${baseId}-tab-editor` : undefined}
          aria-label={isTabbed ? undefined : "Markdown editor"}
          data-hidden={view !== "editor"}
        >
          <div className="pane-bar pane-bar--editor" aria-hidden="true">
            <span>Markdown</span>
            <span className="pane-bar__hint">Autosaves as you type</span>
          </div>
          <div className="editor-host" id="markdown-source" tabIndex={-1}>
            <MarkdownEditor value={markdown} onChange={onMarkdownChange} />
          </div>
        </section>

        <section
          className="workspace__pane workspace__pane--preview preview-pane"
          id={`${baseId}-panel-preview`}
          role={isTabbed ? "tabpanel" : "region"}
          aria-labelledby={isTabbed ? `${baseId}-tab-preview` : undefined}
          aria-label={isTabbed ? undefined : "Resume preview"}
          /*
           * The preview stage is the app's only vertical scroller. A resume with
           * no links has nothing focusable inside it, so without this the sheet
           * would be unreachable by keyboard (2.1.1). Monaco's own textarea
           * needs no equivalent.
           */
          tabIndex={0}
          data-hidden={view !== "preview"}
        >
          <ResumePreview
            outline={outline}
            template={template}
            onePage={onePage}
            fit={fit}
            onDocumentRef={onDocumentRef}
          />
        </section>
      </div>
    </div>
  );
}
