// One pipeline for every lead source: the texts (portal chain step 3, Joshua 2026-09-12).
// DO-NOT-BREAK rule 72.
//
//   A new lead from ANY source (Contact Us, Get Started, ad pages, trainer pages, the 2.0 pages)
//   enters the same pipeline: ZIP routing to the trainer who takes online bookings, the Sales tab
//   (raw_payload.sales_pipeline), and - ONLY with SMS consent - the Make pathway 1 text with the
//   booking link. No SMS consent -> no texts at all. No trainer for the ZIP -> no link, office follow-up.
//   A completed booking -> Make pathway 2 (customer confirmation + trainer alert).
//
// PRACTICE COPY (LDTT_SANDBOX=1): every text goes only to a phone that is an ACTIVE row in
// communications_testers (checked here, AND by the text:equal tester filter on every Twilio module in Make);
// the trainer alert goes to the tester phone saved in the settings box, never to a real trainer.
// LIVE (Joshua 2026-09-17, production-correct routing): the client text goes to the lead's phone, the trainer
// alert to the assigned trainer's real phone (trainers.phone), Operations to Settings -> operations_phone.
// See clientPhoneFor / trainerPhoneFor / sendOpsAlert. The live ROUTES (api/pipeline.js, api/booking.js) still
// answer 404 until go-live, and the Make hook envs exist on Vercel Preview only: those are the go-live switches
// (Desktop/LDTT Meeting Changes 2026-09-13/PRODUCTION-READINESS-2026-09-17.md).
//
// JOSHUA'S HARD RULE: FormSubmit is for the current Contact page, Resend is for the sales pipeline.
// Nothing in this file calls FormSubmit or /api/form-delivery. The ONLY email is the office booking email
// (step 3b, rule 73), and it goes ONLY through Resend (lib/office-email.js). With no RESEND_API_KEY it is
// QUEUED on the lead (raw_payload.pipeline.booking_notices[].office_email) and sent once the key is present.
//
// CONTACT US = OPTION C (Joshua 2026-09-12): the Contact Us "I want to..." answer picks the lane
// (CONTACT_US_LANES below). Every other source (ad pages, 2.0 pages, market pages, trainer pages) is an
// evaluation request and always takes the booking lane.
//
// The Make webhook addresses come from env (LDTT_MAKE_HOOK_PATHWAY1 / _PATHWAY2 / _CARE, Vercel Preview only)
// and are never committed.
const { isSandbox } = require("./sandbox");
const B = require("./booking");
const T = require("./pipeline-texts"); // rule 84: the portal's Text messages editor
const M = require("./office-email");

const SETTINGS_KEY = "pipeline_office_emails"; // site_settings key (CHECK ^[a-z_]{1,40}$)
const DEFAULT_RECIPIENTS = [
  { label: "Marketing", email: "marketing@lorenzosdogtrainingteam.com" },
  { label: "Melissa", email: "melissazuk@lorenzosdogtrainingteam.com" },
  { label: "Rachel", email: "rachelleggett@lorenzosdogtrainingteam.com" },
  { label: "Tim", email: "tmillerk999@gmail.com" },
  { label: "Angela", email: "" } // no address yet: the slot stays so the office can type it in
];
const DEFAULT_PRACTICE_TRAINER_PHONE = "+14402142915"; // Joshua, tester. Practice copy only.
// Was Tim (+12168168026, Joshua 2026-09-12). Joshua 2026-09-14: every practice text goes only to him for now.
const DEFAULT_PRACTICE_OPS_PHONE = "+14402142915"; // Joshua, tester. Practice copy only.
// Practice copy only: booking emails go to this ONE test address instead of the office list, the same way
// the trainer alert goes to a tester phone. Clear the box in Settings to send practice emails to the list.
const DEFAULT_PRACTICE_EMAIL_TO = "production@lorenzosdogtrainingteam.com"; // Joshua 2026-09-15: practice booking emails go to production@ (was marketing@).
// Joshua 2026-09-15: "production is not used for team emails ... production get the leads as well so they can log it
// into Alpha, not a part of my every day teams." Production (Alpha intake) is its OWN box, not a team-list line: it gets
// a "New lead" email for every pipeline lead that the website FormSubmit does not already send it (every source except
// Contact Us), plus every booking / request email. Clear the box to stop both.
const DEFAULT_ALPHA_EMAIL = "production@lorenzosdogtrainingteam.com";
const MAX_RECIPIENTS = 12;
const MAX_EMAIL_ATTEMPTS = 5;
const SENDING_STALE_MS = 5 * 60 * 1000; // a "sending" claim older than this was lost: send again (Resend dedupes on the idempotency key)
const WAITING_FOR_KEY = "Office email waiting for the Resend key";

// ---------------------------------------------------------------------------
// Contact Us lanes (Option C). The office could later edit this table: it can also be overridden without a
// deploy by site_settings key "pipeline_lanes" ({lanes:[{answer, lane}]}); unknown lane names are ignored.
//   booking     -> ZIP routing, the Sales tab, and (SMS consent) the Make pathway 1 booking-link text
//   office_call -> (SMS consent) a short customer-care text "the office will call you shortly"; no link;
//                  the lead stays in the office's normal follow-up (not on the Sales tab)
//   recruiting  -> no client text; recruiting follow-up as today
//   office_follow_up -> anything unknown or blank: no text, the office follows up
// ---------------------------------------------------------------------------
const LANES = {
  booking: { label: "Booking (booking-link text + online booking)" },
  office_call: { label: "Phone consultation (customer-care text, office calls)" },
  recruiting: { label: "Recruiting (no client text)" },
  office_follow_up: { label: "Office follow-up (no text)" }
};
const CONTACT_US_LANES = [
  { answer: "Schedule an in person evaluation with a trainer in my area", lane: "booking" },
  { answer: "Schedule a virtual evaluation", lane: "booking" },
  { answer: "Schedule a training session with my dog trainer", lane: "booking" },
  { answer: "Schedule a free phone consultation to receive more information", lane: "office_call" },
  { answer: "Learn more about becoming a dog trainer", lane: "recruiting" }
];
const LANES_KEY = "pipeline_lanes";
// Meeting 2026-09-16: the office number is in the text so people pick up the call.
const CARE_TEXT = first => `Hi ${first}, thanks for contacting Lorenzo's Dog Training Team. Our office will call you shortly from (216) 475-5999. Reply STOP to opt out.`;
const MAX_AGE_MINUTES = 30; // a lead older than this never starts the pipeline from a browser call
const HOOK_TIMEOUT_MS = 6000;
const OFFICE_PHONE = "(866) 436-4959";

const clean = B.clean;
const emailOk = email => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(email);
const now = () => new Date().toISOString();
const last4 = phone => (phone ? phone.slice(-4) : "");

// +1XXXXXXXXXX or "" (US numbers only; anything else is not textable).
function e164(value) {
  const d = B.digits(value);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return "";
}

// ---------------------------------------------------------------------------
// Settings (the portal box): who gets the office booking email + the practice trainer-alert phone
// ---------------------------------------------------------------------------
function normalizeSettings(value = {}) {
  const errors = [];
  const list = Array.isArray(value.recipients) ? value.recipients.slice(0, MAX_RECIPIENTS) : DEFAULT_RECIPIENTS;
  const seen = new Set();
  const recipients = [];
  for (const row of list) {
    const label = clean(row?.label, 40);
    const email = clean(row?.email, 160).toLowerCase();
    if (!label && !email) continue;
    if (email && !emailOk(email)) { errors.push(`"${email}" does not look like an email address.`); continue; }
    if (email && seen.has(email)) continue;
    if (email) seen.add(email);
    recipients.push({ label, email });
  }
  const phoneText = clean(value.practice_trainer_phone, 40);
  const practicePhone = phoneText ? e164(phoneText) : "";
  if (phoneText && !practicePhone) errors.push("The trainer-alert tester phone needs 10 digits.");
  // Joshua 2026-09-16: the client test phone = the number typed on a landing/contact form during a test. Saved here
  // and registered as an active tester with the other two, so a test lead's texts are never skipped.
  const clientText = clean(value.practice_client_phone, 40);
  const clientPhone = clientText ? e164(clientText) : "";
  if (clientText && !clientPhone) errors.push("The client test phone needs 10 digits.");
  const opsText = value.practice_operations_phone === undefined ? DEFAULT_PRACTICE_OPS_PHONE : clean(value.practice_operations_phone, 40);
  const opsPhone = opsText ? e164(opsText) : "";
  if (opsText && !opsPhone) errors.push("The Operations tester phone needs 10 digits.");
  // Joshua 2026-09-17: on LIVE the Operations texts go to Lorenzo's phone, saved here (default empty = skipped).
  const liveOpsText = clean(value.operations_phone, 40);
  const liveOpsPhone = liveOpsText ? e164(liveOpsText) : "";
  if (liveOpsText && !liveOpsPhone) errors.push("The Operations phone on live needs 10 digits.");
  // A row saved before step 3b has no practice_email_to: it keeps the test address (never the office list by surprise).
  const practiceEmail = value.practice_email_to === undefined ? DEFAULT_PRACTICE_EMAIL_TO : clean(value.practice_email_to, 160).toLowerCase();
  if (practiceEmail && !emailOk(practiceEmail)) errors.push(`"${practiceEmail}" does not look like an email address.`);
  // A row saved before the Alpha intake box existed gets production@ (never silently no-one).
  const alphaEmail = value.alpha_email === undefined ? DEFAULT_ALPHA_EMAIL : clean(value.alpha_email, 160).toLowerCase();
  if (alphaEmail && !emailOk(alphaEmail)) errors.push(`"${alphaEmail}" does not look like an email address.`);
  return { errors, value: { recipients, alpha_email: emailOk(alphaEmail) ? alphaEmail : "", practice_trainer_phone: practicePhone, practice_operations_phone: opsPhone, operations_phone: liveOpsPhone, practice_client_phone: clientPhone, practice_email_to: emailOk(practiceEmail) ? practiceEmail : "" } };
}

