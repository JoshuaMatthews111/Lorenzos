// Online booking (portal chain step 2, Joshua 2026-09-12). DO-NOT-BREAK rule 71.
//
// One pipeline for every lead source: a lead with a ZIP we serve gets a link to
// /book/<trainer_slug>?lead=<id>. That page shows the trainer's REAL free times from
// their Google appointment schedule (READ ONLY), the eval form (Rachel's 11 Alpha
// fields, more than one dog), and books the time in OUR database only.
//
// THE KEY RULE: we never book in Google. The only Google call in this codebase is
// AppointmentBookingService/ListAvailableSlots (assertReadOnlyGoogleCall enforces it).
// A booked time is HELD in practice.booking_holds so it is never offered twice; the
// trainer / TC reserves it in Google themselves.
//
// The Google web key is public (it is in the schedule page HTML). It is fetched at
// runtime and cached in memory; it is never committed and never sent to the browser.
const { supabaseRequest } = require("./sandbox");
const { milesBetween, centroid } = require("./zip-distance"); // rule 74: Census ZCTA centroids, bundled

const LIST_SLOTS_URL = "https://calendar-pa.clients6.google.com/$rpc/google.internal.calendar.v1.AppointmentBookingService/ListAvailableSlots";
const schedulePageUrl = id => `https://calendar.google.com/calendar/appointments/schedules/${encodeURIComponent(id)}?gv=true`;
const KEY_PATTERN = /AIzaSy[A-Za-z0-9_-]{33}/;
const KEY_TTL_MS = 6 * 3600 * 1000;
const SLOT_TTL_MS = 60 * 1000; // short cache: Google is asked at most once a minute per trainer
const WINDOW_DAYS = 14;
const MIN_NOTICE_MS = 60 * 60 * 1000; // never offer a time that starts within the hour
const MAX_DOGS = 6;
const TRAINING_CENTER_ADDRESS = "4815 Orchard Rd, Garfield Heights, OH 44128";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCATION_MODES = new Set(["in_home", "in_home_or_center", "center_only"]);

// Same values as the 'booking_trainers' row (supabase/migrations/20260912140000_online_booking_practice.sql).
// The row wins per trainer; these only answer when the row is missing (e.g. right after a Reset).
const DEFAULT_TRAINERS = [
  {
    slug: "lorenzo-miller",
    trainer_id: "cbf54e9f-d68c-44ba-b6ad-d48549caca8e",
    schedule_id: "AcZssZ3b031BaAFmox_APr99jWjnzvJcxoN24kB5MMdTY-Tn-trMtc7LnWzMJVfuHm15mSpr9fPLO__z",
    time_zone: "America/New_York",
    slot_minutes: 60,
    zip_prefixes: ["440", "441"],
    location_mode: "in_home_or_center",
    training_center_address: TRAINING_CENTER_ADDRESS,
    active: true
  },
  {
    slug: "daniel-bainbridge",
    trainer_id: "45875481-0bb3-420f-9add-6fdceb7efa51",
    schedule_id: "AcZssZ0llw8VeT4lffXoEPfB9BPYO7jXo6GYg9yv6-BvCFlb8uGNHk9B06EhHums8qL5zwDDiKQSsbv3",
    time_zone: "America/Chicago",
    slot_minutes: 60,
    zip_prefixes: ["325"],
    location_mode: "in_home",
    training_center_address: "",
    active: true
  }
];

const clean = (value, max = 200) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const cleanText = (value, max = 2000) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, max);
const digits = value => String(value ?? "").replace(/\D/g, "");
const isYes = value => value === true || /^(yes|true|on|1|y)$/i.test(String(value ?? "").trim());

