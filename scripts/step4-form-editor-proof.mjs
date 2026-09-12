// Step 4 proof (DO-NOT-BREAK rule 75): the lead form editor on the PRACTICE COPY, driven through the real portal
// with the signed-in practice session (~/.ldtt-sessions). Nothing here touches live: every URL is the practice
// copy, and the one test lead it submits is a practice lead with NO SMS consent (so no text can be sent).
//
//   node scripts/step4-form-editor-proof.mjs <base> <outDir> edit     rename + add + remove Phone + publish; check
//                                                                      /contact and the booking page; submit 1 practice lead
//   node scripts/step4-form-editor-proof.mjs <base> <outDir> lead <id>  the lead panel with the extra answer
//   node scripts/step4-form-editor-proof.mjs <base> <outDir> revert    undo the removal, reset both forms, publish
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/presdinetaloffice/.claude/skills/gstack/node_modules/playwright");
const [base = "https://ldtt-sandbox.vercel.app", out = join(process.env.HOME, "Desktop", "LDTT Pipeline Test 2026-09-12", "step4"), phase = "edit", leadId = ""] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const proof = { base, phase, at: new Date().toISOString(), checks: {} };
const check = (name, value) => { proof.checks[name] = value; console.log(value ? "PASS" : "FAIL", name); };

const env = await (await fetch(`${base}/api/environment`)).json();
if (env.sandbox !== true || env.schema !== "practice") throw new Error(`Not the practice copy: ${JSON.stringify(env)}`);
check("practice copy (sandbox:true, schema:practice, leadForms:true)", env.leadForms === true);

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ storageState: join(process.env.HOME, ".ldtt-sessions", "sandbox.json"), viewport: { width: 1440, height: 1000 } });
const ss = JSON.parse(readFileSync(join(process.env.HOME, ".ldtt-sessions", "sandbox-sessionStorage.json"), "utf8"));
await context.addInitScript(entries => { try { for (const [k, v] of Object.entries(entries)) sessionStorage.setItem(k, v); } catch {} }, Array.isArray(ss) ? Object.fromEntries(ss.map(x => [x.name || x.key, x.value])) : ss);
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(String(error)));
const shot = async (name, target = page, full = true) => { await target.screenshot({ path: join(out, `${name}.png`), fullPage: full }); console.log("shot", name); };
const leadFormsPost = () => page.waitForResponse(r => r.url().includes("/api/lead-forms") && r.request().method() === "POST", { timeout: 30000 });

async function openEditor() {
  await page.goto(`${base}/staff`, { waitUntil: "networkidle" });
  await page.locator('[data-view="pageEditor"]').first().click();
  await page.locator('.page-work-tab[data-view="formEditor"]').click();
  await page.waitForSelector(".lf-editor", { timeout: 30000 });
}
async function pick(id) { await page.click(`[data-lf-pick="${id}"]`); await page.waitForSelector(`.lf-form-pick.active[data-lf-pick="${id}"]`); }
async function confirmDialog(name) {
  await page.waitForSelector(".lf-dialog[open]");
  const box = page.locator(".lf-dialog [data-lf-name]");
  if (!(await box.inputValue()).trim().includes(" ")) await box.fill("Proof Tester");
  if (name) await shot(name, page, false);
  const done = leadFormsPost();
  await page.click(".lf-dialog [data-lf-dialog-go]");
  const response = await done;
  if (!response.ok()) throw new Error(`lead-forms answered ${response.status()}: ${await response.text()}`);
  await page.waitForTimeout(600);
}

