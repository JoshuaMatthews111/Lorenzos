// Drives the PRACTICE COPY preview deployment with Playwright and saves a
// screenshot of each proof step. NOT deployed. Uses the practice-copy testing
// login (never a real staff login); the password comes from the environment and
// is never printed.
//   BASE=https://<preview>.vercel.app PRACTICE_LOGIN=... PRACTICE_PASSWORD=... node scripts/practice-copy-proof.mjs <out-dir> <step...>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || "/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const base = process.env.BASE;
const out = resolve(process.argv[2] || "proof-shots");
const steps = new Set(process.argv.slice(3));
const want = name => steps.size === 0 || steps.has(name);
mkdirSync(out, { recursive: true });
const log = [];
const note = (step, detail) => { log.push({ step, detail, at: new Date().toISOString() }); console.log(`${step}: ${detail}`); };
const stamp = Date.now().toString(36);

process.on("uncaughtException", async error => { console.log("FAILED:", error.message.split("\n")[0]); try { console.log("BODY:", (await page.evaluate(() => document.body.innerText)).slice(0, 600).replace(/\n+/g, " | ")); await page.screenshot({ path: resolve(out, "zz-failure.png") }); } catch {} process.exit(1); });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", error => note("page error", error.message));
page.on("dialog", d => { note("dialog", d.message().slice(0, 140)); d.accept(); });
const shot = async (name, opts = {}) => { await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: opts.full === true, ...(opts.clip ? { clip: opts.clip } : {}) }); note("screenshot", `${name}.png`); };
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
note("banner", await page.textContent("#sandboxBanner"));
note("schema in browser", String(await page.evaluate(() => window.LDTT_DB_SCHEMA)));
if (want("banner")) await shot("01-practice-copy-banner-and-dashboard");

if (want("pagestudio")) {
  await page.click('.nav-btn[data-view="pageStudio"]');
  await page.waitForSelector("#pageStudioRoot [data-ps-new]", { timeout: 30000 });
  if (process.env.PS_EXISTING === "1") {
    // The page was created on an earlier pass: open it from its card.
    await page.click('#pageStudioRoot button:has-text("Edit full screen") >> nth=0');
  } else {
    await page.click("[data-ps-new]");
    await page.waitForSelector(".ps-modal");
    await page.fill('.ps-modal input[name="city"]', process.env.PS_CITY || "Dayton");
    await page.fill('.ps-modal input[name="state"]', "OH");
    await page.selectOption('.ps-modal select[name="template"]', "dog-training-columbus-oh");
    await page.click(".ps-modal [data-ps-go]");
  }
  await page.waitForSelector("#psOverlay", { timeout: 30000 });
  await page.waitForFunction(city => document.querySelector("#psFrame")?.contentDocument?.querySelector("h1")?.textContent?.includes(city), process.env.PS_CITY || "Dayton", { timeout: 30000 });
  await page.waitForSelector("#psPublishBtn:not([disabled])", { timeout: 10000 });
  note("publish button", await page.textContent("#psPublishBtn"));
  await shot("03-page-studio-editor-practice-copy", { clip: { x: 0, y: 0, width: 1440, height: 80 } });
  await page.click("#psPublishBtn");
  await page.waitForSelector(".ps-modal", { timeout: 30000 });
  note("publish checklist", (await page.textContent(".ps-modal")).replace(/\s+/g, " ").slice(0, 160));
  await shot("04a-page-studio-publish-checklist");
  await page.click(".ps-modal [data-ps-go]");
  await page.waitForFunction(() => /Published on the practice copy|Not published yet/.test(document.querySelector(".ps-modal")?.textContent || ""), null, { timeout: 30000 });
  note("publish result", (await page.textContent(".ps-modal")).replace(/\s+/g, " ").slice(0, 200));
  await shot("04-page-studio-published-on-practice-copy");
  await page.click(".ps-modal [data-ps-close]");
  await page.waitForTimeout(800);
  const slug = await page.evaluate(() => document.querySelector("#psAddr")?.textContent?.replace("/ads/", "").trim());
  note("ad page slug", slug);
  const ads = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const r = await ads.goto(`${base}/ads/${slug}`, { waitUntil: "networkidle" });
  note("/ads/<slug> on the preview", `${r.status()} ${await ads.title()}`);
  await ads.screenshot({ path: resolve(out, "05-ads-page-served-from-practice-schema.png") });
  note("screenshot", "05-ads-page-served-from-practice-schema.png");
  await ads.close();
  // Send to live dialog (red warning box) — screenshot only, cancelled.
  await page.click("#psSendLive [data-ps-send-live]", { force: true });
  await page.waitForSelector(".ps-modal .ps-warning", { timeout: 10000 });
  note("red warning (Page Studio)", await page.textContent(".ps-modal .ps-warning"));
  await shot("06-send-to-live-red-warning-page-studio");
  await page.click(".ps-modal [data-ps-close]");
  await page.click("[data-ps-back], #psBack, .ps-top [data-ps-act=\"close\"]").catch(() => {});
}

