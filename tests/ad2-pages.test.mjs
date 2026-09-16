// Rule 85 (Joshua 2026-09-14; meeting 2026-09-11): the Ad landing pages 2.0 live in Page Studio as page_type "ad2"
// on the practice copy, are edited full screen (trainer-backoffice/ad2-studio.js), show in the Site Builder list and
// the Page Editor's page list, and are served at /ads/<slug>. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const T = require("../lib/ad2-page-template.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("the three 2.0 pages draw from saved content, in their own design", () => {
  assert.deepEqual(T.STARTERS.map(s => [s.slug, s.design]), [["miramar-beach", "d1"], ["panama-city-beach", "d2"], ["ann-arbor", "d3"]]);
  for (const starter of T.STARTERS) {
    const html = T.renderPage(starter, { practice: true });
    assert.match(html, new RegExp(`<body class="${starter.design}"`));
    assert.ok(html.includes(`${starter.h1[0].replace(/&/g, "&amp;")} <br>`), `${starter.slug} headline`);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/v2\/v2\.css\?v=/);
    assert.match(html, /<script src="\/assets\/v2\/v2\.js\?v=\w+" defer><\/script>/);
    assert.match(html, /data-endpoint="\/api\/booking-lead"/, "the form goes to the same site's booking flow");
    assert.match(html, /PRACTICE COPY/);
    assert.ok(!/fbq\(/.test(html), "the practice copy carries no Meta pixel");
    assert.match(html, /12 STATES\. ONE STANDARD\.|12 States/);
  }
  const live = T.renderPage(T.STARTERS[0], {});
  assert.match(live, /fbq\('init'/, "rule 11: live rendering carries the pixel from lib/ad-page-template.js");
  assert.ok(!/PRACTICE COPY/.test(live));
  assert.match(T.renderPage(T.STARTERS[1], { preview: true }), /data-endpoint=""/, "the editor's preview form sends nothing");
});

test("normalize keeps only safe fields the design draws", () => {
  const x = T.normalizeContent({ design: "d2", slug: "Tallahassee FL!", h1: ["<script>alert(1)</script>", "x"], check: ["d1 only"],
    photos: { hero: "javascript:alert(1)", founder: "https://e.com/a.jpg\" onerror=x", svc1: "https://cdn.example.com/dog.webp", book: "/assets/v2/nope.webp" },
    states: ["Ohio", "Narnia", "Ohio", ...T.ALL_STATES] });
  assert.equal(x.design, "d2");
  assert.equal(x.slug, "tallahassee-fl");
  assert.equal(x.check, undefined, "fields of another design are dropped");
  assert.equal(x.photos.hero, "/assets/v2/d2-hero.webp");
  assert.equal(x.photos.founder, "/assets/v2/d2-founder.webp");
  assert.equal(x.photos.book, "/assets/v2/d2-book.webp", "only real 2.0 files");
  assert.equal(x.photos.svc1, "https://cdn.example.com/dog.webp");
  assert.equal(x.states[0], "Ohio");
  assert.equal(x.states.length, T.MAX_STATES, "the map has room for 12");
  assert.ok(!x.states.includes("Narnia"));
  const html = T.renderPage(x, {});
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.equal(T.normalizeContent({ design: "zz" }).design, "d1");
  assert.deepEqual(T.normalizeContent({ design: "d3" }).vids.length, 3);
  assert.equal(T.fromStarter("ann-arbor", { market: "Lansing, MI", newSlug: "lansing" }).slug, "lansing");
  assert.equal(T.fromStarter("ann-arbor", { market: "Lansing, MI", newSlug: "lansing" }).state, "MI");
});

test("publish checklist refuses a page with a missing headline or an unsafe photo", () => {
  assert.equal(T.publishChecklist(T.STARTERS[0]).ok, true);
  const bad = T.publishChecklist({ ...T.STARTERS[0], h1: ["", "x"], photos: { hero: "http://insecure.example.com/a.jpg" } });
  assert.equal(bad.ok, false);
  assert.ok(bad.failures.some(f => /both lines/.test(f.fix)));
  assert.ok(bad.failures.some(f => /hero/.test(f.fix)));
});

