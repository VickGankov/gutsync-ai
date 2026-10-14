import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';

export default function EmailAuth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();
  const register = trpc.auth.registerEmail.useMutation();
  const login = trpc.auth.loginEmail.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const result =
        mode === 'signup'
          ? await register.mutateAsync({ email, password, name })
          : await login.mutateAsync({ email, password });
      // Refresh the cached "who am I" before navigating; otherwise the app
      // still thinks we're logged out and bounces back to the sign-in page.
      utils.auth.me.setData(undefined, result.user as any);
      await utils.auth.me.invalidate();
      const next = new URLSearchParams(window.location.search).get('next');
      setLocation(next || '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sage-light/20 to-coral-light/20 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-2 text-center">GutSync</h1>
        <p className="text-center text-muted-foreground mb-8">
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {mode === 'login' && (
            <div className="text-right -mt-1">
              <button
                type="button"
                onClick={() => setLocation('/forgot-password')}
                className="text-xs text-primary font-medium hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={register.isPending || login.isPending}
          >
            {register.isPending || login.isPending ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
              }}
              className="text-primary font-semibold hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