function defaultSettings() {
  return { recipients: DEFAULT_RECIPIENTS.map(r => ({ ...r })), alpha_email: DEFAULT_ALPHA_EMAIL, practice_trainer_phone: DEFAULT_PRACTICE_TRAINER_PHONE, practice_operations_phone: DEFAULT_PRACTICE_OPS_PHONE, operations_phone: "", practice_email_to: DEFAULT_PRACTICE_EMAIL_TO, saved: false };
}

// Who actually gets an office email. A new lead: Production (Alpha intake) only. A booking or request: the team list
// plus Production. Practice copy: the one test address when one is saved.
function emailRecipients(settings, practice = isSandbox(), kind = "") {
  const alpha = settings?.alpha_email ? [settings.alpha_email] : [];
  const list = kind === "new_lead" ? alpha : [...new Set([...officeEmails(settings), ...alpha])];
  if (practice && settings?.practice_email_to) return { to: list.length ? [settings.practice_email_to] : [], redirectedFrom: list };
  return { to: list, redirectedFrom: [] };
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------
const norm = value => clean(value, 200).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");

function normalizeLanes(value) {
  const list = Array.isArray(value?.lanes) ? value.lanes : null;
  if (!list) return CONTACT_US_LANES.map(r => ({ ...r }));
  const out = list.map(r => ({ answer: clean(r?.answer, 200), lane: clean(r?.lane, 40) })).filter(r => r.answer && LANES[r.lane]);
  return out.length ? out : CONTACT_US_LANES.map(r => ({ ...r }));
}

async function loadLanes() {
  try {
    const rows = await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${LANES_KEY}&select=value&limit=1`);
    return normalizeLanes(rows?.[0]?.value);
  } catch {
    return normalizeLanes(null);
  }
}

// The Contact Us page: contact.html, or the Site Builder page that takes over /contact.
function isContactUsLead(lead) {
  const raw = rawOf(lead);
  const pages = [raw.source_page, lead?.source_page].map(v => norm(v).replace(/^\/+/, ""));
  if (pages.some(p => p === "contact.html" || p === "contact")) return true;
  try {
    const path = new URL(String(raw.page_url || "")).pathname.toLowerCase().replace(/\/+$/, "");
    return ["/contact", "/contact.html", "/p/contact"].includes(path);
  } catch {
    return false;
  }
}

// Where the lead came from, in the office's words (meeting 2026-09-16: a 2.0 ad page must never read "website").
// "Ad page 2.0: Pensacola, FL" (source_page ads-v2/pensacola, ldtt-ads-v2/<market> or the 2.0 page URL),
// "Ad page: Cleveland / Akron, OH" (the old dog-training-<market> pages), "Trainer page: <name>", "Website: <page>".
const AD_MARKETS = require("./ad-page-markets").markets || [];
function marketWords(slug) {
  const key = clean(slug, 80).toLowerCase().replace(/\.html?$/, "").replace(/^\/+|\/+$/g, "");
  const hit = AD_MARKETS.find(m => m.slug === key || m.slug === `dog-training-${key}` || new RegExp(`^dog-training-${key}-[a-z]{2}$`).test(m.slug));
  if (hit) return hit.market || hit.city || key;
  const parts = key.replace(/^dog-training-/, "").split("-").filter(Boolean);
  if (!parts.length) return "";
  const state = parts.length > 1 && /^[a-z]{2}$/.test(parts[parts.length - 1]) ? parts.pop().toUpperCase() : "";
  const city = parts.map(p => p[0].toUpperCase() + p.slice(1)).join(" ");
  return state ? `${city}, ${state}` : city;
}
function sourceWords(lead, via, pageTrainer) {
  const raw = rawOf(lead);
  let page = clean(raw.source_page || lead?.source_page || "", 200);
  try {
    const url = new URL(page);
    page = /ads-v2/i.test(url.hostname) ? `ads-v2${url.pathname}` : (url.pathname.replace(/^\/+/, "") || url.hostname);
  } catch { /* not a URL */ }
  page = page.replace(/^\/+|\/+$/g, "");
  const v2 = page.match(/^(?:ldtt-)?ads-v2(?:\/(.+))?$/i);
  if (v2) {
    const market = marketWords(v2[1] || "");
    return market ? `Ad page 2.0: ${market}` : "Ad page 2.0";
  }
  if (/^dog-training-[a-z0-9-]+(?:\.html?)?$/i.test(page)) return `Ad page: ${marketWords(page)}`;
  const trainerSlug = clean(lead?.trainer_slug, 80);
  if (trainerSlug || /^trainer landing page/i.test(page)) {
    const fromPage = /^trainer landing page:\s*\S/i.test(page) ? page.replace(/^trainer landing page:\s*/i, "") : "";
    const name = clean(pageTrainer?.full_name || lead?.assigned_trainer_name || fromPage || marketWords(trainerSlug), 80);
    return name ? `Trainer page: ${name}` : "Trainer page";
  }
  if (isContactUsLead(lead)) return "Website: Contact Us";
  return `Website: ${clean(page || via || "form", 60)}`;
}

function decideLane(lead, table = CONTACT_US_LANES) {
  if (!isContactUsLead(lead)) return { key: "booking", label: LANES.booking.label, source: "evaluation request (not Contact Us)", answer: "" };
  const answer = clean(rawOf(lead).i_want_to || lead?.service_interest, 200);
  const hit = table.find(r => norm(r.answer) === norm(answer));
  const key = hit ? hit.lane : "office_follow_up";
  return { key, label: LANES[key].label, source: "Contact Us", answer };
}

async function loadSettings() {
  try {
    const rows = await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${SETTINGS_KEY}&select=value,updated_by,updated_at&limit=1`);
    const row = rows?.[0];
    if (!row?.value) return defaultSettings();
    const { value } = normalizeSettings(row.value);
    return { ...value, saved: true, updated_by: row.updated_by || "", updated_at: row.updated_at || "" };
  } catch {
    return defaultSettings();
  }
}

async function saveSettings(input, actorLabel) {
  const { errors, value } = normalizeSettings(input);
  if (errors.length) return { ok: false, errors };
  const rows = await B.sbOrThrow("/rest/v1/site_settings?on_conflict=key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: { key: SETTINGS_KEY, value, updated_by: clean(actorLabel, 200) || null, updated_at: now() }
  });
  const row = rows?.[0] || {};
  await registerRolePhonesAsTesters(value, actorLabel).catch(error => console.error("tester_register_failed", String(error?.message || error)));
  return { ok: true, settings: { ...value, saved: true, updated_by: row.updated_by || "", updated_at: row.updated_at || "" } };
}

// Every role phone saved above becomes an ACTIVE tester (communications_testers), so the sandbox texts to that
// role are never skipped as "not a tester phone" (Joshua 2026-09-16: "I changed the number and got an error").
async function registerRolePhonesAsTesters(value, actorLabel) {
  if (!isSandbox()) return;
  const wanted = [["trainer", value.practice_trainer_phone], ["operations", value.practice_operations_phone], ["client", value.practice_client_phone]].filter(([, p]) => p);
  if (!wanted.length) return;
  const rows = await B.sbOrThrow("/rest/v1/communications_testers?select=id,phone,active");
  const byPhone = new Map((Array.isArray(rows) ? rows : []).map(r => [e164(r.phone), r]));
  for (const [role, phone] of wanted) {
    const existing = byPhone.get(phone);
    if (existing && existing.active) continue;
    if (existing) {
      await B.sbOrThrow(`/rest/v1/communications_testers?id=eq.${encodeURIComponent(existing.id)}`, { method: "PATCH", prefer: "return=minimal", body: { active: true } });
    } else {
      await B.sbOrThrow("/rest/v1/communications_testers", { method: "POST", prefer: "return=minimal", body: { display_name: `Test ${role} phone (pipeline settings)`, phone, active: true } });
      byPhone.set(phone, { phone, active: true });
    }
  }
}

const officeEmails = settings => (settings?.recipients || []).map(r => r.email).filter(Boolean);

// ---------------------------------------------------------------------------
// Tester guard + Make webhooks
// ---------------------------------------------------------------------------
// Text lock (rule 82). 2026-09-14 morning, Joshua: "for now send only to me 4402142915". 2026-09-14 afternoon, Joshua
// (presentation): "test the full message flow from landing page 2.0, me, Tim and Angela all different roles, and
// change or add numbers in the portal". So the one-phone lock is OFF: a practice text goes to a phone only when it is
// an ACTIVE tester (portal: Communications -> Testers) AND passes the Make tester filters. Roles: Client = the phone
// typed on the form; Trainer + Operations = Settings -> "Booking emails to the office" phone boxes.
// To lock every text to one phone again: PRACTICE_TEXT_ONLY_TO = ["+1..."].
const PRACTICE_TEXT_ONLY_TO = null;
const SEND_TEST_PHONE = "+14402142915"; // the Text messages editor's Send test stays with Joshua (rule 84)

