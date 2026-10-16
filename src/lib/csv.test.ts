import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("writes an Excel-friendly Italian CSV", () => {
    const csv = toCsv(
      ["Giorno", "Alimento", "Kcal"],
      [
        ["2026-10-16", 'Yogurt "greco"; 0%', 97.456],
        ["2026-10-16", null, 12],
      ],
    );
    expect(csv).toBe('﻿Giorno;Alimento;Kcal\r\n2026-10-16;"Yogurt ""greco""; 0%";97,46\r\n2026-10-16;;12\r\n');
  });
});
