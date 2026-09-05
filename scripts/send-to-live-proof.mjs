// Drives the local proof server (scripts/page-studio-local.mjs, started with
// LDTT_SANDBOX=1) through Send to live with Playwright and saves a screenshot
// of each step: the button, the confirm, the toast, the "Sent to live" stamp,
// then flips the same server to live mode to show the "From practice copy" tag.
// NOT deployed. Usage: node scripts/send-to-live-proof.mjs <out-dir>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || "/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const base = process.env.BASE || "http://localhost:4174";
const out = resolve(process.argv[2] || "proof-shots");
mkdirSync(out, { recursive: true });
const log = [];
const note = (step, detail) => { log.push({ step, detail, at: new Date().toISOString() }); console.log(`${step}: ${detail}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", error => note("page error", error.message));
const shot = async (name, opts = {}) => { await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: opts.full === true, ...(opts.clip ? { clip: opts.clip } : {}) }); note("screenshot", `${name}.png`); };
const toastText = async (selector, expect = /Sent to live/) => { await page.waitForFunction(([sel, re]) => document.querySelector(sel)?.classList.contains("show") && new RegExp(re).test(document.querySelector(sel).textContent), [selector, expect.source], { timeout: 10000 }); return page.textContent(selector); };

async function login() {
  await page.goto(`${base}/trainer-backoffice/`);
  if (await page.$("#sidebar .nav-btn")) return;
  await page.click('[data-login-mode="admin"]');
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "doglovers26");
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector("#sidebar .nav-btn", { timeout: 20000 });
}

// ── SANDBOX SIDE ────────────────────────────────────────────────────────────
// The demo office login is refused on the sandbox by design (real logins only),
// and this harness has no real Supabase login. So: sign in with the demo office
// account while the server is in live mode, then flip the same server to
// sandbox and let the portal's own applyEnvironmentBadge() mark the page as
// sandbox (LDTT_IS_SANDBOX, locked writes, banner) exactly as it does on boot.
await fetch(`${base}/__local/sandbox?on=0`);
await login();
await fetch(`${base}/__local/sandbox?on=1`);
await page.evaluate(async () => { await applyEnvironmentBadge(); render(); });
await page.waitForSelector("#sandboxBanner", { timeout: 10000 });
note("environment", JSON.stringify(await (await fetch(`${base}/api/environment`)).json()));
note("portal sandbox flag", String(await page.evaluate(() => window.LDTT_IS_SANDBOX)));

// 1. Page Studio: make a practice page, then send it
await page.click('.nav-btn[data-view="pageStudio"]');
await page.waitForSelector("#pageStudioRoot [data-ps-new]", { timeout: 20000 });
await page.click("[data-ps-new]");
await page.waitForSelector(".ps-modal");
await page.fill('.ps-modal input[name="city"]', "Dayton");
await page.fill('.ps-modal input[name="state"]', "OH");
await page.selectOption('.ps-modal select[name="template"]', "dog-training-columbus-oh");
await page.click(".ps-modal [data-ps-go]");
await page.waitForSelector("#psOverlay", { timeout: 20000 });
await page.waitForFunction(() => document.querySelector("#psFrame")?.contentDocument?.querySelector("h1")?.textContent?.includes("Dayton"), null, { timeout: 20000 });
await page.waitForSelector("#psSendLive [data-ps-send-live]", { timeout: 10000 });
await shot("01-page-studio-editor-send-to-live-button", { clip: { x: 0, y: 0, width: 1440, height: 70 } });
await page.keyboard.press("Escape");
await page.waitForSelector("#pageStudioRoot .ps-page-card [data-ps-send-live]", { timeout: 20000 });
await shot("02-page-studio-card-send-to-live-button");
await page.click("#pageStudioRoot .ps-page-card [data-ps-send-live]");
await page.waitForSelector(".ps-modal [data-ps-go]", { timeout: 10000 });
note("confirm text (Page Studio)", await page.textContent(".ps-modal .ps-help"));
await shot("03-page-studio-confirm-dialog");
await page.click(".ps-modal [data-ps-go]");
note("toast (Page Studio)", await toastText("#psToast"));
await shot("04-page-studio-toast-sent-to-live");
await page.waitForFunction(() => /Sent to live ✓/.test(document.querySelector("#pageStudioRoot")?.textContent || ""), null, { timeout: 10000 });
await page.waitForTimeout(3500);
await shot("05-page-studio-card-sent-to-live-stamp");
// second send: same live row
await page.click("#pageStudioRoot .ps-page-card [data-ps-send-live]");
await page.waitForSelector(".ps-modal [data-ps-go]", { timeout: 10000 });
await page.click(".ps-modal [data-ps-go]");
await toastText("#psToast");
await page.waitForTimeout(500);

// 2. Trainer page editor
await page.click('.nav-btn[data-view="pageEditor"]');
await page.waitForSelector("[data-editor-save]", { timeout: 20000 });
await page.evaluate(() => { state.selectedTrainerId = "karemela-sefferin"; state.builderSurface = "trainer"; render(); });
await page.waitForSelector("[data-send-to-live]", { timeout: 10000 });
await page.$eval("[data-send-to-live]", el => el.scrollIntoView({ block: "center" }));
await page.waitForTimeout(300);
await shot("06-trainer-editor-send-to-live-button");
await page.click("[data-send-to-live]");
await page.waitForSelector(".send-to-live-dialog[open]", { timeout: 10000 });
note("confirm text (trainer editor)", await page.textContent(".send-to-live-dialog p"));
await shot("07-trainer-editor-confirm-dialog");
await page.click(".send-to-live-dialog [data-send-live-go]");
note("toast (trainer editor)", await toastText("#toast"));
await shot("08-trainer-editor-toast-sent-to-live");
await page.waitForFunction(() => /Sent to live ✓/.test(document.querySelector(".send-live-note")?.textContent || ""), null, { timeout: 10000 });
await page.waitForTimeout(6200);
await page.$eval("[data-send-to-live]", el => el.scrollIntoView({ block: "center" }));
await shot("09-trainer-editor-sent-to-live-stamp");

// 3. role without permission: button disabled with tooltip
await page.evaluate(() => { window.__savedPortalUser = portalUser; portalUser = { ...(portalUser || {}), role: "admin", permission_level: "trainer" }; render(); });
await page.waitForSelector("[data-send-to-live][disabled]", { timeout: 10000 });
note("disabled tooltip", await page.getAttribute("[data-send-to-live]", "title"));
await page.$eval("[data-send-to-live]", el => el.scrollIntoView({ block: "center" }));
await shot("10-trainer-editor-button-disabled-for-other-roles");
await page.evaluate(() => { portalUser = window.__savedPortalUser; render(); });

// what the "live" tables hold after the sends
const state = await (await fetch(`${base}/__local/state`)).json();
writeFileSync(resolve(out, "local-live-tables-after-send.json"), JSON.stringify(state, null, 2));
note("live ad_pages rows", String(state.db.ad_pages.length));
note("live ad_page status / published_content", JSON.stringify(state.db.ad_pages.map(r => ({ slug: r.slug, status: r.status, published_content: r.published_content ?? null, draft_revision: r.draft_revision, updated_by: r.updated_by }))));
note("live ad_page_revisions", JSON.stringify(state.db.ad_page_revisions.map(r => ({ revision: r.revision, kind: r.kind, created_by: r.created_by }))));
note("live trainer_pages", JSON.stringify(state.db.trainer_pages.map(r => ({ slug: r.slug, page_status: r.page_status, locked: r.locked, revision: r.revision, published_revision: r.published_revision, published_content: r.published_content, sent_from: r.draft_content?._sent_from_practice }))));
note("live trainer_page_versions", JSON.stringify(state.db.trainer_page_versions.map(r => ({ revision: r.revision, note: r.content?._note }))));
note("practice ops log send_to_live entries", JSON.stringify(state.ops.filter(op => op.operation === "send_to_live").map(op => ({ entity_type: op.entity_type, slug: op.slug, actor: op.actor, at: op.at }))));

// ── LIVE SIDE ───────────────────────────────────────────────────────────────
await fetch(`${base}/__local/sandbox?on=0`);
const liveProbe = await fetch(`${base}/api/send-to-live`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer local-demo" }, body: JSON.stringify({ kind: "ad_page", id: "x" }) });
note("POST /api/send-to-live on live", `${liveProbe.status} ${await liveProbe.text()}`);
await page.goto(`${base}/trainer-backoffice/`);
await login();
note("environment", JSON.stringify(await (await fetch(`${base}/api/environment`)).json()));
note("portal sandbox flag", String(await page.evaluate(() => window.LDTT_IS_SANDBOX)));
await page.click('.nav-btn[data-view="pageStudio"]');
await page.waitForSelector("#pageStudioRoot .ps-page-card", { timeout: 20000 });
await page.waitForFunction(() => /From practice copy/.test(document.querySelector("#pageStudioRoot")?.textContent || ""), null, { timeout: 10000 });
note("live Page Studio card", "From practice copy tag present; no Send to live button: " + String(!(await page.$("[data-ps-send-live]"))));
await shot("11-live-page-studio-card-from-practice-copy-tag");
await page.click("#pageStudioRoot .ps-page-card [data-ps-open]");
await page.waitForSelector("#psOverlay", { timeout: 20000 });
await page.waitForFunction(() => /From practice copy/.test(document.querySelector("#psSendLive")?.textContent || ""), null, { timeout: 10000 });
await shot("12-live-page-studio-editor-from-practice-copy-tag", { clip: { x: 0, y: 0, width: 1440, height: 70 } });
await page.keyboard.press("Escape");
// Trainer editor on live: the portal's operational-data API is not mounted in
// this local harness, so the trainer row is injected into the page state here.
// The real path is remoteTrainerToUi() reading draft_content._sent_from_practice.
await page.click('.nav-btn[data-view="pageEditor"]');
await page.waitForSelector("[data-editor-save]", { timeout: 20000 });
await page.evaluate(() => { state.selectedTrainerId = "karemela-sefferin"; state.builderSurface = "trainer"; trainerById().fromPracticeCopy = { by: "office@local.test", at: new Date().toISOString() }; render(); });
await page.waitForSelector(".practice-copy-tag", { timeout: 10000 });
note("live trainer editor", "From practice copy tag present (injected state); no Send to live button: " + String(!(await page.$("[data-send-to-live]"))));
await page.$eval(".practice-copy-tag", el => el.scrollIntoView({ block: "center" }));
await shot("13-live-trainer-editor-from-practice-copy-tag-injected-state");

writeFileSync(resolve(out, "proof-log.json"), JSON.stringify(log, null, 2));
await browser.close();
console.log(`done → ${out}`);