async function activeTesterPhones() {
  try {
    const rows = await B.sbOrThrow("/rest/v1/communications_testers?active=eq.true&select=phone");
    const testers = (rows || []).map(r => e164(r.phone)).filter(Boolean);
    return new Set(PRACTICE_TEXT_ONLY_TO ? testers.filter(phone => PRACTICE_TEXT_ONLY_TO.includes(phone)) : testers);
  } catch {
    return new Set(); // fail closed: no tester list, no texts
  }
}

function hookUrl(pathway) {
  const url = String(process.env[`LDTT_MAKE_HOOK_PATHWAY${pathway}`] || "").trim();
  return /^https:\/\/hook\.[a-z0-9.-]+\.make\.com\/[A-Za-z0-9]+$/.test(url) ? url : "";
}

// ---------------------------------------------------------------------------
// WHO gets each text (Joshua 2026-09-17: the texting system must be production-correct).
//   Practice copy (LDTT_SANDBOX=1): every phone must be an ACTIVE tester; the trainer alert goes to the tester phone
//   in Settings (practice_trainer_phone), Operations to practice_operations_phone. Unchanged.
//   Live: the client text goes to the lead's own phone, the trainer alert to the assigned trainer's real phone
//   (public.trainers.phone), Operations to Settings -> operations_phone (Lorenzo). No tester list on live.
// The tester list is only read on the practice copy, so a live send never depends on communications_testers.
// ---------------------------------------------------------------------------
const NO_TRAINER_PHONE = "trainer has no phone on file";

// The client's phone: { ok, phone, reason }. `testers` is a Set on the practice copy, ignored on live.
function clientPhoneFor(phoneValue, testers) {
  const phone = e164(phoneValue);
  if (!phone) return { ok: false, phone: "", reason: "No textable phone number." };
  if (isSandbox() && !(testers && testers.has(phone))) return { ok: false, phone, reason: `Practice copy: ...${last4(phone)} is not an active tester phone.` };
  return { ok: true, phone, reason: "" };
}

// The trainer alert's phone: { ok, phone, reason }. ONE rule for sendBookingTexts, sendPreEvalTexts and
// sendEvalCompletedTexts. Practice copy: the tester phone saved in Settings (never the real trainer), which must be an
// active tester. Live: the assigned trainer's phone from the trainers table (e164), or skipped with NO_TRAINER_PHONE.
function trainerPhoneFor(lead, trainer, settings, testers = null) {
  if (isSandbox()) {
    const saved = e164(settings?.practice_trainer_phone || "");
    const phone = PRACTICE_TEXT_ONLY_TO && saved && !PRACTICE_TEXT_ONLY_TO.includes(saved) ? PRACTICE_TEXT_ONLY_TO[0] : saved;
    if (!phone) return { ok: false, phone: "", reason: "Trainer alert: no tester phone saved in the settings box." };
    if (testers && !testers.has(phone)) return { ok: false, phone, reason: `Trainer alert: ...${last4(phone)} is not an active tester phone.` };
    return { ok: true, phone, reason: "" };
  }
  const phone = e164(trainer?.phone || "");
  if (!phone) {
    const who = clean(trainer?.full_name || lead?.assigned_trainer_name || "", 80);
    return { ok: false, phone: "", reason: `Trainer alert: ${NO_TRAINER_PHONE}${who ? ` (${who})` : ""}.` };
  }
  return { ok: true, phone, reason: "" };
}

const TRAINER_PHONE_SELECT = "id,slug,full_name,phone";

// The trainer row the alert goes to: leads.trainer_id first, then the slug on the lead / its booking / its pipeline
// record. Returns null when nothing matches (the caller then skips with NO_TRAINER_PHONE).
async function trainerForLead(lead) {
  const id = clean(lead?.trainer_id, 80);
  const raw = rawOf(lead);
  const slug = clean(lead?.trainer_slug || raw.booking?.trainer_slug || raw.pipeline?.trainer_slug, 80).toLowerCase();
  const query = id ? `id=eq.${encodeURIComponent(id)}` : slug ? `slug=eq.${encodeURIComponent(slug)}` : "";
  if (!query) return null;
  const rows = await B.sbOrThrow(`/rest/v1/trainers?${query}&select=${TRAINER_PHONE_SELECT}&limit=1`);
  return rows?.[0] || null;
}

// A trainer row that already carries its phone is used as is; otherwise (booking.js's trainer list has no phone
// column) the row is loaded again by id / slug. Only needed on live: the practice copy never uses the real phone.
async function trainerWithPhone(lead, trainer) {
  if (isSandbox()) return trainer || null;
  if (trainer && trainer.phone !== undefined) return trainer;
  const loaded = await trainerForLead({ ...(lead || {}), trainer_id: trainer?.id || lead?.trainer_id, trainer_slug: trainer?.slug || lead?.trainer_slug }).catch(() => null);
  return loaded || trainer || null;
}

// Operations alert (Joshua 2026-09-12): Operations (Tim) gets a text when a lead starts its journey and
// when an evaluation is booked. Practice copy only, tester phones only, its own Make scenario (6254549,
// tester filter on every route). The address comes from env LDTT_MAKE_HOOK_OPS (Vercel Preview only).
function opsHookUrl() {
  const url = String(process.env.LDTT_MAKE_HOOK_OPS || "").trim();
  return /^https:\/\/hook\.[a-z0-9.-]+\.make\.com\/[A-Za-z0-9]+$/.test(url) ? url : "";
}

async function sendOpsAlert(stage, fields = {}) {
  const base = { stage, at: now() };
  const settings = await loadSettings().catch(() => null);
  let phone = "";
  if (isSandbox()) {
    const saved = e164(settings?.practice_operations_phone ?? DEFAULT_PRACTICE_OPS_PHONE);
    // The text lock wins over a saved phone (a row saved on 2026-09-12 still names Tim).
    phone = PRACTICE_TEXT_ONLY_TO && !PRACTICE_TEXT_ONLY_TO.includes(saved) ? PRACTICE_TEXT_ONLY_TO[0] : saved;
    if (!phone) return { ...base, status: "skipped", reason: "No Operations phone saved in Settings." };
    const testers = await activeTesterPhones();
    if (!testers.has(phone)) return { ...base, status: "skipped", reason: `Operations: ...${last4(phone)} is not an active tester phone.` };
  } else {
    // Live (Joshua 2026-09-17): Lorenzo's phone from Settings -> "Operations phone on live". Empty = no text, said plainly.
    phone = e164(settings?.operations_phone || "");
    if (!phone) return { ...base, status: "skipped", reason: "No Operations phone on live is saved in Settings (operations_phone): no Operations text." };
  }
  const url = opsHookUrl();
  if (!url) return { ...base, status: "skipped", reason: "The Operations Make address is not set on this deployment." };
  const result = await postHook(url, { stage, operations_phone: phone, practice: isSandbox(), ...fields });
  return result.ok ? { ...base, status: "sent", to: `...${last4(phone)}` } : { ...base, status: "failed", reason: `Make answered ${result.status}: ${result.answer}` };
}

// Rule 84: the finished words from the portal's Text messages editor ride along with every Make send. Make
// uses them only after its Twilio steps are switched to them (each keeps today's words as the fallback). If the
// editor cannot be read, the starting words (= Make's own wording) are used, so a send never fails on it.
async function withTextMessages(payload) {
  let state = null;
  try { state = (await T.load(B.sbOrThrow)).state; } catch { state = null; }
  // Words that fail the checks (too long, unknown field, only {fields}) are never sent: the starting words go instead.
  const words = key => { const saved = T.wordsFor(state, key); return T.check(key, saved).error ? T.wordsFor(null, key) : saved; };
  if (payload.pathway === "new_lead") return { ...payload, message: T.render(words("booking_link"), payload) };
  // Joshua 2026-09-16: the "Has not booked yet" follow-ups are an office button, not a timer (sendFollowUpText).
  if (payload.pathway === "followup") return { ...payload, message: T.render(words(payload.followup_key === "link" ? "followup_link" : "followup_first"), payload) };
  if (payload.pathway === "booking_confirmed") {
    return { ...payload, customer_message: T.render(words("booking_confirmation"), { ...payload, dog_name: payload.dog_name || "your dog" }), trainer_message: T.render(words("trainer_new_eval"), payload) };
  }
  if (payload.stage === "new_lead") return { ...payload, message: T.render(words("ops_new_lead"), payload) };
  if (payload.stage === "eval_booked") return { ...payload, message: T.render(words("ops_eval_booked"), payload) };
  if (payload.pathway === "customer_care") return { ...payload, message: T.render(words("care_call"), payload) };
  // Joshua 2026-09-15: the trainer's "eval questions completed" text (customer_phone stays empty on purpose,
  // so pathway 2's Make filter sends only the trainer branch).
  if (payload.pathway === "pre_eval_answered") return { ...payload, trainer_message: T.render(words("pre_eval_answers"), payload), customer_message: "" };
  if (payload.pathway === "eval_completed") return { ...payload, trainer_message: T.render(words("trainer_log_deal"), payload), customer_message: "" };
  // Joshua 2026-09-17: the trainer's "new inquiry" text (pathway 2, trainer branch only).
  if (payload.pathway === "new_inquiry") return { ...payload, trainer_message: T.render(words("trainer_new_inquiry"), payload), customer_message: "" };
  return payload;
}

