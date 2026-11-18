"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const SignIn = () => {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-up" | "sign-in">("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({
              email: normalizedEmail,
              name: normalizedEmail.split("@")[0] ?? normalizedEmail,
              password,
              callbackURL: "/",
            })
          : await authClient.signIn.email({
              email: normalizedEmail,
              password,
              callbackURL: "/",
            });

      if (result.error) {
        setError(result.error.message || "Authentication failed. Try again.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not connect to the authentication service. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="sign-in">
      <ThemeToggle className="sign-in-theme-toggle" />
      <aside className="google-sign-in">
        <section>
          <Link href="/">
            <Image
              src="/assets/icons/play.png"
              alt="SnapChat Logo"
              width={40}
              height={40}
            />
            <h1>SnapCast</h1>
          </Link>
          <p>
            Create and share your very first <span>SnapCast video</span> in no
            time!
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />

            {error && (
              <div className="auth-feedback error-field" role="alert">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Please wait..."
                : mode === "sign-up"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            className="auth-mode-toggle"
            onClick={() => {
              setMode((current) =>
                current === "sign-up" ? "sign-in" : "sign-up",
              );
              setError(null);
            }}
          >
            {mode === "sign-up"
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>

          <div className="auth-divider">or</div>

          <button
            type="button"
            onClick={async () => {
              return await authClient.signIn.social({
                provider: "google",
              });
            }}
          >
            <Image
              src="/assets/icons/google.svg"
              alt="Google Icon"
              width={22}
              height={22}
            />
            <span>Sign in with Google</span>
          </button>
        </section>
      </aside>
    </main>
  );
};

export default SignIn;