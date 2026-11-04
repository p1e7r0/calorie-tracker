import { describe, expect, it } from "vitest";
import { keyboardChangedShape, visualViewportMetrics } from "./visual-viewport";

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

describe("keyboardChangedShape", () => {
  const closed = visualViewportMetrics({ innerHeight: 852, height: 852, offsetTop: 0, tallestHeight: 852 });
  const open = visualViewportMetrics({ innerHeight: 852, height: 516, offsetTop: 40, tallestHeight: 852 });

  it("reveals the focused field when the keyboard opens", () => {
    expect(keyboardChangedShape(closed, open)).toBe(true);
    expect(keyboardChangedShape(null, open)).toBe(true);
  });

  it("reveals it again when the open keyboard changes height", () => {
    expect(keyboardChangedShape(open, { ...open, height: 480 })).toBe(true);
  });

  it("does nothing while the keyboard stays the same or is closed", () => {
    expect(keyboardChangedShape(open, { ...open, offsetTop: 60, keyboardInset: 276 })).toBe(false);
    expect(keyboardChangedShape(open, closed)).toBe(false);
    expect(keyboardChangedShape(closed, closed)).toBe(false);
  });
});
