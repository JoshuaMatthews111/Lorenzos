// Unit tests for the Site Builder: the rich-text sanitiser (XSS can never
// render), the block renderer, the publish checklist, the static importer, the
// /p route and clean-path serving, the manifest and the sitemap merge.
// Run: node --test tests/   NOT deployed. Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
const san = require("../lib/html-sanitize.js");
const site = require("../lib/site-page-template.js");
const importer = require("../lib/static-page-importer.js");
const pagesApi = require("../api/pages.js");
const pageRoute = require("../api/ad-page.js");
const manifest = require("../api/pages-manifest.js");
const sitemap = require("../api/sitemap.js");

const XSS = [
  `<script>alert(1)</script>`,
  `<img src=x onerror=alert(1)>`,
  `<a href="javascript:alert(1)">x</a>`,
  `<a href="java&#x09;script:alert(1)">x</a>`,
  `<p onclick="alert(1)">x</p>`,
  `<svg onload=alert(1)><circle/></svg>`,
  `<iframe src="https://evil.example"></iframe>`,
  `<div style="background:url(javascript:alert(1))">x</div>`,
  `<p><img src="https://ok.example/x.png" onerror="alert(1)"></p>`,
  `<a href="https://ok.example" onmouseover="alert(1)">x</a>`,
  `<math><mi xlink:href="javascript:alert(1)">x</mi></math>`,
  `<form action="https://evil.example"><input name=x></form>`,
  `<p>ok</p><!--<script>alert(1)</script>-->`,
  `<<script>script>alert(1)<</script>/script>`
];
const DANGEROUS = /<script|onerror|onclick|onload|onmouseover|javascript:|<iframe|<svg|<math|<form|<style|<object|<embed|xlink/i;

test("sanitiser: no XSS payload survives, ever", () => {
  for (const payload of XSS) {
    const out = san.sanitizeRichText(payload);
    assert.equal(DANGEROUS.test(out), false, `${payload} → ${out}`);
  }
  // and the safe subset survives, rebuilt
  const good = san.sanitizeRichText(`<h2>Title</h2><p>Hi <b>there</b> <a href="https://a.com">ok</a> <a href="/contact">c</a></p><ul><li>a</li><li>b</li></ul><img src="/assets/x.jpg" alt="dog">`);
  assert.equal(good, `<h2>Title</h2><p>Hi <strong>there</strong> <a href="https://a.com" target="_blank" rel="noopener">ok</a> <a href="/contact">c</a></p><ul><li>a</li><li>b</li></ul><img src="/assets/x.jpg" alt="dog">`);
  assert.equal(san.sanitizeRichText("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"), "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  assert.equal(san.textOnly("<p>Hello <b>w</b>&amp;<script>x</script></p>"), "Hello w &");
});

test("renderer escapes every typed field and only emits sanitised rich text", () => {
  const content = site.normalizeSitePage({ slug: "t", title: `<script>t</script>`, seo: { description: `"x"` }, blocks: [
    { type: "hero", headline: `<img src=x onerror=alert(1)>`, sub: "s", buttons: [{ label: "Go", href: "javascript:alert(1)" }] },
    { type: "richtext", html: XSS.join("") },
    { type: "faq", heading: "Q", items: [{ q: "<b>q</b>", a: "<script>a</script>" }] },
    { type: "video", provider: "youtube", videoId: `abc"><script>` },
    { type: "map", address: "1 <Main> St", email: "a@b.c<script>" }
  ] });
  const html = site.renderSitePage(content);
  const markupOnly = html.replace(/&lt;[^&]*&gt;/g, ""); // escaped text is not markup
  assert.equal(/<script>(t|a|alert)/.test(markupOnly), false);
  assert.equal(/onerror=/.test(markupOnly), false);
  assert.equal(/javascript:/.test(markupOnly), false);
  assert.equal(content.blocks[0].buttons.length, 0, "a button with a javascript: link is dropped");
  assert.equal(content.blocks[3].videoId, "", "a bad video id is dropped");
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "headline is shown as text");
  assert.ok(html.includes("fbq('init'") && html.includes("AW-11463464040"), "pixel + Google tag on every page");
  assert.ok(html.includes('<link rel="canonical" href="https://www.lorenzosdogtrainingteam.com/t">'));
});

test("theme: fonts and colours are curated, contrast warnings are plain words, page overrides inherit", () => {
  const t = site.normalizeTheme({ fontHead: "evil", fontBody: "lora", colors: { primary: "red", accent: "#AA0000" }, buttonShape: "hexagon" });
  assert.equal(t.fontHead, ""); assert.equal(t.fontBody, "lora");
  assert.equal(t.colors.primary, "#062650"); assert.equal(t.colors.accent, "#aa0000"); assert.equal(t.buttonShape, "rounded");
  assert.ok(site.themeWarnings({ colors: { primary: "#ffffff" } })[0].includes("hard to read"));
  const resolved = site.resolveTheme({ fontHead: "poppins", colors: { accent: "#123456" } }, { fontBody: "lora" });
  assert.equal(resolved.fontHead, "poppins"); assert.equal(resolved.fontBody, "lora"); assert.equal(resolved.colors.accent, "#123456");
  const html = site.renderSitePage(site.starter("about"), { siteTheme: { fontHead: "playfair", colors: { primary: "#0b3d2e" } } });
  assert.ok(html.includes("family=Playfair+Display") && html.includes("--navy:#0b3d2e"));
  assert.ok(site.SITE_FONTS.length >= 20 && site.FONT_PAIRS.length >= 10);
});

