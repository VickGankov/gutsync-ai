// Plain server-rendered HTML for the public pages (landing, blog). No JavaScript needed to read them, so search
// engines see real text. The app itself stays a client-rendered SPA.

export const SITE_NAME = "Triggerplate";
export const SUPPORT_EMAIL = "support@triggerplate.com";

export function siteUrl(): string {
  return (process.env.APP_BASE_URL || "https://triggerplate.com").replace(/\/+$/, "");
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface PageOpts {
  title: string;
  description: string;
  path: string; // e.g. "/blog/some-post"
  body: string; // trusted HTML
  jsonLd?: object[];
  ogType?: "website" | "article";
  head?: string; // extra trusted head HTML
}

const CSS = `
:root{--bg:#fbfaf6;--fg:#23302a;--muted:#5d6b63;--brand:#1d2128;--brand-d:#1d2128;--on-brand:#fff;--volt:#d4f53c;--card:#fff;--line:#e5e3da}
@media (prefers-color-scheme:dark){:root{--bg:#161b18;--fg:#e8ede9;--muted:#a3b0a8;--brand:#d4f53c;--brand-d:#d4f53c;--on-brand:#1d2128;--card:#1e2521;--line:#2e3832}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;overflow-wrap:break-word;background:var(--bg);color:var(--fg);font:17px/1.65 "Plus Jakarta Sans",system-ui,-apple-system,Segoe UI,sans-serif}
a{color:var(--brand-d)}h1,h2,h3{font-family:"DM Serif Display",Georgia,serif;font-weight:400;line-height:1.2;margin:1.6em 0 .5em}
h1{font-size:2.3rem;margin-top:.4em}h2{font-size:1.6rem}h3{font-size:1.2rem}
.wrap{max-width:720px;margin:0 auto;padding:0 20px}.wide{max-width:1000px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--line)}header.site .wide{display:flex;align-items:center;justify-content:space-between;height:60px}
.logo{font-family:"DM Serif Display",Georgia,serif;font-size:1.4rem;color:var(--fg);text-decoration:none}
nav a{margin-left:18px;color:var(--muted);text-decoration:none;font-size:.95rem}nav a:hover{color:var(--fg)}
.btn{display:inline-block;background:var(--brand);color:var(--on-brand)!important;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:600}
.btn:hover{opacity:.88}.btn.ghost{background:transparent;color:var(--brand-d)!important;border:1px solid var(--line)}
.hero{padding:56px 0 32px;text-align:center}.hero p.lead{font-size:1.2rem;color:var(--muted);max-width:620px;margin:0 auto 24px}
.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin:36px 0}
.shots figure{margin:0;text-align:center}.shots img{width:100%;max-width:260px;height:auto;border-radius:16px;border:1px solid var(--line)}
.shots figcaption{font-size:.9rem;color:var(--muted);margin-top:8px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px}.card h3{margin-top:0}
.price{font-family:"DM Serif Display",Georgia,serif;font-size:2rem}
.note{font-size:.9rem;color:var(--muted)}.meta{color:var(--muted);font-size:.9rem}
.callout{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:12px;padding:16px 20px;margin:28px 0}
footer.site{border-top:1px solid var(--line);margin-top:64px;padding:28px 0 48px;color:var(--muted);font-size:.9rem}
footer.site .links{display:flex;flex-wrap:wrap;gap:6px 16px}footer.site a{color:var(--muted)}
ul.posts{list-style:none;padding:0}ul.posts li{padding:18px 0;border-bottom:1px solid var(--line)}ul.posts a.t{font-family:"DM Serif Display",Georgia,serif;font-size:1.3rem;text-decoration:none}
.sources li{margin:.3em 0;font-size:.95rem}
@media (max-width:600px){h1{font-size:1.9rem}.hero{padding-top:36px}nav a{margin-left:12px}}
`;

export function render(o: PageOpts): string {
  const url = siteUrl() + o.path;
  const ld = (o.jsonLd ?? []).map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="${o.ogType ?? "website"}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${siteUrl()}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1d2128">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
${o.head ?? ""}
${ld}
</head>
<body>
<header class="site"><div class="wide">
<a class="logo" href="/">Triggerplate</a>
<nav><a href="/blog">Blog</a><a href="/auth">Sign in</a></nav>
</div></header>
${o.body}
<footer class="site"><div class="wide">
<p class="links"><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refunds">Refunds</a><a href="/disclaimer">Disclaimer</a><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
<p>Triggerplate is a logging and pattern-spotting tool. It does not diagnose, treat, or give medical advice. Talk to a doctor or registered dietitian about your symptoms and before changing your diet.</p>
</div></footer>
</body>
</html>`;
}
