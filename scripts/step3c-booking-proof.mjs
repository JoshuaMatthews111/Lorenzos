// Step 3c proof (DO-NOT-BREAK rule 74): the redesigned booking page on the PRACTICE COPY, phone + desktop.
//   node scripts/step3c-booking-proof.mjs <base> <outDir>
// Scenarios: ZIP 44105 (Lorenzo, calendar: books one real slot in OUR database only), ZIP 32536 (Daniel,
// calendar: books one slot), ZIP 59101 (nobody within 50 miles: callback), and a trainer with no calendar
// (Eric Beck from 44105: "Request this trainer"). Phone runs go all the way through; desktop runs show
// steps 1-3 without booking again, then the congratulations screen through the lead link.
// Leads made here are practice leads with no SMS consent and a non-tester phone (no customer texts).
// Not deployed (scripts/ is in .vercelignore).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const BASE = (process.argv[2] || "https://ldtt-sandbox.vercel.app").replace(/\/+$/, "");
const OUT = process.argv[3] || path.join(process.env.HOME, "Desktop", "LDTT Pipeline Test 2026-09-12", "step3c");
mkdirSync(OUT, { recursive: true });

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 };
const proof = { base: BASE, at: new Date().toISOString(), runs: [] };

const person = tag => ({ first_name: "Proof", last_name: `3c ${tag}`, phone: "440-555-0144", email: `proof-3c-${tag.toLowerCase()}@example.test`, address: tag === "Crestview" ? "9 Oak St, Crestview, FL 32536" : "1 Test St, Cleveland, OH 44105" });

async function shot(page, name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function fillForm(page, tag, location) {
  const p = person(tag);
  for (const [k, v] of Object.entries(p)) await page.fill(`#evalForm [name="${k}"]`, v);
  if (location && await page.isVisible("#locationBox")) await page.check(`#evalForm input[name="location"][value="${location}"]`);
  const dog = page.locator("#dogs .dog").first();
  await dog.locator('[data-f="name"]').fill("Biscuit");
  await dog.locator('[data-f="sex"]').selectOption("Male");
  await dog.locator('[data-f="fixed"]').selectOption("Yes");
  await dog.locator('[data-f="vaccinated"]').selectOption("Yes");
  await dog.locator('[data-f="age"]').fill("3 years");
  await dog.locator('[data-f="breed"]').fill("Boxer");
  await dog.locator('[data-f="behavior"]').fill("Jumps on guests and pulls on the leash (practice proof, not a real client).");
}

async function run(browser, { label, device, zip, trainer, location, book, request, callback, tag }) {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const r = { label, zip, trainer: trainer || null, errors };
  await page.goto(`${BASE}/book?zip=${zip}`, { waitUntil: "networkidle" });
  await page.waitForSelector(callback ? "#noTrainer:not([hidden])" : ".tcard", { timeout: 20000 });
  r.cards = await page.$$eval(".tcard", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  await shot(page, `${label}-1-zip`);
  if (callback) {
    r.no_trainer_text = await page.textContent("#noTrainer h2");
    if (book) {
      await page.fill('#callbackForm [name="first_name"]', "Proof");
      await page.fill('#callbackForm [name="last_name"]', "3c NoTrainer");
      await page.fill('#callbackForm [name="phone"]', "406-555-0144");
      await page.fill('#callbackForm [name="email"]', "proof-3c-notrainer@example.test");
      const resp = page.waitForResponse(res => res.url().endsWith("/api/booking") && res.request().method() === "POST");
      await page.click("#callbackBtn");
      r.response = await (await resp).json();
      await page.waitForSelector("#stepDone:not([hidden])");
      await shot(page, `${label}-4-done`);
    }
    await ctx.close();
    return r;
  }
  await page.click(`.tcard:has-text("${trainer}")`);
  await page.waitForSelector("#stepForm:not([hidden])");
  await fillForm(page, tag, location);
  await shot(page, `${label}-2-questions`);
  await page.click("#formNext");
  await page.waitForSelector("#stepTime:not([hidden])");
  if (request) {
    await page.waitForSelector("#requestBox:not([hidden])");
    await shot(page, `${label}-3-request`);
    if (book) {
      const resp = page.waitForResponse(res => res.url().endsWith("/api/booking") && res.request().method() === "POST");
      await page.click("#requestBtn");
      r.response = await (await resp).json();
      await page.waitForSelector("#stepDone:not([hidden])");
      await shot(page, `${label}-4-done`);
    }
  } else {
    await page.waitForSelector(".time", { timeout: 30000 });
    const days = await page.$$(".day");
    await days[days.length - 1].click(); // the furthest day: stays out of the way of real traffic
    const times = await page.$$(".time");
    await times[times.length - 1].click();
    r.picked = await page.textContent("#bookBtn");
    await shot(page, `${label}-3-calendar`);
    if (book) {
      const resp = page.waitForResponse(res => res.url().endsWith("/api/booking") && res.request().method() === "POST");
      await page.click("#bookBtn");
      r.response = await (await resp).json();
      await page.waitForSelector("#stepDone:not([hidden])");
      await shot(page, `${label}-4-done`);
    }
  }
  r.done_text = book ? (await page.textContent("#stepDone")).replace(/\s+/g, " ").trim() : null;
  await ctx.close();
  return r;
}

async function reopen(browser, device, label, leadId) {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/book?lead=${leadId}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#stepDone:not([hidden])", { timeout: 20000 });
  await shot(page, `${label}-4-done`);
  const text = (await page.textContent("#stepDone")).replace(/\s+/g, " ").trim();
  await ctx.close();
  return text;
}

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  const scenarios = [
    { key: "cleveland-44105", zip: "44105", trainer: "Lorenzo Miller", location: "training_center", tag: "Cleveland" },
    { key: "crestview-32536", zip: "32536", trainer: "Daniel Bainbridge", location: "", tag: "Crestview" },
    { key: "no-calendar-eric-beck", zip: "44105", trainer: "Eric Beck", location: "in_home", tag: "NoCalendar", request: true },
    { key: "no-trainer-59101", zip: "59101", callback: true, tag: "NoTrainer" }
  ];
  for (const s of scenarios) {
    const phone = await run(browser, { ...s, label: `${s.key}-phone`, device: PHONE, book: true });
    proof.runs.push(phone);
    const desk = await run(browser, { ...s, label: `${s.key}-desktop`, device: DESKTOP, book: false });
    if (!s.callback && phone.response?.lead_id) desk.done_via_link = await reopen(browser, DESKTOP, `${s.key}-desktop`, phone.response.lead_id);
    proof.runs.push(desk);
  }
} finally {
  await browser.close();
  writeFileSync(path.join(OUT, "step3c-proof.json"), JSON.stringify(proof, null, 2));
}
console.log(JSON.stringify(proof.runs.map(r => ({ label: r.label, cards: r.cards?.length, errors: r.errors.length, lead: r.response?.lead_id || null, ok: r.response?.ok ?? null, picked: r.picked || null })), null, 1));
