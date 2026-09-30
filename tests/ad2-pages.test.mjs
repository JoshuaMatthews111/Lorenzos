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
  // Rule 85 amended 2026-09-23 (Joshua: Arrison's 2.0 updates "should be pushed and go live too"):
  // Send to live carries ad2 pages with the ad2 cleaner, still draft-only, never flipping a live page's type.
  const stl = read("api/send-to-live.js");
  assert.match(stl, /const isAd2 = page\.page_type === "ad2";/);
  assert.match(stl, /isAd2 \? ad2\.normalizeContent\(page\.draft_content \|\| \{\}\) : template\.normalizeContent/);
  assert.match(stl, /already exists on live as a different kind of page/);
  assert.match(stl, /page_type: page\.page_type \|\| "ad"/);
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
  assert.ok(!/public\./.test(migration.replace(/^--.*$/gm, "")), "the practice migration never changed the live table");
  // 2026-09-23: the live twin exists (rule 85 amended): public.ad_pages accepts ad2 the same way.
  const liveMigration = read("supabase/migrations/20260923220000_public_ad2_page_type.sql");
  assert.match(liveMigration, /alter table public\.ad_pages add constraint ad_pages_page_type_check check \(page_type = any \(array\['ad'::text, 'site'::text, 'landing'::text, 'ad2'::text\]\)\);/);
  assert.ok(!/practice\./.test(liveMigration.replace(/^--.*$/gm, "")), "the live migration never touches the practice schema");
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

test("Joshua 2026-09-16: the top photo can fit (no stretch), move and darken; every frame can move and resize", () => {
  const c = T.normalizeContent({ design: "d1", slug: "x", pframe: { hero: { fit: "cover", shade: 30, y: 20 }, founder: { dx: -40, dw: 60, z: 120 }, golden: { dh: 999 } } });
  assert.deepEqual(c.pframe, { hero: { y: 20, fit: "cover", shade: 30 }, founder: { z: 120, dx: -40, dw: 60 } }, "out-of-range frame moves are dropped");
  const html = T.renderPage(c, { practice: true });
  assert.match(html, /--hpos:50% 20%;--hsz:cover;--hshade:0\.3/, "the top photo fits, focuses and shades through CSS variables");
  assert.match(html, /ph-founder" style="--x:338;--y:-1;--w:706;--h:275"/, "the founder frame moved left and grew wider");
  const plain = T.renderPage(T.normalizeContent({ design: "d1", slug: "x" }), { practice: true });
  assert.doesNotMatch(plain, /--hpos|--hshade/, "a page without framing keeps the design's exact hero");
});

test("a shorter line list stays shorter: no starter words are borrowed to fill the gap", () => {
  const c = T.normalizeContent({ design: "d1", slug: "x", sub: ["One", "Two", "Start with a free in-home evaluation."] });
  assert.deepEqual(c.sub, ["One", "Two", "Start with a free in-home evaluation.", ""]);
  assert.equal(T.normalizeContent({ design: "d1", slug: "x" }).sub.length, 4, "a page with no saved lines still gets the starter's four");
});

test("Joshua 2026-09-16: any element of the design can be moved, resized and re-sized (elbox), tagged only in the editor", () => {
  const c = T.normalizeContent({ design: "d1", slug: "x", elbox: { "hero:0": { dx: -20, fs: 80 }, "hero:2": { dy: 15, dw: 100 }, bogus: { dx: 5 }, "hero:9": { dx: 9999 } } });
  assert.deepEqual(c.elbox, { "hero:0": { dx: -20, fs: 80 }, "hero:2": { dy: 15, dw: 100 } });
  const ed = T.renderPage(c, { practice: true, editor: true });
  const pub = T.renderPage(c, { practice: true });
  assert.match(ed, /<h1 class="a" data-sb-el="hero:0" style="--x:44;--y:57;--fs:51\.2;--lh:44"/, "the headline moved left and shrank to 80% in the editor");
  assert.match(pub, /<h1 class="a" style="--x:44;--y:57;--fs:51\.2;--lh:44"/, "and on the public page, without editor tags");
  assert.ok((ed.match(/data-sb-el=/g) || []).length > 50 && !/data-sb-el=/.test(pub), "every positioned element is clickable in the editor only");
  const plain = T.renderPage(T.normalizeContent({ design: "d1", slug: "x" }), { practice: true });
  assert.doesNotMatch(plain, /data-sb-el/, "a page without moves keeps its exact bytes");
});

test("Joshua 2026-09-16: the trash can hides an element or photo (never deletes it) and an element can take a font", () => {
  const c = T.normalizeContent({ design: "d2", slug: "x", elbox: { "hero:2": { hide: true, label: "Moved to Bay County", font: "Georgia" }, "hero:0": { font: "Comic Sans" } }, pframe: { ba1: { hide: true }, hero: { hide: true } } });
  assert.deepEqual(c.elbox, { "hero:2": { hide: true, label: "Moved to Bay County", font: "Georgia" } }, "unknown fonts are dropped");
  assert.deepEqual(c.pframe, { ba1: { hide: true } }, "the top photo can never be hidden");
  const html = T.renderPage(c, { practice: true });
  assert.match(html, /hero-sub" style="[^"]*display:none/, "a hidden element is not shown");
  assert.match(html, /class="a ba ba2" style="[^"]*display:none/, "a hidden photo frame is not shown");
  assert.match(html, /font-family:'Georgia'/, "the font is applied");
  assert.ok(T.FONTS.includes("Oswald") && T.FONTS.length >= 8, "a preloaded font list");
});

test("Joshua 2026-09-16: elements and photo frames can be rotated (not the top photo)", () => {
  const c = T.normalizeContent({ design: "d2", slug: "x", elbox: { "hero:0": { rot: -12 }, "hero:1": { rot: 400 } }, pframe: { ba1: { rot: 5 }, hero: { rot: 9 } } });
  assert.deepEqual(c.elbox, { "hero:0": { rot: -12 } });
  assert.deepEqual(c.pframe, { ba1: { rot: 5 } });
  const html = T.renderPage(c, { practice: true });
  assert.match(html, /<h1 class="a" style="[^"]*transform:rotate\(-12deg\)/);
  assert.match(html, /class="a ba ba2" style="[^"]*rotate\(5deg\)/);
});

