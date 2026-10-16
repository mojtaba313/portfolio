import { fa } from "@/content/fa";

/**
 * GitHub-as-a-bucket: image storage on a repository's Contents API.
 *
 * The playground this replaces asked for a token in the browser, which is the
 * one thing a token must never do — it ended up in the page, in memory, in
 * devtools, in a proxy log. Here the token is read from the environment by
 * this module, which is only ever imported from server actions and route
 * handlers, so it exists solely inside the server runtime.
 *
 * Why a repo at all: the deployment target is Vercel with no budget for object
 * storage, and every host that costs nothing for a hobby project charges for
 * egress. GitHub serves `raw.githubusercontent.com` through a CDN for free,
 * `images/` in a repository is a perfectly serviceable blob store, and the
 * trade-off is honest and visible: the files are public, and every write is a
 * commit.
 *
 * Everything the caller can influence is constrained here rather than at the
 * call site: filenames are generated, never taken from the client; paths are
 * rebuilt from a fixed directory; only image extensions are written.
 */

const GITHUB_API = "https://api.github.com";
/** Pinned so a GitHub-side change cannot silently alter response shapes. */
const GITHUB_API_VERSION = "2022-11-28";

/**
 * Where images live inside the bucket repository.
 *
 * Configurable so the bucket repo can hold more than one site's media
 * (`BUCKET_DIR=portfolio` today, another folder later) instead of scattering
 * loose files across its root. Validated on read, because this string ends up
 * in a URL path.
 */
const DEFAULT_DIR = "portfolio";

/** Extensions we are willing to write, mapped from a MIME type. */
const EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
} as const;

export type AllowedImageType = keyof typeof EXTENSION_BY_TYPE;

export const ALLOWED_IMAGE_TYPES = Object.keys(
  EXTENSION_BY_TYPE,
) as AllowedImageType[];

/**
 * GitHub's Contents API takes base64, so a file's wire size is ~4/3 of its
 * real size. Vercel caps a request body at 4.5 MB, so the ceiling that
 * actually matters is ours: past this the upload is refused with a message
 * asking for a smaller image, because the client already compresses.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** One image in the bucket, as the library sees it. */
export type MediaItem = {
  /** Repository-relative path, e.g. "images/6f….webp". */
  path: string;
  filename: string;
  /** Blob sha — required by GitHub to replace or delete. */
  sha: string;
  size: number;
  /** Public, CDN-cached URL served straight to `next/image`. */
  url: string;
};

type GitHubContent = {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir";
  download_url: string | null;
};

export class BucketError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BucketError";
  }
}

/**
 * Bucket configuration, or null when it is not configured.
 *
 * Missing configuration is a normal state (a fresh clone, a preview deploy),
 * never a crash: callers degrade to "the media library is unavailable" rather
 * than throwing, so the rest of the admin panel keeps working.
 */
function config(): {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  dir: string;
} | null {
  const owner = process.env.BUCKET_OWNER?.trim();
  const repo = process.env.BUCKET_REPO?.trim();
  const branch = process.env.BUCKET_BRANCH?.trim() || "main";
  const token = process.env.BUCKET_TOKEN?.trim();
  const dir = bucketDir();
  if (!owner || !repo || !token) return null;
  return { owner, repo, branch, token, dir };
}

/**
 * The configured directory, or the default when unset or nonsensical. The
 * check is deliberately narrow — segments of letters, digits, dashes and
 * underscores — so nothing can climb out of the repository root or smuggle a
 * URL scheme into a request path.
 */
function bucketDir(): string {
  const raw = process.env.BUCKET_DIR?.trim() || DEFAULT_DIR;
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(raw) ? raw : DEFAULT_DIR;
}

export function isBucketConfigured(): boolean {
  return config() !== null;
}

/**
 * The token never leaves this module's request helper — not in a URL, not in an
 * error message. Only GitHub's own status and message are surfaced, which is
 * also what makes bucket misconfiguration diagnosable from the admin UI.
 */
async function github<T>(
  path: string,
  init: RequestInit = {},
  options: { allowMissing?: boolean } = {},
): Promise<T | null> {
  const cfg = config();
  if (!cfg) {
    throw new BucketError("بخش رسانه پیکربندی نشده است.", 503);
  }

  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      ...init.headers,
    },
    cache: "no-store",
  });

  if (options.allowMissing && response.status === 404) return null;

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    /*
     * The bucket token in use can create and update files but is refused
     * deletions ("Resource not accessible by personal access token" even with
     * admin rights reported on the repository). Saying "no access" would be
     * actively misleading there — the owner can upload, they just cannot
     * remove — so delete gets its own message and points at the fix.
     */
    const forbidden = response.status === 401 || response.status === 403;
    const detail = forbidden
      ? `${init.method === "DELETE" ? fa.admin.mediaDeleteForbidden : fa.admin.mediaNoAccess}: ${body?.message ?? response.statusText}`
      : body?.message || response.statusText;
    throw new BucketError(detail, response.status);
  }

  if (response.status === 204) return null;
  return (await response.json()) as T;
}

