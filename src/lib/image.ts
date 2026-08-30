export function outputDimensions(width: number, height: number, longestSide: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new RangeError("Image dimensions must be positive numbers.");
  }

  const scale = longestSide ? Math.min(1, longestSide / Math.max(width, height)) : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(2)} MB`;
}