if (want("trainer")) {
  // (a) create a trainer, upload a photo (practice bucket), publish the page, open it on the preview.
  const slug = `practice-test-${stamp}`;
  const created = await api("/api/operational-mutation", { operation: "create", entity_type: "trainer", action: "trainer_created", summary: "practice proof trainer", changes: { slug, full_name: `Practice Test ${stamp}`, email: `${slug}@example.com`, market: "Toledo", state: "OH", status: "active", access_status: "active", bio: "Created on the practice copy to prove uploads, publishing and Send to live." } });
  note("create trainer", `${created.status} ${created.data.record?.id || JSON.stringify(created.data).slice(0, 200)}`);
  const trainerId = created.data.record.id;
  const upload = await page.evaluate(async ([trainerId, stamp]) => {
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 400;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#071f44"; ctx.fillRect(0, 0, 640, 400); ctx.fillStyle = "#ffd166"; ctx.font = "bold 40px sans-serif"; ctx.fillText("PRACTICE COPY UPLOAD", 40, 200); ctx.fillText(stamp, 40, 260);
    const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
    const file = new File([blob], `hero-${stamp}.png`, { type: "image/png" });
    const result = await window.LDTT_PORTAL.upload("trainer-page-assets", `${trainerId}/hero-${stamp}.png`, file, { onProgress() {} });
    return { result, publicUrl: result?.publicUrl || window.LDTT_PORTAL.publicStorageUrl("trainer-page-assets", `${trainerId}/hero-${stamp}.png`) };
  }, [trainerId, stamp]);
  note("upload", JSON.stringify(upload.result).slice(0, 200));
  note("photo url", upload.publicUrl);
  const head = await fetch(upload.publicUrl, { method: "HEAD" });
  note("photo reachable", `${head.status} ${head.headers.get("content-type")} ${head.headers.get("content-length")} bytes`);
  const pageRow = await api("/api/operational-mutation", { operation: "create", entity_type: "trainer_page", action: "trainer_page_created", summary: "practice proof page", changes: { trainer_id: trainerId, slug, page_status: "draft", locked: false, headline: `Serious dog training in Toledo — ${stamp}`, subheadline: "Practice copy proof page", approved_bio: "Built on the practice copy.", approved_photo_urls: [upload.publicUrl], hero_image_url: upload.publicUrl, draft_content: { trainer_name: `Practice Test ${stamp}`, bio: "Built on the practice copy.", hero_image_url: upload.publicUrl }, style_settings: { font_family: "Inter", font_scale: 1, brand_primary: "#071f44", brand_accent: "#d80f35" }, section_order: ["hero", "stats", "services", "trainer", "reviews", "consultation"], revision: 1 } });
  note("create trainer page", `${pageRow.status} ${pageRow.data.record?.id || JSON.stringify(pageRow.data).slice(0, 200)}`);
  const pageId = pageRow.data.record.id;
  const published = await page.evaluate(async id => { try { return await window.LDTT_PORTAL.rpc("publish_trainer_page", { target_page_id: id }); } catch (e) { return { error: e.message }; } }, pageId);
  note("rpc publish_trainer_page (browser, practice schema)", JSON.stringify({ page_status: published?.page_status, locked: published?.locked, published_revision: published?.published_revision, error: published?.error }));
  const login = await api("/api/ensure-trainer-user", { trainer_id: trainerId, email: `${slug}@example.com`, display_name: `Practice Test ${stamp}` });
  note("ensure-trainer-user", `${login.status} created=${login.data.created} user_id=${login.data.user_id} ${login.data.message || login.data.error || ""}`);
  const pub = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const r = await pub.goto(`${base}/${slug}`, { waitUntil: "networkidle" });
  await pub.waitForTimeout(3000);
  note(`/${slug} on the preview`, `${r.status()} ${await pub.title()} | headline on page: ${(await pub.evaluate(() => document.body.innerText)).includes(stamp)}`);
  await pub.screenshot({ path: resolve(out, "09-practice-trainer-public-page-on-preview.png") });
  note("screenshot", "09-practice-trainer-public-page-on-preview.png");
  await pub.close();
  writeFileSync(resolve(out, "practice-trainer.json"), JSON.stringify({ slug, trainerId, pageId, photo: upload.publicUrl }, null, 2));
}

