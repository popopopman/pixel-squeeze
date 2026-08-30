import { describe, expect, it } from "vitest";
import { formatBytes, outputDimensions } from "./image";

describe("outputDimensions", () => {
  it("scales landscape images down while preserving their aspect ratio", () => {
    expect(outputDimensions(4000, 3000, 1920)).toEqual({
      width: 1920,
      height: 1440,
    });
  });

  it("scales portrait and square images from the correct longest edge", () => {
    expect(outputDimensions(3000, 5000, 1920)).toEqual({
      width: 1152,
      height: 1920,
    });
    expect(outputDimensions(2400, 2400, 800)).toEqual({ width: 800, height: 800 });
  });

  it("does not enlarge small images or resize when the maximum is zero", () => {
    expect(outputDimensions(800, 600, 1920)).toEqual({ width: 800, height: 600 });
    expect(outputDimensions(800, 600, 0)).toEqual({ width: 800, height: 600 });
  });

  it("rounds fractional pixels to usable integer dimensions", () => {
    expect(outputDimensions(3333, 2222, 1000)).toEqual({ width: 1000, height: 667 });
  });

  it.each([
    [0, 120],
    [-1, 120],
    [120, 0],
    [120, -1],
    [Number.POSITIVE_INFINITY, 120],
    [120, Number.NaN],
  ])("rejects invalid image dimensions: %s × %s", (width, height) => {
    expect(() => outputDimensions(width, height, 1920)).toThrow(RangeError);
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1024, "1.0 KB"],
    [1536, "1.5 KB"],
    [1024 ** 2, "1.00 MB"],
    [2.5 * 1024 ** 2, "2.50 MB"],
  ])("formats %d bytes as %s", (value, expected) => {
    expect(formatBytes(value)).toBe(expected);
  });
});