function validTimeZone(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

function normalizeTrainerSetting(row = {}) {
  const slug = clean(row.slug, 80).toLowerCase();
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const scheduleId = clean(row.schedule_id, 240);
  const tz = clean(row.time_zone, 60);
  const minutes = Number(row.slot_minutes);
  const mode = LOCATION_MODES.has(row.location_mode) ? row.location_mode : "in_home";
  return {
    slug,
    trainer_id: UUID.test(String(row.trainer_id || "")) ? String(row.trainer_id) : null,
    schedule_id: /^[A-Za-z0-9_-]{20,240}$/.test(scheduleId) ? scheduleId : "",
    time_zone: tz && validTimeZone(tz) ? tz : "America/New_York",
    slot_minutes: Number.isFinite(minutes) && minutes >= 15 && minutes <= 240 ? Math.round(minutes) : 60,
    zip_prefixes: (Array.isArray(row.zip_prefixes) ? row.zip_prefixes : []).map(p => digits(p)).filter(p => p.length >= 3 && p.length <= 5),
    location_mode: mode,
    training_center_address: clean(row.training_center_address, 200) || (mode === "in_home" ? "" : TRAINING_CENTER_ADDRESS),
    active: row.active !== false
  };
}

// Stored rows override the defaults per trainer slug; new stored trainers are added.
function mergeSettings(stored) {
  const bySlug = new Map(DEFAULT_TRAINERS.map(t => [t.slug, normalizeTrainerSetting(t)]));
  (Array.isArray(stored) ? stored : []).forEach(row => {
    const normalized = normalizeTrainerSetting({ ...(bySlug.get(clean(row?.slug, 80).toLowerCase()) || {}), ...row });
    if (normalized) bySlug.set(normalized.slug, normalized);
  });
  return [...bySlug.values()];
}

// ZIP routing. The longest matching prefix wins. No match = no trainer yet (office follow-up, no booking link).
function trainerForZip(zip, settings = mergeSettings()) {
  const z = digits(zip).slice(0, 5);
  if (z.length !== 5) return null;
  let best = null;
  let bestLength = 0;
  for (const setting of settings) {
    if (!setting.active || !setting.schedule_id) continue;
    for (const prefix of setting.zip_prefixes) {
      if (z.startsWith(prefix) && prefix.length > bestLength) { best = setting; bestLength = prefix.length; }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Step 3c (rule 74): the client picks the trainer. Every active trainer whose Base ZIP
// (trainers.base_zip, office-editable) is within RADIUS_MILES of the client's ZIP is a
// picture card, nearest first. Trainers with a booking_trainers row (Google schedule id)
// get the mock calendar; the others get "Request this trainer" (office schedules).
// ---------------------------------------------------------------------------
const RADIUS_MILES = 50;
const TRAINER_LIST_SELECT = "id,slug,full_name,market,state,service_area,headshot_url,status,base_zip";

function marketLabel(trainer) {
  const market = clean(trainer?.market, 120);
  if (!market || /pending/i.test(market)) return clean(trainer?.service_area, 120);
  return market.includes(",") ? market : [market, clean(trainer?.state, 60)].filter(Boolean).join(", ");
}

// Where the evaluation can happen for a trainer. A calendar row decides for its trainer; otherwise
// Cleveland trainers (market names Cleveland) offer in-home OR the training center, everyone else in-home.
function locationRule(trainer, setting) {
  if (setting) return { location_mode: setting.location_mode, training_center_address: setting.training_center_address || (setting.location_mode === "in_home" ? "" : TRAINING_CENTER_ADDRESS) };
  return /cleveland/i.test(String(trainer?.market || ""))
    ? { location_mode: "in_home_or_center", training_center_address: TRAINING_CENTER_ADDRESS }
    : { location_mode: "in_home", training_center_address: "" };
}

async function listedTrainers() {
  const rows = await sbOrThrow(`/rest/v1/trainers?status=eq.active&base_zip=not.is.null&select=${TRAINER_LIST_SELECT}&order=full_name.asc`);
  return (rows || []).filter(t => t?.slug && !/^office-draft-/.test(t.slug) && /^\d{5}$/.test(String(t.base_zip || "")));
}

function trainerCard(trainer, setting, miles) {
  const name = clean(trainer.full_name, 120);
  const rule = locationRule(trainer, setting);
  return {
    slug: trainer.slug,
    name,
    first_name: name.split(" ")[0] || name,
    market: marketLabel(trainer),
    photo: trainer.headshot_url || "",
    miles: miles == null ? null : Math.round(miles),
    miles_exact: miles == null ? null : Math.round(miles * 10) / 10,
    calendar: Boolean(setting),
    locations: allowedLocations(rule),
    training_center_address: rule.training_center_address
  };
}

// Every listed trainer within the radius of this ZIP, nearest first (ties: calendar first, then name).
function nearbyTrainers(zip, trainers, settings, radius = RADIUS_MILES) {
  const out = [];
  for (const trainer of trainers || []) {
    const miles = milesBetween(zip, trainer.base_zip);
    if (miles == null || miles > radius) continue;
    out.push(trainerCard(trainer, settingBySlug(settings, trainer.slug), miles));
  }
  return out.sort((a, b) => a.miles_exact - b.miles_exact || Number(b.calendar) - Number(a.calendar) || a.name.localeCompare(b.name));
}

// Routing for the texts (rule 72): the nearest trainer within the radius WITH a calendar is assigned
// (same as before for Cleveland / Crestview); any trainer within the radius means the booking link works
// (the client picks on the page); nobody within the radius = office follow-up, no link.
async function routeZip(zip, settings) {
  if (!centroid(zip)) return { cards: [], calendar: null, nearest: null };
  const cards = nearbyTrainers(zip, await listedTrainers(), settings);
  const withCalendar = cards.find(c => c.calendar) || null;
  return { cards, calendar: withCalendar ? settingBySlug(settings, withCalendar.slug) : null, nearest: cards[0] || null };
}

// ---------------------------------------------------------------------------
// Google: READ ONLY.
// ---------------------------------------------------------------------------
function assertReadOnlyGoogleCall(url) {
  const text = String(url);
  if (text.includes("calendar-pa.clients6.google.com") && !text.startsWith(`${LIST_SLOTS_URL}?`)) {
    throw new Error("Only ListAvailableSlots may be called on Google. Booking in Google is not allowed.");
  }
  return url;
}

let keyCache = { key: "", at: 0 };
const slotCache = new Map();

async function publicKey(scheduleId, { force = false } = {}) {
  if (!force && keyCache.key && Date.now() - keyCache.at < KEY_TTL_MS) return keyCache.key;
  const response = await fetch(schedulePageUrl(scheduleId), { headers: { "User-Agent": "Mozilla/5.0 (LDTT booking; read-only)" } });
  const html = await response.text();
  const key = (html.match(KEY_PATTERN) || [])[0] || "";
  if (!key) throw new Error("Could not read the trainer's calendar right now.");
  keyCache = { key, at: Date.now() };
  return key;
}

// Google answers [[ [[["<startEpochSec>"],<minutes>]], ... ]].
function parseSlots(data) {
  const list = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
  const out = [];
  for (const entry of list) {
    const inner = Array.isArray(entry) ? entry[0] : null;
    const seconds = Number(Array.isArray(inner) && Array.isArray(inner[0]) ? inner[0][0] : NaN);
    const minutes = Number(Array.isArray(inner) ? inner[1] : NaN);
    if (Number.isFinite(seconds) && seconds > 0) out.push({ start: seconds, minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 60 });
  }
  return out.sort((a, b) => a.start - b.start);
}

async function callListAvailableSlots(scheduleId, startSec, endSec, key) {
  const headerBlock = `X-Goog-Api-Key:${key}\r\nContent-Type:application/json+protobuf\r\nX-User-Agent:grpc-web-javascript/0.1\r\n`;
  const url = assertReadOnlyGoogleCall(`${LIST_SLOTS_URL}?%24httpHeaders=${encodeURIComponent(headerBlock)}`);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8", Origin: "https://calendar.google.com" },
    body: JSON.stringify([null, null, scheduleId, null, [[startSec], [endSec]]])
  });
}

// Free times from Google for the next WINDOW_DAYS. fresh:true skips the cache (used right before a booking).
async function googleSlots(scheduleId, { fresh = false, now = Date.now() } = {}) {
  const cached = slotCache.get(scheduleId);
  if (!fresh && cached && now - cached.at < SLOT_TTL_MS) return cached.slots;
  const startSec = Math.floor(now / 1000);
  const endSec = startSec + WINDOW_DAYS * 86400;
  let key = await publicKey(scheduleId);
  let response = await callListAvailableSlots(scheduleId, startSec, endSec, key);
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    key = await publicKey(scheduleId, { force: true }); // the key rotated
    response = await callListAvailableSlots(scheduleId, startSec, endSec, key);
  }
  if (!response.ok) throw new Error(`The trainer's calendar did not answer (${response.status}).`);
  const slots = parseSlots(JSON.parse((await response.text()) || "[]"));
  slotCache.set(scheduleId, { at: now, slots });
  return slots;
}

function resetCaches() { keyCache = { key: "", at: 0 }; slotCache.clear(); }

// Google's free times, minus held ones, minus anything starting within the hour.
function openSlots(slots, holds, now = Date.now()) {
  const held = new Set((holds || []).map(h => new Date(h.slot_start).getTime()));
  return (slots || []).filter(s => s.start * 1000 >= now + MIN_NOTICE_MS && !held.has(s.start * 1000));
}

function formatWhen(value, timeZone) {
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const emailOk = email => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

// The contract the 2.0 pages call: {first_name,last_name,phone,email,zip,problem,dog_name,sms_consent,source_page}.
function cleanLeadIntake(body = {}) {
  const value = {
    first_name: clean(body.first_name, 80),
    last_name: clean(body.last_name, 80),
    phone: clean(body.phone, 40),
    email: clean(body.email, 160).toLowerCase(),
    zip: digits(body.zip).slice(0, 5),
    problem: clean(body.problem, 300),
    dog_name: clean(body.dog_name, 80),
    sms_consent: isYes(body.sms_consent),
    source_page: clean(body.source_page, 300),
    lead_source: clean(body.lead_source, 80),
    utm_source: clean(body.utm_source, 120),
    utm_medium: clean(body.utm_medium, 120),
    utm_campaign: clean(body.utm_campaign, 160),
    // Rule 75: questions the office added in the form editor ({"<question>": "<answer>"}), kept on the lead
    // as "Extra: <question>" so the lead panel and the office emails show them.
    extras: cleanExtraAnswers(body.answers)
  };
  const errors = [];
  if (!value.first_name) errors.push("First name is required.");
  if (!value.phone && !value.email) errors.push("A phone number or an email is required.");
  if (value.phone && digits(value.phone).length < 10) errors.push("The phone number needs 10 digits.");
  if (value.email && !emailOk(value.email)) errors.push("The email address does not look right.");
  return { value, errors };
}

const DOG_FIELDS = [
  ["name", "Dog name"], ["sex", "Sex"], ["fixed", "Spayed/Neutered?"], ["vaccinated", "Vaccinations up to date?"],
  ["age", "Age"], ["breed", "Breed"], ["behavior", "Behavioral challenges"]
];
const CLIENT_FIELDS = [["first_name", "First name"], ["last_name", "Last name"], ["phone", "Phone"], ["email", "Email"], ["address", "Physical address"]];
const pick = (value, allowed) => allowed.find(option => option.toLowerCase() === String(value ?? "").trim().toLowerCase()) || "";

function allowedLocations(setting) {
  if (!setting) return ["in_home"];
  if (setting.location_mode === "center_only") return ["training_center"];
  if (setting.location_mode === "in_home_or_center") return ["in_home", "training_center"];
  return ["in_home"];
}

// Rule 75: {"<question>": "<answer>"} from a form with office-added questions -> {"Extra: <question>": answer}.
function cleanExtraAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  Object.entries(value).slice(0, 20).forEach(([question, answer]) => {
    const label = clean(String(question).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " "), 80);
    const text = Array.isArray(answer) ? answer.map(v => clean(v, 120)).filter(Boolean).join(", ") : cleanText(answer, 2000);
    if (label && text) out[`Extra: ${label}`] = text;
  });
  return out;
}

