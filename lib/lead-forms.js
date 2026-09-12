// The lead form editor (portal chain step 4, Joshua 2026-09-12, DO-NOT-BREAK rule 75).
//
// "Make the page editor one of the best things." The office edits EVERY lead form from the Page Editor:
// add a question (short text, long text, email, phone, number, dropdown, checkboxes, yes/no, date), remove
// one, reorder, rename, set required, edit dropdown choices. Removing a question is allowed, but only after a
// plain warning that says what stops working (Phone = no texts, ZIP = no trainer matching, texting box = no
// texts at all); every removal is LOGGED (who, when, which form, which question) and can be undone.
//
// Where it lives: site_settings key "lead_forms" in the schema of this deployment (practice on the practice
// copy). One row holds { draft, published, log }. The practice copy edits the DRAFT, "Publish on the practice
// copy" makes the practice pages use it, and Send to live (api/send-to-live.js, kind "lead_forms") copies the
// practice draft into the LIVE row's draft only. Publishing on the real website stays on the live portal.
//
// This file is pure logic plus two small database helpers that take the caller's sbOrThrow (lib/booking.js,
// always on the schema switch). Nothing here sends email or texts, and nothing here touches FormSubmit.
"use strict";

const SETTINGS_KEY = "lead_forms";
const EXTRA_PREFIX = "Extra: "; // a custom question is submitted as "Extra: <question>" = <answer>
const LABEL_MAX = 80;
const CHOICE_MAX = 120;
const MAX_CHOICES = 40;
const MAX_CUSTOM = 20;
const LOG_MAX = 300;

const FIELD_TYPES = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone number",
  number: "Number",
  select: "Dropdown (pick one)",
  checkboxes: "Checkboxes (pick any)",
  yesno: "Yes / No",
  date: "Date"
};
const CUSTOM_TYPES = Object.keys(FIELD_TYPES);
const CHOICE_TYPES = new Set(["select", "checkboxes"]);

// The stand-ins a removed record field gets, because the lead saver (submit-contact) refuses a lead without
// a first name, last name, email and phone. Email gets a unique address that goes nowhere (…@noemail.invalid).
const FALLBACKS = { first_name: "Website visitor", last_name: "Not given", phone: "Not given" };

const CONTACT_INTENTS = [
  "Schedule a free phone consultation to receive more information",
  "Schedule an in person evaluation with a trainer in my area",
  "Schedule a virtual evaluation",
  "Schedule a training session with my dog trainer",
  "Learn more about becoming a dog trainer"
];
const HEARD_ABOUT_US = [
  "My Veterinarian", "My Dog Walker", "My Dog Groomer", "My Pet Store", "My Neighbor", "Your Website", "Your Trainer",
  "Is a past client", "Referred by a past client", "Google Search", "Facebook or Instagram", "Other"
];
const AD_HELP = [
  "Schedule an in person evaluation with a trainer in my area",
  "Schedule an online consultation",
  "Dog obedience training",
  "Dog behavior modification",
  "Puppy training",
  "Specialty, service, or protection training",
  "Not sure yet"
];
const V2_PROBLEMS = [
  "Pulling on the leash", "Barking", "Jumping on people", "Reactive to dogs or people", "New puppy", "New rescue",
  "Board & train", "Service dog", "Something else"
];

const f = (key, label, type, required, extra = {}) => ({ key, label, type, required, builtin: true, ...extra });
const consent = () => f("sms_consent", "Texting consent box", "consent", false, { lockLabel: true, lockRequired: true, feeds: "Texting consent (wording is fixed by Twilio, rule 47)" });
const first = (label = "First Name") => f("first_name", label, "text", true, { feeds: "Lead name" });
const last = (label = "Last Name") => f("last_name", label, "text", true, { feeds: "Lead name" });
const email = (label = "Email Address") => f("email", label, "email", true, { feeds: "Email" });
const phone = (label = "Phone") => f("phone", label, "phone", true, { feeds: "Texts + callbacks" });
const zip = (label = "ZIP Code") => f("zip", label, "text", true, { feeds: "Trainer matching" });

