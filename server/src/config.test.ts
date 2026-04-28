import { describe, expect, it } from "vitest";

describe("server configuration and logger", () => {
  it("env handles various boolean formats", async () => {
    const { parseBoolean } = await import("../src/env");
    expect(parseBoolean("true", false)).toBe(true);
    expect(parseBoolean("1", false)).toBe(true);
    expect(parseBoolean("yes", false)).toBe(true);
    expect(parseBoolean("on", false)).toBe(true);
    expect(parseBoolean("false", true)).toBe(false);
    expect(parseBoolean("0", true)).toBe(false);
    expect(parseBoolean("no", true)).toBe(false);
    expect(parseBoolean("off", true)).toBe(false);
    expect(parseBoolean(null, true)).toBe(true);
    expect(parseBoolean("maybe", true)).toBe(true);
  });

  it("env handles positive integers", async () => {
    const { parsePositiveInt } = await import("../src/env");
    expect(parsePositiveInt("4000", 3000)).toBe(4000);
    expect(parsePositiveInt("-1", 3000)).toBe(3000);
    expect(parsePositiveInt("abc", 3000)).toBe(3000);
    expect(parsePositiveInt("", 3000)).toBe(3000);
    expect(parsePositiveInt(null, 3000)).toBe(3000);
  });

  it("env exports correct values", async () => {
    const { env } = await import("../src/env");
    expect(env.port).toBe(3000);
    expect(env.nodeEnv).toBe("test");
  });

  it("logger is initialized", async () => {
    const { logger } = await import("../src/logger");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
  });
});
