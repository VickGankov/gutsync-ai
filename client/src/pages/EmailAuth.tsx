import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

type AuthMode = "login" | "signup" | "forgot" | "reset";

function readSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

function getInitialMode(): AuthMode {
  const mode = readSearchParams().get("mode");

  if (mode === "signup") return "signup";
  if (mode === "forgot") return "forgot";
  if (mode === "reset") return "reset";
  return "login";
}

export default function EmailAuth() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>(getInitialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetToken, setResetToken] = useState(() => readSearchParams().get("token") ?? "");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const searchParams = useMemo(() => readSearchParams(), []);
  const nextPath = searchParams.get("next") || "/";
  const verificationToken = searchParams.get("verify") ?? "";

  const register = trpc.auth.registerEmail.useMutation();
  const login = trpc.auth.loginEmail.useMutation();
  const requestPasswordReset = trpc.auth.requestPasswordReset.useMutation();
  const resetPassword = trpc.auth.resetPassword.useMutation();
  const requestEmailVerification = trpc.auth.requestEmailVerification.useMutation();
  const verifyEmail = trpc.auth.verifyEmail.useMutation();

  const isSubmitting =
    register.isPending ||
    login.isPending ||
    requestPasswordReset.isPending ||
    resetPassword.isPending ||
    requestEmailVerification.isPending ||
    verifyEmail.isPending;

  useEffect(() => {
    if (!verificationToken) return;

    let cancelled = false;

    verifyEmail
      .mutateAsync({ token: verificationToken })
      .then(() => {
        if (cancelled) return;
        setStatus("Your email has been verified. You can continue signing in.");
        setError("");
        setMode("login");
        if (typeof window !== "undefined") {
          const next = nextPath && nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : "";
          window.history.replaceState({}, "", `/auth${next}`);
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Email verification failed");
      });

    return () => {
      cancelled = true;
    };
  }, [nextPath, verificationToken, verifyEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("");

    try {
      if (mode === "signup") {
        const result = await register.mutateAsync({ email, password, name });
        if (!result.user.emailVerified) {
          setStatus("Account created. A verification link has been logged on the server console.");
        }
        setLocation(nextPath);
        return;
      }

      if (mode === "login") {
        const result = await login.mutateAsync({ email, password });
        if (!result.user.emailVerified) {
          setStatus("Signed in. Please verify your email using the link logged on the server console.");
        }
        setLocation(nextPath);
        return;
      }

      if (mode === "forgot") {
        await requestPasswordReset.mutateAsync({ email });
        setStatus("If an account exists for that email, a reset link has been logged on the server console.");
        setMode("login");
        return;
      }

      const result = await resetPassword.mutateAsync({ token: resetToken, password });
      setStatus(
        result.user.emailVerified
          ? "Password updated. You are now signed in."
          : "Password updated. You are now signed in, but please verify your email."
      );
      setLocation(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    }
  };

  const handleResendVerification = async () => {
    setError("");
    setStatus("");

    if (!email) {
      setError("Enter your email address first.");
      return;
    }

    try {
      await requestEmailVerification.mutateAsync({ email });
      setStatus("If your account exists and is unverified, a verification link has been logged on the server console.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend verification email");
    }
  };

  const title =
    mode === "signup"
      ? "Create your account"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "reset"
          ? "Choose a new password"
          : "Sign in to your account";

  const submitLabel =
    mode === "signup"
      ? "Sign Up"
      : mode === "forgot"
        ? "Send Reset Link"
        : mode === "reset"
          ? "Update Password"
          : "Sign In";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sage-light/20 to-coral-light/20 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">GutSync</h1>
          <p className="text-muted-foreground">{title}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <Input
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          )}

          {mode !== "reset" && (
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          )}

          {mode === "reset" && (
            <Input
              placeholder="Reset token"
              value={resetToken}
              onChange={e => setResetToken(e.target.value)}
              required
            />
          )}

          {mode !== "forgot" && (
            <Input
              type="password"
              placeholder={mode === "reset" ? "New password" : "Password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          )}

          {status && <p className="text-emerald-600 text-sm">{status}</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Loading..." : submitLabel}
          </Button>
        </form>

        {mode === "login" && (
          <div className="space-y-3 text-center">
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
                setStatus("");
              }}
              className="text-sm text-primary font-semibold hover:underline"
            >
              Forgot your password?
            </button>
            <div>
              <button
                type="button"
                onClick={handleResendVerification}
                className="text-sm text-primary font-semibold hover:underline"
              >
                Resend verification email
              </button>
            </div>
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground space-y-2">
          {mode === "login" && (
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setStatus("");
                }}
                className="text-primary font-semibold hover:underline"
              >
                Sign up
              </button>
            </p>
          )}

          {mode === "signup" && (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setStatus("");
                }}
                className="text-primary font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          )}

          {(mode === "forgot" || mode === "reset") && (
            <p>
              Back to{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setStatus("");
                }}
                className="text-primary font-semibold hover:underline"
              >
                sign in
              </button>
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
          Password reset and verification emails are currently stubbed for local development. Check the server console for the generated links and tokens.
        </div>
      </div>
    </div>
  );
}