// Every lead form, with its questions exactly as the page has them today (a form nobody changed renders
// byte-for-byte as before: the page is only touched when the published form differs from these).
const FORMS = [
  {
    id: "contact", label: "Contact Us", open: "/contact",
    where: "The Contact Us page (/contact), and a Site Builder page that takes over /contact.",
    fields: [
      first(), last(), f("address_line_1", "Address Line 1", "text", true), f("address_line_2", "Address Line 2", "text", false),
      f("city", "City", "text", true), f("state", "State", "text", true), zip(), email(), phone(),
      f("i_want_to", "I want to...", "select", true, { choices: CONTACT_INTENTS, feeds: "Picks what happens next (Contact Us lanes)" }),
      f("heard_about_us", "How did you hear about us?", "select", true, { choices: HEARD_ABOUT_US }),
      f("vet_or_previous_client", "Vet Name or Previous Client Name", "text", false),
      f("comments", "Comments", "textarea", true), consent()
    ]
  },
  {
    id: "get_started", label: "Get Started", open: "/get-started",
    where: "The Get Started page (/get-started): the consultation form at the top.",
    fields: [first(), last(), phone("Phone Number"), email(), zip(), f("i_want_to", "What do you need help with?", "select", true, { choices: AD_HELP }), f("comments", "What is happening with your dog?", "textarea", false), consent()]
  },
  {
    id: "ad_landing", label: "Ad landing pages", open: "/dog-training-cleveland-oh",
    where: "Every built-in market page (/dog-training-<city>) and every Page Studio ad page (/ads/<name>).",
    note: "The quiz-style test pages (/lp-test-…) keep their own form for now.",
    fields: [first(), last(), phone("Phone Number"), email(), zip(), f("i_want_to", "What do you need help with?", "select", true, { choices: AD_HELP }), f("comments", "What is happening with your dog?", "textarea", false), consent()]
  },
  {
    id: "trainer_consult", label: "Trainer page form", open: "/lorenzomiller",
    where: "The \"Book your free consultation\" form on every trainer's page.",
    fields: [
      first(), last(), email(), phone(),
      f("i_want_to", "What can we help you with?", "select", true, { choices: CONTACT_INTENTS }),
      f("comments", "Your dog and goals", "textarea", true),
      f("address_line_1", "Address Line 1", "text", true), f("address_line_2", "Address Line 2", "text", false),
      f("city", "City", "text", true), f("state", "State", "text", true), zip(),
      f("heard_about_us", "How did you hear about us?", "select", true, { choices: HEARD_ABOUT_US }), consent()
    ]
  },
  {
    id: "booklet", label: "Free booklet form", open: "/get-started#guide",
    where: "The free Calm Dog Blueprint booklet form: ad pages, market pages, Get Started and the exit pop-up.",
    note: "Some booklet forms only ask first name and email. A question a page never had (last name, phone, ZIP) is only changed where it already exists; new questions show on every booklet form.",
    fields: [f("first_name", "First name", "text", true, { feeds: "Lead name" }), f("last_name", "Last name", "text", true, { onlyOn: "Get Started" }), f("email", "Email address", "email", true, { feeds: "Email" }), f("phone", "Phone number", "phone", true, { onlyOn: "Get Started", feeds: "Texts + callbacks" }), f("zip", "ZIP code", "text", true, { onlyOn: "Get Started", feeds: "Trainer matching" }), consent()]
  },
  {
    id: "ads_v2", label: "2.0 ad pages", open: "https://ldtt-ads-v2-sandbox.vercel.app/miramar-beach/",
    where: "The 2.0 ad pages (ldtt-ads-v2-sandbox): the evaluation form.",
    note: "The 2.0 pages are a separate website. They read this form from the practice copy once their hand-off is done (docs/FORM-EDITOR.md). Until then, changes here are saved and served, but the 2.0 pages still show their own form.",
    fields: [first("First name"), last("Last name"), phone("Phone"), email("Email"), zip("ZIP code"), f("dog_name", "Dog's name", "text", false), f("problem", "What is going on with your dog?", "select", true, { choices: V2_PROBLEMS }), consent()]
  },
  {
    id: "booking_eval", label: "Booking page questions", open: "/book",
    where: "The online booking page (/book), step 2: Rachel's Alpha questions. Dog questions repeat for every dog.",
    grouped: true,
    fields: [
      f("first_name", "First name", "text", true, { group: "client", feeds: "Alpha: client name" }),
      f("last_name", "Last name", "text", true, { group: "client", feeds: "Alpha: client name" }),
      f("phone", "Phone", "phone", true, { group: "client", feeds: "Alpha + confirmation text" }),
      f("email", "Email", "email", true, { group: "client", feeds: "Alpha" }),
      f("address", "Physical address", "text", true, { group: "client", feeds: "Alpha + in-home address" }),
      f("name", "Dog name", "text", true, { group: "dog", feeds: "Alpha" }),
      f("sex", "Sex", "select", true, { group: "dog", choices: ["Male", "Female"], lockChoices: true, feeds: "Alpha" }),
      f("fixed", "Spayed/Neutered?", "select", true, { group: "dog", choices: ["Yes", "No"], lockChoices: true, feeds: "Alpha" }),
      f("vaccinated", "Vaccinations up to date?", "select", true, { group: "dog", choices: ["Yes", "No"], lockChoices: true, feeds: "Alpha" }),
      f("age", "Age", "text", true, { group: "dog", feeds: "Alpha" }),
      f("breed", "Breed", "text", true, { group: "dog", feeds: "Alpha" }),
      f("behavior", "Behavioral challenges", "textarea", true, { group: "dog", feeds: "Alpha" })
    ]
  }
];
const FORM_IDS = FORMS.map(form => form.id);
const formById = id => FORMS.find(form => form.id === id) || null;

