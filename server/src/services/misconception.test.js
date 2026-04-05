import { describe, it, expect } from "vitest";
import { sm2, toQuality } from "./misconception.js";

describe("sm2", () => {
  it("resets interval to 1 on quality < 3 (failure)", () => {
    const result = sm2(30, 2.5, 0);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("sets interval to 1 on first review (prevInterval=0)", () => {
    const result = sm2(0, 2.5, 4);
    expect(result.interval).toBe(1);
  });

  it("sets interval to 6 on second review (prevInterval=1)", () => {
    const result = sm2(1, 2.5, 4);
    expect(result.interval).toBe(6);
  });

  it("multiplies interval by easeFactor on subsequent reviews", () => {
    const result = sm2(6, 2.5, 4);
    expect(result.interval).toBe(15); // round(6 * 2.5)
  });

  it("caps interval at 365 days", () => {
    const result = sm2(200, 2.5, 5);
    expect(result.interval).toBeLessThanOrEqual(365);
  });

  it("never drops easeFactor below 1.3", () => {
    // quality=0 decreases ease factor aggressively
    let ef = 2.5;
    for (let i = 0; i < 20; i++) {
      const r = sm2(1, ef, 0);
      ef = r.easeFactor;
    }
    expect(ef).toBe(1.3);
  });

  it("increases easeFactor on quality=5", () => {
    const result = sm2(6, 2.5, 5);
    expect(result.easeFactor).toBeGreaterThan(2.5);
  });

  it("decreases easeFactor on quality=3", () => {
    const result = sm2(6, 2.5, 3);
    expect(result.easeFactor).toBeLessThan(2.5);
  });
});

describe("toQuality", () => {
  it("returns 0 for incorrect + high confidence", () => {
    expect(toQuality(false, "conceptual_misunderstanding", 0.9)).toBe(0);
  });

  it("returns 1 for incorrect + medium confidence", () => {
    expect(toQuality(false, "conceptual_misunderstanding", 0.6)).toBe(1);
  });

  it("returns 2 for incorrect + low confidence", () => {
    expect(toQuality(false, "conceptual_misunderstanding", 0.3)).toBe(2);
  });

  it("returns 5 for correct + no error", () => {
    expect(toQuality(true, "none", 0.9)).toBe(5);
  });

  it("returns 3 for correct + error + high confidence", () => {
    expect(toQuality(true, "procedural_error", 0.8)).toBe(3);
  });

  it("returns 4 for correct + error + low confidence", () => {
    expect(toQuality(true, "procedural_error", 0.5)).toBe(4);
  });

  it("returns 3 for explain mode (isCorrect=undefined)", () => {
    expect(toQuality(undefined, "none", 0.5)).toBe(3);
  });
});
