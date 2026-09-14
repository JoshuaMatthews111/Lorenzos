// Text messages the Super Admin edits in the portal (Joshua 2026-09-14): "make the text editable in the portal
// ... it actually changes live, with a send test button and a currently-being-used label", then: "super admin only
// can edit this, easily select roles, see what text comes at what stage, and multiple templates for each section
// and role." DO-NOT-BREAK rule 84. Practice copy only this round.
//
// Every text sits at one STAGE of the client's journey and goes to one ROLE. Each text keeps its built-in
// "Starting words" (Make's own wording on 2026-09-14, copied exactly: {{1.x}} became {x}) plus up to 10 templates
// the Super Admin writes. Exactly one is IN USE. The pipeline fills the {fields} of the text in use and sends the
// finished words to Make as `message` / `customer_message` / `trainer_message`; since 2026-09-14 06:57 UTC the
// three practice Make scenarios send those words (LDTT_TEXTS_FROM_PORTAL=1 on the Preview target).
const B = require("./booking"); // B.sbOrThrow = the schema switch (rule 5): practice.site_settings on the practice copy
const SETTINGS_KEY = "pipeline_texts"; // site_settings key (CHECK ^[a-z_]{1,40}$)
const MAX_CHARS = 640;
const MAX_TEMPLATES = 10;
const STARTING = "starting";
const FIELD = /\{([a-z_]+)\}/g;

const STAGES = [
  { key: "new_lead", label: "New lead comes in", hint: "Someone fills in a form on the website, an ad page or a trainer page." },
  { key: "not_booked", label: "Has not booked yet", hint: "The booking link went out, but no time was picked." },
  { key: "booked", label: "Evaluation booked", hint: "The client picked a time with a trainer." },
  { key: "answered", label: "Pre-evaluation answered", hint: "The client answered the questions for the trainer." },
  { key: "closed", label: "Deal closed", hint: "The trainer submitted the deal." }
];
const ROLES = [
  { key: "client", label: "Client" },
  { key: "trainer", label: "Trainer" },
  { key: "operations", label: "Operations (Tim)" }
];

