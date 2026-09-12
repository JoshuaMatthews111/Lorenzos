// One pipeline for every lead source: the texts (portal chain step 3, Joshua 2026-09-12).
// DO-NOT-BREAK rule 72.
//
//   A new lead from ANY source (Contact Us, Get Started, ad pages, trainer pages, the 2.0 pages)
//   enters the same pipeline: ZIP routing to the trainer who takes online bookings, the Sales tab
//   (raw_payload.sales_pipeline), and - ONLY with SMS consent - the Make pathway 1 text with the
//   booking link. No SMS consent -> no texts at all. No trainer for the ZIP -> no link, office follow-up.
//   A completed booking -> Make pathway 2 (customer confirmation + trainer alert).
//
// PRACTICE COPY ONLY this round (api/pipeline.js answers 404 on live). Every text goes only to a phone
// that is an ACTIVE row in communications_testers (checked here, AND by the text:equal tester filter on
// every Twilio module in Make). On the practice copy the trainer alert goes to the tester phone saved in
// the settings box, never to a real trainer.
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
// Practice copy only: booking emails go to this ONE test address instead of the office list, the same way
// the trainer alert goes to a tester phone. Clear the box in Settings to send practice emails to the list.
const DEFAULT_PRACTICE_EMAIL_TO = "mr.matthews2022@gmail.com"; // Joshua, tester.
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
const CARE_TEXT = first => `Hi ${first}, thanks for contacting Lorenzo's Dog Training Team. Our office will call you shortly. Reply STOP to opt out.`;
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
  // A row saved before step 3b has no practice_email_to: it keeps the test address (never the office list by surprise).
  const practiceEmail = value.practice_email_to === undefined ? DEFAULT_PRACTICE_EMAIL_TO : clean(value.practice_email_to, 160).toLowerCase();
  if (practiceEmail && !emailOk(practiceEmail)) errors.push(`"${practiceEmail}" does not look like an email address.`);
  return { errors, value: { recipients, practice_trainer_phone: practicePhone, practice_email_to: emailOk(practiceEmail) ? practiceEmail : "" } };
}

function defaultSettings() {
  return { recipients: DEFAULT_RECIPIENTS.map(r => ({ ...r })), practice_trainer_phone: DEFAULT_PRACTICE_TRAINER_PHONE, practice_email_to: DEFAULT_PRACTICE_EMAIL_TO, saved: false };
}

// Who actually gets the office booking email. Practice copy: the test address when one is saved.
function emailRecipients(settings, practice = isSandbox()) {
  const list = officeEmails(settings);
  if (practice && settings?.practice_email_to) return { to: [settings.practice_email_to], redirectedFrom: list };
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
  return { ok: true, settings: { ...value, saved: true, updated_by: row.updated_by || "", updated_at: row.updated_at || "" } };
}

const officeEmails = settings => (settings?.recipients || []).map(r => r.email).filter(Boolean);

// ---------------------------------------------------------------------------
// Tester guard + Make webhooks
// ---------------------------------------------------------------------------
async function activeTesterPhones() {
  try {
    const rows = await B.sbOrThrow("/rest/v1/communications_testers?active=eq.true&select=phone");
    return new Set((rows || []).map(r => e164(r.phone)).filter(Boolean));
  } catch {
    return new Set(); // fail closed: no tester list, no texts
  }
}

function hookUrl(pathway) {
  const url = String(process.env[`LDTT_MAKE_HOOK_PATHWAY${pathway}`] || "").trim();
  return /^https:\/\/hook\.[a-z0-9.-]+\.make\.com\/[A-Za-z0-9]+$/.test(url) ? url : "";
}

