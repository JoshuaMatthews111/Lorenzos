// Drives the local proof server (scripts/page-studio-local.mjs) through the
// whole Page Studio flow with Playwright and saves a screenshot of each step.
// NOT deployed. Usage: node scripts/page-studio-proof.mjs <out-dir>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || "/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const base = process.env.BASE || "http://localhost:4173";
const out = resolve(process.argv[2] || "proof-shots");
mkdirSync(out, { recursive: true });
const log = [];
const note = (step, detail) => { log.push({ step, detail, at: new Date().toISOString() }); console.log(`${step}: ${detail}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", error => note("page error", error.message));
page.on("dialog", dialog => dialog.accept());
const shot = async (name, opts = {}) => { await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: opts.full === true }); note("screenshot", `${name}.png`); };

// 1. sign in (demo office login; the API is answered by the in-memory stand-in)
await page.goto(`${base}/trainer-backoffice/`);
await page.click('[data-login-mode="admin"]');
await page.fill('input[name="username"]', "admin");
await page.fill('input[name="password"]', "doglovers26");
await page.click('#loginForm button[type="submit"]');
await page.waitForSelector("#sidebar .nav-btn", { timeout: 20000 });

// 2. Page Studio launcher
await page.click('.nav-btn[data-view="pageStudio"]');
await page.waitForSelector("#pageStudioRoot .ps-page-card", { timeout: 20000 });
await shot("01-page-studio-launcher");

// 3. generate a new market page from the Columbus template
await page.click("[data-ps-new]");
await page.waitForSelector(".ps-modal");
await page.fill('.ps-modal input[name="city"]', "Dayton");
await page.fill('.ps-modal input[name="state"]', "OH");
await page.selectOption('.ps-modal select[name="template"]', "dog-training-columbus-oh");
await shot("02-new-page-dialog");
await page.click(".ps-modal [data-ps-go]");
await page.waitForSelector("#psOverlay", { timeout: 20000 });
await page.waitForFunction(() => document.querySelector("#psFrame")?.contentDocument?.querySelector("h1")?.textContent?.includes("Dayton"), null, { timeout: 20000 });
const overlayBox = await page.evaluate(() => { const r = document.getElementById("psOverlay").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, pos: getComputedStyle(document.getElementById("psOverlay")).position }; });
note("full-screen overlay", JSON.stringify(overlayBox));
const h1 = await page.evaluate(() => document.querySelector("#psFrame").contentDocument.querySelector("h1").textContent);
note("generated H1", h1);
await shot("03-fullscreen-editor-generated-dayton");

// 4. mobile toggle
await page.click('[data-ps-device="mobile"]');
await page.waitForTimeout(600);
await shot("04-mobile-preview");
await page.click('[data-ps-device="desktop"]');

// 5. change font
await page.click('[data-ps-tab="style"]');
await page.selectOption('[data-ps-field="font"]', "poppins");
await page.selectOption('[data-ps-field="fontBody"]', "nunito");
await page.waitForFunction(() => /fonts\.googleapis\.com\/css2\?family=Poppins/.test(document.querySelector("#psFrame")?.contentDocument?.head?.innerHTML || ""), null, { timeout: 10000 });
const fontApplied = await page.evaluate(() => { const d = document.querySelector("#psFrame").contentDocument; return { h1: getComputedStyle(d.querySelector("h1")).fontFamily, body: getComputedStyle(d.body).fontFamily }; });
note("font applied in canvas", JSON.stringify(fontApplied));
await page.waitForTimeout(800);
await shot("05-font-changed-poppins-nunito");

// 6. sections: add FAQ, duplicate proof cards, remove free guide
await page.click('[data-ps-tab="sections"]');
const countSections = () => page.evaluate(() => [...document.querySelector("#psFrame").contentDocument.querySelectorAll("[data-ps-section]")].map(el => el.dataset.psLabel));
note("sections before", JSON.stringify(await countSections()));
await page.click('[data-ps-act="add"][data-type="faq"]');
await page.waitForTimeout(500);
const testiIndex = await page.evaluate(() => [...document.querySelectorAll(".ps-section-list .ps-section")].findIndex(el => /Proof cards/.test(el.textContent)) - 1);
await page.click(`[data-ps-act="duplicate"][data-index="${testiIndex}"]`);
await page.waitForTimeout(500);
const guideIndex = await page.evaluate(() => [...document.querySelectorAll(".ps-section-list .ps-section")].findIndex(el => /Free guide/.test(el.textContent)) - 1);
await page.click(`[data-ps-act="remove"][data-index="${guideIndex}"]`);
await page.waitForTimeout(700);
note("sections after add FAQ / duplicate proof cards / remove guide", JSON.stringify(await countSections()));
// type into the FAQ heading to show live editing
await page.fill('[data-ps-field$=".heading"]:visible >> nth=0', "Dayton questions, straight answers.");
await page.waitForTimeout(700);
await shot("06-sections-added-duplicated-removed");

// 7. autosave state
await page.waitForFunction(() => /^Saved/.test(document.getElementById("psStatus").textContent), null, { timeout: 10000 });
note("autosave status", await page.textContent("#psStatus"));
await page.screenshot({ path: resolve(out, "07-autosave-saved-state.png"), clip: { x: 0, y: 0, width: 1440, height: 70 } });
note("screenshot", "07-autosave-saved-state.png");

// 8. publish
await page.click("#psPublishBtn");
await page.waitForSelector(".ps-modal [data-ps-go]", { timeout: 10000 });
await shot("08-publish-checklist");
await page.click(".ps-modal [data-ps-go]");
await page.waitForSelector('.ps-modal a[href="/ads/dog-training-dayton-oh"]', { timeout: 20000 });
await shot("09-published");
await page.click(".ps-modal [data-ps-close]");

// 9. history / restore
await page.click('[data-ps-tab="history"]');
await page.waitForSelector('[data-ps-act="restore"]', { timeout: 10000 });
await shot("10-history-restore-one-click");
await page.click('[data-ps-act="restore"]');
await page.waitForFunction(() => document.querySelector(".ps-toast.show")?.textContent?.includes("back in the draft"), null, { timeout: 10000 });
note("restore", await page.textContent(".ps-toast"));

// 10. the served page
const served = await page.goto(`${base}/ads/dog-training-dayton-oh`);
const html = await served.text();
note("served status", `${served.status()} cache-control=${served.headers()["cache-control"]}`);
note("served checks", JSON.stringify({
  pixelInit: html.includes("fbq('init', '3790623554504010')"),
  fbevents: html.includes("connect.facebook.net/en_US/fbevents.js"),
  form: /class="[^"]*contact-intake/.test(html) && html.includes('name="phone"'),
  h1: (html.match(/<h1>([^<]+)<\/h1>/) || [])[1],
  googleAds: html.includes("AW-11463464040"),
  poppins: html.includes("family=Poppins"),
  faq: html.includes("market-faq-section"),
  guideRemoved: !html.includes('id="free-ebook"')
}));
await page.waitForTimeout(1200);
await shot("11-served-ads-dayton-page", { full: true });
const unpublished = await page.goto(`${base}/ads/dog-training-nowhere-xx`);
note("unpublished slug", `${unpublished.status()}`);
await shot("12-unpublished-404");

// 11. the existing trainer page builder in full-screen mode
await page.goto(`${base}/trainer-backoffice/`);
await page.waitForSelector('.nav-btn[data-view="pageEditor"]', { timeout: 20000 });
await page.click('.nav-btn[data-view="pageEditor"]');
await page.waitForSelector("[data-ps-builder-fullscreen]", { timeout: 20000 });
await shot("13-trainer-builder-before-fullscreen");
await page.click("[data-ps-builder-fullscreen]");
await page.waitForTimeout(600);
const builderBox = await page.evaluate(() => { const el = document.querySelector(".page-editor-shell.fullscreen-builder"); const r = el.getBoundingClientRect(); return { pos: getComputedStyle(el).position, x: r.x, y: r.y, w: r.width, h: r.height, z: getComputedStyle(el).zIndex }; });
note("trainer builder full screen", JSON.stringify(builderBox));
await shot("14-trainer-builder-fullscreen");
await page.click("[data-ps-builder-rail]");
await page.waitForTimeout(400);
await shot("15-trainer-builder-fullscreen-rail-hidden");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
note("after Esc", await page.evaluate(() => getComputedStyle(document.querySelector(".page-editor-shell.fullscreen-builder")).position));

writeFileSync(resolve(out, "proof-log.json"), JSON.stringify(log, null, 2));
await browser.close();
console.log("done");
