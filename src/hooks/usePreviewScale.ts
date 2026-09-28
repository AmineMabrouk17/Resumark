"use client";

import { useEffect, useState, type RefObject } from "react";

import { PAGE_WIDTH_PX } from "@/lib/onePage";

/**
 * Never scale the preview below this.
 *
 * The document's type is sized in absolute px (PRD §9), so `zoom` scales it
 * with no lower bound of its own. At 0.32 the 11px body text renders at 3.5 CSS
 * px on a 320px phone — smaller than anything anyone can read. Below this floor
 * the stage scrolls horizontally instead, which costs a scrollbar and keeps the
 * text at a real size.
 */
export const MIN_PREVIEW_ZOOM = 0.72;

/**
 * Scales the A4 sheet down (never up) so narrow viewports show a whole page
 * without sideways scrolling. Uses the `zoom` property because, unlike a
 * transform, it also resizes the layout box — and because layout metrics
 * (`scrollHeight`) stay unzoomed, so the One Page measurement is unaffected.
 */
export function usePreviewScale(
  stageRef: RefObject<HTMLElement | null>,
): number {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const update = (contentWidth: number) => {
      if (contentWidth <= 0) return;
      const fit = contentWidth / PAGE_WIDTH_PX;
      /*
       * Past the floor, hand the width back to the scroll container rather than
       * shrinking the text further. `.preview-stage` is already `overflow: auto`
       * and centres with `safe center`, so the sheet stays centred when it fits
       * and stays fully reachable when it does not.
       */
      const next = fit >= 1 ? 1 : Math.max(MIN_PREVIEW_ZOOM, fit);
      setZoom((previous) => (Math.abs(previous - next) < 0.001 ? previous : Number(next.toFixed(4))));
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.contentRect.width);
    });
    observer.observe(stage);
    update(stage.clientWidth);

    return () => observer.disconnect();
  }, [stageRef]);

  return zoom;
}
