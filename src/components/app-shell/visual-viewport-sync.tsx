"use client";

import { useEffect } from "react";

const keyboardThreshold = 0.75;

export function VisualViewportSync() {
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;
    const root = document.documentElement;
    let tallestHeight = 0;
    let lastWidth = 0;

    function update() {
      if (!visualViewport) return;
      const width = Math.round(visualViewport.width);
      const layoutHeight = Math.max(window.innerHeight, visualViewport.height);
      if (width !== lastWidth) {
        lastWidth = width;
        tallestHeight = layoutHeight;
      }
      tallestHeight = Math.max(tallestHeight, layoutHeight);
      root.style.setProperty("--viewport-height", `${visualViewport.height}px`);
      root.style.setProperty("--viewport-offset-top", `${visualViewport.offsetTop}px`);
      if (visualViewport.height < tallestHeight * keyboardThreshold) {
        root.dataset.keyboardOpen = "";
      } else {
        delete root.dataset.keyboardOpen;
      }
    }

    update();
    visualViewport.addEventListener("resize", update);
    visualViewport.addEventListener("scroll", update);
    return () => {
      visualViewport.removeEventListener("resize", update);
      visualViewport.removeEventListener("scroll", update);
      root.style.removeProperty("--viewport-height");
      root.style.removeProperty("--viewport-offset-top");
      delete root.dataset.keyboardOpen;
    };
  }, []);

  return null;
}
