// E-book (free guide) leads (Joshua 2026-09-30): first + last name required, ZIP, phone, the SMS box; with SMS consent
// the lead gets the booking-link text + follow-ups like any lead; the ad 2.0 form really sends (it sent nothing).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("the ad 2.0 free-guide form: first + last name, email, phone, ZIP, the SMS box, and it SENDS to the lead door", () => {
  const T = require("../lib/ad2-page-template.js");
  const html = T.renderPage(T.fromStarter("d2", { market: "Pensacola, FL", newSlug: "pensacola-test" }));
  const form = (html.match(/<form class="lead pdf-optin" data-kind="ebook"[\s\S]*?<\/form>/) || [""])[0];
  for (const name of ["first_name", "last_name", "email", "phone", "zip"]) assert.match(form, new RegExp(`name="${name}"[^>]*required`), name);
  assert.match(form, /name="sms_consent"/);
  assert.match(form, /data-endpoint="[^"]+"/, "a real endpoint on a published page");
  assert.doesNotMatch(html, /Free guide, sent to your inbox\./, "no promise we do not keep");
  const v2 = read("assets/v2/v2.js");
  assert.match(v2, /if \(form\.getAttribute\("data-kind"\) === "ebook" && form\.getAttribute\("data-endpoint"\)\) \{\n        sendEbook\(form, status, button\);/);
  assert.match(v2, /lead_kind: "ebook",/);
  assert.doesNotMatch(v2, /Sandbox preview: nothing was sent\. On the live page/);
});

test("server: an e-book lead is recorded as one, never jumps to booking, and enters the pipeline ONLY with SMS consent", () => {
  const B = require("../lib/booking.js");
  assert.equal(B.cleanLeadIntake({ first_name: "A", phone: "(216) 555-0100", lead_kind: "ebook" }).value.lead_kind, "ebook");
  assert.equal(B.cleanLeadIntake({ first_name: "A", phone: "(216) 555-0100", lead_kind: "x" }).value.lead_kind, "");
  const booking = read("lib/booking.js");
  assert.match(booking, /intake\.lead_kind === "ebook" \? \{ lead_type: "pdf_download", lead_magnet: "The 5-Step Calm Dog Blueprint", problem: "your dog" \}/);
  assert.match(read("api/booking-lead.js"), /if \(intake\.value\.lead_kind === "ebook"\) \{\n      return res\.status\(200\)\.json\(\{ ok: true, lead_id: lead\.id, ebook: true, book_url: null/);
  const pipe = read("lib/pipeline.js");
  assert.match(pipe, /if \(rawOf\(lead\)\.lead_type === "pdf_download" && lead\.sms_consent !== true\) return \{ status: 200, body: \{ ok: true, lead_id: lead\.id, trainer_slug: null, book_url: null, skipped: "ebook" \} \};/);
});

test("the older ad pages' e-book forms: last name + ZIP required, the SMS tick is sent, then the pipeline", () => {
  for (const file of ["ad-funnel.js", "market-landing.js"]) {
    const src = read(file);
    assert.match(src, /<input (required )?name="last_name"[^>]*( required)?/, `${file} last name`);
    assert.match(src, /name="zip" inputmode="numeric"/, `${file} ZIP`);
    assert.match(src, /sms_consent: (data|formData)\.get\("sms_consent"\) === "yes" \? "yes" : "no",/, `${file} sends the tick`);
    assert.match(src, /op: "enter", lead_id: canonical\.lead_id, via: "ebook"/, `${file} enters the pipeline`);
  }
  assert.match(read("lib/pipeline.js"), /rawOf\(lead\)\.lead_type === "pdf_download" && rawOf\(lead\)\.delivery_email !== undefined\) return \{ status: "skipped" \};/, "no second office email");
});

test("Harrison 2026-09-29: a YouTube video plays in ONE player (the hidden file player really hides)", () => {
  assert.match(read("assets/v2/v2.css"), /\.mvideo video\[hidden\]\{display:none\}/);
  assert.match(read("assets/v2/v2.js"), /if \(yt\) \{\n        v\.hidden = true;/);
});

test("Harrison 2026-09-29: a box with its own video shows that video's cover; a box without one is unchanged", async () => {
  const T = require("../lib/ad2-page-template.js");
  const base = T.fromStarter("d2", { market: "Atlanta, GA", newSlug: "atl-test" });
  const plain = T.renderPage(base);
  assert.doesNotMatch(plain, /class="vcover"/, "no own video: nothing new");
  const withVideos = T.renderPage({ ...base, videos2: { ba1: "https://www.youtube.com/watch?v=abcDEF12345", founder: "https://x.supabase.co/storage/v1/object/public/pages/a.mp4" } });
  assert.match(withVideos, /<img class="vcover" src="https:\/\/i\.ytimg\.com\/vi\/abcDEF12345\/hqdefault\.jpg"/);
  assert.match(withVideos, /<video class="vcover" src="https:\/\/x\.supabase\.co\/storage\/v1\/object\/public\/pages\/a\.mp4#t=0\.5" muted playsinline preload="metadata"/);
  assert.match(read("assets/v2/v2.css"), /\.vcover\{position:absolute;inset:0;[^}]*pointer-events:none/);
});

test("Zoom 2026-09-29: training cards in Lorenzo's order, Behavior Modification, each opens its info panel (no prices)", () => {
  const T = require("../lib/ad2-page-template.js");
  for (const d of ["d2", "d3"]) { // d1 draws no training cards
    const html = T.renderPage(T.STARTERS.find(x => x.design === d));
    const titles = [...html.matchAll(/<article class="a card" data-open="svc-([a-z]+)"[\s\S]*?<h3>([^<]+)<\/h3>/g)].map(m => m[2]);
    assert.deepEqual(titles, ["PUPPY TRAINING", "OBEDIENCE TRAINING", "ADVANCED TRAINING", "BEHAVIOR MODIFICATION", "BOARD &amp; TRAIN", "SERVICE DOG TRAINING"], d);
    for (const key of ["puppy", "obedience", "advanced", "behavior", "board", "service"]) assert.match(html, new RegExp(`<div class="modal" id="m-svc-${key}" hidden>`), `${d} ${key}`);
    const panels = (html.match(/<div class="modal" id="m-svc-[\s\S]*?<\/div><\/div>/g) || []).join("");
    assert.doesNotMatch(panels, /\$\s?\d/, "no prices in the panels");
  }
  assert.match(read("assets/v2/v2.js"), /article\[data-open\]\[role=button\]/);
});
