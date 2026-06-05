// Client-side image compression. Resizes/re-encodes a photo so the
// resulting file does not exceed maxKB. Runs entirely in the browser
// (canvas + JPEG), so it requires no extra dependencies.

const MAX_KB = 150;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Compress an image file so it stays under maxKB kilobytes.
 * Returns the original file untouched if it is not an image or already small enough.
 */
export async function compressImage(file: File, maxKB = MAX_KB): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= maxKB * 1024) return file;

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return file; // fall back to original if decoding fails
  }

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  // Cap initial dimensions to keep large photos manageable.
  const MAX_DIM = 2000;
  if (Math.max(width, height) > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const target = maxKB * 1024;
  let best: Blob | null = null;

  // Try progressively smaller dimensions; for each, lower JPEG quality.
  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.8, 0.6, 0.45, 0.3]) {
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= target) {
        return new File([blob], swapExt(file.name), { type: "image/jpeg" });
      }
    }
    // Still too big — shrink dimensions and retry.
    width *= 0.8;
    height *= 0.8;
  }

  if (best && best.size < file.size) {
    return new File([best], swapExt(file.name), { type: "image/jpeg" });
  }
  return file;
}

function swapExt(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}.jpg`;
}
