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
// Nothing in this file calls FormSubmit or /api/form-delivery. The emails are the office booking emails
// (step 3b, rule 73) and, since 2026-09-21, the email twin of every Operations and trainer text
// (sendTextTwinEmail), and they go ONLY through Resend (lib/office-email.js). With no RESEND_API_KEY an office
// email is QUEUED on the lead (raw_payload.pipeline.booking_notices[].office_email) and sent once the key is
// present; an email twin is recorded as skipped (waiting for the key) and is not retried later.
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
const { milesBetween, centroid } = require("./zip-distance"); // rule 74's bundled Census ZCTA centroids (re-engage local link)

const SETTINGS_KEY = "pipeline_office_emails"; // site_settings key (CHECK ^[a-z_]{1,40}$)
const DEFAULT_RECIPIENTS = [
  { label: "Marketing", email: "marketing@lorenzosdogtrainingteam.com" },
  { label: "Melissa", email: "melissazuk@lorenzosdogtrainingteam.com" },
  { label: "Rachel", email: "rachelleggett@lorenzosdogtrainingteam.com" },
  { label: "Lorenzo", email: "tmillerk999@gmail.com" }, // standing rule: he is Lorenzo, never "Tim", on any screen
  { label: "Angela", email: "" } // no address yet: the slot stays so the office can type it in
];
const DEFAULT_PRACTICE_TRAINER_PHONE = "+14402142915"; // Joshua, tester. Practice copy only.
// Was Lorenzo's own mobile (Joshua 2026-09-12). Joshua 2026-09-14: every practice text goes only to Joshua for now.
const DEFAULT_PRACTICE_OPS_PHONE = "+14402142915"; // Joshua, tester. Practice copy only.
// Practice copy only: booking emails go to this ONE test address instead of the office list, the same way
// the trainer alert goes to a tester phone. Clear the box in Settings to send practice emails to the list.
const DEFAULT_PRACTICE_EMAIL_TO = "production@lorenzosdogtrainingteam.com"; // Joshua 2026-09-15: practice booking emails go to production@ (was marketing@).
// Joshua 2026-09-15: "production is not used for team emails ... production get the leads as well so they can log it
// into Alpha, not a part of my every day teams." Production (Alpha intake) is its OWN box, not a team-list line: it gets
// a "New lead" email for every pipeline lead that the website FormSubmit does not already send it (every source except
// Contact Us), plus every booking / request email. Clear the box to stop both.
const DEFAULT_ALPHA_EMAIL = "production@lorenzosdogtrainingteam.com";
// Joshua 2026-09-21: "Every lead, Lorenzo needs an email at the same time the text is fired." On LIVE every Operations
// text also goes to this address as an email (same words + the lead link). The practice copy never uses it: there the
// email twin goes only to practice_email_to.
const DEFAULT_OPERATIONS_EMAIL = "production@lorenzosdogtrainingteam.com, lorenzo@lorenzosdogtrainingteam.com"; // Joshua 2026-09-22: the office inbox AND Lorenzo
// Joshua 2026-09-22 (rule 95): "Make it fully ready for testing everything real in the sandbox with real trainer
// numbers, and still allow me to edit roles if necessary or type a number." The switch below is OFF by default, so
// nothing changes until the office turns it on in Sales -> Text settings & test scenarios.
//   practice_real_numbers = false (today): trainer texts/emails go to the ONE tester phone / practice test address,
//     Operations to practice_operations_phone / practice_email_to. Exactly as before.
//   practice_real_numbers = true (practice copy only): trainer texts go to the assigned trainer's OWN
//     trainers.phone and trainer emails to their portal login email (the same resolution live uses), so trainers
//     can rehearse on their own handsets; Operations falls back to operations_phone / operations_email when they
//     are filled in, else to the practice boxes. The CLIENT text is never freed: it still needs an ACTIVE tester
//     phone, so the practice copy can never text a stranger.
//   practice_trainer_override_phone (optional): every trainer text goes to this ONE number instead, whatever the
//     switch says — for rehearsing the whole trainer chain on a single handset.
// Every number the practice copy texts under these rules is registered as an ACTIVE tester
// (registerTesterPhones), so the Make filters and this file agree about who may be texted.
const DEFAULT_PRACTICE_REAL_NUMBERS = false;
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
const CARE_TEXT = first => `Hi ${first}, thanks for contacting Lorenzo's Dog Training Team. Our office will call you shortly from (866) 436-4959. Reply STOP to opt out.`;
const MAX_AGE_MINUTES = 30; // a lead older than this never starts the pipeline from a browser call
const HOOK_TIMEOUT_MS = 6000;
const OFFICE_PHONE = "(866) 436-4959";

const clean = B.clean;
// Joshua 2026-09-24: CLIENT-facing greetings only - "TIMOTHY" becomes "Timothy", and a field that is not a
// usable greeting ("Larry or Laura", a digit, blank) is dropped so the message opens "Hi there,". Trainer and
// Operations texts keep the stored name untouched: there it names a person to call, it does not greet them.
const clientGreetingName = T.clientGreetingName;
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
  // Joshua 2026-09-21: the Operations email on live (Lorenzo). A row saved before the box existed gets the default.
  // Joshua 2026-09-22: more than one Operations address is allowed, separated by commas (production@ and Lorenzo).
  const liveOpsEmail = value.operations_email === undefined ? DEFAULT_OPERATIONS_EMAIL : clean(value.operations_email, 300).toLowerCase();
  if (liveOpsEmail && !emailListOk(liveOpsEmail)) errors.push(`"${liveOpsEmail}" does not look like an email address (Operations email on live).`);
  // Rule 95. A row saved before the switch existed has no key: it stays OFF, so nothing moves by surprise.
  const realNumbers = value.practice_real_numbers === true || value.practice_real_numbers === "true";
  // Joshua 2026-09-23: the "Automatic follow-ups" master switch. A row saved before the
  // switch existed has no key: it stays OFF, so nothing fires by surprise.
  const autoFollowups = value.auto_followups === true || value.auto_followups === "true";
  const overrideText = clean(value.practice_trainer_override_phone, 40);
  const overridePhone = overrideText ? e164(overrideText) : "";
  if (overrideText && !overridePhone) errors.push("The one-number trainer override needs 10 digits.");
  // Joshua 2026-09-23 (go-live night): while this is true, LIVE trainer email twins are held (skipped with a
  // plain reason) — no trainer inbox gets an email until the office flips it off. A row without the key = off.
  const trainerEmailsHold = value.trainer_emails_hold === true || value.trainer_emails_hold === "true";
  return { errors, value: { recipients, alpha_email: emailOk(alphaEmail) ? alphaEmail : "", practice_trainer_phone: practicePhone, practice_operations_phone: opsPhone, operations_phone: liveOpsPhone, operations_email: emailListOk(liveOpsEmail) ? liveOpsEmail : "", practice_client_phone: clientPhone, practice_email_to: emailOk(practiceEmail) ? practiceEmail : "", practice_real_numbers: realNumbers, practice_trainer_override_phone: overridePhone, auto_followups: autoFollowups, trainer_emails_hold: trainerEmailsHold } };
}

function defaultSettings() {
  return { recipients: DEFAULT_RECIPIENTS.map(r => ({ ...r })), alpha_email: DEFAULT_ALPHA_EMAIL, practice_trainer_phone: DEFAULT_PRACTICE_TRAINER_PHONE, practice_operations_phone: DEFAULT_PRACTICE_OPS_PHONE, operations_phone: "", operations_email: DEFAULT_OPERATIONS_EMAIL, practice_email_to: DEFAULT_PRACTICE_EMAIL_TO, practice_real_numbers: DEFAULT_PRACTICE_REAL_NUMBERS, practice_trainer_override_phone: "", auto_followups: false, trainer_emails_hold: false, saved: false };
}

// Rule 95: is the practice copy allowed to text the REAL trainer numbers right now? Live always answers false,
// so nothing here can change a live send.
function practiceRealNumbers(settings) {
  return isSandbox() && settings?.practice_real_numbers === true;
}

// Rule 95: the typed "send every trainer text to this number instead" override, or "".
function trainerOverridePhone(settings) {
  return isSandbox() ? e164(settings?.practice_trainer_override_phone || "") : "";
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
  // Rule 95: the one-number trainer override, and (with the switch on) the Operations phone the practice copy will
  // actually use, are registered with the three role boxes.
  const wanted = [
    ["trainer", value.practice_trainer_phone],
    ["operations", value.practice_operations_phone],
    ["client", value.practice_client_phone],
    ["trainer", value.practice_trainer_override_phone],
    ...(value.practice_real_numbers === true ? [["operations", value.operations_phone]] : [])
  ];
  return registerTesterPhones(wanted);
}

