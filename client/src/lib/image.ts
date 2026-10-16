// Downscale a photo before upload. Phone cameras produce 2-5 MB images; the AI only needs ~1024px,
// so this cuts upload time (the slow part on mobile data) by roughly 10-20x.

const MAX_EDGE = 1024;
const QUALITY = 0.82;

export interface PreparedImage {
  base64: string;
  mimeType: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Returns a resized JPEG, or the original file if the browser can't decode/resize it. */
export async function prepareImageForUpload(file: File, maxEdge = MAX_EDGE): Promise<PreparedImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, "image/jpeg", QUALITY));
    if (!blob || blob.size === 0) throw new Error("encode failed");
    // Never make it bigger than the original.
    if (blob.size >= file.size) throw new Error("not smaller");
    return { base64: await blobToBase64(blob), mimeType: "image/jpeg" };
  } catch {
    return { base64: await blobToBase64(file), mimeType: file.type || "image/jpeg" };
  }
}

const AVATAR_PX = 256;

/**
 * Centre-crop to a square and shrink to 256px JPEG. Re-encoding through a canvas also drops EXIF data
 * (including any GPS location) from the original photo. Throws if the browser can't read the file.
 */
export async function prepareAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  bitmap.close?.();
  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob || blob.size === 0) throw new Error("encode failed");
  return blobToBase64(blob);
}