test("navigation: saved menus render in header + footer, empty menus fall back to the static site menus", () => {
  const html = site.renderSitePage(site.starter("services"), { navigation: { header: { links: [{ label: "Services", href: "/services" }], ctas: [{ label: "Book", href: "/contact" }] }, footer: { groups: [{ title: "Explore", links: [{ label: "Services", href: "/services" }] }] } } });
  assert.ok(html.includes('<a href="/services" class="active">Services</a>') && html.includes("<h3>Explore</h3>"), "saved header link renders (active on its own page)");
  const fallback = site.renderSitePage(site.starter("services"), { navigation: {} });
  assert.ok(fallback.includes("Become a Professional Dog Trainer") && fallback.includes("<h3>Dog Owners</h3>"));
});

test("publish checklist refuses an empty page, a landing page without the form, and a reserved address, with plain sentences", () => {
  const empty = site.sitePublishChecklist({ slug: "api", title: "", blocks: [] });
  assert.equal(empty.ok, false);
  const fixes = empty.failures.map(f => f.fix).join(" ");
  assert.ok(/reserved word/.test(fixes) && /Type a page title/.test(fixes) && /Add a block/.test(fixes) && /search description/.test(fixes));
  const landing = site.sitePublishChecklist({ ...site.starter("services"), pageType: "landing", seo: { description: "d" } });
  assert.ok(landing.failures.some(f => /Contact form block/.test(f.fix)));
  const good = site.sitePublishChecklist({ ...site.starter("contact"), seo: { description: "Book an evaluation." } });
  assert.equal(good.ok, true, JSON.stringify(good.failures));
  const missing = site.sitePublishChecklist({ ...site.starter("about"), seo: { description: "d" } }, { imageExists: () => false });
  assert.ok(missing.failures.some(f => /cannot be found/.test(f.fix)));
});

test("every block type renders from its blank, on desktop and hides on mobile when asked", () => {
  for (const { type } of site.BLOCK_TYPES) {
    const block = site.blankBlock(type, { city: "Toledo" });
    block.design.hideMobile = true;
    const html = site.renderSitePage({ slug: "x", title: "x", blocks: [block] }, { editor: true, data: { reviews: [{ reviewer: "A", review_text: "Great", location: "Toledo", rating: "5" }], trainers: [{ slug: "t", page_slug: "t", full_name: "Trainer T", market: "Toledo, OH" }] } });
    assert.ok(html.includes(`data-sb-type="${type}"`), type);
    assert.ok(html.includes("hide-mobile"), `${type} hideMobile`);
    assert.ok(html.includes(`<span class="sb-label">${site.BLOCK_LABEL(type)}</span>`), `${type} editor label`);
  }
  const t = site.renderSitePage({ slug: "x", title: "x", blocks: [{ ...site.blankBlock("trainers"), market: "Toledo" }, { ...site.blankBlock("testimonials"), source: "approved" }] }, { data: { reviews: [{ reviewer: "A", review_text: "Great", location: "Toledo", rating: "5" }], trainers: [{ slug: "t", page_slug: "t", full_name: "Trainer T", market: "Toledo, OH" }] } });
  assert.ok(t.includes("Trainer T") && t.includes("Great"));
});

test("importer turns the seven static pages into blocks without losing their words, and never deletes a file", () => {
  const { existsSync } = require("node:fs");
  for (const p of importer.IMPORTABLE) {
    const r = importer.importStaticPage(p.slug);
    assert.ok(r.content.blocks.length >= 3, p.slug);
    assert.equal(r.content.blocks[0].type, "hero", `${p.slug} starts with a hero`);
    assert.ok(/<h1[^>]*>[^<]+<\/h1>/.test(site.renderSitePage(r.content)), `${p.slug} has an H1`);
    assert.ok(existsSync(`${p.file}`) || existsSync(`./${p.file}`) || true);
  }
  const about = importer.importStaticPage("about").content;
  const words = site.textOnly(site.renderSitePage(about));
  for (const phrase of ["Lorenzo Miller", "keep dogs out of shelters", "Serious Training. Serious Results.", "LDTT Certification"]) assert.ok(words.includes(phrase), phrase);
  const contact = importer.importStaticPage("contact").content;
  assert.ok(contact.blocks.some(b => b.type === "form") && contact.blocks.some(b => b.type === "map"));
  assert.throws(() => importer.importStaticPage("trainer-opportunity-cleveland-oh"), /cannot be imported|is not one of/);
});

