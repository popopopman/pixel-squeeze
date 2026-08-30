import { describe, expect, it } from "vitest";
import { cropMovement, cropRect, formatBytes, outputDimensions } from "./image";

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

describe("cropRect", () => {
  it("keeps the entire image for a free crop", () => {
    expect(cropRect(4000, 3000)).toEqual({ x: 0, y: 0, width: 4000, height: 3000 });
  });

  it("centres the crop on the axis that has extra image area", () => {
    expect(cropRect(4000, 3000, 16 / 9)).toEqual({
      x: 0,
      y: 375,
      width: 4000,
      height: 2250,
    });
    expect(cropRect(4000, 3000, 1)).toEqual({
      x: 500,
      y: 0,
      width: 3000,
      height: 3000,
    });
  });

  it("moves a crop towards the requested focus point and clamps it to the source", () => {
    expect(cropRect(4000, 3000, 1, 0, 0)).toEqual({ x: 0, y: 0, width: 3000, height: 3000 });
    expect(cropRect(4000, 3000, 1, 1, 1)).toEqual({
      x: 1000,
      y: 0,
      width: 3000,
      height: 3000,
    });
    expect(cropRect(4000, 3000, 1, -1, 2)).toEqual({ x: 0, y: 0, width: 3000, height: 3000 });
  });

  it("rejects an invalid crop ratio", () => {
    expect(() => cropRect(100, 100, 0)).toThrow(RangeError);
    expect(() => cropRect(100, 100, -1)).toThrow(RangeError);
    expect(() => cropRect(100, 100, Number.NaN)).toThrow(RangeError);
  });
});

describe("cropMovement", () => {
  it.each([
    [4000, 3000, undefined, { horizontal: false, vertical: false }],
    [4000, 3000, 1, { horizontal: true, vertical: false }],
    [3000, 4000, 16 / 9, { horizontal: false, vertical: true }],
    [1600, 900, 16 / 9, { horizontal: false, vertical: false }],
  ])("only enables axes with crop overflow for %dx%d", (width, height, ratio, expected) => {
    expect(cropMovement(width, height, ratio)).toEqual(expected);
  });
});
