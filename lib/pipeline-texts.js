// Text messages the office edits in the portal (Joshua 2026-09-14, decision sheet): "make the text editable in
// the portal by role, just in case they want to update it, and it actually changes live, with a send test button
// and a currently-being-used label." DO-NOT-BREAK rule 84. Practice copy only this round.
//
// Each text has the words IN USE (published), an optional draft, who and when. The pipeline fills the {fields}
// and sends the finished words to Make as `message` / `customer_message` / `trainer_message`. Make uses them only
// after Joshua switches its Twilio steps to them (each step keeps today's words as the fallback), so publishing
// here changes nothing until that switch. The starting words below are Make's own wording on 2026-09-14,
// copied exactly ({{1.x}} became {x}), so the switch itself changes no text.
const B = require("./booking"); // B.sbOrThrow = the schema switch (rule 5): practice.site_settings on the practice copy
const SETTINGS_KEY = "pipeline_texts"; // site_settings key (CHECK ^[a-z_]{1,40}$)
const MAX_CHARS = 640;
const FIELD = /\{([a-z_]+)\}/g;

const TEXTS = [
  {
    key: "booking_link", label: "Booking link", to: "Client", when: "A new lead with SMS consent comes in", status: "in_use",
    fields: ["first_name", "problem", "booking_link"],
    words: "Hi {first_name}, this is Lorenzo’s Dog Training Team. We received your request for help with {problem}.\n\nYou can schedule your complimentary evaluation here:\n{booking_link}\n\nIf you have a question first, just reply to this message. Reply STOP to opt out."
  },
  {
    key: "booking_confirmation", label: "Booking confirmation", to: "Client", when: "The client books an evaluation online", status: "in_use",
    fields: ["first_name", "trainer_first_name", "appointment_day", "appointment_date", "appointment_time", "service_address", "dog_name", "pre_eval_link"],
    words: "Hi {first_name} — you’re confirmed with {trainer_first_name} from Lorenzo’s Dog Training Team.\n\n📅 {appointment_day}, {appointment_date} at {appointment_time}\n📍 {service_address}\n\nBefore your trainer arrives, please complete these quick questions about {dog_name} so we can make the most of your evaluation:\n{pre_eval_link}\n\nWe look forward to meeting you."
  },
  {
    key: "trainer_new_eval", label: "New evaluation (trainer)", to: "Trainer", when: "The client books with this trainer", status: "in_use",
    fields: ["first_name", "last_name", "appointment_day", "appointment_time", "service_address", "dog_name", "problem", "safety_flag", "trainer_portal_link"],
    words: "🔔 NEW LDTT EVALUATION\n{first_name} {last_name}\n{appointment_day} at {appointment_time}\n{service_address}\n\nDog: {dog_name}\nPrimary concern: {problem}\n{safety_flag}\nPlease call the client today to introduce yourself, then mark CONTACTED: {trainer_portal_link}",
    // Meeting 2026-09-12 [0:58:04]: "Track 500 - Schedule Eval". Offered as the first draft.
    draft: "Track 500 - Schedule Eval\n{first_name} {last_name}\n{appointment_day} at {appointment_time}\n{service_address}\n\nDog: {dog_name}\nPrimary concern: {problem}\n{safety_flag}\nPlease call the client today to introduce yourself: {trainer_portal_link}"
  },
  {
    key: "pre_eval_answers", label: "Pre-evaluation answers (trainer)", to: "Trainer", when: "The client answers the pre-evaluation questions", status: "not_yet",
    fields: ["first_name", "last_name", "appointment_day", "appointment_time", "safety_flag", "answers_summary", "trainer_portal_link"],
    words: "Track 500 - Pre-eval answers\n{first_name} {last_name}, {appointment_day} at {appointment_time}\n{safety_flag}\n{answers_summary}\nAll answers: {trainer_portal_link}"
  },
  {
    key: "ops_new_lead", label: "New lead (Operations)", to: "Operations", when: "A lead starts its journey", status: "in_use",
    fields: ["client_name", "zip", "problem", "source", "next_step", "link"],
    words: "New LDTT lead: {client_name}, ZIP {zip}, {problem}. From: {source}. {next_step} {link}"
  },
  {
    key: "ops_eval_booked", label: "Evaluation booked (Operations)", to: "Operations", when: "An evaluation is booked", status: "in_use",
    fields: ["client_name", "trainer_name", "appointment_day", "appointment_date", "appointment_time", "link"],
    words: "Evaluation booked: {client_name} with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. It is now in Eval Scheduled. {link}",
    // Meeting 2026-09-12 [1:10:45] (Tim): "the only thing it needs to say is Track 500".
    draft: "Track 500 - Eval booked: {client_name} with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. {link}"
  },
  {
    key: "ops_closed", label: "Closed (Operations)", to: "Operations", when: "A trainer submits a deal", status: "not_yet",
    fields: ["client_name", "trainer_name", "program", "sold", "collected", "link"],
    words: "Track 500 - Closed: {client_name} with {trainer_name}, {program}. {sold} sold, {collected} collected. {link}"
  },
  {
    key: "followup_first", label: "Follow-up 1 (15 min)", to: "Client", when: "15 minutes after a lead that has not booked", status: "not_yet",
    fields: ["first_name"],
    words: "Hi {first_name}, this is Tim with Lorenzo's Dog Training Team. You reached out to us through our website for help with your dog, and I wanted to connect with you.\n\nAre you looking for help with training your dog? If so, reply YES and I will help you get started.\n\nReply STOP to opt out."
  },
  {
    key: "followup_link", label: "Follow-up 2-4 (booking link)", to: "Client", when: "40 min, 24 h and 48 h after, while still not booked", status: "not_yet",
    fields: ["first_name", "booking_link"],
    words: "Hi {first_name}, it's Lorenzo's Dog Training Team. Here is your link to book your free evaluation:\n{booking_link}\n\nReply STOP to opt out."
  }
];
const BY_KEY = Object.fromEntries(TEXTS.map(t => [t.key, t]));

