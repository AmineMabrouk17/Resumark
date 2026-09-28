"use client";

import { useEffect, useRef, useState } from "react";

import {
  DENSITY_LEVELS,
  decideFit,
  fillRatio,
  getDensityLevel,
  pageCountForBlocks,
  relaxLevel,
} from "@/lib/onePage";

export type FitStatus = {
  /** One Page density level currently applied (0 = untouched). */
  level: number;
  /** True when even the most compact readable layout spills over. */
  overflow: boolean;
  /** Measured height of the resume content, in CSS pixels. */
  contentHeight: number;
  pageCount: number;
  /** Share of a single page used by the content (>1 means it spills over). */
  fill: number;
  /** Human readable description of the applied compaction. */
  label: string;
};

const INITIAL: FitStatus = {
  level: 0,
  overflow: false,
  contentHeight: 0,
  pageCount: 1,
  fill: 0,
  label: DENSITY_LEVELS[0]!.label,
};

function sameStatus(a: FitStatus, b: FitStatus): boolean {
  return (
    a.level === b.level &&
    a.overflow === b.overflow &&
    a.contentHeight === b.contentHeight &&
    a.pageCount === b.pageCount
  );
}

/**
 * Selectors for the blocks print is not allowed to split.
 *
 * The masthead and every entry carry `break-inside: avoid`; a section heading
 * carries `break-after: avoid`, so it cannot be left stranded at the foot of a
 * page, and it is glued to the block that follows it. Everything a section
 * contains that is not an entry — the heading, and any prose such as the Skills
 * list — is included, which over-counts slightly for prose that Chromium would
 * split, and never under-counts.
 */
const ATOMIC_SELECTOR = [
  ":scope > .resume-masthead",
  ":scope > .resume-loose",
  ":scope > .resume-section > *:not(.resume-entry)",
  ":scope > .resume-section > .resume-entry",
].join(", ");

/**
 * Heights of the document's indivisible blocks, in document order, each
 * including the vertical gap that precedes it.
 *
 * A heading is *not* a unit of its own: `break-after: avoid` means it cannot be
 * left at the foot of a page, so it is glued to the block that follows it.
 * Getting that wrong lets a heading sit alone on the last line of a page and
 * push its entry to the next one — which is exactly how a resume ends up with a
 * section title stranded above a page break.
 *
 * Measured with `offsetTop`/`offsetHeight`, which are layout pixels and are
 * therefore unaffected by the preview's `zoom` — the same property the One Page
 * budget relies on. Using the *differences* keeps the integer rounding of
 * `offsetTop` from accumulating across the document.
 */
function unbreakableUnits(doc: HTMLElement): number[] {
  const nodes = Array.from(doc.querySelectorAll<HTMLElement>(ATOMIC_SELECTOR)).sort(
    (a, b) => a.offsetTop - b.offsetTop,
  );
  const units: number[] = [];
  let bottom = doc.offsetTop;
  let heading = 0;
  for (const node of nodes) {
    const top = node.offsetTop;
    const slot = Math.max(0, top - bottom) + node.offsetHeight;
    bottom = top + node.offsetHeight;
    if (node.matches("h1, h2, h3, h4, h5, h6")) {
      heading += slot;
      continue;
    }
    units.push(heading + slot);
    heading = 0;
  }
  // A heading with nothing after it is still printed; it just cannot be avoided.
  if (heading > 0) units.push(heading);
  return units;
}

/**
 * Measures the rendered resume and drives the One Page compaction (PRD §13).
 *
 * The measurement is taken from the real DOM (the same element that is
 * printed), so the decision always matches what the browser will paginate.
 * `scrollHeight` is used on purpose: it is unaffected by the preview zoom and
 * by CSS transforms.
 */
export function useOnePageFit({
  element,
  enabled,
}: {
  element: HTMLElement | null;
  enabled: boolean;
}): FitStatus {
  const [status, setStatus] = useState<FitStatus>(INITIAL);
  const levelRef = useRef(0);
  const latestRef = useRef<FitStatus>(INITIAL);

  useEffect(() => {
    if (!enabled) levelRef.current = 0;
  }, [enabled]);

  useEffect(() => {
    const target = element;
    if (!target) return;

    let frame = 0;
    let previousHeight = 0;
    let climbing = false;

    const evaluate = () => {
      const contentHeight = target.scrollHeight;
      const current = levelRef.current;
      // A bulk edit that made the document much shorter restarts the ladder at
      // level 0, so the engine returns to the lightest spacing that fits
      // instead of keeping the density it needed for the longer version.
      const from = relaxLevel(current, previousHeight, contentHeight, climbing);
      const decision = enabled
        ? decideFit(from, contentHeight)
        : {
            level: 0,
            overflow: false,
            contentHeight,
          };
      climbing = decision.level > current;
      levelRef.current = decision.level;
      previousHeight = contentHeight;

      const next: FitStatus = {
        level: decision.level,
        overflow: decision.overflow,
        contentHeight,
        pageCount: pageCountForBlocks(unbreakableUnits(target)),
        fill: fillRatio(contentHeight),
        label: getDensityLevel(decision.level).label,
      };

      if (!sameStatus(latestRef.current, next)) {
        latestRef.current = next;
        setStatus(next);
      }
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(evaluate);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(target);
    schedule();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [element, enabled]);

  return status;
}
