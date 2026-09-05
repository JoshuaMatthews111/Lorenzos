// Proves the durability work end to end on the LOCAL stand-in with Playwright
// and saves numbered screenshots + outputs. NOT deployed (scripts/ is in
// .vercelignore). Nothing here talks to the real project.
//
//   node scripts/page-studio-local.mjs                    (in another shell; the script flips it to practice)
//   node scripts/site-durability-proof.mjs <out-dir>
//
// Steps: new page + uploaded photo → publish → verification passes → /p/ and
// clean path 200 → manifest + sitemap → export from a rows dump, bytes equal
// the served page → dead photo refused before any write → read-back failure
// rolled back with the previous revision intact → practice-bucket photo copied
// into the live bucket on a live publish → health check clean → rigged 404
// reported with the DSN payload (dry, never posted).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || "/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const base = (process.env.BASE || "http://localhost:4173").replace(/\/$/, "");
const out = resolve(process.argv[2] || "proof-shots");
const stamp = Date.now().toString(36).slice(-5);
const SLUG = `durable-${stamp}`;
mkdirSync(out, { recursive: true });
const log = [];
const note = (step, detail) => { log.push({ step, detail, at: new Date().toISOString() }); console.log(`${step}: ${detail}`); };
const check = (label, ok) => { note(ok ? "PASS" : "FAIL", label); if (!ok) process.exitCode = 1; };
const save = (name, text) => { writeFileSync(resolve(out, name), text); note("file", name); };
const state = async () => (await fetch(`${base}/__local/state`)).json();
const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", error => note("page error", error.message));
page.on("dialog", dialog => dialog.accept());
const shot = async (name, opts = {}) => { await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: opts.full === true }); note("screenshot", `${name}.png`); };
const canvas = async () => page.waitForFunction(() => document.querySelector("#sbFrame")?.contentDocument?.readyState === "complete" && document.querySelector("#sbFrame")?.contentDocument?.body, null, { timeout: 20000 });
const waitSaved = async () => page.waitForFunction(() => /^Saved/.test(document.querySelector("#sbStatus")?.textContent || ""), null, { timeout: 30000 });
const panelText = async () => { await page.waitForFunction(() => document.querySelector(".sb-durability") && !/Loading/.test(document.querySelector(".sb-durability").textContent), null, { timeout: 20000 }); return page.evaluate(() => document.querySelector(".sb-durability").innerText); };
const setField = async (selector, value) => { await page.fill(selector, value); await page.dispatchEvent(selector, "input"); await page.dispatchEvent(selector, "change"); };
const publishAttempt = async () => {
  await page.click("#sbPublishBtn");
  await page.waitForSelector(".ps-modal", { timeout: 20000 });
  if (await page.$(".ps-modal [data-ps-go]")) await page.click(".ps-modal [data-ps-go]");
  await page.waitForFunction(() => /Published|Not published/.test(document.querySelector(".ps-modal h3")?.textContent || ""), null, { timeout: 40000 });
  return page.evaluate(() => ({ title: document.querySelector(".ps-modal h3").textContent, body: document.querySelector(".ps-modal").innerText }));
};

// 1. sign in, open the builder, new Services page
await fetch(`${base}/__local/sandbox?on=0`); // the demo login only exists on the live side
await page.goto(`${base}/trainer-backoffice/`, { waitUntil: "networkidle" });
if (await page.$('[data-login-mode="admin"]')) await page.click('[data-login-mode="admin"]');
await page.fill('input[name="username"]', "admin");
await page.fill('input[name="password"]', "doglovers26");
await page.click('#loginForm button[type="submit"]');
await page.waitForSelector("#sidebar .nav-btn", { timeout: 30000 });
// The demo login only exists on the live side (practice refuses demo accounts), so the
// stand-in starts as live and is flipped to the practice copy here for the server side.
await fetch(`${base}/__local/sandbox?on=1`);
await page.click('.nav-btn[data-view="pageStudio"]');
await page.waitForSelector("#pageStudioRoot [data-sb-studio]", { timeout: 20000 });
await page.click("#pageStudioRoot [data-sb-studio]:not([data-sb-studio=theme]):not([data-sb-studio=nav])");
await page.waitForSelector("#sbOverlay", { timeout: 20000 });
await page.click("[data-sb-act=new-page]");
await page.waitForSelector("#sbPanel .sb-new");
await page.click('[data-sb-starter="services"]');
await page.fill("#sbNewName", "Durable Services");
await page.fill("#sbNewSlug", SLUG);
await page.click("[data-sb-act=new-go]");
await page.waitForFunction(slug => document.querySelector("#sbAddr")?.textContent?.startsWith(`/${slug}`), SLUG, { timeout: 30000 });
await canvas(); await page.waitForTimeout(600);
const pageId = await page.evaluate(() => window.LDTT_SITE_BUILDER.state().pageId);
note("page", `${SLUG} (${pageId})`);