// ---------------------------------------------------------------------------
// What removing a question does. Shown in the red warning before a removal and kept in the log.
// ---------------------------------------------------------------------------
const EFFECTS = {
  first_name: "Leads from this form are saved with the first name \"Website visitor\". The office has to ask for the name.",
  last_name: "Leads from this form are saved with the last name \"Not given\".",
  email: "No email address. Leads are saved with a stand-in address that goes nowhere (…@noemail.invalid). Nobody can email this customer until the office gets a real address.",
  phone: "TEXTS STOP for this form: no booking-link text, no confirmation, no reminders, and the office cannot call back. Leads are saved with the phone \"Not given\".",
  zip: "TRAINER MATCHING STOPS for this form: no trainer is matched and no booking link is texted. Every lead from this form goes to office follow-up.",
  sms_consent: "NO TEXTS AT ALL for this form: nobody can tick the texting box, so no lead from this form gets any text. Leads still reach the office.",
  i_want_to: "The office no longer sees what the customer wants.",
  comments: "The office loses the customer's own words about the dog.",
  heard_about_us: "Reports lose \"How did you hear about us?\". The office sheet records \"Other\".",
  address_line_1: "The office has to get the street address by phone.",
  address_line_2: "Only the second address line goes away. Nothing else changes.",
  city: "The office has to get the city by phone.",
  state: "The office has to get the state by phone.",
  vet_or_previous_client: "The office loses the vet or referral name.",
  dog_name: "The lead card will not show the dog's name.",
  problem: "The office no longer sees what is going on with the dog."
};
const FORM_EFFECTS = {
  contact: {
    i_want_to: "Contact Us uses this answer to pick what happens next (evaluation booking text, office phone call, or recruiting). Without it every Contact Us lead goes to office follow-up with NO text, and nobody is sent to Applications.",
    zip: "TRAINER MATCHING STOPS for Contact Us: no trainer is matched and no booking link is texted. Every Contact Us lead goes to office follow-up."
  },
  booklet: {
    zip: "Booklet leads lose their ZIP (only the Get Started booklet form asks it). No trainer is matched from the booklet form.",
    phone: "Booklet leads lose their phone (only the Get Started booklet form asks it). They are saved with \"Not provided - PDF opt-in\", as the other booklet forms already are."
  },
  ads_v2: {
    zip: "TRAINER MATCHING STOPS for the 2.0 pages: no booking link can be made, every lead goes to office follow-up.",
    phone: "TEXTS STOP for the 2.0 pages. The lead needs a phone OR an email, so a form with neither cannot be sent."
  },
  booking_eval: {
    first_name: "Alpha needs the client's name (one of Rachel's 11 required fields). The office has to get it by phone before logging the client into Alpha.",
    last_name: "Alpha needs the client's last name (one of Rachel's 11 required fields). The office has to get it by phone before logging the client into Alpha.",
    phone: "Alpha needs a phone (one of Rachel's 11 required fields). A person booking from a text link keeps the phone they gave before; nobody else has a number to call. If you remove BOTH phone and email, a person who opens /book without a text link cannot book.",
    email: "Alpha needs an email (one of Rachel's 11 required fields). A person booking from a text link keeps the email they gave before. If you remove BOTH phone and email, a person who opens /book without a text link cannot book.",
    address: "Alpha needs a physical address (one of Rachel's 11 required fields), and an in-home trainer needs it to find the house. The office has to get it by phone before logging the client into Alpha."
  }
};
const CUSTOM_EFFECT = "New leads will not be asked this question. Answers already given stay on the old leads.";
const CHOICE_NOTES = {
  contact: { i_want_to: "These exact words decide what happens next on Contact Us: the 3 evaluation / training answers get the booking text, the phone-consultation answer gets an office call, and \"Learn more about becoming a dog trainer\" sends the person to Applications. A renamed or new answer goes to office follow-up with no text. The office sheet files a new answer under the phone-consultation answer and keeps the real answer next to it." },
  trainer_consult: { i_want_to: "\"Learn more about becoming a dog trainer\" sends the person to Applications instead of Leads. The office sheet files a new answer under the phone-consultation answer and keeps the real answer next to it." }
};
const HEARD_NOTE = "A new answer is filed as \"Other\" in the office sheet, with the real answer next to it.";

