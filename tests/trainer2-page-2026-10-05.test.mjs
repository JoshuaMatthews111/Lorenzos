// Rule 169 (2026-10-05): the Trainer 2.0 landing page, a paid add-on. One premium, ad-driven page per paying trainer at
// /trainer/<slug>; the first (and only published) one is Lorenzo Miller's. Its leads go ONLY to that trainer.
// Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const ROOT = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(ROOT, path), "utf8");
const PAGES = require("../lib/trainer2-pages.js");
const T = require("../lib/trainer2-page-template.js");
const B = require("../lib/booking.js");
const P = require("../lib/pipeline.js");
const SA = require("../lib/system-alerts.js");

const lorenzo = PAGES.pageFor("lorenzo-miller");
const live = () => T.renderTrainer2Page(lorenzo, {});
const practice = () => T.renderTrainer2Page(lorenzo, { practice: true });

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.status = code => { res.statusCode = code; return res; };
  res.send = body => { res.body = body; return res; };
  res.json = body => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

test("only published entries are served, keyed by the trainer slug; Lorenzo's is the one published page", () => {
  assert.deepEqual(PAGES.publishedSlugs(), ["lorenzo-miller"]);
  assert.equal(lorenzo.name, "Lorenzo Miller");
  assert.equal(PAGES.pageFor("nobody"), null);
  assert.equal(PAGES.pageFor("../lorenzo-miller").slug, "lorenzo-miller", "the slug is cleaned before the lookup");
  assert.equal(PAGES.pageFor("__proto__"), null);
  assert.equal(PAGES.pagePath("lorenzo-miller"), "/trainer/lorenzo-miller");
  assert.equal(PAGES.canonicalUrl("lorenzo-miller"), "https://www.lorenzosdogtrainingteam.com/trainer/lorenzo-miller");
  assert.equal(PAGES.leadEndpoint("lorenzo-miller"), "/api/trainer2-lead?page=lorenzo-miller");
});