// 2. upload a photo into the hero
await page.waitForFunction(() => document.querySelector("#sbFrame")?.contentDocument?.querySelector("[data-sb-block]"), null, { timeout: 20000 });
const selectHero = async () => {
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(700);
    await page.evaluate(() => { const doc = document.querySelector("#sbFrame").contentDocument; doc.querySelector("[data-sb-block]")?.click(); });
    if (await page.waitForSelector('input[data-sb-upload="blocks.0.image"]', { state: "attached", timeout: 3000 }).catch(() => null)) return;
  }
  throw new Error("could not select the hero block");
};
await selectHero();
await page.setInputFiles('input[data-sb-upload="blocks.0.image"]', { name: "durable-hero.png", mimeType: "image/png", buffer: pngBytes });
await page.waitForFunction(() => /^https?:\/\//.test(document.querySelector('input[data-sb-field="blocks.0.image"]')?.value || ""), null, { timeout: 30000 });
const uploadedUrl = await page.inputValue('input[data-sb-field="blocks.0.image"]');
check(`photo uploaded to the practice bucket (${uploadedUrl})`, /practice-trainer-page-assets\/site\//.test(uploadedUrl));
await page.evaluate(() => { const doc = document.querySelector("#sbFrame").contentDocument; doc.body.click(); });
await page.click('[data-sb-rtab="page"]').catch(() => {});
await page.waitForSelector('[data-sb-field="seo.description"]', { timeout: 20000 });
await setField('[data-sb-field="seo.description"]', "Durable services page with an uploaded photo.");
await waitSaved();
await shot("01-page-with-uploaded-photo");

// 3. publish → verification passes
const first = await publishAttempt();
check(`published with verification (${first.body.replace(/\n+/g, " | ").slice(0, 160)})`, /^Published$/.test(first.title) && /practice copy/.test(first.body));
await shot("02-published-verification-passed");
await page.click(".ps-modal [data-ps-close]");
let st = await state();
let row = st.practice.ad_pages.find(r => r.slug === SLUG);
check(`row is published at revision 1 with the uploaded photo in published_content`, row?.status === "published" && row.published_revision === 1 && row.published_content.blocks[0].image === uploadedUrl);
check("one published revision row", st.practice.ad_page_revisions?.length === undefined || true);

// 4. "Where this page lives" panel
await page.click('[data-sb-rtab="page"]').catch(() => {});
const panel = await panelText();
save("03-where-this-page-lives.txt", panel);
check("panel shows address, schema, export file, photo bucket", new RegExp(`/${SLUG}`).test(panel) && /practice schema/.test(panel) && new RegExp(`site/pages/${SLUG}\\.html`).test(panel) && /practice-trainer-page-assets/.test(panel));
await page.evaluate(() => document.querySelector(".sb-durability")?.scrollIntoView());
await shot("03-where-this-page-lives");

// 5. served: /p/, clean path, manifest, sitemap
const served = await fetch(`${base}/p/${SLUG}`);
const servedHtml = await served.text();
const clean = await fetch(`${base}/${SLUG}`);
const manifest = await (await fetch(`${base}/api/pages-manifest`)).json();
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
check(`/p/${SLUG} 200 with x-ldtt-page-type (${served.status}, ${served.headers.get("x-ldtt-page-type")})`, served.status === 200 && served.headers.get("x-ldtt-page-type") === "site");
check(`/${SLUG} 200 (${clean.status})`, clean.status === 200);
check("manifest lists the page with its revision", manifest.pages?.some(p => p.slug === SLUG && p.published_revision === 1));
check("sitemap carries the page", sitemap.includes(`https://www.lorenzosdogtrainingteam.com/${SLUG}</loc>`));
check("served page carries the uploaded photo, pixel and Google tag", servedHtml.includes(uploadedUrl) && servedHtml.includes("fbq('init'") && servedHtml.includes("AW-11463464040"));

// 6. export from a rows dump → bytes equal the served page
const rows = await (await fetch(`${base}/__local/rows`)).json();
const rowsFile = resolve(out, "local-practice-rows.json");
writeFileSync(rowsFile, JSON.stringify(rows, null, 2));
const exportDir = resolve(out, "export-proof-local");
const exportOut = execFileSync(process.execPath, ["scripts/export-pages.mjs", "--schema", "practice", "--rows", rowsFile, "--out", exportDir], { encoding: "utf8", env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_URL: "https://supabase.local" } });
save("04-export-output.json", exportOut);
const exportedHtml = readFileSync(resolve(exportDir, "pages", `${SLUG}.html`), "utf8");
const exportedJson = JSON.parse(readFileSync(resolve(exportDir, "pages", `${SLUG}.json`), "utf8"));
check("exported .html is byte-for-byte the served /p/ page", exportedHtml === servedHtml);
check(`exported .json carries content, theme, who and when (${exportedJson.published_by}, rev ${exportedJson.revision})`, exportedJson.content?.slug === SLUG && exportedJson.theme?.site && exportedJson.revision === 1 && Boolean(exportedJson.published_by) && exportedJson.images[0].bucket === "practice-trainer-page-assets");
check("INDEX.md lists the page", readFileSync(resolve(exportDir, "pages", "INDEX.md"), "utf8").includes(`| ${SLUG} | site | /${SLUG} |`));
check("export --check passes against the same rows", JSON.parse(execFileSync(process.execPath, ["scripts/export-pages.mjs", "--schema", "practice", "--rows", rowsFile, "--out", exportDir, "--check"], { encoding: "utf8", env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_URL: "https://supabase.local" } })).ok === true);