async function postHook(url, rawPayload) {
  const payload = await withTextMessages(rawPayload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOOK_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
    const text = (await response.text()).slice(0, 120);
    return { ok: response.ok, status: response.status, answer: text };
  } catch (error) {
    return { ok: false, status: 0, answer: String(error?.name === "AbortError" ? "timed out" : error?.message || error).slice(0, 120) };
  } finally {
    clearTimeout(timer);
  }
}

// Plain words for "what the customer asked about", short enough for a text.
function problemWords(lead) {
  const raw = lead?.raw_payload || {};
  const candidates = [raw.problem, raw.booking?.dogs?.[0]?.behavior, raw.description, lead?.comments, raw.comments, lead?.service_interest];
  for (const c of candidates) {
    const text = clean(String(c ?? "").replace(/\n+\s*Additional interest:[\s\S]*$/i, ""), 400);
    if (text && !/^additional interest:/i.test(text)) return text.length > 90 ? `${text.slice(0, 87).trim()}...` : text;
  }
  return "your dog";
}

// Pathway 1: may this lead get the booking-link text? Decided BEFORE anything is sent or claimed.
function newLeadTextPlan({ lead, bookUrl, testers, routeNote }) {
  if (lead?.sms_consent !== true) return { send: false, reason: "No SMS consent: no texts." };
  if (!bookUrl) return { send: false, reason: routeNote || "No trainer serves this ZIP yet: office follow-up, no text." };
  const client = clientPhoneFor(lead.phone, testers);
  if (!client.ok) return { send: false, reason: client.reason };
  if (!hookUrl(1)) return { send: false, reason: "The Make pathway 1 address is not set on this deployment." };
  return { send: true, phone: client.phone };
}

async function sendNewLeadText({ lead, trainer, bookUrl, phone }) {
  const result = await postHook(hookUrl(1), {
    pathway: "new_lead",
    lead_id: lead.id,
    phone,
    first_name: clean(lead.first_name, 80) || "there",
    last_name: clean(lead.last_name, 80),
    problem: problemWords(lead),
    booking_link: bookUrl,
    trainer_name: trainer?.full_name || "",
    trainer_first_name: String(trainer?.full_name || "").split(" ")[0] || "",
    zip: clean(lead.zip, 10),
    practice: isSandbox()
  });
  return { pathway: 1, at: now(), status: result.ok ? "sent" : "failed", to_last4: last4(phone), make_status: result.status, make_answer: result.answer };
}

// Joshua 2026-09-16: the "Has not booked yet" follow-up texts are sent by an OFFICE BUTTON on the lead's detailed
// view (Sales Pipeline), not by a timer. step "tim" = Tim's first text (followup_first); step "link" = the booking
// link again (followup_link). Practice copy only, ACTIVE tester phones only (rules 72/73), pathway 1 hook.
async function sendFollowUpText({ lead, step }) {
  // step "care" = the customer-care text "Office will call you" (care_call), also an office button (Joshua 2026-09-16).
  const key = step === "link" ? "link" : step === "care" ? "care" : "tim";
  const base = { pathway: 1, step: key, at: now() };
  if (lead?.sms_consent !== true) return { ...base, status: "skipped", reason: "No SMS consent: no texts." };
  const client = clientPhoneFor(lead?.phone, isSandbox() ? await activeTesterPhones() : null);
  if (!client.ok) return { ...base, status: "skipped", reason: client.reason };
  const phone = client.phone;
  const pipeline = rawOf(lead).pipeline && typeof rawOf(lead).pipeline === "object" ? rawOf(lead).pipeline : {};
  const bookUrl = String(pipeline.book_url || (pipeline.trainer_slug ? B.bookUrl(pipeline.trainer_slug, lead.id) : "") || "");
  if (key === "link" && !bookUrl) return { ...base, status: "skipped", reason: "No booking link for this lead yet: nothing to send again." };
  if (!hookUrl(1)) return { ...base, status: "skipped", reason: "The Make pathway 1 address is not set on this deployment." };
  const result = await postHook(hookUrl(1), {
    pathway: key === "care" ? "customer_care" : "followup",
    followup_key: key,
    lead_id: lead.id,
    phone,
    customer_phone: phone,
    first_name: clean(lead.first_name, 80) || "there",
    booking_link: bookUrl,
    practice: isSandbox()
  });
  return { ...base, status: result.ok ? "sent" : "failed", to_last4: last4(phone), make_status: result.status, make_answer: result.answer, ...(result.ok ? {} : { reason: `Make answered ${result.status}: ${result.answer}` }) };
}

async function afterFollowUp({ lead, step, by }) {
  const texts = await sendFollowUpText({ lead, step });
  const entry = { step: texts.step, at: texts.at, status: texts.status, by: clean(by, 120) || "", ...(texts.to_last4 ? { to_last4: texts.to_last4 } : {}), ...(texts.reason ? { reason: texts.reason } : {}) };
  await mergePipelineRecord(lead.id, p => ({ ...p, followups: [...(Array.isArray(p.followups) ? p.followups : []), entry].slice(-20) }))
    .catch(error => console.error("pipeline_followup_record_failed", String(error?.message || error)));
  return texts;
}

// Lane office_call: the short customer-care text. It needs its OWN Make route: pathway 1's scenario has one
// Twilio module with the booking-link wording and no pathway filter, so this text must never be posted to
// that hook. Until LDTT_MAKE_HOOK_CARE is set (a Make route Joshua approves), it is recorded as not sent.
function careHookUrl() {
  const url = String(process.env.LDTT_MAKE_HOOK_CARE || "").trim();
  return /^https:\/\/hook\.[a-z0-9.-]+\.make\.com\/[A-Za-z0-9]+$/.test(url) && url !== hookUrl(1) ? url : "";
}

function careTextPlan({ lead, testers }) {
  if (lead?.sms_consent !== true) return { send: false, reason: "No SMS consent: no texts." };
  const client = clientPhoneFor(lead.phone, testers);
  if (!client.ok) return { send: false, reason: client.reason };
  if (!careHookUrl()) return { send: false, reason: "The customer-care text has no Make route yet (LDTT_MAKE_HOOK_CARE is not set): not sent." };
  return { send: true, phone: client.phone };
}

async function sendCareText({ lead, phone }) {
  const first = clean(lead.first_name, 80) || "there";
  const result = await postHook(careHookUrl(), { pathway: "customer_care", lead_id: lead.id, phone, first_name: first, message: CARE_TEXT(first), practice: isSandbox() });
  return { kind: "customer_care", at: now(), status: result.ok ? "sent" : "failed", to_last4: last4(phone), make_status: result.status, make_answer: result.answer };
}

function slotParts(iso, timeZone) {
  const date = new Date(iso);
  const opts = { timeZone };
  return {
    day: date.toLocaleDateString("en-US", { ...opts, weekday: "long" }),
    date: date.toLocaleDateString("en-US", { ...opts, month: "long", day: "numeric", year: "numeric" }), // Joshua 2026-09-17: "September 17, 2026"
    time: date.toLocaleTimeString("en-US", { ...opts, hour: "numeric", minute: "2-digit", timeZoneName: "short" })
  };
}

const SAFETY_WORDS = /\b(bit|bite|bites|biting|bitten|aggress\w*|attack\w*|lunge\w*|snap\w*|growl\w*)\b/i;

function staffLeadLink(leadId) {
  return `${B.practiceOrigin()}/staff?view=leads&lead=${encodeURIComponent(leadId)}`;
}

