"use server";

import { revalidatePath, updateTag } from "next/cache";

import { fa } from "@/content/fa";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { prisma } from "@/lib/db/prisma";
import {
  ALLOWED_IMAGE_TYPES,
  BucketError,
  MAX_UPLOAD_BYTES,
  deleteImage,
  isBucketConfigured,
  listImages,
  putImage,
  type AllowedImageType,
  type MediaItem,
} from "@/lib/media/github-bucket";

/**
 * Media library actions — the only door to the bucket.
 *
 * Every one of these re-checks the admin session, because a server action is
 * an HTTP endpoint that anyone can POST to; the proxy gate in front of /admin
 * is a convenience, not the guarantee. The token stays in
 * `lib/media/github-bucket` and never crosses into a client bundle.
 */

/** Uniform result so the UI can render an outcome without guessing. */
export type MediaActionResult = {
  ok: boolean;
  error?: string;
  item?: MediaItem;
};

/**
 * Best-effort throttle, per process, keyed by nothing more identifying than
 * the session cookie's owner: uploads are commits to a repository, and a stuck
 * retry loop should not turn into a hundred commits. Deliberately in-memory
 * and therefore best-effort — serverless instances are ephemeral, and GitHub's
 * own rate limit is the real backstop. The cap is generous because humans
 * upload a handful of images, not hundreds.
 */
const UPLOADS_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60_000;
const uploadLog = new Map<string, number[]>();

function throttleUploads(): boolean {
  const now = Date.now();
  const recent = (uploadLog.get("uploads") ?? []).filter(
    (at) => now - at < WINDOW_MS,
  );
  if (recent.length >= UPLOADS_PER_WINDOW) {
    uploadLog.set("uploads", recent);
    return false;
  }
  recent.push(now);
  uploadLog.set("uploads", recent);
  return true;
}

/**
 * Confirms the bytes are actually an image of the claimed type.
 *
 * The MIME type travels with the request and is chosen by the caller, so it is
 * treated as a hint: the magic number is what decides. Without this, a
 * misconfigured or hostile client could commit arbitrary files into a
 * repository the site serves URLs from.
 */
/** True when `ascii` appears at `offset`, byte for byte. */
function asciiAt(bytes: Uint8Array, ascii: string, offset = 0): boolean {
  return [...ascii].every(
    (char, index) => bytes[offset + index] === char.charCodeAt(0),
  );
}

const MAGIC: Array<{
  type: AllowedImageType;
  test: (bytes: Uint8Array) => boolean;
}> = [
  // JPEG: SOI marker plus the next byte.
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  // PNG: the 8-byte signature's first four bytes are enough.
  {
    type: "image/png",
    test: (b) => b[0] === 0x89 && asciiAt(b, "PNG", 1),
  },
  { type: "image/gif", test: (b) => asciiAt(b, "GIF87a") || asciiAt(b, "GIF89a") },
  // WebP is a RIFF container whose form type is "WEBP".
  { type: "image/webp", test: (b) => asciiAt(b, "RIFF") && asciiAt(b, "WEBP", 8) },
  // AVIF is ISO-BMFF: an "ftyp" box followed by a brand of avif/avis.
  {
    type: "image/avif",
    test: (b) => asciiAt(b, "ftyp", 4) && (asciiAt(b, "avif", 8) || asciiAt(b, "avis", 8)),
  },
];

function sniff(bytes: Uint8Array): AllowedImageType | null {
  return MAGIC.find((rule) => rule.test(bytes))?.type ?? null;
}

/** Decodes base64 without trusting the declared size, then bounds it. */
function decodeImage(base64: string): Uint8Array {
  // 4 base64 chars → 3 bytes; refuse anything that could not fit the cap.
  if (base64.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 8) {
    throw new Error(fa.admin.mediaTooLarge);
  }

  const binary = atob(base64);
  if (binary.length === 0 || binary.length > MAX_UPLOAD_BYTES) {
    throw new Error(fa.admin.mediaTooLarge);
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function failure(error: unknown): MediaActionResult {
  if (error instanceof BucketError || error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: fa.admin.mediaGenericError };
}

/** Bucket contents, or a not-configured marker the page renders as guidance. */
export async function listMediaAction(): Promise<{
  items: MediaItem[];
  configured: boolean;
}> {
  await requireAdmin();
  if (!isBucketConfigured()) return { items: [], configured: false };
  return { items: await listImages(), configured: true };
}

/** Uploads a new image, or replaces an existing one under the same URL. */
export async function uploadMediaAction(input: {
  content: string;
  contentType: string;
  /** Present on replace; keeps the URL stable so existing covers survive. */
  filename?: string;
  sha?: string;
}): Promise<MediaActionResult> {
  await requireAdmin();

  try {
    if (!ALLOWED_IMAGE_TYPES.includes(input.contentType as AllowedImageType)) {
      return { ok: false, error: fa.admin.mediaBadType };
    }
    if (!throttleUploads()) {
      return { ok: false, error: fa.admin.mediaThrottled };
    }

    const bytes = decodeImage(input.content);
    const sniffed = sniff(bytes);
    if (!sniffed) return { ok: false, error: fa.admin.mediaBadType };
    // The claim and the bytes must agree; otherwise the stored extension would
    // describe a different format than the file actually is.
    if (sniffed !== input.contentType) {
      return { ok: false, error: fa.admin.mediaTypeMismatch };
    }

    const item = await putImage({
      content: input.content,
      contentType: sniffed,
      filename: input.filename,
      sha: input.sha,
    });

    revalidatePath("/admin/media");
    return { ok: true, item };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMediaAction(input: {
  filename: string;
  sha: string;
}): Promise<MediaActionResult> {
  await requireAdmin();

  try {
    await deleteImage(input);
    revalidatePath("/admin/media");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Points a project's cover at a library image.
 *
 * Kept as its own action rather than a form field so the media library can be
 * opened from the editor and used as a picker: the page arrives with
 * `?project=<id>`, the chosen image is written here, and the editor is where
 * the owner lands back.
 */
export async function setProjectCoverAction(input: {
  projectId: string;
  url: string;
}): Promise<MediaActionResult> {
  await requireAdmin();

  try {
    // A cover is either a repository URL from the bucket or a path in /public;
    // anything else (a `javascript:` URL, a data: blob, a remote host) is
    // refused rather than stored for the detail page to render later.
    const isBucketUrl = /^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\/[\w.-]+\/[\w./-]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(
      input.url,
    );
    const isLocalPath = /^\/[A-Za-z0-9._/-]+\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(
      input.url,
    );
    if (!isBucketUrl && !isLocalPath) {
      return { ok: false, error: fa.admin.mediaBadUrl };
    }

    await prisma.project.update({
      where: { id: input.projectId },
      data: { coverImage: input.url },
    });

    updateTag("projects");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** How many projects currently use a given image — the delete guard. */
export async function coverUsageAction(url: string): Promise<number> {
  await requireAdmin();
  return prisma.project.count({ where: { coverImage: url } });
}
