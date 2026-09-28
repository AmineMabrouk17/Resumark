import { DEFAULT_MARKDOWN } from "@/lib/defaultResume";
import {
  DEFAULT_TEMPLATE,
  isResumeTemplate,
  type ResumeState,
} from "@/types/resume";

/**
 * localStorage persistence (PRD §27 / §28).
 *
 * Every access is defensive: private browsing, disabled storage, quota errors
 * and corrupted payloads degrade to in-memory state instead of breaking the app
 * (PRD §36).
 *
 * Two keys, deliberately. `STORAGE_KEY` holds the resume and is written *only*
 * while autosave is on (PRD §27a). `PREFS_KEY` holds the autosave switch itself
 * and is always written: a control that silently reverted to "on" after a
 * reload would quietly re-save the very content the user had asked not to save,
 * which is the one outcome worse than losing the edits.
 */

export const STORAGE_KEY = "resumark:resume:v1";
export const PREFS_KEY = "resumark:prefs:v1";

export const DEFAULT_STATE: ResumeState = {
  markdown: DEFAULT_MARKDOWN,
  template: DEFAULT_TEMPLATE,
  onePage: false,
};

/** Pure parser — unit tested, never touches the DOM. */
export function parseStoredState(raw: string | null): ResumeState | null {
  if (!raw) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;
  const candidate = payload as Partial<Record<keyof ResumeState, unknown>>;

  const markdown =
    typeof candidate.markdown === "string" ? candidate.markdown : null;
  if (markdown === null) return null;

  return {
    markdown,
    template: isResumeTemplate(candidate.template)
      ? candidate.template
      : DEFAULT_TEMPLATE,
    onePage: candidate.onePage === true,
  };
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    // Touching the object is enough to trigger security errors in some browsers.
    const probe = `${STORAGE_KEY}:probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export type LoadResult = {
  state: ResumeState;
  /** True when a previously saved resume was found and restored. */
  restored: boolean;
  /** False when localStorage is unusable — the app keeps working in memory. */
  persistent: boolean;
};

export function loadState(): LoadResult {
  const storage = getStorage();
  if (!storage) {
    return { state: DEFAULT_STATE, restored: false, persistent: false };
  }

  try {
    const parsed = parseStoredState(storage.getItem(STORAGE_KEY));
    if (parsed) return { state: parsed, restored: true, persistent: true };
    return { state: DEFAULT_STATE, restored: false, persistent: true };
  } catch {
    return { state: DEFAULT_STATE, restored: false, persistent: false };
  }
}

/** Returns false when the write could not be performed. */
export function saveState(state: ResumeState): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------
 * Autosave preference (PRD §27a)
 * ---------------------------------------------------------------------- */

export type AppPrefs = {
  /** False disables every write to `STORAGE_KEY` — see the note above. */
  autosave: boolean;
};

export const DEFAULT_PREFS: AppPrefs = { autosave: true };

/** Pure parser — unit tested, never touches the DOM. */
export function parseStoredPrefs(raw: string | null): AppPrefs {
  if (!raw) return DEFAULT_PREFS;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return DEFAULT_PREFS;
  }

  if (typeof payload !== "object" || payload === null) return DEFAULT_PREFS;
  const candidate = payload as Partial<Record<keyof AppPrefs, unknown>>;
  /*
   * Only a real boolean switches autosave off. `candidate.autosave === true`
   * would treat a missing key, a hand-edited `"false"` string and a stale
   * payload alike as "off" — and the failure mode of guessing wrong here is the
   * user losing their resume. Anything unrecognised falls back to on.
   */
  return {
    autosave:
      typeof candidate.autosave === "boolean"
        ? candidate.autosave
        : DEFAULT_PREFS.autosave,
  };
}

export function loadPrefs(): AppPrefs {
  const storage = getStorage();
  if (!storage) return DEFAULT_PREFS;
  try {
    return parseStoredPrefs(storage.getItem(PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: AppPrefs): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}