// Pathway 2: customer confirmation + trainer alert in ONE Make run; the Make filters drop whichever
// phone is empty (practice copy: or not a tester). Who gets which phone: clientPhoneFor / trainerPhoneFor above.
async function sendBookingTexts({ lead, booking, trainer, setting, settings }) {
  const base = { pathway: 2, at: now() };
  const testers = isSandbox() ? await activeTesterPhones() : null;
  const customerPick = lead?.sms_consent === true ? clientPhoneFor(booking?.client?.phone || lead?.phone, testers) : { ok: false, phone: "", reason: "" };
  const trainerRow = await trainerWithPhone(lead, trainer);
  const trainerPick = trainerPhoneFor(lead, trainerRow, settings, testers);
  const customer = customerPick.phone;
  const trainerPhone = trainerPick.phone;
  const customerOk = customerPick.ok;
  const trainerOk = trainerPick.ok;
  const notes = [];
  if (lead?.sms_consent !== true) notes.push("Customer: no SMS consent, no customer text.");
  else if (!customerOk) notes.push(customer ? `Customer: ...${last4(customer)} is not an active tester phone.` : "Customer: no textable phone.");
  if (!trainerOk) notes.push(trainerPick.reason);
  if (!customerOk && !trainerOk) return { ...base, status: "skipped", reason: notes.join(" ") };
  const url = hookUrl(2);
  if (!url) return { ...base, status: "skipped", reason: "The Make pathway 2 address is not set on this deployment." };
  const tz = booking?.local_time_zone || booking?.time_zone || setting?.time_zone || "America/New_York"; // rule 86
  const parts = slotParts(booking.slot_start, tz);
  const dogs = Array.isArray(booking?.dogs) ? booking.dogs : [];
  const client = booking?.client || {};
  const behaviors = dogs.map(d => d.behavior).filter(Boolean).join(" / ");
  const result = await postHook(url, {
    pathway: "booking_confirmed",
    lead_id: lead.id,
    first_name: clean(client.first_name || lead.first_name, 80),
    last_name: clean(client.last_name || lead.last_name, 80),
    client_name: [client.first_name || lead.first_name, client.last_name || lead.last_name].filter(Boolean).join(" "),
    customer_phone: customerOk ? customer : "",
    trainer_phone: trainerOk ? trainerPhone : "",
    trainer_name: trainer?.full_name || booking?.trainer_name || "",
    trainer_first_name: String(trainer?.full_name || booking?.trainer_name || "").split(" ")[0],
    appointment_day: parts.day,
    appointment_date: parts.date,
    appointment_time: parts.time,
    service_address: booking?.location === "training_center" ? (setting?.training_center_address || B.TRAINING_CENTER_ADDRESS) : clean(client.address, 300),
    dog_name: dogs.map(d => d.name).filter(Boolean).join(", "),
    problem: behaviors ? (behaviors.length > 120 ? `${behaviors.slice(0, 117).trim()}...` : behaviors) : problemWords(lead),
    safety_flag: SAFETY_WORDS.test(behaviors) ? "SAFETY: bite/aggression mentioned in the answers. Read them before the visit." : "",
    // Rule 81: the confirmation text's "complete these quick questions" link opens the pre-evaluation
    // questions (it used to reopen the congratulations screen). Same payload key, so Make is unchanged.
    pre_eval_link: `${B.bookUrl(booking.trainer_slug, lead.id)}&step=questions`,
    trainer_portal_link: staffLeadLink(lead.id),
    link: staffLeadLink(lead.id),
    practice: isSandbox()
  });
  return {
    ...base,
    status: result.ok ? "sent" : "failed",
    customer_last4: customerOk ? last4(customer) : "",
    trainer_last4: trainerOk ? last4(trainerPhone) : "",
    notes: notes.join(" "),
    make_status: result.status,
    make_answer: result.answer
  };
}

// Joshua 2026-09-15: "the trainer never gets the text response of the eval questions filled out ... they need to
// see it and then prompt them to log in to the portal to view more details about this lead." When the client
// submits the pre-evaluation answers (rule 81), the trainer gets ONE text through the pathway 2 hook.
// The words come from the "pre_eval_answers" text in the portal's Text messages editor (rule 84).

