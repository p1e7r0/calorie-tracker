"use client";

import { useEffect } from "react";
import { visualViewportMetrics } from "@/lib/visual-viewport";

const statusBarFallbackPixels = 54;
const settleDelays = [100, 300, 600];

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
    let settleTimers: number[] = [];

    function update() {
      if (!visualViewport) return;
      const width = Math.round(visualViewport.width);
      const layoutHeight = Math.max(window.innerHeight, visualViewport.height);
      if (width !== lastWidth) {
        lastWidth = width;
        tallestHeight = layoutHeight;
      }
      tallestHeight = Math.max(tallestHeight, layoutHeight);
      const metrics = visualViewportMetrics({
        innerHeight: window.innerHeight,
        height: visualViewport.height,
        offsetTop: visualViewport.offsetTop,
        tallestHeight,
      });
      root.style.setProperty("--viewport-height", `${metrics.height}px`);
      root.style.setProperty("--viewport-offset-top", `${metrics.offsetTop}px`);
      root.style.setProperty("--keyboard-inset", `${metrics.keyboardInset}px`);
      if (metrics.keyboardOpen) {
        root.dataset.keyboardOpen = "";
      } else {
        delete root.dataset.keyboardOpen;
      }
    }

    function updateUntilSettled() {
      update();
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      settleTimers = settleDelays.map((delay) => window.setTimeout(update, delay));
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") updateUntilSettled();
    }

    update();
    visualViewport.addEventListener("resize", updateUntilSettled);
    visualViewport.addEventListener("scroll", update);
    window.addEventListener("focusout", updateUntilSettled);
    window.addEventListener("pageshow", updateUntilSettled);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      visualViewport.removeEventListener("resize", updateUntilSettled);
      visualViewport.removeEventListener("scroll", update);
      window.removeEventListener("focusout", updateUntilSettled);
      window.removeEventListener("pageshow", updateUntilSettled);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      root.style.removeProperty("--viewport-height");
      root.style.removeProperty("--viewport-offset-top");
      root.style.removeProperty("--keyboard-inset");
      delete root.dataset.keyboardOpen;
    };
  }, []);

  return null;
}
