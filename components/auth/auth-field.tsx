import type { LucideIcon } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";

/** A labeled input with a small leading icon — matches the reference design's
 * "Email Address" / "Password" fields (icon + label above a rounded input). */
export function AuthField({
  icon: Icon,
  label,
  ...inputProps
}: {
  readonly icon: LucideIcon;
  readonly label: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 font-medium text-foreground/80 text-xs">
        <Icon className="size-3.5" />
        {label}
      </span>
      <Input className="h-11 rounded-xl bg-muted/60" {...inputProps} />
    </label>
  );
}
