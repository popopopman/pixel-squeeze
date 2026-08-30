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

export type CropRect = { x: number; y: number; width: number; height: number };

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function cropRect(
  width: number,
  height: number,
  aspectRatio?: number,
  focusX = 0.5,
  focusY = 0.5,
): CropRect {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new RangeError("Image dimensions must be positive numbers.");
  }
  if (aspectRatio === undefined) return { x: 0, y: 0, width, height };
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    throw new RangeError("Aspect ratio must be a positive number.");
  }

  const sourceRatio = width / height;
  const cropWidth = sourceRatio > aspectRatio ? height * aspectRatio : width;
  const cropHeight = sourceRatio > aspectRatio ? height : width / aspectRatio;
  return {
    x: (width - cropWidth) * clamp(focusX),
    y: (height - cropHeight) * clamp(focusY),
    width: cropWidth,
    height: cropHeight,
  };
}

export function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(2)} MB`;
}
