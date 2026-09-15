import type { ReactNode } from "react";

/**
 * Shared shell for the sign-in / sign-up cards — a rounded surface with a
 * soft glowing ring, inspired by the reference login-form animation
 * (dark glass card, glowing border) but using the app's own theme tokens
 * so it still looks right in both light and dark mode.
 */
export function AuthCard({ children }: { readonly children: ReactNode }) {
  return (
    <div className="relative w-full max-w-sm">
      {/* Glow ring behind the card — a soft blurred halo in the primary color */}
      <div
        aria-hidden
        className="-inset-1 absolute rounded-[28px] bg-primary/25 opacity-60 blur-xl"
      />
      <div className="animate-auth-card relative rounded-3xl border bg-card/95 p-7 shadow-xl ring-1 ring-primary/15 backdrop-blur-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
