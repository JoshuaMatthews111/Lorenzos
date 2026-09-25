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
  { key: "operations", label: "Operations (Lorenzo)" }
];

const TEXTS = [
  {
    key: "booking_link", stage: "new_lead", role: "client", label: "Booking link", when: "A new lead with SMS consent comes in", status: "in_use",
    fields: ["first_name", "problem", "booking_link"],
    // Meeting 2026-09-16: no "just reply to this message" (replies go nowhere). The opt-out line stays.
    words: "Hi {first_name}, this is Lorenzo’s Dog Training Team. We received your request for help with {problem}.\n\nYou can schedule your complimentary evaluation here:\n{booking_link}\n\nReply STOP to opt out."
  },
  {
    key: "care_call", stage: "new_lead", role: "client", label: "Office will call you", when: "Contact Us: \"free phone consultation\"", status: "in_use", // 2026-09-22: sent through the pathway 1 hook when LDTT_MAKE_HOOK_CARE is unset
    fields: ["first_name"],
    // Meeting 2026-09-16: the office number is in the text so people pick up the call.
    words: "Hi {first_name}, thanks for contacting Lorenzo's Dog Training Team. Our office will call you shortly from (866) 436-4959. Reply STOP to opt out."
  },
  {
    key: "ops_new_lead", stage: "new_lead", role: "operations", label: "New lead", when: "A lead starts its journey", status: "in_use",
    // Lorenzo, Zoom 2026-09-24: "why does it have the ZIP?" - Operations gets the client's PHONE NUMBER where the
    // ZIP was, like the trainer's new-inquiry text (2026-09-23). {zip} stays a field only so an older saved template
    // that still asks for it never renders a blank; the payload still carries it.
    fields: ["client_name", "phone", "zip", "problem", "source", "next_step", "link"],
    words: "New LDTT lead: {client_name}, {phone}, {problem}. From: {source}. {next_step} {link}",
    // Joshua 2026-09-16: "New Track 500 lead with two emojis on both sides" — trainer and office texts only, never the client.
    offered: { name: "Track 500 (Lorenzo)", words: "🚨🚨 New Track 500 lead 🚨🚨\n{client_name}, {phone}, {problem}. From: {source}. {next_step} {link}" }
  },
  {
    // Joshua 2026-09-17: the trainer hears about the lead at the NEW INQUIRY stage, the moment it is routed to
    // their calendar (lib/pipeline.js enterPipeline -> sendNewInquiryText, Make pathway 2, trainer branch only).
    key: "trainer_new_inquiry", stage: "new_lead", role: "trainer", label: "New inquiry", when: "A new lead is routed to this trainer's calendar", status: "in_use",
    fields: ["first_name", "last_name", "phone", "problem", "trainer_portal_link"],
    // Joshua 2026-09-23: the trainer needs the client's PHONE NUMBER here, not the ZIP, so they can call straight away.
    words: "🚨🚨 New Track 500 inquiry 🚨🚨\n{first_name} {last_name}\n{phone}\nConcern: {problem}\nThey just got your booking link. Watch for the booking, or call to help them pick a time: {trainer_portal_link}"
  },
  {
    key: "followup_first", stage: "not_booked", role: "client", label: "Follow-up 1 (15 min)", when: "15 minutes after, if still not booked", status: "not_yet",
    fields: ["first_name"],
    // Meeting 2026-09-16: the follow-up comes from Lorenzo, nobody else, by name.
    words: "Hi {first_name}, this is Lorenzo with Lorenzo's Dog Training Team. You reached out to us through our website for help with your dog, and I wanted to connect with you.\n\nAre you looking for help with training your dog? If so, reply YES and I will help you get started.\n\nReply STOP to opt out."
  },
  {
    // Joshua 2026-09-16: the follow-ups go at 15 min, 30 min and 24 h. The same words re-engage the 95+ office-contacted
    // leads that consented to texts — only when Joshua says so (lib/reengage.js SENDING_ENABLED).
    key: "followup_link", stage: "not_booked", role: "client", label: "Follow-up 2-3 (booking link)", when: "30 min and 24 h after, if still not booked", status: "not_yet",
    fields: ["first_name", "booking_link"],
    words: "Hi {first_name}, it's Lorenzo's Dog Training Team. Here is your link to book your free evaluation:\n{booking_link}\n\nReply STOP to opt out."
  },
  {
    // Joshua 2026-09-23 (final wording, agreed with Lorenzo): for someone who started the form and never
    // finished it. This is the words the TIMER uses for unfinished forms once automatic follow-ups are on.
    key: "unfinished_form", stage: "not_booked", role: "client", label: "Did not finish the form", when: "The timer, for someone who started the form and stopped", status: "not_yet",
    fields: ["first_name", "dog_name", "form_link"],
    words: "Hi {first_name}, it\u2019s Lorenzo\u2019s Dog Training Team. We noticed you were interested in training for {dog_name} but may not have finished your request. No problem \u2014 you can pick up where you left off here: {form_link}. Or call us at (866) 436-4959 and we\u2019ll be happy to help."
  },
  {
    // Joshua 2026-09-23 (go-live): a client re-engage invitation the office can pick from the existing send
    // paths. TEMPLATE ONLY — no automatic trigger and no scheduler send it (lib/reengage.js SENDING_ENABLED
    // stays false and never reads this key). Client sends stay tester-gated on the practice copy (rule 82/95).
    key: "reengage_invite", stage: "not_booked", role: "client", label: "Re-engage invite", when: "Sent by the office by hand — nothing sends this automatically", status: "not_yet",
    // Joshua 2026-09-24, rewritten before the send: NOT ONE of the 114 leads in the two columns has a dog
    // name, and 106 of them are only "Office Contacted" - so the old words ("We spoke about training for
    // {dog_name}") read "We spoke about training for your dog" to everybody, and asserted a conversation
    // that may never have happened. These words claim only what is true of every one of them: they reached
    // out to us. {dog_name} is gone from the words, so it is gone from the fields too - an honest list.
    // The opt-out line rides in the words exactly as booking_link / followup_link / care_call carry it;
    // the email twin adds its own e-mail opt-out line on top (lib/pipeline.js CLIENT_EMAIL_OPT_OUT).
    fields: ["first_name", "booking_link"],
    words: "Hi {first_name}, it's Lorenzo's Dog Training Team. You reached out about training for your dog and we'd still love to help. Pick a free evaluation time here: {booking_link}. Or call us at (866) 436-4959.\n\nReply STOP to opt out."
  },
  {
    key: "booking_confirmation", stage: "booked", role: "client", label: "Booking confirmation", when: "The client books an evaluation online", status: "in_use",
    fields: ["first_name", "trainer_first_name", "appointment_day", "appointment_date", "appointment_time", "service_address", "dog_name", "pre_eval_link"],
    words: "Hi {first_name} — you’re confirmed with {trainer_first_name} from Lorenzo’s Dog Training Team.\n\n📅 {appointment_day}, {appointment_date} at {appointment_time}\n📍 {service_address}\n\nBefore your trainer arrives, please complete these quick questions about {dog_name} so we can make the most of your evaluation:\n{pre_eval_link}\n\nWe look forward to meeting you."
  },
  {
    key: "trainer_new_eval", stage: "booked", role: "trainer", label: "New evaluation", when: "The client books with this trainer", status: "in_use",
    // Joshua 2026-09-15: "we need the date and time not just saying the day of the week" — day, date, time and address.
    fields: ["first_name", "last_name", "appointment_day", "appointment_date", "appointment_time", "service_address", "dog_name", "problem", "safety_flag", "trainer_portal_link"],
    words: "🔔 NEW LDTT EVALUATION\n{first_name} {last_name}\n{appointment_day}, {appointment_date} at {appointment_time}\n{service_address}\n\nDog: {dog_name}\nPrimary concern: {problem}\n{safety_flag}\nPlease call the client today to introduce yourself, then mark CONTACTED: {trainer_portal_link}",
    // Meeting 2026-09-12 [0:58:04]: "Track 500 - Schedule Eval". Offered as a ready template.
    // Joshua 2026-09-16: the Track 500 version carries the date too.
    offered: { name: "Track 500 (meeting)", words: "🚨🚨 Track 500 - Schedule Eval 🚨🚨\n{first_name} {last_name}\n{appointment_day}, {appointment_date} at {appointment_time}\n{service_address}\n\nDog: {dog_name}\nPrimary concern: {problem}\n{safety_flag}\nPlease call the client today to introduce yourself: {trainer_portal_link}" }
  },
  {
    key: "ops_eval_booked", stage: "booked", role: "operations", label: "Evaluation booked", when: "An evaluation is booked", status: "in_use",
    // Lorenzo, Zoom 2026-09-24: the client's phone number rides with the name, same as the new-lead text.
    fields: ["client_name", "phone", "trainer_name", "appointment_day", "appointment_date", "appointment_time", "link"],
    words: "Evaluation booked: {client_name}, {phone}, with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. It is now in Eval Scheduled. {link}",
    // Meeting 2026-09-12 [1:10:45] (Lorenzo): "the only thing it needs to say is Track 500".
    offered: { name: "Track 500 (meeting)", words: "🚨🚨 Track 500 - Eval booked 🚨🚨\n{client_name}, {phone}, with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. {link}" }
  },
  {
    key: "pre_eval_answers", stage: "answered", role: "trainer", label: "Pre-evaluation answers", when: "The client answers the questions", status: "in_use",
    // Joshua 2026-09-15: "the trainer never gets the text response of the eval questions ... they need to see it
    // and then prompt them to log in to the portal to view more details" — wired to pathway 2's Make hook.
    fields: ["first_name", "last_name", "appointment_day", "appointment_date", "appointment_time", "service_address", "safety_flag", "answers_summary", "trainer_portal_link"],
    words: "📝 EVAL QUESTIONS COMPLETED\n{first_name} {last_name}\n{appointment_day}, {appointment_date} at {appointment_time}\n{service_address}\n\n{safety_flag}\n{answers_summary}\n\nLog in to the trainer portal to view the full answers and lead details: {trainer_portal_link}",
    // Joshua 2026-09-16: every trainer text starts with Track 500 (Tim, meeting 2026-09-14).
    offered: { name: "Track 500 (meeting)", words: "🚨🚨 Track 500 - Pre-eval answers 🚨🚨\n{first_name} {last_name}\n{appointment_day}, {appointment_date} at {appointment_time}\n{service_address}\n\n{safety_flag}\n{answers_summary}\n\nLog in to the trainer portal to view the full answers and lead details: {trainer_portal_link}" }
  },
  {
    // Joshua 2026-09-16: "instruct them to log in and log the deal in the portal using this link". Sent when the
    // trainer marks Eval completed (api/trainer-lead-action.js -> lib/pipeline.js afterEvalCompleted, Make pathway 2).
    key: "trainer_log_deal", stage: "closed", role: "trainer", label: "Log the deal", when: "The trainer marks the evaluation completed", status: "in_use",
    fields: ["first_name", "last_name", "dog_name", "trainer_portal_link"],
    words: "🚨🚨 Track 500 - Eval completed 🚨🚨\n{first_name} {last_name} ({dog_name}).\nPlease log in to the trainer portal and log the deal here: {trainer_portal_link}"
  },
  {
    key: "ops_closed", stage: "closed", role: "operations", label: "Closed", when: "A trainer submits a deal", status: "not_yet",
    fields: ["client_name", "trainer_name", "program", "sold", "collected", "link"],
    words: "🚨🚨 Track 500 - Closed 🚨🚨\n{client_name} with {trainer_name}, {program}. {sold} sold, {collected} collected. {link}"
  }
];
const BY_KEY = Object.fromEntries(TEXTS.map(t => [t.key, t]));

