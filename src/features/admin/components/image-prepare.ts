/**
 * Turning a browser File into something worth committing.
 *
 * Shared by the media library and the project editor's cover button, because
 * both send bytes to the same action and both must respect the same ceiling:
 * this deploys to Vercel, where a function body is capped at a few megabytes.
 * A 6 MB phone photo leaves the browser at ~300 KB, which keeps the request
 * inside the limit, keeps the bucket repository's history small, and makes the
 * cover render quickly.
 */

/** Longest edge kept; covers are displayed at most full-bleed on a laptop. */
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.86;
/** Below this an image goes up as-is; re-encoding would only lose quality. */
const COMPRESS_ABOVE_BYTES = 900 * 1024;
/** Re-encoding these would flatten an animation to a single frame. */
const ANIMATED_TYPES = new Set(["image/gif", "image/avif"]);

export type PreparedImage = {
  /** Base64 payload, without the data-URL prefix. */
  content: string;
  contentType: string;
  filename: string;
  size: number;
  /** Data URL for an instant local preview. */
  previewUrl: string;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("خواندن فایل ناموفق بود."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("خواندن تصویر ناموفق بود."));
    image.src = src;
  });
}

/**
 * Downscales and re-encodes to WebP (JPEG where the browser has no WebP
 * encoder), returning base64. Small files and animated formats pass through
 * untouched.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const dataUrl = await readAsDataUrl(file);

  if (file.size <= COMPRESS_ABOVE_BYTES || ANIMATED_TYPES.has(file.type)) {
    return {
      content: dataUrl.split(",")[1] ?? "",
      contentType: file.type,
      filename: file.name,
      size: file.size,
      previewUrl: dataUrl,
    };
  }

  const image = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("پردازش تصویر ناموفق بود.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const webp = canvas.toDataURL("image/webp", JPEG_QUALITY);
  const jpeg = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const encoded =
    webp.length > 512 && webp.startsWith("data:image/webp") ? webp : jpeg;
  const contentType = encoded.startsWith("data:image/webp")
    ? "image/webp"
    : "image/jpeg";

  const extension = contentType === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "image";

  return {
    content: encoded.split(",")[1] ?? "",
    contentType,
    filename: `${base}.${extension}`,
    size: Math.round((encoded.length - encoded.indexOf(",")) * 0.75),
    previewUrl: encoded,
  };
}

export function formatImageSize(bytes: number): string {
  return `${(bytes / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 0 })} KB`;
}
