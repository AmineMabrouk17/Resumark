import { describe, expect, it } from "vitest";

import {
  DEFAULT_STATE,
  PREFS_KEY,
  STORAGE_KEY,
  parseStoredPrefs,
  parseStoredState,
} from "@/lib/storage";
import { isResumeTemplate } from "@/types/resume";
import { documentTitleFromMarkdown } from "@/lib/print";

describe("parseStoredState", () => {
  it("restores markdown, template and page mode (PRD §28)", () => {
    const raw = JSON.stringify({
      markdown: "# Jane",
      template: "modern",
      onePage: true,
    });
    expect(parseStoredState(raw)).toEqual({
      markdown: "# Jane",
      template: "modern",
      onePage: true,
    });
  });

  it("falls back to the default template for unknown values", () => {
    const raw = JSON.stringify({ markdown: "# Jane", template: "neon" });
    expect(parseStoredState(raw)).toMatchObject({
      template: DEFAULT_STATE.template,
      onePage: false,
    });
  });

  it("rejects corrupted or non resume payloads", () => {
    expect(parseStoredState(null)).toBeNull();
    expect(parseStoredState("")).toBeNull();
    expect(parseStoredState("{oops")).toBeNull();
    expect(parseStoredState("[]")).toBeNull();
    expect(parseStoredState(JSON.stringify({ template: "classic" }))).toBeNull();
    expect(parseStoredState(JSON.stringify({ markdown: 42 }))).toBeNull();
  });

  it("uses a versioned, namespaced key", () => {
    expect(STORAGE_KEY).toMatch(/^resumark:resume:v\d+$/);
  });
});

describe("isResumeTemplate", () => {
  it("accepts only the five shipped templates", () => {
    expect(isResumeTemplate("classic")).toBe(true);
    expect(isResumeTemplate("modern")).toBe(true);
    expect(isResumeTemplate("minimal")).toBe(true);
    expect(isResumeTemplate("editorial")).toBe(true);
    expect(isResumeTemplate("executive")).toBe(true);
    expect(isResumeTemplate("fancy")).toBe(false);
    expect(isResumeTemplate(1)).toBe(false);
    expect(isResumeTemplate(null)).toBe(false);
  });
});

describe("parseStoredPrefs (PRD §27a)", () => {
  it("defaults to autosave on, and only a real boolean false turns it off", () => {
    expect(parseStoredPrefs(null)).toEqual({ autosave: true });
    expect(parseStoredPrefs("")).toEqual({ autosave: true });
    expect(parseStoredPrefs("{oops")).toEqual({ autosave: true });
    expect(parseStoredPrefs("[]")).toEqual({ autosave: true });
    expect(parseStoredPrefs(JSON.stringify({ autosave: false }))).toEqual({ autosave: false });
    expect(parseStoredPrefs(JSON.stringify({ autosave: true }))).toEqual({ autosave: true });
    /*
     * Fail toward persistence: a missing key, a hand-edited string or a stale
     * payload must not silently switch saving off, because that failure costs
     * the user their work rather than costing them a keystroke.
     */
    expect(parseStoredPrefs(JSON.stringify({ other: 1 }))).toEqual({ autosave: true });
    expect(parseStoredPrefs(JSON.stringify({ autosave: "no" }))).toEqual({ autosave: true });
    expect(parseStoredPrefs(JSON.stringify({ autosave: 0 }))).toEqual({ autosave: true });
  });

  it("keeps the resume key and the preference on separate keys", () => {
    // Writing the switch must never overwrite the saved resume, and vice versa.
    expect(PREFS_KEY).not.toBe(STORAGE_KEY);
    expect(PREFS_KEY).toMatch(/^resumark:prefs:v\d+$/);
  });
});

describe("documentTitleFromMarkdown", () => {
  it("uses the resume title for the suggested file name", () => {
    expect(documentTitleFromMarkdown("# Amine Mabrouk\n\nDev")).toBe(
      "Amine Mabrouk — Resume",
    );
    expect(documentTitleFromMarkdown("no heading here")).toBe("Resume");
  });
});
