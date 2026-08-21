"use client";

import { useEffect, useState, type RefObject } from "react";

/** 优先向下展开；视口下方空间不足时改为向上 */
export function usePopoverPlacement(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  estimatedHeight = 320,
) {
  const [placement, setPlacement] = useState<"up" | "down">("down");

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPlacement("down");
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const preferDown =
        spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove;
      setPlacement(preferDown ? "down" : "up");
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, estimatedHeight]);

  return placement;
}

export function popoverPosition(placement: "up" | "down") {
  return placement === "down" ? "top-full mt-2" : "bottom-full mb-2";
}
