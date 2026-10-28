import { describe, it, expect, vi } from "vitest";
import { POSTS } from "./seo/posts";
import { landingPage, blogIndexPage, postPage, sitemapXml, robotsTxt, registerSeoRoutes, notFoundPage } from "./seo/routes";

const BANNED = /retatrutide|semaglutide|tirzepatide|bpc-?157|tb-?500|cjc-?1295|ipamorelin|peptide/i;

describe("public pages", () => {
  it("landing page is real HTML with a title, h1, canonical and structured data", () => {
    const h = landingPage();
    expect(h).toContain("<h1>");
    expect(h).toContain('rel="canonical"');
    expect(h).toContain("application/ld+json");
    expect(h).toContain('href="/auth"');
  });
  it("landing page keeps ?invite codes for the app", () => {
    expect(landingPage()).toContain("tp_invite");
  });
  it("every post has a unique slug, a short description, sources and a disclaimer", () => {
    expect(new Set(POSTS.map(p => p.slug)).size).toBe(POSTS.length);
    for (const p of POSTS) {
      expect(p.description.length).toBeLessThanOrEqual(175);
      expect(p.sources.length).toBeGreaterThan(0);
      const h = postPage(p.slug)!;
      expect(h).toContain(`/blog/${p.slug}`);
      expect(h).toContain("not medical advice");
      expect(h).toContain("application/ld+json");
    }
  });
  it("unknown posts do not render", () => {
    expect(postPage("nope")).toBeNull();
    expect(notFoundPage()).toContain("noindex");
  });
  it("keeps drug and peptide names out of public pages", () => {
    const all = [landingPage(), blogIndexPage(), ...POSTS.map(p => postPage(p.slug)!)].join("\n");
    expect(all).not.toMatch(BANNED);
  });
  it("sitemap lists the landing, blog and every post; robots points to it and hides the API", () => {
    const x = sitemapXml();
    expect(x).toContain("/blog</loc>");
    for (const p of POSTS) expect(x).toContain(`/blog/${p.slug}</loc>`);
    expect(robotsTxt()).toContain("Sitemap:");
    expect(robotsTxt()).toContain("Disallow: /api/");
  });
});

describe("home route", () => {
  function setup() {
    const routes: Record<string, Function> = {};
    registerSeoRoutes({ get: (p: string, h: Function) => { routes[p] = h; } } as any);
    return routes;
  }
  const res = () => {
    const r: any = { status: vi.fn(() => r), type: vi.fn(() => r), set: vi.fn(() => r), send: vi.fn(() => r) };
    return r;
  };
  it("shows the landing page to logged-out visitors", () => {
    const r = res(), next = vi.fn();
    setup()["/"]({ headers: {} }, r, next);
    expect(r.send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
  it("passes signed-in visitors through to the app", () => {
    const r = res(), next = vi.fn();
    setup()["/"]({ headers: { cookie: "a=1; app_session_id=abc" } }, r, next);
    expect(next).toHaveBeenCalled();
    expect(r.send).not.toHaveBeenCalled();
  });
  it("404s unknown blog slugs", () => {
    const r = res();
    setup()["/blog/:slug"]({ params: { slug: "nope" } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});
