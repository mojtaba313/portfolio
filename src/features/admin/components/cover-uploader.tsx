"use client";

import { useRef, useState } from "react";

import { fa } from "@/content/fa";
import { uploadMediaAction } from "@/features/admin/actions-media";
import {
  formatImageSize,
  prepareImage,
} from "@/features/admin/components/image-prepare";

/**
 * The upload button on a project's cover field.
 *
 * Uploads straight from the editor — no trip to the media library — and drops
 * the resulting URL into the field the form already submits, so saving is the
 * same single step whether the cover was typed, picked, or uploaded here. It
 * writes to the input through a ref rather than lifting it into state: the
 * form is uncontrolled (FormData reads the DOM at submit), so mutating the one
 * input keeps the submission path untouched.
 */
export function CoverUploader({
  fieldRef,
}: {
  fieldRef: React.RefObject<HTMLInputElement | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{
    tone: "idle" | "busy" | "error" | "done";
    text: string;
  }>({ tone: "idle", text: "" });

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus({ tone: "busy", text: fa.admin.mediaCompressing });

    void (async () => {
      try {
        const prepared = await prepareImage(file);
        setStatus({ tone: "busy", text: fa.admin.mediaUploading });

        const result = await uploadMediaAction({
          content: prepared.content,
          contentType: prepared.contentType,
        });

        if (!result.ok || !result.item) {
          setStatus({
            tone: "error",
            text: result.error ?? fa.admin.mediaGenericError,
          });
          return;
        }

        // The field is uncontrolled; writing its value is enough for the
        // enclosing form's FormData to pick it up on submit.
        if (fieldRef.current) fieldRef.current.value = result.item.url;
        setStatus({
          tone: "done",
          text: `${fa.admin.mediaUploaded} · ${formatImageSize(prepared.size)}`,
        });
      } catch (cause) {
        setStatus({
          tone: "error",
          text: cause instanceof Error ? cause.message : fa.admin.mediaGenericError,
        });
      } finally {
        // Allow re-picking the same file straight after a failed attempt.
        if (inputRef.current) inputRef.current.value = "";
      }
    })();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        onChange={onPick}
        className="sr-only"
        id="cover-upload"
      />
      <label
        htmlFor="cover-upload"
        className={`flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border/70 px-4 text-sm transition-colors hover:border-primary/50 ${
          status.tone === "busy" ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {fa.admin.mediaUploadCover}
      </label>
      {status.text && (
        <p
          role="status"
          className={`text-[11px] ${
            status.tone === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}

/**
 * Keeps the call site honest about the two-step flow: uploading fills the
 * field, saving persists it. Exported for the form's hint text.
 */
export function CoverUploadHint(): string {
  return `${fa.admin.mediaUploadHintShort} ${fa.admin.save} ${fa.admin.mediaCoverNote}`;
}