if (want("ops")) {
  // (c) move a lead, add a note, submit a deal — all through the same APIs the portal uses.
  const leads = await page.evaluate(() => window.LDTT_PORTAL.select("leads", "select=id,status,first_name,last_name,updated_at,version&order=created_at.desc&limit=1"));
  const lead = leads[0];
  note("lead picked (browser select → practice schema)", JSON.stringify(lead));
  const moved = await api("/api/operational-mutation", { operation: "update", entity_type: "lead", id: lead.id, action: "lead_status_changed", summary: "practice proof: moved lead", changes: { status: lead.status === "evaluation_scheduled" ? "evaluation_complete" : "evaluation_scheduled" } });
  note("move lead", `${moved.status} status=${moved.data.record?.status} ${moved.data.message || ""}`);
  const noted = await api("/api/operational-mutation", { operation: "save_note", entity_type: "lead", entity_id: lead.id, note: `Practice copy proof note ${stamp}` });
  note("add note", `${noted.status} note_id=${noted.data.record?.id} ${noted.data.message || ""}`);
  const trainer = JSON.parse(require("node:fs").readFileSync(resolve(out, "practice-trainer.json"), "utf8"));
  const deal = await api("/api/submit-deal", { trainer_id: trainer.trainerId, client_name: `Practice Client ${stamp}`, dog_name: "Rex", program: "Board and Train", sold_amount: 2500, collected_amount: 500, plan_type: "monthly", installments: 4, notes: "practice copy proof deal" });
  note("submit deal", `${deal.status} deal_id=${deal.data.deal?.id} balance=${deal.data.balance_due} payments=${deal.data.payments?.length} ${deal.data.message || ""}`);
  writeFileSync(resolve(out, "practice-ops.json"), JSON.stringify({ lead_id: lead.id, note_id: noted.data.record?.id, deal_id: deal.data.deal?.id }, null, 2));
}

if (want("send")) {
  // (e) Send one trainer page to live: arrives in public.trainer_pages as a DRAFT.
  const trainer = JSON.parse(require("node:fs").readFileSync(resolve(out, "practice-trainer.json"), "utf8"));
  const sent = await api("/api/send-to-live", { kind: "trainer_page", id: trainer.pageId, slug: trainer.slug });
  note("send to live", `${sent.status} ${JSON.stringify(sent.data).slice(0, 400)}`);
  writeFileSync(resolve(out, "practice-send.json"), JSON.stringify(sent.data, null, 2));
}

if (want("reset")) {
  // (f) Reset practice copy → equals live again.
  const reset = await api("/api/practice-reset", {});
  note("practice reset", `${reset.status} ${JSON.stringify(reset.data).slice(0, 600)}`);
  writeFileSync(resolve(out, "practice-reset.json"), JSON.stringify(reset.data, null, 2));
}

if (want("reset-panel")) {
  await page.goto(`${base}/trainer-backoffice/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#sidebar .nav-btn", { timeout: 30000 });
  await page.click('.nav-btn[data-view="portalAccess"]');
  await page.waitForSelector("[data-practice-reset]", { timeout: 15000 });
  await page.$eval("[data-practice-reset]", el => el.scrollIntoView({ block: "center" }));
  await shot("10-reset-practice-copy-button-portal-access");
}

if (want("trainer-shot")) {
  const slug = process.env.TRAINER_SLUG;
  const pub = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const r = await pub.goto(`${base}/${slug}`, { waitUntil: "networkidle" });
  await pub.waitForTimeout(2500);
  note(`/${slug} on the preview`, `${r.status()} ${await pub.title()}`);
  await pub.screenshot({ path: resolve(out, "09-practice-trainer-public-page-on-preview.png"), fullPage: false });
  note("screenshot", "09-practice-trainer-public-page-on-preview.png");
  await pub.close();
}

if (want("trainer-dialog")) {
  await page.goto(`${base}/trainer-backoffice/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#sidebar .nav-btn", { timeout: 30000 });
  // The trainer editor's own confirm (app.js confirmSendToLive) — opened directly so the
  // exact dialog the office sees can be screenshotted without picking a trainer first.
  await page.evaluate(() => { window.__sendConfirm = confirmSendToLive(); });
  await page.waitForSelector(".send-to-live-dialog[open] .send-live-warning", { timeout: 10000 });
  note("red warning (trainer)", await page.textContent(".send-to-live-dialog .send-live-warning"));
  await shot("07-send-to-live-red-warning-trainer-page");
  await page.click(".send-to-live-dialog [data-send-live-cancel]");
}

writeFileSync(resolve(out, `proof-log-${stamp}.json`), JSON.stringify(log, null, 2));
await browser.close();
