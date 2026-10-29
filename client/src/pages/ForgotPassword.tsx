import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const forgotPassword = trpc.auth.forgotPassword.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await forgotPassword.mutateAsync({ email });
      setSubmitted(true);
    } catch {
      // The mutation error is rendered below.
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-volt/15 to-sand/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2 text-center">Reset your password</h1>
        <p className="text-center text-muted-foreground mb-6 text-sm">
          Enter your email and we'll send you a reset link.
        </p>

        {submitted ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              If an account exists for that email, a reset link has been sent.
            </p>
            <Link href="/auth" className="text-primary text-sm font-medium hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {forgotPassword.error?.message && (
              <p className="text-red-500 text-sm">{forgotPassword.error.message}</p>
            )}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={forgotPassword.isPending}>
              {forgotPassword.isPending ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
