"use client";

import { LockIcon, MailIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({ email, name, password });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message ?? "Sign up failed.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <AuthCard>
        <div className="mb-6 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">Create your account</h1>
          <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-primary" />
          <p className="mt-3 text-muted-foreground text-sm">Join RextFlex Ai — it only takes a minute</p>
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
            autoComplete="name"
            icon={UserIcon}
            label="Name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            required
            value={name}
          />
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
            autoComplete="new-password"
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
            {loading ? "Creating account…" : "Sign up"}
          </Button>
        </form>

        <p className="mt-6 text-center text-muted-foreground text-sm">
          Already have an account?{" "}
          <a className="font-medium text-foreground underline underline-offset-2" href="/sign-in">
            Sign in
          </a>
        </p>
      </AuthCard>
    </main>
  );
}
