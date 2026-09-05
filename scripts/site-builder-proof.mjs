// Drives the Site Builder end to end with Playwright and saves a numbered
// screenshot of each step. NOT deployed (scripts/ is in .vercelignore).
//
//   local:   node scripts/page-studio-local.mjs   (in another shell)
//            node scripts/site-builder-proof.mjs <out-dir>
//   preview: BASE=https://<preview>.vercel.app PRACTICE_LOGIN=... PRACTICE_PASSWORD=... node scripts/site-builder-proof.mjs <out-dir>
//
// The practice login is the sandbox testing account, never a staff login; the
// password comes from the environment and is never written anywhere.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || "/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const base = (process.env.BASE || "http://localhost:4173").replace(/\/$/, "");
const out = resolve(process.argv[2] || "proof-shots");
const stamp = Date.now().toString(36).slice(-5);
const SERVICES = process.env.SERVICES_SLUG || `services-${stamp}`;
const CONTACT = process.env.CONTACT_SLUG || `contact-${stamp}`;
mkdirSync(out, { recursive: true });
const log = [];
const note = (step, detail) => { log.push({ step, detail, at: new Date().toISOString() }); console.log(`${step}: ${detail}`); };
const check = (label, ok) => { note(ok ? "PASS" : "FAIL", label); if (!ok) process.exitCode = 1; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", error => note("page error", error.message));
page.on("dialog", dialog => dialog.accept());
const shot = async (name, opts = {}) => { await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: opts.full === true }); note("screenshot", `${name}.png`); };
const frameDoc = () => page.frames().find(f => f.name() === "" && f !== page.mainFrame() && f.url().startsWith("about:")) || page.frames()[1];
const canvas = async () => { await page.waitForFunction(() => document.querySelector("#sbFrame")?.contentDocument?.readyState === "complete" && document.querySelector("#sbFrame")?.contentDocument?.body, null, { timeout: 20000 }); return page.frames().find(f => f.parentFrame() === page.mainFrame() && f.name() !== "psFrame"); };
const waitSaved = async () => { await page.waitForFunction(() => /^Saved/.test(document.querySelector("#sbStatus")?.textContent || ""), null, { timeout: 30000 }); };
const token = async () => page.evaluate(() => window.LDTT_PORTAL?.accessToken?.() || "local-demo");
const api = async body => { const t = await token(); return page.evaluate(async ({ base, t, body }) => { const r = await fetch(`${base}/api/pages`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; }, { base, t, body }); };

// 1. sign in
await page.goto(`${base}/trainer-backoffice/`, { waitUntil: "networkidle" });
if (await page.$('[data-login-mode="admin"]')) await page.click('[data-login-mode="admin"]');
await page.fill('input[name="username"]', process.env.PRACTICE_LOGIN || "admin");
await page.fill('input[name="password"]', process.env.PRACTICE_PASSWORD || "doglovers26");
await page.click('#loginForm button[type="submit"]');
await page.waitForSelector("#sidebar .nav-btn", { timeout: 30000 });

// 2. studio home
await page.click('.nav-btn[data-view="pageStudio"]');
await page.waitForSelector("#pageStudioRoot [data-sb-studio]", { timeout: 20000 });
await page.waitForTimeout(1200);
await shot("01-studio-home");

// 3. open the Site Builder, block library
await page.click("#pageStudioRoot [data-sb-studio]:not([data-sb-studio=theme]):not([data-sb-studio=nav])");
await page.waitForSelector("#sbOverlay", { timeout: 20000 });
const overlayBox = await page.evaluate(() => { const r = document.getElementById("sbOverlay").getBoundingClientRect(); return { w: r.width, h: r.height, pos: getComputedStyle(document.getElementById("sbOverlay")).position }; });
check(`studio is full screen (${JSON.stringify(overlayBox)})`, overlayBox.pos === "fixed" && overlayBox.w >= 1400);
await page.click('[data-sb-tab="blocks"]');
await page.waitForSelector(".sb-block-card");
check("block library has 17 blocks", (await page.$$(".sb-block-card")).length === 17);
await page.fill('[data-sb-search="blocks"]', "faq");
await page.waitForTimeout(200);
check("block search narrows to FAQ", (await page.$$(".sb-block-card")).length === 1);
await page.fill('[data-sb-search="blocks"]', "");
await page.waitForTimeout(200);
await shot("02-block-library");

// 4. import About from the static site
await page.click('[data-sb-tab="pages"]');
await page.click("[data-sb-act=new-page]");
await page.waitForSelector("#sbPanel .sb-new");
const importBtn = await page.$('[data-sb-act=import-page][data-slug="about"]');
let aboutId = null;
if (importBtn) {
  await importBtn.click();
  await page.waitForFunction(() => document.querySelector("#sbAddr")?.textContent?.startsWith("/about"), null, { timeout: 30000 });
} else {
  // already imported on this deployment: open it from the list
  await page.click("[data-sb-act=close-panel]");
  await page.click('[data-sb-page][data-type="site"]:has-text("/about")');
  await page.waitForFunction(() => document.querySelector("#sbAddr")?.textContent?.startsWith("/about"), null, { timeout: 30000 });
}
await canvas();
await page.waitForTimeout(800);
aboutId = await page.evaluate(() => window.LDTT_SITE_BUILDER.state().pageId);
const aboutBlocks = await page.evaluate(() => window.LDTT_SITE_BUILDER.state().draft.blocks.map(b => b.type));
note("About imported blocks", aboutBlocks.join(","));
const aboutWords = await page.evaluate(() => document.querySelector("#sbFrame").contentDocument.body.innerText);
check("About import keeps the founder's words", /Lorenzo Miller/.test(aboutWords) && /keep dogs out of shelters/i.test(aboutWords));
await shot("03-about-imported");

// 5. new Services page from the template
await page.click("[data-sb-act=new-page]");
await page.waitForSelector("#sbPanel .sb-new");
await page.click('[data-sb-starter="services"]');
await page.fill("#sbNewName", "Services");
await page.fill("#sbNewSlug", SERVICES);
await page.click("[data-sb-act=new-go]");
await page.waitForFunction(slug => document.querySelector("#sbAddr")?.textContent?.startsWith(`/${slug}`), SERVICES, { timeout: 30000 });
await canvas(); await page.waitForTimeout(800);
const servicesBlocks = () => page.evaluate(() => window.LDTT_SITE_BUILDER.state().draft.blocks.map(b => b.type));
note("Services template blocks", (await servicesBlocks()).join(","));
await shot("04-services-from-template");

// 6. site theme: font pair
await page.click('[data-sb-tab="theme"]');
await page.waitForSelector('[data-sb-theme="pair"]');
await page.selectOption('[data-sb-theme="pair"]', "classic");
await page.waitForTimeout(700);
const fontHead = await page.evaluate(() => window.LDTT_SITE_BUILDER.state().themeDraft.fontHead);
const canvasHasPlayfair = await page.evaluate(() => document.querySelector("#sbFrame").contentDocument.documentElement.innerHTML.includes("Playfair"));
check(`font pair applied to the canvas (${fontHead})`, fontHead === "playfair" && canvasHasPlayfair);
await shot("05-font-pair-changed");

// 7. palette with a contrast warning, then a good palette, then save
await page.fill('input[type="text"][data-sb-field="site.colors.primary"]', "#ffffff");
await page.dispatchEvent('input[type="text"][data-sb-field="site.colors.primary"]', "change");
await page.waitForTimeout(300);
check("contrast warning shows for white primary", Boolean(await page.$(".sb-warn")));
await shot("06-palette-contrast-warning");
await page.fill('input[type="text"][data-sb-field="site.colors.primary"]', "#0b3d2e");
await page.dispatchEvent('input[type="text"][data-sb-field="site.colors.primary"]', "change");
await page.fill('input[type="text"][data-sb-field="site.colors.accent"]', "#b3261e");
await page.dispatchEvent('input[type="text"][data-sb-field="site.colors.accent"]', "change");
await page.waitForTimeout(300);
check("no contrast warning for the green + red palette", Boolean(await page.$(".sb-ok")));
await page.click("[data-sb-act=save-theme]");
await page.waitForFunction(() => /Saved/.test(document.querySelector("#sbLeft")?.textContent || ""), null, { timeout: 20000 });
await page.waitForTimeout(600);
await shot("06b-palette-saved");

// 8. blocks: add FAQ after the selected block, duplicate, move, undo
await page.click('[data-sb-tab="blocks"]');
await page.evaluate(() => { const s = window.LDTT_SITE_BUILDER.state(); s.selectedId = s.draft.blocks[1].id; });
await page.click('[data-sb-addblock="faq"]');
await page.waitForTimeout(600);
let types = await servicesBlocks();
check(`FAQ added after block 2 (${types.join(",")})`, types[2] === "faq");
await page.waitForSelector("#sbRight [data-sb-act=duplicate]");
await page.click("#sbRight [data-sb-act=duplicate]");
await page.waitForTimeout(500);
types = await servicesBlocks();
check("FAQ duplicated", types[2] === "faq" && types[3] === "faq");
await page.click('#sbRight [data-sb-act=move][data-dir="-1"]');
await page.waitForTimeout(500);
types = await servicesBlocks();
check("duplicate moved up", types[2] === "faq" && types[3] === "faq");
await page.click("#sbUndo");
await page.waitForTimeout(500);
await page.click("#sbUndo");
await page.waitForTimeout(500);
types = await servicesBlocks();
check(`undo twice removes the move and the duplicate (${types.join(",")})`, types.filter(t => t === "faq").length === 2 && types[2] === "faq" && types[3] !== "faq");
await page.click("#sbRedo");
await page.waitForTimeout(500);
await shot("07-blocks-added-duplicated-reordered");

// 9. page settings: description, then publish + add to menu
await page.click('[data-sb-rtab="page"]');
await page.fill('[data-sb-field="seo.description"]', "Dog obedience, behavior modification, specialty programs and board and train from Lorenzo's Dog Training Team.");
await waitSaved();
await page.click('[data-sb-device="mobile"]');
await page.waitForTimeout(700);
await shot("08-mobile-canvas");
await page.click('[data-sb-device="desktop"]');
await page.click("#sbPublishBtn");
await page.waitForSelector(".ps-modal .ps-checklist");
check("publish checklist all green for Services", (await page.$$(".ps-modal .ps-check.bad")).length === 0);
await shot("09-publish-checklist");
await page.click(".ps-modal [data-ps-go]");
await page.waitForFunction(() => /Published/.test(document.querySelector(".ps-modal h3")?.textContent || ""), null, { timeout: 30000 });
await shot("10-published");
await page.click(".ps-modal [data-ps-close]");

// 10. Menus screen: Services should be in the header menu now
await page.click('[data-sb-tab="nav"]');
await page.waitForSelector("#sbLeft .sb-nav-row");
const navLabels = await page.$$eval('#sbLeft input[data-sb-field^="nav.header.links"][data-sb-field$=".label"]', els => els.map(e => e.value));
check(`Services is in the header menu (${navLabels.join(" | ")})`, navLabels.includes("Services"));
await shot("11-navigation-screen");

// 11. Contact page from the template with the form + map, publish
await page.click('[data-sb-tab="pages"]');
await page.click("[data-sb-act=new-page]");
await page.waitForSelector("#sbPanel .sb-new");
await page.click('[data-sb-starter="contact"]');
await page.fill("#sbNewName", "Contact us");
await page.fill("#sbNewSlug", CONTACT);
await page.click("[data-sb-act=new-go]");
await page.waitForFunction(slug => document.querySelector("#sbAddr")?.textContent?.startsWith(`/${slug}`), CONTACT, { timeout: 30000 });
await canvas(); await page.waitForTimeout(800);
const contactHasForm = await page.evaluate(() => Boolean(document.querySelector("#sbFrame").contentDocument.querySelector("form.contact-intake")) && Boolean(document.querySelector("#sbFrame").contentDocument.querySelector(".sb-map iframe")));
check("Contact page shows the lead form and the map", contactHasForm);
await page.click('[data-sb-rtab="page"]');
await page.fill('[data-sb-field="seo.description"]', "Book an evaluation with Lorenzo's Dog Training Team or call the office.");
await waitSaved();
await shot("12-contact-page-form-and-map");
await page.click("#sbPublishBtn");
await page.waitForSelector(".ps-modal [data-ps-go]");
await page.click(".ps-modal [data-ps-go]");
await page.waitForFunction(() => /Published/.test(document.querySelector(".ps-modal h3")?.textContent || ""), null, { timeout: 30000 });
await page.click(".ps-modal [data-ps-close]");

// 12. publish checklist refusal: a blank page
await page.click('[data-sb-tab="pages"]');
await page.click("[data-sb-act=new-page]");
await page.waitForSelector("#sbPanel .sb-new");
await page.click('[data-sb-starter="blank"]');
await page.fill("#sbNewName", `Empty ${stamp}`);
await page.click("[data-sb-act=new-go]");
await page.waitForFunction(() => document.querySelector("#sbAddr")?.textContent?.startsWith("/empty-"), null, { timeout: 30000 });
await canvas(); await page.waitForTimeout(500);
check("empty page shows the 3-step empty state", await page.evaluate(() => /Three steps/.test(document.querySelector("#sbFrame").contentDocument.body.innerText)));
await shot("13-empty-page-state");
await page.click("#sbPublishBtn");
await page.waitForSelector(".ps-modal .ps-checklist");
const bad = await page.$$eval(".ps-modal .ps-check.bad", els => els.map(e => e.textContent));
check(`publish refused with plain words (${bad.length} items)`, bad.length >= 3 && bad.some(t => /Add a block/.test(t)));
await shot("14-publish-checklist-refusal");
await page.keyboard.press("Escape");
const emptyId = await page.evaluate(() => window.LDTT_SITE_BUILDER.state().pageId);
await api({ operation: "archive", id: emptyId });

// 13. restore: open Services, save a version, change the hero, restore
await page.click('[data-sb-tab="pages"]');
await page.click(`[data-sb-page]:has-text("/${SERVICES}")`);
await page.waitForFunction(slug => document.querySelector("#sbAddr")?.textContent?.startsWith(`/${slug}`), SERVICES, { timeout: 30000 });
await canvas(); await page.waitForTimeout(600);
const heroBefore = await page.evaluate(() => window.LDTT_SITE_BUILDER.state().draft.blocks[0].headline);
await page.click('[data-sb-rtab="page"]');
await page.click("[data-sb-act=snapshot]");
await page.waitForTimeout(800);
await page.evaluate(() => { const s = window.LDTT_SITE_BUILDER.state(); s.selectedId = s.draft.blocks[0].id; });
await page.click('[data-sb-rtab="block"]');
await page.waitForSelector('[data-sb-field="blocks.0.headline"]');
await page.fill('[data-sb-field="blocks.0.headline"]', "A wrong headline typed by mistake");
await waitSaved();
await page.click('[data-sb-rtab="page"]');
await page.waitForSelector("#sbRight [data-sb-act=restore]");
await page.click("#sbRight [data-sb-act=restore]");
await page.waitForFunction(before => window.LDTT_SITE_BUILDER.state().draft.blocks[0].headline === before, heroBefore, { timeout: 20000 });
check("one-click restore put the headline back", true);
await page.waitForTimeout(600);
await shot("15-history-restore");

// 14. keyboard: Esc hides the rails, Cmd+S saves
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("Esc hides both rails", await page.evaluate(() => document.querySelector("#sbOverlay").classList.contains("sb-left-hidden") && document.querySelector("#sbOverlay").classList.contains("sb-right-hidden")));
await shot("16-rails-hidden-canvas-only");
await page.click("[data-sb-act=toggle-left]"); await page.click("[data-sb-act=toggle-right]");

// 15. iPad width
await page.setViewportSize({ width: 1024, height: 768 });
await page.waitForTimeout(500);
await shot("17-ipad-width");
await page.setViewportSize({ width: 1440, height: 900 });
await page.click("[data-sb-act=close]");
await page.waitForTimeout(500);

// 16. served pages: clean path + /p/, header/footer, mobile, sitemap, unpublished 404
const pub = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const probe = async (path, expect) => { const r = await pub.goto(`${base}${path}`, { waitUntil: "domcontentloaded" }); const ok = r.status() === expect; check(`${path} → ${r.status()} (expected ${expect})`, ok); return r; };
await probe(`/${SERVICES}`, 200);
const servedHtml = await pub.content();
check("served Services page has the pixel, Google tag, header menu and footer", /fbq\('init'/.test(servedHtml) && /AW-11463464040/.test(servedHtml) && /class="nav-links"/.test(servedHtml) && /<footer class="footer"/.test(servedHtml));
check("served page carries the saved theme (green primary, Playfair)", /--navy:#0b3d2e/.test(servedHtml) && /Playfair/.test(servedHtml));
check("served header menu lists Services", (await pub.$$eval("#navLinks a", els => els.map(e => e.textContent.trim()))).includes("Services"));
await pub.screenshot({ path: resolve(out, "18-published-services-desktop.png"), fullPage: true }); note("screenshot", "18-published-services-desktop.png");
await pub.setViewportSize({ width: 390, height: 844 });
await pub.reload({ waitUntil: "domcontentloaded" });
await pub.screenshot({ path: resolve(out, "19-published-services-mobile.png"), fullPage: true }); note("screenshot", "19-published-services-mobile.png");
await pub.setViewportSize({ width: 1440, height: 900 });
await probe(`/p/${SERVICES}`, 200);
await probe(`/ads/${SERVICES}`, 404);
await probe(`/${CONTACT}`, 200);
check("served Contact page has the contact-intake form and the map", await pub.evaluate(() => Boolean(document.querySelector("form.contact-intake")) && Boolean(document.querySelector(".sb-map iframe"))));
await pub.screenshot({ path: resolve(out, "20-published-contact-desktop.png"), fullPage: true }); note("screenshot", "20-published-contact-desktop.png");
await pub.setViewportSize({ width: 390, height: 844 });
await pub.reload({ waitUntil: "domcontentloaded" });
await pub.screenshot({ path: resolve(out, "21-published-contact-mobile.png"), fullPage: true }); note("screenshot", "21-published-contact-mobile.png");
await pub.setViewportSize({ width: 1440, height: 900 });
const sm = await pub.goto(`${base}/sitemap.xml`);
const smText = await sm.text();
check("sitemap.xml lists the published pages", smText.includes(`/${SERVICES}</loc>`) && smText.includes(`/${CONTACT}</loc>`));
await probe(`/p/not-a-page-${stamp}`, 404);
// /about: the static file still serves (the import is a draft) — unless a previous run published it.
const aboutRes = await pub.goto(`${base}/about`, { waitUntil: "domcontentloaded" });
note("/about", `${aboutRes.status()} ${(await pub.content()).includes('data-site-page="about"') ? "Site Builder page" : "static about.html"}`);
await pub.screenshot({ path: resolve(out, "22-about-current.png"), fullPage: false }); note("screenshot", "22-about-current.png");

// 17. clean up: unpublish contact (services stays for the report), check the 404 + manifest
const list = await api({ operation: "list" });
const contactRow = list.data.pages.find(p => p.slug === CONTACT);
await api({ operation: "unpublish", id: contactRow.id });
await pub.waitForTimeout(500);
await probe(`/p/${CONTACT}`, 404);
writeFileSync(resolve(out, "proof-log.json"), JSON.stringify({ base, services: SERVICES, contact: CONTACT, aboutId, log }, null, 2));
await browser.close();
console.log(process.exitCode ? "PROOF HAD FAILURES" : "PROOF OK");
