// Shared layout for the legal pages (terms, privacy, refunds, disclaimer, health data policy).

export const LEGAL_UPDATED = "October 21, 2026";
export const SUPPORT_EMAIL = "support@triggerplate.com";

export interface LegalSection { title: string; body: string[] }

const LINKS: { href: string; label: string }[] = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/health-data-privacy", label: "Consumer Health Data Policy" },
  { href: "/refunds", label: "Refunds & Cancellation" },
  { href: "/disclaimer", label: "Medical Disclaimer" },
];

export default function LegalLayout({ label, title, intro, sections }: {
  label: string; title: string; intro: string; sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <a href="/profile" className="text-sm font-medium text-primary">Back to app</a>

        <section className="mt-6 rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <h1 className="mt-3 text-3xl tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Last updated: {LEGAL_UPDATED}. {intro}</p>
        </section>

        <div className="mt-5 space-y-4">
          {sections.map(({ title: t, body }) => (
            <section key={t} className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
              <h2 className="mb-2 text-base font-semibold">{t}</h2>
              <div className="space-y-2">
                {body.map((p, i) => <p key={i} className="text-sm leading-6 text-muted-foreground">{p}</p>)}
              </div>
            </section>
          ))}
        </div>

        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Legal pages">
          {LINKS.map(l => <a key={l.href} href={l.href} className="underline">{l.label}</a>)}
        </nav>
        <p className="mt-3 pb-6 text-xs text-muted-foreground">Questions: <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      </div>
    </main>
  );
}