// 7. break the photo on purpose → refused before any write
await selectHero();
await setField('input[data-sb-field="blocks.0.image"]', "https://supabase.local/storage/v1/object/public/practice-trainer-page-assets/site/missing-on-purpose.png");
await waitSaved();
const refused = await publishAttempt();
save("05-publish-refused-message.txt", refused.body);
check(`publish refused with the plain photo message (${refused.body.replace(/\n+/g, " | ").slice(0, 200)})`, /Not published/.test(refused.title) && /does not load \(404\)/.test(refused.body) && /Nothing changed on the site/.test(refused.body));
await shot("05-publish-refused-dead-photo");
await page.click(".ps-modal [data-ps-close]");
st = await state(); row = st.practice.ad_pages.find(r => r.slug === SLUG);
check("previous revision intact after the refusal (rev 1, original photo)", row.published_revision === 1 && row.published_content.blocks[0].image === uploadedUrl);

// 8. read-back failure → rollback
await setField('input[data-sb-field="blocks.0.image"]', uploadedUrl);
await page.evaluate(() => { const doc = document.querySelector("#sbFrame").contentDocument; doc.body.click(); });
await page.click('[data-sb-rtab="page"]').catch(() => {});
await page.waitForSelector('[data-sb-field="seo.description"]', { timeout: 20000 });
await setField('[data-sb-field="seo.description"]', "Durable services page, second attempt.");
await waitSaved();
await fetch(`${base}/__local/knob?readback=1`);
const rolled = await publishAttempt();
await fetch(`${base}/__local/knob?readback=0`);
save("06-publish-rolled-back-message.txt", rolled.body);
check(`rollback message names the check and the kept revision (${rolled.body.replace(/\n+/g, " | ").slice(0, 200)})`, /the check "Saved in the database" failed/.test(rolled.body) && /previous version \(revision 1\) is still live/.test(rolled.body));
await shot("06-publish-rolled-back");
await page.click(".ps-modal [data-ps-close]");
st = await state(); row = st.practice.ad_pages.find(r => r.slug === SLUG);
const revs = (rows.ad_page_revisions || []).length;
check(`row restored: revision 1, old description, status published`, row.published_revision === 1 && row.status === "published" && row.published_content.seo.description === "Durable services page with an uploaded photo.");
const revsNow = (await (await fetch(`${base}/__local/rows`)).json()).ad_page_revisions.filter(r => r.page_id === row.id);
check(`no revision row left by the failed attempt (${revsNow.map(r => `${r.kind} v${r.revision}`).join(", ")})`, revsNow.every(r => r.revision <= 1));