function effectFor(formId, key) {
  const def = formById(formId);
  const field = def?.fields.find(x => x.key === key);
  if (!field) return CUSTOM_EFFECT;
  if (FORM_EFFECTS[formId]?.[key]) return FORM_EFFECTS[formId][key];
  if (formId === "booking_eval" && field.group === "dog") return `Alpha needs "${field.label}" for every dog (one of Rachel's 11 required fields). The office has to get it by phone before logging the client into Alpha.`;
  return EFFECTS[key] || CUSTOM_EFFECT;
}
function choiceNoteFor(formId, key) {
  if (CHOICE_NOTES[formId]?.[key]) return CHOICE_NOTES[formId][key];
  if (key === "heard_about_us") return HEARD_NOTE;
  return "";
}

// ---------------------------------------------------------------------------
// Cleaning. Office text is data, never markup: labels and choices lose control characters and angle
// brackets here, and every renderer escapes them again (textContent in the browser, esc() on the server).
// ---------------------------------------------------------------------------
const clone = value => JSON.parse(JSON.stringify(value));
function cleanLabel(value, max = LABEL_MAX) {
  return String(value ?? "")
    .replace(/[ -<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\*+$/, "")
    .slice(0, max)
    .trim();
}
function cleanChoices(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/\r?\n/);
  const out = [];
  list.forEach(item => {
    const choice = cleanLabel(item, CHOICE_MAX);
    if (choice && !out.some(x => x.toLowerCase() === choice.toLowerCase())) out.push(choice);
  });
  return out.slice(0, MAX_CHOICES);
}
const CUSTOM_KEY = /^x_[a-z0-9]{4,40}$/;
function newCustomKey() {
  return `x_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
function submittedName(field) {
  return field.builtin ? field.key : `${EXTRA_PREFIX}${field.label}`;
}

function defaultFields(formId) {
  const def = formById(formId);
  if (!def) return [];
  return def.fields.map(field => {
    const out = { key: field.key, label: field.label, type: field.type, required: field.required, builtin: true, removed: false };
    if (field.choices) out.choices = field.choices.slice();
    if (field.group) out.group = field.group;
    return out;
  });
}

// One form's question list from the editor (or the stored row), made safe.
//   previous: the stored draft list. Removed flags ALWAYS come from `previous` (or from the input when
//             trustRemoved, i.e. reading our own stored row), so only remove_field / restore_field (logged)
//             can change them. A question missing from the input is kept from `previous`: nothing can vanish
//             without the log.
function normalizeFields(formId, input, { previous = null, trustRemoved = false } = {}) {
  const def = formById(formId);
  if (!def) return { fields: [], errors: ["That form does not exist."] };
  const prior = Array.isArray(previous) ? previous : defaultFields(formId);
  const priorByKey = new Map(prior.map(field => [field.key, field]));
  const errors = [];
  const out = [];
  const seen = new Set();
  const list = Array.isArray(input) ? input : [];
  let customCount = 0;
  const removedFlag = (item, key) => (trustRemoved ? item?.removed === true : priorByKey.get(key)?.removed === true);

  list.forEach(item => {
    const key = String(item?.key ?? "").trim();
    if (!key || seen.has(key)) return;
    const builtin = def.fields.find(field => field.key === key);
    if (builtin) {
      seen.add(key);
      const entry = {
        key,
        label: builtin.lockLabel ? builtin.label : (cleanLabel(item.label) || builtin.label),
        type: builtin.type,
        required: builtin.lockRequired ? builtin.required : item.required === true,
        builtin: true,
        removed: removedFlag(item, key)
      };
      if (builtin.choices) {
        const choices = builtin.lockChoices ? builtin.choices.slice() : cleanChoices(item.choices);
        if (!choices.length) errors.push(`Add at least one choice for "${entry.label}".`);
        entry.choices = choices.length ? choices : builtin.choices.slice();
      }
      if (builtin.group) entry.group = builtin.group;
      out.push(entry);
      return;
    }
    if (!CUSTOM_KEY.test(key)) return;
    const type = CUSTOM_TYPES.includes(item.type) ? item.type : "";
    if (!type) { errors.push("A new question needs a type."); return; }
    const label = cleanLabel(item.label);
    if (!label) { errors.push("A new question needs its wording."); return; }
    customCount += 1;
    if (customCount > MAX_CUSTOM) { errors.push(`A form can have at most ${MAX_CUSTOM} added questions.`); return; }
    seen.add(key);
    const entry = { key, label, type, required: item.required === true, builtin: false, removed: priorByKey.has(key) || trustRemoved ? removedFlag(item, key) : false };
    if (CHOICE_TYPES.has(type)) {
      const choices = cleanChoices(item.choices);
      if (!choices.length) errors.push(`Add at least one choice for "${label}".`);
      entry.choices = choices.length ? choices : ["Option 1"];
    }
    if (type === "yesno") entry.choices = ["Yes", "No"];
    const placeholder = cleanLabel(item.placeholder, 120);
    if (placeholder && !CHOICE_TYPES.has(type) && type !== "yesno") entry.placeholder = placeholder;
    if (def.grouped) entry.group = item.group === "dog" ? "dog" : "client";
    out.push(entry);
  });

  // Never lose a question silently: anything the stored list had that the input left out comes back.
  prior.forEach(field => {
    if (seen.has(field.key)) return;
    if (!field.builtin && !CUSTOM_KEY.test(field.key)) return;
    seen.add(field.key);
    out.push(clone(field));
  });
  // Built-ins the stored list never had (an older row) come back at the end, not removed.
  def.fields.forEach(field => {
    if (seen.has(field.key)) return;
    seen.add(field.key);
    out.push(defaultFields(formId).find(x => x.key === field.key));
  });

  // Two added questions with the same wording would be submitted under one name.
  const labels = new Map();
  out.filter(field => !field.builtin && !field.removed).forEach(field => {
    const k = field.label.toLowerCase();
    if (labels.has(k)) errors.push(`Two added questions say "${field.label}". Change one of them.`);
    labels.set(k, true);
  });
  return { fields: out, errors: [...new Set(errors)] };
}

function blankStore() {
  return {
    v: 1,
    draft: { forms: {}, revision: 0, saved_by: "", saved_at: "" },
    published: { forms: {}, revision: 0, published_by: "", published_at: "" },
    sent_from_practice: null,
    log: []
  };
}

// The stored row, made safe (a hand-edited or older row can never break a page).
function normalizeStore(value) {
  const store = blankStore();
  if (!value || typeof value !== "object") return store;
  ["draft", "published"].forEach(side => {
    const src = value[side] && typeof value[side] === "object" ? value[side] : {};
    const forms = src.forms && typeof src.forms === "object" ? src.forms : {};
    FORM_IDS.forEach(id => {
      if (Array.isArray(forms[id])) store[side].forms[id] = normalizeFields(id, forms[id], { trustRemoved: true, previous: [] }).fields;
    });
    store[side].revision = Number.isInteger(src.revision) && src.revision > 0 ? src.revision : 0;
    if (side === "draft") { store.draft.saved_by = cleanLabel(src.saved_by, 200); store.draft.saved_at = String(src.saved_at || "").slice(0, 40); }
    else { store.published.published_by = cleanLabel(src.published_by, 200); store.published.published_at = String(src.published_at || "").slice(0, 40); }
  });
  if (value.sent_from_practice && typeof value.sent_from_practice === "object") {
    const s = value.sent_from_practice;
    store.sent_from_practice = { name: cleanLabel(s.name, 200), login: cleanLabel(s.login, 200), at: String(s.at || "").slice(0, 40), note: cleanLabel(s.note, 300) };
  }
  store.log = (Array.isArray(value.log) ? value.log : []).filter(entry => entry && typeof entry === "object" && entry.id).slice(-LOG_MAX);
  return store;
}

const draftFields = (store, formId) => store.draft.forms[formId] || store.published.forms[formId] || defaultFields(formId);
const publishedFields = (store, formId) => store.published.forms[formId] || defaultFields(formId);
const sameFields = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// What a public page needs to draw one form: the published questions, with a `diff` per question so the
// page only touches what the office actually changed. changed:false = leave the page exactly as it is.
function publicForm(store, formId) {
  const fields = publishedFields(store, formId);
  const defaults = defaultFields(formId);
  const byKey = new Map(defaults.map(field => [field.key, field]));
  const builtinOrder = fields.filter(field => field.builtin && !field.removed).map(field => field.key);
  const defaultOrder = defaults.map(field => field.key).filter(key => builtinOrder.includes(key));
  return {
    id: formId,
    changed: !sameFields(fields, defaults),
    orderChanged: builtinOrder.join("|") !== defaultOrder.join("|"),
    fields: fields.map(field => {
      const base = byKey.get(field.key);
      return {
        key: field.key,
        name: submittedName(field),
        label: field.label,
        type: field.type,
        required: field.required,
        builtin: field.builtin,
        removed: field.removed,
        ...(field.choices ? { choices: field.choices } : {}),
        ...(field.group ? { group: field.group } : {}),
        ...(field.placeholder ? { placeholder: field.placeholder } : {}),
        diff: base
          ? { label: base.label !== field.label, required: base.required !== field.required, choices: JSON.stringify(base.choices || null) !== JSON.stringify(field.choices || null) }
          : { label: true, required: true, choices: true }
      };
    })
  };
}
function publicForms(store) {
  const out = {};
  FORM_IDS.forEach(id => { out[id] = publicForm(store, id); });
  return { revision: store.published.revision, forms: out, fallbacks: FALLBACKS, extra_prefix: EXTRA_PREFIX };
}

// ---------------------------------------------------------------------------
// Operations. Each returns { store, log? } or throws an Error with .status.
// ---------------------------------------------------------------------------
const fail = (status, message) => Object.assign(new Error(message), { status });
const now = () => new Date().toISOString();
function logId() { return `lf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; }
function pushLog(store, entry) {
  const row = { id: logId(), at: now(), ...entry };
  store.log.push(row);
  if (store.log.length > LOG_MAX) store.log = store.log.slice(-LOG_MAX);
  return row;
}
const actorLabel = actor => {
  const name = cleanLabel(actor?.name, 200);
  const login = cleanLabel(actor?.email, 200);
  return name && login && name.toLowerCase() !== login.toLowerCase() ? `${name} (${login})` : name || login || "Office staff";
};
function requireForm(formId) {
  if (!formById(formId)) throw fail(400, "That form does not exist.");
}