// Joshua 2026-09-16: "make the required fields of city, state, street address in all the pages ... with an autofill
// option, but that full address is required in those fields on the landing pages 2.0, all of them."
test("Joshua 2026-09-16: street address, city and state are required on every 2.0 evaluation form, with browser autofill", () => {
  for (const starter of T.STARTERS) {
    const html = T.renderPage(starter, { practice: true });
    const form = (html.match(/<form class="lead contact-intake"[\s\S]*?<\/form>/) || [""])[0];
    assert.match(form, /^<form class="lead contact-intake" data-kind="evaluation" data-endpoint="\/api\/booking-lead" autocomplete="on" novalidate>/, `${starter.design}: the form asks the browser to autofill`);
    assert.match(form, /<label class="wide">Street address<input name="address" autocomplete="street-address" maxlength="300" required/, `${starter.design}: street address`);
    assert.match(form, /<label>City<input name="city" autocomplete="address-level2" maxlength="80" required/, `${starter.design}: city`);
    assert.match(form, /<label>State<select name="state" autocomplete="address-level1" required><option value="">Choose a state<\/option>/, `${starter.design}: state list`);
    assert.match(form, /<input name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="10" required/, `${starter.design}: ZIP stays required`);
    assert.equal((form.match(/<option value="[A-Z]{2}"/g) || []).length, 51, `${starter.design}: the 50 states + DC`);
    const own = T.normalizeContent(starter).state; // FL / FL / MI, read from the market line
    assert.match(own, /^[A-Z]{2}$/);
    assert.match(form, new RegExp(`<option value="${own}" selected>`), `${starter.design}: the page's own state is picked first`);
    for (const name of ["first_name", "last_name", "phone", "email"]) assert.match(form, new RegExp(`name="${name}" [^>]*autocomplete="[a-z-]+"`), `${starter.design}: ${name} autofills`);
  }
  assert.equal((T.renderPage(T.normalizeContent({ design: "d1", slug: "x", market: "Somewhere" }), {}).match(/<option value="[A-Z]{2}" selected>/g) || []).length, 0, "a page without a state picks none");
  // The client script sends the three fields and explains a missing one in plain words.
  const js = read("assets/v2/v2.js");
  assert.match(js, /address: f\.address \? f\.address\.value\.trim\(\) : ""/);
  assert.match(js, /city: f\.city \? f\.city\.value\.trim\(\) : ""/);
  assert.match(js, /state: f\.state \? f\.state\.value : ""/);
  assert.match(js, /address: "Please add your street address so the trainer knows where to come\."/);
  assert.match(read("assets/v2/v2.css"), /\.lead select\[aria-invalid="true"\]/, "a missed state box is outlined red like an input");
  // The server keeps them: on the lead's own columns and in raw_payload (lib/pipeline.js reads lead.address for the visit).
  const B = require("../lib/booking.js");
  const intake = B.cleanLeadIntake({ first_name: "A", phone: "4405550100", address: "1 Main St", city: "Cleveland", state: "oh", zip: "44128" });
  assert.deepEqual([intake.value.address, intake.value.city, intake.value.state, intake.errors], ["1 Main St", "Cleveland", "OH", []]);
  assert.equal(B.cleanLeadIntake({ first_name: "A", phone: "4405550100" }).errors.length, 0, "older forms without an address still pass");
  assert.equal(B.cleanLeadIntake({ first_name: "A", phone: "4405550100", state: "Narnia" }).value.state, "", "only a real state is kept");
  const booking = read("lib/booking.js");
  assert.match(booking, /\.\.\.\(intake\.address \? \{ address_line_1: intake\.address \} : \{\}\)/);
  assert.match(booking, /\.\.\.\(intake\.city \? \{ city: intake\.city \} : \{\}\),\n\s*\.\.\.\(intake\.state \? \{ state: intake\.state \} : \{\}\),\n\s*dog_name:/);
  assert.match(booking, /\.\.\.\(intake\.address \? \{ address: intake\.address \} : \{\}\),\n\s*\.\.\.\(intake\.city \? \{ city: intake\.city \} : \{\}\),\n\s*\.\.\.\(intake\.state \? \{ state: intake\.state \} : \{\}\),\n\s*\.\.\.\(intake\.utm_source/);
});

// Joshua 2026-09-23: "the trainers should appear when the ZIP code is typed on the page" — under the ZIP box, on the
// 2.0 page itself, pickable, and the pick rides along with the lead.
test("Joshua 2026-09-23: the trainers near the typed ZIP appear under the ZIP box and one can be picked", () => {
  assert.equal(T.VERSION, "20260930ad19"); // 2026-09-26: founder title + icon circles (rule 119/120)
  for (const starter of T.STARTERS) {
    const html = T.renderPage(starter, { practice: true });
    const form = (html.match(/<form class="lead contact-intake"[\s\S]*?<\/form>/) || [""])[0];
    // the area sits right under the ZIP box and starts empty and hidden
    assert.match(form, /<label>ZIP code<input name="zip"[^>]*><\/label>\n<div class="tnear wide" data-trainer-pick /, `${starter.design}: the trainer area follows the ZIP box`);
    assert.match(form, /data-endpoint="\/api\/booking"/, `${starter.design}: it asks the same site's booking API`);
    assert.match(form, /data-debounce="400"/, `${starter.design}: the debounce hook`);
    assert.match(form, /<div class="tnear wide" data-trainer-pick [^>]*hidden>/, `${starter.design}: nothing shows until a ZIP is typed`);
    // the three wordings, in the page itself
    assert.match(form, /<h3 class="tnear-h">Trainers near you<\/h3>/, `${starter.design}: heading`);
    assert.match(form, /<p class="tnear-sub">Pick who you want\. You can still change this on the next screen\.<\/p>/, `${starter.design}: the short line`);
    assert.match(form, /data-loading="Looking for trainers near you…"/, `${starter.design}: while loading`);
    assert.match(form, /data-empty="We do not have a trainer within 50 miles of that ZIP yet\. Send the form and our office will call you\."/, `${starter.design}: nobody in range`);
    // the pick travels with the lead, under the same names the trainer pages send
    assert.match(form, /<input type="hidden" name="trainer_slug" value="">/, `${starter.design}: the hidden trainer field`);
    assert.match(form, /<input type="hidden" name="assigned_trainer" value="">/, `${starter.design}: the trainer's name`);
  }
  // the page's own market trainer is named on the page, and is kept when the office saves it (rule 85: only when set)
  assert.equal(T.normalizeContent({ design: "d1", slug: "x", owner_slug: "Dylan Atkinson!" }).owner_slug, "dylan-atkinson");
  assert.ok(!("owner_slug" in T.normalizeContent({ design: "d1", slug: "x" })), "a page without an owner keeps its exact shape");
  assert.match(T.renderPage(T.normalizeContent({ design: "d2", slug: "x", owner_slug: "tabatha-shelley" }), { practice: true }), /data-owner="tabatha-shelley"/);
  assert.match(T.renderPage(T.STARTERS[0], { preview: true }), /data-trainer-pick data-endpoint=""/, "the Page Studio preview asks the booking API nothing");

  // the page script: fetch + render + select, and the chosen slug is sent
  const js = read("assets/v2/v2.js");
  assert.match(js, /function trainerPicker\(form\)/);
  assert.match(js, /fetch\(endpoint \+ "\?zip=" \+ encodeURIComponent\(zip\)/, "it asks /api/booking for that ZIP");
  assert.match(js, /timer = setTimeout\(look, wait\); \/\/ debounce/, "the ZIP box is debounced");
  assert.match(js, /if \(mine !== seq\) return;/, "a stale answer is ignored");
  assert.match(js, /radio\.type = "radio";\n\s*radio\.name = "trainer_pick";/, "real radios, one pick at a time");
  assert.match(js, /owner && slugs\.indexOf\(owner\) > -1 \? owner : slugs\[0\]/, "the page's own trainer is preselected, else the nearest");
  assert.match(js, /cal\.textContent = "Online calendar";/);
  assert.match(js, /miles\.textContent = \(t\.miles == null \? "" : t\.miles\) \+ " mi away";/);
  assert.match(js, /trainer_slug: f\.trainer_slug \? f\.trainer_slug\.value : ""/, "the pick is sent with the lead");
  assert.match(js, /assigned_trainer: f\.assigned_trainer \? f\.assigned_trainer\.value : ""/);
  assert.match(read("assets/v2/v2.css"), /\.lead \.tcard\.on\{border-color:var\(--red\)/, "the picked card is clearly marked");

  // the server keeps the pick, and only when that trainer really is near the typed ZIP
  const B = require("../lib/booking.js");
  assert.equal(B.cleanLeadIntake({ first_name: "A", phone: "4405550100", trainer_slug: "Harley McGrew" }).value.trainer_slug, "harleymcgrew");
  assert.equal(B.cleanLeadIntake({ first_name: "A", phone: "4405550100" }).value.trainer_slug, "");
  const lead = read("api/booking-lead.js");
  assert.match(lead, /\(route\.cards \|\| \[\]\)\.find\(card => card\.slug === intake\.value\.trainer_slug\)/, "the pick must be one of the cards for this ZIP");
  assert.match(lead, /const setting = \(picked && B\.settingBySlug\(settings, picked\.slug\)\) \|\| route\.calendar;/, "otherwise the routing we had");
});

test("Joshua 2026-09-16: a photo can show whole (contain) instead of filling its frame", () => {
  const c = T.normalizeContent({ design: "d2", slug: "x", pframe: { founder: { fit: "contain", y: 0 }, hero: { fit: "contain" } } });
  assert.deepEqual(c.pframe, { founder: { y: 0, fit: "contain" } }, "the top photo knows only cover");
  assert.match(T.renderPage(c, { practice: true }), /object-fit:contain;object-position:50% 0%/);
});