if (phase === "edit") {
  await openEditor();
  check("editor opens on the Contact Us form (third Page Editor door)", await page.locator('.lf-form-pick.active[data-lf-pick="contact"]').count() === 1);
  await shot("step4-01-editor-overview");
  // Rename, add a required question.
  await page.fill('[data-lf-label="comments"]', "Tell us about your dog");
  await page.fill("[data-lf-new-label]", "How old is your dog?");
  await page.selectOption("[data-lf-new-type]", "text");
  await page.click("[data-lf-add]");
  await page.locator('.lf-row [data-lf-required^="x_"]').last().check();
  await shot("step4-02-unsaved-rename-and-new-question");
  let done = leadFormsPost();
  await page.click("[data-lf-save]");
  check("Save this form answered 200", (await done).ok());
  await page.waitForTimeout(600);
  // Remove Phone: the warning, with the signed-in name filled in.
  await page.click('[data-lf-remove="phone"]');
  await page.waitForSelector(".lf-dialog[open]");
  const warning = await page.locator(".lf-dialog .send-live-warning").innerText();
  check("the removal warning says texts stop", /TEXTS STOP/.test(warning));
  proof.remove_warning = warning;
  proof.prefilled_name = await page.locator(".lf-dialog [data-lf-name]").inputValue();
  await confirmDialog("step4-03-remove-phone-warning");
  check("Phone shows under 'Removed from this form' with an Undo", await page.locator('[data-lf-restore="phone"]').count() >= 1);
  await shot("step4-04-removed-and-logged");
  // The booking page: one more question for every dog.
  await pick("booking_eval");
  await page.fill("[data-lf-new-label]", "Is your dog good with kids?");
  await page.selectOption("[data-lf-new-type]", "yesno");
  await page.selectOption("[data-lf-new-group]", "dog");
  await page.click("[data-lf-add]");
  done = leadFormsPost();
  await page.click("[data-lf-save]");
  check("booking questions saved", (await done).ok());
  await page.waitForTimeout(600);
  await shot("step4-05-booking-questions");
  // Publish on the practice copy.
  await page.click("[data-lf-publish]");
  await confirmDialog("step4-06-publish-dialog");
  await pick("contact");
  await shot("step4-07-after-publish");
  const pub = await (await fetch(`${base}/api/lead-forms?op=public`)).json();
  check("public API: Contact Us changed, Phone removed, the new question is 'Extra: How old is your dog?'", pub.forms.contact.changed === true && pub.forms.contact.fields.find(f => f.key === "phone").removed === true && pub.forms.contact.fields.some(f => f.name === "Extra: How old is your dog?" && f.required));
  // The real Contact Us page on the practice copy.
  const site = await context.newPage();
  site.on("pageerror", error => errors.push(`contact: ${error}`));
  await site.goto(`${base}/contact`, { waitUntil: "networkidle" });
  await site.waitForSelector('[data-lead-form-applied="contact"] [name="Extra: How old is your dog?"]', { timeout: 20000 });
  const state = await site.evaluate(() => {
    const form = document.querySelector(".contact-intake");
    const phone = [...form.querySelectorAll('[name="phone"]')];
    return {
      action: form.getAttribute("action"),
      phoneVisibleDisabled: phone.filter(el => el.type !== "hidden").map(el => ({ disabled: el.disabled, hidden: el.closest("label").hidden })),
      phoneStandIn: phone.filter(el => el.type === "hidden").map(el => el.value),
      commentsLabel: form.querySelector('[name="comments"]').closest("label").childNodes[0].textContent.trim(),
      extraRequired: form.querySelector('[name="Extra: How old is your dog?"]').required
    };
  });
  proof.contact_page = state;
  check("Contact Us still posts to FormSubmit exactly as before (form action unchanged)", state.action === "https://formsubmit.co/production@lorenzosdogtrainingteam.com");
  check("Contact Us: Phone hidden + disabled, stand-in 'Not given' sent instead", state.phoneVisibleDisabled.every(x => x.disabled && x.hidden) && state.phoneStandIn[0] === "Not given");
  check("Contact Us: 'Comments' renamed", state.commentsLabel === "Tell us about your dog");
  check("Contact Us: the added question is required", state.extraRequired === true);
  await site.locator(".contact-intake").screenshot({ path: join(out, "step4-08-contact-page-edited.png") });
  // Submit one PRACTICE lead (no SMS consent: no text can go out).
  const email = `proof-step4-${Date.now()}@example.com`;
  await site.fill('[name="first_name"]', "Proof");
  await site.fill('[name="last_name"]', "FormEditor");
  await site.fill('[name="address_line_1"]', "1 Test St");
  await site.fill('[name="city"]', "Garfield Heights");
  await site.fill('[name="state"]', "OH");
  await site.fill('[name="zip"]', "44128");
  await site.fill('[name="email"]', email);
  await site.selectOption('[name="i_want_to"]', "Schedule an in person evaluation with a trainer in my area");
  await site.selectOption('[name="heard_about_us"]', { index: 1 });
  await site.fill('[name="comments"]', "Step 4 proof: custom question + removed phone.");
  await site.fill('[name="Extra: How old is your dog?"]', "3 years");
  const saved = site.waitForResponse(r => r.url().includes("/functions/v1/submit-contact"), { timeout: 30000 });
  await site.click('.contact-intake button[type="submit"]');
  const submit = await saved;
  const body = await submit.json().catch(() => ({}));
  proof.test_lead = { email, status: submit.status(), lead_id: body.lead_id || null, practice_header: submit.request().headers()["x-ldtt-practice"] || null };
  check("the edited Contact Us form saved a PRACTICE lead (x-ldtt-practice: 1)", submit.status() === 200 && Boolean(body.lead_id) && proof.test_lead.practice_header === "1");
  await site.waitForTimeout(2500);
  await site.locator(".contact-intake").screenshot({ path: join(out, "step4-09-contact-submitted.png") });
  // The booking page draws the new dog question.
  await site.goto(`${base}/book?zip=44128`, { waitUntil: "networkidle" });
  await site.waitForSelector(".tcard", { timeout: 30000 });
  await site.locator(".tcard").first().click();
  await site.waitForSelector("#stepForm:not([hidden])");
  check("booking page step 2 asks 'Is your dog good with kids?' for Dog 1", await site.locator('#dogs .dog [data-x] option', { hasText: "Yes" }).count() >= 1 && (await site.locator("#dogs").innerText()).includes("Is your dog good with kids?"));
  await site.locator("#stepForm").screenshot({ path: join(out, "step4-10-booking-page-new-question.png") });
  await site.setViewportSize({ width: 390, height: 844 });
  await site.locator("#stepForm").screenshot({ path: join(out, "step4-11-booking-page-phone.png") });
}

