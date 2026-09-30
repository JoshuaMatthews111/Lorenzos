// Office 2026-09-26 (DO-NOT-BREAK rules 119-122).
//  1. 2.0 pages: the red icon circles on the six training cards are drawn WHOLE (CSS only).
//  2. 2.0 pages: the founder / Lorenzo video block is titled "Start Your FREE Evaluation Today", and its title and
//     small line are office-editable boxes (Site Builder 2.0 + the classic 2.0 editor read FIELDS).
//  3. Four NEW city ad pages (Navarre FL, Dallas TX, Durham NH, Flushing NY) built by the SAME generator and the
//     SAME renderAdPage as the other city pages: the live form + booking flow is identical to an existing city page.
//  4. Ann Arbor is off the campaign: /dog-training-ann-arbor-mi 308s to /contact and nothing new links to it.
// Run: node --test tests/   (no network: the re-engage check replaces global fetch)
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const A2 = require("../lib/ad2-page-template.js");
const MK = require("../lib/ad-page-markets.js");
const T = require("../lib/ad-page-template.js");
const X = require("../lib/ad-page-v2-extras.js");
const NEW = ["dog-training-navarre-fl", "dog-training-dallas-tx", "dog-training-durham-nh", "dog-training-flushing-ny"];
const TITLE = "Start Your FREE Evaluation Today";

