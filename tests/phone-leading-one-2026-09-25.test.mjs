// Missy + Rachel 2026-09-25: a phone autofilled as "+1 (216) 555-1234" (or a typed 1 followed by an autofilled +1)
// was cut to "(121) 655-5123" - the leading 1 kept, the last digit lost. The 2026-09-15 fix only stripped a 1 when
// there were EXACTLY 11 digits, and script.js's older formatter (also run on page load) never stripped it at all.
// Now every copy strips leading 1s while more than 10 digits remain (US area codes never start with 1).
// Also: the office can correct a lead's phone in the office lead panel (10 digits, area code first).
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const INPUTS = ["+1 (216) 555-1234", "12165551234", "1+1 (216) 555-1234", "1 1 216 555 1234", "(216) 555-1234", "2165551234"];

const FORMATTER_FILES = ["script.js", "market-landing.js", "assets/v2/v2.js", "lib/booking-page.js", "lib/ad-page-template.js", "trainer-backoffice/app.js"];
const AD_PAGES = readdirSync(root).filter(f => /^dog-training-.*\.html$/.test(f));

test("no copy of the phone formatter keeps the exact-11 rule or cuts to 10 digits before stripping the 1", () => {
  for (const file of [...FORMATTER_FILES, ...AD_PAGES]) {
    const src = read(file);
    assert.doesNotMatch(src, /d\.length === 11 && d\.(charAt\(0\) === ["']1["']|startsWith\("1"\))/, file);
    assert.doesNotMatch(src, /const digits=input\.value\.replace\(\/\\D\/g,''\)\.slice\(0,10\)/, file);
  }
  assert.ok(AD_PAGES.length >= 12, "every city ad page was checked");
  for (const file of AD_PAGES) assert.match(read(file), /while \(d\.length > 10 && d\.charAt\(0\) === '1'\) d = d\.slice\(1\);/, file);
});

test("script.js's older formatter (also run on page load) keeps the full number when a phone autofills +1", () => {
  const src = read("script.js");
  const block = src.match(/document\.querySelectorAll\('input\[name="phone"\]'\)\.forEach\(input=>\{[\s\S]*?\n\}\);/)[0];
  for (const value of INPUTS) {
    const input = { value, addEventListener() {} };
    vm.runInNewContext(block, { document: { querySelectorAll: () => [input] } });
    assert.equal(input.value, "(216) 555-1234", value);
  }
});

test("the office typing formatter keeps the full number too", () => {
  const app = read("trainer-backoffice/app.js");
  const fn = app.match(/function formatPhoneWhileTyping\(value\) \{[\s\S]*?\n\}\n/)[0];
  const ctx = { formatPhoneNumber: d => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` };
  vm.runInNewContext(`${fn}\nthis.f = formatPhoneWhileTyping;`, ctx);
  for (const value of INPUTS) assert.equal(ctx.f(value), "(216) 555-1234", value);
  assert.equal(ctx.f("(216) 555-12345"), "(216) 555-1234", "an extra key at the end is still dropped");
});

test("the office can correct a lead's phone in the lead panel; only a real 10-digit number saves", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /<span>Phone<\/span><input class="select-pill lead-phone-input" type="tel"[^>]*data-lead-phone="\$\{escapeHtml\(lead\.id\)\}"/);
  const handler = app.match(/const phoneBox = event\.target\.closest\("\[data-lead-phone\]"\);[\s\S]*?\n    return;\n  \}/)[0];
  assert.match(handler, /\/\^\[2-9\]\\d\{9\}\$\//, "area code cannot start with 0 or 1");
  assert.match(handler, /persistLeadFields\(lead, \{ phone: digits \}, detail\)/, "saves through the normal lead save door");
  assert.match(read("api/operational-mutation.js"), /"phone"/, "the save door accepts the phone field");
});
