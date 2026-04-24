import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function useResetToken() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") ?? "";
  }, []);
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const token = useResetToken();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const resetPassword = trpc.auth.resetPassword.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await resetPassword.mutateAsync({ token, newPassword: password });
      setDone(true);
      setTimeout(() => setLocation("/auth"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sage-light/20 to-coral-light/20 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2 text-center">Choose a new password</h1>
        <p className="text-center text-muted-foreground mb-6 text-sm">
          Your new password will be used on your next sign in.
        </p>

        {done ? (
          <p className="text-sm text-center text-muted-foreground">
            Password reset successful. Redirecting to sign in...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Saving..." : "Reset password"}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/auth" className="text-primary text-sm font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
