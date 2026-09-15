"use client";

import { FileIcon, LoaderCircleIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input";
import type { FileUIPart } from "ai";

async function optimizeImageBlob(blob: Blob, filename: string) {
  if (blob.size <= 1_200_000 || !blob.type.startsWith("image/") || blob.type === "image/gif" || blob.type === "image/svg+xml") {
    return { blob, filename, mediaType: blob.type };
  }

  try {
    const bitmap = await createImageBitmap(blob);
    const maxDimension = 2048;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return { blob, filename, mediaType: blob.type };
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const compressed = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.84);
    });
    if (!compressed) return { blob, filename, mediaType: blob.type };
    return {
      blob: compressed,
      filename: `${filename.replace(/\.[^.]+$/, "")}.jpg`,
      mediaType: "image/jpeg",
    };
  } catch {
    return { blob, filename, mediaType: blob.type };
  }
}

export function AttachmentChips({
  onUploadingChange,
}: {
  readonly onUploadingChange?: (uploading: boolean) => void;
}) {
  const attachments = usePromptInputAttachments();
  const [states, setStates] = useState<Record<string, "uploading" | "ready" | "error">>({});
  const inFlightRef = useRef(new Set<string>());

  useEffect(() => {
    let active = true;

    const pending = attachments.files.filter(
      (file) => file.url?.startsWith("blob:") && !inFlightRef.current.has(file.id),
    );

    if (pending.length > 0) {
      pending.forEach((file) => inFlightRef.current.add(file.id));
      setStates((prev) => {
        const next = { ...prev };
        for (const file of pending) next[file.id] = "uploading";
        return next;
      });
    }

    onUploadingChange?.(
      Object.values(states).some((state) => state === "uploading") || pending.length > 0,
    );

    void Promise.all(
      pending.map(async (file) => {
        try {
          const response = await fetch(file.url!, { credentials: "include" });
          if (!response.ok) throw new Error("Could not read the selected image.");
          const originalBlob = await response.blob();
          const optimized = await optimizeImageBlob(originalBlob, file.filename ?? "image");
          const formData = new FormData();
          formData.set(
            "file",
            new File([optimized.blob], optimized.filename, {
              type: optimized.mediaType || originalBlob.type || "image/jpeg",
            }),
          );
          const uploadResponse = await fetch("/api/uploads", {
            method: "POST",
            body: formData,
          });
          const result = (await uploadResponse.json()) as {
            error?: string;
            url?: string;
            mediaType?: string;
            fileName?: string;
          };
          if (!uploadResponse.ok || !result.url) {
            throw new Error(result.error ?? "Attachment upload failed.");
          }

          if (!active) return;
          attachments.update(file.id, {
            filename: result.fileName ?? optimized.filename,
            mediaType: result.mediaType ?? optimized.mediaType,
            url: result.url,
          } satisfies Partial<FileUIPart>);
          setStates((prev) => ({ ...prev, [file.id]: "ready" }));
          if (file.url?.startsWith("blob:")) URL.revokeObjectURL(file.url);
        } catch {
          if (!active) return;
          setStates((prev) => ({ ...prev, [file.id]: "error" }));
        } finally {
          inFlightRef.current.delete(file.id);
        }
      }),
    ).finally(() => {
      if (!active) return;
      window.setTimeout(() => {
        const stillUploading = attachments.files.some(
          (file) => states[file.id] === "uploading" || inFlightRef.current.has(file.id),
        );
        onUploadingChange?.(stillUploading);
      }, 0);
    });

    return () => {
      active = false;
    };
  }, [attachments.files, onUploadingChange, states]);

  // Keep parent state accurate when an upload finishes or an item is removed.
  useEffect(() => {
    const uploading = attachments.files.some(
      (file) => states[file.id] === "uploading" || inFlightRef.current.has(file.id),
    );
    onUploadingChange?.(uploading);
  }, [attachments.files, onUploadingChange, states]);

  if (attachments.files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {attachments.files.map((file) => {
        const state = states[file.id] ?? (file.url?.startsWith("http") ? "ready" : "uploading");
        return (
          <div
            className="rfx-attachment-chip flex max-w-[15rem] min-w-0 items-center gap-2 rounded-xl border bg-muted/50 py-1.5 pr-1.5 pl-2.5 text-xs"
            key={file.id}
          >
            {file.mediaType?.startsWith("image/") && file.url ? (
              <img alt="" className="size-9 shrink-0 rounded-lg object-cover" src={file.url} />
            ) : (
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium">{file.filename ?? "Photo"}</span>
              <span className="block text-muted-foreground">
                {state === "uploading" ? "Uploading…" : state === "error" ? "Upload failed" : "Ready"}
              </span>
            </div>
            {state === "uploading" ? (
              <LoaderCircleIcon className="rfx-upload-spinner size-4 shrink-0 text-muted-foreground" />
            ) : state === "error" ? (
              <RotateCcwIcon className="size-4 shrink-0 text-destructive" />
            ) : null}
            <button
              aria-label="Remove attachment"
              className="shrink-0 rounded-full p-1 hover:bg-muted"
              onClick={() => attachments.remove(file.id)}
              type="button"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
