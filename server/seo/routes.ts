import type { Express, Request, Response, NextFunction } from "express";
import { COOKIE_NAME } from "@shared/const";
import { POSTS, findPost } from "./posts";
import { esc, render, siteUrl, SUPPORT_EMAIL } from "./shell";
import { FOODS, FOODS_UPDATED, VERDICT_TEXT, findFood } from "./foods";

function send(res: Response, html: string, status = 200) {
  res.status(status).type("html").set("Cache-Control", "public, max-age=300").send(html);
}

function hasSession(req: Request): boolean {
  return new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=`).test(req.headers.cookie ?? "");
}

// Saves ?invite=CODE the same way the app does (client/src/lib/invite.ts) so ad and Reddit links still work.
const INVITE_SCRIPT = `<script>try{var u=new URL(location.href),c=(u.searchParams.get("invite")||"").trim();if(c){localStorage.setItem("tp_invite",c.slice(0,64));u.searchParams.delete("invite");history.replaceState(null,"",u.pathname+(u.search||"")+u.hash)}}catch(e){}</script>`;

export function landingPage(): string {
  const body = `
<main>
<section class="hero wide">
<h1>Track what you eat, take and feel. Find your possible triggers.</h1>
<p class="lead">Triggerplate logs your meals, symptoms, doses, supplements, weight and labs in one place, then flags the foods that may be setting off your symptoms, using your own data.</p>
<p><a class="btn" href="/auth">Start free</a> &nbsp; <a class="btn ghost" href="/blog">Read the guides</a> &nbsp; <a class="btn ghost" href="/foods">Food checker</a></p>
<p class="note">Free beta. No credit card to start.</p>
</section>

<section class="wide">
<div class="shots">
<figure><img src="/landing/scan.webp" width="520" height="815" loading="lazy" alt="Scanning a meal photo in Triggerplate to list foods and possible hidden ingredients"><figcaption>Snap a meal, confirm what you ate</figcaption></figure>
<figure><img src="/landing/today.webp" width="520" height="920" loading="lazy" alt="Triggerplate Today view showing meals, symptoms, protein and water"><figcaption>See your day, and a 7-day score based on your symptoms</figcaption></figure>
<figure><img src="/landing/triggers.webp" width="520" height="645" loading="lazy" alt="Triggerplate list of possible food triggers with sample-size notes"><figcaption>Possible triggers, with the uncertainty shown</figcaption></figure>
</div>
<p class="note" style="text-align:center">Screenshots show sample data.</p>
</section>

<section class="wide">
<h2>What it does</h2>
<div class="cards">
<div class="card"><h3>Photo food logging</h3><p>Take a photo of your meal. Triggerplate suggests the foods and flags hidden ingredients such as garlic and onion powder. You always confirm what you ate.</p></div>
<div class="card"><h3>One-tap symptoms</h3><p>Log bloating, pain, nausea, fatigue and more in a tap, with severity and time.</p></div>
<div class="card"><h3>Honest trigger spotting</h3><p>A food is only flagged as a <em>possible</em> trigger after it has appeared in at least five meals over four days. Foods you eat constantly are marked "too common to tell apart".</p></div>
<div class="card"><h3>Reintroduction tests</h3><p>Confirm a suspect with a guided three-day challenge. Only a completed test can mark a trigger as matching your result.</p></div>
<div class="card"><h3>Your whole protocol</h3><p>Doses on any schedule, including weekdays only or 5 days on and 2 off, with injection-site rotation and a vial-mix calculator. Plus supplements, weight, strength, protein, water and lab results on one timeline.</p></div>
<div class="card"><h3>Private by design</h3><p>We do not sell your data or use your health information for advertising. Delete your account any time.</p></div>
</div>
</section>

<section class="wrap" id="privacy">
<h2>Your health data stays yours</h2>
<p>What you log about your body and your protocol is sensitive. Here is exactly how Triggerplate treats it:</p>
<ul>
<li><b>Never sold, never used for ads.</b> No advertising trackers, and no sharing with third parties for their own purposes.</li>
<li><b>Doses stay out of the AI.</b> Your dose log, schedules, injection sites and notes are never sent to the AI service. Only the meal photos, typed meals and lab reports you choose to scan are, so they can be read.</li>
<li><b>Nothing on your lock screen.</b> Reminders never name anything you take.</li>
<li><b>You are in control.</b> Export everything, wipe just your dose log, or delete your whole account from inside the app.</li>
</ul>
<p class="note">Read the full <a href="/health-data-privacy">consumer health data policy</a> and <a href="/privacy">privacy policy</a>, including the hosting and database providers that store your data.</p>
</section>

<section class="wide">
<h2>Pricing</h2>
<div class="cards">
<div class="card"><h3>Free</h3><p class="price">$0</p><p>Meal and symptom logging, trigger spotting, 10 scans a day.</p></div>
<div class="card"><h3>Premium</h3><p class="price">$10<span class="note"> / month</span></p><p>or $99 / year. 50 scans a day, lab results and the reintroduction protocol.</p><p class="note">Cancel any time. 7-day refund on your first payment.</p></div>
</div>
</section>

<section class="wrap">
<h2>Common questions</h2>
<h3>Who can see what I log?</h3>
<p>Only you, inside your account. We do not sell it or use it for advertising, and your dose log is never sent to the AI. See <a href="#privacy">how we treat your health data</a>.</p>
<h3>Does Triggerplate diagnose anything?</h3>
<p>No. It is a logging and pattern-spotting tool. Talk to a doctor or registered dietitian about symptoms and before changing your diet.</p>
<h3>How does it decide something is a trigger?</h3>
<p>By counting, not guessing. It compares how often symptoms follow a food with how often they follow your other meals, and shows how uncertain that is. Read <a href="/blog/possible-trigger-vs-confirmed-trigger">possible vs confirmed triggers</a>.</p>
<h3>Is it available on my phone?</h3>
<p>Triggerplate is a web app that works in your phone's browser and can be added to your home screen. There is no app-store download.</p>
<h3>Who is behind it?</h3>
<p>Triggerplate is built by one person who tracks his own diet and training with it. Questions: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
<p style="text-align:center;margin-top:32px"><a class="btn" href="/auth">Start free</a></p>
</section>
</main>`;
  return render({
    title: "Triggerplate: food, symptom and protocol tracker",
    description: "Log meals, symptoms, doses, weight and labs in one place and find the foods that may be triggering your symptoms. Free to start.",
    path: "/",
    body,
    head: INVITE_SCRIPT,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebSite", name: "Triggerplate", url: siteUrl() + "/" },
      {
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Triggerplate", applicationCategory: "HealthApplication",
        operatingSystem: "Web", url: siteUrl() + "/",
        offers: [
          { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
          { "@type": "Offer", price: "10", priceCurrency: "USD", name: "Premium monthly" },
          { "@type": "Offer", price: "99", priceCurrency: "USD", name: "Premium annual" },
        ],
      },
    ],
  });
}

export function blogIndexPage(): string {
  const items = POSTS.map(p => `<li><a class="t" href="/blog/${p.slug}">${esc(p.title)}</a><p>${esc(p.description)}</p><p class="meta">${p.published}</p></li>`).join("");
  return render({
    title: "Guides on food triggers, FODMAP reintroduction and symptom diaries | Triggerplate",
    description: "Practical, sourced guides on finding food triggers, running a low-FODMAP reintroduction, and keeping a food and symptom diary.",
    path: "/blog",
    body: `<main class="wrap"><h1>Guides</h1><p class="lead note">Plain-language, sourced guides on finding food triggers. General information only, not medical advice.</p><ul class="posts">${items}</ul></main>`,
  });
}

export function postPage(slug: string): string | null {
  const p = findPost(slug);
  if (!p) return null;
  const sources = p.sources.map(s => `<li><a href="${esc(s.url)}" rel="noopener nofollow">${esc(s.label)}</a></li>`).join("");
  const body = `<main class="wrap"><article>
<p class="meta"><a href="/blog">Guides</a> · ${p.published}</p>
<h1>${esc(p.title)}</h1>
${p.body}
<h2>Sources</h2><ul class="sources">${sources}</ul>
<p class="note">General information, not medical advice. Last updated ${p.published}.</p>
</article></main>`;
  return render({
    title: `${p.title} | Triggerplate`,
    description: p.description,
    path: `/blog/${p.slug}`,
    ogType: "article",
    body,
    jsonLd: [{
      "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.description,
      datePublished: p.published, dateModified: p.published, mainEntityOfPage: `${siteUrl()}/blog/${p.slug}`,
      author: { "@type": "Organization", name: "Triggerplate" }, publisher: { "@type": "Organization", name: "Triggerplate", logo: { "@type": "ImageObject", url: `${siteUrl()}/icon-512.png` } },
    }],
  });
}

const MONASH_APP = { label: "Monash University FODMAP Diet app and website (current serving sizes)", url: "https://www.monashfodmap.com/" };
const FOOD_DISCLAIMER = "General information, not medical advice. This page summarizes how the food is generally classified in published low-FODMAP guidance. It is not Monash University data, and it gives no serving sizes on purpose: the amount decides the result, and the Monash app has current figures. Ask a doctor or registered dietitian before changing your diet.";

export function foodsIndexPage(): string {
  const groups = Array.from(new Set(FOODS.map(f => f.group)));
  const sections = groups.map(g => `<h2>${esc(g)}</h2><ul class="posts">${FOODS.filter(f => f.group === g).map(f => `<li><a class="t" href="/foods/${f.slug}">Is ${esc(f.name.toLowerCase())} low FODMAP?</a><p class="meta">${VERDICT_TEXT[f.verdict].label}</p></li>`).join("")}</ul>`).join("");
  return render({
    title: "Is it low FODMAP? Food checker | Triggerplate",
    description: "Plain-language answers on whether common foods are high or low FODMAP, why, and what people swap them for. Serving size always matters.",
    path: "/foods",
    body: `<main class="wrap"><h1>Is it low FODMAP?</h1><p class="lead note">Quick answers for common foods, in plain language. Serving size matters, so use these as a starting point and check the Monash app for amounts.</p>${sections}
<div class="callout"><p><b>Not sure a food is your problem?</b> Lists only say what is likely. Your own log shows what actually happens to you.</p><p><a class="btn" href="/auth">Start free</a></p></div>
<p class="note">${esc(FOOD_DISCLAIMER)}</p></main>`,
  });
}

export function foodPage(slug: string): string | null {
  const f = findFood(slug);
  if (!f) return null;
  const v = VERDICT_TEXT[f.verdict];
  const answer = f.verdict === "high"
    ? `${f.name} is generally classified as high FODMAP, mainly because of ${f.because}.`
    : f.verdict === "low"
      ? `${f.name} is generally classified as low FODMAP, because ${f.because}.`
      : `${f.name} can be low or high FODMAP depending on the serving, because of ${f.because}.`;
  const swaps = f.swaps?.length ? `<h2>What people use instead</h2><ul>${f.swaps.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const related = FOODS.filter(x => x.slug !== f.slug && x.group === f.group).slice(0, 4);
  const rel = related.length ? `<h2>Other ${esc(f.group.toLowerCase())}</h2><ul>${related.map(x => `<li><a href="/foods/${x.slug}">Is ${esc(x.name.toLowerCase())} low FODMAP?</a></li>`).join("")}</ul>` : "";
  const body = `<main class="wrap"><article>
<p class="meta"><a href="/foods">Food checker</a> · ${esc(f.group)}</p>
<h1>Is ${esc(f.name.toLowerCase())} low FODMAP?</h1>
<div class="callout"><p><b>${esc(v.label)}.</b> ${esc(answer)}</p></div>
<h2>Details</h2><p>${esc(f.note)}</p>
<p>Serving size always matters with FODMAPs. A food that is fine in a small amount can add up with other foods in the same meal, so for exact amounts check the <a href="${MONASH_APP.url}" rel="noopener nofollow">Monash app</a>.</p>
${swaps}
<div class="callout"><p><b>Does it actually bother you?</b> Triggerplate counts how often symptoms follow ${esc(f.name.toLowerCase())} in your own log, and shows a pattern as possible until a clean 3-day test backs it up.</p><p><a class="btn" href="/auth">Start free</a></p></div>
${rel}
<h2>Source</h2><ul class="sources"><li><a href="${MONASH_APP.url}" rel="noopener nofollow">${esc(MONASH_APP.label)}</a></li></ul>
<p class="note">${esc(FOOD_DISCLAIMER)} Last reviewed ${FOODS_UPDATED}.</p>
</article></main>`;
  return render({
    title: `Is ${f.name.toLowerCase()} low FODMAP? | Triggerplate`,
    description: `${answer} Serving size matters.`,
    path: `/foods/${f.slug}`,
    body,
    jsonLd: [{
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: `Is ${f.name.toLowerCase()} low FODMAP?`, acceptedAnswer: { "@type": "Answer", text: `${answer} ${f.note}` } }],
    }],
  });
}

