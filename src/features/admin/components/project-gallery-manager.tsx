"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { fa } from "@/content/fa";
import {
  addProjectImageAction,
  moveProjectImageAction,
  removeProjectImageAction,
} from "@/features/admin/actions-projects";

/**
 * Gallery management inside the project editor.
 *
 * Images are appended and reordered through their own actions rather than
 * through the project form: a gallery can change without touching the rest of
 * the project, and each change is a small request the owner sees land
 * immediately instead of a save they have to remember.
 *
 * The image itself comes from the media library (or a pasted URL) — the
 * uploader lives in one place, and this component deliberately does not grow a
 * second one.
 */
export function ProjectGalleryManager({
  projectId,
  images,
}: {
  projectId: string;
  images: { id: string; url: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [pasted, setPasted] = useState("");

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.error ?? fa.admin.mediaGenericError);
        return;
      }
      // The actions refresh the project caches; re-reading the editor is what
      // makes the new order show up where the owner is looking.
      router.refresh();
    });
  }

  return (
    <section className="border-border/70 rounded-2xl border p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          {fa.admin.gallery}
          <span className="text-muted-foreground ms-2 font-normal text-xs">
            {images.length.toLocaleString("fa-IR")}
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/media?project=${projectId}&target=gallery`}
            className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-3 py-1 text-xs transition-colors hover:border-primary/50"
          >
            {fa.admin.galleryFromLibrary}
          </Link>
        </div>
      </header>

      {/* Escape hatch for a project image that is not in the bucket — a local
          /public asset, say — without opening the library. */}
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const url = pasted.trim();
          if (!url) return;
          setPasted("");
          run(() => addProjectImageAction({ projectId, url }));
        }}
      >
        <input
          type="url"
          dir="ltr"
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder="https://…"
          className="border-border/70 bg-white/[0.03] focus:border-primary/60 h-10 min-w-56 flex-1 rounded-xl border px-3 font-mono text-xs outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground h-10 rounded-xl px-4 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {fa.admin.galleryAdd}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-destructive mb-3 text-xs">
          {error}
        </p>
      )}

      {images.length === 0 ? (
        <p className="text-muted-foreground text-xs">{fa.admin.galleryEmpty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-xl border border-border/70"
            >
              {/* Admin-sized thumbnails of arbitrary URLs; next/image would
                  add an optimisation hop the owner never asked for. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt=""
                loading="lazy"
                className="aspect-[4/3] w-full bg-black/20 object-contain"
              />
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex gap-1">
                  <button
                    type="button"
                    title={fa.admin.galleryMoveUp}
                    disabled={pending || index === 0}
                    onClick={() =>
                      run(() =>
                        moveProjectImageAction({
                          projectId,
                          imageId: image.id,
                          direction: "up",
                        }),
                      )
                    }
                    className="size-7 rounded-md border border-border/70 text-xs transition-colors hover:border-primary/50 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title={fa.admin.galleryMoveDown}
                    disabled={pending || index === images.length - 1}
                    onClick={() =>
                      run(() =>
                        moveProjectImageAction({
                          projectId,
                          imageId: image.id,
                          direction: "down",
                        }),
                      )
                    }
                    className="size-7 rounded-md border border-border/70 text-xs transition-colors hover:border-primary/50 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  title={fa.admin.galleryRemove}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(fa.admin.galleryRemove)) return;
                    run(() =>
                      removeProjectImageAction({ projectId, imageId: image.id }),
                    );
                  }}
                  className="text-destructive rounded-md border border-destructive/40 px-2 py-1 text-[11px] transition-colors disabled:opacity-40"
                >
                  {fa.admin.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}