function saveDraft(store, formId, fields, actor) {
  requireForm(formId);
  const next = clone(store);
  const { fields: clean, errors } = normalizeFields(formId, fields, { previous: draftFields(next, formId) });
  if (errors.length) throw Object.assign(fail(400, errors.join(" ")), { errors });
  next.draft.forms[formId] = clean;
  next.draft.revision += 1;
  next.draft.saved_by = actorLabel(actor);
  next.draft.saved_at = now();
  return { store: next };
}

function removeField(store, formId, key, { fields, actor, name }) {
  requireForm(formId);
  const typed = fullNameOrEmpty(name);
  if (!typed) throw fail(400, "Type your full name (first and last) so the log shows who removed this question.");
  let next = fields ? saveDraft(store, formId, fields, actor).store : clone(store);
  const list = draftFields(next, formId).map(field => ({ ...field }));
  const target = list.find(field => field.key === key);
  if (!target) throw fail(404, "That question is not on this form.");
  if (target.removed) throw fail(409, `"${target.label}" is already removed from this form.`);
  target.removed = true;
  next.draft.forms[formId] = list;
  if (!fields) next.draft.revision += 1;
  next.draft.saved_by = actorLabel(actor);
  next.draft.saved_at = now();
  const entry = pushLog(next, {
    action: "removed", form: formId, form_label: formById(formId).label, field_key: key, field_label: target.label,
    effect: effectFor(formId, key), by_name: typed, by_login: cleanLabel(actor?.email, 200)
  });
  return { store: next, log: entry };
}

