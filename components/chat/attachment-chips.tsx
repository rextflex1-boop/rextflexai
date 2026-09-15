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
          className="rfx-attachment-chip flex max-w-[15rem] min-w-0 items-center gap-2 rounded-xl border bg-muted/50 py-1.5 pr-1.5 pl-2.5 text-xs"
          key={file.id}
        >
          {file.mediaType?.startsWith("image/") && file.url ? (
            <img alt="" className="size-9 shrink-0 rounded-lg object-cover" src={file.url} />
          ) : (
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium">{file.filename ?? "File"}</span>
            <span className="block text-muted-foreground">Ready</span>
          </div>
          <button
            aria-label="Remove attachment"
            className="shrink-0 rounded-full p-1 hover:bg-muted"
            onClick={() => attachments.remove(file.id)}
            type="button"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
