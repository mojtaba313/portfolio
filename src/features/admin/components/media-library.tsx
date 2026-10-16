"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { fa } from "@/content/fa";
import {
  deleteMediaAction,
  setProjectCoverAction,
  uploadMediaAction,
  type MediaActionResult,
} from "@/features/admin/actions-media";
import {
  formatImageSize,
  prepareImage,
} from "@/features/admin/components/image-prepare";
import type { MediaItem } from "@/lib/media/github-bucket";

/**
 * The media library: the owner-facing face of the GitHub bucket.
 *
 * Two things happen here that the server cannot do for us, and both exist for
 * the same reason — this deploys to Vercel, where a function body is capped at
 * a few megabytes:
 *
 *  1. **Images are downscaled and re-encoded in the browser** before upload.
 *     A 6 MB phone photo becomes ~300 KB, which keeps the request inside the
 *     function limit, keeps the repository history small, and makes the cover
 *     render fast. Animated formats (GIF, AVIF) are passed through untouched,
 *     because re-encoding would flatten them to a single frame.
 *  2. **The file is read here and sent as base64.** The token is not involved
 *     at any point on this side of the wire.
 */

export function MediaLibrary({
  initialItems,
  projectId,
}: {
  initialItems: MediaItem[];
  /** When present the library doubles as a cover picker for this project. */
  projectId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pending, startTransition] = useTransition();
  const [busyFile, setBusyFile] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [replacing, setReplacing] = useState<MediaItem | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setReplacing(null);
    setBusyFile("");
    setMessage("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function apply(result: MediaActionResult, onSuccess?: (item?: MediaItem) => void) {
    if (!result.ok) {
      setError(result.error ?? fa.admin.mediaGenericError);
      return false;
    }
    setError("");
    onSuccess?.(result.item);
    return true;
  }

  async function upload(file: File) {
    setError("");
    setMessage(fa.admin.mediaCompressing);
    setBusyFile(file.name);

    try {
      const prepared = await prepareImage(file);
      setMessage(fa.admin.mediaUploading);

      const target = replacing ?? undefined;
      const result = await uploadMediaAction({
        content: prepared.content,
        contentType: prepared.contentType,
        ...(target
          ? { filename: target.filename, sha: target.sha }
          : {}),
      });

      if (!apply(result)) return;

      setMessage(
        replacing ? fa.admin.mediaReplace + " ✓" : fa.admin.mediaUpload + " ✓",
      );

      // Replace keeps the same URL, so the item is updated in place; a new
      // upload is prepended so it is visible without a refetch.
      setItems((current) => {
        const incoming = result.item;
        if (!incoming) return current;
        return replacing
          ? current.map((item) => (item.path === incoming.path ? incoming : item))
          : [incoming, ...current];
      });

      reset();
      // `reset()` clears the banner we just set, so restore the outcome.
      setMessage(replacing ? fa.admin.mediaReplace : fa.admin.mediaUpload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fa.admin.mediaGenericError);
      setBusyFile("");
    }
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void upload(file);
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  function remove(item: MediaItem) {
    if (!window.confirm(`تصویر «${item.filename}» حذف شود؟`)) return;
    setError("");
    startTransition(async () => {
      const result = await deleteMediaAction({
        filename: item.filename,
        sha: item.sha,
      });
      if (!apply(result)) return;
      setItems((current) => current.filter((entry) => entry.path !== item.path));
    });
  }

  function setCover(item: MediaItem) {
    if (!projectId) return;
    setError("");
    startTransition(async () => {
      const result = await setProjectCoverAction({
        projectId,
        url: item.url,
      });
      if (!apply(result)) return;
      setMessage(fa.admin.mediaCoverSet);
      // Client navigation: the editor re-renders with the new cover already in
      // its defaults, which is the confirmation the owner is looking for.
      router.push(`/admin/projects/${projectId}`);
      router.refresh();
    });
  }

  /**
   * Copies the URL, with two fallbacks that matter in practice: the async
   * Clipboard API is unavailable on insecure origins and in some embedded
   * browsers, and `execCommand` covers those, and if even that fails the URL
   * is surfaced so the owner can copy it by hand rather than losing it.
   */
  async function copyUrl(item: MediaItem) {
    setError("");

    try {
      await navigator.clipboard.writeText(item.url);
      setMessage(fa.admin.mediaCopied);
      return;
    } catch {
      // Fall through to the legacy path.
    }

    const field = document.createElement("textarea");
    field.value = item.url;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(field);

    setMessage(copied ? fa.admin.mediaCopied : item.url);
  }

  return (
    <div className="space-y-6">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border/70"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          onChange={onPick}
          className="sr-only"
        />
        <span className="text-sm font-medium">
          {replacing
            ? `${fa.admin.mediaReplace}: ${replacing.filename}`
            : fa.admin.mediaDrop}
        </span>
        <span className="text-muted-foreground text-xs">
          {fa.admin.mediaUploadHint}
        </span>
      </label>

      {replacing && (
        <button
          type="button"
          onClick={reset}
          className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-3 py-1 text-xs transition-colors"
        >
          {fa.admin.mediaReplaceCancel}
        </button>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {message && !error && (
        <p role="status" className="text-muted-foreground text-sm">
          {message}
          {busyFile ? ` — ${busyFile}` : ""}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{fa.admin.mediaEmpty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.path}
              className="overflow-hidden rounded-2xl border border-border/70 bg-white/[0.02]"
            >
              {/* Plain <img>: these are admin-sized thumbnails of arbitrary
                  remote URLs, and next/image would add an optimisation hop for
                  a grid that is only ever seen by the owner. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.filename}
                loading="lazy"
                className="aspect-[4/3] w-full bg-black/20 object-contain"
              />
              <div className="space-y-2 p-3">
                <p
                  dir="ltr"
                  title={item.filename}
                  className="truncate text-left font-mono text-[11px]"
                >
                  {item.filename}
                </p>
                <p className="text-muted-foreground text-left text-[11px]">
                  {formatImageSize(item.size)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReplacing(item)}
                    disabled={pending}
                    className="rounded-full border border-border/70 px-2.5 py-0.5 text-[11px] transition-colors hover:border-primary/50"
                  >
                    {fa.admin.mediaReplace}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyUrl(item)}
                    className="rounded-full border border-border/70 px-2.5 py-0.5 text-[11px] transition-colors hover:border-primary/50"
                  >
                    {fa.admin.mediaCopyUrl}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={pending}
                    className="rounded-full border border-destructive/40 px-2.5 py-0.5 text-[11px] text-destructive transition-colors"
                  >
                    {fa.admin.mediaDelete}
                  </button>
                </div>
                {projectId && (
                  <button
                    type="button"
                    onClick={() => setCover(item)}
                    disabled={pending}
                    className="bg-primary text-primary-foreground w-full rounded-full px-3 py-1 text-[11px] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {fa.admin.mediaSetCover}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
