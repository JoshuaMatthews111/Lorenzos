// Proof for the typed-name gates on the PRACTICE COPY preview (Playwright).
// NOT deployed (scripts/ is in .vercelignore). Uses the practice-copy testing
// login (never a staff login); the password comes from the environment and is
// never printed.
//   BASE=https://<preview>.vercel.app PRACTICE_LOGIN=... PRACTICE_PASSWORD=... node scripts/practice-names-proof.mjs <out-dir> <step...>
//   steps: dialogs | send | livetag (needs LIVE_STAMP_JSON) | reset
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || "/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const base = process.env.BASE;
const out = resolve(process.argv[2] || "proof-shots");
const steps = new Set(process.argv.slice(3));
const want = name => steps.size === 0 || steps.has(name);
const NAME = process.env.PROOF_NAME || "Practice Tester";
mkdirSync(out, { recursive: true });
const log = [];
const note = (step, detail) => { log.push({ step, detail, at: new Date().toISOString() }); console.log(`${step}: ${detail}`); };
const stamp = Date.now().toString(36);

process.on("uncaughtException", async error => { console.log("FAILED:", error.message.split("\n")[0]); try { await page.screenshot({ path: resolve(out, "zz-names-failure.png") }); } catch {} process.exit(1); });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("dialog", d => { note("dialog", d.message().slice(0, 140)); d.accept(); });
const shot = async (name, opts = {}) => { await page.screenshot({ path: resolve(out, `${name}.png`), ...(opts.clip ? { clip: opts.clip } : {}) }); note("screenshot", `${name}.png`); };
const api = async (path, body) => {
  const token = await page.evaluate(() => window.LDTT_PORTAL.accessToken());
  const r = await fetch(`${base}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
async function login() {
  await page.goto(`${base}/trainer-backoffice/`, { waitUntil: "networkidle" });
  if (await page.$("#sidebar .nav-btn")) return;
  if (await page.$('[data-login-mode="admin"]')) await page.click('[data-login-mode="admin"]');
  await page.fill('input[name="username"]', process.env.PRACTICE_LOGIN);
  await page.fill('input[name="password"]', process.env.PRACTICE_PASSWORD);
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector("#sidebar .nav-btn", { timeout: 30000 });
  await page.waitForSelector("#sandboxBanner", { timeout: 15000 });
}
await login();
note("environment", JSON.stringify(await (await fetch(`${base}/api/environment`)).json()));

if (want("dialogs")) {
  // Page Studio dialog: name box present, red button disabled until two words.
  await page.click('.nav-btn[data-view="pageStudio"]');
  await page.waitForSelector("#pageStudioRoot [data-ps-new]", { timeout: 30000 });
  const existing = await page.$("#pageStudioRoot [data-ps-send-live]");
  if (existing) await existing.click({ force: true });
  else {
    await page.click("[data-ps-new]");
    await page.waitForSelector(".ps-modal");
    await page.fill('.ps-modal input[name="city"]', "Dayton"); await page.fill('.ps-modal input[name="state"]', "OH");
    await page.selectOption('.ps-modal select[name="template"]', "dog-training-columbus-oh");
    await page.click(".ps-modal [data-ps-go]");
    await page.waitForSelector("#psSendLive [data-ps-send-live]", { timeout: 30000 });
    await page.click("#psSendLive [data-ps-send-live]", { force: true });
  }
  await page.waitForSelector(".ps-modal [data-ps-sender-name]", { timeout: 10000 });
  note("page studio dialog: button disabled with empty name", String(await page.$eval(".ps-modal [data-ps-go]", b => b.disabled)));
  await page.fill(".ps-modal [data-ps-sender-name]", "Angela");
  note("page studio dialog: button disabled with ONE word", String(await page.$eval(".ps-modal [data-ps-go]", b => b.disabled)));
  await page.fill(".ps-modal [data-ps-sender-name]", "");
  await shot("11-send-to-live-name-box-page-studio-button-disabled");
  await page.fill(".ps-modal [data-ps-sender-name]", NAME);
  note("page studio dialog: button enabled with two words", String(!(await page.$eval(".ps-modal [data-ps-go]", b => b.disabled))));
  await page.click(".ps-modal [data-ps-close]");
  await page.goto(`${base}/trainer-backoffice/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#sidebar .nav-btn", { timeout: 30000 });
}

if (want("send")) {
  // A practice-only trainer + page (no photo, so nothing lands in a live bucket), then the real dialog in the editor.
  const slug = `practice-name-${stamp}`;
  const created = await api("/api/operational-mutation", { operation: "create", entity_type: "trainer", action: "trainer_created", summary: "practice names proof trainer", changes: { slug, full_name: `Practice Name ${stamp}`, email: `${slug}@example.com`, market: "Toledo", state: "OH", status: "active", access_status: "active", bio: "Created on the practice copy to prove the typed-name gate on Send to live." } });
  note("create trainer", `${created.status} ${created.data.record?.id || JSON.stringify(created.data).slice(0, 200)}`);
  const trainerId = created.data.record.id;
  const pageRow = await api("/api/operational-mutation", { operation: "create", entity_type: "trainer_page", action: "trainer_page_created", summary: "practice names proof page", changes: { trainer_id: trainerId, slug, page_status: "draft", locked: false, headline: `Serious dog training in Toledo — ${stamp}`, subheadline: "Practice copy names proof page", approved_bio: "Built on the practice copy.", approved_photo_urls: [], draft_content: { trainer_name: `Practice Name ${stamp}`, bio: "Built on the practice copy." }, style_settings: { font_family: "Inter", font_scale: 1, brand_primary: "#071f44", brand_accent: "#d80f35" }, section_order: ["hero", "stats", "services", "trainer", "reviews", "consultation"], revision: 1 } });
  note("create trainer page", `${pageRow.status} ${pageRow.data.record?.id || JSON.stringify(pageRow.data).slice(0, 200)}`);
  const pageId = pageRow.data.record.id;
  await page.goto(`${base}/trainer-backoffice/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#sidebar .nav-btn", { timeout: 30000 });
  await page.waitForFunction(id => (typeof remoteReady === "undefined" || remoteReady) && state.trainers.some(t => t.id === id), trainerId, { timeout: 30000 });
  await page.evaluate(id => { state.selectedTrainerId = id; state.builderSurface = "trainer"; state.activeView = "pageEditor"; render(); }, trainerId);
  await page.waitForSelector("[data-send-to-live]", { timeout: 15000 });
  await page.click("[data-send-to-live]");
  await page.waitForSelector(".send-to-live-dialog[open] [data-send-live-name]", { timeout: 10000 });
  note("trainer dialog: button disabled with empty name", String(await page.$eval(".send-to-live-dialog [data-send-live-go]", b => b.disabled)));
  await shot("11b-send-to-live-name-box-trainer-page-button-disabled");
  await page.fill(".send-to-live-dialog [data-send-live-name]", NAME);
  note("trainer dialog: button enabled with two words", String(!(await page.$eval(".send-to-live-dialog [data-send-live-go]", b => b.disabled))));
  await shot("12a-send-to-live-name-filled-button-enabled");
  await page.click(".send-to-live-dialog [data-send-live-go]");
  await page.waitForFunction(name => (document.querySelector(".send-live-note")?.textContent || "").includes(`by ${name}`), NAME, { timeout: 30000 });
  note("practice stamp", await page.textContent(".send-live-note"));
  await page.$eval(".send-live-note", el => el.scrollIntoView({ block: "center" }));
  await shot("12-sent-to-live-stamp-shows-name");
  writeFileSync(resolve(out, "practice-names.json"), JSON.stringify({ slug, trainerId, pageId, name: NAME }, null, 2));
}

if (want("livetag")) {
  // The live portal's own tag code, fed the row that Send to live wrote to public.trainer_pages (read back by SQL).
  const live = JSON.parse(readFileSync(process.env.LIVE_STAMP_JSON, "utf8"));
  const html = await page.evaluate(from => {
    const was = window.LDTT_IS_SANDBOX; window.LDTT_IS_SANDBOX = false;
    const markup = sendToLiveControls({ fromPracticeCopy: from });
    window.LDTT_IS_SANDBOX = was;
    const box = document.createElement("div"); box.id = "liveTagProof";
    box.style.cssText = "position:fixed;inset:auto 0 0 0;z-index:99999;background:#fff;padding:26px 32px;border-top:3px solid #4b2fbf;font:16px Inter,system-ui";
    box.innerHTML = `<p style="margin:0 0 10px;font-weight:800;color:#0f1f3d">LIVE portal → Trainer Network → this page (rendered by the live tag code from the live row):</p>${markup}<p style="margin:12px 0 0;color:#5b6b83;font-size:.85rem">public.trainer_pages.draft_content._sent_from_practice = ${JSON.stringify(from)}</p>`;
    document.body.appendChild(box);
    return markup;
  }, live);
  note("live From-practice-copy tag markup", html);
  await shot("13-live-from-practice-copy-tag-shows-name", { clip: { x: 0, y: 640, width: 1440, height: 260 } });
}

if (want("reset")) {
  await page.goto(`${base}/trainer-backoffice/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#sidebar .nav-btn", { timeout: 30000 });
  await page.click('.nav-btn[data-view="portalAccess"]');
  await page.evaluate(() => document.querySelector('[data-view="settings"]')?.click());
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector("details.practice-reset-panel")?.setAttribute("open", ""));
  await page.waitForSelector("[data-practice-reset]", { timeout: 15000 });
  await page.click("[data-practice-reset]");
  await page.waitForSelector(".practice-reset-dialog[open] [data-practice-reset-name]", { timeout: 10000 });
  note("reset dialog text", await page.textContent(".practice-reset-dialog .send-live-warning"));
  note("reset dialog: button disabled with empty name", String(await page.$eval(".practice-reset-dialog [data-practice-reset-go]", b => b.disabled)));
  await shot("14-reset-practice-copy-name-box-button-disabled");
  if (process.env.DO_RESET === "1") {
    await page.fill(".practice-reset-dialog [data-practice-reset-name]", NAME);
    await page.fill(".practice-reset-dialog [data-practice-reset-word]", "RESET");
    await page.click(".practice-reset-dialog [data-practice-reset-go]");
    await page.waitForFunction(() => /Practice copy reset by/.test(document.body.innerText), null, { timeout: 120000 });
    note("reset toast", (await page.evaluate(() => document.body.innerText.match(/Practice copy reset by[^\n]*/)?.[0] || "")));
    await shot("14b-reset-done-toast-shows-name", { clip: { x: 0, y: 0, width: 1440, height: 140 } });
  } else {
    await page.click(".practice-reset-dialog [data-practice-reset-cancel]");
  }
}

writeFileSync(resolve(out, `proof-names-log-${stamp}.json`), JSON.stringify(log, null, 2));
await browser.close();
