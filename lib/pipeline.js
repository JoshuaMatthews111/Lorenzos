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
// Nothing in this file sends email, calls FormSubmit or calls /api/form-delivery. The office booking
// email is step 3b (Resend); this file only stores WHO gets it (the settings box).
//
// The Make webhook addresses come from env (LDTT_MAKE_HOOK_PATHWAY1 / _PATHWAY2, Vercel Preview only)
// and are never committed.
const { isSandbox } = require("./sandbox");
const B = require("./booking");

const SETTINGS_KEY = "pipeline_office_emails"; // site_settings key (CHECK ^[a-z_]{1,40}$)
const DEFAULT_RECIPIENTS = [
  { label: "Marketing", email: "marketing@lorenzosdogtrainingteam.com" },
  { label: "Melissa", email: "melissazuk@lorenzosdogtrainingteam.com" },
  { label: "Rachel", email: "rachelleggett@lorenzosdogtrainingteam.com" },
  { label: "Tim", email: "tmillerk999@gmail.com" },
  { label: "Angela", email: "" } // no address yet: the slot stays so the office can type it in
];
const DEFAULT_PRACTICE_TRAINER_PHONE = "+14402142915"; // Joshua, tester. Practice copy only.
const MAX_RECIPIENTS = 12;
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
  return { errors, value: { recipients, practice_trainer_phone: practicePhone } };
}

function defaultSettings() {
  return { recipients: DEFAULT_RECIPIENTS.map(r => ({ ...r })), practice_trainer_phone: DEFAULT_PRACTICE_TRAINER_PHONE, saved: false };
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

// After a booking: pathway 2 only (the office email is step 3b, Resend). Never throws: the booking
// already happened, so a failed notice is recorded on the lead and shown in the portal. One notice per
// hold: the same hold never texts twice.
async function afterBooking({ lead, booking, trainer, setting }) {
  const holdId = booking?.hold_id || null;
  let claimed = false;
  try {
    const saved = await mergePipelineRecord(lead.id, pipeline => {
      const notices = Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : [];
      if (holdId && notices.some(n => n.hold_id === holdId)) return pipeline;
      claimed = true;
      return { ...pipeline, booking_notices: [...notices, { hold_id: holdId, slot_start: booking?.slot_start || null, texts: { pathway: 2, at: now(), status: "sending" } }].slice(-10) };
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
  console.log("pipeline_after_booking", JSON.stringify({ lead: lead.id, hold: holdId, texts: texts.status }));
  return { hold_id: holdId, texts };
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

module.exports = {
  SETTINGS_KEY, DEFAULT_RECIPIENTS, DEFAULT_PRACTICE_TRAINER_PHONE, MAX_AGE_MINUTES,
  e164, normalizeSettings, defaultSettings, loadSettings, saveSettings, officeEmails,
  activeTesterPhones, hookUrl, problemWords, newLeadTextPlan, sendNewLeadText, sendBookingTexts,
  mergePipelineRecord, afterBooking, enterPipeline, staffLeadLink
};
