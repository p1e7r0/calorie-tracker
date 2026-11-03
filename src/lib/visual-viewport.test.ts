import { describe, expect, it } from "vitest";
import { visualViewportMetrics } from "./visual-viewport";

describe("visualViewportMetrics", () => {
  it("leaves the shell in place when the keyboard is closed", () => {
    expect(visualViewportMetrics({ innerHeight: 852, height: 852, offsetTop: 0, tallestHeight: 852 })).toEqual({
      height: 852,
      offsetTop: 0,
      keyboardInset: 0,
      keyboardOpen: false,
    });
  });

  it("ignores a stale offset left behind after the keyboard closes", () => {
    const metrics = visualViewportMetrics({ innerHeight: 852, height: 852, offsetTop: 50, tallestHeight: 852 });
    expect(metrics.offsetTop).toBe(0);
    expect(metrics.keyboardInset).toBe(0);
    expect(metrics.keyboardOpen).toBe(false);
  });

  it("ignores rubber-band and pinch-zoom offsets without a keyboard", () => {
    expect(visualViewportMetrics({ innerHeight: 852, height: 800, offsetTop: -30, tallestHeight: 852 }).offsetTop).toBe(0);
    expect(visualViewportMetrics({ innerHeight: 852, height: 700, offsetTop: 120, tallestHeight: 852 }).offsetTop).toBe(0);
  });

  it("follows the visual viewport while the keyboard is open", () => {
    expect(visualViewportMetrics({ innerHeight: 852, height: 516, offsetTop: 40, tallestHeight: 852 })).toEqual({
      height: 516,
      offsetTop: 40,
      keyboardInset: 296,
      keyboardOpen: true,
    });
  });
});
