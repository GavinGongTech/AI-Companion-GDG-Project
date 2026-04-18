import { describe, expect, it } from "vitest";
import { parseIntInRange } from "./events.js";

describe("parseIntInRange", () => {
  const limitOptions = { defaultValue: 50, min: 1, max: 100 };

  it("returns default value for invalid input", () => {
    expect(parseIntInRange("abc", limitOptions)).toBe(50);
    expect(parseIntInRange(undefined, limitOptions)).toBe(50);
  });

  it("clamps values below min", () => {
    expect(parseIntInRange("-20", limitOptions)).toBe(1);
    expect(parseIntInRange(0, limitOptions)).toBe(1);
  });

  it("clamps values above max", () => {
    expect(parseIntInRange("500", limitOptions)).toBe(100);
  });

  it("accepts integer-like values", () => {
    expect(parseIntInRange("20", limitOptions)).toBe(20);
  });
});
