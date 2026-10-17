import { describe, expect, it } from "vitest";
import {
  blocksVerticalPan,
  pullDistance,
  pullIntent,
  pullMaximumDistance,
  pullRefreshThreshold,
  visibleSpinnerTicks,
} from "./pull-to-refresh";

describe("pull to refresh", () => {
  it("resists more the further the finger travels", () => {
    expect(pullDistance(0)).toBe(0);
    expect(pullDistance(-30)).toBe(0);
    expect(pullDistance(100)).toBeCloseTo(52.17, 2);
    expect(pullDistance(250)).toBeCloseTo(109.09, 2);
    expect(pullDistance(100_000)).toBeLessThan(pullMaximumDistance);
    expect(pullDistance(200) - pullDistance(100)).toBeLessThan(pullDistance(100));
  });

  it("needs a finger travel of about 140 px to reach the threshold", () => {
    expect(pullDistance(140)).toBeLessThan(pullRefreshThreshold);
    expect(pullDistance(145)).toBeGreaterThan(pullRefreshThreshold);
  });

  it("recognizes a pull only when the gesture is mostly downward", () => {
    expect(pullIntent(2, 5)).toBe("pending");
    expect(pullIntent(3, 9)).toBe("pull");
    expect(pullIntent(9, 9)).toBe("ignore");
    expect(pullIntent(20, 4)).toBe("ignore");
    expect(pullIntent(0, -12)).toBe("ignore");
  });

  it("reveals the spinner ticks while pulling", () => {
    expect(visibleSpinnerTicks(0)).toBe(0);
    expect(visibleSpinnerTicks(1)).toBe(1);
    expect(visibleSpinnerTicks(35)).toBe(6);
    expect(visibleSpinnerTicks(70)).toBe(12);
    expect(visibleSpinnerTicks(200)).toBe(12);
  });

  it("leaves vertical gestures to elements that own them", () => {
    expect(blocksVerticalPan("none")).toBe(true);
    expect(blocksVerticalPan("pan-x")).toBe(true);
    expect(blocksVerticalPan("pan-x pinch-zoom")).toBe(true);
    expect(blocksVerticalPan("pan-y")).toBe(false);
    expect(blocksVerticalPan("auto")).toBe(false);
    expect(blocksVerticalPan("manipulation")).toBe(false);
  });
});