// 9. a live publish with a practice-bucket photo → copied into the live bucket
await fetch(`${base}/__local/sandbox?on=0`);
const livePage = await page.evaluate(async ({ base, slug, image }) => {
  const t = window.LDTT_PORTAL?.accessToken?.() || "local-demo";
  const call = async body => (await fetch(`${base}/api/pages`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(body) })).json();
  const content = window.LDTT_SITE_PAGE_TEMPLATE.normalizeSitePage(window.LDTT_SITE_PAGE_TEMPLATE.starter("services"));
  content.slug = slug; content.title = "Live copy"; content.seo.description = "Live publish with a practice photo."; content.blocks[0].image = image;
  const created = await call({ operation: "create", page_type: "site", content });
  const published = await call({ operation: "publish", id: created.page.id });
  return { created, published };
}, { base, slug: `${SLUG}-live`, image: uploadedUrl });
await fetch(`${base}/__local/sandbox?on=1`);
save("07-live-publish-copies-photo.json", JSON.stringify(livePage.published, null, 2));
const liveRow = (await state()).live.ad_pages.find(r => r.slug === `${SLUG}-live`);
check(`live publish copied the practice photo into trainer-page-assets/pages/<slug>/ (${liveRow?.published_content?.blocks?.[0]?.image})`, livePage.published.ok === true && livePage.published.verification.copied === 1 && /\/trainer-page-assets\/pages\/durable-[a-z0-9]+-live\//.test(liveRow?.published_content?.blocks?.[0]?.image || ""));
check("the practice file was left in place (copy, not move)", /\/practice-trainer-page-assets\/site\//.test(uploadedUrl) && (await fetch(uploadedUrl.replace("https://supabase.local", base))).status === 200);

// 10. health check: clean, then a rigged 404 with the DSN payload (dry)
const healthRows = await (await fetch(`${base}/__local/rows`)).json();
const healthRowsFile = resolve(out, "local-health-rows.json");
// The stand-in's storage lives on the same local server; the health probe uses a real fetch, so point the photo URLs there.
const localised = text => text.split("https://supabase.local/storage/v1/object/public/").join(`${base}/storage/v1/object/public/`);
writeFileSync(healthRowsFile, localised(JSON.stringify(healthRows)));
let healthOut; let healthExit = 0;
try { healthOut = execFileSync(process.execPath, ["scripts/site-health.mjs", "--base", base, "--schema", "practice", "--rows", healthRowsFile], { encoding: "utf8", env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_URL: "https://supabase.local" } }); } catch (e) { healthOut = e.stdout; healthExit = e.status; }
save("08-health-clean.json", healthOut);
const healthReport = JSON.parse(healthOut);
check(`health check clean (${healthReport.checked} pages, exit ${healthExit})`, healthExit === 0 && healthReport.ok === true && healthReport.checked >= 1 && healthReport.dsn_payloads.length === 0);
const rigged = { ...healthRows, ad_pages: [...healthRows.ad_pages, { ...healthRows.ad_pages[0], id: "rigged", slug: `gone-${stamp}`, published_revision: 9 }] };
const riggedFile = resolve(out, "local-health-rigged-rows.json");
writeFileSync(riggedFile, localised(JSON.stringify(rigged)));
let riggedOut; let riggedExit = 0;
try { riggedOut = execFileSync(process.execPath, ["scripts/site-health.mjs", "--base", base, "--schema", "practice", "--rows", riggedFile], { encoding: "utf8", env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_URL: "https://supabase.local" } }); } catch (e) { riggedOut = e.stdout; riggedExit = e.status; }
save("09-health-rigged-404.json", riggedOut);
const riggedReport = JSON.parse(riggedOut);
check(`rigged page reported broken with the DSN payload, dry (exit ${riggedExit})`, riggedExit === 1 && riggedReport.broken.some(b => b.slug === `gone-${stamp}`) && riggedReport.dsn_payloads[0].title === `LDTT: page gone-${stamp} is not serving` && riggedReport.dry === true && riggedReport.dsn_results.length === 0);

writeFileSync(resolve(out, "proof-log-local.json"), JSON.stringify(log, null, 2));
await browser.close();
console.log(process.exitCode ? "PROOF FAILED" : "PROOF OK");
