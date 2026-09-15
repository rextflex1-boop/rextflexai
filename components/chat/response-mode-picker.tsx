"use client";

import { CheckIcon, ChevronDownIcon, GaugeIcon, BrainIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ResponseMode = "fast" | "balanced" | "deep";

type ResponseModeInfo = {
  readonly id: ResponseMode;
  readonly name: string;
  readonly description: string;
  readonly icon: typeof GaugeIcon;
};

export const RESPONSE_MODES: readonly ResponseModeInfo[] = [
  {
    id: "fast",
    name: "Fast",
    description: "Quick replies for simple, everyday questions.",
    icon: GaugeIcon,
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Best default for normal chat, writing, and coding.",
    icon: SparklesIcon,
  },
  {
    id: "deep",
    name: "Deep",
    description: "More deliberate reasoning for harder problems.",
    icon: BrainIcon,
  },
] as const;

export function ResponseModePickerButton({
  onChange,
  value,
}: {
  readonly onChange: (mode: ResponseMode) => void;
  readonly value: ResponseMode;
}) {
  const [open, setOpen] = useState(false);
  const current = RESPONSE_MODES.find((mode) => mode.id === value) ?? RESPONSE_MODES[1];

  return (
    <>
      <Button
        className="h-8 gap-1 rounded-full px-3 text-xs"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        {current.name}
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </Button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Response mode</DialogTitle>
          </DialogHeader>
          <div className="-mx-1 flex flex-col">
            {RESPONSE_MODES.map((mode) => {
              const selected = mode.id === value;
              const Icon = mode.icon;

              return (
                <button
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors",
                    selected ? "bg-primary/5" : "hover:bg-muted",
                  )}
                  key={mode.id}
                  onClick={() => {
                    onChange(mode.id);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted",
                        selected && "bg-primary/10 text-primary",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <span className={cn("font-semibold text-sm", selected && "text-primary")}>
                        {mode.name}
                      </span>
                      <p
                        className={cn(
                          "mt-0.5 text-xs",
                          selected ? "text-primary/80" : "text-muted-foreground",
                        )}
                      >
                        {mode.description}
                      </p>
                    </div>
                  </div>
                  {selected ? <CheckIcon className="size-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
