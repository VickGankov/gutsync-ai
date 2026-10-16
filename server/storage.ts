// Photo storage.
//
// Preferred: direct S3-compatible bucket (AWS S3, Cloudflare R2, ...) configured
// with S3_* env vars. Fallback: the legacy Manus Forge storage proxy
// (BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY) so existing deploys keep
// working until the new variables are set.
//
// URLs saved in the database must stay valid, so with direct S3 we return either
// a public/CDN URL (S3_PUBLIC_URL_BASE) or a stable app URL (/api/media/<key>)
// that redirects to a short-lived presigned URL.

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

export const MEDIA_ROUTE = "/api/media";
const PRESIGN_SECONDS = 60 * 60;

export function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/** Keys we serve: meals/<userId>/<id>.<ext> and avatars/<userId>/<id>.jpg. Rejects traversal and odd paths. */
export function isValidMediaKey(key: string): boolean {
  return /^meals\/\d+\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|heic)$/.test(key)
    || /^avatars\/\d+\/[A-Za-z0-9_-]+\.jpg$/.test(key);
}

/** The avatar key inside a stored avatar URL (relative /api/media/... or a public base URL), or null. */
export function avatarKeyFromUrl(url: string | null | undefined, userId: number): string | null {
  const m = url?.match(/avatars\/(\d+)\/[A-Za-z0-9_-]+\.jpg$/);
  return m && Number(m[1]) === userId ? m[0] : null;
}

/** Best-effort delete (direct S3/R2 only). A leftover object is harmless, so failures are logged, not thrown. */
export async function storageDelete(relKey: string): Promise<void> {
  if (storageMode() !== "s3") return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: ENV.s3Bucket, Key: normalizeKey(relKey) }));
  } catch (e) {
    console.error("[storage] delete failed", relKey, e);
  }
}

export function storageMode(): "s3" | "forge" | "none" {
  if (ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey) return "s3";
  if (ENV.forgeApiUrl && ENV.forgeApiKey) return "forge";
  return "none";
}

let _s3: S3Client | null = null;
function s3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: ENV.s3Region || "auto",
      ...(ENV.s3Endpoint ? { endpoint: ENV.s3Endpoint } : {}),
      credentials: { accessKeyId: ENV.s3AccessKeyId, secretAccessKey: ENV.s3SecretAccessKey },
    });
  }
  return _s3;
}

export function publicUrlForKey(key: string): string {
  if (ENV.s3PublicUrlBase) return `${ENV.s3PublicUrlBase.replace(/\/+$/, "")}/${key}`;
  return `${MEDIA_ROUTE}/${key}`;
}

export async function presignedGetUrl(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }), { expiresIn: PRESIGN_SECONDS });
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const mode = storageMode();

  if (mode === "s3") {
    await s3().send(new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: typeof data === "string" ? Buffer.from(data) : data,
      ContentType: contentType,
      CacheControl: "private, max-age=31536000, immutable",
    }));
    return { key, url: publicUrlForKey(key) };
  }

  if (mode === "forge") return forgePut(key, data, contentType);

  throw new Error("Photo storage is not configured: set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
}

// ─── Legacy Manus Forge proxy (fallback only) ───

async function forgePut(key: string, data: Buffer | Uint8Array | string, contentType: string) {
  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "") + "/";
  const uploadUrl = new URL("v1/storage/upload", baseUrl);
  uploadUrl.searchParams.set("path", key);
  const form = new FormData();
  form.append("file", new Blob([data as any], { type: contentType }), key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    body: form,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
  }
  return { key, url: (await response.json()).url as string };
}