test("SEO: title, description, canonical, Open Graph, and JSON-LD (LocalBusiness/ProfessionalService + Person + FAQPage)", () => {
  const html = live();
  assert.match(html, /<title>Dog Trainer in Cleveland, OH \| Lorenzo Miller \| Free In-Home Evaluation<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{80,}">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.lorenzosdogtrainingteam\.com\/trainer\/lorenzo-miller">/);
  assert.match(html, /<meta name="robots" content="index,follow/);
  for (const prop of ["og:title", "og:description", "og:url", "og:image", "og:type"]) assert.ok(html.includes(`property="${prop}"`), prop);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  const types = ld["@graph"].map(n => [].concat(n["@type"]).join("+"));
  assert.deepEqual(types, ["LocalBusiness+ProfessionalService", "Person", "FAQPage"]);
  const [biz, person, faq] = ld["@graph"];
  assert.equal(biz.telephone, "+1-866-436-4959");
  assert.equal(biz.address.streetAddress, "4815 Orchard Rd");
  assert.equal(biz.address.addressLocality, "Garfield Heights");
  assert.equal(biz.address.postalCode, "44128");
  assert.equal(person.name, "Lorenzo Miller");
  assert.ok(!("aggregateRating" in biz), "no invented rating value");
  // the FAQ data is exactly the FAQ the page shows
  assert.equal(faq.mainEntity.length, lorenzo.faqs.length);
  for (const f of lorenzo.faqs) assert.ok(html.includes(`<summary>${f.q.replace(/&/g, "&amp;")}</summary>`), f.q);
  assert.equal(html.match(/<h1[ >]/g).length, 1, "one h1");
});

test("tracking: the Meta pixel (PageView + Lead with one eventID) and the Google tag, exactly like the 2.0 pages; none on the practice copy", () => {
  const html = live();
  assert.match(html, /fbq\('init', '3790623554504010'\)/);
  assert.match(html, /fbq\('track', 'PageView'\)/);
  assert.match(html, /fbq\('track', 'Lead', \{ value: 250, currency: 'USD' \}, \{ eventID: id \}\)/);
  assert.match(html, /googletagmanager\.com\/gtag\/js\?id=AW-11463464040/);
  // the pixel's Lead fires for forms with class contact-intake: this page's form wears it
  assert.match(html, /<form class="lead contact-intake" data-kind="evaluation"/);
  const p = practice();
  assert.ok(!/fbq\(/.test(p) && !/googletagmanager/.test(p), "the practice copy carries no pixel and no Google tag");
  assert.match(p, /PRACTICE COPY/);
  assert.match(p, /<meta name="robots" content="noindex,nofollow">/);
});

test("lead capture: one 2.0 evaluation form, fixed to this trainer's door, no trainer picker", () => {
  const html = live();
  assert.equal((html.match(/<form /g) || []).length, 1);
  assert.match(html, /data-endpoint="\/api\/trainer2-lead\?page=lorenzo-miller"/);
  assert.ok(!html.includes("data-trainer-pick"), "no picker of other trainers");
  assert.ok(!/name="trainer_slug"|name="assigned_trainer"/.test(html), "the browser does not choose the trainer");
  assert.match(html, /<script src="\/assets\/v2\/v2\.js\?v=\w+" defer><\/script>/, "the unchanged 2.0 form script drives it");
  for (const name of ["first_name", "last_name", "phone", "email", "address", "city", "state", "zip", "dog_name", "problem", "sms_consent"]) {
    assert.match(html, new RegExp(`name="${name}"`), name);
  }
  assert.ok(html.includes(T.SMS_CONSENT), "the exact SMS consent words (rule 47)");
  assert.match(html, /<option value="OH" selected>Ohio<\/option>/);
});

test("ad-driven layout: hero offer, sticky call/book bar, proof, videos, about, programs, process, reviews, FAQ, final CTA", () => {
  const html = live();
  assert.match(html, /<nav class="mbar"[^>]*><a class="call" href="tel:\+18664364959">/);
  assert.match(html, /<a class="book" href="#book">Free Evaluation<\/a>/);
  for (const id of ["hero-t", "probs-t", "vid-t", "about-t", "prog-t", "proc-t", "rev-t", "center-t", "faq-t", "final-t"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.equal((html.match(/<video /g) || []).length, lorenzo.videos.length);
  assert.ok(!/<video[^>]*preload="(auto|metadata)"/.test(html), "videos never download before a tap");
  assert.equal((html.match(/<article class="prog">/g) || []).length, 6);
  // every image except the hero is lazy and sized
  const imgs = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "").match(/<img [^>]+>/g); // the pixel's noscript image is not page media
  for (const tag of imgs) {
    assert.match(tag, /width="\d+" height="\d+"/, tag);
    assert.match(tag, /alt="/, tag);
  }
  assert.equal(imgs.filter(t => !/loading="lazy"/.test(t)).length, 2, "only the header logo and the hero photo load at once");
  assert.match(html, /fetchpriority="high"/);
});

test("brand facts and words: real facts only, Lorenzo (never Tim), no assistant names", () => {
  const html = live();
  for (const fact of ["Serious Training.", "40+", "600+", "866.436.4959", "4815 Orchard Rd, Garfield Heights, OH 44128", "17,000"]) assert.ok(html.includes(fact), fact);
  const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  assert.ok(!/\bTim\b/.test(text), "Lorenzo is never Tim in public words");
  assert.ok(!/claude|anthropic|\bAI\b/i.test(html + read("lib/trainer2-pages.js") + read("lib/trainer2-page-template.js")), "no assistant names");
  assert.ok(!/\$\s?\d/.test(text), "no prices");
  // the bio is the trainer's own published bio
  const bio = JSON.parse(read("trainer_bios.json"))["lorenzo-miller"].bio.replace(/\s+/g, " ");
  for (const p of lorenzo.bio) assert.ok(bio.includes(p.replace(/\s+/g, " ")), p.slice(0, 40));
});

test("every photo, poster and video the page uses ships with the site", () => {
  const html = live();
  const paths = [...new Set([...html.matchAll(/(?:src|poster|href|srcset)="(\/assets\/[^"\s?]+)/g)].map(m => m[1])
    .concat([...html.matchAll(/(\/assets\/[^"\s,?]+\.webp)/g)].map(m => m[1])))];
  assert.ok(paths.length > 15);
  for (const p of paths) assert.ok(existsSync(resolve(ROOT, "." + p)), p);
  // no AI-made media: only the real files
  assert.ok(!/ai-intro|hf-2026|d1-founder/.test(html));
});

test("route: /trainer/<slug> is a NEW rewrite that cannot collide with anything existing", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const rw = vercel.rewrites;
  const i = rw.findIndex(r => r.source === "/trainer/:slug");
  assert.ok(i >= 0);
  assert.equal(rw[i].destination, "/api/trainer2-page?slug=:slug");
  assert.equal(rw[rw.length - 1].source, "/:slug", "the catch-all trainer results rewrite stays last");
  assert.ok(!existsSync(resolve(ROOT, "trainer")) && !existsSync(resolve(ROOT, "trainer.html")), "no static file or folder answers /trainer");
  // middleware only looks at ONE path segment, so it never sees /trainer/<slug>
  const matcher = read("middleware.js").match(/matcher: \["(.+?)", "\/sitemap\.xml"\]/)[1].replace(/\\\\/g, "\\");
  const re = new RegExp(`^${matcher}$`);
  assert.ok(re.test("/about"), "sanity: the matcher matches a one-segment path");
  assert.ok(!re.test("/trainer/lorenzo-miller"));
  // the existing rewrites are all still there, in their order
  const sources = rw.map(r => r.source).filter(s => s !== "/trainer/:slug");
  assert.deepEqual(sources, ["/ads/:slug", "/p/:slug", "/book", "/book/:slug", "/trainer-bio-:slug", "/:slug"]);
});

test("api/trainer2-page: 200 for a published page, 404 for anything else, practice copy never cached or indexed", async () => {
  const handler = require("../api/trainer2-page.js");
  const before = process.env.LDTT_SANDBOX;
  try {
    delete process.env.LDTT_SANDBOX;
    let res = mockRes();
    await handler({ method: "GET", query: { slug: "lorenzo-miller" } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["cache-control"], /s-maxage=600/);
    assert.match(res.body, /fbq\('init'/);
    res = mockRes();
    await handler({ method: "GET", query: { slug: "fred-harris" } }, res);
    assert.equal(res.statusCode, 404, "a trainer without the add-on has no 2.0 page");
    res = mockRes();
    await handler({ method: "POST", query: { slug: "lorenzo-miller" } }, res);
    assert.equal(res.statusCode, 405);
    process.env.LDTT_SANDBOX = "1";
    res = mockRes();
    await handler({ method: "GET", query: { slug: "lorenzo-miller" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["cache-control"], "no-store, max-age=0");
    assert.match(res.headers["x-robots-tag"], /noindex/);
    assert.ok(!/fbq\(/.test(res.body));
  } finally {
    if (before === undefined) delete process.env.LDTT_SANDBOX; else process.env.LDTT_SANDBOX = before;
  }
});

test("api/trainer2-lead: the trainer and source page are fixed on the server; the lead enters the one pipeline", async () => {
  const handler = require("../api/trainer2-lead.js");
  const saved = { loadSettings: B.loadSettings, trainerRow: B.trainerRow, createLead: B.createLead, routeZip: B.routeZip, enterPipeline: P.enterPipeline };
  const calls = { create: [], enter: [] };
  const setting = { slug: "lorenzo-miller", active: true, schedule_id: "x", trainer_id: "t1" };
  let cards = [{ slug: "lorenzo-miller" }, { slug: "eric-beck" }];
  B.loadSettings = async () => [setting, { slug: "eric-beck", active: true, schedule_id: "y" }];
  B.trainerRow = async slug => ({ id: "t1", slug, full_name: "Lorenzo Miller", market: "Cleveland, OH" });
  B.createLead = async args => { calls.create.push(args); return { lead: { id: "lead-1" }, reused: false }; };
  B.routeZip = async () => ({ cards });
  P.enterPipeline = async (id, opts) => { calls.enter.push([id, opts]); return { status: 200, body: { ok: true, book_url: `https://lorenzosdogtrainingteam.com/book/lorenzo-miller?lead=${id}&direct=1` } }; };
  try {
    const body = { first_name: "Pat", last_name: "Doe", phone: "(216) 555-0100", email: "pat@example.com", zip: "44128", address: "1 Main St", city: "Cleveland", state: "OH",
      problem: "Barking", sms_consent: true, trainer_slug: "eric-beck", assigned_trainer: "Eric Beck", source_page: "https://evil.example/x", lead_kind: "ebook", utm_source: "facebook" };
    let res = mockRes();
    await handler({ method: "POST", query: { page: "lorenzo-miller" }, headers: {}, body }, res);
    assert.equal(res.statusCode, 200);
    const { intake, setting: used, via } = calls.create[0];
    assert.equal(intake.trainer_slug, "lorenzo-miller", "a browser-sent trainer is ignored");
    assert.equal(intake.assigned_trainer, "Lorenzo Miller");
    assert.equal(intake.source_page, "https://www.lorenzosdogtrainingteam.com/trainer/lorenzo-miller");
    assert.equal(intake.lead_kind, "", "always an evaluation request");
    assert.equal(intake.utm_source, "facebook", "the ad's UTM tags ride along");
    assert.equal(used.slug, "lorenzo-miller");
    assert.equal(via, "trainer2-page");
    assert.deepEqual(calls.enter, [["lead-1", { via: "trainer2-page" }]]);
    assert.equal(res.body.trainer_slug, "lorenzo-miller");
    assert.match(res.body.book_url, /\/book\/lorenzo-miller\?lead=lead-1&direct=1$/);

    // a ZIP outside the trainer's range: still HIS lead, but no booking page full of other trainers; the office calls
    cards = [{ slug: "eric-beck" }];
    res = mockRes();
    await handler({ method: "POST", query: { page: "lorenzo-miller" }, headers: {}, body: { ...body, zip: "90210" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(calls.create[1].setting.slug, "lorenzo-miller");
    assert.equal(res.body.book_url, null);
    assert.match(res.body.message, /Lorenzo's office will call you/);

    // no calendar: the lead still carries his slug, so the pipeline never re-routes it by ZIP
    B.loadSettings = async () => [];
    res = mockRes();
    await handler({ method: "POST", query: { page: "lorenzo-miller" }, headers: {}, body }, res);
    assert.equal(calls.create[2].setting.slug, "lorenzo-miller");
    assert.equal(B.trainerFields(calls.create[2].setting, { id: "t1", full_name: "Lorenzo Miller" }).trainer_slug, "lorenzo-miller");
    assert.equal(res.body.book_url, null);

    res = mockRes();
    await handler({ method: "POST", query: { page: "fred-harris" }, headers: {}, body }, res);
    assert.equal(res.statusCode, 404);
    res = mockRes();
    await handler({ method: "GET", query: { page: "lorenzo-miller" }, headers: {} }, res);
    assert.equal(res.statusCode, 405);
    res = mockRes();
    await handler({ method: "POST", query: { page: "lorenzo-miller" }, headers: {}, body: { first_name: "" } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.create.length, 3, "nothing is saved for a bad request");
  } finally {
    Object.assign(B, { loadSettings: saved.loadSettings, trainerRow: saved.trainerRow, createLead: saved.createLead, routeZip: saved.routeZip });
    P.enterPipeline = saved.enterPipeline;
  }
});

test("the office pipeline reads this page's leads as Lorenzo's trainer page, a website lead that gets the office email", () => {
  const source = PAGES.sourcePage("lorenzo-miller");
  const lead = { source_page: source, trainer_slug: "lorenzo-miller", raw_payload: { source_page: source } };
  assert.equal(P.sourceWords(lead, "trainer2-page", { full_name: "Lorenzo Miller" }), "Trainer page: Lorenzo Miller");
  assert.equal(SA.expectsPipeline(lead), true, "the alert bell expects its texts like every website lead");
  // not the old "trainer landing page: <name>" label: that one skips the pipeline's office email on live because
  // FormSubmit already sent it. This door has no FormSubmit, so the office email must go.
  assert.ok(!/^trainer landing page/i.test(source));
  assert.ok(!/^https?:\/\/[^/]+\/ads\//.test(source), "never mistaken for a 2.0 ad page");
});

test("the existing doors and pages are untouched by this add-on", () => {
  for (const file of ["api/booking-lead.js", "assets/v2/v2.js", "lib/ad2-page-template.js", "lib/pipeline.js", "lib/booking.js", "middleware.js", "lorenzomiller.html"]) {
    assert.ok(!read(file).includes("trainer2"), `${file} knows nothing about the 2.0 trainer page`);
  }
});
