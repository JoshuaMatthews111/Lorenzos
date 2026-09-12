// Step 3b proof ON THE PRACTICE COPY (DO-NOT-BREAK rule 73). Practice schema only; never live.
//  A. queue: a booking-lead (sms_consent false: no customer texts) is booked -> the office email is QUEUED
//     ("Office email waiting for the Resend key") while RESEND_API_KEY is missing; "send queued" sends nothing.
//     The only text is the practice trainer alert, which goes to the tester phone in the settings box.
//  B. Contact Us lanes: submit-contact (x-ldtt-practice) + /api/pipeline enter for "Schedule a free phone
//     consultation..." (lane office_call; no Make route yet -> no text) and an unknown answer (office_follow_up).
//  C. signed in (saved practice session): settings report resend_ready false + queued count; send_queued answers
//     "waiting"; screenshots of the lead panel and the Settings box.
// Usage: node scripts/step3b-sandbox-proof.mjs [base] [outDir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const base = (process.argv[2] || "https://ldtt-sandbox.vercel.app").replace(/\/$/, "");
const outDir = process.argv[3] || join(process.env.HOME, "Desktop", "LDTT Pipeline Test 2026-09-12");
mkdirSync(outDir, { recursive: true });
const root = resolve(import.meta.dirname, "..");
const functionsBaseUrl = readFileSync(join(root, "supabase-config.js"), "utf8").match(/functionsBaseUrl\s*:\s*["']([^"']+)["']/)[1];
const json = async (url, options = {}) => {
  const r = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const env = await json(`${base}/api/environment`);
if (env.body.sandbox !== true || env.body.schema !== "practice") throw new Error(`not the practice copy: ${JSON.stringify(env.body)}`);
const stamp = Date.now();
const out = { base, at: new Date().toISOString(), env: env.body };

// A. the queue
const lead = await json(`${base}/api/booking-lead`, { method: "POST", headers: { Origin: base }, body: { first_name: "Resend", last_name: "Queue Proof", phone: "440-214-2915", email: `resend-queue-proof-${stamp}@example.test`, zip: "44128", problem: "Step 3b queue proof (no customer texts)", dog_name: "Proofy", sms_consent: false, source_page: "step3b-proof" } });
out.booking_lead = lead;
const slots = await json(`${base}/api/booking?trainer=lorenzo-miller&lead=${lead.body.lead_id}`);
const slot = slots.body.slots.at(-1);
out.slot = slot;
out.booking = await json(`${base}/api/booking`, { method: "POST", headers: { Origin: base }, body: {
  trainer_slug: "lorenzo-miller", slot_start: slot.start, lead_id: lead.body.lead_id, location: "in_home",
  client: { first_name: "Resend", last_name: "Queue Proof", phone: "440-214-2915", email: `resend-queue-proof-${stamp}@example.test`, address: "1 Proof St, Garfield Heights, OH 44128" },
  dogs: [{ name: "Proofy", sex: "Female", fixed: "Yes", vaccinated: "Yes", age: "3", breed: "Mixed", behavior: "Pulls on the leash (step 3b proof)" }, { name: "Second Proof", sex: "Male", fixed: "No", vaccinated: "Yes", age: "1", breed: "Boxer", behavior: "Jumps on guests" }]
} });

// B. Contact Us lanes (through the real practice submit-contact)
async function contactLead(answer, tag) {
  const entries = { first_name: "Lane", last_name: `Proof ${tag}`, email: `lane-proof-${tag}-${stamp}@example.test`, phone: "440-214-2915", address_line_1: "1 Proof St", city: "Cleveland", state: "OH", zip: "44128", i_want_to: answer, heard_about_us: "Google Search", comments: `Step 3b lane proof: ${tag}`, sms_consent: "yes", source_page: "contact.html", page_url: `${base}/contact.html`, qa: "true", submission_id: `practice-lane-proof-${tag}-${stamp}`, timestamp: new Date().toISOString() };
  const saved = await json(`${functionsBaseUrl.replace(/\/$/, "")}/submit-contact`, { method: "POST", headers: { "x-ldtt-practice": "1" }, body: entries });
  const entered = saved.body.lead_id ? await json(`${base}/api/pipeline`, { method: "POST", headers: { Origin: base }, body: { op: "enter", lead_id: saved.body.lead_id, via: "contact.html" } }) : null;
  return { answer, saved: saved.body, entered };
}
out.lanes = [await contactLead("Schedule a free phone consultation to receive more information", "phone"), await contactLead("Other request", "unknown")];

// C. signed in
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ storageState: join(process.env.HOME, ".ldtt-sessions", "sandbox.json"), viewport: { width: 1440, height: 1000 } });
const ss = JSON.parse(readFileSync(join(process.env.HOME, ".ldtt-sessions", "sandbox-sessionStorage.json"), "utf8"));
await context.addInitScript(entries => { try { for (const [k, v] of Object.entries(entries)) sessionStorage.setItem(k, v); } catch {} }, Array.isArray(ss) ? Object.fromEntries(ss.map(x => [x.name || x.key, x.value])) : ss);
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
await page.goto(`${base}/staff?view=leads&lead=${lead.body.lead_id}`, { waitUntil: "networkidle" });
await page.waitForSelector(".lead-detail-panel", { timeout: 30000 });
await page.waitForTimeout(1500);
out.panel_text = await page.$eval(".lead-detail-panel", el => el.innerText.match(/Pipeline lane[\s\S]{0,40}|Office email[^\n]*/g));
await (await page.$(".lead-booking-block"))?.screenshot({ path: join(outDir, "step3b-lead-panel-office-email-waiting.png") });
out.api = await page.evaluate(async () => {
  const token = await window.LDTT_PORTAL.accessToken();
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const settings = await (await fetch("/api/pipeline?op=settings", { headers: h, cache: "no-store" })).json();
  const send = await (await fetch("/api/pipeline", { method: "POST", headers: h, body: JSON.stringify({ op: "send_queued" }) })).json();
  return { email: settings.email, practice_email_to: settings.settings?.practice_email_to, send_queued: { message: send.message, resend_ready: send.resend_ready, sent: send.sent?.length, waiting: send.waiting } };
});
await page.goto(`${base}/staff?view=settings`, { waitUntil: "networkidle" });
await page.waitForFunction(() => /Booking emails to the office/.test(document.body.innerText) && !/Loading the email list/.test(document.body.innerText), null, { timeout: 30000 });
const box = page.locator(".panel", { hasText: "Booking emails to the office" }).first();
await box.scrollIntoViewIfNeeded();
await box.screenshot({ path: join(outDir, "step3b-settings-resend-waiting.png") });
out.settings_text = (await box.innerText()).split("\n").filter(l => /Resend|waiting|test address/i.test(l));
out.page_errors = errors;
await browser.close();
writeFileSync(join(outDir, "step3b-sandbox-proof.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  lead: out.booking_lead.body.lead_id, booking: out.booking.status, when: out.booking.body.when,
  lanes: out.lanes.map(l => ({ answer: l.answer, lead: l.saved.lead_id, lane: l.entered?.body?.lane, texted: l.entered?.body?.texted })),
  panel: out.panel_text, api: out.api, settings: out.settings_text, errors: out.page_errors
}, null, 2));
