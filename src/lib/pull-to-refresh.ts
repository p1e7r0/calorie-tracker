export const pullIntentDistance = 8;
export const pullRefreshThreshold = 70;
export const pullHoldOffset = 56;
export const pullMaximumDistance = 400;
export const pullMinimumRefreshDuration = 700;
export const spinnerTickCount = 12;

export type PullIntent = "pending" | "pull" | "ignore";

export function pullDistance(fingerDistance: number) {
  if (fingerDistance <= 0) return 0;
  return (1 - 1 / ((fingerDistance * 0.6) / pullMaximumDistance + 1)) * pullMaximumDistance;
}

export function pullIntent(deltaX: number, deltaY: number): PullIntent {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < pullIntentDistance) return "pending";
  return deltaY > 0 && deltaY > Math.abs(deltaX) ? "pull" : "ignore";
}

export function visibleSpinnerTicks(distance: number) {
  return Math.min(spinnerTickCount, Math.ceil((Math.max(0, distance) / pullRefreshThreshold) * spinnerTickCount));
}

export function blocksVerticalPan(touchAction: string) {
  return touchAction === "none" || (touchAction.includes("pan-x") && !touchAction.includes("pan-y"));
}