test("wiring: Page Studio, Site Builder, Page Editor list, /ads route, send to live, practice-only table", () => {
  const pages = read("api/pages.js");
  assert.match(pages, /const PAGE_TYPES = new Set\(\["ad", "site", "landing", "ad2"\]\);/);
  assert.match(pages, /if \(type === "ad2"\) return ad2\.renderPage\(content, \{ practice: isSandbox\(\), data: /);
  assert.match(pages, /if \(type === "ad2"\) return ad2\.publishChecklist\(content\);/);
  const route = read("api/ad-page.js");
  assert.match(route, /const adFamily = type === "ad" \|\| type === "ad2";[^\n]*\n\s*if \(\(entrance === "ads"\) !== adFamily\) return notFound/);
  assert.match(route, /if \(type === "ad2"\) return ad2\.renderPage\(content, \{ practice: isSandbox\(\), data: /);
  assert.match(read("api/send-to-live.js"), /if \(page\.page_type === "ad2"\) throw fail\(409, "2\.0 ad pages stay on the practice copy for now\./);
  const studio = read("trainer-backoffice/page-studio.js");
  assert.match(studio, /"\/lib\/ad-page-template\.js", "\/lib\/ad2-usmap\.js", "\/lib\/ad2-page-template\.js"/);
  assert.match(studio, /id="psAd2Section"/);
  assert.match(studio, /type === "ad2" \? `data-a2-open=/);
  const builder = read("trainer-backoffice/site-builder.js");
  // Site Builder 2.0 (Joshua 2026-09-15: one editor): a 2.0 page opens IN the Site Builder; the old 2.0 editor stays under More.
  assert.match(builder, /const kindOf = page => \(page\?\.page_type === "ad2" \? "ad2" : "blocks"\);/);
  assert.match(builder, /const draft = kind === "ad2" \? A2\(\)\.normalizeContent\(page\.draft_content \|\| \{\}\)/);
  assert.match(builder, /window\.LDTT_AD2_STUDIO\?\.open\(id, \{ classic: true \}\)/);
  assert.match(read("trainer-backoffice/ad2-studio.js"), /if \(!classic && window\.LDTT_SITE_BUILDER\) return window\.LDTT_SITE_BUILDER\.open\(pageId\);/);
  assert.match(builder, /group\("Ad pages 2\.0"/);
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /\$\{adTwoEditorOptions\(\)\}<\/select><\/label>`/, "the Page Editor's Website Page dropdown lists the 2.0 pages");
  assert.match(app, /data-sb-open="\$\{escapeHtml\(page\.pageId\)\}">Edit this page in the Site Builder/); // Site Builder 2.0: one editor
  for (const shell of ["staff.html", "trainer-backoffice/index.html"]) assert.match(read(shell), /ad2-studio\.js\?v=/, shell);
  const migration = read("supabase/migrations/20260914140000_practice_ad2_page_type.sql");
  assert.match(migration, /alter table practice\.ad_pages add constraint ad_pages_page_type_check check \(page_type = any \(array\['ad'::text, 'site'::text, 'landing'::text, 'ad2'::text\]\)\);/);
  assert.ok(!/public\./.test(migration.replace(/^--.*$/gm, "")), "the live table is not changed");
  assert.match(read("api/sitemap.js"), /r\.page_type === "ad2"/);
  assert.match(read("lib/page-durability.js"), /const adFamily = type => type === "ad" \|\| type === "ad2";/);
});

test("the Site Builder top bar has a Landing page dropdown that opens each page in its own editor", () => {
  const builder = read("trainer-backoffice/site-builder.js");
  assert.match(builder, /<label class="sb-jump"><span>Landing page<\/span><select id="sbJump" data-sb-jump aria-label="Open a landing page"><\/select><\/label>/);
  assert.match(builder, /group\("Landing pages", pages\.filter\(p => p\.page_type === "landing"\)\)/);
  assert.match(builder, /group\("Ad pages", pages\.filter\(p => !p\.page_type \|\| p\.page_type === "ad"\)\)/);
  assert.match(builder, /group\("Ad pages 2\.0", pages\.filter\(p => p\.page_type === "ad2"\)\)/);
  assert.match(builder, /if \(el\.matches\("\[data-sb-jump\]"\)\) \{ if \(event\.type === "change" && el\.value\) jumpTo\(el\.value\); return; \}/);
  assert.match(builder, /sb\.panel = null; await openPage\(id\); paintAll\(\); \/\/ block pages and 2\.0 ad pages open right here/);
});

// Arrison's editor asks (email 2026-09-16) — pinned so they never quietly regress.
test("Arrison 2026-09-16: founder eyebrow sits inside its section, photo slots carry a best-size hint", () => {
  const src = readFileSync(new URL("../lib/ad2-page-template.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /y: -10, fs: 13/, "the MEET THE FOUNDER eyebrow no longer overlaps the section above");
  assert.match(src, /quotePanel\(788, 8, 205, 208, 14, 18\.5\)/, "the founder quote fits its box");
  assert.ok(T.PHOTO_SLOTS.d2.every(s => /×.*px/.test(s[3] || "")), "every d2 photo slot names its best size");
});

test("Arrison 2026-09-16: her own videos play behind the founder and before/after thumbnails", () => {
  const c = T.normalizeContent({ design: "d2", slug: "x", videos2: { founder: "https://youtu.be/abc12345", ba1: "https://example.com/v.mp4", ba9: "https://x.com/v.mp4", st1: "javascript:alert(1)" } });
  assert.deepEqual(c.videos2, { founder: "https://youtu.be/abc12345", ba1: "https://example.com/v.mp4" }, "only known slots with safe https addresses are kept");
  const html = T.renderPage(c, { practice: true });
  assert.match(html, /data-video="https:\/\/youtu\.be\/abc12345"/, "the founder play button uses her video");
  assert.match(html, /data-video="https:\/\/example\.com\/v\.mp4"/, "the ba1 play button uses her video");
  const plain = T.normalizeContent({ design: "d2", slug: "x" });
  assert.ok(!("videos2" in plain), "a page without its own videos keeps its exact shape (rule 85)");
});

test("the booklet is downloadable: the modal carries a real PDF link, b_url can replace it", () => {
  const c = T.normalizeContent({ design: "d2", slug: "x" });
  const html = T.renderPage(c, { practice: true });
  assert.match(html, /href="https:\/\/lorenzosdogtrainingteam\.com\/assets\/calm-dog-blueprint-final\.pdf"[^>]*download/, "the standard booklet PDF is the download");
  const own = T.renderPage(T.normalizeContent({ design: "d2", slug: "x", b_url: "https://example.com/my-booklet.pdf" }), { practice: true });
  assert.match(own, /href="https:\/\/example\.com\/my-booklet\.pdf"[^>]*download/, "an office-set PDF address replaces it");
});
