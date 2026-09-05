// Screenshots of PUBLISHED Site Builder pages on a deployment (no login needed):
// desktop + mobile of each slug, plus the practice portal's Page Studio login
// screen. Usage: BASE=https://<preview> node scripts/site-builder-preview-shots.mjs <out-dir> slug1 slug2 …
// NOT deployed.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || "/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const base = (process.env.BASE || "").replace(/\/$/, "");
const out = resolve(process.argv[2] || "proof-shots");
const slugs = process.argv.slice(3);
mkdirSync(out, { recursive: true });
const log = [];
const browser = await chromium.launch();
let n = Number(process.env.START || 18);
for (const slug of slugs) {
  for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const r = await page.goto(`${base}/${slug}`, { waitUntil: "networkidle" });
    const info = await page.evaluate(() => ({ title: document.title, h1: document.querySelector("h1")?.textContent, menu: [...document.querySelectorAll("#navLinks a")].map(a => a.textContent.trim()), footer: Boolean(document.querySelector("footer.footer")), form: Boolean(document.querySelector("form.contact-intake")), map: Boolean(document.querySelector(".sb-map iframe")), pixel: typeof fbq === "function" || document.documentElement.innerHTML.includes("fbq('init'") }));
    const file = `${String(n).padStart(2, "0")}-preview-${slug}-${label}.png`;
    await page.screenshot({ path: resolve(out, file), fullPage: true });
    log.push({ slug, label, status: r.status(), file, ...info, headers: { type: r.headers()["x-ldtt-page-type"], cache: r.headers()["cache-control"] } });
    console.log(file, r.status(), info.h1, info.menu.length, "menu links", info.pixel ? "pixel" : "NO PIXEL");
    await page.close();
    n += 1;
  }
}
writeFileSync(resolve(out, "preview-probe.json"), JSON.stringify({ base, log }, null, 2));
await browser.close();
