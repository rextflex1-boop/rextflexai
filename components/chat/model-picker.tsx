"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MODEL_TIERS, type ModelTier } from "@/lib/models";
import { cn } from "@/lib/utils";

/**
 * Model picker — a small pill in the composer that opens a flat list of the
 * app's three model tiers (see lib/models.ts for the actual Groq model ids
 * behind each one).
 */
export function ModelPickerButton({
  onChange,
  value,
}: {
  readonly onChange: (tier: ModelTier) => void;
  readonly value: ModelTier;
}) {
  const [open, setOpen] = useState(false);
  const current = MODEL_TIERS.find((tier) => tier.id === value) ?? MODEL_TIERS[1];

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
            <DialogTitle>Select model</DialogTitle>
          </DialogHeader>
          <div className="-mx-1 flex flex-col">
            {MODEL_TIERS.map((tier) => {
              const selected = tier.id === value;
              return (
                <button
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors",
                    selected ? "bg-primary/5" : "hover:bg-muted",
                  )}
                  key={tier.id}
                  onClick={() => {
                    onChange(tier.id);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-semibold text-sm", selected && "text-primary")}>
                        {tier.name}
                      </span>
                      {tier.badge ? (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-medium text-[10px] text-amber-600 dark:text-amber-400">
                          {tier.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className={cn("mt-0.5 text-xs", selected ? "text-primary/80" : "text-muted-foreground")}>
                      {tier.description}
                    </p>
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
