export const keyboardThreshold = 0.75;

export type VisualViewportReading = {
  innerHeight: number;
  height: number;
  offsetTop: number;
  tallestHeight: number;
};

export type VisualViewportMetrics = {
  height: number;
  offsetTop: number;
  keyboardInset: number;
  keyboardOpen: boolean;
};

export function visualViewportMetrics(reading: VisualViewportReading): VisualViewportMetrics {
  const keyboardOpen = reading.height < reading.tallestHeight * keyboardThreshold;
  const offsetTop = keyboardOpen ? Math.max(0, reading.offsetTop) : 0;
  const keyboardInset = keyboardOpen ? Math.max(0, Math.round(reading.innerHeight - reading.height - offsetTop)) : 0;
  return { height: reading.height, offsetTop, keyboardInset, keyboardOpen };
}