// A short, readable slice of the answers for the text; the portal has the rest.
function answersSummary(rows = []) {
  const lines = [];
  let used = 0;
  for (const [label, value] of rows) {
    const question = String(label || "").replace(/\{dog\}/g, "your dog").replace(/\s+/g, " ").trim();
    const line = `• ${question} ${String(value || "").trim()}`.slice(0, 130);
    if (lines.length >= 6 || used + line.length > 430) {
      lines.push(`…plus ${rows.length - lines.length} more answers in the portal.`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

async function sendPreEvalTexts({ lead }) {
  const base = { kind: "pre_eval_answers", at: now() };
  const settings = await loadSettings().catch(() => null);
  const trainerPick = trainerPhoneFor(lead, await trainerWithPhone(lead, null), settings, isSandbox() ? await activeTesterPhones() : null);
  if (!trainerPick.ok) return { ...base, status: "skipped", reason: trainerPick.reason };
  const trainerPhone = trainerPick.phone;
  const url = hookUrl(2);
  if (!url) return { ...base, status: "skipped", reason: "The Make pathway 2 address is not set on this deployment." };
  const raw = lead?.raw_payload && typeof lead.raw_payload === "object" ? lead.raw_payload : {};
  const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
  const pre = booking.pre_eval && typeof booking.pre_eval === "object" ? booking.pre_eval : {};
  const client = booking.client || {};
  let parts = { day: "", date: "", time: "" };
  try { if (booking.slot_start) parts = slotParts(booking.slot_start, booking.local_time_zone || booking.time_zone || "America/New_York"); } catch { /* keep blanks */ }
  const flags = Array.isArray(pre.flags) ? pre.flags : [];
  const result = await postHook(url, {
    pathway: "pre_eval_answered",
    lead_id: lead.id,
    customer_phone: "", // the Make filter drops the customer branch; this text is for the trainer only
    trainer_phone: trainerPhone,
    first_name: clean(client.first_name || lead.first_name, 80),
    last_name: clean(client.last_name || lead.last_name, 80),
    appointment_day: parts.day,
    appointment_date: parts.date,
    appointment_time: parts.time,
    service_address: booking.location === "training_center" ? B.TRAINING_CENTER_ADDRESS : clean(client.address || lead.address_line_1 || lead.raw_payload?.address || lead.address, 300),
    safety_flag: flags.length ? `⚠️ SAFETY: ${flags.join("; ")}. Read the full answers before the visit.` : "",
    answers_summary: answersSummary(Array.isArray(pre.rows) ? pre.rows : []),
    trainer_portal_link: staffLeadLink(lead.id),
    practice: isSandbox()
  });
  return { ...base, status: result.ok ? "sent" : "failed", trainer_last4: last4(trainerPhone), make_status: result.status, make_answer: result.answer };
}

// Joshua 2026-09-16: when the trainer marks Eval completed, the trainer gets "log the deal in the portal" (Make
// pathway 2, trainer branch only, tester phones only on the practice copy — same doors as sendPreEvalTexts).
async function sendEvalCompletedTexts({ lead }) {
  const base = { kind: "trainer_log_deal", at: now() };
  const settings = await loadSettings().catch(() => null);
  const trainerPick = trainerPhoneFor(lead, await trainerWithPhone(lead, null), settings, isSandbox() ? await activeTesterPhones() : null);
  if (!trainerPick.ok) return { ...base, status: "skipped", reason: trainerPick.reason };
  const trainerPhone = trainerPick.phone;
  const url = hookUrl(2);
  if (!url) return { ...base, status: "skipped", reason: "The Make pathway 2 address is not set on this deployment." };
  const raw = lead?.raw_payload && typeof lead.raw_payload === "object" ? lead.raw_payload : {};
  const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
  const client = booking.client || {};
  const result = await postHook(url, {
    pathway: "eval_completed",
    lead_id: lead.id,
    customer_phone: "", // trainer only
    trainer_phone: trainerPhone,
    first_name: clean(client.first_name || lead.first_name, 80),
    last_name: clean(client.last_name || lead.last_name, 80),
    dog_name: clean(client.dog_name || lead.dog_name || raw.dog_name, 80),
    trainer_portal_link: staffLeadLink(lead.id),
    practice: isSandbox()
  });
  return { ...base, status: result.ok ? "sent" : "failed", trainer_last4: last4(trainerPhone), make_status: result.status, make_answer: result.answer };
}

// Joshua 2026-09-17: the trainer gets a text at the NEW INQUIRY stage, when a lead is routed to their calendar
// (enterPipeline, right after the Operations new-lead alert). Pathway 2 hook, trainer branch only (customer_phone
// stays empty); the phone comes from trainerPhoneFor (practice copy = tester phone, live = trainer.phone).
async function sendNewInquiryText({ lead, trainer, bookUrl }) {
  const base = { kind: "trainer_new_inquiry", at: now() };
  if (!bookUrl || !trainer) return { ...base, status: "skipped", reason: "No calendar trainer for this lead: no trainer text." };
  const settings = await loadSettings().catch(() => null);
  const trainerPick = trainerPhoneFor(lead, await trainerWithPhone(lead, trainer), settings, isSandbox() ? await activeTesterPhones() : null);
  if (!trainerPick.ok) return { ...base, status: "skipped", reason: trainerPick.reason };
  const trainerPhone = trainerPick.phone;
  const url = hookUrl(2);
  if (!url) return { ...base, status: "skipped", reason: "The Make pathway 2 address is not set on this deployment." };
  const result = await postHook(url, {
    pathway: "new_inquiry",
    lead_id: lead.id,
    customer_phone: "", // trainer only
    trainer_phone: trainerPhone,
    first_name: clean(lead.first_name, 80),
    last_name: clean(lead.last_name, 80),
    zip: clean(lead.zip, 10),
    problem: problemWords(lead),
    trainer_name: trainer?.full_name || "",
    booking_link: bookUrl,
    trainer_portal_link: staffLeadLink(lead.id),
    practice: isSandbox()
  });
  return { ...base, status: result.ok ? "sent" : "failed", trainer_last4: last4(trainerPhone), make_status: result.status, make_answer: result.answer, ...(result.ok ? {} : { reason: `Make answered ${result.status}: ${result.answer}` }) };
}

async function afterEvalCompleted({ lead }) {
  const texts = await sendEvalCompletedTexts({ lead })
    .catch(error => ({ kind: "trainer_log_deal", at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
  await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, eval_completed_text: texts }))
    .catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  console.log("pipeline_after_eval_completed", JSON.stringify({ lead: lead.id, texts: texts.status }));
  return { texts };
}

async function afterPreEval({ lead }) {
  const texts = await sendPreEvalTexts({ lead })
    .catch(error => ({ kind: "pre_eval_answers", at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
  await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, pre_eval_text: texts }))
    .catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  console.log("pipeline_after_pre_eval", JSON.stringify({ lead: lead.id, texts: texts.status }));
  return { texts };
}

// ---------------------------------------------------------------------------
// Recording what happened on the lead (raw_payload.pipeline), version-guarded
// ---------------------------------------------------------------------------
const rawOf = row => (row?.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {});

async function mergePipelineRecord(leadId, update) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rows = await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&select=id,version,raw_payload&limit=1`);
    const row = rows?.[0];
    if (!row) return null;
    const raw = rawOf(row);
    const pipeline = update(raw.pipeline && typeof raw.pipeline === "object" ? raw.pipeline : {});
    const saved = await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&version=eq.${encodeURIComponent(row.version)}`, {
      method: "PATCH", prefer: "return=representation", body: { raw_payload: { ...raw, pipeline } }
    });
    if (saved?.[0]) return saved[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// The office booking email (step 3b, rule 73): RESEND ONLY, queued until the key is present.
// State per booking: raw_payload.pipeline.booking_notices[].office_email
//   { status: queued | sending | sent | failed | superseded, reason, queued_at, attempts, to[], resend_id, sent_at }
// raw_payload.pipeline.office_email_pending = true while any notice still has to go (the flush looks for it).
// ---------------------------------------------------------------------------
const PENDING_FILTER = "raw_payload->pipeline->>office_email_pending=eq.true";
const OFFICE_LEAD_SELECT = "id,version,created_at,first_name,last_name,phone,email,zip,sms_consent,comments,source_page,address_line_1,assigned_trainer_name,raw_payload";

const sendable = (email, nowMs = Date.now()) => {
  if (!email || typeof email !== "object") return false;
  if (email.status === "queued") return true;
  if (email.status === "failed") return (email.attempts || 0) < MAX_EMAIL_ATTEMPTS;
  if (email.status === "sending") return nowMs - new Date(email.claimed_at || 0).getTime() > SENDING_STALE_MS;
  return false;
};
const stillPending = notices => notices.some(n => sendable(n.office_email) || n.office_email?.status === "sending");

// Send every queued office email of ONE lead. Claim (version-guarded) -> send -> record. Never throws.
async function sendLeadOfficeEmails(leadId, { settings = null, config = null } = {}) {
  config = config || await M.officeResendConfig();
  const out = { sent: [], failed: [], waiting: 0, superseded: 0 };
  if (!isSandbox()) return out; // live: not built this round (the routes 404 there)
  const lead = (await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&select=${OFFICE_LEAD_SELECT}&limit=1`))?.[0];
  if (!lead) return out;
  const pipeline = rawOf(lead).pipeline || {};
  const notices = Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : [];
  if (!config.ready) {
    out.waiting = notices.filter(n => sendable(n.office_email)).length;
    return out;
  }
  const current = rawOf(lead).booking || {};
  settings = settings || await loadSettings();
  for (const notice of notices) {
    if (!sendable(notice.office_email)) continue;
    const holdId = notice.hold_id;
    // A rebooked lead: only the CURRENT booking is emailed; the older one is marked, never sent.
    // Rule 74: a "request this trainer" notice is superseded once a real time is booked; a callback never is.
    const superseded = !notice.kind
      ? Boolean(holdId && current.hold_id && holdId !== current.hold_id)
      : notice.kind === "trainer_request" && Boolean(current.slot_start);
    if (superseded) {
      await mergePipelineRecord(lead.id, p => {
        const list = (p.booking_notices || []).map(n => (n.hold_id === holdId && sendable(n.office_email) ? { ...n, office_email: { ...n.office_email, status: "superseded", reason: "A newer booking replaced this one: only the newer one is emailed." } } : n));
        return { ...p, booking_notices: list, office_email_pending: stillPending(list) };
      }).catch(() => null);
      out.superseded += 1;
      continue;
    }
    let claimed = false;
    const claimedAt = now();
    const saved = await mergePipelineRecord(lead.id, p => {
      claimed = false;
      const list = Array.isArray(p.booking_notices) ? p.booking_notices : [];
      const mine = list.find(n => n.hold_id === holdId);
      if (!mine || !sendable(mine.office_email)) return p;
      claimed = true;
      return { ...p, booking_notices: list.map(n => (n === mine ? { ...n, office_email: { ...n.office_email, status: "sending", claimed_at: claimedAt } } : n)) };
    }).catch(() => null);
    if (!saved || !claimed) continue;
    const { to, redirectedFrom } = emailRecipients(settings, isSandbox(), notice.kind || "");
    if (!to.length) {
      await mergePipelineRecord(lead.id, p => {
        const list = (p.booking_notices || []).map(n => (n.hold_id === holdId ? { ...n, office_email: { ...n.office_email, status: "skipped", reason: "No address is saved for this email in Settings." } } : n));
        return { ...p, booking_notices: list, office_email_pending: stillPending(list) };
      }).catch(() => null);
      continue;
    }
    const lane = pipeline.lane ? { label: pipeline.lane.label } : null;
    const email = M.buildBookingEmail({ lead, booking: current, trainerName: current.trainer_name, staffLink: staffLeadLink(lead.id), lane, practice: isSandbox(), redirectedFrom, kind: notice.kind || "", pipeline });
    const result = await M.sendViaResend({ ...email, to, idempotencyKey: `ldtt-booking-email-${lead.id}-${holdId || "nohold"}` }, config);
    const record = prior => result.ok
      ? { ...prior, status: "sent", reason: "", sent_at: now(), resend_id: result.id, to, attempts: (prior.attempts || 0) + 1, subject: email.subject }
      : { ...prior, status: "failed", reason: `Resend did not send it: ${result.message}`, last_error_at: now(), to, attempts: (prior.attempts || 0) + 1 };
    await mergePipelineRecord(lead.id, p => {
      const list = (p.booking_notices || []).map(n => (n.hold_id === holdId ? { ...n, office_email: record(n.office_email || {}) } : n));
      return { ...p, booking_notices: list, office_email_pending: stillPending(list) };
    }).catch(error => console.error("office_email_record_failed", String(error?.message || error)));
    (result.ok ? out.sent : out.failed).push({ lead_id: lead.id, hold_id: holdId, resend_id: result.id || null, message: result.message || "" });
    console.log("office_email", JSON.stringify({ lead: lead.id, hold: holdId, ok: result.ok, id: result.id || null, status: result.status, recipients: to.length }));
  }
  return out;
}

// Every lead with a queued office email (the "send queued" retry, and after every booking).
async function sendQueuedOfficeEmails({ limit = 25, config = null } = {}) {
  config = config || await M.officeResendConfig();
  const total = { resend_ready: config.ready, sent: [], failed: [], waiting: 0, superseded: 0, leads: 0 };
  if (!isSandbox()) return total;
  const rows = (await B.sbOrThrow(`/rest/v1/leads?${PENDING_FILTER}&select=id&order=created_at.asc&limit=${Math.max(1, Math.min(100, limit))}`)) || [];
  total.leads = rows.length;
  const settings = config.ready ? await loadSettings() : null;
  for (const row of rows) {
    const r = await sendLeadOfficeEmails(row.id, { settings, config }).catch(error => ({ sent: [], failed: [{ lead_id: row.id, message: String(error?.message || error) }], waiting: 0, superseded: 0 }));
    total.sent.push(...r.sent); total.failed.push(...r.failed); total.waiting += r.waiting; total.superseded += r.superseded;
  }
  return total;
}

async function queuedOfficeEmailCount() {
  try {
    const rows = (await B.sbOrThrow(`/rest/v1/leads?${PENDING_FILTER}&select=id&limit=200`)) || [];
    return rows.length;
  } catch {
    return 0;
  }
}

// After a booking: pathway 2 texts + the office email (Resend, or QUEUED when the key is missing). Never
// throws: the booking already happened, so a failed notice is recorded on the lead and shown in the
// portal. One notice per hold: the same hold never texts or emails twice.
async function afterBooking({ lead, booking, trainer, setting }) {
  const holdId = booking?.hold_id || null;
  const config = await M.officeResendConfig();
  let claimed = false;
  try {
    const saved = await mergePipelineRecord(lead.id, pipeline => {
      claimed = false;
      const notices = Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : [];
      if (holdId && notices.some(n => n.hold_id === holdId)) return pipeline;
      claimed = true;
      const officeEmail = { status: "queued", queued_at: now(), attempts: 0, reason: config.ready ? "" : WAITING_FOR_KEY };
      return { ...pipeline, office_email_pending: true, booking_notices: [...notices, { hold_id: holdId, slot_start: booking?.slot_start || null, texts: { pathway: 2, at: now(), status: "sending" }, office_email: officeEmail }].slice(-10) };
    });
    if (!saved) claimed = false;
  } catch (error) {
    console.error("pipeline_claim_failed", String(error?.message || error));
    claimed = false;
  }
  if (!claimed) return { hold_id: holdId, texts: { pathway: 2, status: "skipped", reason: "Already handled for this booking." } };
  const settings = await loadSettings();
  const texts = await sendBookingTexts({ lead, booking, trainer, setting, settings })
    .catch(error => ({ pathway: 2, at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
  try {
    await mergePipelineRecord(lead.id, pipeline => ({
      ...pipeline,
      booking_notices: (Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : []).map(n => (n.hold_id === holdId ? { ...n, texts } : n))
    }));
  } catch (error) {
    console.error("pipeline_record_failed", String(error?.message || error));
  }
  let slot = { day: "", date: "", time: "" };
  try { slot = slotParts(booking?.slot_start, booking?.local_time_zone || booking?.time_zone || setting?.time_zone || "America/New_York"); } catch { /* keep blanks */ }
  const opsBooked = await sendOpsAlert("eval_booked", {
    client_name: [booking?.client?.first_name || lead.first_name, booking?.client?.last_name || lead.last_name].filter(Boolean).join(" "),
    trainer_name: trainer?.full_name || booking?.trainer_name || "",
    appointment_day: slot.day, appointment_date: slot.date, appointment_time: slot.time,
    link: staffLeadLink(lead.id)
  }).catch(error => ({ stage: "eval_booked", at: now(), status: "failed", reason: clean(error?.message || error, 200) }));
  await mergePipelineRecord(lead.id, pipeline => ({
    ...pipeline,
    booking_notices: (Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : []).map(n => (n.hold_id === holdId ? { ...n, ops_alert: opsBooked } : n))
  })).catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  // The office email: this booking first, then every other queued one (the key may have just arrived).
  let office = { status: config.ready ? "queued" : "waiting", reason: config.ready ? "" : WAITING_FOR_KEY };
  if (config.ready) {
    const mine = await sendLeadOfficeEmails(lead.id, { settings, config }).catch(error => ({ sent: [], failed: [{ message: String(error?.message || error) }] }));
    office = mine.sent.length ? { status: "sent", resend_id: mine.sent[0].resend_id } : mine.failed.length ? { status: "failed", reason: mine.failed[0].message } : office;
    await sendQueuedOfficeEmails({ config }).catch(error => console.error("office_email_flush_failed", String(error?.message || error)));
  }
  console.log("pipeline_after_booking", JSON.stringify({ lead: lead.id, hold: holdId, texts: texts.status, office_email: office.status }));
  return { hold_id: holdId, texts, office_email: office };
}

// Joshua 2026-09-15: Production (Alpha intake) gets every new pipeline lead so they can log it into Alpha. Contact Us
// leads are skipped: the Contact page's FormSubmit already emails production@ (rule 73, never doubled). One notice per
// lead (hold_id "new_lead"), same queue and Resend-only path as a booking, so a retry never emails twice. Never throws.
async function queueNewLeadEmail(lead) {
  if (!lead || isContactUsLead(lead)) return { status: "skipped" };
  const config = await M.officeResendConfig();
  let claimed = false;
  const saved = await mergePipelineRecord(lead.id, pipeline => {
    claimed = false;
    const notices = Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : [];
    if (notices.some(n => n.hold_id === "new_lead")) return pipeline;
    claimed = true;
    const officeEmail = { status: "queued", queued_at: now(), attempts: 0, reason: config.ready ? "" : WAITING_FOR_KEY };
    return { ...pipeline, office_email_pending: true, booking_notices: [...notices, { hold_id: "new_lead", kind: "new_lead", requested_at: now(), office_email: officeEmail }].slice(-10) };
  }).catch(() => null);
  if (!saved || !claimed) return { status: "already" };
  if (!config.ready) return { status: "waiting" };
  const mine = await sendLeadOfficeEmails(lead.id, { config });
  return mine.sent.length ? { status: "sent" } : mine.failed.length ? { status: "failed" } : { status: "queued" };
}

// Step 3c (rule 74): the office is told about a "request this trainer" (no calendar yet) or a "no trainer
// within 50 miles" callback. Same queue and same Resend-only email as a booking (rule 73), one notice per
// request (notice id request:<trainer> / callback:<zip>), so a double tap never emails twice. No texts.
async function afterOfficeRequest({ lead, kind }) {
  const booking = rawOf(lead).booking || {};
  const noticeId = kind === "no_trainer" ? `callback:${clean(booking.callback?.zip, 10)}` : `request:${clean(booking.trainer_slug, 80)}`;
  const config = await M.officeResendConfig();
  let claimed = false;
  try {
    const saved = await mergePipelineRecord(lead.id, pipeline => {
      claimed = false;
      const notices = Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : [];
      if (notices.some(n => n.hold_id === noticeId && n.office_email?.status !== "superseded")) return pipeline;
      claimed = true;
      const officeEmail = { status: "queued", queued_at: now(), attempts: 0, reason: config.ready ? "" : WAITING_FOR_KEY };
      return { ...pipeline, office_email_pending: true, booking_notices: [...notices, { hold_id: noticeId, kind, requested_at: now(), office_email: officeEmail }].slice(-10) };
    });
    if (!saved) claimed = false;
  } catch (error) {
    console.error("pipeline_request_claim_failed", String(error?.message || error));
    claimed = false;
  }
  if (!claimed) return { kind, office_email: { status: "already" } };
  let office = { status: config.ready ? "queued" : "waiting", reason: config.ready ? "" : WAITING_FOR_KEY };
  if (config.ready) {
    const mine = await sendLeadOfficeEmails(lead.id, { config }).catch(error => ({ sent: [], failed: [{ message: String(error?.message || error) }] }));
    office = mine.sent.length ? { status: "sent", resend_id: mine.sent[0].resend_id } : mine.failed.length ? { status: "failed", reason: mine.failed[0].message } : office;
  }
  console.log("pipeline_office_request", JSON.stringify({ lead: lead.id, kind, office_email: office.status }));
  return { kind, office_email: office };
}

// ---------------------------------------------------------------------------
// Entering the pipeline (every source)
// ---------------------------------------------------------------------------
const LEAD_SELECT = "id,version,created_at,first_name,last_name,phone,email,zip,sms_consent,trainer_slug,assigned_trainer_name,comments,address_line_1,city,state,service_interest,status,source_page,raw_payload";

function alreadyBody(lead, pipeline) {
  return { ok: true, lead_id: lead.id, trainer_slug: pipeline.trainer_slug || null, book_url: pipeline.book_url || null, texted: pipeline.new_lead_text?.status === "sent", already: true };
}

// A lead a form already saved (submit-contact on the practice copy, or /api/booking-lead) enters the
// one pipeline. Order: route -> decide the text -> CLAIM (version-guarded PATCH that stamps
// pipeline.entered_at) -> send only if this call won the claim -> record the result. So a double click,
// a retry or two pages calling at once can never text twice.
async function enterPipeline(leadId, { via = "website-form", maxAgeMinutes = MAX_AGE_MINUTES } = {}) {
  let lead = (await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&select=${LEAD_SELECT}&limit=1`))?.[0];
  if (!lead) return { status: 404, body: { ok: false, message: "We could not find that request." } };
  if (rawOf(lead).pipeline?.entered_at) return { status: 200, body: alreadyBody(lead, rawOf(lead).pipeline) };
  const ageMs = Date.now() - new Date(lead.created_at).getTime();
  if (!(ageMs >= -60000 && ageMs <= maxAgeMinutes * 60 * 1000)) return { status: 409, body: { ok: false, message: "This request is too old to start the online pipeline." } };
  // The free ebook opt-in is not a booking lead (its phone is a placeholder, no SMS box): it stays a plain lead.
  if (rawOf(lead).lead_type === "pdf_download") return { status: 200, body: { ok: true, lead_id: lead.id, trainer_slug: null, book_url: null, skipped: "ebook" } };

  // Contact Us = Option C: the "I want to..." answer picks the lane. Every other source is the booking lane.
  const lane = decideLane(lead, await loadLanes());
  if (lane.key !== "booking") return enterOtherLane(lead, lane, via);

  // Routing. A trainer-page lead stays with ITS trainer: it gets a booking link only when that trainer
  // takes online bookings; otherwise the office follows up (it is never handed to another trainer).
  const settings = await B.loadSettings();
  const pageSlug = clean(lead.trainer_slug, 80).toLowerCase();
  let setting = null;
  let nearest = null;
  let routeNote = "";
  if (pageSlug) {
    setting = B.settingBySlug(settings, pageSlug);
    if (!setting) routeNote = "This trainer does not take online bookings yet: office follow-up, no text.";
  } else {
    // Step 3c (rule 74): the 50-mile radius from each trainer's Base ZIP. The nearest trainer WITH a
    // calendar is assigned; any trainer in the radius means the link works (the client picks a trainer on
    // the page, ZIP pre-filled). Nobody within 50 miles = office follow-up, no link, no text.
    const route = await B.routeZip(lead.zip, settings).catch(error => {
      console.error("pipeline_route_failed", String(error?.message || error));
      return { cards: [], calendar: null, nearest: null };
    });
    setting = route.calendar;
    nearest = route.nearest;
    if (!route.nearest) routeNote = `No trainer within ${B.RADIUS_MILES} miles of this ZIP yet: office follow-up, no text.`;
  }
  const trainer = setting ? await B.trainerRow(setting.slug) : null;
  const routed = setting && trainer ? setting : null;
  const linkSlug = routed?.slug || nearest?.slug || null;
  const bookUrl = linkSlug ? B.bookUrl(linkSlug, lead.id) : null;
  const plan = newLeadTextPlan({ lead, bookUrl, testers: await activeTesterPhones(), routeNote });
  const enteredAt = now();

  let won = null;
  for (let attempt = 0; attempt < 3 && !won; attempt += 1) {
    if (attempt > 0) {
      lead = (await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}&select=${LEAD_SELECT}&limit=1`))?.[0];
      if (!lead) break;
      if (rawOf(lead).pipeline?.entered_at) return { status: 200, body: alreadyBody(lead, rawOf(lead).pipeline) };
    }
    const cur = rawOf(lead);
    const rows = await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}&version=eq.${encodeURIComponent(lead.version)}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        ...(routed && !lead.trainer_slug ? B.trainerFields(routed, trainer) : {}),
        raw_payload: {
          ...cur,
          ...(routed && trainer?.market && !cur.trainer_market ? { trainer_market: trainer.market } : {}),
          sales_pipeline: true, // rule 2: the pipeline carries this lead, so it shows on the Sales tab too
          booking: {
            ...(cur.booking && typeof cur.booking === "object" ? cur.booking : {}),
            intake: cur.booking?.intake || { via, trainer_slug: routed?.slug || null, trainer_name: trainer?.full_name || null, zip: lead.zip || null, received_at: enteredAt }
          },
          pipeline: {
            ...(cur.pipeline || {}),
            entered_at: enteredAt,
            via,
            lane,
            trainer_slug: routed?.slug || null,
            book_url: bookUrl,
            new_lead_text: plan.send ? { pathway: 1, at: enteredAt, status: "sending" } : { pathway: 1, at: enteredAt, status: "skipped", reason: plan.reason }
          }
        }
      }
    });
    won = rows?.[0] || null;
  }
  if (!won) return { status: 409, body: { ok: false, message: "The request changed while it was being saved. Please try again." } };

  let text = won.raw_payload.pipeline.new_lead_text;
  if (plan.send) {
    text = await sendNewLeadText({ lead: won, trainer, bookUrl, phone: plan.phone })
      .catch(error => ({ pathway: 1, at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
    await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, new_lead_text: text }))
      .catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  }
  console.log("pipeline_enter", JSON.stringify({ lead: lead.id, via, trainer: routed?.slug || null, text: text.status }));
  const opsNew = await sendOpsAlert("new_lead", {
    client_name: [won.first_name, won.last_name].filter(Boolean).join(" ") || "New lead",
    zip: clean(won.zip, 10),
    problem: problemWords(won),
    source: sourceWords(lead, via, pageSlug ? trainer : null),
    next_step: bookUrl ? (text.status === "sent" ? "Booking link texted." : "Booking link ready.") : "Office follow-up.",
    link: staffLeadLink(lead.id)
  }).catch(error => ({ stage: "new_lead", at: now(), status: "failed", reason: clean(error?.message || error, 200) }));
  await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, ops_new_lead: opsNew }))
    .catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  // Joshua 2026-09-17: the routed calendar trainer hears about the inquiry right away (trainer branch of pathway 2).
  const inquiry = await sendNewInquiryText({ lead: won, trainer: routed ? trainer : null, bookUrl: routed ? bookUrl : null })
    .catch(error => ({ kind: "trainer_new_inquiry", at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
  await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, trainer_new_inquiry_text: inquiry }))
    .catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  await queueNewLeadEmail(won).catch(error => console.error("new_lead_email_failed", String(error?.message || error)));
  return {
    status: 200,
    body: {
      ok: true,
      lead_id: lead.id,
      trainer_slug: linkSlug,
      book_url: bookUrl,
      texted: text.status === "sent",
      message: routed ? `Pick a time for your free evaluation with ${trainer.full_name}.` : bookUrl ? "Pick your trainer and a time for your free evaluation." : `Our office will call you to set up your free evaluation. ${OFFICE_PHONE}`
    }
  };
}

// Lanes office_call / recruiting / office_follow_up: the lane is logged on the lead (claim first, as in the
// booking lane), no trainer routing, no booking link, not on the Sales tab. Only office_call may text, and
// only the customer-care text (SMS consent + tester phone + its own Make route).
async function enterOtherLane(lead, lane, via) {
  const plan = lane.key === "office_call" ? careTextPlan({ lead, testers: await activeTesterPhones() }) : { send: false, reason: lane.key === "recruiting" ? "Recruiting inquiry: no client text." : "Unknown or blank \"I want to\" answer: office follow-up, no text." };
  const enteredAt = now();
  let won = null;
  for (let attempt = 0; attempt < 3 && !won; attempt += 1) {
    if (attempt > 0) {
      lead = (await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}&select=${LEAD_SELECT}&limit=1`))?.[0];
      if (!lead) break;
      if (rawOf(lead).pipeline?.entered_at) return { status: 200, body: alreadyBody(lead, rawOf(lead).pipeline) };
    }
    const cur = rawOf(lead);
    const rows = await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}&version=eq.${encodeURIComponent(lead.version)}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        raw_payload: {
          ...cur,
          pipeline: {
            ...(cur.pipeline || {}),
            entered_at: enteredAt,
            via,
            lane,
            trainer_slug: null,
            book_url: null,
            care_text: lane.key === "office_call" ? (plan.send ? { kind: "customer_care", at: enteredAt, status: "sending" } : { kind: "customer_care", at: enteredAt, status: "skipped", reason: plan.reason }) : undefined,
            new_lead_text: { pathway: 1, at: enteredAt, status: "skipped", reason: `${lane.label}: no booking-link text.` }
          }
        }
      }
    });
    won = rows?.[0] || null;
  }
  if (!won) return { status: 409, body: { ok: false, message: "The request changed while it was being saved. Please try again." } };
  let care = won.raw_payload.pipeline.care_text || null;
  if (plan.send) {
    care = await sendCareText({ lead: won, phone: plan.phone }).catch(error => ({ kind: "customer_care", at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
    await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, care_text: care }))
      .catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  }
  console.log("pipeline_enter", JSON.stringify({ lead: lead.id, via, lane: lane.key, care: care?.status || null }));
  const message = lane.key === "recruiting"
    ? "Thanks for your interest in becoming a trainer. Our recruiting team will follow up."
    : `Thanks. Our office will call you shortly. ${OFFICE_PHONE}`;
  return { status: 200, body: { ok: true, lead_id: lead.id, lane: lane.key, trainer_slug: null, book_url: null, texted: care?.status === "sent", message } };
}