async function postHook(url, payload) {
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
  if (!isSandbox()) return { send: false, reason: "Texts are switched on for the practice copy only." };
  if (lead?.sms_consent !== true) return { send: false, reason: "No SMS consent: no texts." };
  if (!bookUrl) return { send: false, reason: routeNote || "No trainer serves this ZIP yet: office follow-up, no text." };
  const phone = e164(lead.phone);
  if (!phone) return { send: false, reason: "No textable phone number." };
  if (!testers.has(phone)) return { send: false, reason: `Practice copy: ...${last4(phone)} is not an active tester phone.` };
  if (!hookUrl(1)) return { send: false, reason: "The Make pathway 1 address is not set on this deployment." };
  return { send: true, phone };
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
    practice: true
  });
  return { pathway: 1, at: now(), status: result.ok ? "sent" : "failed", to_last4: last4(phone), make_status: result.status, make_answer: result.answer };
}

// Lane office_call: the short customer-care text. It needs its OWN Make route: pathway 1's scenario has one
// Twilio module with the booking-link wording and no pathway filter, so this text must never be posted to
// that hook. Until LDTT_MAKE_HOOK_CARE is set (a Make route Joshua approves), it is recorded as not sent.
function careHookUrl() {
  const url = String(process.env.LDTT_MAKE_HOOK_CARE || "").trim();
  return /^https:\/\/hook\.[a-z0-9.-]+\.make\.com\/[A-Za-z0-9]+$/.test(url) && url !== hookUrl(1) ? url : "";
}

function careTextPlan({ lead, testers }) {
  if (!isSandbox()) return { send: false, reason: "Texts are switched on for the practice copy only." };
  if (lead?.sms_consent !== true) return { send: false, reason: "No SMS consent: no texts." };
  const phone = e164(lead.phone);
  if (!phone) return { send: false, reason: "No textable phone number." };
  if (!testers.has(phone)) return { send: false, reason: `Practice copy: ...${last4(phone)} is not an active tester phone.` };
  if (!careHookUrl()) return { send: false, reason: "The customer-care text has no Make route yet (LDTT_MAKE_HOOK_CARE is not set): not sent." };
  return { send: true, phone };
}

async function sendCareText({ lead, phone }) {
  const first = clean(lead.first_name, 80) || "there";
  const result = await postHook(careHookUrl(), { pathway: "customer_care", lead_id: lead.id, phone, first_name: first, message: CARE_TEXT(first), practice: true });
  return { kind: "customer_care", at: now(), status: result.ok ? "sent" : "failed", to_last4: last4(phone), make_status: result.status, make_answer: result.answer };
}

