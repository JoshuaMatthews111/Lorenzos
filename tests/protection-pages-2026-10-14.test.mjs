// Joshua 2026-10-14: Protection Training landing pages at /protection/<slug>, six markets only,
// same lead flow as the market pages (v2.js -> /api/booking-lead, trainer pick via /api/booking).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("six markets render with the booking-lead flow, videos and per-market prefills", () => {
  const P = require("../lib/protection-pages.js");
  assert.deepEqual(Object.keys(P.MARKETS), ["atlanta", "cleveland", "fort-worth", "san-antonio", "durham", "navarre"]);
  for (const [slug, m] of Object.entries(P.MARKETS)) {
    const h = P.renderProtectionPage(slug);
    assert.match(h, /data-kind="evaluation"[\s\S]*data-endpoint="\/api\/booking-lead"/, slug);
    assert.match(h, /data-trainer-pick data-endpoint="\/api\/booking"/, slug);
    assert.ok(h.includes(`<option value="${m.code}" selected>`), `${slug}: state preselected`);
    assert.ok(h.includes(`placeholder="${m.zip}"`), `${slug}: zip example`);
    assert.ok(h.includes("youtube-nocookie.com/embed/PHK-ADY03N4") && h.includes("youtube-nocookie.com/embed/zAnd5G_-Ms4"), `${slug}: both landscape videos`);
    assert.ok(h.includes("Protection Work") && h.includes("Controlled Aggression"), `${slug}: video titles`);
    // Joshua 2026-10-15: no way off the landing page - the only links are tel:, in-page anchors and the legal pages (new tab).
    for (const bad of ['href="/"', 'href="/dog-training"', 'href="/find-a-trainer"', 'href="/contact"']) assert.ok(!h.includes(bad), `${slug}: no exit link ${bad}`);
    assert.ok(h.includes("not about creating aggression"), `${slug}: responsible framing`);
    assert.doesNotMatch(h, /Jessica L\.|Mark R\.|Emily S\./, `${slug}: no mock testimonials`);
    assert.match(h, /approved-homepage-reviews/, `${slug}: real reviews feed`);
    assert.match(h, /name="sms_consent"[\s\S]*Reply STOP/, `${slug}: consent wording`);
  }
  assert.equal(P.renderProtectionPage("tallahassee"), null, "only the six markets");
});

test("static pages exist with text spots; the rewrite serves them before the catch-all; sitemap lists them", () => {
  const v = JSON.parse(read("vercel.json"));
  const i = v.rewrites.findIndex(r => r.source === "/protection/:slug");
  const catchAll = v.rewrites.findIndex(r => r.source === "/:slug");
  assert.ok(i >= 0 && i < catchAll, "/protection/:slug must win over the trainer catch-all");
  assert.equal(v.rewrites[i].destination, "/protection-:slug");
  const sitemap = read("sitemap.xml");
  const manifest = JSON.parse(read("site-text-manifest.json"));
  for (const slug of ["atlanta", "cleveland", "fort-worth", "san-antonio", "durham", "navarre"]) {
    const page = read(`protection-${slug}.html`);
    assert.ok(page.includes("data-edit="), `${slug}: Page Editor text spots (rule 61)`);
    assert.ok(page.includes("/script.js?v="), `${slug}: script.js applies the office text`);
    assert.ok(sitemap.includes(`/protection/${slug}</loc>`), `${slug}: in the sitemap`);
    assert.equal(manifest.pages[`protection-${slug}`]?.path, `/protection/${slug}`, `${slug}: in the site-text manifest`);
  }
  assert.match(read("protection-cleveland.html"), /4815 Orchard Rd/, "Cleveland shows the Training Center");
  assert.doesNotMatch(read("protection-atlanta.html"), /4815 Orchard Rd.*Training Center —/, "other markets stay in-home");
  // the exact reference photos
  const atlanta = read("protection-atlanta.html");
  for (const img of ["/assets/protection/hero.webp", "/assets/protection/eval.webp", "/assets/protection/inc1.webp", "/assets/protection/inc6.webp"]) assert.ok(atlanta.includes(img), img);
});