// Lorenzo, Zoom 2026-09-24: the Operations texts show the client's phone, not the ZIP. The words IN USE on live and
// practice are SAVED templates (site_settings pipeline_texts: "Track 500 (Lorenzo)" / "Track 500 (meeting 12 Sep)",
// activated 2026-09-16), copied from the old offered words. A saved template whose words are EXACTLY one of these
// retired wordings is read as its replacement, so the change reaches Lorenzo without a data write; anything the
// office typed differently is left exactly as they typed it. The next save of that template stores the new words.
const RETIRED_WORDS = {
  ops_new_lead: {
    "New LDTT lead: {client_name}, ZIP {zip}, {problem}. From: {source}. {next_step} {link}": BY_KEY.ops_new_lead.words,
    "🚨🚨 New Track 500 lead 🚨🚨\n{client_name}, ZIP {zip}, {problem}. From: {source}. {next_step} {link}": BY_KEY.ops_new_lead.offered.words
  },
  ops_eval_booked: {
    "Evaluation booked: {client_name} with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. It is now in Eval Scheduled. {link}": BY_KEY.ops_eval_booked.words,
    "🚨🚨 Track 500 - Eval booked 🚨🚨\n{client_name} with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. {link}": BY_KEY.ops_eval_booked.offered.words
  }
};
const currentWords = (key, words) => (RETIRED_WORDS[key] && Object.prototype.hasOwnProperty.call(RETIRED_WORDS[key], words) ? RETIRED_WORDS[key][words] : words);