export function notFoundPage(): string {
  return render({
    title: "Page not found | Triggerplate", description: "That page doesn't exist.", path: "/blog",
    body: `<main class="wrap"><h1>Page not found</h1><p>Try the <a href="/blog">guides</a> or go <a href="/">home</a>.</p></main>`,
    head: '<meta name="robots" content="noindex">',
  });
}

export function sitemapXml(): string {
  const urls = [{ loc: "/", d: POSTS[0]?.published }, { loc: "/blog", d: POSTS[0]?.published }, ...POSTS.map(p => ({ loc: `/blog/${p.slug}`, d: p.published })), { loc: "/foods", d: FOODS_UPDATED }, ...FOODS.map(f => ({ loc: `/foods/${f.slug}`, d: FOODS_UPDATED }))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${siteUrl()}${u.loc}</loc>${u.d ? `<lastmod>${u.d}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${siteUrl()}/sitemap.xml\n`;
}

export function registerSeoRoutes(app: Express) {
  // Logged-out visitors get the public landing page. Signed-in users (session cookie) get the app.
  app.get("/", (req: Request, res: Response, next: NextFunction) => {
    if (hasSession(req)) return next();
    send(res, landingPage());
  });
  app.get("/blog", (_req, res) => send(res, blogIndexPage()));
  app.get("/blog/:slug", (req, res) => {
    const html = postPage(req.params.slug);
    if (!html) return send(res, notFoundPage(), 404);
    send(res, html);
  });
  app.get("/foods", (_req, res) => send(res, foodsIndexPage()));
  app.get("/foods/:slug", (req, res) => {
    const html = foodPage(req.params.slug);
    if (!html) return send(res, notFoundPage(), 404);
    send(res, html);
  });
  app.get("/sitemap.xml", (_req, res) => { res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(sitemapXml()); });
  app.get("/robots.txt", (_req, res) => { res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(robotsTxt()); });
}
