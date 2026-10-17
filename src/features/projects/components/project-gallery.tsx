"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import type { ProjectGalleryImage } from "@/lib/db/projects";

/**
 * Case-study gallery: a grid of what the work actually looked like.
 *
 * Clicking a frame opens it in a native `<dialog>` — full size, backdrop
 * click and Escape to dismiss, keyboard focus handled by the dialog itself.
 * No lightbox dependency: the whole thing is a few lines of behaviour around a
 * browser primitive that already does the accessibility work.
 *
 * Images are only fetched when the owner opens them; the grid itself is
 * server-rendered markup plus this small enhancement, so a visitor who never
 * clicks still pays for thumbnails alone.
 */
export function ProjectGallery({ images }: { images: ProjectGalleryImage[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<ProjectGalleryImage | null>(null);

  // A dialog opened by the browser's find-in-page or restored from bfcache can
  // still be open after a back navigation; closing on unmount keeps that from
  // stranding an overlay over the page.
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => dialog?.close();
  }, []);

  if (images.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {images.map((image, index) => (
          <li key={image.id}>
            <button
              type="button"
              onClick={() => {
                setActive(image);
                dialogRef.current?.showModal();
              }}
              className="group border-border/40 relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border transition-colors hover:border-primary/40"
            >
              <Image
                src={image.url}
                alt=""
                width={1600}
                height={1000}
                sizes="(min-width: 640px) 380px, 100vw"
                loading={index === 0 ? "eager" : "lazy"}
                className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          // A click that lands on the backdrop means "dismiss"; clicks inside
          // the figure are the visitor panning the image.
          if (event.target === dialogRef.current) dialogRef.current.close();
        }}
        className="backdrop:bg-background/80 m-0 h-full max-h-none w-full max-w-none bg-transparent p-4 backdrop:backdrop-blur-sm"
      >
        <figure className="flex h-full flex-col items-center justify-center gap-3">
          {active && (
            <Image
              src={active.url}
              alt=""
              width={2400}
              height={1500}
              // The full-size view is the one place the raw asset is worth
              // fetching: the grid thumbnails stay optimised, this one does not.
              unoptimized
              className="max-h-full w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-4 py-1.5 text-sm transition-colors"
          >
            بستن
          </button>
        </figure>
      </dialog>
    </>
  );
}