// Example values for the previews and the test text.
const SAMPLE = {
  first_name: "Sam", last_name: "Carter", problem: "pulling on the leash", booking_link: "https://ldtt-sandbox.vercel.app/book/example",
  trainer_first_name: "Jordan", trainer_name: "Jordan Reed", appointment_day: "Tuesday", appointment_date: "September 15, 2026", appointment_time: "10:00 AM ET",
  service_address: "1234 Example St, Cleveland, OH 44105", dog_name: "Max", pre_eval_link: "https://ldtt-sandbox.vercel.app/book/example?step=questions",
  safety_flag: "", trainer_portal_link: "https://ldtt-sandbox.vercel.app/staff", answers_summary: "#1: pulling on the leash. Kids at home: yes.",
  client_name: "Sam Carter", phone: "(216) 555-0123", zip: "44105", source: "Ad page 2.0: Pensacola, FL", next_step: "Booking link texted.", link: "https://ldtt-sandbox.vercel.app/staff",
  program: "Basic Obedience", sold: "$2,500.00", collected: "$1,000.00"
};

const scrub = value => String(value ?? "").replace(/\r\n?/g, "\n").replace(/[ -	-]/g, "");
const cleanName = value => scrub(value).replace(/\s+/g, " ").trim().slice(0, 60);