function slotParts(iso, timeZone) {
  const date = new Date(iso);
  const opts = { timeZone };
  return {
    day: date.toLocaleDateString("en-US", { ...opts, weekday: "long" }),
    date: date.toLocaleDateString("en-US", { ...opts, month: "long", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", { ...opts, hour: "numeric", minute: "2-digit", timeZoneName: "short" })
  };
}

const SAFETY_WORDS = /\b(bit|bite|bites|biting|bitten|aggress\w*|attack\w*|lunge\w*|snap\w*|growl\w*)\b/i;

function staffLeadLink(leadId) {
  return `${B.practiceOrigin()}/staff?view=leads&lead=${encodeURIComponent(leadId)}`;
}

// Pathway 2: customer confirmation + trainer alert in ONE Make run; the Make filters drop whichever
// phone is empty or not a tester.
async function sendBookingTexts({ lead, booking, trainer, setting, settings }) {
  const base = { pathway: 2, at: now() };
  if (!isSandbox()) return { ...base, status: "skipped", reason: "Texts are switched on for the practice copy only." };
  const testers = await activeTesterPhones();
  const customer = lead?.sms_consent === true ? e164(booking?.client?.phone || lead?.phone) : "";
  const trainerPhone = e164(settings?.practice_trainer_phone || ""); // practice copy: never the real trainer
  const customerOk = Boolean(customer && testers.has(customer));
  const trainerOk = Boolean(trainerPhone && testers.has(trainerPhone));
  const notes = [];
  if (lead?.sms_consent !== true) notes.push("Customer: no SMS consent, no customer text.");
  else if (!customerOk) notes.push(customer ? `Customer: ...${last4(customer)} is not an active tester phone.` : "Customer: no textable phone.");
  if (!trainerOk) notes.push(trainerPhone ? `Trainer alert: ...${last4(trainerPhone)} is not an active tester phone.` : "Trainer alert: no tester phone saved in the settings box.");
  if (!customerOk && !trainerOk) return { ...base, status: "skipped", reason: notes.join(" ") };
  const url = hookUrl(2);
  if (!url) return { ...base, status: "skipped", reason: "The Make pathway 2 address is not set on this deployment." };
  const tz = booking?.time_zone || setting?.time_zone || "America/New_York";
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
    pre_eval_link: B.bookUrl(booking.trainer_slug, lead.id),
    trainer_portal_link: staffLeadLink(lead.id),
    link: staffLeadLink(lead.id),
    practice: true
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
const OFFICE_LEAD_SELECT = "id,version,created_at,first_name,last_name,phone,email,zip,sms_consent,comments,source_page,address_line_1,raw_payload";

const sendable = (email, nowMs = Date.now()) => {
  if (!email || typeof email !== "object") return false;
  if (email.status === "queued") return true;
  if (email.status === "failed") return (email.attempts || 0) < MAX_EMAIL_ATTEMPTS;
  if (email.status === "sending") return nowMs - new Date(email.claimed_at || 0).getTime() > SENDING_STALE_MS;
  return false;
};
const stillPending = notices => notices.some(n => sendable(n.office_email) || n.office_email?.status === "sending");

// Send every queued office email of ONE lead. Claim (version-guarded) -> send -> record. Never throws.
async function sendLeadOfficeEmails(leadId, { settings = null, config = M.resendConfig() } = {}) {
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
    if (holdId && current.hold_id && holdId !== current.hold_id) {
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
    const { to, redirectedFrom } = emailRecipients(settings);
    const lane = pipeline.lane ? { label: pipeline.lane.label } : null;
    const email = M.buildBookingEmail({ lead, booking: current, trainerName: current.trainer_name, staffLink: staffLeadLink(lead.id), lane, practice: isSandbox(), redirectedFrom });
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
async function sendQueuedOfficeEmails({ limit = 25, config = M.resendConfig() } = {}) {
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
  const config = M.resendConfig();
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

// ---------------------------------------------------------------------------
// Entering the pipeline (every source)
// ---------------------------------------------------------------------------
const LEAD_SELECT = "id,version,created_at,first_name,last_name,phone,email,zip,sms_consent,trainer_slug,assigned_trainer_name,comments,service_interest,status,source_page,raw_payload";

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
  let routeNote = "";
  if (pageSlug) {
    setting = B.settingBySlug(settings, pageSlug);
    if (!setting) routeNote = "This trainer does not take online bookings yet: office follow-up, no text.";
  } else {
    setting = B.trainerForZip(lead.zip, settings);
  }
  const trainer = setting ? await B.trainerRow(setting.slug) : null;
  const routed = setting && trainer ? setting : null;
  const bookUrl = routed ? B.bookUrl(routed.slug, lead.id) : null;
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
  return {
    status: 200,
    body: {
      ok: true,
      lead_id: lead.id,
      trainer_slug: routed?.slug || null,
      book_url: bookUrl,
      texted: text.status === "sent",
      message: routed ? `Pick a time for your free evaluation with ${trainer.full_name}.` : `Our office will call you to set up your free evaluation. ${OFFICE_PHONE}`
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

module.exports = {
  SETTINGS_KEY, DEFAULT_RECIPIENTS, DEFAULT_PRACTICE_TRAINER_PHONE, DEFAULT_PRACTICE_EMAIL_TO, MAX_AGE_MINUTES, WAITING_FOR_KEY,
  LANES, CONTACT_US_LANES, CARE_TEXT,
  e164, normalizeSettings, defaultSettings, loadSettings, saveSettings, officeEmails, emailRecipients,
  normalizeLanes, loadLanes, isContactUsLead, decideLane, careHookUrl, careTextPlan,
  activeTesterPhones, hookUrl, problemWords, newLeadTextPlan, sendNewLeadText, sendBookingTexts,
  mergePipelineRecord, afterBooking, enterPipeline, staffLeadLink,
  sendLeadOfficeEmails, sendQueuedOfficeEmails, queuedOfficeEmailCount
};
