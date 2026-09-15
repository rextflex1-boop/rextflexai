"use client";

import { LockIcon, MailIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await authClient.signIn.email({ email, password });

    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "Sign in failed.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <AuthCard>
        <div className="mb-6 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">Welcome back</h1>
          <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-primary" />
          <p className="mt-3 text-muted-foreground text-sm">Sign in to RextFlex Ai to continue</p>
        </div>

        <Button
          className="h-11 w-full rounded-xl"
          onClick={() => authClient.signIn.social({ callbackURL: "/", provider: "google" })}
          type="button"
          variant="outline"
        >
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-muted-foreground text-xs">
          <div className="h-px flex-1 bg-border" />
          OR
          <div className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthField
            autoComplete="email"
            icon={MailIcon}
            label="Email address"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
          <AuthField
            autoComplete="current-password"
            icon={LockIcon}
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            type="password"
            value={password}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button
            className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-primary/80 font-medium"
            disabled={loading}
            type="submit"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-muted-foreground text-sm">
          Don't have an account?{" "}
          <a className="font-medium text-foreground underline underline-offset-2" href="/sign-up">
            Sign up
          </a>
        </p>
      </AuthCard>
    </main>
  );
}
