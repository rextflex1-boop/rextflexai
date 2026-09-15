"use client";

import { cn } from "@/lib/utils";

export function ThinkingIndicator({
  className,
  label = "RextFlex AI is thinking",
}: {
  readonly className?: string;
  readonly label?: string;
}) {
  return (
    <div
      aria-label={label}
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 rounded-full border bg-background/85 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur", className)}
      role="status"
    >
      <span aria-hidden className="relative flex size-4 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-primary/25 motion-safe:animate-[spin_2.4s_linear_infinite]" />
        <span className="absolute -inset-0.5 rounded-full border border-transparent border-t-primary border-r-primary/40 motion-safe:animate-[spin_1.25s_cubic-bezier(.4,0,.2,1)_infinite]" />
        <span className="size-1.5 rounded-full bg-primary/80 shadow-[0_0_10px_hsl(var(--primary)/.65)] motion-safe:animate-pulse" />
      </span>
      <span>{label}</span>
    </div>
  );
}

export function GeneratingIndicator(props: Omit<React.ComponentProps<typeof ThinkingIndicator>, "label">) {
  return <ThinkingIndicator label="RextFlex AI is generating" {...props} />;
}
