/**
 * One Page layout engine (PRD §12 – §16).
 *
 * The resume is never scaled down, cropped or hidden. Instead the *spacing
 * tokens* of the document are reduced progressively, following the priority
 * order required by PRD §14:
 *
 *   1. excessive whitespace   (section gaps)
 *   2. section spacing
 *   3. list spacing
 *   4. paragraph spacing
 *   5. heading spacing
 *   6. block margins
 *   7. slightly reduce typography  (readability floor)
 *
 * Each level below enables one more adjustment on top of the previous ones, so
 * the engine always applies the *lightest* change set that makes the content fit
 * on a single A4 page. If even the last level overflows, the caller is told to
 * warn the user instead of destroying readability.
 */

import type { CSSProperties } from "react";

export const PAGE = {
  widthMm: 210,
  heightMm: 297,
  /** Mirrors the `@page { margin: 12mm 15mm }` print rule exactly. */
  marginYMm: 12,
  marginXMm: 15,
} as const;

export const PX_PER_MM = 96 / 25.4;

export const PAGE_WIDTH_PX = PAGE.widthMm * PX_PER_MM;
export const PAGE_HEIGHT_PX = PAGE.heightMm * PX_PER_MM;
export const PAGE_CONTENT_WIDTH_PX = (PAGE.widthMm - 2 * PAGE.marginXMm) * PX_PER_MM;
export const PAGE_CONTENT_HEIGHT_PX =
  (PAGE.heightMm - 2 * PAGE.marginYMm) * PX_PER_MM;

/**
 * Sub-pixel safety net: the browser paginates the printed page independently of
 * our measurement, so we only accept a fit that leaves a small margin (≈1 mm).
 */
export const FIT_SAFETY_PX = 4;

export const FIT_AVAILABLE_PX = PAGE_CONTENT_HEIGHT_PX - FIT_SAFETY_PX;

export type DensityAdjustments = {
  /** Multiplier applied to the gap between two sections. */
  section: number;
  /** Multiplier applied to the gap between list items. */
  list: number;
  /** Multiplier applied to the gap between paragraphs. */
  paragraph: number;
  /** Multiplier applied to the padding around headings. */
  heading: number;
  /** Multiplier applied to the margin of entry blocks (job / degree). */
  margin: number;
  /** Multiplier applied to every font size. */
  font: number;
  /** Multiplier applied to the line height. */
  line: number;
};

export type DensityLevel = DensityAdjustments & {
  /** Short, human readable explanation shown in the status bar. */
  label: string;
};

/**
 * Absolute readability floor. PRD §9 puts resume body copy at 9–11 px, so the
 * engine never renders a body smaller than this, whichever template is active.
 */
export const READABILITY_FLOOR_PX = 9.5;

/**
 * The ladder's last font multiplier — the only lever left when every spacing
 * step has been spent.
 *
 * The floor that matters is `READABILITY_FLOOR_PX` (9.5 px) applied to whichever
 * template is active, and the binding case is the *densest* one: Minimal, whose
 * `--rm-size-body` is 10.5 px, against Classic's and Modern's 11 px. Putting
 * Minimal exactly on the floor would mean a multiplier of 9.5 / 10.5 = 0.905.
 * This stops at 0.95 instead, which leaves half a pixel in hand: the floor is a
 * promise in pixels, and neither `calc()` rounding nor the browser's font
 * rasterisation should be able to break it by a fraction. Type is also never
 * reduced by more than 5 %, which is a legible amount of change to make to
 * someone's resume.
 *
 * There is deliberately no `DENSEST_BASE_BODY_FONT_PX` constant here. It existed,
 * and it was a second source of truth for a number that lives in `resume.css`:
 * Minimal's body was 10 px when it was written, was later raised to 10.5 px to
 * bring an over-long measure back into range, and the constant kept saying 10 for
 * a while afterwards. The invariant is asserted directly instead — see
 * `never renders body copy below the readability floor in any template` and
 * `never shrinks type by more than 5%` in `onePage.test.ts`, which name all
 * three real values, so a type-scale change fails a test instead of silently
 * weakening a guarantee.
 */
const FONT_FLOOR = 0.95;

