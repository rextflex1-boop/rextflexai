"use client";

import { EyeIcon, EyeOffIcon, LockKeyholeIcon, MailIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="rf-auth-page">
      <div className="rf-auth-shell">
        <div className="rf-auth-brand">
          <div className="rf-logo">R</div>
          <div><strong>RextFlex AI</strong><span>Premium AI workspace</span></div>
        </div>

        <section className="rf-auth-card">
          <div className="mb-6">
            <h1 className="rf-auth-title">Welcome back</h1>
            <p className="rf-auth-subtitle">Sign in to continue to your AI workspace.</p>
          </div>

          <div className="rf-auth-form">
            <button
              className="rf-google flex w-full items-center justify-center gap-2 font-medium"
              onClick={() => authClient.signIn.social({ callbackURL: "/", provider: "google" })}
              type="button"
            >
              <span className="grid size-5 place-items-center rounded-full bg-white text-[10px] font-black text-black">G</span>
              Continue with Google
            </button>

            <div className="rf-divider"><span>or continue with email</span></div>

            <form className="rf-auth-form" onSubmit={handleSubmit}>
              <label className="rf-field">
                <span className="sr-only">Email</span>
                <MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email address"
                  required
                  type="email"
                  value={email}
                />
              </label>

              <label className="rf-field">
                <span className="sr-only">Password</span>
                <LockKeyholeIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  style={{ paddingLeft: 40, paddingRight: 48 }}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="rf-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </label>

              {error ? <p className="rf-auth-error">{error}</p> : null}

              <button className="rf-primary-btn" disabled={loading} type="submit">
                {loading ? <span className="inline-flex items-center gap-2"><span className="rf-thinking-orbit" />Signing in…</span> : "Sign in to RextFlex AI"}
              </button>
            </form>
          </div>

          <div className="rf-auth-footer">
            Don&apos;t have an account? <a className="rf-auth-link" href="/sign-up">Create account</a>
          </div>
        </section>

        <p className="mt-4 text-center text-[10px] uppercase tracking-[.18em] text-muted-foreground">
          <SparklesIcon className="mr-1 inline size-3" /> Secure authentication • RextFlex AI
        </p>
      </div>
    </main>
  );
}
