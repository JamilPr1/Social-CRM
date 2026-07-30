/** Instagram feed image limits (Meta Content Publishing API). */
export const IG_MIN_ASPECT = 4 / 5; // 0.8 — max portrait (4:5)
export const IG_MAX_ASPECT = 1.91; // max landscape
export const IG_MIN_WIDTH = 320;

export function getImageAspectRatio(width: number, height: number): number {
  if (height <= 0) return 0;
  return width / height;
}

export function isInstagramAspectRatioOk(width: number, height: number): boolean {
  if (width < IG_MIN_WIDTH || height < IG_MIN_WIDTH) return false;
  const ratio = getImageAspectRatio(width, height);
  return ratio >= IG_MIN_ASPECT && ratio <= IG_MAX_ASPECT;
}

export function describeInstagramAspectIssue(
  width: number,
  height: number
): string | null {
  if (width < IG_MIN_WIDTH || height < IG_MIN_WIDTH) {
    return `Image is too small (${width}×${height}px). Instagram needs at least ${IG_MIN_WIDTH}px on each side.`;
  }

  const ratio = getImageAspectRatio(width, height);
  if (ratio < IG_MIN_ASPECT) {
    return `Image is too tall for Instagram (${width}×${height}px). Use 4:5 portrait, 1:1 square, or up to 1.91:1 landscape.`;
  }
  if (ratio > IG_MAX_ASPECT) {
    return `Image is too wide for Instagram (${width}×${height}px). Use 1.91:1 landscape, 1:1 square, or 4:5 portrait.`;
  }
  return null;
}

export function loadImageDimensions(
  source: string | File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cleanup = (objectUrl?: string) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };

    img.onerror = () => {
      cleanup(source instanceof File ? img.src : undefined);
      reject(new Error("Could not read image dimensions"));
    };

    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      cleanup(source instanceof File ? img.src : undefined);
      resolve(dims);
    };

    if (source instanceof File) {
      img.src = URL.createObjectURL(source);
    } else {
      img.crossOrigin = "anonymous";
      img.src = source;
    }
  });
}
