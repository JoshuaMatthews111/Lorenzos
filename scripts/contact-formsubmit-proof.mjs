// Browser proof for DO-NOT-BREAK rule 73 (portal chain step 3b). Serves the REAL contact.html + script.js from this
// repo on localhost and submits the Contact Us form twice in Chrome:
//   live mode     (/api/environment -> sandbox:false): FormSubmit production@ MUST receive the post (server email
//                  reported failed -> the browser retry to formsubmit.co/ajax/production@), and /api/pipeline is never called;
//   practice mode (/api/environment -> sandbox:true):  the separate practice listener saves through submit-contact with
//                  x-ldtt-practice and enters /api/pipeline; FormSubmit and /api/form-delivery are NEVER called.
// EVERY outside request is intercepted by Playwright: nothing reaches Supabase, FormSubmit, Google or Meta.
// Usage: node scripts/contact-formsubmit-proof.mjs [outDir]
import http from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const root = resolve(import.meta.dirname, "..");
const outDir = process.argv[2] || join(process.env.HOME, "Desktop", "LDTT Pipeline Test 2026-09-12");
mkdirSync(outDir, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = resolve(root, `.${path === "/" ? "/index.html" : path}`);
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

async function run(mode) {
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage();
  const seen = [];
  await page.route("**/*", async route => {
    const req = route.request();
    const url = req.url();
    const u = new URL(url);
    const record = () => seen.push({ method: req.method(), url, headers: req.headers(), body: req.postData() || "" });
    if (u.origin === base && u.pathname === "/api/environment") return route.fulfill({ json: mode === "live" ? { sandbox: false, schema: "public" } : { sandbox: true, schema: "practice" } });
    if (u.origin === base && u.pathname === "/api/form-delivery") {
      record();
      const b = JSON.parse(req.postData() || "{}");
      return route.fulfill({ json: b.client_delivery ? { ok: true } : { ok: true, deliveries: [{ destination: "google_sheet", status: "accepted" }, { destination: "formsubmit_email", status: "failed" }] } });
    }
    if (u.origin === base && u.pathname === "/api/pipeline") { record(); return route.fulfill({ json: { ok: true, lead_id: "proof-lead", trainer_slug: "lorenzo-miller", book_url: "https://ldtt-sandbox.vercel.app/book/lorenzo-miller?lead=proof-lead", texted: false } }); }
    if (u.origin === base) return route.continue();
    if (/\/functions\/v1\/submit-contact$/.test(u.pathname)) { record(); return route.fulfill({ json: { ok: true, entity_type: "lead", lead_id: "proof-lead" }, headers: { "Access-Control-Allow-Origin": "*" } }); }
    if (/functions\/v1\//.test(u.pathname)) { record(); return route.fulfill({ json: { ok: true, skipped: true }, headers: { "Access-Control-Allow-Origin": "*" } }); }
    if (u.host === "formsubmit.co") { record(); return route.fulfill({ json: { success: "true", message: "intercepted by the proof, nothing was sent" }, headers: { "Access-Control-Allow-Origin": "*" } }); }
    return route.abort(); // Google, Meta, fonts: never contacted
  });
  await page.goto(`${base}/contact.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.LDTT_IS_SANDBOX === "boolean");
  const markup = await page.$eval("form.contact-intake", f => ({ action: f.getAttribute("action"), method: f.getAttribute("method"), emailEndpoint: f.dataset.emailEndpoint }));
  const fill = { first_name: "Proof", last_name: mode === "live" ? "LiveMode" : "PracticeMode", address_line_1: "1 Main St", city: "Cleveland", state: "OH", zip: "44128", email: "proof@example.test", phone: "440-214-2915", comments: "Browser proof, intercepted, nothing sent." };
  for (const [k, v] of Object.entries(fill)) await page.fill(`form.contact-intake [name="${k}"]`, v);
  await page.selectOption('form.contact-intake [name="i_want_to"]', { label: "Schedule a virtual evaluation" });
  await page.selectOption('form.contact-intake [name="heard_about_us"]', { label: "Google Search" });
  await page.check('form.contact-intake [name="sms_consent"]');
  await page.click('form.contact-intake button[type="submit"]');
  await page.waitForFunction(() => /success|error/.test(document.querySelector("form.contact-intake .form-status")?.className || ""), null, { timeout: 15000 });
  const status = await page.$eval("form.contact-intake .form-status", el => ({ className: el.className, text: el.textContent.trim() }));
  await page.screenshot({ path: join(outDir, `step3b-contact-${mode}-mode.png`), fullPage: false });
  await browser.close();
  const formsubmit = seen.filter(s => new URL(s.url).host === "formsubmit.co");
  const submitContact = seen.filter(s => /submit-contact$/.test(new URL(s.url).pathname));
  return {
    mode, markup, status,
    submit_contact_calls: submitContact.length,
    submit_contact_practice_header: submitContact.map(s => s.headers["x-ldtt-practice"] || null),
    form_delivery_calls: seen.filter(s => s.url.endsWith("/api/form-delivery")).length,
    formsubmit_posts: formsubmit.map(s => ({ url: s.url, has_first_name: /name="first_name"\r\n\r\nProof/.test(s.body), has_subject: /New Lorenzo's Dog Training Team Contact Form Submission/.test(s.body) })),
    pipeline_calls: seen.filter(s => s.url.endsWith("/api/pipeline")).map(s => JSON.parse(s.body))
  };
}

const live = await run("live");
const practice = await run("practice");
server.close();
const checks = {
  live_form_action_is_formsubmit_production: live.markup.action === "https://formsubmit.co/production@lorenzosdogtrainingteam.com" && live.markup.method === "POST",
  live_formsubmit_received_the_post: live.formsubmit_posts.length === 1 && live.formsubmit_posts[0].url === "https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com" && live.formsubmit_posts[0].has_first_name && live.formsubmit_posts[0].has_subject,
  live_form_delivery_called: live.form_delivery_calls === 2,
  live_no_pipeline_call: live.pipeline_calls.length === 0,
  live_no_practice_header: live.submit_contact_practice_header.every(h => h === null),
  live_success_shown: /success/.test(live.status.className),
  practice_no_formsubmit: practice.formsubmit_posts.length === 0,
  practice_no_form_delivery: practice.form_delivery_calls === 0,
  practice_saved_with_practice_header: practice.submit_contact_calls === 1 && practice.submit_contact_practice_header[0] === "1",
  practice_entered_pipeline_once: practice.pipeline_calls.length === 1 && practice.pipeline_calls[0].op === "enter" && practice.pipeline_calls[0].lead_id === "proof-lead",
  practice_success_shown: /success/.test(practice.status.className) && /PRACTICE COPY/.test(practice.status.text)
};
const result = { ok: Object.values(checks).every(Boolean), checks, live, practice, at: new Date().toISOString() };
writeFileSync(join(outDir, "step3b-contact-formsubmit-proof.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: result.ok, checks }, null, 2));
process.exit(result.ok ? 0 : 1);