// The write half of the helper above: [[role, phone], ...] -> an ACTIVE communications_testers row for each.
// Practice copy only; an already-active phone is left alone.
async function registerTesterPhones(pairs) {
  if (!isSandbox()) return;
  const wanted = (Array.isArray(pairs) ? pairs : []).filter(([, p]) => p);
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

// Rule 95: one plain line under the switch, so the office can read who gets what RIGHT NOW without working it out.
// e.g. "Trainer texts -> the trainer's own number. Operations -> ...1234. Client -> tester phones only."
function practiceRecipientSummary(settings) {
  const s = settings || defaultSettings();
  const tail = phone => (e164(phone) ? `...${last4(e164(phone))}` : "");
  const override = e164(s.practice_trainer_override_phone || "");
  const real = s.practice_real_numbers === true;
  const trainer = override
    ? `one number, ${tail(override)} (every trainer text)`
    : real
      ? "the trainer's own number"
      : tail(s.practice_trainer_phone) ? `the test phone ${tail(s.practice_trainer_phone)}` : "nobody (no trainer test phone saved)";
  const opsPhone = (real ? e164(s.operations_phone || "") : "") || e164(s.practice_operations_phone || "");
  const ops = tail(opsPhone) || "nobody (no Operations phone saved)";
  const trainerMail = override || !real ? (maskEmail(s.practice_email_to) || "nobody") : "the trainer's own portal login";
  const opsMail = maskEmail(s.practice_email_to) || "nobody"; // practice copy: never a real inbox (rule 95)
  return `Trainer texts → ${trainer}. Operations → ${ops}. Client → tester phones only. Trainer emails → ${trainerMail}. Operations emails → ${opsMail}.`;
}

// Rule 95: called just before a send, for a number the practice copy is about to text under the real-numbers rules
// (a trainer's own phone, the override, the live Operations phone). Never throws: a failed registration must not
// stop the text, and the code gate for that role does not depend on the tester list.
async function ensureTesterPhones(pairs) {
  if (!isSandbox()) return;
  await registerTesterPhones(pairs).catch(error => console.error("tester_register_failed", String(error?.message || error)));
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
const OFFICE_PLACEHOLDER_PHONE = "+18664364959"; // the shared office toll-free line, never a trainer
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
    // Rule 95, in order: the typed one-number override beats everything; then the real-numbers switch sends to the
    // trainer's OWN phone (same resolution as live); otherwise today's single tester phone from the settings box.
    const override = trainerOverridePhone(settings);
    if (override) return { ok: true, phone: override, reason: "" };
    if (practiceRealNumbers(settings)) {
      const own = e164(trainer?.phone || "");
      if (own) return { ok: true, phone: own, reason: "" };
      const named = clean(trainer?.full_name || lead?.assigned_trainer_name || "", 80);
      return { ok: false, phone: "", reason: `Trainer alert: ${NO_TRAINER_PHONE}${named ? ` (${named})` : ""}.` };
    }
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
  // GO-LIVE 2026-09-23: the shared office line (866) 436-4959 is NOT a trainer's phone. Until the real
  // numbers are loaded into public.trainers, a trainer alert to it is skipped with the plain reason —
  // it must never ring the office toll-free line as if it were the trainer.
  if (phone === OFFICE_PLACEHOLDER_PHONE) {
    const who = clean(trainer?.full_name || lead?.assigned_trainer_name || "", 80);
    return { ok: false, phone: "", reason: `Trainer alert: ${who || "this trainer"} is still on the shared office number — no trainer text until their real number is loaded.` };
  }
  return { ok: true, phone, reason: "" };
}

// Rule 95: the async door every sender uses. It picks the phone with trainerPhoneFor (unchanged shape) and, when
// the practice copy is about to text a REAL number (the switch or the override), registers that number as an ACTIVE
// tester so the Make filter and this code agree. Live: nothing extra happens.
async function trainerTextPhone(lead, trainer, settings, testers = null) {
  const pick = trainerPhoneFor(lead, trainer, settings, testers);
  if (pick.ok && isSandbox() && (trainerOverridePhone(settings) || practiceRealNumbers(settings))) {
    await ensureTesterPhones([["trainer", pick.phone]]);
  }
  return pick;
}

const TRAINER_PHONE_SELECT = "id,slug,full_name,phone,email"; // email: the fallback for the trainer email twin (trainerEmailFor)

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
// Rule 95: with the real-numbers switch on, the practice copy needs the same row live needs (its phone and its
// login email), so the short-circuit only applies while the switch is off.
async function trainerWithPhone(lead, trainer, settings = null) {
  if (isSandbox() && !practiceRealNumbers(settings)) return trainer || null;
  if (trainer && trainer.phone !== undefined) return trainer;
  const loaded = await trainerForLead({ ...(lead || {}), trainer_id: trainer?.id || lead?.trainer_id, trainer_slug: trainer?.slug || lead?.trainer_slug }).catch(() => null);
  return loaded || trainer || null;
}

// ---------------------------------------------------------------------------
// Email twins (Joshua 2026-09-21): "Every lead, Lorenzo needs an email at the same time the text is fired ... with
// the trainer's email used in the portal." Every Operations text and every trainer text ALSO goes out as an email
// with the SAME words (the text in use, rendered by withTextMessages) plus the portal lead link, through Resend only
// (rule 73). The email goes even when the text is skipped (no phone, Make not set). It is sent inside the same
// claimed step as its text (entered_at claim, booking hold claim, first_submitted_at, version-guarded
// eval_completed), once, and Resend's idempotency key `${leadId}:${kind}` (+ `:${hold}` for a booking) makes a
// retry harmless. Recorded on the pipeline record as `<kind>_email` = { kind, status, at, to_masked, resend_id | reason }.
// Recipients:
//   practice copy (LDTT_SANDBOX=1): ONLY Settings -> practice_email_to (the test address). Never Lorenzo, never a trainer.
//   live: Operations -> Settings -> operations_email (default DEFAULT_OPERATIONS_EMAIL); trainer -> the trainer's
//         PORTAL LOGIN email (portal_users, role trainer, active), else trainers.email, else skipped.
// ---------------------------------------------------------------------------
const NO_TRAINER_EMAIL = "trainer has no portal email";
const maskEmail = email => {
  const [user, domain] = String(email || "").split("@");
  return domain ? `${user.slice(0, 2)}***@${domain}` : "";
};
const escHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// "Track 500 · New lead: Pat Client" (the label is the text's own label in the Text messages catalog).
// Rule 96 (Joshua 2026-09-22): the practice copy marks what people RECEIVE only while the real-numbers
// switch is OFF. With the switch ON the practice copy is a dress rehearsal and the words are plain, exactly
// like live. Live never marks anything either way. The machine-readable practice flag in the Make payload
// is untouched by this, so the scenarios can still tell the two apart.
function practiceMarking(settings) {
  return isSandbox() && !practiceRealNumbers(settings);
}
function twinSubject(kind, clientName, settings = null) {
  const label = T.TEXTS.find(t => t.key === kind)?.label || kind;
  return M.track500Subject(`${practiceMarking(settings) ? "[PRACTICE COPY] " : ""}${label}: ${clean(clientName, 120) || "New lead"}`);
}

// THE one email helper. Never throws. On the practice copy it refuses any address that is not practice_email_to.
// `portal`: "trainer" sends the reader to their own trainer portal, anything else to the office /staff
// portal. Joshua 2026-09-23: the trainer's EMAIL twin carried the office link for the same reason the
// text did - both are fixed together, so a trainer never sees /staff by either channel.
async function sendTextTwinEmail({ to, subject, words, leadId, idempotencyKey = "", kind = "", settings = null, config = null, portal = "office" }) {
  const base = { kind, at: now() };
  // One address, or several separated by commas (Operations goes to production@ AND Lorenzo, Joshua 2026-09-22).
  const address = clean(to, 300).toLowerCase();
  const addresses = emailList(address);
  if (!addresses.length || !addresses.every(emailOk)) return { ...base, status: "skipped", reason: "No email address for this text." };
  const toMasked = addresses.map(maskEmail).join(", ");
  // Rule 95: with the real-numbers switch OFF the practice copy still refuses any address but the test address.
  // With it ON the address has already been resolved by opsEmailFor / trainerEmailFor under the same rules.
  const practiceInbox = clean(settings?.practice_email_to, 160).toLowerCase();
  if (isSandbox() && (addresses.length > 1 || addresses[0] !== practiceInbox)) {
    return { ...base, status: "skipped", to_masked: toMasked, reason: "Practice copy: email twins go only to the practice test address." };
  }
  const body = String(words || "").trim();
  if (!body) return { ...base, status: "skipped", to_masked: toMasked, reason: "No words to send." };
  if (!leadId) return { ...base, status: "skipped", to_masked: toMasked, reason: "No lead id: no email." };
  const link = portal === "trainer" ? trainerLeadLink(leadId) : staffLeadLink(leadId);
  // Rule 96: marked while the real-numbers switch is OFF, plain while it is ON.
  const practiceLine = practiceMarking(settings) ? "PRACTICE COPY: the email copy of a practice-copy text, not a real customer." : "";
  const text = [practiceLine, practiceLine ? "" : null, body, "", `Open the lead in the portal: ${link}`].filter(line => line !== null).join("\n").trim();
  const html = `<div style="font:15px/1.5 Arial,sans-serif;color:#111">${practiceLine ? `<p style="font:13px Arial,sans-serif;background:#fff4d6;border:1px solid #e8c66a;padding:8px">${escHtml(practiceLine)}</p>` : ""}<p style="white-space:pre-wrap;margin:0 0 14px">${escHtml(body)}</p><p><a href="${escHtml(link)}" style="display:inline-block;background:#0b2a4a;color:#fff;padding:10px 14px;text-decoration:none;border-radius:4px">Open this lead in the portal</a><br><span style="font-size:12px;color:#555">${escHtml(link)}</span></p></div>`;
  const key = idempotencyKey || `${leadId}:${kind}`;
  try {
    config = config || await M.officeResendConfig();
    const result = await M.sendViaResend({ to: addresses, subject, html, text, idempotencyKey: key }, config);
    if (result.ok) return { ...base, status: "sent", to_masked: toMasked, resend_id: result.id, idempotency_key: key };
    return { ...base, status: result.waiting ? "skipped" : "failed", to_masked: toMasked, reason: clean(result.message, 300), idempotency_key: key };
  } catch (error) {
    return { ...base, status: "failed", to_masked: toMasked, reason: clean(error?.message || error, 300), idempotency_key: key };
  }
}

// The Operations email address: { ok, email, reason }.
// One address or several separated by commas (Joshua 2026-09-22: production@ AND Lorenzo both get the Operations email).
function emailList(value) { return String(value || "").split(",").map(part => part.trim().toLowerCase()).filter(Boolean); }
function emailListOk(value) { const list = emailList(value); return list.length > 0 && list.every(emailOk); }

function opsEmailFor(settings) {
  const s = settings || defaultSettings();
  if (isSandbox()) {
    // Rule 95 (Joshua 2026-09-22, option B): on the practice copy the Operations email ALWAYS goes to the practice
    // test address, switch on or off. Real numbers are for phones; nobody's real inbox gets a rehearsal email.
    const to = clean(s.practice_email_to, 160).toLowerCase();
    return to ? { ok: true, email: to, reason: "" } : { ok: false, email: "", reason: "Practice copy: no practice test address is saved (practice_email_to): no Operations email." };
  }
  const to = clean(s.operations_email === undefined ? DEFAULT_OPERATIONS_EMAIL : s.operations_email, 300).toLowerCase();
  return to ? { ok: true, email: to, reason: "" } : { ok: false, email: "", reason: "No Operations email on live is saved in Settings (operations_email): no Operations email." };
}

// The trainer email address: { ok, email, source, reason }. Same shape of rule as trainerPhoneFor (async: live reads
// the trainer's portal login). Practice copy: practice_email_to only (never the real trainer). Live: the ACTIVE
// portal_users login with role trainer for this trainer_id, else trainers.email, else skipped (NO_TRAINER_EMAIL).
async function trainerEmailFor(lead, trainer, settings) {
  // Rule 95: with the switch on, the practice copy resolves the trainer's own login email the same way live does
  // (the block below). With the switch off: the practice test address only, exactly as before.
  if (isSandbox() && !practiceRealNumbers(settings)) {
    const to = clean(settings?.practice_email_to, 160).toLowerCase();
    return to ? { ok: true, email: to, source: "practice_email_to", reason: "" } : { ok: false, email: "", source: "", reason: "Practice copy: no practice test address is saved (practice_email_to): no trainer email." };
  }
  // Joshua 2026-09-23 (go-live night): the hold switch keeps every LIVE trainer inbox quiet until the office
  // flips it off in the settings row. Checked before any lookup so nothing is even read.
  if (!isSandbox() && settings?.trainer_emails_hold === true) {
    return { ok: false, email: "", source: "", reason: "Trainer emails are held (go-live switch trainer_emails_hold). Flip it off in the pipeline settings row to start them." };
  }
  const who = clean(trainer?.full_name || lead?.assigned_trainer_name || "", 80);
  const none = { ok: false, email: "", source: "", reason: `Trainer email: ${NO_TRAINER_EMAIL}${who ? ` (${who})` : ""}.` };
  const trainerId = clean(trainer?.id || lead?.trainer_id, 80);
  if (trainerId) {
    const rows = await B.sbOrThrow(`/rest/v1/portal_users?select=email&trainer_id=eq.${encodeURIComponent(trainerId)}&role=eq.trainer&active=eq.true&order=created_at.desc&limit=5`).catch(() => []);
    const login = (Array.isArray(rows) ? rows : []).map(r => clean(r?.email, 160).toLowerCase()).find(emailOk);
    if (login) return { ok: true, email: login, source: "portal_users", reason: "" };
  }
  let fallback = trainer?.email;
  if (fallback === undefined && trainerId) {
    const rows = await B.sbOrThrow(`/rest/v1/trainers?id=eq.${encodeURIComponent(trainerId)}&select=email&limit=1`).catch(() => []);
    fallback = rows?.[0]?.email;
  }
  const email = clean(fallback, 160).toLowerCase();
  return email && emailOk(email) ? { ok: true, email, source: "trainers", reason: "" } : none;
}

// A trainer text's email twin. `words` = the rendered trainer_message of the same payload the text uses.
async function trainerTwinEmail(kind, { lead, trainer, settings, words, clientName, idempotencyKey = "" }) {
  try {
    const pick = await trainerEmailFor(lead, trainer, settings);
    if (!pick.ok) return { kind, at: now(), status: "skipped", reason: pick.reason };
    return await sendTextTwinEmail({ to: pick.email, subject: twinSubject(kind, clientName, settings), words, leadId: lead?.id, idempotencyKey, kind, settings, portal: "trainer" });
  } catch (error) {
    return { kind, at: now(), status: "failed", reason: clean(error?.message || error, 300) };
  }
}

// ---------------------------------------------------------------------------
// CLIENT email twins (GO-LIVE 2026-09-23, Joshua + Lorenzo, owner decision).
// POLICY REVERSAL of "no email ever goes to a form submitter": every CLIENT text now also goes to the
// client's OWN email with the same words - a TRANSACTIONAL twin only. There is still no signup /
// activation / verification email, ever, on any submit door (tests/lead-integrity pins that).
// Rules: only when the lead has an email; sent regardless of SMS consent (email is its own channel);
// every client email carries the opt-out line; Resend only (rule 73), one idempotency key per
// lead + kind (+ step / hold), so a client can never get the same email twice. On the PRACTICE copy
// every client email is redirected to Settings -> practice_email_to - never a real address.
const CLIENT_EMAIL_SUBJECTS = {
  booking_link: "Book your free dog training evaluation",
  care_call: "We received your request - our office will call you",
  followup_first: "Can we help with your dog's training?",
  followup_link: "Your free evaluation link",
  unfinished_form: "Finish your free dog training evaluation request",
  reengage_invite: "Ready when you are - book your free evaluation",
  booking_confirmation: "" // built from the booked time by the caller
};
const CLIENT_EMAIL_OPT_OUT = "Reply to this email with STOP and we won't email again.";

// The client's address: live = the lead's own email; practice copy = ONLY the practice test inbox.
function clientEmailFor(lead, settings) {
  if (isSandbox()) {
    const to = clean(settings?.practice_email_to, 160).toLowerCase();
    return to ? { ok: true, email: to, redirected: true, reason: "" } : { ok: false, email: "", redirected: false, reason: "Practice copy: no practice test address is saved (practice_email_to): no client email." };
  }
  const email = clean(lead?.email || rawOf(lead).booking?.client?.email, 160).toLowerCase();
  if (email && emailOk(email)) return { ok: true, email, redirected: false, reason: "" };
  return { ok: false, email: "", redirected: false, reason: "Client email: the lead has no email address." };
}

// One client email. `words` = the same rendered words the text uses; `link` (optional) becomes the red
// button. Never throws; returns the record { kind, status, at, to_masked, resend_id | reason }.
async function clientTwinEmail(kind, { lead, settings = null, words, subject = "", link = "", buttonLabel = "", idempotencyKey = "", config = null }) {
  const base = { kind, at: now() };
  try {
    settings = settings || await loadSettings().catch(() => null);
    const pick = clientEmailFor(lead, settings);
    if (!pick.ok) return { ...base, status: "skipped", reason: pick.reason };
    // Belt and braces: off the practice inbox nothing goes anywhere on the practice copy.
    if (isSandbox() && pick.email !== clean(settings?.practice_email_to, 160).toLowerCase()) {
      return { ...base, status: "skipped", reason: "Practice copy: client emails go only to the practice test address." };
    }
    const body = String(words || "").trim();
    if (!body) return { ...base, status: "skipped", reason: "No words to send." };
    if (!lead?.id) return { ...base, status: "skipped", reason: "No lead id: no email." };
    const subjectLine = `${practiceMarking(settings) ? "[PRACTICE COPY] " : ""}${clean(subject, 200) || CLIENT_EMAIL_SUBJECTS[kind] || "Lorenzo's Dog Training Team"}`;
    const safeLink = /^https:\/\//.test(String(link || "")) ? String(link) : "";
    const practiceLine = practiceMarking(settings) ? "PRACTICE COPY: the email copy of a practice-copy client text, not a real customer send." : "";
    const button = safeLink ? `<p style="margin:16px 0"><a href="${escHtml(safeLink)}" style="display:inline-block;background:#d80f35;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:bold">${escHtml(clean(buttonLabel, 60) || "Book your free evaluation")}</a><br><span style="font-size:12px;color:#555">${escHtml(safeLink)}</span></p>` : "";
    const html = `<div style="font:15px/1.6 Arial,sans-serif;color:#111">${practiceLine ? `<p style="font:13px Arial,sans-serif;background:#fff4d6;border:1px solid #e8c66a;padding:8px">${escHtml(practiceLine)}</p>` : ""}<p style="white-space:pre-wrap;margin:0 0 14px">${escHtml(body)}</p>${button}<p style="margin:14px 0 0">Or call us at (866) 436-4959.</p><p style="margin:14px 0 0;font-weight:bold">Lorenzo's Dog Training Team</p><p style="font-size:12px;color:#777;margin-top:14px">${escHtml(CLIENT_EMAIL_OPT_OUT)}</p></div>`;
    const text = [practiceLine || null, practiceLine ? "" : null, body, safeLink ? `\n${clean(buttonLabel, 60) || "Book here"}: ${safeLink}` : null, "", "Or call us at (866) 436-4959.", "Lorenzo's Dog Training Team", "", CLIENT_EMAIL_OPT_OUT].filter(line => line !== null).join("\n");
    const key = idempotencyKey || `client:${lead.id}:${kind}`;
    config = config || await M.officeResendConfig();
    const result = await M.sendViaResend({ to: [pick.email], subject: subjectLine, html, text, idempotencyKey: key }, config);
    if (result.ok) return { ...base, status: "sent", to_masked: maskEmail(pick.email), resend_id: result.id, idempotency_key: key };
    return { ...base, status: result.waiting ? "skipped" : "failed", to_masked: maskEmail(pick.email), reason: clean(result.message, 300), idempotency_key: key };
  } catch (error) {
    return { ...base, status: "failed", reason: clean(error?.message || error, 300) };
  }
}

// The same words the client's TEXT uses (rule 84 editor words, starting words as the fallback).
async function clientMessageWords(key, payload) {
  let state = null;
  try { state = (await T.load(B.sbOrThrow)).state; } catch { state = null; }
  const saved = T.wordsFor(state, key);
  return T.render(T.check(key, saved).error ? T.wordsFor(null, key) : saved, payload);
}

// Operations alert (Joshua 2026-09-12): Operations (Lorenzo) gets a text when a lead starts its journey and
// when an evaluation is booked. Practice copy only, tester phones only, its own Make scenario (6254549,
// tester filter on every route). The address comes from env LDTT_MAKE_HOOK_OPS (Vercel Preview only).
function opsHookUrl() {
  const url = String(process.env.LDTT_MAKE_HOOK_OPS || "").trim();
  return /^https:\/\/hook\.[a-z0-9.-]+\.make\.com\/[A-Za-z0-9]+$/.test(url) ? url : "";
}

// Every Operations text (new_lead, eval_booked, and closed once it is switched on) AND its email twin (Joshua
// 2026-09-21). Answers the text result with the email result on `.email`; callers record them separately
// (`ops_<stage>` and `ops_<stage>_email`). The email goes even when the text is skipped.
async function sendOpsAlert(stage, fields = {}, { leadId = "", holdId = "" } = {}) {
  const settings = await loadSettings().catch(() => null);
  const text = await sendOpsText(stage, fields, settings)
    .catch(error => ({ stage, at: now(), status: "failed", reason: clean(error?.message || error, 200) }));
  const kind = `ops_${stage}`;
  let email;
  try {
    const pick = opsEmailFor(settings);
    if (!pick.ok) email = { kind, at: now(), status: "skipped", reason: pick.reason };
    else {
      const words = (await withTextMessages({ stage, ...fields })).message;
      email = await sendTextTwinEmail({
        to: pick.email, subject: twinSubject(kind, fields.client_name, settings), words, leadId, kind, settings: settings || defaultSettings(),
        idempotencyKey: leadId ? `${leadId}:${kind}${holdId ? `:${holdId}` : ""}` : ""
      });
    }
  } catch (error) {
    email = { kind, at: now(), status: "failed", reason: clean(error?.message || error, 200) };
  }
  return { ...text, email };
}

async function sendOpsText(stage, fields = {}, settings = null) {
  const base = { stage, at: now() };
  let phone = "";
  if (isSandbox() && practiceRealNumbers(settings)) {
    // Rule 95: the live Operations number when it is filled in, else the practice Operations box. The number is
    // registered as an active tester so the Make filter agrees; the code gate is the typed number itself.
    phone = e164(settings?.operations_phone || "") || e164(settings?.practice_operations_phone ?? DEFAULT_PRACTICE_OPS_PHONE);
    if (!phone) return { ...base, status: "skipped", reason: "No Operations phone saved in Settings." };
    await ensureTesterPhones([["operations", phone]]);
  } else if (isSandbox()) {
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
  // QA 2026-09-23: every live lead so far carries an EMPTY dog_name (283 of 283), so this is the
  // normal case, not an edge case. One house fallback for every text that names the dog, client-
  // facing or trainer-facing, so nobody ever reads "Dog:" with nothing after it or "Maria Alvarez ()".
  payload = { ...payload, dog_name: payload.dog_name || "your dog" };
  // Words that fail the checks (too long, unknown field, only {fields}) are never sent: the starting words go instead.
  const words = key => { const saved = T.wordsFor(state, key); return T.check(key, saved).error ? T.wordsFor(null, key) : saved; };
  if (payload.pathway === "new_lead") return { ...payload, message: T.render(words("booking_link"), payload) };
  // Joshua 2026-09-16: the "Has not booked yet" follow-ups are an office button, not a timer (sendFollowUpText).
  // Joshua 2026-09-23: followup_key "unfinished" is the 30-minute step wearing the "did not finish the
  // form" wording (sendFollowUpText decides). {dog_name} falls back to "your dog", as everywhere else.
  if (payload.pathway === "followup") {
    const key = payload.followup_key === "unfinished" ? "unfinished_form"
      : payload.followup_key === "link" ? "followup_link" : "followup_first";
    return { ...payload, message: T.render(words(key), payload) };
  }
  if (payload.pathway === "booking_confirmed") {
    return { ...payload, customer_message: T.render(words("booking_confirmation"), payload), trainer_message: T.render(words("trainer_new_eval"), payload) };
  }
  if (payload.stage === "new_lead") return { ...payload, message: T.render(words("ops_new_lead"), payload) };
  if (payload.stage === "eval_booked") return { ...payload, message: T.render(words("ops_eval_booked"), payload) };
  // The "Deal closed" Operations text is not switched on yet; when it is, it (and its email twin) use these words.
  if (payload.stage === "closed") return { ...payload, message: T.render(words("ops_closed"), payload) };
  if (payload.pathway === "customer_care") return { ...payload, message: T.render(words("care_call"), payload) };
  // Joshua 2026-09-23 (the 9:30 AM re-engage): the office door + batch runner send the reengage_invite words.
  if (payload.pathway === "reengage") return { ...payload, message: T.render(words("reengage_invite"), payload) };
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
// The client's number the way a person reads it, so a trainer can tap it in the text.
// Ten digits (or eleven starting with 1) print as (216) 555-0123; anything else goes through as typed.
function phoneWords(value) {
  const raw = clean(value, 40);
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : raw;
}

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
    first_name: clientGreetingName(lead.first_name),
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
// Joshua 2026-09-23: "the timer will fire if they filled the first short part of the form but didn't do
// the detailed questions." The short part is the lead record itself - it exists, or there would be no
// lead to follow up. The DETAILED questions are the dog questions on the booking form, and a lead that
// answered them carries at least one dog in raw_payload.booking.dogs. Live proof of the shapes (practice
// leads, 2026-09-23): no `booking` key at all = never opened the form; `booking.intake` with dogs: []
// = opened it, gave the short details, stopped before the dog questions. Both are unfinished.
// A lead that BOOKED never reaches here at all - autoFollowUpDue() drops the whole chain on
// slot_start / requested_at / callback - so this only ever separates unfinished from merely un-booked.
function detailedQuestionsAnswered(lead) {
  const dogs = rawOf(lead).booking?.dogs;
  return Array.isArray(dogs) && dogs.some(dog => dog && (dog.name || dog.breed || dog.behavior));
}

// `auto` = fired by the clock (runAutoFollowUps), not by an office person pressing the button.
// Only the TIMER swaps in the unfinished-form wording: when someone in the office presses "send the
// booking link again" they mean the booking link, and their button must keep saying what it says.
async function sendFollowUpText({ lead, step, auto = false }) {
  // step "care" = the customer-care text "Office will call you" (care_call), also an office button (Joshua 2026-09-16).
  const key = step === "link" ? "link" : step === "care" ? "care" : "tim";
  const base = { pathway: 1, step: key, at: now() };
  const pipeline = rawOf(lead).pipeline && typeof rawOf(lead).pipeline === "object" ? rawOf(lead).pipeline : {};
  const bookUrl = String(pipeline.book_url || (pipeline.trainer_slug ? B.bookUrl(pipeline.trainer_slug, lead.id) : "") || "");
  // Joshua 2026-09-23 (unfinished-form timer). WHICH STEP CARRIES THESE WORDS, and why:
  // the chain stays exactly THREE messages - 15 min, 30 min, 24 h - and never grows a fourth. The
  // 30-minute step is the one whose words change, because its existing wording ("here is your link to
  // book your free evaluation") is the one that misreads for someone who never finished the form; the
  // 15-minute hello from Lorenzo and the 24-hour "our office will call you" suit both readers unchanged.
  // Same STEP name, so the same single version-guarded claim covers it: a lead can never get both
  // wordings, and never the same one twice. {form_link} resolves exactly like the re-engage link
  // (reengageBookingLink): the LIVE ad page for that lead's market with their ZIP prefilled, /book?zip=
  // when no live page is near - so unlike the booking-link wording it is never empty, and this step is
  // no longer skipped for a lead that never got a booking link.
  const unfinished = auto && key === "link" && !detailedQuestionsAnswered(lead);
  const formLink = unfinished ? (await reengageBookingLink(lead).catch(() => null))?.url || `${B.practiceOrigin()}/book` : "";
  // Every text names the dog. The unfinished-form reader is exactly the person who never gave a dog
  // name, so it degrades to the house fallback "your dog" (same as booking_confirmation / reengage_invite)
  // - never "undefined", never a gap, never a raw {dog_name}.
  const dogName = clean(lead?.dog_name || rawOf(lead).booking?.dogs?.[0]?.name, 80) || "your dog";
  const firstName = clientGreetingName(lead?.first_name);
  // GO-LIVE 2026-09-23 (owner decision): each follow-up also goes to the client's own EMAIL with the same
  // words, regardless of SMS consent. One idempotency key per lead + step, so never twice.
  const emailTextKey = unfinished ? "unfinished_form" : key === "link" ? "followup_link" : key === "care" ? "care_call" : "followup_first";
  const clientEmail = (key === "link" && !unfinished && !bookUrl)
    ? { kind: emailTextKey, at: now(), status: "skipped", reason: "No booking link for this lead yet: nothing to send again." }
    : await clientTwinEmail(emailTextKey, {
        lead,
        words: await clientMessageWords(emailTextKey, { first_name: firstName, dog_name: dogName, booking_link: bookUrl, form_link: formLink }),
        link: unfinished ? formLink : key === "link" ? bookUrl : "",
        // The unfinished-form reader is being asked to finish a request, not to book a time.
        buttonLabel: unfinished ? "Pick up where you left off" : "",
        idempotencyKey: key === "care" ? `client:${lead.id}:care_call` : `client:${lead.id}:followup:${key}`
      });
  base.client_email = clientEmail;
  if (lead?.sms_consent !== true) return { ...base, status: "skipped", reason: "No SMS consent: no texts." };
  const client = clientPhoneFor(lead?.phone, isSandbox() ? await activeTesterPhones() : null);
  if (!client.ok) return { ...base, status: "skipped", reason: client.reason };
  const phone = client.phone;
  // The unfinished-form wording always has a link of its own, so only the booking-link wording is
  // skipped when this lead never got a booking link.
  if (key === "link" && !unfinished && !bookUrl) return { ...base, status: "skipped", reason: "No booking link for this lead yet: nothing to send again." };
  if (!hookUrl(1)) return { ...base, status: "skipped", reason: "The Make pathway 1 address is not set on this deployment." };
  const result = await postHook(hookUrl(1), {
    pathway: key === "care" ? "customer_care" : "followup",
    followup_key: unfinished ? "unfinished" : key,
    lead_id: lead.id,
    phone,
    customer_phone: phone,
    first_name: firstName,
    dog_name: dogName,
    booking_link: bookUrl,
    form_link: formLink,
    practice: isSandbox()
  });
  return { ...base, status: result.ok ? "sent" : "failed", to_last4: last4(phone), make_status: result.status, make_answer: result.answer, ...(result.ok ? {} : { reason: `Make answered ${result.status}: ${result.answer}` }) };
}

async function afterFollowUp({ lead, step, by }) {
  const texts = await sendFollowUpText({ lead, step });
  const entry = { step: texts.step, at: texts.at, status: texts.status, by: clean(by, 120) || "", ...(texts.to_last4 ? { to_last4: texts.to_last4 } : {}), ...(texts.reason ? { reason: texts.reason } : {}), ...(texts.client_email ? { client_email: texts.client_email } : {}) };
  await mergePipelineRecord(lead.id, p => ({ ...p, followups: [...(Array.isArray(p.followups) ? p.followups : []), entry].slice(-20) }))
    .catch(error => console.error("pipeline_followup_record_failed", String(error?.message || error)));
  return texts;
}

// ---------------------------------------------------------------------------
// Automatic follow-ups (Joshua 2026-09-23, replacing the manual-only call of 2026-09-16).
// The same three texts the office buttons send, fired by the clock instead:
//   step "tim"  (Lorenzo's follow-up)      15 minutes after the lead entered the pipeline
//   step "link" (the booking link again,   30 minutes after
//                OR "did not finish the
//                form" for a lead that
//                never answered the dog
//                questions - see
//                sendFollowUpText)
//   step "care" (Office will call you)     24 hours after
// THREE messages per lead, never a fourth: the unfinished-form wording REPLACES the 30-minute
// wording for that reader, it is not added to the chain, and it is claimed under the same step name.
// The clock starts at pipeline.entered_at, and a step fires only when the FIRST text
// (new_lead_text) was actually sent - a client who never got the first text gets no
// follow-up chain. Recipient rules are unchanged: sendFollowUpText decides, so the
// practice copy still texts ONLY active tester phones, and consent is rechecked.
//
// Never twice: before sending, the cron CLAIMS the step by appending a followups entry
// through mergePipelineRecord (version-guarded PATCH, same claim pattern as the office
// email flush). A step with ANY recorded entry - a manual button press, an earlier auto
// run, even a lost "sending" claim - is done forever. A lost claim can cost one text;
// it can never double-send one.
// The chain stops when: the lead books or asks for a callback, the office closes the
// lead (CLOSED_STATUSES) or schedules/completes the eval, or the master switch
// (Settings -> auto_followups) is turned off. Leads older than AUTO_FOLLOWUP_MAX_AGE_DAYS
// are left alone, so flipping the switch on never blasts the backlog.
const AUTO_FOLLOWUP_STEPS = [
  { step: "tim", afterMs: 15 * 60 * 1000 },
  { step: "link", afterMs: 30 * 60 * 1000 },
  { step: "care", afterMs: 24 * 60 * 60 * 1000 }
];
const AUTO_FOLLOWUP_MAX_AGE_DAYS = 7;
const CLOSED_STATUSES = new Set(["became_client", "archived", "do_not_contact", "bad_lead", "canceled_refunded", "canceled_write_off",
  "lost_price", "lost_not_ready", "lost_other_provider", "lost_no_response", "lost_complaint", "lost_no_trainer_area",
  "evaluation_scheduled", "evaluation_complete"]);

function autoFollowUpDue(lead, nowMs = Date.now()) {
  const raw = rawOf(lead);
  const pipeline = raw.pipeline && typeof raw.pipeline === "object" ? raw.pipeline : null;
  if (!pipeline?.entered_at) return [];
  if (pipeline.new_lead_text?.status !== "sent") return [];          // no first text -> no chain
  if (lead?.sms_consent !== true) return [];
  if (CLOSED_STATUSES.has(String(lead?.status || ""))) return [];    // office closed it / eval on the books
  const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
  if (booking.slot_start || booking.requested_at || booking.callback) return []; // they booked / asked for a call
  const entered = new Date(pipeline.entered_at).getTime();
  if (!Number.isFinite(entered)) return [];
  if (nowMs - entered > AUTO_FOLLOWUP_MAX_AGE_DAYS * 86400000) return []; // too old: leave the backlog alone
  const done = new Set((Array.isArray(pipeline.followups) ? pipeline.followups : []).map(f => f?.step).filter(Boolean));
  return AUTO_FOLLOWUP_STEPS.filter(s => !done.has(s.step) && nowMs - entered >= s.afterMs).map(s => s.step);
}

async function runAutoFollowUps({ nowMs = Date.now(), limit = 25 } = {}) {
  const settings = await loadSettings().catch(() => null);
  if (settings?.auto_followups !== true) return { on: false, checked: 0, sent: [], skipped: [], message: "Automatic follow-ups are OFF in Settings." };
  const since = new Date(nowMs - AUTO_FOLLOWUP_MAX_AGE_DAYS * 86400000).toISOString();
  const rows = await B.sbOrThrow(
    `/rest/v1/leads?select=${LEAD_SELECT}`
    + `&created_at=gte.${encodeURIComponent(since)}`
    + `&raw_payload->pipeline->>entered_at=not.is.null`
    + `&order=created_at.desc&limit=200`
  );
  const sent = [];
  const skipped = [];
  let checked = 0;
  for (const lead of Array.isArray(rows) ? rows : []) {
    if (sent.length >= limit) break;
    const due = autoFollowUpDue(lead, nowMs);
    if (!due.length) continue;
    checked += 1;
    for (const step of due) {
      // Claim the step first (version-guarded). Whoever appends the entry owns the send.
      let claimed = false;
      const claimedAt = now();
      const saved = await mergePipelineRecord(lead.id, p => {
        claimed = false;
        const list = Array.isArray(p.followups) ? p.followups : [];
        if (list.some(f => f?.step === step)) return p; // a button press or another run got here first
        claimed = true;
        return { ...p, followups: [...list, { step, at: claimedAt, status: "sending", by: "auto" }].slice(-20) };
      }).catch(error => { console.error("auto_followup_claim_failed", String(error?.message || error)); return null; });
      if (!saved || !claimed) { skipped.push({ lead: lead.id, step, reason: "already handled" }); continue; }
      const fresh = saved; // the claim PATCH returned the current row; send off that
      const texts = await sendFollowUpText({ lead: fresh, step, auto: true })
        .catch(error => ({ step, at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
      await mergePipelineRecord(lead.id, p => ({
        ...p,
        followups: (Array.isArray(p.followups) ? p.followups : []).map(f => (f?.step === step && f?.status === "sending"
          ? { step, at: texts.at || claimedAt, status: texts.status, by: "auto", ...(texts.to_last4 ? { to_last4: texts.to_last4 } : {}), ...(texts.reason ? { reason: clean(texts.reason, 300) } : {}), ...(texts.client_email ? { client_email: texts.client_email } : {}) }
          : f))
      })).catch(error => console.error("auto_followup_record_failed", String(error?.message || error)));
      (texts.status === "sent" ? sent : skipped).push({ lead: lead.id, step, status: texts.status, ...(texts.reason ? { reason: texts.reason } : {}) });
    }
  }
  return { on: true, checked, sent, skipped };
}

// ---------------------------------------------------------------------------
// The 9:30 AM re-engage sender (Joshua 2026-09-23). Built ARMED BUT UNAIMED: nothing sends until the
// office arms the site_settings key, and Joshua has not armed it. Two doors:
//   - sendReengageInvite({ lead, by }): ONE lead gets the reengage_invite words (pipeline-texts key
//     "reengage_invite") as a client text (pathway 1, SMS consent only) AND the client email twin
//     (rule 99: regardless of consent, opt-out line, practice copy redirects to practice_email_to).
//     {booking_link} points at the live ad 2.0 page for the lead's local area (/ads/<slug>?zip=<zip>,
//     rule 85 amended 2026-09-23) when one is within 50 miles, else the booking page /book?zip=<zip>.
//     IDEMPOTENT PER LEAD: the send claims raw_payload.pipeline.reengage first (version-guarded), and a
//     lead with ANY reengage record - sent, sending, even a lost claim - is done forever. A lost claim
//     can cost one send; it can never double-send.
//   - runReengageBatch(): the cron checks site_settings key "reengage_batch"
//     {"send_at":"<ISO>","column":"<status>","armed":false}. Only when armed AND now >= send_at does it
//     walk the leads in that status column (test rows held out), sending each once through
//     sendReengageInvite. KILL SWITCH: armed:false or a deleted key stops everything; the runner also
//     DISARMS ITSELF (version-guarded claim on the settings row) BEFORE the first send, so a crash or a
//     second cron can never blast twice, and writes a summary into the same key when it finishes.
// NOTE (no-text night, rule 99): the Make routes are tester-locked. A live send to a non-tester phone is
// accepted by the webhook (200) and then dropped by Make's filter - the runner records what the HOOK
// answered, so "sent" means "Make accepted it", not "a phone rang". Opening the client filters is the
// morning switch, a Make change, never this code.
// ---------------------------------------------------------------------------
const REENGAGE_KEY = "reengage_batch";
const REENGAGE_TEXT_KEY = "reengage_invite";

// The live ad page for each area - the pages running on Facebook today. The 2.0 page slugs name the
// areas, so the slug maps straight to the static page. Keep this in step with the dog-training-*.html files.
const AREA_AD_PAGE = {
  "ann-arbor": "dog-training-ann-arbor-mi",
  "atlanta": "dog-training-atlanta-ga",
  "chicago": "dog-training-chicago-il",
  "cleveland": "dog-training-cleveland-oh",
  "columbus": "dog-training-columbus-oh",
  "lexington": "dog-training-lexington-ky",
  "miramar-beach": "dog-training-miramar-beach-fl",
  "panama-city-beach": "dog-training-panama-city-beach-fl",
  "pensacola": "dog-training-pensacola-fl",
  "san-antonio": "dog-training-san-antonio-tx",
  "san-diego": "dog-training-san-diego-ca",
  "tallahassee": "dog-training-tallahassee-fl"
};

// The lead's local link. The ad 2.0 rows carry a ZIP per area; the nearest area within 50 miles wins,
// and the link sent is that area's LIVE ad page with the lead's ZIP prefilled (assets/v2/v2.js reads
// ?zip=). No area near, or no live page for it = /book?zip=.
//
// `noZip` decides where someone with NO ZIP AT ALL goes. The default "book" is the original behaviour and
// is what the unfinished-form timer still uses (that reader is mid-form; /book is where they left off).
// The re-engage blast passes "contact" — Joshua 2026-09-24: "when we cannot place them, send them to
// Contact Us", because a bare /book with nothing prefilled asks a stranger to start from nothing.
const CONTACT_US_PATH = "/contact"; // the live Contact Us address: 200, no redirect (contact.html 308s to it)

async function reengageBookingLink(lead, { noZip = "book" } = {}) {
  const zip = String(lead?.zip || rawOf(lead).booking?.intake?.zip || "").replace(/\D/g, "").slice(0, 5);
  const origin = B.practiceOrigin();
  if (zip.length !== 5) {
    return noZip === "contact"
      ? { url: `${origin}${CONTACT_US_PATH}`, kind: "contact" }
      : { url: `${origin}/book`, kind: "book" };
  }
  if (centroid(zip)) {
    let best = null;
    try {
      const pages = await B.sbOrThrow("/rest/v1/ad_pages?page_type=eq.ad2&status=eq.published&select=slug,published_content");
      for (const page of Array.isArray(pages) ? pages : []) {
        const pageZip = String(page?.published_content?.zip || "").replace(/\D/g, "").slice(0, 5);
        const miles = pageZip.length === 5 ? milesBetween(zip, pageZip) : null;
        if (!Number.isFinite(miles) || miles > 50) continue;
        if (!best || miles < best.miles) best = { slug: String(page.slug), miles };
      }
    } catch (error) {
      console.error("reengage_ad2_lookup_failed", String(error?.message || error)); // fall through to /book
    }
    // Joshua 2026-09-23: link the REAL ad page for that area (the ones running on Facebook today),
    // NOT the 2.0 page - "they are not done yet". The 2.0 rows are used only to find the nearest
    // area by ZIP; the link that goes out is the live static page. No static page for that area =
    // /book?zip=, never an unfinished 2.0 page.
    const page = best && AREA_AD_PAGE[best.slug];
    if (page) return { url: `${origin}/${page}?zip=${zip}`, kind: "ad_page", slug: best.slug, miles: Math.round(best.miles) };
  }
  return { url: `${origin}/book?zip=${zip}`, kind: "book" };
}

async function sendReengageInvite({ lead, by = "" }) {
  const base = { kind: REENGAGE_TEXT_KEY, at: now() };
  if (!lead?.id) return { ...base, status: "skipped", reason: "No lead." };
  if (rawOf(lead).qa === true) return { ...base, status: "skipped", reason: "Test record." };
  if (rawOf(lead).pipeline?.reengage) return { ...base, status: "skipped", reason: "This lead already got the re-engage invite. It never goes twice." };
  // Claim first (version-guarded): whoever writes pipeline.reengage owns this send, forever.
  let claimed = false;
  const saved = await mergePipelineRecord(lead.id, p => {
    claimed = false;
    if (p.reengage) return p;
    claimed = true;
    return { ...p, reengage: { status: "sending", at: base.at, by: clean(by, 120) } };
  }).catch(error => { console.error("reengage_claim_failed", String(error?.message || error)); return null; });
  if (!saved || !claimed) return { ...base, status: "skipped", reason: "This lead already got the re-engage invite. It never goes twice." };

  // Joshua 2026-09-24: no ZIP = Contact Us, never a bare /book with nothing prefilled.
  const link = await reengageBookingLink(lead, { noZip: "contact" });
  const firstName = clientGreetingName(lead.first_name);
  // The words no longer name the dog, and {dog_name} is no longer one of this text's declared fields, so a
  // template that still used it would fail check() and the starting words would go instead. The value is
  // still carried in the payload (harmless: render only substitutes fields the words actually contain).
  const dogName = clean(lead.dog_name || rawOf(lead).booking?.dogs?.[0]?.name, 80) || "your dog";
  const words = await clientMessageWords(REENGAGE_TEXT_KEY, { first_name: firstName, dog_name: dogName, booking_link: link.url });

  // Email twin (rule 99): the lead's own email, regardless of SMS consent, opt-out line, one idempotency
  // key per lead. The practice copy redirects every client email to Settings -> practice_email_to.
  const clientEmail = await clientTwinEmail(REENGAGE_TEXT_KEY, {
    lead, words, link: link.url, idempotencyKey: `client:${lead.id}:${REENGAGE_TEXT_KEY}`
  });

  // The text: SMS consent only, pathway 1, tester rules unchanged (clientPhoneFor).
  let text;
  if (lead.sms_consent !== true) {
    text = { status: "skipped", reason: "No SMS consent: no text." };
  } else {
    const pick = clientPhoneFor(lead.phone, isSandbox() ? await activeTesterPhones() : null);
    if (!pick.ok) text = { status: "skipped", reason: pick.reason };
    else if (!hookUrl(1)) text = { status: "skipped", reason: "The Make pathway 1 address is not set on this deployment." };
    else {
      const result = await postHook(hookUrl(1), {
        pathway: "reengage", lead_id: lead.id, phone: pick.phone, customer_phone: pick.phone,
        first_name: firstName, dog_name: dogName, booking_link: link.url, practice: isSandbox()
      });
      // "sent" ONLY on a 200 from the hook. Make's tester filters may still drop it after accepting.
      text = result.ok
        ? { status: "sent", to_last4: last4(pick.phone), make_status: result.status }
        : { status: "failed", to_last4: last4(pick.phone), make_status: result.status, reason: `Make answered ${result.status}: ${result.answer}` };
    }
  }

  const record = { status: text.status === "sent" || clientEmail.status === "sent" ? "sent" : "skipped",
    at: base.at, by: clean(by, 120), link: link.url, link_kind: link.kind, text, client_email: clientEmail };
  await mergePipelineRecord(lead.id, p => ({ ...p, reengage: { ...(p.reengage && typeof p.reengage === "object" ? p.reengage : {}), ...record } }))
    .catch(error => console.error("reengage_record_failed", String(error?.message || error)));
  return { ...base, ...record };
}

function normalizeReengageBatch(value) {
  const v = value && typeof value === "object" ? value : {};
  const sendAt = Date.parse(String(v.send_at || ""));
  // Joshua 2026-09-23: only leads from the LAST 60 DAYS may ever get the blast. 60 is the
  // default and the ceiling - a stored number can narrow the window, never widen it.
  const maxAge = Number(v.max_age_days);
  // Joshua 2026-09-24: the batch may walk MORE THAN ONE status column in a single armed run. `columns` is
  // the list; the old single `column` string still works exactly as before, so a key written by the old
  // office screen (or the one sitting on live right now) keeps its meaning. Order is kept, blanks and
  // duplicates dropped, and `column` in the answer stays the FIRST column so every existing reader
  // (the office screen, the summary, the tests) still sees a string where it expects one.
  const listed = Array.isArray(v.columns) ? v.columns : (v.columns ? [v.columns] : []);
  const columns = [...new Set(
    [...listed, v.column].map(c => clean(c, 60).toLowerCase().replace(/[^a-z_]/g, "")).filter(Boolean)
  )].slice(0, 10);
  return {
    armed: v.armed === true,
    columns,
    column: columns[0] || "",
    send_at: Number.isFinite(sendAt) ? new Date(sendAt).toISOString() : "",
    max_age_days: Number.isFinite(maxAge) && maxAge >= 1 && maxAge <= 60 ? Math.floor(maxAge) : 60,
    last_run: v.last_run && typeof v.last_run === "object" ? v.last_run : null
  };
}

// One person, one message, across the WHOLE batch (Joshua 2026-09-24). Per-lead idempotency stops the same
// LEAD ROW twice; it cannot see that two rows are the same human. Two rows sharing an email address or a
// phone number are one person, so the second row is passed over untouched - NOT claimed, NOT marked sent,
// so the office can still reach them by hand later. Live example: two `Steven` rows, one aol.com address.
function personKeys(lead) {
  const keys = [];
  const email = clean(lead?.email || rawOf(lead).booking?.client?.email, 160).toLowerCase();
  if (email && emailOk(email)) keys.push(`e:${email}`);
  const digits = String(lead?.phone || "").replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (ten.length === 10) keys.push(`p:${ten}`);
  return keys;
}

// When two rows ARE the same person, the one we keep is the one that can actually carry the message: a
// textable phone with consent first, then a ZIP (which is what earns them their own market's page instead
// of Contact Us), then an email address. Live example: Steven's two rows are 45 seconds apart, and only the
// SECOND one has a phone, consent and a ZIP - walking order alone would have kept the emptier one.
function reengageRichness(lead) {
  const digits = String(lead?.phone || "").replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  const email = clean(lead?.email || rawOf(lead).booking?.client?.email, 160).toLowerCase();
  return (lead?.sms_consent === true && ten.length === 10 ? 4 : 0)
    + (String(lead?.zip || "").replace(/\D/g, "").length >= 5 ? 2 : 0)
    + (email && emailOk(email) ? 1 : 0);
}

// Group the walked rows by person and choose one row from each group. Returns the Set of lead ids to send
// to, plus, for every row passed over, which twin it matched and on what. Nothing is written by this: a
// passed-over row is simply never handed to sendReengageInvite, so it keeps a clean record.
function dedupeByPerson(rows) {
  const groupOf = new Map(); // key -> group index
  const groups = [];
  for (const lead of rows) {
    const keys = personKeys(lead);
    const hits = [...new Set(keys.map(k => groupOf.get(k)).filter(i => i !== undefined))];
    let index;
    if (!hits.length) { index = groups.length; groups.push([]); }
    else {
      index = hits[0];
      for (const other of hits.slice(1)) { // this row bridges two groups: fold them together
        groups[index].push(...groups[other]);
        groups[other] = [];
        for (const [k, v] of groupOf) if (v === other) groupOf.set(k, index);
      }
    }
    groups[index].push(lead);
    for (const k of keys) groupOf.set(k, index);
  }
  const keep = new Set();
  const passed = new Map(); // lead id -> "email" | "phone"
  for (const group of groups) {
    if (!group.length) continue;
    const winner = group.reduce((best, lead) => (reengageRichness(lead) > reengageRichness(best) ? lead : best), group[0]);
    keep.add(winner.id);
    const winnerKeys = new Set(personKeys(winner));
    for (const lead of group) {
      if (lead.id === winner.id) continue;
      passed.set(lead.id, personKeys(lead).some(k => k.startsWith("e:") && winnerKeys.has(k)) ? "email" : "phone");
    }
  }
  return { keep, passed };
}

async function runReengageBatch({ nowMs = Date.now(), limit = 200 } = {}) {
  let row;
  try {
    row = (await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${REENGAGE_KEY}&select=key,value,updated_at&limit=1`))?.[0] || null;
  } catch (error) {
    return { armed: false, message: `The re-engage settings could not be read: ${clean(error?.message || error, 200)}` };
  }
  if (!row) return { armed: false, message: "No reengage_batch key: nothing to do (kill switch)." };
  const batch = normalizeReengageBatch(row.value);
  if (!batch.armed) return { armed: false, message: "reengage_batch is not armed." };
  if (!batch.columns.length) return { armed: false, message: "reengage_batch has no column: nothing sent." };
  if (!batch.send_at || nowMs < Date.parse(batch.send_at)) return { armed: true, waiting: true, message: `Armed, waiting for ${batch.send_at || "a send_at time"}.` };

  // DISARM FIRST (version-guarded on updated_at): the claim IS the kill switch. A crash after this point
  // leaves the batch disarmed; per-lead idempotency covers a partial run being re-armed by hand.
  const claim = await B.sbOrThrow(
    `/rest/v1/site_settings?key=eq.${REENGAGE_KEY}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,
    { method: "PATCH", prefer: "return=representation", body: { value: { ...row.value, armed: false, status: "running", run_started_at: now() } } }
  ).catch(() => null);
  if (!claim?.[0]) return { armed: true, message: "Another run claimed this batch first. Nothing sent here." };

  // Rule from Joshua 2026-09-23: the blast only ever reaches leads from the last 60 days
  // (or fewer when max_age_days narrows it). Older leads never get a message.
  const oldest = new Date(nowMs - batch.max_age_days * 24 * 60 * 60 * 1000).toISOString();

  // Walk EVERY armed column, in the order they were armed. Each column keeps its own 60-day window query
  // and its own limit, exactly as the single-column walk did.
  const rows = [];
  const perColumn = {};
  for (const column of batch.columns) {
    const got = await B.sbOrThrow(
      `/rest/v1/leads?status=eq.${encodeURIComponent(column)}&created_at=gte.${encodeURIComponent(oldest)}&select=${LEAD_SELECT}&order=created_at.desc&limit=${limit}`
    ).catch(() => []);
    const list = Array.isArray(got) ? got : [];
    perColumn[column] = list.length;
    rows.push(...list);
  }

  const sent = [];
  const skipped = [];
  // One person, one message, across the WHOLE batch - decided before a single send goes out.
  const { keep, passed } = dedupeByPerson(rows);
  for (const lead of rows) {
    if (!keep.has(lead.id)) {
      // Passed over WITHOUT claiming: nothing is written to this lead, so it stays reachable by hand.
      skipped.push({ lead: lead.id, status: "skipped", reason: `Same person as another lead in this batch (deduped by ${passed.get(lead.id) || "person"}).` });
      continue;
    }
    const result = await sendReengageInvite({ lead, by: "reengage_batch" })
      .catch(error => ({ status: "failed", reason: clean(error?.message || error, 200) }));
    (result.status === "sent" ? sent : skipped).push({
      lead: lead.id, status: result.status,
      ...(result.text?.status ? { text: result.text.status } : {}),
      ...(result.client_email?.status ? { email: result.client_email.status } : {}),
      ...(result.reason ? { reason: clean(result.reason, 160) } : {})
    });
  }
  const summary = {
    at: now(), column: batch.column, columns: batch.columns, per_column: perColumn,
    send_at: batch.send_at, walked: rows.length,
    deduped: skipped.filter(s => /deduped by/.test(s.reason || "")).length,
    sent: sent.length, texts_sent: sent.filter(s => s.text === "sent").length + skipped.filter(s => s.text === "sent").length,
    emails_sent: sent.filter(s => s.email === "sent").length + skipped.filter(s => s.email === "sent").length,
    skipped: skipped.length, details: [...sent, ...skipped].slice(0, 250)
  };
  // Keep everything the key was carrying (the note, max_age_days, anything the office added) and change
  // only what this run decided. The old write replaced the whole value and quietly dropped those.
  await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${REENGAGE_KEY}`, {
    method: "PATCH", prefer: "return=minimal",
    body: { value: { ...(row.value && typeof row.value === "object" ? row.value : {}), armed: false, column: batch.column, columns: batch.columns, send_at: batch.send_at, status: "done", run_started_at: undefined, last_run: summary } }
  }).catch(error => console.error("reengage_summary_write_failed", String(error?.message || error)));
  return { armed: true, ran: true, ...summary };
}

// Lane office_call: the short customer-care text. Since 2026-09-14 pathway 1's Make scenario sends exactly
// `{{1.message}}` (its only filter is the phone tester filter, no pathway filter), and withTextMessages() fills
// `message` with the care_call words for pathway "customer_care" — the same way the office's care button
// (sendFollowUpText step "care") already sends it. So: its own route when LDTT_MAKE_HOOK_CARE is set, else the
// pathway 1 hook (2026-09-22). Tester rules on the practice copy are unchanged (clientPhoneFor).
function careHookUrl() {
  const url = String(process.env.LDTT_MAKE_HOOK_CARE || "").trim();
  return /^https:\/\/hook\.[a-z0-9.-]+\.make\.com\/[A-Za-z0-9]+$/.test(url) ? url : hookUrl(1);
}

function careTextPlan({ lead, testers }) {
  if (lead?.sms_consent !== true) return { send: false, reason: "No SMS consent: no texts." };
  const client = clientPhoneFor(lead.phone, testers);
  if (!client.ok) return { send: false, reason: client.reason };
  if (!careHookUrl()) return { send: false, reason: "The Make pathway 1 address is not set on this deployment: the customer-care text was not sent." };
  return { send: true, phone: client.phone };
}

async function sendCareText({ lead, phone }) {
  const first = clientGreetingName(lead.first_name);
  const result = await postHook(careHookUrl(), { pathway: "customer_care", lead_id: lead.id, phone, customer_phone: phone, first_name: first, message: CARE_TEXT(first), practice: isSandbox() });
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

// Joshua 2026-09-23: a TRAINER must land in their OWN portal, never the office one. Until today every
// trainer text carried staffLeadLink() - the /staff office portal - so a trainer tapping their alert
// was sent to the office door and (their role having no "leads" screen) dropped on their Dashboard
// with no lead in sight. The trainer portal is the same app on its own path, so the same deep-link
// shape works: trainer-backoffice/app.js applyUrlState() reads ?view= and ?lead= at load, before the
// sign-in box, so the lead survives the login and the Lead Pipeline drawer opens on it.
// OFFICE and OPERATIONS texts keep staffLeadLink() - Lorenzo and the office DO want /staff.
function trainerLeadLink(leadId) {
  return `${B.practiceOrigin()}/trainer-backoffice?view=leadPipeline&lead=${encodeURIComponent(leadId)}`;
}

// Pathway 2: customer confirmation + trainer alert in ONE Make run; the Make filters drop whichever
// phone is empty (practice copy: or not a tester). Who gets which phone: clientPhoneFor / trainerPhoneFor above.
async function sendBookingTexts({ lead, booking, trainer, setting, settings }) {
  const base = { pathway: 2, at: now() };
  const testers = isSandbox() ? await activeTesterPhones() : null;
  const customerPick = lead?.sms_consent === true ? clientPhoneFor(booking?.client?.phone || lead?.phone, testers) : { ok: false, phone: "", reason: "" };
  const trainerRow = await trainerWithPhone(lead, trainer, settings);
  const trainerPick = await trainerTextPhone(lead, trainerRow, settings, testers);
  const customer = customerPick.phone;
  const trainerPhone = trainerPick.phone;
  const customerOk = customerPick.ok;
  const trainerOk = trainerPick.ok;
  const notes = [];
  if (lead?.sms_consent !== true) notes.push("Customer: no SMS consent, no customer text.");
  else if (!customerOk) notes.push(customer ? `Customer: ...${last4(customer)} is not an active tester phone.` : "Customer: no textable phone.");
  if (!trainerOk) notes.push(trainerPick.reason);
  const tz = booking?.local_time_zone || booking?.time_zone || setting?.time_zone || "America/New_York"; // rule 86
  const parts = slotParts(booking.slot_start, tz);
  const dogs = Array.isArray(booking?.dogs) ? booking.dogs : [];
  const client = booking?.client || {};
  const behaviors = dogs.map(d => d.behavior).filter(Boolean).join(" / ");
  const payload = {
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
    trainer_portal_link: trainerLeadLink(lead.id),
    link: staffLeadLink(lead.id),
    practice: isSandbox()
  };
  // The trainer text's email twin (trainer_new_eval): same words, sent even when the text is skipped.
  const rendered = await withTextMessages(payload);
  const email = await trainerTwinEmail("trainer_new_eval", {
    lead, trainer: trainerRow, settings, words: rendered.trainer_message, clientName: payload.client_name,
    idempotencyKey: `${lead.id}:trainer_new_eval${booking?.hold_id ? `:${booking.hold_id}` : ""}`
  });
  // GO-LIVE 2026-09-23 (owner decision): the client's confirmation EMAIL - same words as the confirmation
  // text, to the client's own address, regardless of SMS consent. Once per booking (hold id in the key).
  const clientEmail = await clientTwinEmail("booking_confirmation", {
    lead, settings,
    words: rendered.customer_message,
    subject: `You're confirmed: ${parts.day}, ${parts.date} at ${parts.time}`,
    link: payload.pre_eval_link,
    idempotencyKey: `client:${lead.id}:booking_confirmation${booking?.hold_id ? `:${booking.hold_id}` : ""}`
  });
  if (!customerOk && !trainerOk) return { ...base, status: "skipped", reason: notes.join(" "), email, client_email: clientEmail };
  const url = hookUrl(2);
  if (!url) return { ...base, status: "skipped", reason: "The Make pathway 2 address is not set on this deployment.", email, client_email: clientEmail };
  const result = await postHook(url, payload);
  return {
    ...base,
    status: result.ok ? "sent" : "failed",
    customer_last4: customerOk ? last4(customer) : "",
    trainer_last4: trainerOk ? last4(trainerPhone) : "",
    notes: notes.join(" "),
    make_status: result.status,
    make_answer: result.answer,
    email,
    client_email: clientEmail
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
  const trainerRow = await trainerWithPhone(lead, null, settings);
  const trainerPick = await trainerTextPhone(lead, trainerRow, settings, isSandbox() ? await activeTesterPhones() : null);
  const trainerPhone = trainerPick.ok ? trainerPick.phone : "";
  const raw = lead?.raw_payload && typeof lead.raw_payload === "object" ? lead.raw_payload : {};
  const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
  const pre = booking.pre_eval && typeof booking.pre_eval === "object" ? booking.pre_eval : {};
  const client = booking.client || {};
  let parts = { day: "", date: "", time: "" };
  try { if (booking.slot_start) parts = slotParts(booking.slot_start, booking.local_time_zone || booking.time_zone || "America/New_York"); } catch { /* keep blanks */ }
  const flags = Array.isArray(pre.flags) ? pre.flags : [];
  const payload = {
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
    trainer_portal_link: trainerLeadLink(lead.id),
    practice: isSandbox()
  };
  // The email twin (pre_eval_answers): same words, sent even when the text is skipped.
  const email = await trainerTwinEmail("pre_eval_answers", {
    lead, trainer: trainerRow, settings, words: (await withTextMessages(payload)).trainer_message,
    clientName: [payload.first_name, payload.last_name].filter(Boolean).join(" ")
  });
  if (!trainerPick.ok) return { ...base, status: "skipped", reason: trainerPick.reason, email };
  const url = hookUrl(2);
  if (!url) return { ...base, status: "skipped", reason: "The Make pathway 2 address is not set on this deployment.", email };
  const result = await postHook(url, payload);
  return { ...base, status: result.ok ? "sent" : "failed", trainer_last4: last4(trainerPhone), make_status: result.status, make_answer: result.answer, email };
}

// Joshua 2026-09-16: when the trainer marks Eval completed, the trainer gets "log the deal in the portal" (Make
// pathway 2, trainer branch only, tester phones only on the practice copy — same doors as sendPreEvalTexts).
async function sendEvalCompletedTexts({ lead }) {
  const base = { kind: "trainer_log_deal", at: now() };
  const settings = await loadSettings().catch(() => null);
  const trainerRow = await trainerWithPhone(lead, null, settings);
  const trainerPick = await trainerTextPhone(lead, trainerRow, settings, isSandbox() ? await activeTesterPhones() : null);
  const trainerPhone = trainerPick.ok ? trainerPick.phone : "";
  const raw = lead?.raw_payload && typeof lead.raw_payload === "object" ? lead.raw_payload : {};
  const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
  const client = booking.client || {};
  const payload = {
    pathway: "eval_completed",
    lead_id: lead.id,
    customer_phone: "", // trainer only
    trainer_phone: trainerPhone,
    first_name: clean(client.first_name || lead.first_name, 80),
    last_name: clean(client.last_name || lead.last_name, 80),
    dog_name: clean(client.dog_name || lead.dog_name || raw.dog_name, 80),
    trainer_portal_link: trainerLeadLink(lead.id),
    practice: isSandbox()
  };
  // The email twin (trainer_log_deal): same words, sent even when the text is skipped.
  const email = await trainerTwinEmail("trainer_log_deal", {
    lead, trainer: trainerRow, settings, words: (await withTextMessages(payload)).trainer_message,
    clientName: [payload.first_name, payload.last_name].filter(Boolean).join(" ")
  });
  if (!trainerPick.ok) return { ...base, status: "skipped", reason: trainerPick.reason, email };
  const url = hookUrl(2);
  if (!url) return { ...base, status: "skipped", reason: "The Make pathway 2 address is not set on this deployment.", email };
  const result = await postHook(url, payload);
  return { ...base, status: result.ok ? "sent" : "failed", trainer_last4: last4(trainerPhone), make_status: result.status, make_answer: result.answer, email };
}

// Joshua 2026-09-17: the trainer gets a text at the NEW INQUIRY stage, when a lead is routed to their calendar
// (enterPipeline, right after the Operations new-lead alert). Pathway 2 hook, trainer branch only (customer_phone
// stays empty); the phone comes from trainerPhoneFor (practice copy = tester phone, live = trainer.phone).
async function sendNewInquiryText({ lead, trainer, bookUrl }) {
  const base = { kind: "trainer_new_inquiry", at: now() };
  if (!bookUrl || !trainer) return { ...base, status: "skipped", reason: "No calendar trainer for this lead: no trainer text.", email: { kind: "trainer_new_inquiry", at: now(), status: "skipped", reason: "No calendar trainer for this lead: no trainer email." } };
  const settings = await loadSettings().catch(() => null);
  const trainerRow = await trainerWithPhone(lead, trainer, settings);
  const trainerPick = await trainerTextPhone(lead, trainerRow, settings, isSandbox() ? await activeTesterPhones() : null);
  const trainerPhone = trainerPick.ok ? trainerPick.phone : "";
  const payload = {
    pathway: "new_inquiry",
    lead_id: lead.id,
    customer_phone: "", // trainer only
    trainer_phone: trainerPhone,
    first_name: clean(lead.first_name, 80),
    last_name: clean(lead.last_name, 80),
    zip: clean(lead.zip, 10),
    // Joshua 2026-09-23: the trainer's new-inquiry text shows the CLIENT'S PHONE NUMBER so they can
    // call straight away. zip stays filled for any older wording that still asks for it.
    phone: phoneWords(lead.phone),
    problem: problemWords(lead),
    trainer_name: trainer?.full_name || "",
    booking_link: bookUrl,
    trainer_portal_link: trainerLeadLink(lead.id),
    practice: isSandbox()
  };
  // The email twin (trainer_new_inquiry): same words, sent even when the text is skipped.
  const email = await trainerTwinEmail("trainer_new_inquiry", {
    lead, trainer: trainerRow, settings, words: (await withTextMessages(payload)).trainer_message,
    clientName: [payload.first_name, payload.last_name].filter(Boolean).join(" ")
  });
  if (!trainerPick.ok) return { ...base, status: "skipped", reason: trainerPick.reason, email };
  const url = hookUrl(2);
  if (!url) return { ...base, status: "skipped", reason: "The Make pathway 2 address is not set on this deployment.", email };
  const result = await postHook(url, payload);
  return { ...base, status: result.ok ? "sent" : "failed", trainer_last4: last4(trainerPhone), make_status: result.status, make_answer: result.answer, ...(result.ok ? {} : { reason: `Make answered ${result.status}: ${result.answer}` }), email };
}

async function afterEvalCompleted({ lead }) {
  // Called once per version-guarded eval_completed change: the text + its email twin (trainer_log_deal).
  const { email, ...texts } = await sendEvalCompletedTexts({ lead })
    .catch(error => ({ kind: "trainer_log_deal", at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
  await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, eval_completed_text: texts, ...(email ? { trainer_log_deal_email: email } : {}) }))
    .catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  console.log("pipeline_after_eval_completed", JSON.stringify({ lead: lead.id, texts: texts.status }));
  return { texts };
}

async function afterPreEval({ lead }) {
  // Called only on the FIRST submit (api/booking.js first_submitted_at): the text + its email twin (pre_eval_answers).
  const { email, ...texts } = await sendPreEvalTexts({ lead })
    .catch(error => ({ kind: "pre_eval_answers", at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
  await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, pre_eval_text: texts, ...(email ? { pre_eval_answers_email: email } : {}) }))
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
  // GO-LIVE 2026-09-23: office emails send on live too (Resend only, rule 73; recipients from the public settings row).
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
    // Rule 96: `practice` here is the MARKING flag only (subject prefix + the yellow notice). Where the email
    // GOES is decided by emailRecipients(settings, isSandbox(), ...) above and never changes with the switch.
    const email = M.buildBookingEmail({ lead, booking: current, trainerName: current.trainer_name, staffLink: staffLeadLink(lead.id), lane, practice: practiceMarking(settings), redirectedFrom, kind: notice.kind || "", pipeline });
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
  // GO-LIVE 2026-09-23: queued office emails drain on live too (Resend only, rule 73).
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
  // Inside the hold claim above: the trainer text + its email twin (trainer_new_eval) go once per booking.
  const { email: trainerEmail, ...texts } = await sendBookingTexts({ lead, booking, trainer, setting, settings })
    .catch(error => ({ pathway: 2, at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
  try {
    await mergePipelineRecord(lead.id, pipeline => ({
      ...pipeline,
      ...(trainerEmail ? { trainer_new_eval_email: trainerEmail } : {}),
      booking_notices: (Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : []).map(n => (n.hold_id === holdId ? { ...n, texts, ...(trainerEmail ? { trainer_email: trainerEmail } : {}) } : n))
    }));
  } catch (error) {
    console.error("pipeline_record_failed", String(error?.message || error));
  }
  let slot = { day: "", date: "", time: "" };
  try { slot = slotParts(booking?.slot_start, booking?.local_time_zone || booking?.time_zone || setting?.time_zone || "America/New_York"); } catch { /* keep blanks */ }
  const { email: opsBookedEmail, ...opsBooked } = await sendOpsAlert("eval_booked", {
    client_name: [booking?.client?.first_name || lead.first_name, booking?.client?.last_name || lead.last_name].filter(Boolean).join(" "),
    trainer_name: trainer?.full_name || booking?.trainer_name || "",
    appointment_day: slot.day, appointment_date: slot.date, appointment_time: slot.time,
    link: staffLeadLink(lead.id)
  }, { leadId: lead.id, holdId: holdId || "" }).catch(error => ({ stage: "eval_booked", at: now(), status: "failed", reason: clean(error?.message || error, 200) }));
  await mergePipelineRecord(lead.id, pipeline => ({
    ...pipeline,
    ...(opsBookedEmail ? { ops_eval_booked_email: opsBookedEmail } : {}),
    booking_notices: (Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : []).map(n => (n.hold_id === holdId ? { ...n, ops_alert: opsBooked, ...(opsBookedEmail ? { ops_alert_email: opsBookedEmail } : {}) } : n))
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
const LEAD_SELECT = "id,version,created_at,first_name,last_name,dog_name,phone,email,zip,sms_consent,trainer_slug,assigned_trainer_name,comments,address_line_1,city,state,service_interest,status,source_page,raw_payload";

function alreadyBody(lead, pipeline) {
  return { ok: true, lead_id: lead.id, trainer_slug: pipeline.trainer_slug || null, book_url: pipeline.book_url || null, texted: pipeline.new_lead_text?.status === "sent", already: true };
}

// A lead a form already saved (submit-contact on the practice copy, or /api/booking-lead) enters the
// one pipeline. Order: route -> decide the text -> CLAIM (version-guarded PATCH that stamps
// pipeline.entered_at) -> send only if this call won the claim -> record the result. So a double click,
// a retry or two pages calling at once can never text twice.

// The trainer who owns an ad page 2.0 (content key "owner_slug"). Used only when the lead came from /ads/<slug>.
// Returns { setting, card } when that trainer has a live calendar and is within the radius of the lead's ZIP.
async function adPageOwner(lead, settings) {
  const from = clean(rawOf(lead).source_page || lead.source_page || "", 300).toLowerCase();
  const match = from.match(/(?:^|\/)ads(?:-v2)?\/([a-z0-9-]{2,60})/) || from.match(/ldtt-ads-v2\/([a-z0-9-]{2,60})/);
  if (!match) return null;
  const rows = await B.sbOrThrow(`/rest/v1/ad_pages?slug=eq.${encodeURIComponent(match[1])}&select=published_content,draft_content&limit=1`);
  const row = Array.isArray(rows) ? rows[0] : null;
  const ownerSlug = clean(row?.published_content?.owner_slug || row?.draft_content?.owner_slug || "", 80).toLowerCase();
  if (!ownerSlug) return null;
  const setting = B.settingBySlug(settings, ownerSlug);
  if (!setting) return null;
  const route = await B.routeZip(lead.zip, settings).catch(() => ({ cards: [] }));
  const card = (route.cards || []).find(c => c.slug === ownerSlug) || null;
  return card ? { setting, card } : null;
}

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
  const owner = pageSlug ? null : await adPageOwner(lead, settings).catch(() => null);
  if (pageSlug) {
    setting = B.settingBySlug(settings, pageSlug);
    if (!setting) routeNote = "This trainer does not take online bookings yet: office follow-up, no text.";
  } else if (owner) {
    // Joshua 2026-09-22: an ad page 2.0 belongs to its market's trainer. The first text goes to them, even when
    // another trainer sits closer to the client's ZIP. The booking page still shows every trainer in range, so
    // the client can still pick somebody else.
    setting = owner.setting;
    nearest = owner.card || null;
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
  // GO-LIVE 2026-09-23 (owner decision): the client's booking-link EMAIL twin - same words as the text,
  // to the lead's own address, regardless of SMS consent, only when a booking link exists. Once per lead.
  if (bookUrl) {
    const clientEmail = await clientTwinEmail("booking_link", {
      lead: won,
      words: await clientMessageWords("booking_link", { first_name: clientGreetingName(won.first_name), problem: problemWords(won), booking_link: bookUrl }),
      link: bookUrl,
      idempotencyKey: `client:${lead.id}:booking_link`
    });
    await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, new_lead_client_email: clientEmail }))
      .catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  }
  console.log("pipeline_enter", JSON.stringify({ lead: lead.id, via, trainer: routed?.slug || null, text: text.status }));
  // Inside the entered_at claim above: the Operations text + its email twin go once per lead.
  const { email: opsNewEmail, ...opsNew } = await sendOpsAlert("new_lead", {
    client_name: [won.first_name, won.last_name].filter(Boolean).join(" ") || "New lead",
    zip: clean(won.zip, 10),
    problem: problemWords(won),
    source: sourceWords(lead, via, pageSlug ? trainer : null),
    next_step: bookUrl ? (text.status === "sent" ? "Booking link texted." : "Booking link ready.") : "Office follow-up.",
    link: staffLeadLink(lead.id)
  }, { leadId: lead.id }).catch(error => ({ stage: "new_lead", at: now(), status: "failed", reason: clean(error?.message || error, 200) }));
  await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, ops_new_lead: opsNew, ...(opsNewEmail ? { ops_new_lead_email: opsNewEmail } : {}) }))
    .catch(error => console.error("pipeline_record_failed", String(error?.message || error)));
  // Joshua 2026-09-17: the routed calendar trainer hears about the inquiry right away (trainer branch of pathway 2).
  const { email: inquiryEmail, ...inquiry } = await sendNewInquiryText({ lead: won, trainer: routed ? trainer : null, bookUrl: routed ? bookUrl : null })
    .catch(error => ({ kind: "trainer_new_inquiry", at: now(), status: "failed", reason: clean(error?.message || error, 300) }));
  await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, trainer_new_inquiry_text: inquiry, ...(inquiryEmail ? { trainer_new_inquiry_email: inquiryEmail } : {}) }))
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
  // GO-LIVE 2026-09-23 (owner decision): the client's "office will call you" EMAIL goes even when the
  // text could not (no consent, not a tester) - email is its own channel. Once per lead (idempotency key).
  if (lane.key === "office_call") {
    const careClientEmail = await clientTwinEmail("care_call", {
      lead: won,
      words: await clientMessageWords("care_call", { first_name: clientGreetingName(won.first_name) }),
      idempotencyKey: `client:${lead.id}:care_call`
    });
    await mergePipelineRecord(lead.id, pipeline => ({ ...pipeline, care_client_email: careClientEmail }))
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
// Rule 95: a test goes to the SAME handset the real text for that role would reach, so a rehearsal proves the
// routing that is switched on. There is no lead behind a test, so a TRAINER test can never reach a real trainer:
// it uses the one-number override, else the trainer test phone, else the locked phone. An OPERATIONS test follows
// the Operations rule. A CLIENT test stays on the locked phone. Every one of them still has to be an ACTIVE tester.
function sendTestPhoneFor(key, settings) {
  const role = T.TEXTS.find(t => t.key === key)?.role || "client";
  const s = settings || defaultSettings();
  if (role === "trainer") return { role, phone: trainerOverridePhone(s) || e164(s.practice_trainer_phone || "") || SEND_TEST_PHONE };
  if (role === "operations") return { role, phone: (practiceRealNumbers(s) ? e164(s.operations_phone || "") : "") || e164(s.practice_operations_phone || "") || SEND_TEST_PHONE };
  return { role: "client", phone: SEND_TEST_PHONE };
}

async function sendTextTest(key, draftWords) {
  if (!isSandbox()) return { ok: false, message: "Test texts are for the practice copy only." };
  if (!T.TEXTS.some(t => t.key === key)) return { ok: false, message: "Unknown text." };
  const settings = await loadSettings().catch(() => defaultSettings());
  const { phone, role } = sendTestPhoneFor(key, settings);
  if (phone && phone !== SEND_TEST_PHONE) await ensureTesterPhones([[role, phone]]);
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
  sendTextTwinEmail, opsEmailFor, trainerEmailFor, trainerTwinEmail, twinSubject, maskEmail, NO_TRAINER_EMAIL, DEFAULT_OPERATIONS_EMAIL,
  clientEmailFor, clientTwinEmail, clientMessageWords, CLIENT_EMAIL_SUBJECTS, CLIENT_EMAIL_OPT_OUT,
  sendTestPhoneFor, practiceRealNumbers, trainerOverridePhone, practiceRecipientSummary, registerTesterPhones, ensureTesterPhones, trainerTextPhone,
  SETTINGS_KEY, DEFAULT_RECIPIENTS, DEFAULT_ALPHA_EMAIL, DEFAULT_PRACTICE_TRAINER_PHONE, DEFAULT_PRACTICE_EMAIL_TO, DEFAULT_PRACTICE_REAL_NUMBERS, MAX_AGE_MINUTES, WAITING_FOR_KEY,
  LANES, CONTACT_US_LANES, CARE_TEXT,
  e164, normalizeSettings, defaultSettings, loadSettings, saveSettings, officeEmails, emailRecipients,
  normalizeLanes, loadLanes, isContactUsLead, decideLane, careHookUrl, careTextPlan,
  activeTesterPhones, hookUrl, clientPhoneFor, trainerPhoneFor, trainerForLead, trainerWithPhone, NO_TRAINER_PHONE, sendOpsAlert, sendNewInquiryText, problemWords, sourceWords, newLeadTextPlan, sendNewLeadText, sendFollowUpText, afterFollowUp, runAutoFollowUps, autoFollowUpDue, AUTO_FOLLOWUP_STEPS, AUTO_FOLLOWUP_MAX_AGE_DAYS, LEAD_SELECT, sendBookingTexts,
  sendReengageInvite, runReengageBatch, reengageBookingLink, normalizeReengageBatch, personKeys, dedupeByPerson, clientGreetingName, REENGAGE_KEY,
  mergePipelineRecord, afterBooking, afterOfficeRequest, afterPreEval, sendPreEvalTexts, afterEvalCompleted, sendEvalCompletedTexts, answersSummary, enterPipeline, staffLeadLink, trainerLeadLink,
  sendLeadOfficeEmails, sendQueuedOfficeEmails, queuedOfficeEmailCount
};
