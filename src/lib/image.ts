export function outputDimensions(width: number, height: number, longestSide: number) {
  // Canvas は 0 以下の寸法を受け付けない。入口で止めて以後の丸め処理を安全にする。
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new RangeError("Image dimensions must be positive numbers.");
  }

  // 長辺が制限内なら拡大しない。元より大きい画像を作らないことで品質劣化と不要な容量増を避ける。
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
  // 自由比率ではトリミングを行わず、元画像全体を Canvas に渡す。
  if (aspectRatio === undefined) return { x: 0, y: 0, width, height };
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    throw new RangeError("Aspect ratio must be a positive number.");
  }

  // 余る方向だけを削る。これにより、指定比率を満たす最大の切り抜き範囲を得る。
  const sourceRatio = width / height;
  const cropWidth = sourceRatio > aspectRatio ? height * aspectRatio : width;
  const cropHeight = sourceRatio > aspectRatio ? height : width / aspectRatio;
  return {
    // focus は 0〜1 の正規化座標。はみ出した UI 値でも clamp して元画像内に収める。
    x: (width - cropWidth) * clamp(focusX),
    y: (height - cropHeight) * clamp(focusY),
    width: cropWidth,
    height: cropHeight,
  };
}

export function formatBytes(value: number) {
  // 表示専用のため、小さい値は整数 B、それ以外は読みやすい固定小数で統一する。
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(2)} MB`;
}