const TEXTS = [
  {
    key: "booking_link", stage: "new_lead", role: "client", label: "Booking link", when: "A new lead with SMS consent comes in", status: "in_use",
    fields: ["first_name", "problem", "booking_link"],
    words: "Hi {first_name}, this is Lorenzo’s Dog Training Team. We received your request for help with {problem}.\n\nYou can schedule your complimentary evaluation here:\n{booking_link}\n\nIf you have a question first, just reply to this message. Reply STOP to opt out."
  },
  {
    key: "care_call", stage: "new_lead", role: "client", label: "Office will call you", when: "Contact Us: \"free phone consultation\"", status: "not_yet", // no LDTT_MAKE_HOOK_CARE yet
    fields: ["first_name"],
    words: "Hi {first_name}, thanks for contacting Lorenzo's Dog Training Team. Our office will call you shortly. Reply STOP to opt out."
  },
  {
    key: "ops_new_lead", stage: "new_lead", role: "operations", label: "New lead", when: "A lead starts its journey", status: "in_use",
    fields: ["client_name", "zip", "problem", "source", "next_step", "link"],
    words: "New LDTT lead: {client_name}, ZIP {zip}, {problem}. From: {source}. {next_step} {link}"
  },
  {
    key: "followup_first", stage: "not_booked", role: "client", label: "Follow-up 1 (15 min)", when: "15 minutes after, if still not booked", status: "not_yet",
    fields: ["first_name"],
    words: "Hi {first_name}, this is Tim with Lorenzo's Dog Training Team. You reached out to us through our website for help with your dog, and I wanted to connect with you.\n\nAre you looking for help with training your dog? If so, reply YES and I will help you get started.\n\nReply STOP to opt out."
  },
  {
    key: "followup_link", stage: "not_booked", role: "client", label: "Follow-up 2-4 (booking link)", when: "40 min, 24 h and 48 h after, if still not booked", status: "not_yet",
    fields: ["first_name", "booking_link"],
    words: "Hi {first_name}, it's Lorenzo's Dog Training Team. Here is your link to book your free evaluation:\n{booking_link}\n\nReply STOP to opt out."
  },
  {
    key: "booking_confirmation", stage: "booked", role: "client", label: "Booking confirmation", when: "The client books an evaluation online", status: "in_use",
    fields: ["first_name", "trainer_first_name", "appointment_day", "appointment_date", "appointment_time", "service_address", "dog_name", "pre_eval_link"],
    words: "Hi {first_name} — you’re confirmed with {trainer_first_name} from Lorenzo’s Dog Training Team.\n\n📅 {appointment_day}, {appointment_date} at {appointment_time}\n📍 {service_address}\n\nBefore your trainer arrives, please complete these quick questions about {dog_name} so we can make the most of your evaluation:\n{pre_eval_link}\n\nWe look forward to meeting you."
  },
  {
    key: "trainer_new_eval", stage: "booked", role: "trainer", label: "New evaluation", when: "The client books with this trainer", status: "in_use",
    fields: ["first_name", "last_name", "appointment_day", "appointment_time", "service_address", "dog_name", "problem", "safety_flag", "trainer_portal_link"],
    words: "🔔 NEW LDTT EVALUATION\n{first_name} {last_name}\n{appointment_day} at {appointment_time}\n{service_address}\n\nDog: {dog_name}\nPrimary concern: {problem}\n{safety_flag}\nPlease call the client today to introduce yourself, then mark CONTACTED: {trainer_portal_link}",
    // Meeting 2026-09-12 [0:58:04]: "Track 500 - Schedule Eval". Offered as a ready template.
    offered: { name: "Track 500 (meeting)", words: "Track 500 - Schedule Eval\n{first_name} {last_name}\n{appointment_day} at {appointment_time}\n{service_address}\n\nDog: {dog_name}\nPrimary concern: {problem}\n{safety_flag}\nPlease call the client today to introduce yourself: {trainer_portal_link}" }
  },
  {
    key: "ops_eval_booked", stage: "booked", role: "operations", label: "Evaluation booked", when: "An evaluation is booked", status: "in_use",
    fields: ["client_name", "trainer_name", "appointment_day", "appointment_date", "appointment_time", "link"],
    words: "Evaluation booked: {client_name} with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. It is now in Eval Scheduled. {link}",
    // Meeting 2026-09-12 [1:10:45] (Tim): "the only thing it needs to say is Track 500".
    offered: { name: "Track 500 (meeting)", words: "Track 500 - Eval booked: {client_name} with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. {link}" }
  },
  {
    key: "pre_eval_answers", stage: "answered", role: "trainer", label: "Pre-evaluation answers", when: "The client answers the questions", status: "not_yet",
    fields: ["first_name", "last_name", "appointment_day", "appointment_time", "safety_flag", "answers_summary", "trainer_portal_link"],
    words: "Track 500 - Pre-eval answers\n{first_name} {last_name}, {appointment_day} at {appointment_time}\n{safety_flag}\n{answers_summary}\nAll answers: {trainer_portal_link}"
  },
  {
    key: "ops_closed", stage: "closed", role: "operations", label: "Closed", when: "A trainer submits a deal", status: "not_yet",
    fields: ["client_name", "trainer_name", "program", "sold", "collected", "link"],
    words: "Track 500 - Closed: {client_name} with {trainer_name}, {program}. {sold} sold, {collected} collected. {link}"
  }
];
const BY_KEY = Object.fromEntries(TEXTS.map(t => [t.key, t]));

// Example values for the previews and the test text.
const SAMPLE = {
  first_name: "Sam", last_name: "Carter", problem: "pulling on the leash", booking_link: "https://ldtt-sandbox.vercel.app/book/example",
  trainer_first_name: "Jordan", trainer_name: "Jordan Reed", appointment_day: "Tuesday", appointment_date: "Sep 15", appointment_time: "10:00 AM ET",
  service_address: "1234 Example St, Cleveland, OH 44105", dog_name: "Max", pre_eval_link: "https://ldtt-sandbox.vercel.app/book/example?step=questions",
  safety_flag: "", trainer_portal_link: "https://ldtt-sandbox.vercel.app/staff", answers_summary: "#1: pulling on the leash. Kids at home: yes.",
  client_name: "Sam Carter", zip: "44105", source: "Contact Us", next_step: "Booking link texted.", link: "https://ldtt-sandbox.vercel.app/staff",
  program: "Basic Obedience", sold: "$2,500.00", collected: "$1,000.00"
};