// Rule 84: one test text, to the locked phone only (rule 82), through pathway 1's hook with pathway "text_test".
// Called only after the Make switch (api/pipeline.js checks LDTT_TEXTS_FROM_PORTAL); the words are the draft
// being tested (or the words in use), filled with example values.
async function sendTextTest(key, draftWords) {
  if (!isSandbox()) return { ok: false, message: "Test texts are for the practice copy only." };
  if (!T.TEXTS.some(t => t.key === key)) return { ok: false, message: "Unknown text." };
  const phone = SEND_TEST_PHONE;
  const testers = await activeTesterPhones();
  if (!phone || !testers.has(phone)) return { ok: false, message: "The test phone is not an active tester phone." };
  let state = null;
  try { state = (await T.load(B.sbOrThrow)).state; } catch { state = null; }
  const source = typeof draftWords === "string" && draftWords.trim() ? draftWords : T.wordsFor(state, key);
  const ok = T.check(key, source);
  if (ok.error) return { ok: false, message: ok.error };
  const message = `[TEST] ${T.render(ok.value, T.SAMPLE)}`;
  const result = await postHook(hookUrl(1), { pathway: "text_test", phone, message, first_name: "Test", problem: "a test", booking_link: "(test)", practice: true });
  return result.ok ? { ok: true, message: `Test text sent to ...${last4(phone)}.` } : { ok: false, message: `Make answered ${result.status}: ${result.answer}` };
}