/**
 * The levels follow PRD §14's priority ladder: whitespace, section spacing,
 * list spacing, paragraph spacing, heading spacing, entry spacing, then leading,
 * and only then typography. Grouping several levers into one step would skip
 * the ordering the PRD asks for, and would compact the document further than the
 * fit actually requires.
 *
 * The values are measured, not guessed. On a 1.4-page Classic resume the
 * spacing levers together account for about a third of the total height and the
 * line boxes for the rest, so a ladder that only trims gaps reclaims ~10 % by
 * its sixth step and then has to fall through two aggressive typography levels
 * to finish the job. Spreading the range across the spacing steps and bringing
 * leading in at step 5 lets a 1.4-page resume land around level 4–5, which is
 * what "compact just enough" is supposed to look like.
 *
 * PRD §14 lists "reduce page margins" as the sixth lever. It cannot be
 * implemented: `@page` margins are static in CSS and cannot be conditioned on
 * the density level, and the sheet's padding is what mirrors them on screen.
 * The closest honest equivalent — the margin of each entry block — is used
 * instead, and labelled as such so the status bar does not overclaim.
 */
export const DENSITY_LEVELS: readonly DensityLevel[] = [
  {
    section: 1,
    list: 1,
    paragraph: 1,
    heading: 1,
    margin: 1,
    font: 1,
    line: 1,
    label: "Standard spacing",
  },
  {
    section: 0.72,
    list: 1,
    paragraph: 1,
    heading: 1,
    margin: 1,
    font: 1,
    line: 1,
    label: "Trimmed section spacing",
  },
  {
    section: 0.5,
    list: 0.72,
    paragraph: 1,
    heading: 1,
    margin: 1,
    font: 1,
    line: 1,
    label: "Tighter section and list spacing",
  },
  {
    section: 0.5,
    list: 0.72,
    paragraph: 0.6,
    heading: 0.6,
    margin: 1,
    font: 1,
    line: 1,
    label: "Tighter paragraph and heading spacing",
  },
  {
    section: 0.5,
    list: 0.72,
    paragraph: 0.6,
    heading: 0.6,
    margin: 0.5,
    font: 1,
    line: 1,
    label: "Tighter entry spacing",
  },
  {
    section: 0.5,
    list: 0.72,
    paragraph: 0.6,
    heading: 0.6,
    margin: 0.5,
    font: 1,
    line: 0.94,
    label: "Tighter leading",
  },
  {
    section: 0.4,
    list: 0.5,
    paragraph: 0.48,
    heading: 0.45,
    margin: 0.42,
    font: 1,
    line: 0.92,
    label: "Compact spacing",
  },
  {
    section: 0.4,
    list: 0.5,
    paragraph: 0.48,
    heading: 0.45,
    margin: 0.42,
    font: 0.975,
    line: 0.9,
    label: "Slightly smaller type",
  },
  {
    section: 0.34,
    list: 0.42,
    paragraph: 0.4,
    heading: 0.38,
    margin: 0.36,
    font: FONT_FLOOR,
    line: 0.88,
    label: "Readability limit",
  },
];

export const MAX_DENSITY_LEVEL = DENSITY_LEVELS.length - 1;

/** Body size of the default document — must match `--rm-size-body` in resume.css. */
export const BASE_BODY_FONT_PX = 11;

/**
 * Smallest body font size the engine can ever produce, across all templates.
 * The ladder's font multiplier is derived from this, so the guarantee holds
 * whichever template is active.
 */
export const MIN_BODY_FONT_PX = READABILITY_FLOOR_PX;

export function getDensityLevel(level: number): DensityLevel {
  const clamped = Math.min(Math.max(Math.trunc(level), 0), MAX_DENSITY_LEVEL);
  return DENSITY_LEVELS[clamped]!;
}

export type FitDecision = {
  /** Density level that should be rendered. */
  level: number;
  /** True when even the most compact readable layout still overflows. */
  overflow: boolean;
  /** Measured content height in CSS pixels. */
  contentHeight: number;
};

/**
 * Monotonic decision function: the level only ever increases while the content
 * does not fit, which guarantees the measurement loop converges.
 */
export function decideFit(level: number, contentHeight: number): FitDecision {
  const current = Math.min(Math.max(Math.trunc(level), 0), MAX_DENSITY_LEVEL);
  if (contentHeight <= FIT_AVAILABLE_PX) {
    return { level: current, overflow: false, contentHeight };
  }
  if (current < MAX_DENSITY_LEVEL) {
    return { level: current + 1, overflow: false, contentHeight };
  }
  return { level: current, overflow: true, contentHeight };
}

