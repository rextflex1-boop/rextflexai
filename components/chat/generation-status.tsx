"use client";

import type { UIMessage } from "ai";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Phase = "answering" | "building" | "searching" | "thinking" | "understanding" | "writing";
type PhaseState = "current" | "done" | "pending";
type PhaseStep = { readonly label: string; readonly phase: Phase; readonly state: PhaseState };

function getPartState(part: unknown): string | undefined {
  if (typeof part !== "object" || part === null || !("state" in part)) return undefined;
  const value = (part as { state?: unknown }).state;
  return typeof value === "string" ? value : undefined;
}

/**
 * Derives a small, safe, high-level progress timeline from the message's
 * actual parts — never the model's real reasoning text, just which kind of
 * step is currently active (search running, files being written, etc.).
 */
function derivePhases(message: UIMessage | undefined, status: string): PhaseStep[] {
  const parts = message?.parts ?? [];
  const hasReasoning = parts.some((part) => part.type === "reasoning");
  const reasoningActive = parts.some((part) => part.type === "reasoning" && getPartState(part) === "streaming");
  const searchPart = parts.find((part) => part.type === "tool-webSearch");
  const searchActive = Boolean(searchPart) && getPartState(searchPart) !== "output-available";
  const writeParts = parts.filter((part) => part.type === "tool-writeFile");
  const writingActive = writeParts.some((part) => getPartState(part) !== "output-available");
  const buildPart = parts.find((part) => part.type === "tool-finishBuild");
  const buildActive = Boolean(buildPart) && getPartState(buildPart) !== "output-available";
  const hasTextStarted = parts.some((part) => part.type === "text" && part.text.length > 0);

  const steps: { label: string; phase: Phase }[] = [{ label: "Understanding your request", phase: "understanding" }];
  if (searchPart) steps.push({ label: "Searching the web", phase: "searching" });
  if (hasReasoning) steps.push({ label: "Thinking", phase: "thinking" });
  if (writeParts.length > 0) steps.push({ label: "Writing files", phase: "writing" });
  if (buildPart) steps.push({ label: "Building your project", phase: "building" });
  steps.push({ label: "Preparing the answer", phase: "answering" });

  let currentIndex = 0;
  if (status === "ready") {
    currentIndex = steps.length;
  } else if (buildActive) {
    currentIndex = steps.findIndex((step) => step.phase === "building");
  } else if (writingActive) {
    currentIndex = steps.findIndex((step) => step.phase === "writing");
  } else if (reasoningActive) {
    currentIndex = steps.findIndex((step) => step.phase === "thinking");
  } else if (searchActive) {
    currentIndex = steps.findIndex((step) => step.phase === "searching");
  } else if (hasTextStarted) {
    currentIndex = steps.findIndex((step) => step.phase === "answering");
  }

  return steps.map((step, index) => ({
    ...step,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "pending",
  }));
}

/**
 * Compact tappable status row shown above the composer while a reply is
 * being generated. Tapping it opens a small timeline of the same safe,
 * high-level steps — never the model's actual hidden reasoning.
 */
export function GenerationStatus({
  message,
  status,
}: {
  readonly message: UIMessage | undefined;
  readonly status: string;
}) {
  const [open, setOpen] = useState(false);

  if (status !== "streaming" && status !== "submitted") return null;

  const phases = derivePhases(message, status);
  const current = phases.find((phase) => phase.state === "current") ?? phases[0];
  if (!current) return null;

  return (
    <>
      <button
        className="mx-auto flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-muted-foreground text-xs backdrop-blur transition-colors hover:text-foreground"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        {current.label}…
      </button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Summary</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col">
            {phases.map((phase, index) => (
              <div className="flex gap-3" key={phase.phase}>
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      phase.state === "done" && "bg-primary",
                      phase.state === "current" && "animate-pulse bg-primary",
                      phase.state === "pending" && "bg-muted-foreground/30",
                    )}
                  />
                  {index < phases.length - 1 && (
                    <span
                      className={cn(
                        "w-px flex-1 bg-border",
                        phase.state === "done" && "bg-primary/40",
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "pb-5 text-sm",
                    phase.state === "pending" && "text-muted-foreground",
                    phase.state === "current" && "font-medium",
                  )}
                >
                  {phase.label}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
