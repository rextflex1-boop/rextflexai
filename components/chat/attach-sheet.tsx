"use client";

import { CameraIcon, FolderIcon, GlobeIcon, ImageIcon, LightbulbIcon } from "lucide-react";
import { useRef } from "react";
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * "Add to chat" sheet — a Camera/Photos/Files picker plus the Web search and
 * Thinking toggles, all in one place before you're mid-message. Own layout
 * (a plain dialog, not a native bottom sheet) and own visuals — not copying
 * any other app's exact chrome, just the same "everything in one menu" idea.
 */
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
  const filesInputRef = useRef<HTMLInputElement | null>(null);

  const handlePicked = (fileList: FileList | null) => {
    if (fileList && fileList.length > 0) attachments.add(fileList);
    onOpenChange(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to chat</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <PickerTile
            icon={<CameraIcon className="size-5" />}
            label="Camera"
            onClick={() => cameraInputRef.current?.click()}
          />
          <PickerTile
            icon={<ImageIcon className="size-5" />}
            label="Photos"
            onClick={() => photosInputRef.current?.click()}
          />
          <PickerTile
            icon={<FolderIcon className="size-5" />}
            label="Files"
            onClick={() => filesInputRef.current?.click()}
          />
        </div>

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
        onChange={(event) => handlePicked(event.currentTarget.files)}
        ref={cameraInputRef}
        type="file"
      />
      <input
        accept="image/*"
        className="hidden"
        multiple
        onChange={(event) => handlePicked(event.currentTarget.files)}
        ref={photosInputRef}
        type="file"
      />
      <input
        className="hidden"
        multiple
        onChange={(event) => handlePicked(event.currentTarget.files)}
        ref={filesInputRef}
        type="file"
      />
    </Dialog>
  );
}

function PickerTile({
  icon,
  label,
  onClick,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      className="flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors hover:bg-muted"
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
