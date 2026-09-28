"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEFAULT_PREFS,
  DEFAULT_STATE,
  clearState,
  loadPrefs,
  loadState,
  savePrefs,
  saveState,
  type AppPrefs,
} from "@/lib/storage";
import type { ResumeState, ResumeTemplate } from "@/types/resume";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";

export type SaveStatus = {
  /** null until the first successful write. */
  savedAt: number | null;
  saving: boolean;
  /** False when localStorage cannot be used (PRD §36). */
  persistent: boolean;
};

const SAVE_DEBOUNCE_MS = 300;
/**
 * Upper bound on how long an edit can stay unsaved. The debounce alone would
 * never fire during a long uninterrupted typing session, which is exactly when
 * losing the last edits would hurt most.
 */
const SAVE_MAX_WAIT_MS = 2_000;

/**
 * Resume state + localStorage persistence (PRD §27 – §29).
 * Plain React state: no store, no backend, no Redux/Zustand.
 */
export function useResumeState() {
  const [state, setState] = useState<ResumeState>(DEFAULT_STATE);
  const [prefs, setPrefs] = useState<AppPrefs>(DEFAULT_PREFS);
  const [status, setStatus] = useState<SaveStatus>({
    savedAt: null,
    saving: false,
    persistent: true,
  });

  const skipNextSave = useRef(false);
  const firstEditAt = useRef(0);

  // Read persisted state before the first paint (avoids a flash of the
  // default resume and any hydration mismatch on a static export).
  useIsomorphicLayoutEffect(() => {
    const { state: stored, persistent } = loadState();
    const storedPrefs = loadPrefs();
    setState(stored);
    setPrefs(storedPrefs);
    setStatus((previous) => ({
      ...previous,
      persistent,
    }));
  }, []);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    /*
     * Autosave off (PRD §27a): write nothing, and do not let a write that was
     * already in flight land. The cleanup below has already cancelled the
     * pending timer by the time this runs, so turning the switch off genuinely
     * stops persistence rather than merely hiding it.
     */
    if (!prefs.autosave) {
      setStatus((previous) =>
        previous.saving ? { ...previous, saving: false } : previous,
      );
      return;
    }

    setStatus((previous) => ({ ...previous, saving: true }));
    firstEditAt.current = firstEditAt.current === 0 ? Date.now() : firstEditAt.current;
    const wait = Math.max(0, firstEditAt.current + SAVE_MAX_WAIT_MS - Date.now());
    const timer = window.setTimeout(
      () => {
        firstEditAt.current = 0;
        const ok = saveState(state);
        setStatus((previous) => ({
          savedAt: ok ? Date.now() : previous.savedAt,
          saving: false,
          /*
           * Latched: once a write has succeeded, storage demonstrably works, so
           * a later failure is a transient quota or serialisation error and not
           * evidence that the resume is unsaveable. Flipping to the error state
           * on the first hiccup would train the user to ignore the one warning
           * that means they are about to lose their work.
           */
          persistent: previous.persistent || ok,
        }));
      },
      Math.min(SAVE_DEBOUNCE_MS, wait),
    );
    return () => window.clearTimeout(timer);
  }, [state, prefs.autosave]);

  /*
   * Ctrl/Cmd + S is a manual save, and a manual save that silently did nothing
   * would be worse than one that was never offered: the key is the obvious
   * escape route for anyone who has just realised their work is unprotected, and
   * honouring it would contradict the switch that is visibly telling them
   * nothing is being written. So while autosave is off this is a no-op, and the
   * status line says as much rather than reporting a save that did not happen.
   */
  const saveNow = useCallback(() => {
    firstEditAt.current = 0;
    if (!prefs.autosave) return false;
    const ok = saveState(state);
    setStatus((previous) => ({
      savedAt: ok ? Date.now() : previous.savedAt,
      saving: false,
      persistent: previous.persistent || ok,
    }));
    return ok;
  }, [state, prefs.autosave]);

  const setMarkdown = useCallback((markdown: string) => {
    setState((previous) => ({ ...previous, markdown }));
  }, []);

  const setTemplate = useCallback((template: ResumeTemplate) => {
    setState((previous) => ({ ...previous, template }));
  }, []);

  const setOnePage = useCallback((onePage: boolean) => {
    setState((previous) => ({ ...previous, onePage }));
  }, []);

  /** PRD §27a. The preference is persisted even while autosave is off. */
  const setAutosave = useCallback((autosave: boolean) => {
    setPrefs({ autosave });
    savePrefs({ autosave });
  }, []);

  /** PRD §29: confirm → delete saved resume → restore every default. */
  const reset = useCallback(() => {
    skipNextSave.current = true;
    firstEditAt.current = 0;
    clearState();
    setState(DEFAULT_STATE);
    setStatus((previous) => ({ ...previous, savedAt: null, saving: false }));
  }, []);

  return {
    state,
    setMarkdown,
    setTemplate,
    setOnePage,
    autosave: prefs.autosave,
    setAutosave,
    reset,
    saveNow,
    status,
  };
}