module.exports = {
  sendTextTest,
  SETTINGS_KEY, DEFAULT_RECIPIENTS, DEFAULT_ALPHA_EMAIL, DEFAULT_PRACTICE_TRAINER_PHONE, DEFAULT_PRACTICE_EMAIL_TO, MAX_AGE_MINUTES, WAITING_FOR_KEY,
  LANES, CONTACT_US_LANES, CARE_TEXT,
  e164, normalizeSettings, defaultSettings, loadSettings, saveSettings, officeEmails, emailRecipients,
  normalizeLanes, loadLanes, isContactUsLead, decideLane, careHookUrl, careTextPlan,
  activeTesterPhones, hookUrl, clientPhoneFor, trainerPhoneFor, trainerForLead, trainerWithPhone, NO_TRAINER_PHONE, sendOpsAlert, sendNewInquiryText, problemWords, sourceWords, newLeadTextPlan, sendNewLeadText, sendFollowUpText, afterFollowUp, LEAD_SELECT, sendBookingTexts,
  mergePipelineRecord, afterBooking, afterOfficeRequest, afterPreEval, sendPreEvalTexts, afterEvalCompleted, sendEvalCompletedTexts, answersSummary, enterPipeline, staffLeadLink,
  sendLeadOfficeEmails, sendQueuedOfficeEmails, queuedOfficeEmailCount
};