const scrub = value => String(value ?? "").replace(/\r\n?/g, "\n").replace(/[ -	-]/g, "");
const cleanName = value => scrub(value).replace(/\s+/g, " ").trim().slice(0, 60);

// One text's saved slot, in the current shape. Words saved by the first editor (published / draft) carry over as
// templates, so nothing anyone saved is lost.
function slotOf(state, key) {
  const raw = state?.texts?.[key] && typeof state.texts[key] === "object" ? state.texts[key] : {};
  const templates = Array.isArray(raw.templates) ? raw.templates.filter(t => t && t.id && typeof t.words === "string").map(t => ({ ...t })) : [];
  let active = typeof raw.active === "string" ? raw.active : STARTING;
  if (!Array.isArray(raw.templates)) {
    if (typeof raw.published === "string" && raw.published.trim()) {
      templates.push({ id: "t-published", name: "Published earlier", words: raw.published, by: raw.published_by || "", at: raw.published_at || "" });
      active = "t-published";
    }
    if (typeof raw.draft === "string" && raw.draft.trim()) templates.push({ id: "t-draft", name: "Draft", words: raw.draft, by: raw.draft_by || "", at: raw.draft_at || "" });
  }
  if (active !== STARTING && !templates.some(t => t.id === active)) active = STARTING;
  return { templates, active, active_by: raw.active_by || raw.published_by || "", active_at: raw.active_at || raw.published_at || "" };
}

// The words in use for a text: the active template, else its starting words.
function wordsFor(state, key) {
  const slot = slotOf(state, key);
  const chosen = slot.active !== STARTING ? slot.templates.find(t => t.id === slot.active) : null;
  return chosen && chosen.words.trim() ? chosen.words : (BY_KEY[key]?.words || "");
}