/** Percent-encodes each segment while keeping the separators intact. */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function contentsPath(owner: string, repo: string, path: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`;
}

/**
 * Public URL for a bucket file.
 *
 * The repository is public by design, so this needs no token and no proxy —
 * which is also why an uploaded image URL is not a secret and must never be
 * treated as one.
 */
export function rawUrl(path: string): string {
  const cfg = config();
  if (!cfg) return "";
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${encodeURIComponent(cfg.branch)}/${encodePath(path)}`;
}

/**
 * Rebuilds a trusted path from a stored filename.
 *
 * The filename is the only untrusted part, and this refuses anything that is
 * not a bare `name.ext`: no slashes, no `..`, no leading dot, no URL scheme.
 * That is what stops a crafted filename from writing outside `images/`.
 */
export function safeImagePath(filename: string): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.(jpg|jpeg|png|webp|gif|avif)$/.test(filename)) {
    return null;
  }
  return `${bucketDir()}/${filename}`;
}

function isImageName(name: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(name);
}

function toMediaItem(file: GitHubContent): MediaItem | null {
  const path = safeImagePath(file.path.split("/").pop() ?? "");
  if (!path || file.type !== "file" || !isImageName(file.name)) return null;
  return {
    path,
    filename: file.name,
    sha: file.sha,
    size: file.size,
    url: rawUrl(path),
  };
}

/** Every image in the configured directory, newest first. Missing directory ⇒ empty library. */
export async function listImages(): Promise<MediaItem[]> {
  const cfg = config();
  if (!cfg) return [];

  const files = await github<GitHubContent[]>(
    `${contentsPath(cfg.owner, cfg.repo, cfg.dir)}?ref=${encodeURIComponent(cfg.branch)}`,
    {},
    { allowMissing: true },
  );
  if (!files) return [];

  return files
    .map(toMediaItem)
    .filter((item): item is MediaItem => item !== null)
    .sort((a, b) => b.filename.localeCompare(a.filename));
}

/**
 * Writes an image, creating it when new or replacing in place when a filename
 * is supplied. Returns the resulting asset.
 *
 * The filename is ours, not the caller's: new uploads get a uuid, and
 * replacements keep the existing name (and therefore the URL, so a cover image
 * already referenced by a project keeps working after an edit).
 */
export async function putImage(input: {
  content: string;
  contentType: AllowedImageType;
  filename?: string;
  sha?: string;
}): Promise<MediaItem> {
  const cfg = config();
  if (!cfg) throw new BucketError("بخش رسانه پیکربندی نشده است.", 503);

  const extension = EXTENSION_BY_TYPE[input.contentType];
  const filename = input.filename
    ? safeImagePath(input.filename)?.split("/").pop()
    : `${crypto.randomUUID()}.${extension}`;
  if (!filename) throw new BucketError("نام فایل نامعتبر است.", 400);

  const path = safeImagePath(filename);
  if (!path) throw new BucketError("نام فایل نامعتبر است.", 400);

  const result = await github<{ content: GitHubContent }>(
    contentsPath(cfg.owner, cfg.repo, path),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.filename ? `Update image ${filename}` : `Upload image ${filename}`,
        branch: cfg.branch,
        content: input.content,
        ...(input.sha ? { sha: input.sha } : {}),
      }),
    },
  );

  const item = result ? toMediaItem(result.content) : null;
  if (!item) throw new BucketError("پاسخ نامعتبر از GitHub.", 502);
  return item;
}

/** Removes an image. The sha is GitHub's optimistic-concurrency guard. */
export async function deleteImage(input: {
  filename: string;
  sha: string;
}): Promise<void> {
  const cfg = config();
  if (!cfg) throw new BucketError("بخش رسانه پیکربندی نشده است.", 503);

  const path = safeImagePath(input.filename);
  if (!path) throw new BucketError("نام فایل نامعتبر است.", 400);

  await github<void>(
    contentsPath(cfg.owner, cfg.repo, path),
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Delete image ${path.split("/").pop()}`,
        branch: cfg.branch,
        sha: input.sha,
      }),
    },
  );
}
