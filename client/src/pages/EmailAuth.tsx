import { useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';

const RETURNING_KEY = 'gutsync_returning';

// Real screenshots of the app (sample data), shown on the sign-in page.
const FEATURES = [
  {
    img: '/landing/scan.webp',
    title: 'Snap or type a meal',
    text: 'AI picks out the foods and estimates FODMAP level, protein and fiber. You can fix anything it gets wrong.',
  },
  {
    img: '/landing/triggers.webp',
    title: 'Spot likely triggers',
    text: 'Counts how often symptoms follow certain foods in your own log, and says plainly when the data is too thin.',
  },
  {
    img: '/landing/today.webp',
    title: 'One card for your day',
    text: 'Protein, water and supplements at a glance, with one-tap logging.',
  },
  {
    img: '/landing/weight.webp',
    title: 'See your weight trend',
    text: 'Weigh-ins with a 7-day average, so daily noise stops hiding the direction.',
  },
];

function isReturning(): boolean {
  try {
    return !!localStorage.getItem(RETURNING_KEY) || !!localStorage.getItem('gutsync_onboarded');
  } catch {
    return false;
  }
}

export default function EmailAuth() {
  const returning = useState(() => isReturning())[0];
  const [mode, setMode] = useState<'login' | 'signup'>(returning ? 'login' : 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const formRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const register = trpc.auth.registerEmail.useMutation();
  const login = trpc.auth.loginEmail.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const result =
        mode === 'signup'
          ? await register.mutateAsync({ email, password, name })
          : await login.mutateAsync({ email, password });
      try { localStorage.setItem(RETURNING_KEY, '1'); } catch { /* storage unavailable */ }
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

  const goToForm = (m: 'login' | 'signup') => {
    setMode(m);
    setError('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const form = (
    <div ref={formRef} className="w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-center mb-1">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </h2>
      <p className="text-center text-sm text-muted-foreground mb-6">
        {mode === 'login' ? 'Sign in to keep logging' : 'Free while in beta'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <Input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        )}
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <div className="relative">
          <Input
            type={showPw ? 'text' : 'password'}
            placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="pr-10"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {mode === 'signup' && (
          <Input
            type={showPw ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        )}
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
  );

  const pitch = (
    <section aria-label="What GutSync does" className="w-full">
      {returning && (
        <h2 className="text-lg font-semibold text-center mb-1">What GutSync does</h2>
      )}
      <div className="-mx-4 px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 items-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FEATURES.map(f => (
          <figure key={f.img} className="flex flex-col shrink-0 w-[68%] snap-center">
            <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
              <img src={f.img} alt={f.title} loading="lazy" className="w-full h-auto block" />
            </div>
            <figcaption className="mt-3 px-1">
              <p className="font-semibold text-sm">{f.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{f.text}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-4">
        Swipe to see more. Screenshots use sample data. Estimates from photos and text are approximate.
      </p>
    </section>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-light/20 to-coral-light/20 px-4 py-8">
      <div className="w-full max-w-md mx-auto flex flex-col gap-8">
        <header className="text-center">
          <img src="/favicon.svg" alt="" className="w-16 h-16 mx-auto rounded-2xl shadow-sm" />
          <h1 className="text-3xl font-bold mt-3">GutSync</h1>
          <span className="inline-block mt-1 text-[10px] uppercase tracking-wide font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
            Beta
          </span>
          <p className="mt-3 text-muted-foreground">
            Log your meals and symptoms, and find the foods that don't agree with you.
          </p>
          {!returning && (
            <div className="mt-5 flex flex-col gap-2">
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => goToForm('signup')}>
                Create free account
              </Button>
              <button onClick={() => goToForm('login')} className="text-sm text-primary font-medium hover:underline">
                I already have an account
              </button>
            </div>
          )}
        </header>

        {returning ? (
          <>
            {form}
            {pitch}
          </>
        ) : (
          <>
            {pitch}
            {form}
          </>
        )}

        <footer className="text-center text-xs text-muted-foreground pb-4 space-y-1">
          <p>GutSync is a personal log and pattern finder. It does not diagnose or treat anything and is not medical advice.</p>
          <p>
            <button onClick={() => setLocation('/privacy')} className="underline">Privacy policy</button>
          </p>
        </footer>
      </div>
    </div>
  );
}