// One answer to an office-added question (rule 75), checked against its type and choices.
function answerFor(field, raw) {
  const choices = field.type === "yesno" ? ["Yes", "No"] : (Array.isArray(field.choices) ? field.choices : []);
  if (field.type === "checkboxes") {
    const list = (Array.isArray(raw) ? raw : String(raw ?? "").split(/,\s*/)).map(v => clean(v, 120)).filter(Boolean);
    return choices.filter(choice => list.some(v => v.toLowerCase() === choice.toLowerCase())).join(", ");
  }
  if (field.type === "select" || field.type === "yesno") return pick(raw, choices);
  if (field.type === "textarea") return cleanText(raw, 2000);
  if (field.type === "number") { const v = clean(raw, 40); return /^-?\d+(\.\d+)?$/.test(v) ? v : ""; }
  if (field.type === "date") { const v = clean(raw, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ""; }
  if (field.type === "email") { const v = clean(raw, 160).toLowerCase(); return emailOk(v) ? v : ""; }
  return clean(raw, 300);
}
function customAnswers(fields, raw, errors, prefix) {
  const src = raw && typeof raw === "object" ? raw : {};
  return fields.map(field => {
    const value = answerFor(field, src[field.key]);
    if (field.required && !value) errors.push(`${prefix}${field.label} is required.`);
    return value ? { key: field.key, label: field.label, value } : null;
  }).filter(Boolean);
}

// Rachel's 11 required Alpha fields. Every dog repeats the 7 dog fields.
// Rule 75: `formFields` = the published booking questions from the form editor (lib/lead-forms.js). Without it
// (null) every one of the 11 is required, exactly as before. With it: a REMOVED question is neither asked nor
// required, a question the office made optional may be blank, and office-added questions are checked and kept
// (client_custom, dog.custom). Location and the phone / email format checks are unchanged.
function validateEvalForm(body = {}, setting, formFields = null) {
  const errors = [];
  const spec = Array.isArray(formFields) ? formFields : null;
  const asked = key => {
    if (!spec) return { required: true, label: "" };
    const field = spec.find(x => x.builtin && x.key === key);
    return field && !field.removed ? field : null;
  };
  const c = body.client || {};
  const client = {
    first_name: clean(c.first_name, 80), last_name: clean(c.last_name, 80), phone: clean(c.phone, 40),
    email: clean(c.email, 160).toLowerCase(), address: clean(c.address, 300)
  };
  CLIENT_FIELDS.forEach(([key, label]) => { const field = asked(key); if (field && field.required && !client[key]) errors.push(`${field.label || label} is required.`); });
  if (client.phone && digits(client.phone).length < 10) errors.push("The phone number needs 10 digits.");
  if (client.email && !emailOk(client.email)) errors.push("The email address does not look right.");
  const customOf = group => (spec ? spec.filter(x => !x.builtin && !x.removed && (x.group || "client") === group) : []);
  const clientCustom = customAnswers(customOf("client"), body.client_custom, errors, "");
  const rawDogs = Array.isArray(body.dogs) ? body.dogs.slice(0, MAX_DOGS) : [];
  if (!rawDogs.length) errors.push("Tell us about at least one dog.");
  const dogs = rawDogs.map((d = {}, index) => {
    const dog = {
      name: clean(d.name, 80), sex: pick(d.sex, ["Male", "Female"]), fixed: pick(d.fixed, ["Yes", "No"]),
      vaccinated: pick(d.vaccinated, ["Yes", "No"]), age: clean(d.age, 40), breed: clean(d.breed, 120), behavior: cleanText(d.behavior, 2000)
    };
    DOG_FIELDS.forEach(([key, label]) => { const field = asked(key); if (field && field.required && !dog[key]) errors.push(`Dog ${index + 1}: ${field.label || label} is required.`); });
    const custom = customAnswers(customOf("dog"), d.custom, errors, `Dog ${index + 1}: `);
    return custom.length ? { ...dog, custom } : dog;
  });
  const allowed = allowedLocations(setting);
  const requested = clean(body.location, 40) || (allowed.length === 1 ? allowed[0] : "");
  if (!requested) errors.push("Pick where the evaluation should happen.");
  else if (!allowed.includes(requested)) errors.push(allowed.includes("training_center") ? "Pick where the evaluation should happen." : "This trainer only does in-home evaluations.");
  const location = allowed.includes(requested) ? requested : "";
  return { errors, value: { client, dogs, location, ...(clientCustom.length ? { client_custom: clientCustom } : {}) } };
}

function locationLabel(location, setting) {
  if (location === "training_center") return `Training center: ${setting?.training_center_address || TRAINING_CENTER_ADDRESS}`;
  return "In-home";
}

// ---------------------------------------------------------------------------
// Database (service role, always through the schema switch: practice on the practice copy)
// ---------------------------------------------------------------------------
async function sb(path, { method = "GET", body, prefer } = {}) {
  const base = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const target = supabaseRequest(path, { ...(prefer ? { Prefer: prefer } : {}) });
  const response = await fetch(`${base}${target.path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...target.headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, status: response.status, data };
}

async function sbOrThrow(path, options) {
  const result = await sb(path, options);
  if (!result.ok) {
    const error = new Error(result.data?.message || `Database request failed (${result.status}).`);
    error.status = result.status;
    error.code = result.data?.code;
    throw error;
  }
  return result.data;
}

async function loadSettings() {
  try {
    const rows = await sbOrThrow("/rest/v1/site_settings?key=eq.booking_trainers&select=value");
    return mergeSettings(rows?.[0]?.value?.trainers);
  } catch {
    return mergeSettings();
  }
}

const settingBySlug = (settings, slug) => settings.find(s => s.slug === slug && s.active && s.schedule_id) || null;

async function trainerRow(slug) {
  const rows = await sbOrThrow(`/rest/v1/trainers?slug=eq.${encodeURIComponent(slug)}&select=${TRAINER_LIST_SELECT}&limit=1`);
  return rows?.[0] || null;
}

async function activeHolds(slug, nowIso = new Date().toISOString()) {
  return (await sbOrThrow(`/rest/v1/booking_holds?trainer_slug=eq.${encodeURIComponent(slug)}&status=eq.held&slot_start=gte.${encodeURIComponent(nowIso)}&select=id,slot_start,lead_id`)) || [];
}

function practiceOrigin() {
  if (process.env.LDTT_PRACTICE_ORIGIN) return process.env.LDTT_PRACTICE_ORIGIN.replace(/\/+$/, "");
  const host = String(process.env.LDTT_PRACTICE_HOST || "ldtt-sandbox.vercel.app").trim();
  return `https://${host}`;
}
const bookUrl = (slug, leadId) => `${practiceOrigin()}/book/${encodeURIComponent(slug)}?lead=${encodeURIComponent(leadId)}`;

function trainerFields(setting, trainer) {
  if (!setting) return {};
  return {
    trainer_id: trainer?.id || setting.trainer_id || null,
    trainer_slug: setting.slug,
    assigned_trainer_name: trainer?.full_name || null,
    trainer_market: trainer?.market || null,
    trainer_state: trainer?.state || null
  };
}

// One new lead in the one pipeline. A double submit (same email or phone through this
// endpoint in the last 30 minutes) answers the lead it already made instead of a second row.
async function createLead({ intake, setting, trainer, via }) {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const match = intake.email ? `email=eq.${encodeURIComponent(intake.email)}` : `phone=eq.${encodeURIComponent(intake.phone)}`;
  // Rule 75: with neither an email nor a phone (both removed in the form editor) there is nothing to match on,
  // and an empty match would hand this person someone else's lead: always a new lead then.
  const recent = intake.email || intake.phone
    ? await sbOrThrow(`/rest/v1/leads?${match}&created_at=gte.${encodeURIComponent(since)}&select=id,raw_payload,trainer_slug&order=created_at.desc&limit=5`)
    : [];
  const again = (recent || []).find(row => row.raw_payload?.booking?.intake?.via === via);
  if (again) return { lead: again, reused: true };

  const receivedAt = new Date().toISOString();
  const rows = await sbOrThrow("/rest/v1/leads", {
    method: "POST",
    prefer: "return=representation",
    body: {
      first_name: intake.first_name,
      last_name: intake.last_name || "",
      email: intake.email || "",
      phone: intake.phone || "",
      zip: intake.zip || null,
      dog_name: intake.dog_name || null,
      service_interest: intake.problem || null,
      comments: intake.problem || null,
      lead_source: intake.lead_source || "Website",
      sms_consent: intake.sms_consent === true,
      status: "new_inquiry",
      source_page: intake.source_page || via,
      ...trainerFields(setting, trainer),
      raw_payload: {
        ...(intake.extras && typeof intake.extras === "object" ? intake.extras : {}), // rule 75: "Extra: <question>" answers
        source_page: intake.source_page || via,
        sms_consent: intake.sms_consent ? "yes" : "no",
        ...(intake.utm_source ? { utm_source: intake.utm_source } : {}),
        ...(intake.utm_medium ? { utm_medium: intake.utm_medium } : {}),
        ...(intake.utm_campaign ? { utm_campaign: intake.utm_campaign } : {}),
        ...(trainer?.market ? { trainer_market: trainer.market } : {}), // the portal's market label reads raw_payload (leadMarketLabel), like submit-contact's payload
        sales_pipeline: true, // rule 2: the pipeline carries this lead, so it shows on the Sales tab too
        booking: { intake: { via, trainer_slug: setting?.slug || null, trainer_name: trainer?.full_name || null, zip: intake.zip || null, received_at: receivedAt } }
      }
    }
  });
  const lead = rows?.[0];
  if (!lead?.id) throw new Error("The lead was not saved.");
  // Same two rows submit-contact writes, so timelines and the funnel see this lead the usual way.
  try {
    await sbOrThrow("/rest/v1/lead_events", {
      method: "POST", prefer: "return=minimal",
      body: { lead_id: lead.id, event_type: "form_submitted", note: setting ? `Pipeline form: routed to ${trainer?.full_name || setting.slug} by ZIP ${intake.zip}.` : `Pipeline form: no trainer for ZIP ${intake.zip || "(none)"} yet. Office follow-up.`, raw_payload: { via } }
    });
    await sbOrThrow("/rest/v1/lifecycle_events?on_conflict=event_key", {
      method: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
      body: { event_key: `lead:${lead.id}:form_received`, entity_type: "lead", entity_id: lead.id, event_type: "form_received", market: trainer?.market || null, source_page: intake.source_page || via, utm_source: intake.utm_source || null, utm_medium: intake.utm_medium || null, utm_campaign: intake.utm_campaign || null, raw_payload: { via }, occurred_at: receivedAt }
    });
  } catch (error) {
    console.error("booking_lead_events_failed", String(error?.message || error));
  }
  return { lead, reused: false };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = ["https://ldtt-ads-v2-sandbox.vercel.app", "https://ldtt-sandbox.vercel.app"];

function allowedOrigin(req) {
  const origin = String(req.headers?.origin || "");
  if (!origin) return "";
  const extra = String(process.env.LDTT_BOOKING_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const own = req.headers?.host ? `https://${req.headers.host}` : "";
  return [...ALLOWED_ORIGINS, ...extra, own].includes(origin) ? origin : "";
}

function applyCors(req, res, methods) {
  const origin = allowedOrigin(req);
  res.setHeader("Vary", "Origin");
  if (!origin) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);
  return {};
}

module.exports = {
  LIST_SLOTS_URL, DEFAULT_TRAINERS, TRAINING_CENTER_ADDRESS, WINDOW_DAYS, MIN_NOTICE_MS, SLOT_TTL_MS, UUID, DOG_FIELDS, CLIENT_FIELDS,
  clean, digits, isYes, normalizeTrainerSetting, mergeSettings, trainerForZip, assertReadOnlyGoogleCall, parseSlots, googleSlots,
  resetCaches, openSlots, formatWhen, cleanLeadIntake, validateEvalForm, allowedLocations, locationLabel,
  sb, sbOrThrow, loadSettings, settingBySlug, trainerRow, activeHolds, practiceOrigin, bookUrl, trainerFields, createLead,
  allowedOrigin, applyCors, readBody,
  RADIUS_MILES, marketLabel, locationRule, listedTrainers, trainerCard, nearbyTrainers, routeZip, milesBetween, centroid
};
