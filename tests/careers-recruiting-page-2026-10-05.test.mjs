// /careers — company-wide trainer recruiting + application page (DO-NOT-BREAK rule 170).
// The page must save through the SAME path as trainer-application.html (script.js wires
// .trainer-application-form -> submit-trainer-application -> trainer_applications -> /api/form-delivery),
// carry the same field names and choice words (the Google Sheet mapping in api/form-delivery.js depends
// on them), say where it came from ("Recruiting page"), and never claim pay or guarantees.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const root = resolve(import.meta.dirname, "..");
const read = file => readFileSync(resolve(root, file), "utf8");
const page = read("careers.html");
const formOf = html => html.slice(html.indexOf("<form"), html.indexOf("</form>"));
const careersForm = formOf(page);
const oldForm = formOf(read("trainer-application.html"));
const decode = s => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

const names = html => new Set([...html.matchAll(/name="([^"]+)"/g)].map(m => m[1]));
const required = html => new Set([...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)]
  .map(m => m[0]).filter(tag => /\srequired\b/.test(tag)).map(tag => (tag.match(/name="([^"]+)"/) || [])[1]).filter(Boolean));
const radios = html => new Set([...html.matchAll(/type="radio" name="([^"]+)" value="([^"]+)"/g)].map(m => `${m[1]}=${decode(m[2])}`));
const selects = html => Object.fromEntries([...html.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)]
  .map(m => [m[1], [...m[2].matchAll(/<option>([^<]+)<\/option>/g)].map(o => decode(o[1]))]));

test("careers form posts through the existing application path", () => {
  assert.match(careersForm, /<form class="cr-form trainer-application-form"/);
  assert.equal((page.match(/class="[^"]*trainer-application-form/g) || []).length, 1, "exactly one application form");
  assert.match(page, /<script src="supabase-config\.js"><\/script>\s*<script src="script\.js\?v=\d+live\d+"><\/script>/);
  // script.js still owns the save: submit-trainer-application, application_id required, then form-delivery.
  const script = read("script.js");
  assert.match(script, /const trainerApplicationForm=document\.querySelector\('\.trainer-application-form'\)/);
  assert.match(script, /submitPublicFormToSupabase\('submit-trainer-application',entries\)/);
  assert.match(script, /relayFormDeliveries\('trainer_application',entries,canonical,form\)/);
  // The page's own script never posts anywhere.
  const inline = page.slice(page.lastIndexOf("<script>"));
  assert.doesNotMatch(inline, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test("careers form keeps every field name, required rule and choice word of trainer-application.html", () => {
  const extra = [...names(careersForm)].filter(n => !names(oldForm).has(n)).sort();
  const missing = [...names(oldForm)].filter(n => !names(careersForm).has(n));
  assert.deepEqual(missing, []);
  assert.deepEqual(extra, ["inquiry_type", "source_form"]);
  assert.deepEqual([...required(oldForm)].sort(), [...required(careersForm)].sort());
  assert.deepEqual([...radios(oldForm)].sort(), [...radios(careersForm)].sort());
  const oldSelects = selects(oldForm), newSelects = selects(careersForm);
  for (const [name, options] of Object.entries(oldSelects)) assert.deepEqual(newSelects[name], options, name);
  // Every Google Sheet field the delivery maps (except server-filled countries) is on the form.
  const delivery = read("api/form-delivery.js");
  const block = delivery.slice(delivery.indexOf("APPLICATION_FIELDS = {"), delivery.indexOf("};", delivery.indexOf("APPLICATION_FIELDS = {")));
  for (const [, key] of block.matchAll(/(\w+): "entry\.\d+"/g)) {
    if (/_country$/.test(key)) continue;
    assert.ok(names(careersForm).has(key), `missing Google field ${key}`);
  }
});

test("careers applications are labelled Recruiting page and stay full applications", () => {
  assert.match(careersForm, /<input type="hidden" name="source_form" value="Recruiting page">/);
  assert.match(careersForm, /<input type="hidden" name="source_page" value="careers">/);
  assert.match(careersForm, /<input type="hidden" name="inquiry_type" value="full_application">/);
  assert.match(careersForm, /data-form-type="trainer_application"/);
  // The admin Applications screen shows source_form as the Source column and in the detail panel.
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /source_form: row\.source_form \|\| raw\.source_form \|\| ""/);
  assert.match(app, /escapeHtml\(app\.source_form \|\| app\.referral_source \|\| "Website"\)/);
  assert.match(app, /href="\.\.\/careers" target="_blank" rel="noopener">Preview Recruiting Page<\/a>/);
  // The edge function keeps an explicit source_form and inquiry_type.
  const fn = read("supabase/functions/submit-trainer-application/index.ts");
  assert.match(fn, /source_form: clean\(payload\.source_form \|\|/);
  assert.match(fn, /clean\(payload\.inquiry_type\)/);
});

test("careers tracking: Meta pixel PageView, CompleteRegistration after a confirmed save, Google tag", () => {
  assert.match(page, /fbq\('init', '3790623554504010'\);\s*fbq\('track', 'PageView'\);/);
  assert.match(page, /facebook\.com\/tr\?id=3790623554504010&ev=PageView&noscript=1/);
  assert.match(page, /googletagmanager\.com\/gtag\/js\?id=AW-11463464040/);
  assert.match(page, /gtag\('config','AW-11463464040'\)/);
  assert.match(careersForm, /data-conversion-event="trainer_application_submit"/);
  const inline = page.slice(page.lastIndexOf("<script>"));
  assert.match(inline, /status\.classList\.contains\('success'\)/);
  assert.match(inline, /fbq\('track','CompleteRegistration'/);
  assert.match(inline, /window\.LDTT_IS_SANDBOX===true/);
  // No ad-conversion label is fired for applications (those labels belong to dog-owner leads).
  assert.doesNotMatch(page, /WIE3CMK0kr0aEOiomtoq/);
});

test("careers SEO: title, description, canonical, OG and real-fact JSON-LD", () => {
  assert.match(page, /<title>[^<]{20,80}<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]{80,200}">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/www\.lorenzosdogtrainingteam\.com\/careers">/);
  for (const p of ["og:title", "og:description", "og:url", "og:image", "og:type"]) assert.match(page, new RegExp(`property="${p}"`));
  const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const org = blocks.find(b => b["@type"] === "Organization");
  assert.equal(org.foundingDate, "1987");
  assert.equal(org.founder.name, "Lorenzo Miller");
  assert.equal(org.location.address.streetAddress, "4815 Orchard Rd");
  assert.equal(org.location.address.addressLocality, "Garfield Heights");
  assert.ok(blocks.find(b => b["@type"] === "FAQPage").mainEntity.length >= 5);
  assert.ok(!blocks.some(b => /baseSalary|JobPosting/.test(JSON.stringify(b))), "no JobPosting / salary claims");
});

test("careers copy: real facts only, no pay numbers, no AI names, founder is Lorenzo", () => {
  const text = page.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, /\$\s?\d/, "no dollar amounts");
  assert.doesNotMatch(text, /guarantee/i);
  assert.doesNotMatch(page, /\bTim\b/);
  // Assistant / vendor names are spelled out in pieces so this file itself stays free of them.
  for (const name of [["Cla", "ude"], ["Anth", "ropic"], ["Chat", "GPT"], ["Open", "AI"]]) assert.ok(!page.includes(name.join("")), name.join(""));
  for (const fact of ["4815 Orchard Rd", "Garfield Heights", "320+", "1987", "40+", "Not a franchise", "Lorenzo Miller"]) assert.ok(text.includes(fact), fact);
  assert.ok(existsSync(resolve(root, "assets/trainer-headshots/Lorenzo-Miller 360_x_360.jpg")));
  for (const [, src] of page.matchAll(/(?:src|poster|srcset)="(assets\/[^"]+)"/g)) {
    assert.ok(existsSync(resolve(root, decodeURIComponent(src))), `missing asset ${src}`);
  }
  for (const [, slug] of page.matchAll(/href="\/trainer-opportunity-([a-z-]+)"/g)) {
    assert.ok(existsSync(resolve(root, `trainer-opportunity-${slug}.html`)), slug);
  }
});

test("/careers cannot collide: static file, reserved in middleware and Site Builder, in the sitemap", () => {
  const vercel = JSON.parse(read("vercel.json"));
  assert.equal(vercel.cleanUrls, true);
  assert.ok(!vercel.redirects.some(r => /careers/.test(r.source)));
  assert.ok(!vercel.rewrites.some(r => /careers/.test(r.source)));
  assert.match(read("middleware.js"), /"specialty-advanced", "careers", "robots\.txt"/);
  const require = createRequire(import.meta.url);
  const site = require(resolve(root, "lib/site-page-template.js"));
  assert.ok(site.RESERVED_SLUGS.has("careers"));
  assert.ok(site.RESERVED_SLUGS.has("become-a-trainer") && site.RESERVED_SLUGS.has("trainer-application"));
  // Joshua 2026-10-06: live but kept out of the sitemap until the office reviews it.
  assert.doesNotMatch(read("sitemap.xml"), /<loc>https:\/\/www\.lorenzosdogtrainingteam\.com\/careers<\/loc>/);
  // The existing recruiting pages are still there and untouched in purpose.
  assert.match(read("trainer-application.html"), /<form class="panel form trainer-application-form"/);
  assert.match(read("become-a-trainer.html"), /href="trainer-application\.html"/);
});

test("careers on the practice copy stays switched off like every application form (rule 20)", () => {
  const script = read("script.js");
  assert.match(script, /const LDTT_EDGE_PRACTICE_FLAG_DEPLOYED=false;/);
  assert.match(script, /const PRACTICE_LEAD_FORM_SELECTOR='\.contact-intake,\.market-guide-form,\.ad-exit-form,\.office-lead-form,\.booking-intake';/);
  assert.doesNotMatch(careersForm, /class="[^"]*(contact-intake|market-guide-form|ad-exit-form|office-lead-form|booking-intake)/);
  assert.match(page, /\.practice-form-notice\{/);
});