// The greeting name for a CLIENT-facing message, tidied at render time (Joshua 2026-09-24, the re-engage
// blast). Client texts and their email twins only - a trainer or Operations message keeps the name exactly
// as stored, because there it IDENTIFIES a person rather than greets them.
//   - ALL CAPS becomes proper case: "TIMOTHY" -> "Timothy". Nobody gets shouted at.
//   - A field that is not a usable greeting is DROPPED and the message opens "Hi there,": two names
//     ("Larry or Laura", "Bob and Sue"), a slash or ampersand pair, anything carrying a digit, or blank.
// It never invents a name and never greets anyone by a string that was not their name.
const NOT_A_GREETING = /[0-9/&]|\s(?:or|and)\s/i;

function clientGreetingName(value) {
  const name = cleanName(value);
  if (!name || NOT_A_GREETING.test(name)) return "there";
  if (!/[A-Za-z]{2,}/.test(name)) return "there"; // nothing word-like in it
  // Shouting (no lower case anywhere): proper-case every word. "TIMOTHY" -> "Timothy".
  if (!/[a-z]/.test(name)) return name.replace(/[A-Za-z]+/g, word => word[0].toUpperCase() + word.slice(1).toLowerCase());
  // Otherwise the office's own capitalisation stands, except a name typed entirely in lower case at the
  // front ("cherie", "jana", "ken", "rosie" on live today) gets its first letter back. Nothing else moves.
  return name.replace(/^[a-z]/, c => c.toUpperCase());
}

// One text's saved slot, in the current shape. Words saved by the first editor (published / draft) carry over as
// templates, so nothing anyone saved is lost.
function slotOf(state, key) {
  const raw = state?.texts?.[key] && typeof state.texts[key] === "object" ? state.texts[key] : {};
  const templates = Array.isArray(raw.templates) ? raw.templates.filter(t => t && t.id && typeof t.words === "string").map(t => ({ ...t, words: currentWords(key, t.words) })) : [];
  let active = typeof raw.active === "string" ? raw.active : STARTING;
  if (!Array.isArray(raw.templates)) {
    if (typeof raw.published === "string" && raw.published.trim()) {
      templates.push({ id: "t-published", name: "Published earlier", words: currentWords(key, raw.published), by: raw.published_by || "", at: raw.published_at || "" });
      active = "t-published";
    }
    if (typeof raw.draft === "string" && raw.draft.trim()) templates.push({ id: "t-draft", name: "Draft", words: currentWords(key, raw.draft), by: raw.draft_by || "", at: raw.draft_at || "" });
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
  if (clean.replace(FIELD, "").replace(/\s+/g, "").length < 5) return { error: "Add some words of your own. A text made only of {fields} can come out empty." };
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

module.exports = { SETTINGS_KEY, MAX_CHARS, MAX_TEMPLATES, STARTING, STAGES, ROLES, TEXTS, SAMPLE, RETIRED_WORDS, slotOf, wordsFor, render, check, view, load, change, clientGreetingName };