// Fill {fields}; an unknown or empty field becomes "". Blank lines a missing field left behind are closed up.
function render(words, fields = {}) {
  return String(words || "").replace(FIELD, (_, name) => String(fields[name] ?? "")).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Refused with the reason: empty words, too many characters or a {field} this text does not offer.
function check(key, words) {
  const text = BY_KEY[key];
  if (!text) return { error: "Unknown text." };
  const clean = scrub(words).trim();
  if (!clean) return { error: "The text is empty." };
  if (clean.length > MAX_CHARS) return { error: `The text is ${clean.length} characters. Keep it under ${MAX_CHARS}.` };
  const unknown = [...new Set([...clean.matchAll(FIELD)].map(m => m[1]).filter(name => !text.fields.includes(name)))];
  if (unknown.length) return { error: `Unknown field ${unknown.map(u => `{${u}}`).join(", ")}. You can use: ${text.fields.map(f => `{${f}}`).join(" ")}` };
  return { value: clean };
}

// What the portal shows: the stages, the roles, and every text with its templates and the one in use.
function view(state) {
  const texts = TEXTS.map(text => {
    const slot = slotOf(state, text.key);
    const starting = { id: STARTING, name: "Starting words", words: text.words, builtin: true, preview: render(text.words, SAMPLE) };
    const templates = slot.templates.map(t => ({ id: t.id, name: t.name || "Template", words: t.words, by: t.by || "", at: t.at || "", preview: render(t.words, SAMPLE) }));
    const activeTemplate = slot.active === STARTING ? starting : templates.find(t => t.id === slot.active);
    return {
      key: text.key, stage: text.stage, role: text.role, label: text.label, when: text.when, status: text.status, fields: text.fields,
      active_id: slot.active, active_name: activeTemplate?.name || "Starting words", active_by: slot.active_by, active_at: slot.active_at,
      in_use: wordsFor(state, text.key), preview: render(wordsFor(state, text.key), SAMPLE),
      templates: [starting, ...templates], offered: text.offered && !templates.some(t => t.words === text.offered.words) ? text.offered : null
    };
  });
  return { stages: STAGES, roles: ROLES, texts, max_chars: MAX_CHARS, max_templates: MAX_TEMPLATES };
}

// Server helpers. `sb` is lib/booking's sbOrThrow (the schema switch, rule 5).
async function load(sb = B.sbOrThrow) {
  const rows = await sb(`/rest/v1/site_settings?key=eq.${SETTINGS_KEY}&select=value,updated_at&limit=1`);
  const row = rows?.[0];
  return { state: row?.value && typeof row.value === "object" ? row.value : { texts: {}, log: [] }, updatedAt: row?.updated_at || null };
}

async function store(sb = B.sbOrThrow, state, actor) {
  await sb("/rest/v1/site_settings?on_conflict=key", {
    method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
    body: { key: SETTINGS_KEY, value: state, updated_by: String(actor || "").slice(0, 200) || null, updated_at: new Date().toISOString() }
  });
}

const newId = () => `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// op: "template_save" ({key, id?, name, words}: new when no id), "template_delete" ({key, id}: never the one in
// use), "activate" ({key, id, fullName}: make a template, or "starting", the words in use; full name required).
async function change(sb = B.sbOrThrow, { op, key, id, name, words, fullName }, actor) {
  const text = BY_KEY[key];
  if (!text) return { status: 400, body: { ok: false, message: "Unknown text." } };
  const { state } = await load(sb);
  const slot = slotOf(state, key);
  const at = new Date().toISOString();
  let message = "";
  let savedId = id || null;
  if (op === "template_save") {
    if (id === STARTING) return { status: 400, body: { ok: false, message: "The starting words cannot be changed. Save them as a new template." } };
    const ok = check(key, words); if (ok.error) return { status: 400, body: { ok: false, message: ok.error } };
    const label = cleanName(name) || "Template";
    const existing = id ? slot.templates.find(t => t.id === id) : null;
    if (id && !existing) return { status: 404, body: { ok: false, message: "That template is gone. Reload the page." } };
    if (existing) Object.assign(existing, { name: label, words: ok.value, by: actor, at });
    else {
      if (slot.templates.length >= MAX_TEMPLATES) return { status: 400, body: { ok: false, message: `A text can have ${MAX_TEMPLATES} templates. Delete one first.` } };
      savedId = newId();
      slot.templates.push({ id: savedId, name: label, words: ok.value, by: actor, at });
    }
    message = existing && slot.active === existing.id ? "Saved. This template is in use, so the new words are used from now on." : "Template saved.";
  } else if (op === "template_delete") {
    if (id === STARTING) return { status: 400, body: { ok: false, message: "The starting words stay. They are the safe fallback." } };
    if (id === slot.active) return { status: 409, body: { ok: false, message: "This template is in use. Put another one in use first." } };
    if (!slot.templates.some(t => t.id === id)) return { status: 404, body: { ok: false, message: "That template is gone. Reload the page." } };
    slot.templates = slot.templates.filter(t => t.id !== id);
    message = "Template deleted.";
  } else if (op === "activate") {
    const person = String(fullName || "").trim().replace(/\s+/g, " ");
    if (person.split(" ").length < 2) return { status: 400, body: { ok: false, message: "Type your full name (first and last) to change the text in use." } };
    const target = id === STARTING ? { words: text.words } : slot.templates.find(t => t.id === id);
    if (!target) return { status: 404, body: { ok: false, message: "That template is gone. Reload the page." } };
    const ok = check(key, target.words); if (ok.error) return { status: 400, body: { ok: false, message: ok.error } };
    Object.assign(slot, { active: id, active_by: `${person} (${actor})`, active_at: at });
    message = "Done. This is now the text in use.";
  } else {
    return { status: 400, body: { ok: false, message: "Unknown request." } };
  }
  const texts = { ...(state.texts || {}), [key]: { templates: slot.templates, active: slot.active, active_by: slot.active_by, active_at: slot.active_at } };
  const log = [...(Array.isArray(state.log) ? state.log : []), { at, key, op, id: savedId, by: op === "activate" ? slot.active_by : actor }].slice(-200);
  const next = { texts, log };
  await store(sb, next, actor);
  return { status: 200, body: { ok: true, message, saved_id: savedId, ...view(next) } };
}

module.exports = { SETTINGS_KEY, MAX_CHARS, MAX_TEMPLATES, STARTING, STAGES, ROLES, TEXTS, SAMPLE, slotOf, wordsFor, render, check, view, load, change };
