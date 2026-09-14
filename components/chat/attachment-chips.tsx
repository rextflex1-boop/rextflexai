"use client";

import { FileIcon, XIcon } from "lucide-react";
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input";

export function AttachmentChips() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {attachments.files.map((file) => (
        <div
          className="flex max-w-[10rem] items-center gap-1.5 rounded-md border bg-muted/50 py-1 pr-1 pl-2 text-xs"
          key={file.id}
        >
          {file.mediaType?.startsWith("image/") && file.url ? (
            // biome-ignore lint: quick local preview thumbnail, no next/image needed
            <img alt="" className="size-4 shrink-0 rounded-sm object-cover" src={file.url} />
          ) : (
            <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate">{file.filename ?? "file"}</span>
          <button
            aria-label="Remove attachment"
            className="shrink-0 rounded-sm p-0.5 hover:bg-muted"
            onClick={() => attachments.remove(file.id)}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
