"use client";

import type { UIMessage } from "ai";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GeneratingIndicator } from "./thinking-indicator";

type Phase = "answering" | "searching" | "thinking" | "understanding";
type PhaseState = "current" | "done" | "pending";
type PhaseStep = { readonly label: string; readonly phase: Phase; readonly state: PhaseState };
type UIMessagePart = UIMessage["parts"][number];

function getPartState(part: UIMessagePart | undefined): string | undefined {
  return part && "state" in part && typeof part.state === "string" ? part.state : undefined;
}

function derivePhases(message: UIMessage | undefined, status: string): PhaseStep[] {
  const parts = message?.parts ?? [];
  const hasReasoning = parts.some((part) => part.type === "reasoning");
  const reasoningActive = parts.some((part) => part.type === "reasoning" && getPartState(part) === "streaming");
  const searchPart = parts.find((part) => part.type === "tool-webSearch");
  const searchActive = Boolean(searchPart) && getPartState(searchPart) !== "output-available";
  const hasTextStarted = parts.some((part) => part.type === "text" && part.text.length > 0);

  const steps: { label: string; phase: Phase }[] = [{ label: "Understanding your request", phase: "understanding" }];
  if (searchPart) steps.push({ label: "Searching the web", phase: "searching" });
  if (hasReasoning) steps.push({ label: "Thinking", phase: "thinking" });
  steps.push({ label: "Preparing the answer", phase: "answering" });

  let currentIndex = 0;
  if (status === "ready") currentIndex = steps.length;
  else if (reasoningActive) currentIndex = steps.findIndex((step) => step.phase === "thinking");
  else if (searchActive) currentIndex = steps.findIndex((step) => step.phase === "searching");
  else if (hasTextStarted) currentIndex = steps.findIndex((step) => step.phase === "answering");

  return steps.map((step, index) => ({
    ...step,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "pending",
  }));
}

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
        aria-label={`Generation status: ${current.label}`}
        className="mx-auto flex items-center gap-2 rounded-full border bg-background/80 px-2 py-1 backdrop-blur transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
        type="button"
      >
        <GeneratingIndicator className="border-0 bg-transparent px-1 py-0.5 shadow-none" />
      </button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generation status</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col">
            {phases.map((phase, index) => (
              <div className="flex gap-3" key={phase.phase}>
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      phase.state === "done" && "bg-primary",
                      phase.state === "current" && "motion-safe:animate-pulse bg-primary",
                      phase.state === "pending" && "bg-muted-foreground/30",
                    )}
                  />
                  {index < phases.length - 1 && (
                    <span className={cn("w-px flex-1 bg-border", phase.state === "done" && "bg-primary/40")} />
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