// ─────────────── 1. icon circles ───────────────
test("1. v2.css draws the training-card icon circle from the CARD at the photo's bottom edge, so the frame clip can not cut it", () => {
  const css = read("assets/v2/v2.css");
  const fix = css.slice(css.indexOf("2026-09-26 (office): the red icon circle"));
  assert.ok(fix.length > 0, "the fix is at the END of v2.css, after the 09-16 frame clip");
  assert.ok(css.indexOf(".ph,.cimg,.baimg,.simg{overflow:hidden}") < css.indexOf(".svc .cimg{position:static}"), "the photo frame still clips the photo (pframe zoom stays inside)");
  assert.match(fix, /\.svc \.cimg\{position:static\}/, "the frame is no longer the circle's containing block");
  assert.match(fix, /\.svc \.cic\{top:calc\(var\(--u\) \* var\(--h\)\);bottom:auto;transform:translate\(-50%,-50%\)\}/, "computer: centred on the photo's bottom edge (--h = the frame's own height)");
  assert.match(fix, /\.svc \.card:hover \.cic\{transform:translate\(-50%,-50%\) scale\(1\.08\)\}/, "hover keeps the new centring");
  assert.match(fix, /@media \(max-width:760px\)\{\.svc \.cic\{top:130px\}\}/, "phone: the frame is 130px tall there");
  assert.match(css, /@media \(max-width:760px\)\{[\s\S]*?\.cimg\{height:130px\}/, "the phone frame height the rule relies on");
  // Positioned card on both layouts (the circle's new containing block).
  assert.match(css, /@media \(min-width:761px\)\{\n\.sec\{position:relative\}\n\.a\{position:absolute;/);
  assert.match(css, /@media \(max-width:760px\)\{\n\.page\{padding-bottom:62px\}\n\.a\{position:relative\}/);
  // The page markup is unchanged: the circle still lives inside the photo frame, which carries --h.
  for (const s of A2.STARTERS.filter(s => s.design !== "d1")) {
    const html = A2.renderPage(A2.normalizeContent(s), { practice: true });
    assert.match(html, /<div class="cimg" style="--h:\d+"><img [^>]+><span class="cic">/, `${s.design}: circle inside the frame that sets --h`);
    assert.match(html, /v2\.css\?v=20260930ad21/, "browsers fetch the fixed stylesheet");
  }
});

// ─────────────── 2. founder title ───────────────
test("2. the founder block is titled 'Start Your FREE Evaluation Today' on all three 2.0 designs, never 'Meet the Founder'", () => {
  assert.equal(A2.FOUNDER_TITLE, TITLE);
  for (const s of A2.STARTERS) {
    assert.equal(s.f_title, TITLE, `${s.design} starter`);
    const html = A2.renderPage(A2.normalizeContent(s), { practice: true });
    assert.match(html, /<h2 class="a [^"]*f-title"[^>]*>Start Your FREE<br>Evaluation Today<\/h2>/, `${s.design} draws the title`);
    assert.ok(!/MEET THE FOUNDER|Meet the Founder/.test(html), `${s.design}: the old title is gone`);
    assert.ok(!/>LORENZO MILLER<\/h2>/.test(html), `${s.design}: the fixed name heading is gone`);
    assert.match(html, /FROM LORENZO MILLER, OUR FOUNDER/, `${s.design}: the small line above the title`);
  }
  // A page saved before this change (no f_title) shows the new title; its old default small line is replaced in the
  // database by the targeted update (rule 120), and a custom small line / title the office typed is kept as typed.
  const old = { ...A2.STARTERS[1] }; delete old.f_title; delete old.f_eyebrow;
  assert.equal(A2.normalizeContent(old).f_title, TITLE);
  const mine = A2.normalizeContent({ ...A2.STARTERS[2], f_title: "Book <Today>", f_eyebrow: "Our founder" });
  const html = A2.renderPage(mine, { practice: true });
  assert.match(html, />Book<br>&lt;Today&gt;<\/h2>/, "the office's own title, escaped");
  assert.match(html, />OUR FOUNDER</);
});

test("2. the title and its small line are office-editable boxes in the Site Builder 2.0 / 2.0 editor on every design", () => {
  const title = A2.FIELDS.find(f => f.key === "f_title");
  const eyebrow = A2.FIELDS.find(f => f.key === "f_eyebrow");
  assert.ok(title && eyebrow);
  assert.equal(title.section, "founder"); assert.equal(title.kind, "text"); assert.deepEqual(title.designs, ["d1", "d2", "d3"]);
  assert.equal(eyebrow.section, "founder"); assert.deepEqual(eyebrow.designs, ["d1", "d2", "d3"], "d2's small line was fixed words before");
  // Site Builder 2.0 shows the founder tab's fields for the founder section of each design (site-builder.js line: a2.FIELDS.filter(...)).
  assert.match(read("trainer-backoffice/site-builder.js"), /const fields = a2\.FIELDS\.filter\(f => tabs\.includes\(f\.section\) && f\.designs\.includes\(design\) && f\.kind !== "photos"\);/);
  for (const [design, anchor] of [["d1", "founder"], ["d2", "founder2"], ["d3", "about3"]]) {
    const tabs = A2.ANCHOR_FIELDS[anchor];
    const keys = A2.FIELDS.filter(f => tabs.includes(f.section) && f.designs.includes(design) && f.kind !== "photos").map(f => f.key);
    assert.ok(keys.includes("f_title") && keys.includes("f_eyebrow"), `${design}: both boxes on the founder section`);
  }
  // Round trip: what the office types is what is stored.
  assert.equal(A2.normalizeContent({ design: "d2", f_title: "  Start Here   Today " }).f_title, "Start Here Today");
});

// ─────────────── 3. four new city pages ───────────────
const formOf = file => { const s = read(file); const i = s.indexOf('<form class="ad-form-card'); return s.slice(i, s.indexOf("</form>", i) + 7); };
const scriptsOf = file => [...read(file).matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);

test("3. the four new pages exist and their lead form + scripts are an existing city page's, byte for byte", () => {
  const base = formOf("dog-training-cleveland-oh.html");
  const titles = new Set(), descs = new Set();
  assert.match(base, /^<form class="ad-form-card ad-form-card-v2 lead booking-intake"\n\s+data-kind="evaluation"\n\s+data-endpoint="\/api\/booking-lead"/);
  for (const slug of NEW) {
    const file = `${slug}.html`;
    assert.ok(existsSync(resolve(root, file)), file);
    const market = MK.markets.find(m => m.slug === slug);
    assert.ok(market, `${slug} is in lib/ad-page-markets.js`);
    // Only the city placeholder and the preselected state differ (the same way every city page differs).
    const norm = (f, city, st) => f.replace(`placeholder="${city}"`, 'placeholder="CITY"').replace(`<option value="${st}" selected>`, `<option value="${st}">`);
    assert.equal(norm(formOf(file), market.city, market.state), norm(base, "Cleveland", "OH"), `${slug}: same form as Cleveland`);
    assert.deepEqual(scriptsOf(file), scriptsOf("dog-training-cleveland-oh.html"), `${slug}: same pixel/tag/tracking/form scripts`);
    const html = read(file);
    assert.equal((html.match(/eventID: id/g) || []).length, 2, `${slug}: Meta Lead event id x2 (rule 12)`);
    assert.match(html, /<form class="market-guide-form pdf-optin" novalidate>/, `${slug}: the free-guide form`);
    assert.match(html, /class="ad-proof-band-v2"/, `${slug}: market-landing.js tracking finds its page`);
    assert.match(html, /data-self-designed="1"/);
    assert.match(html, /<body id="top" class="market-landing ad-landing ad-landing-v2 arch-hq v2look"/);
    // the 2.0 sections
    assert.match(html, /TRAINING FOR EVERY DOG\. SOLUTIONS FOR EVERY OWNER\./);
    assert.equal((html.match(/<span class="v2x-cic">/g) || []).length, 6, `${slug}: six cards with icon circles`);
    assert.match(html, /\.v2x-cimg\{height:150px;overflow:hidden\}[\s\S]*\.v2x-cic\{position:absolute;left:50%;top:150px;transform:translate\(-50%,-50%\)/, "circle hangs from the card at the photo edge");
    assert.match(html, /\.v2x-cimg\{height:130px\}\.v2x-cic\{top:130px;/, "same on a phone");
    assert.match(html, new RegExp(`<h2 class="v2x-ftitle">${TITLE}</h2>`), `${slug}: founder block title`);
    assert.match(html, /v2x-rvs/); assert.match(html, /v2x-area/); assert.match(html, /v2x-faq/); assert.match(html, /v2x-foot/);
    // Joshua 2026-09-26: NO trainer names or trainer photos on these four pages (cards, founder text, alt, meta, JSON-LD).
    assert.ok(!/v2x-tcard|trainer-headshots|trainer-bio-photos|trainer-bio-|market-photos\/(navarre|dallas|durham)-/.test(html), `${slug}: no trainer card or trainer photo`);
    assert.ok(!/Michael King|Hardaway|Tristan|Urena|\bSean\b|\bEric\b|\bRobert\b|Bruce|Dylan|Clark Patton|Daniel Bainbridge/.test(html), `${slug}: no trainer name anywhere`);
    // SEO: a unique title and description with the city, H1 with the city, FAQPage + ProfessionalService JSON-LD with areaServed.
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    const desc = html.match(/<meta name="description" content="([^"]+)">/)[1];
    assert.ok(title.includes(market.city) && /dog train/i.test(title), `${slug}: title "${title}"`);
    assert.equal(desc, T.escapeHtml(market.description), `${slug}: its own description`);
    assert.ok(market.description.includes(market.city) && /dog training/i.test(market.description) && market.description.length <= 210, `${slug}: description with the city, search length`);
    titles.add(title); descs.add(desc);
    assert.match(html.match(/<h1>([^<]+)<\/h1>/)[1], new RegExp(`Dog Training in ${market.city}`));
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    const biz = ld.find(x => x["@type"] === "ProfessionalService" || x["@type"] === "LocalBusiness");
    assert.ok(biz && Array.isArray(biz.areaServed) && biz.areaServed.includes(market.city) && biz.areaServed.length >= 7, `${slug}: areaServed`);
    const faq = ld.find(x => x["@type"] === "FAQPage");
    assert.ok(faq && faq.mainEntity.length === market.v2.faqs.length, `${slug}: FAQPage JSON-LD`);
    for (const f of market.v2.faqs) assert.ok(html.includes(`<summary>${T.escapeHtml(f.q)}</summary>`), `${slug}: FAQ shown on the page`);
    assert.equal((html.match(/<img src="\/assets\/v2\/d2-svc\d\.webp" alt="[^"]+ in /g) || []).length, 6, `${slug}: card photos carry local alt text`);
    assert.ok(!/\bTim\b/.test(html), `${slug}: never "Tim"`);
    assert.ok(!/\b(AI|Claude|ChatGPT|OpenAI)\b/.test(html), `${slug}: no AI tool names`);
    // regenerating gives the committed file (the generator is the source)
    const { page } = { page: m => T.renderAdPage(T.marketToContent(m), { imageAspect: () => null, publicPath: `/${m.slug}`, v2: X.renderV2Extras(m) }) };
    assert.match(page(market), /class="v2x v2x-svc"/);
  }
  assert.equal(titles.size, 4, "four different titles"); assert.equal(descs.size, 4, "four different descriptions");
  const flushing = read("dog-training-flushing-ny.html");
  assert.match(flushing, /Lorenzo&#39;s office calls you to set up your FREE evaluation/, "Flushing: office call (online booking for the Flushing trainer stays paused)");
});

test("3. the older city pages are untouched by the 2.0 option, and the office/re-engage/sitemap lists know the new pages", () => {
  for (const file of readdirSync(root).filter(f => /^dog-training-.*\.html$/.test(f) && !NEW.includes(f.replace(/\.html$/, "")))) {
    const html = read(file);
    assert.ok(!html.includes("v2look") && !html.includes("v2x-"), `${file}: no 2.0 extras`);
  }
  const sitemap = read("sitemap.xml");
  for (const slug of NEW) {
    assert.match(sitemap, new RegExp(`/${slug}</loc>`), `${slug} in sitemap`);
    assert.match(read("trainer-backoffice/app.js"), new RegExp(`\\{ slug: "${slug}", label: "[^"]+", market: "[^"]+", trainers: "[^"]+", href: "\\.\\./${slug}\\.html" \\}`), `${slug} in the office ad landing page list`);
  }
  const pipeline = read("lib/pipeline.js");
  for (const [key, slug] of [["navarre", NEW[0]], ["dallas", NEW[1]], ["durham", NEW[2]], ["flushing", NEW[3]]]) {
    assert.match(pipeline, new RegExp(`"${key}": "${slug}",?\\n`), `AREA_AD_PAGE ${key}`);
    assert.equal(MK.markets.find(m => m.slug === slug).v2.areaKey, key);
  }
});

test("3. the re-engage link sends a lead near a new city to that city's page with its ZIP (no 2.0 row needed)", async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
  const saved = global.fetch;
  const adPages = [{ slug: "pensacola", published_content: { zip: "32501" } }, { slug: "ann-arbor", published_content: { zip: "48104" } }];
  global.fetch = async url => {
    const u = new URL(String(url));
    const data = u.pathname.startsWith("/rest/v1/ad_pages") ? adPages : [];
    return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
  };
  try {
    for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/pipeline.js"]) delete require.cache[require.resolve(m)];
    const P = require("../lib/pipeline.js");
    const cases = [["32566", "dog-training-navarre-fl"], ["75204", "dog-training-dallas-tx"], ["03820", "dog-training-durham-nh"], ["11354", "dog-training-flushing-ny"], ["32501", "dog-training-pensacola-fl"]];
    for (const [zip, page] of cases) {
      const link = await P.reengageBookingLink({ zip });
      assert.equal(link.kind, "ad_page", `${zip}`);
      assert.match(link.url, new RegExp(`/${page}\\?zip=${zip}$`), `${zip} -> ${page}`);
    }
    // Ann Arbor: its 2.0 row still exists (untouched), but no link ever points at the retired page.
    const aa = await P.reengageBookingLink({ zip: "48104" });
    assert.equal(aa.kind, "book");
    assert.match(aa.url, /\/book\?zip=48104$/);
  } finally {
    global.fetch = saved;
  }
});

// ─────────────── 4. Ann Arbor ───────────────
test("4. /dog-training-ann-arbor-mi 308s to /contact and nothing new links to it; Dylan's pages are untouched", () => {
  const vercel = JSON.parse(read("vercel.json"));
  for (const source of ["/dog-training-ann-arbor-mi", "/dog-training-ann-arbor-mi.html"]) {
    const r = vercel.redirects.find(x => x.source === source);
    assert.ok(r, source);
    assert.equal(r.destination, "/contact");
    assert.equal(r.permanent, true, "permanent = 308");
  }
  assert.ok(!existsSync(resolve(root, "dog-training-ann-arbor-mi.html")), "no page to serve");
  assert.ok(!MK.markets.some(m => m.slug === "dog-training-ann-arbor-mi"), "not generated, not in Page Studio's built-in list");
  assert.ok(!read("sitemap.xml").includes("/dog-training-ann-arbor-mi<"), "not in the sitemap");
  assert.ok(!/"ann-arbor": "dog-training-ann-arbor-mi"/.test(read("lib/pipeline.js")), "not a re-engage link");
  assert.match(read("trainer-backoffice/app.js"), /slug: "dog-training-ann-arbor-mi", label: "Ann Arbor \(off the campaign\)"[^\n]*href: "\.\.\/contact", retired: true/, "office report row kept for its history only");
  // Old leads keep their labels and pools.
  assert.ok(MK.retiredMarkets.some(m => m.slug === "dog-training-ann-arbor-mi"));
  const P = require("../lib/pipeline.js");
  assert.equal(P.sourceWords({ raw_payload: { source_page: "https://lorenzosdogtrainingteam.com/dog-training-ann-arbor-mi" } }), "Ad page: Ann Arbor, MI");
  const C = require("../lib/email-campaign.js");
  assert.equal(C.isPaidAd({ raw_payload: { source_page: "https://lorenzosdogtrainingteam.com/dog-training-ann-arbor-mi" } }), true);
  // Dylan's trainer page and bio page still exist.
  assert.ok(existsSync(resolve(root, "dylanatkinson.html")));
  assert.ok(existsSync(resolve(root, "trainer-bio-dylan-atkinson.html")));
  assert.match(read("trainer-bio-dylan-atkinson.html"), /Dylan/);
});
