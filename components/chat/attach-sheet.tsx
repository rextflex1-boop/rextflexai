"use client";

import * as Bytescale from "@bytescale/upload-widget";
import { CameraIcon, FolderIcon, GlobeIcon, ImageIcon, LightbulbIcon, LoaderCircleIcon } from "lucide-react";
import { useRef, useState } from "react";
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const IMGBB_UPLOAD_ENDPOINT = "/api/uploads";

export function AttachSheet({
  onOpenChange,
  onThinkingChange,
  onWebSearchChange,
  open,
  thinkingEnabled,
  webSearchEnabled,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly onThinkingChange: (enabled: boolean) => void;
  readonly onWebSearchChange: (enabled: boolean) => void;
  readonly open: boolean;
  readonly thinkingEnabled: boolean;
  readonly webSearchEnabled: boolean;
}) {
  const attachments = usePromptInputAttachments();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const uploadImageToImgBB = async (file: File) => {
    setImageUploadError(null);
    setImageUploading(true);

    try {
      const formData = new FormData();
      formData.set("file", file, file.name);
      const response = await fetch(IMGBB_UPLOAD_ENDPOINT, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string; url?: string; mediaType?: string; fileName?: string }
        | null;

      if (!response.ok || !result?.url) {
        throw new Error(result?.error ?? "Photo upload failed. Please try again.");
      }

      attachments.addRemote({
        filename: result.fileName ?? file.name,
        mediaType: result.mediaType ?? file.type,
        url: result.url,
      });
      onOpenChange(false);
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      setImageUploading(false);
    }
  };

  const handleImagePicked = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (file) void uploadImageToImgBB(file);
  };

  const openBytescaleFiles = async () => {
    onOpenChange(false);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const apiKey = process.env.NEXT_PUBLIC_BYTESCALE_API_KEY;
    if (!apiKey) {
      console.error("NEXT_PUBLIC_BYTESCALE_API_KEY is not configured.");
      return;
    }

    try {
      const files = await Bytescale.UploadWidget.open({
        apiKey,
        layout: "modal",
        maxFileCount: 1,
        maxFileSizeBytes: 50 * 1024 * 1024,
        showFinishButton: true,
      });

      const uploaded = files.map((item) => ({
        filename: item.originalFile?.originalFileName ?? item.filePath.split("/").pop() ?? "uploaded-file",
        mediaType: item.originalFile?.mime,
        url: item.fileUrl,
      }));

      if (uploaded.length > 0) attachments.addRemote(uploaded);
    } catch (error) {
      console.error("Bytescale file upload failed:", error);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to chat</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <PickerTile
            disabled={imageUploading}
            icon={<CameraIcon className="size-5" />}
            label="Camera"
            onClick={() => cameraInputRef.current?.click()}
          />
          <PickerTile
            disabled={imageUploading}
            icon={<ImageIcon className="size-5" />}
            label="Photos"
            onClick={() => photosInputRef.current?.click()}
          />
          <PickerTile
            disabled={imageUploading}
            icon={<FolderIcon className="size-5" />}
            label="Files"
            onClick={() => void openBytescaleFiles()}
          />
        </div>

        {imageUploading ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="rfx-upload-spinner size-4 shrink-0" />
            Uploading photo…
          </div>
        ) : imageUploadError ? (
          <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {imageUploadError}
          </div>
        ) : null}

        <div className="flex flex-col divide-y">
          <ToggleRow
            checked={webSearchEnabled}
            icon={<GlobeIcon className="size-4" />}
            label="Web search"
            onChange={onWebSearchChange}
          />
          <ToggleRow
            checked={thinkingEnabled}
            icon={<LightbulbIcon className="size-4" />}
            label="Thinking"
            onChange={onThinkingChange}
            sublabel="More thorough answers for harder questions"
          />
        </div>
      </DialogContent>

      <input
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={imageUploading}
        onChange={(event) => {
          handleImagePicked(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={cameraInputRef}
        type="file"
      />
      <input
        accept="image/*"
        className="hidden"
        disabled={imageUploading}
        multiple={false}
        onChange={(event) => {
          handleImagePicked(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={photosInputRef}
        type="file"
      />
    </Dialog>
  );
}

function PickerTile({
  disabled,
  icon,
  label,
  onClick,
}: {
  readonly disabled?: boolean;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      className="flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground">
        {icon}
      </span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

function ToggleRow({
  checked,
  icon,
  label,
  onChange,
  sublabel,
}: {
  readonly checked: boolean;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
  readonly sublabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0">
          <span className="block text-sm">{label}</span>
          {sublabel ? <span className="block text-muted-foreground text-xs">{sublabel}</span> : null}
        </div>
      </div>
      <button
        aria-checked={checked}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted",
        )}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
