import { describe, expect, it } from "vitest";

import {
  DENSITY_LEVELS,
  FIT_AVAILABLE_PX,
  MAX_DENSITY_LEVEL,
  MIN_BODY_FONT_PX,
  PAGE_CONTENT_HEIGHT_PX,
  PAGE_CONTENT_WIDTH_PX,
  RELAX_TRIGGER_RATIO,
  decideFit,
  densityStyle,
  fillRatio,
  getDensityLevel,
  pageCountForBlocks,
  relaxLevel,
} from "@/lib/onePage";

describe("A4 geometry", () => {
  it("matches the A4 page with 12mm/15mm print margins", () => {
    // 210mm - 2 × 15mm = 180mm, 297mm - 2 × 12mm = 273mm at 96dpi.
    expect(PAGE_CONTENT_WIDTH_PX).toBeCloseTo(680.3, 1);
    expect(PAGE_CONTENT_HEIGHT_PX).toBeCloseTo(1031.8, 1);
    expect(FIT_AVAILABLE_PX).toBeLessThan(PAGE_CONTENT_HEIGHT_PX);
  });
});

describe("density levels", () => {
  it("starts untouched", () => {
    expect(DENSITY_LEVELS[0]).toMatchObject({
      section: 1,
      list: 1,
      paragraph: 1,
      heading: 1,
      margin: 1,
      font: 1,
      line: 1,
    });
  });

  it("never renders body copy below the readability floor in any template", () => {
    const last = DENSITY_LEVELS[MAX_DENSITY_LEVEL]!;
    /*
     * The `--rm-size-body` values from resume.css: Classic 11, Modern 11,
     * Minimal 10.5, Editorial 11, Executive 11. The floor is derived from the
     * densest of them, so Minimal is the binding case — the loop states the
     * invariant for all five rather than trusting one number, and the constants
     * below have to be edited whenever the stylesheet's type scale is.
     */
    const templateBodySizes = {
      classic: 11,
      modern: 11,
      minimal: 10.5,
      editorial: 11,
      executive: 11,
    };
    for (const [template, base] of Object.entries(templateBodySizes)) {
      expect(base * last.font, `${template} at the last level`).toBeGreaterThanOrEqual(MIN_BODY_FONT_PX);
      expect(base * last.font, `${template} at the last level`).toBeLessThan(base);
    }
    expect(MIN_BODY_FONT_PX).toBe(9.5);
    expect(last.font).toBeLessThan(1);
  });

  it("never shrinks type by more than 5%, whatever the template", () => {
    /*
     * The floor could be hit exactly — 9.5 / 10.5 = 0.905 — but it is not. A
     * promise stated in pixels should not depend on `calc()` rounding or on the
     * browser's font rasterisation, so the ladder stops at 0.95 and keeps half a
     * pixel in hand. A reviewer seeing type drop by 9.5 % would also have a fair
     * complaint.
     */
    for (let level = 1; level <= MAX_DENSITY_LEVEL; level += 1) {
      expect(DENSITY_LEVELS[level]!.font).toBeGreaterThanOrEqual(0.95);
    }
  });

  it("only ever reduces each multiplier (PRD §14 priority order)", () => {
    for (let level = 1; level <= MAX_DENSITY_LEVEL; level += 1) {
      const previous = DENSITY_LEVELS[level - 1]!;
      const current = DENSITY_LEVELS[level]!;
      for (const key of [
        "section",
        "list",
        "paragraph",
        "heading",
        "margin",
        "font",
        "line",
      ] as const) {
        expect(current[key]).toBeLessThanOrEqual(previous[key]);
      }
    }
  });

  it("spends the ladder on spacing first and typography last (PRD §14)", () => {
    // Whitespace, lists, paragraphs, headings, entry margins and leading all
    // compact before the type size moves at all.
    const firstTypographic = DENSITY_LEVELS.findIndex((level) => level.font < 1);
    expect(firstTypographic).toBe(MAX_DENSITY_LEVEL - 1);
    for (const key of [
      "section",
      "list",
      "paragraph",
      "heading",
      "margin",
    ] as const) {
      expect(DENSITY_LEVELS[firstTypographic]![key]).toBeLessThan(1);
    }
    // Every level introduces exactly one lever (PRD §14 is an ordered list).
    for (let level = 1; level <= MAX_DENSITY_LEVEL; level += 1) {
      const previous = DENSITY_LEVELS[level - 1]!;
      const changed = (
        ["section", "list", "paragraph", "heading", "margin", "font", "line"] as const
      ).filter((key) => DENSITY_LEVELS[level]![key] < previous[key]);
      expect(changed.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("clamps out of range levels", () => {
    expect(getDensityLevel(-5)).toBe(DENSITY_LEVELS[0]);
    expect(getDensityLevel(99)).toBe(DENSITY_LEVELS[MAX_DENSITY_LEVEL]);
  });

  it("exposes the density as CSS custom properties", () => {
    const style = densityStyle(3) as unknown as Record<string, number>;
    expect(style["--rm-d-font"]).toBe(1);
    expect(style["--rm-d-section"]).toBe(DENSITY_LEVELS[3]!.section);
  });
});

describe("decideFit", () => {
  it("keeps the current level when the content fits", () => {
    const decision = decideFit(2, FIT_AVAILABLE_PX);
    expect(decision).toMatchObject({ level: 2, overflow: false });
  });

  it("increases the level one step at a time while overflowing", () => {
    expect(decideFit(0, FIT_AVAILABLE_PX + 1).level).toBe(1);
    expect(decideFit(3, FIT_AVAILABLE_PX * 2).level).toBe(4);
  });

  it("warns instead of shrinking further at the last level", () => {
    const decision = decideFit(MAX_DENSITY_LEVEL, FIT_AVAILABLE_PX + 400);
    expect(decision).toMatchObject({
      level: MAX_DENSITY_LEVEL,
      overflow: true,
    });
  });

  it("converges for a resume that needs the whole ladder", () => {
    let level = 0;
    // 40 pages of content: the engine must stop at the floor and warn.
    for (let step = 0; step < 50; step += 1) {
      const decision = decideFit(level, FIT_AVAILABLE_PX * 40);
      level = decision.level;
      if (decision.overflow) break;
    }
    expect(level).toBe(MAX_DENSITY_LEVEL);
  });
});

describe("relaxLevel", () => {
  it("restarts the ladder after a large shrink that leaves it fitting", () => {
    // 900px -> 800px is an 11% shrink and now fits: go all the way back to 0 so
    // the engine re-walks up to the lightest level that actually fits.
    expect(relaxLevel(6, 900, 800)).toBe(0);
  });

  it("keeps the current level for a keystroke-sized change", () => {
    expect(relaxLevel(6, 1000, 995)).toBe(6);
  });

  it("never relaxes while the content still overflows", () => {
    expect(relaxLevel(6, 2000, 1500)).toBe(6);
  });

  it("is a no-op at level 0 and before the first measurement", () => {
    expect(relaxLevel(0, 2000, 100)).toBe(0);
    expect(relaxLevel(6, 0, 100)).toBe(6);
  });

  it("never relaxes while climbing — a raise is not a deletion", () => {
    /*
     * Regression guard. Compacting one level shrinks the document by a few
     * percent, which is exactly what RELAX_TRIGGER_RATIO looks for. Relaxing
     * there sends the ladder back to 0, which climbs again, which relaxes
     * again: the fit oscillates between two levels and never settles.
     *
     * The scenario is the real one: level 5 measured 1250px and overflowed, so
     * the engine raised the level, and the document then came back at 1000px —
     * a 20% "shrink" that the user did not type.
     */
    expect(relaxLevel(5, 1250, 1000)).toBe(0);
    expect(relaxLevel(5, 1250, 1000, true)).toBe(5);
  });

  it("converges when driven like the real loop", () => {
    /*
     * A synthetic document whose height is a decreasing function of the level,
     * driven through the same `relaxLevel` → `decideFit` sequence the hook uses.
     * 1.4 pages of content: the engine must reach a fitting level and stop.
     */
    const contentAt = (level: number) => 1470 * (1 - level * 0.06);
    let level = 0;
    let previousHeight = 0;
    let climbing = false;
    for (let pass = 0; pass < 200; pass += 1) {
      const contentHeight = contentAt(level);
      const from = relaxLevel(level, previousHeight, contentHeight, climbing);
      const decision = decideFit(from, contentHeight);
      climbing = decision.level > level;
      level = decision.level;
      previousHeight = contentHeight;
      if (!decision.overflow && contentAt(level) <= FIT_AVAILABLE_PX) {
        if (decision.level === level) break;
      }
    }
    expect(contentAt(level)).toBeLessThanOrEqual(FIT_AVAILABLE_PX);
    expect(level).toBeGreaterThan(0);
  });

  it("always resets to 0 exactly at the trigger ratio", () => {
    const previous = 1000;
    const content = previous * (1 - RELAX_TRIGGER_RATIO);
    expect(relaxLevel(4, previous, content)).toBe(0);
  });
});

describe("page maths", () => {
  it("measures fill against the One Page budget", () => {
    expect(fillRatio(FIT_AVAILABLE_PX)).toBeCloseTo(1, 5);
    expect(fillRatio(FIT_AVAILABLE_PX * 2)).toBeCloseTo(2, 5);
    expect(fillRatio(0)).toBe(0);
  });

  it("counts one page for anything that fits", () => {
    expect(pageCountForBlocks([FIT_AVAILABLE_PX])).toBe(1);
    expect(pageCountForBlocks([FIT_AVAILABLE_PX * 0.99])).toBe(1);
  });

  it("never reports fewer pages than the printer will produce", () => {
    /*
     * Regression guard. `break-inside: avoid` on each entry means an entry
     * straddling a boundary is pushed whole to the next page and the vacated
     * space is lost. Plain division ignored that and under-counted a 7-page
     * resume as 7 when Chromium produced 8.
     */
    // Seven 400px blocks on a 1028px page: 2, 2, 2, 1 fit — the fifth and
    // seventh have to start a page, so the total is 4, not ceil(2800/1028) = 3.
    expect(pageCountForBlocks([400, 400, 400, 400, 400, 400, 400])).toBe(4);
    expect(pageCountForBlocks([400, 400, 400, 400, 400, 400])).toBe(3);
  });

  it("starts a page when a block would straddle the boundary", () => {
    // A block that exactly fills the remainder goes on the page; one pixel more
    // starts a new one.
    const first = 900;
    const rest = Math.floor(FIT_AVAILABLE_PX - first);
    expect(pageCountForBlocks([first, rest, first])).toBe(2);
    expect(pageCountForBlocks([first, rest + 1, first])).toBe(3);
  });

  it("keeps a single oversized block on one page rather than looping", () => {
    expect(pageCountForBlocks([5000])).toBe(1);
    expect(pageCountForBlocks([])).toBe(1);
  });

  it("matches Chromium on a document of 3-entry sections", () => {
    /*
     * Regression guard from real output. Each section is a 37px heading
     * (20px + margin) followed by three 244px entries, after a 74px masthead.
     * Chromium prints this in 8 pages, because `break-after: avoid` makes the
     * heading travel with its first entry: every page holds a heading and three
     * entries (780px of the 1028px available) instead of four entries.
     *
     * Counting the heading as a unit of its own stranded it at the foot of a
     * page and reported 7 — one page fewer than the printer actually produces.
     */
    const glommed = [74, ...Array.from({ length: 8 }, () => [281, 244, 244]).flat(), 67];
    expect(pageCountForBlocks(glommed)).toBe(8);

    const detached = [74, ...Array.from({ length: 8 }, () => [37, 244, 244, 244]).flat(), 67];
    expect(pageCountForBlocks(detached)).toBe(7);
  });
});