if (phase === "lead") {
  await page.goto(`${base}/staff?view=leads&lead=${encodeURIComponent(leadId)}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".lead-detail-panel", { timeout: 30000 });
  const text = await page.locator(".lead-detail-panel").innerText();
  // innerText follows the panel's CSS (small labels are upper-case), so match without case.
  check("lead panel shows 'Extra questions' with the answer", /Extra questions/i.test(text) && /How old is your dog\?/i.test(text) && /3 years/i.test(text));
  await page.locator(".lead-detail-panel").screenshot({ path: join(out, "step4-12-lead-panel-extra-answer.png") });
}

if (phase === "revert") {
  await openEditor();
  await pick("contact");
  const undo = leadFormsPost();
  await page.locator('.lf-removed [data-lf-restore="phone"]').click();
  check("Undo put Phone back (logged)", (await undo).ok());
  await page.waitForTimeout(600);
  await page.click("[data-lf-reset]");
  await confirmDialog("");
  await pick("booking_eval");
  await page.click("[data-lf-reset]");
  await confirmDialog("");
  await page.click("[data-lf-publish]");
  await confirmDialog("");
  const pub = await (await fetch(`${base}/api/lead-forms?op=public`)).json();
  check("after the revert every practice form is the original again (changed:false)", Object.values(pub.forms).every(f => f.changed === false));
  await page.locator(".lf-log").scrollIntoViewIfNeeded();
  await shot("step4-13-change-log-after-revert");
  const site = await context.newPage();
  await site.goto(`${base}/contact`, { waitUntil: "networkidle" });
  await site.waitForTimeout(1500);
  check("Contact Us back to the original (Phone visible, no added question)", await site.evaluate(() => !document.querySelector('[name="Extra: How old is your dog?"]') && !document.querySelector('.contact-intake [name="phone"]').disabled));
}

proof.page_errors = errors;
check("no page errors", errors.length === 0);
writeFileSync(join(out, `step4-proof-${phase}.json`), JSON.stringify(proof, null, 2));
await browser.close();
