"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Header } from "@/components/layout/Header";
import { Workspace } from "@/components/layout/Workspace";
import { useOnePageFit } from "@/hooks/useOnePageFit";
import { useResumeState } from "@/hooks/useResumeState";
import { buildOutline } from "@/lib/markdown/resumeOutline";

/**
 * Resumark application shell.
 *
 * Owns the only state of the product: the Markdown, the selected template and
 * the page mode. Everything else is derived, which keeps the update pipeline of
 * PRD §34 free of caching layers: keystroke → state → outline → preview.
 */
export function ResumeWorkbench() {
  const {
    state,
    setMarkdown,
    setTemplate,
    setOnePage,
    autosave,
    setAutosave,
    reset,
    saveNow,
    status,
  } = useResumeState();
  const [exportError, setExportError] = useState<string | null>(null);
  const [documentElement, setDocumentElement] = useState<HTMLElement | null>(
    null,
  );

  // Derived synchronously from the state, on purpose. Deferring the preview
  // would push the restore-from-localStorage swap into a second, low-priority
  // paint — a visible flash of the example resume on every reload. The editor
  // is Monaco, so keystrokes never block on React anyway; the preview only has
  // to re-render, and `buildOutline` is a single linear pass over the source.
  const outline = useMemo(() => buildOutline(state.markdown), [state.markdown]);

  const fit = useOnePageFit({ element: documentElement, enabled: state.onePage });

  // PRD §35: Ctrl/Cmd + S saves locally instead of opening the browser dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

  const onDocumentRef = useCallback((element: HTMLElement | null) => {
    setDocumentElement((previous) => (previous === element ? previous : element));
  }, []);

  return (
    <div className="app-shell">
      {/*
       * First in the DOM, therefore the first tab stop. The header holds four
       * focusable controls and the preview pane several more before the editor,
       * so a skip link rendered after the header is not a skip link — it saves
       * three presses and announces itself after the user has already tabbed
       * past the thing it was supposed to bypass (WCAG 2.4.1 Bypass Blocks).
       */}
      <a className="skip-link" href="#markdown-source">
        Skip to the Markdown editor
      </a>
      <Header
        state={state}
        status={status}
        autosave={autosave}
        exportError={exportError}
        onTemplateChange={setTemplate}
        onOnePageChange={setOnePage}
        onAutosaveChange={setAutosave}
        onExport={setExportError}
        onReset={reset}
      />
      <main className="app-main">
        <Workspace
          markdown={state.markdown}
          onMarkdownChange={setMarkdown}
          template={state.template}
          onePage={state.onePage}
          outline={outline}
          fit={fit}
          onDocumentRef={onDocumentRef}
        />
      </main>
    </div>
  );
}