/**
 * How much the content has to shrink before the engine reconsiders its level
 * from scratch. A single keystroke moves the height by a fraction of a pixel;
 * deleting a paragraph moves it by tens. Stepping down one level at a time
 * would need a measurement per level and can oscillate between two adjacent
 * levels when the content sits exactly on the boundary, so a large edit instead
 * restarts the ladder at 0 and lets {@link decideFit} walk back up to the
 * lightest level that fits. That is both convergent and cheap: it happens on a
 * bulk edit, never per keystroke.
 */
export const RELAX_TRIGGER_RATIO = 0.03;

/**
 * Level to start from, given the previous and current measured heights.
 *
 * Returns 0 (restart the ladder) when the content shrank by at least
 * {@link RELAX_TRIGGER_RATIO} and still fits on one page; otherwise the current
 * level, so ordinary edits keep the density the user is already looking at.
 *
 * `climbing` must be true when the previous measurement was taken at a *higher*
 * level than the current one. Raising a level shrinks the document by a few
 * percent, which is exactly what the trigger looks for; without this guard the
 * ladder relaxes to 0, climbs back, relaxes again, and livelocks between two
 * adjacent levels forever.
 */
export function relaxLevel(
  level: number,
  previousHeight: number,
  contentHeight: number,
  climbing = false,
): number {
  if (level <= 0) return 0;
  if (climbing) return level;
  if (contentHeight > FIT_AVAILABLE_PX) return level;
  if (previousHeight <= 0) return level;
  const shrink = (previousHeight - contentHeight) / previousHeight;
  return shrink >= RELAX_TRIGGER_RATIO ? 0 : level;
}

/**
 * Page count from the *blocks* the document is actually made of.
 *
 * Dividing a total height by the printable height under-reports, because it
 * assumes content flows continuously. It does not: every `.resume-entry` and
 * the masthead carry `break-inside: avoid`, so a block that does not fit in the
 * space left on a page is pushed whole to the next one and the space it vacated
 * is lost. Over a long resume that slack accumulates into a whole extra page, and
 * a plain division would tell the user their resume is 7 pages when the printer
 * produces 8.
 *
 * This walks the unbreakable blocks in order — each height already including the
 * gap that precedes it — and starts a new page whenever the next one would not
 * fit. It is a simulation, not the print engine: a long prose block that Chromium
 * would happily split is treated as indivisible here, so the count can round up
 * by a page in that case, but it will not round down.
 */
export function pageCountForBlocks(units: readonly number[]): number {
  let pages = 1;
  let used = 0;
  for (const height of units) {
    // A block taller than a page is itself unprintable on one sheet; counting it
    // as one unit is the only sane answer and keeps the loop finite.
    if (used > 0 && used + height > FIT_AVAILABLE_PX) {
      pages += 1;
      used = 0;
    }
    used += height;
  }
  return pages;
}

/** How full a single page is, 0–1 (values above 1 mean "spills over"). */
export function fillRatio(contentHeight: number): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return 0;
  return contentHeight / FIT_AVAILABLE_PX;
}

/**
 * CSS custom properties consumed by resume.css. Keeping the compaction in
 * custom properties means screen preview and print output share one source of
 * truth — what the user sees is exactly what is printed.
 *
 * The result is memoised per level: it is handed to a memoised document view,
 * and a fresh object identity on every render would defeat that memo and
 * re-render the whole Markdown tree whenever only the fit status changed.
 */
const DENSITY_STYLES: CSSProperties[] = DENSITY_LEVELS.map((density) => ({
  "--rm-d-section": density.section,
  "--rm-d-list": density.list,
  "--rm-d-paragraph": density.paragraph,
  "--rm-d-heading": density.heading,
  "--rm-d-margin": density.margin,
  "--rm-d-font": density.font,
  "--rm-d-line": density.line,
}) as CSSProperties);

export function densityStyle(level: number): CSSProperties {
  const clamped = Math.min(Math.max(Math.trunc(level), 0), MAX_DENSITY_LEVEL);
  return DENSITY_STYLES[clamped]!;
}