function restoreField(store, formId, key, { fields, actor, name, logEntryId }) {
  requireForm(formId);
  let next = fields ? saveDraft(store, formId, fields, actor).store : clone(store);
  const list = draftFields(next, formId).map(field => ({ ...field }));
  const target = list.find(field => field.key === key);
  if (!target) throw fail(404, "That question is not on this form.");
  if (!target.removed) throw fail(409, `"${target.label}" is already on this form.`);
  target.removed = false;
  next.draft.forms[formId] = list;
  if (!fields) next.draft.revision += 1;
  next.draft.saved_by = actorLabel(actor);
  next.draft.saved_at = now();
  const who = fullNameOrEmpty(name) || cleanLabel(actor?.name, 200) || "Office staff";
  const when = now();
  next.log = next.log.map(entry => (entry.action === "removed" && entry.form === formId && entry.field_key === key && !entry.undone_at && (!logEntryId || entry.id === logEntryId))
    ? { ...entry, undone_at: when, undone_by: who }
    : entry);
  const entry = pushLog(next, { action: "restored", form: formId, form_label: formById(formId).label, field_key: key, field_label: target.label, by_name: who, by_login: cleanLabel(actor?.email, 200) });
  return { store: next, log: entry };
}

function unpublishedForms(store) {
  return FORM_IDS.filter(id => !sameFields(draftFields(store, id), publishedFields(store, id)));
}

