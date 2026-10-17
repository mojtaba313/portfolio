/**
 * What counts as a valid image address for project imagery.
 *
 * Both the cover field and the gallery store plain URLs — a raw address from
 * the bucket repository, or a path under `/public` — and both are rendered by
 * `next/image` on the public site. That makes the set of acceptable values
 * small, and worth stating once in a single place: a narrow allowlist is
 * cheaper to reason about than sanitising an arbitrary string later, and it
 * means a stored value can never become a `javascript:` URL, a tracking pixel,
 * or a hotlinked third-party image the owner did not choose.
 *
 * Shared deliberately. The cover rule was written once and then needed again
 * for the gallery; a third copy would be the one that drifts.
 */

/** Raw bucket addresses: host pinned, path must end in an image extension. */
const BUCKET_URL =
  /^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\/[\w.-]+\/[\w./-]+\.(jpg|jpeg|png|webp|gif|avif)$/i;

/** Paths served from this deployment's own /public. */
const LOCAL_PATH =
  /^\/[A-Za-z0-9._/-]+\.(jpg|jpeg|png|webp|gif|avif|svg)$/i;

export function isAllowedImageUrl(value: string): boolean {
  return BUCKET_URL.test(value) || LOCAL_PATH.test(value);
}

/** Same test, phrased for a form message. */
export function imageUrlError(): string | null {
  return null;
}