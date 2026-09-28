"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query.
 *
 * The workspace has to tell the *accessibility tree* what it is, and that
 * depends on the layout: below the tab breakpoint the two panes are one-at-a-time
 * tabs, above it they are two simultaneous regions. Rendering them correctly in
 * both cases needs the breakpoint in JS, not only in CSS.
 *
 * Returns `false` during server rendering and on the first client paint, which
 * matches the CSS default (the wide, side-by-side layout), so hydration is
 * stable and the first paint is never the wrong layout.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