function publish(store, { actor, name }) {
  const typed = fullNameOrEmpty(name);
  if (!typed) throw fail(400, "Type your full name (first and last) so the log shows who published the forms.");
  const changed = unpublishedForms(store);
  if (!changed.length) throw fail(409, "There are no unpublished form changes.");
  const next = clone(store);
  changed.forEach(id => { next.published.forms[id] = clone(draftFields(next, id)); });
  next.published.revision += 1;
  next.published.published_by = `${typed}${actor?.email ? ` (${cleanLabel(actor.email, 200)})` : ""}`;
  next.published.published_at = now();
  const entry = pushLog(next, { action: "published", forms: changed, form_labels: changed.map(id => formById(id).label), revision: next.published.revision, by_name: typed, by_login: cleanLabel(actor?.email, 200) });
  return { store: next, log: entry };
}

function discardDraft(store, formId, { actor }) {
  requireForm(formId);
  const next = clone(store);
  const had = !sameFields(draftFields(next, formId), publishedFields(next, formId));
  if (!had) throw fail(409, "This form has no unpublished changes.");
  if (next.published.forms[formId]) next.draft.forms[formId] = clone(next.published.forms[formId]);
  else delete next.draft.forms[formId];
  next.draft.revision += 1;
  next.draft.saved_by = actorLabel(actor);
  next.draft.saved_at = now();
  // A removal that was never published is taken back by this too: say so in the log.
  const when = now();
  next.log = next.log.map(entry => (entry.action === "removed" && entry.form === formId && !entry.undone_at && !(publishedFields(next, formId).find(x => x.key === entry.field_key)?.removed))
    ? { ...entry, undone_at: when, undone_by: `${cleanLabel(actor?.name, 200) || "Office staff"} (discarded unpublished changes)` }
    : entry);
  const entry = pushLog(next, { action: "discarded", form: formId, form_label: formById(formId).label, by_name: cleanLabel(actor?.name, 200) || "Office staff", by_login: cleanLabel(actor?.email, 200) });
  return { store: next, log: entry };
}

function resetForm(store, formId, { actor, name }) {
  requireForm(formId);
  const typed = fullNameOrEmpty(name);
  if (!typed) throw fail(400, "Type your full name (first and last) so the log shows who reset this form.");
  const next = clone(store);
  const before = draftFields(next, formId);
  next.draft.forms[formId] = defaultFields(formId);
  next.draft.revision += 1;
  next.draft.saved_by = actorLabel(actor);
  next.draft.saved_at = now();
  const when = now();
  next.log = next.log.map(entry => (entry.action === "removed" && entry.form === formId && !entry.undone_at) ? { ...entry, undone_at: when, undone_by: `${typed} (reset to the original)` } : entry);
  const entry = pushLog(next, { action: "reset", form: formId, form_label: formById(formId).label, by_name: typed, by_login: cleanLabel(actor?.email, 200), before_count: before.length });
  return { store: next, log: entry };
}

// Send to live (api/send-to-live.js kind "lead_forms"): the practice DRAFT becomes the LIVE row's draft.
// The live published forms, revision, date and publisher are never touched (assertPublishedUnchanged).
function receiveFromPractice(liveStore, practiceStore, { name, login, at }) {
  const next = clone(liveStore);
  const incoming = {};
  FORM_IDS.forEach(id => { if (practiceStore.draft.forms[id]) incoming[id] = clone(practiceStore.draft.forms[id]); });
  next.draft.forms = incoming;
  next.draft.revision += 1;
  next.draft.saved_by = `${name} (${login}) from the practice copy`;
  next.draft.saved_at = at;
  const note = `Sent from practice copy by ${name} (${login}) on ${officeTime(new Date(at))}`;
  next.sent_from_practice = { name, login, at, note };
  // The practice copy's removal records travel with the forms, so the live log shows who removed what.
  const known = new Set(next.log.map(entry => entry.id));
  (practiceStore.log || []).filter(entry => !known.has(entry.id) && ["removed", "restored", "reset"].includes(entry.action)).forEach(entry => next.log.push({ ...entry, via: "practice copy" }));
  pushLog(next, { action: "sent_from_practice", forms: Object.keys(incoming), by_name: name, by_login: login, note });
  next.log = next.log.slice(-LOG_MAX);
  assertPublishedUnchanged(liveStore, next);
  return next;
}
function assertPublishedUnchanged(before, after) {
  if (JSON.stringify(before.published) !== JSON.stringify(after.published)) throw fail(500, "Send to live refused to change the published forms.");
  return after;
}

function fullNameOrEmpty(value) {
  const name = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  return name.split(" ").filter(Boolean).length >= 2 ? name : "";
}
function officeTime(date) {
  return `${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(date)} ET`;
}

