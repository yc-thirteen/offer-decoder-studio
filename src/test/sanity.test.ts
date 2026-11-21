import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs vitest with jsdom", () => {
    expect(1 + 1).toBe(2);
    expect(typeof document).toBe("object");
  });
});
