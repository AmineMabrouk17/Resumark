"use client";

import Editor, { loader } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { editor } from "monaco-editor";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";

/**
 * Markdown editor (PRD §6).
 *
 * Monaco is bundled with the app (instead of being fetched from a CDN) so the
 * editor works offline and in locked-down networks. The heavy module is only
 * imported in the browser.
 *
 * The editor is deliberately **uncontrolled**. Driving Monaco from a `value`
 * prop makes the editor a controlled input: React's value lags one render behind
 * the model, so the wrapper sees `value !== model.getValue()` on every
 * keystroke and writes the stale text back into the model — which silently drops
 * characters when you type faster than React re-renders. Instead Monaco owns the
 * text, reports changes upwards, and external changes (Reset, restoring from
 * localStorage) are pushed in explicitly by {@link pushExternalValue}.
 */

/**
 * The editor's accessible name. Kept as a constant because three separate
 * things have to agree on it: the `ariaLabel` Monaco option, the skip link that
 * targets this editor, and the harness check that reads it back off the DOM.
 */
const EDITOR_LABEL = "Resume Markdown source";

export function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  /** Last text the editor emitted, or last text pushed into it. */
  const emittedRef = useRef(value);
  /** Set while pushing external text, so it is not reported as a user edit. */
  const applyingRef = useRef(false);
  const onChangeRef = useRef(onChange);

  useIsomorphicLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let cancelled = false;
    import("monaco-editor")
      .then((monaco) => {
        if (!cancelled) loader.config({ monaco });
      })
      .catch(() => {
        /* The editor keeps working through the CDN loader if bundling fails. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Restore / reset: replace the whole document, but never undo-stack noise. */
  useIsomorphicLayoutEffect(() => {
    const instance = editorRef.current;
    const model = instance?.getModel();
    if (!instance || !model) return; // the editor will be created with `value`
    if (value === emittedRef.current || model.getValue() === value) return;
    applyingRef.current = true;
    instance.executeEdits("", [
      { range: model.getFullModelRange(), text: value, forceMoveMarkers: true },
    ]);
    instance.pushUndoStop();
    applyingRef.current = false;
    emittedRef.current = value;
  }, [value]);

  const handleMount = useCallback((instance: editor.IStandaloneCodeEditor) => {
    editorRef.current = instance;
    emittedRef.current = instance.getValue();
  }, []);

  const handleChange = useCallback((next: string | undefined) => {
    if (applyingRef.current) return;
    const text = next ?? "";
    emittedRef.current = text;
    onChangeRef.current(text);
  }, []);

  /*
   * Read once per mount rather than subscribing: the options object is a prop
   * of `Editor`, and replacing it on every preference change would force Monaco
   * to reconfigure while the user is typing.
   */
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      ariaLabel: EDITOR_LABEL,
      /*
       * Monaco's own accessibility tree, switched on explicitly.
       *
       * `ariaLabel` above is *not* enough. Measured in the browser, it lands on
       * `div.native-edit-context` — a wrapper — while the element that actually
       * takes focus, `.monaco-editor textarea`, ends up with no `aria-label`,
       * no `aria-labelledby` and no `role`. A screen reader therefore announces
       * the editor as an unnamed edit field, which is the one control on the
       * page a keyboard user spends their whole time in.
       *
       * `accessibilitySupport: "on"` is the supported fix: it gives the text
       * area a real `role="textbox"`, the label, and a value the reader can
       * query. "auto" is not enough — it only opts in when assistive technology
       * is already detected, which is not something a page can be sure about.
       */
      accessibilitySupport: "on",
      automaticLayout: true,
      autoIndent: "full",
      bracketPairColorization: { enabled: false },
      /*
       * The `*` selector in `globals.css` cannot reach Monaco's own options, so
       * the two animations it does drive are read from the media query here.
       * Both are 300ms and under the 5s that would make them a 2.2.2 problem;
       * honouring the preference is still the right default.
       */
      cursorBlinking: reduceMotion ? "solid" : "smooth",
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      insertSpaces: true,
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      minimap: { enabled: false },
      padding: { top: 12, bottom: 16 },
      renderLineHighlight: "line",
      renderWhitespace: "selection",
      scrollBeyondLastLine: false,
      smoothScrolling: !reduceMotion,
      tabSize: 2,
      unicodeHighlight: { ambiguousCharacters: false },
      wordWrap: "on",
      wrappingIndent: "same",
    }),
    [reduceMotion],
  );

  return (
    <Editor
      height="100%"
      defaultLanguage="markdown"
      language="markdown"
      theme="vs-dark"
      defaultValue={value}
      onMount={handleMount}
      onChange={handleChange}
      options={options}
      loading={<div className="editor-skeleton">Loading editor…</div>}
    />
  );
}