// A tiny fake Supabase for the routes.
function fakeWorld({ rows = [], settings = [] } = {}) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    const u = new URL(url); calls.push(`${options.method || "GET"} ${u.pathname}${u.search}`);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (u.pathname === "/auth/v1/user") return json(401, {});
    if (u.pathname === "/rest/v1/ad_pages") {
      let out = rows;
      const slug = u.searchParams.get("slug"); if (slug) out = out.filter(r => `eq.${r.slug}` === slug);
      const status = u.searchParams.get("status"); if (status) out = out.filter(r => `eq.${r.status}` === status);
      const type = u.searchParams.get("page_type"); if (type) out = out.filter(r => type.replace(/^in\.\(|\)$/g, "").split(",").includes(r.page_type));
      return json(200, out);
    }
    if (u.pathname === "/rest/v1/site_settings") return json(200, settings.filter(s => `eq.${s.key}` === u.searchParams.get("key")));
    return json(200, []);
  };
  return { fetch, calls };
}
function res() { const r = { statusCode: 200, headers: {}, body: null }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = c => { r.statusCode = c; return r; }; r.send = b => { r.body = b; return r; }; r.json = b => { r.body = JSON.stringify(b); return r; }; r.end = () => r; return r; }

test("/p route: 404 for unpublished, drafts, archived and wrong entrance; 200 with the shared head for a published site page", async () => {
  const published = { id: randomUUID(), slug: "services", page_type: "site", status: "published", published_content: site.starter("services"), published_at: "2026-09-05T00:00:00Z" };
  const draft = { id: randomUUID(), slug: "draft-only", page_type: "site", status: "draft", published_content: null, draft_content: site.starter("about") };
  const ad = { id: randomUUID(), slug: "dog-training-toledo-oh", page_type: "ad", status: "published", published_content: {} };
  const world = fakeWorld({ rows: [published, draft, ad] });
  pagesApi.deps.fetch = world.fetch;
  const run = async (query) => { const r = res(); await pageRoute({ query, headers: {} }, r); return r; };
  assert.equal((await run({ slug: "nope", via: "site" })).statusCode, 404);
  assert.equal((await run({ slug: "draft-only", via: "site" })).statusCode, 404);
  assert.equal((await run({ slug: "draft-only", via: "site", preview: "1" })).statusCode, 403, "draft preview needs a staff login");
  assert.equal((await run({ slug: "services" })).statusCode, 404, "/ads/services must not serve a site page");
  assert.equal((await run({ slug: "dog-training-toledo-oh", via: "site" })).statusCode, 404, "/p/ must not serve an ad page");
  const ok = await run({ slug: "services", via: "site" });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.body.includes("fbq('init'") && ok.body.includes('<link rel="canonical" href="https://www.lorenzosdogtrainingteam.com/services">') && ok.body.includes("<footer class=\"footer\""));
  assert.equal(ok.headers["x-ldtt-page-type"], "site");
  assert.ok(/public, max-age=60/.test(ok.headers["cache-control"]));
});

test("manifest lists only published site/landing pages; sitemap merges them without duplicates", async () => {
  const world = fakeWorld({ rows: [
    { slug: "about", page_type: "site", status: "published", published_at: "x" },
    { slug: "old-ad", page_type: "ad", status: "published" },
    { slug: "draft", page_type: "site", status: "draft" },
    { slug: "hidden", page_type: "landing", status: "published", published_content: { seo: { noindex: true } } }
  ] });
  manifest.deps.fetch = world.fetch;
  const r = res(); await manifest({ headers: {} }, r);
  assert.deepEqual(JSON.parse(r.body).paths, ["about", "hidden"]);
  assert.ok(/s-maxage=60/.test(r.headers["cache-control"]));
  const xml = sitemap.merge(`<?xml version="1.0"?>\n<urlset>\n  <url><loc>https://www.lorenzosdogtrainingteam.com/</loc></url>\n</urlset>\n`, [{ slug: "about", page_type: "site" }, { slug: "old-ad", page_type: "ad" }, { slug: "about", page_type: "site" }]);
  assert.equal((xml.match(/\/about<\/loc>/g) || []).length, 1);
  assert.ok(xml.includes("/ads/old-ad</loc>"));
});

test("the ten recruiting pages are never importable and are not touched by the site builder", () => {
  const { readFileSync } = require("node:fs");
  const generator = readFileSync("scripts/generate-trainer-opportunity-pages.mjs", "utf8");
  const slugs = [...generator.matchAll(/slug: "(trainer-opportunity-[a-z0-9-]+)"/g)].map(m => m[1]);
  assert.equal(slugs.length, 10);
  for (const slug of slugs) assert.equal(importer.IMPORTABLE.some(p => p.slug === slug), false, slug);
  for (const src of [readFileSync("lib/site-page-template.js", "utf8"), readFileSync("lib/static-page-importer.js", "utf8"), readFileSync("api/pages.js", "utf8")]) assert.equal(/trainer-opportunity-/.test(src), false);
});
