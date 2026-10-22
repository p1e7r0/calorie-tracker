"use client";

import { useEffect } from "react";

const keyboardThreshold = 0.75;
const statusBarFallbackPixels = 54;

function standaloneStatusBarFallback(root: HTMLElement) {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!isStandalone) return 0;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none";
  root.appendChild(probe);
  const insetTop = probe.getBoundingClientRect().height;
  probe.remove();
  const coversWholeScreen = window.innerHeight >= window.screen.height - 1;
  return insetTop === 0 && coversWholeScreen ? statusBarFallbackPixels : 0;
}

export function VisualViewportSync() {
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;
    const root = document.documentElement;
    root.style.setProperty("--status-bar-fallback", `${standaloneStatusBarFallback(root)}px`);
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
      const keyboardInset = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
      root.style.setProperty("--keyboard-inset", `${Math.round(keyboardInset)}px`);
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
      root.style.removeProperty("--keyboard-inset");
      delete root.dataset.keyboardOpen;
    };
  }, []);

  return null;
}