// Example values for the preview and the test text.
const SAMPLE = {
  first_name: "Sam", last_name: "Carter", problem: "pulling on the leash", booking_link: "https://ldtt-sandbox.vercel.app/book/example",
  trainer_first_name: "Jordan", trainer_name: "Jordan Reed", appointment_day: "Tuesday", appointment_date: "Sep 15", appointment_time: "10:00 AM ET",
  service_address: "1234 Example St, Cleveland, OH 44105", dog_name: "Max", pre_eval_link: "https://ldtt-sandbox.vercel.app/book/example?step=questions",
  safety_flag: "", trainer_portal_link: "https://ldtt-sandbox.vercel.app/staff", answers_summary: "#1: pulling on the leash. Kids at home: yes.",
  client_name: "Sam Carter", zip: "44105", source: "Contact Us", next_step: "Booking link texted.", link: "https://ldtt-sandbox.vercel.app/staff",
  program: "Basic Obedience", sold: "$2,500.00", collected: "$1,000.00"
};

const scrub = value => String(value ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "");

// The words for a text: its published words, else the starting words.
function wordsFor(state, key) {
  const saved = state?.texts?.[key]?.published;
  return typeof saved === "string" && saved.trim() ? saved : (BY_KEY[key]?.words || "");
}

// Fill {fields}; an unknown or empty field becomes "". Blank lines that a missing field left behind are closed up.
function render(words, fields = {}) {
  return String(words || "").replace(FIELD, (_, name) => String(fields[name] ?? "")).replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

// A save or publish is refused (with the reason) for empty words, too many characters or an unknown {field}.
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

// What the portal shows: every text with the words in use, the draft, who and when.
function view(state) {
  return TEXTS.map(text => {
    const saved = state?.texts?.[text.key] || {};
    const draft = typeof saved.draft === "string" ? saved.draft : (saved.published ? null : (text.draft || null));
    return {
      key: text.key, label: text.label, to: text.to, when: text.when, status: text.status, fields: text.fields,
      in_use: wordsFor(state, text.key), in_use_by: saved.published_by || "", in_use_at: saved.published_at || "",
      starting_words: !saved.published, draft, draft_by: saved.draft_by || "", draft_at: saved.draft_at || "",
      preview: render(draft || wordsFor(state, text.key), SAMPLE)
    };
  });
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

// op: "save" (draft), "publish" (draft or given words become the words in use; full name required),
// "discard" (drop the draft), "reset" (back to the starting words; full name required).
async function change(sb = B.sbOrThrow, { op, key, words, name }, actor) {
  if (!BY_KEY[key]) return { status: 400, body: { ok: false, message: "Unknown text." } };
  const { state } = await load(sb);
  const texts = { ...(state.texts || {}) };
  const current = { ...(texts[key] || {}) };
  const at = new Date().toISOString();
  const fullName = String(name || "").trim().replace(/\s+/g, " ");
  const needsName = op === "publish" || op === "reset";
  if (needsName && fullName.split(" ").length < 2) return { status: 400, body: { ok: false, message: "Type your full name (first and last) to change a text in use." } };
  if (op === "save") {
    const ok = check(key, words); if (ok.error) return { status: 400, body: { ok: false, message: ok.error } };
    Object.assign(current, { draft: ok.value, draft_by: actor, draft_at: at });
  } else if (op === "publish") {
    const source = typeof words === "string" && words.trim() ? words : (current.draft ?? BY_KEY[key].draft ?? "");
    const ok = check(key, source); if (ok.error) return { status: 400, body: { ok: false, message: ok.error } };
    Object.assign(current, { previous: current.published || null, published: ok.value, published_by: `${fullName} (${actor})`, published_at: at, draft: undefined, draft_by: undefined, draft_at: undefined });
  } else if (op === "discard") {
    Object.assign(current, { draft: "", draft_by: actor, draft_at: at });
    if (!current.published) current.draft = ""; // an empty draft hides the offered first draft too
  } else if (op === "reset") {
    Object.assign(current, { previous: current.published || null, published: undefined, published_by: `${fullName} (${actor})`, published_at: at, draft: undefined });
  } else {
    return { status: 400, body: { ok: false, message: "Unknown request." } };
  }
  texts[key] = JSON.parse(JSON.stringify(current)); // drops undefined keys
  const log = [...(Array.isArray(state.log) ? state.log : []), { at, key, op, by: needsName ? `${fullName} (${actor})` : actor }].slice(-200);
  await store(sb, { texts, log }, actor);
  const next = { texts, log };
  return { status: 200, body: { ok: true, message: op === "publish" ? "Published. This is now the text in use." : op === "reset" ? "Back to the starting words." : op === "discard" ? "Draft removed." : "Draft saved.", texts: view(next) } };
}

module.exports = { SETTINGS_KEY, MAX_CHARS, TEXTS, SAMPLE, wordsFor, render, check, view, load, change };