// Everything the portal editor draws.
function editorPayload(store, extra = {}) {
  const unpublished = new Set(unpublishedForms(store));
  return {
    ok: true,
    ...extra,
    types: FIELD_TYPES,
    custom_effect: CUSTOM_EFFECT,
    extra_prefix: EXTRA_PREFIX,
    forms: FORMS.map(def => ({
      id: def.id, label: def.label, where: def.where, note: def.note || "", open: def.open, grouped: Boolean(def.grouped),
      builtins: def.fields.map(field => ({ key: field.key, label: field.label, lockLabel: Boolean(field.lockLabel), lockRequired: Boolean(field.lockRequired), lockChoices: Boolean(field.lockChoices), feeds: field.feeds || "", onlyOn: field.onlyOn || "", group: field.group || "" })),
      effects: Object.fromEntries(def.fields.map(field => [field.key, effectFor(def.id, field.key)])),
      choice_notes: Object.fromEntries(def.fields.filter(field => choiceNoteFor(def.id, field.key)).map(field => [field.key, choiceNoteFor(def.id, field.key)])),
      defaults: defaultFields(def.id),
      draft: draftFields(store, def.id),
      published: publishedFields(store, def.id),
      unpublished: unpublished.has(def.id),
      changed_from_original: !sameFields(publishedFields(store, def.id), defaultFields(def.id))
    })),
    draft: { revision: store.draft.revision, saved_by: store.draft.saved_by, saved_at: store.draft.saved_at },
    published: { revision: store.published.revision, published_by: store.published.published_by, published_at: store.published.published_at },
    sent_from_practice: store.sent_from_practice,
    log: store.log.slice(-120).reverse()
  };
}

// ---------------------------------------------------------------------------
// Database helpers. `sb` = lib/booking.js sbOrThrow, which goes through the schema switch (lib/sandbox.js
// supabaseRequest: practice on the practice copy). Required lazily, so no require loop can ever form.
// ---------------------------------------------------------------------------
const switchedSb = (...args) => require("./booking").sbOrThrow(...args);

async function loadStore(sb = switchedSb) {
  const rows = await sb(`/rest/v1/site_settings?key=eq.${SETTINGS_KEY}&select=value,updated_at,updated_by&limit=1`);
  const row = Array.isArray(rows) ? rows[0] : null;
  return { store: normalizeStore(row?.value), updated_at: row?.updated_at || null, exists: Boolean(row) };
}

// Optimistic: the write only lands when the row is still the one we read (updated_at), so two people
// editing at once never overwrite each other silently; the second gets a plain 409.
async function saveStore(sb, loaded, store, updatedBy) {
  const body = { value: store, updated_by: cleanLabel(updatedBy, 200) || null, updated_at: now() };
  let rows;
  if (loaded.exists) {
    rows = await sb(`/rest/v1/site_settings?key=eq.${SETTINGS_KEY}&updated_at=eq.${encodeURIComponent(loaded.updated_at)}`, { method: "PATCH", prefer: "return=representation", body });
  } else {
    try {
      rows = await sb("/rest/v1/site_settings", { method: "POST", prefer: "return=representation", body: { key: SETTINGS_KEY, ...body } });
    } catch (error) {
      if (error.status === 409 || error.code === "23505") rows = [];
      else throw error;
    }
  }
  if (!Array.isArray(rows) || !rows.length) throw fail(409, "Someone else just changed the forms. Your screen was refreshed; please make your change again.");
  return { store: normalizeStore(rows[0].value), updated_at: rows[0].updated_at, exists: true };
}

// The published question list for one form, for the server side of a form (the booking page). Any
// database trouble answers null, and the caller falls back to the original questions.
async function loadPublishedFields(sb, formId) {
  try {
    const { store } = await loadStore(sb);
    return publishedFields(store, formId);
  } catch {
    return null;
  }
}

// "Extra: <question>" answers on a stored lead (custom questions on website forms).
function extraAnswers(raw) {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .filter(([key, value]) => key.startsWith(EXTRA_PREFIX) && String(value ?? "").trim())
    .map(([key, value]) => ({ label: key.slice(EXTRA_PREFIX.length), value: String(value) }));
}

module.exports = {
  SETTINGS_KEY, EXTRA_PREFIX, FIELD_TYPES, CUSTOM_TYPES, FORMS, FORM_IDS, FALLBACKS, CUSTOM_EFFECT, LABEL_MAX, MAX_CUSTOM,
  formById, defaultFields, normalizeFields, normalizeStore, blankStore, draftFields, publishedFields, publicForm, publicForms,
  effectFor, choiceNoteFor, cleanLabel, cleanChoices, newCustomKey, submittedName, unpublishedForms,
  saveDraft, removeField, restoreField, publish, discardDraft, resetForm, receiveFromPractice, assertPublishedUnchanged,
  editorPayload, loadStore, saveStore, loadPublishedFields, extraAnswers, fullNameOrEmpty, actorLabel
};
