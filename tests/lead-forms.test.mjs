// The lead form editor (portal chain step 4, DO-NOT-BREAK rule 75). Run: node --test tests/
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project: every Supabase call goes to a
// fake that keeps TWO schemas (practice / public) and picks one from the PostgREST profile headers.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "1";
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const LF = require("../lib/lead-forms.js");
const B = require("../lib/booking.js");
const M = require("../lib/office-email.js");
const { renderBookingPage } = require("../lib/booking-page.js");

const OFFICE = { user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "melissa@lorenzosdogtrainingteam.com", first_name: "Melissa", last_name: "Zuk" };
const ACTOR = { id: "u-office", email: OFFICE.email, name: "Melissa Zuk" };

// Names of the visible questions in one <form …class="…cls…"> of a page, in page order.
function visibleNames(html, cls) {
  const start = html.search(new RegExp(`<form[^>]*class="[^"]*${cls}[^"]*"`));
  const form = html.slice(start, html.indexOf("</form>", start));
  const names = [];
  for (const m of form.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = m[2];
    const name = attrs.match(/\bname="([^"]+)"/)?.[1];
    if (!name || /type="hidden"/.test(attrs) || names.includes(name)) continue;
    names.push(name);
  }
  return names;
}
const keys = formId => LF.defaultFields(formId).map(f => f.key);

test("the original questions are exactly what each page has today (so an unchanged form is never touched)", () => {
  assert.deepEqual(keys("contact"), visibleNames(read("contact.html"), "contact-intake"));
  assert.deepEqual(keys("get_started"), visibleNames(read("get-started.html"), "contact-intake"));
  assert.deepEqual(keys("ad_landing"), visibleNames(read("dog-training-cleveland-oh.html"), "contact-intake"));
  assert.deepEqual(keys("booklet").filter(k => visibleNames(read("get-started.html"), "market-guide-form").includes(k)), visibleNames(read("get-started.html"), "market-guide-form"));
  const contactOptions = [...read("contact.html").match(/<select required name="i_want_to">([\s\S]*?)<\/select>/)[1].matchAll(/<option>([^<]+)<\/option>/g)].map(m => m[1]);
  assert.deepEqual(LF.defaultFields("contact").find(f => f.key === "i_want_to").choices, contactOptions);
  const app = read("trainer-backoffice/app.js");
  const trainerForm = app.slice(app.indexOf("function officeLeadFormMarkup("), app.indexOf("function trainerVideoFor("));
  const trainerNames = [...trainerForm.matchAll(/<(?:input|select|textarea)[^>]*\bname="([^"]+)"/g)].map(m => m[1]).filter(n => !/^(trainer_|assigned_trainer|vet_or_previous_client|source_page)/.test(n));
  assert.deepEqual([...keys("trainer_consult")].filter(k => k !== "heard_about_us").sort(), [...new Set(trainerNames)].sort());
  assert.match(trainerForm, /heardAboutUsSelect\(\)/);
  // Every form with no published change reads changed:false, so the page is left exactly as it is.
  const pub = LF.publicForms(LF.blankStore());
  LF.FORM_IDS.forEach(id => assert.equal(pub.forms[id].changed, false, id));
});

test("save: rename, required, reorder, add a question; office text is cleaned; the consent wording and Alpha choices are locked", () => {
  const fields = LF.defaultFields("contact");
  const phone = fields.find(f => f.key === "phone");
  phone.label = "Cell <b>phone</b> *";
  fields.find(f => f.key === "comments").required = false;
  fields.find(f => f.key === "sms_consent").label = "Promotional offers!"; // rule 47: must not stick
  fields.find(f => f.key === "sms_consent").required = true;
  fields.unshift(fields.splice(fields.findIndex(f => f.key === "email"), 1)[0]);
  fields.push({ key: "x_dogage1", label: "How old is your dog? <script>alert(1)</script>", type: "number", required: true });
  fields.push({ key: "x_goals01", label: "Goals", type: "checkboxes", choices: "Leash\nBarking\n\nleash" });
  const { store } = LF.saveDraft(LF.blankStore(), "contact", fields, ACTOR);
  const saved = LF.draftFields(store, "contact");
  assert.equal(saved[0].key, "email");
  assert.equal(saved.find(f => f.key === "phone").label, "Cell b phone /b", "angle brackets become spaces, the trailing * goes");
  assert.doesNotMatch(JSON.stringify(saved), /[<>]/, "no angle brackets survive");
  assert.equal(saved.find(f => f.key === "comments").required, false);
  const consent = saved.find(f => f.key === "sms_consent");
  assert.equal(consent.label, "Texting consent box");
  assert.equal(consent.required, false, "texting consent can never be made required (consent is not a condition)");
  assert.deepEqual(saved.find(f => f.key === "x_goals01").choices, ["Leash", "Barking"], "choices trimmed, blank and duplicate lines dropped");
  assert.equal(saved.find(f => f.key === "x_dogage1").required, true);
  assert.equal(LF.submittedName(saved.find(f => f.key === "x_dogage1")), "Extra: How old is your dog? script alert(1) /script");
  // Booking: Alpha's answer lists cannot be edited.
  const booking = LF.defaultFields("booking_eval");
  booking.find(f => f.key === "sex").choices = ["Boy", "Girl"];
  const b = LF.saveDraft(LF.blankStore(), "booking_eval", booking, ACTOR).store;
  assert.deepEqual(LF.draftFields(b, "booking_eval").find(f => f.key === "sex").choices, ["Male", "Female"]);
  // Two added questions with the same words would submit under one name.
  assert.throws(() => LF.saveDraft(LF.blankStore(), "contact", [...LF.defaultFields("contact"), { key: "x_aaaa1", label: "Vet", type: "text" }, { key: "x_bbbb2", label: "vet", type: "text" }], ACTOR), /Two added questions say/);
});

test("remove: warning text, full name required, logged (who, when, which form, which question), undo puts it back; saving can never un-remove or silently drop a question", () => {
  assert.throws(() => LF.removeField(LF.blankStore(), "contact", "phone", { actor: ACTOR, name: "Melissa" }), /full name/);
  assert.match(LF.effectFor("contact", "phone"), /TEXTS STOP/);
  assert.match(LF.effectFor("ad_landing", "zip"), /TRAINER MATCHING STOPS/);
  assert.match(LF.effectFor("contact", "sms_consent"), /NO TEXTS AT ALL/);
  assert.match(LF.effectFor("contact", "i_want_to"), /office follow-up with NO text/);
  assert.match(LF.effectFor("booking_eval", "breed"), /Rachel's 11 required fields/);
  const removed = LF.removeField(LF.blankStore(), "contact", "phone", { actor: ACTOR, name: "Melissa Zuk" });
  const entry = removed.log;
  assert.equal(entry.action, "removed");
  assert.equal(entry.form, "contact");
  assert.equal(entry.field_key, "phone");
  assert.equal(entry.field_label, "Phone");
  assert.equal(entry.by_name, "Melissa Zuk");
  assert.equal(entry.by_login, OFFICE.email);
  assert.match(entry.effect, /TEXTS STOP/);
  assert.ok(Date.parse(entry.at));
  assert.equal(LF.draftFields(removed.store, "contact").find(f => f.key === "phone").removed, true);
  assert.throws(() => LF.removeField(removed.store, "contact", "phone", { actor: ACTOR, name: "Melissa Zuk" }), /already removed/);
  // A save that claims the question is back (or leaves it out) does not change the removal.
  const sneaky = LF.defaultFields("contact").filter(f => f.key !== "zip");
  const afterSave = LF.saveDraft(removed.store, "contact", sneaky, ACTOR).store;
  assert.equal(LF.draftFields(afterSave, "contact").find(f => f.key === "phone").removed, true, "only restore_field (logged) brings it back");
  assert.ok(LF.draftFields(afterSave, "contact").some(f => f.key === "zip"), "a question left out of a save is kept, never dropped");
  // Undo.
  const back = LF.restoreField(afterSave, "contact", "phone", { actor: ACTOR, name: "Rachel Leggett", logEntryId: entry.id });
  assert.equal(LF.draftFields(back.store, "contact").find(f => f.key === "phone").removed, false);
  const original = back.store.log.find(e => e.id === entry.id);
  assert.equal(original.undone_by, "Rachel Leggett");
  assert.ok(original.undone_at);
  assert.equal(back.log.action, "restored");
});

test("publish: needs a full name, copies the draft, and the public answer carries only the office's changes", () => {
  let s = LF.blankStore();
  const f = LF.defaultFields("get_started");
  f.find(x => x.key === "i_want_to").choices = ["Leash pulling", "Barking"];
  f.find(x => x.key === "comments").label = "Tell us about your dog";
  f.push({ key: "x_dogage1", label: "Dog's age", type: "text", required: false });
  s = LF.saveDraft(s, "get_started", f, ACTOR).store;
  s = LF.removeField(s, "get_started", "zip", { actor: ACTOR, name: "Melissa Zuk" }).store;
  assert.deepEqual(LF.unpublishedForms(s), ["get_started"]);
  assert.throws(() => LF.publish(s, { actor: ACTOR, name: "x" }), /full name/);
  const p = LF.publish(s, { actor: ACTOR, name: "Melissa Zuk" });
  assert.equal(p.store.published.revision, 1);
  assert.match(p.store.published.published_by, /Melissa Zuk/);
  const pub = LF.publicForm(p.store, "get_started");
  assert.equal(pub.changed, true);
  assert.equal(pub.orderChanged, false);
  const byKey = Object.fromEntries(pub.fields.map(x => [x.key, x]));
  assert.deepEqual(byKey.i_want_to.diff, { label: false, required: false, choices: true });
  assert.deepEqual(byKey.comments.diff, { label: true, required: false, choices: false });
  assert.deepEqual(byKey.first_name.diff, { label: false, required: false, choices: false });
  assert.equal(byKey.zip.removed, true);
  assert.equal(byKey.x_dogage1.name, "Extra: Dog's age");
  assert.equal(LF.publicForm(p.store, "contact").changed, false, "other forms are untouched");
  assert.throws(() => LF.publish(p.store, { actor: ACTOR, name: "Melissa Zuk" }), /no unpublished/);
});

// ---------------------------------------------------------------------------
// The API, against a fake two-schema Supabase.
// ---------------------------------------------------------------------------
function fakeSupabase() {
  const db = { practice: { site_settings: [], audit_events: [], send_to_live_log: [] }, public: { site_settings: [], audit_events: [] } };
  const calls = [];
  let tick = 0;
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || headers.authorization || "").replace(/^Bearer\s+/, "");
      return token === "office-token" ? json(200, { id: OFFICE.user_id, email: OFFICE.email }) : json(401, { message: "bad token" });
    }
    const schema = headers["Accept-Profile"] || headers["Content-Profile"] || "public";
    const table = u.pathname.replace("/rest/v1/", "");
    calls.push({ schema, table, method, params: Object.fromEntries(u.searchParams), body: options.body ? JSON.parse(options.body) : null });
    if (table === "portal_users") return json(200, [OFFICE]);
    const rows = db[schema]?.[table];
    if (!rows) return json(404, { message: `no table ${schema}.${table}` });
    const match = row => [...u.searchParams].every(([k, v]) => ["select", "limit", "order", "on_conflict"].includes(k) || (v.startsWith("eq.") ? String(row[k]) === v.slice(3) : true));
    if (method === "GET") return json(200, rows.filter(match));
    const body = JSON.parse(options.body);
    if (method === "POST") {
      if (table === "site_settings" && rows.some(r => r.key === body.key)) return json(409, { code: "23505", message: "duplicate" });
      const row = { ...body, updated_at: body.updated_at ? `${body.updated_at.slice(0, 19)}.${String(++tick).padStart(6, "0")}+00:00` : undefined };
      rows.push(row);
      return json(201, [row]);
    }
    if (method === "PATCH") {
      const hits = rows.filter(match);
      hits.forEach(row => Object.assign(row, body, { updated_at: `${String(body.updated_at || "2026-09-12T12:00:00").slice(0, 19)}.${String(++tick).padStart(6, "0")}+00:00` }));
      return json(200, hits);
    }
    return json(405, {});
  };
  return { db, calls };
}
const handler = () => { delete require.cache[require.resolve("../api/lead-forms.js")]; return require("../api/lead-forms.js"); };
async function call(method, { query = {}, body = null, token = "office-token" } = {}) {
  const res = { statusCode: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; }, send(p) { this.body = p; return this; }, end() { return this; } };
  await handler()({ method, query, body, headers: { authorization: token ? `Bearer ${token}` : "", host: "ldtt-sandbox.vercel.app" } }, res);
  return res;
}

test("API: 404 on live unless switched on; public forms need no login; the editor and every change need an office login", async () => {
  fakeSupabase();
  process.env.LDTT_SANDBOX = "";
  delete process.env.LDTT_LEAD_FORMS_LIVE;
  try {
    assert.equal((await call("GET", { query: { op: "public" } })).statusCode, 404);
    assert.equal((await call("POST", { body: { op: "publish", name: "A B" } })).statusCode, 404);
  } finally { process.env.LDTT_SANDBOX = "1"; }
  const pub = await call("GET", { query: { op: "public" }, token: "" });
  assert.equal(pub.statusCode, 200);
  assert.equal(pub.body.forms.contact.changed, false);
  assert.equal((await call("GET", { query: { op: "editor" }, token: "" })).statusCode, 403);
  assert.equal((await call("POST", { body: { op: "save_draft", form: "contact", fields: [] }, token: "" })).statusCode, 403);
  const editor = await call("GET", { query: { op: "editor" } });
  assert.equal(editor.statusCode, 200);
  assert.equal(editor.body.practice, true);
  assert.equal(editor.body.forms.length, LF.FORM_IDS.length);
  assert.match(editor.body.forms.find(f => f.id === "contact").effects.phone, /TEXTS STOP/);
});

test("API on the practice copy: save -> remove (logged + audit row) -> undo -> publish; every write lands in PRACTICE only", async () => {
  const { db, calls } = fakeSupabase();
  const fields = LF.defaultFields("contact");
  fields.push({ key: "x_dogage1", label: "Dog's age", type: "text", required: false });
  let res = await call("POST", { body: { op: "save_draft", form: "contact", fields } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  res = await call("POST", { body: { op: "remove_field", form: "contact", key: "zip", name: "Melissa" } });
  assert.equal(res.statusCode, 400, "one-word name refused");
  res = await call("POST", { body: { op: "remove_field", form: "contact", key: "zip", name: "Melissa Zuk" } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.log[0].action, "removed");
  assert.equal(res.body.log[0].by_name, "Melissa Zuk");
  const audit = db.practice.audit_events.find(r => r.action === "lead_form_removed");
  assert.ok(audit, "an audit row is written");
  assert.equal(audit.entity_type, "lead_form");
  assert.equal(audit.entity_id, "contact");
  assert.match(audit.actor_name, /Melissa Zuk \(login: melissa@/);
  assert.match(audit.summary, /removed "ZIP Code" from the Contact Us form/);
  res = await call("POST", { body: { op: "restore_field", form: "contact", key: "zip" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.forms.find(f => f.id === "contact").draft.find(f => f.key === "zip").removed, false);
  res = await call("POST", { body: { op: "remove_field", form: "contact", key: "phone", name: "Melissa Zuk" } });
  res = await call("POST", { body: { op: "publish", name: "Melissa Zuk" } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const pub = (await call("GET", { query: { op: "public" }, token: "" })).body.forms.contact;
  assert.equal(pub.changed, true);
  assert.equal(pub.fields.find(f => f.key === "phone").removed, true);
  assert.equal(pub.fields.find(f => f.key === "x_dogage1").name, "Extra: Dog's age");
  assert.equal(calls.filter(c => c.method !== "GET" && c.schema === "public").length, 0, "the practice copy never writes a live table");
  assert.equal(db.public.site_settings.length, 0);
});

test("API: two people editing at once - the second write gets a plain 409, nothing is overwritten", async () => {
  const { db } = fakeSupabase();
  await call("POST", { body: { op: "save_draft", form: "contact", fields: LF.defaultFields("contact") } });
  const before = JSON.stringify(db.practice.site_settings[0].value);
  const LFmod = require("../lib/lead-forms.js");
  const loaded = await LFmod.loadStore(B.sbOrThrow);
  db.practice.site_settings[0].updated_at = "2026-09-12T13:00:00.999999+00:00"; // someone else saved in between
  await assert.rejects(() => LFmod.saveStore(B.sbOrThrow, loaded, LFmod.blankStore(), "x"), err => err.status === 409 && /Someone else just changed the forms/.test(err.message));
  assert.equal(JSON.stringify(db.practice.site_settings[0].value), before);
});

test("API on LIVE (switched on): only publish / discard; forms are changed on the practice copy", async () => {
  fakeSupabase();
  process.env.LDTT_SANDBOX = "";
  process.env.LDTT_LEAD_FORMS_LIVE = "1";
  try {
    const res = await call("POST", { body: { op: "save_draft", form: "contact", fields: LF.defaultFields("contact") } });
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /changed on the practice copy/);
    assert.equal((await call("POST", { body: { op: "remove_field", form: "contact", key: "phone", name: "A B" } })).statusCode, 409);
    assert.equal((await call("GET", { query: { op: "editor" } })).body.can_edit, false);
    assert.equal((await call("POST", { body: { op: "publish", name: "A B" } })).statusCode, 409, "nothing to publish yet (a draft only arrives through Send to live)");
  } finally { process.env.LDTT_SANDBOX = "1"; delete process.env.LDTT_LEAD_FORMS_LIVE; }
});

test("Send to live helper: the live draft gets the practice draft + the sender's name; the live published forms never change", () => {
  let live = LF.blankStore();
  const f = LF.defaultFields("contact"); f.find(x => x.key === "phone").label = "Mobile";
  live = LF.publish(LF.saveDraft(live, "contact", f, ACTOR).store, { actor: ACTOR, name: "Live Person" }).store;
  let practice = LF.removeField(LF.blankStore(), "ad_landing", "zip", { actor: ACTOR, name: "Melissa Zuk" }).store;
  const next = LF.receiveFromPractice(live, practice, { name: "Angela Office", login: "angela@x.com", at: "2026-09-12T12:00:00.000Z" });
  assert.deepEqual(next.published, live.published);
  assert.equal(next.draft.forms.ad_landing.find(x => x.key === "zip").removed, true);
  assert.equal(next.sent_from_practice.name, "Angela Office");
  assert.match(next.sent_from_practice.note, /^Sent from practice copy by Angela Office \(angela@x\.com\) on Sep 12, 2026/);
  assert.ok(next.log.some(e => e.action === "removed" && e.via === "practice copy" && e.by_name === "Melissa Zuk"), "the live log shows who removed what on the practice copy");
  const tampered = { ...next, published: { ...next.published, revision: 99 } };
  assert.throws(() => LF.assertPublishedUnchanged(live, tampered), /refused to change the published forms/);
});

// ---------------------------------------------------------------------------
// The flow degrades exactly as the warning says; it never breaks.
// ---------------------------------------------------------------------------
test("booking questions: removed = not required; optional may be blank; added questions are checked and kept; no config = the original 11 required", () => {
  const body = { client: { first_name: "Ann", last_name: "Lee", phone: "", email: "ann@example.com", address: "" }, dogs: [{ name: "Rex", sex: "Male", fixed: "Yes", vaccinated: "Yes", age: "2", breed: "", behavior: "Pulls", custom: { x_walks01: "Daily" } }], client_custom: { x_vet00001: "" }, location: "in_home" };
  const strict = B.validateEvalForm(body, null);
  assert.ok(strict.errors.includes("Phone is required.") && strict.errors.includes("Physical address is required.") && strict.errors.includes("Dog 1: Breed is required."), "without a config nothing changed");
  const spec = LF.defaultFields("booking_eval").map(f => ({ ...f, removed: ["phone", "address"].includes(f.key) ? true : f.removed, required: f.key === "breed" ? false : f.required }));
  spec.push({ key: "x_vet00001", label: "Vet's name", type: "text", required: true, builtin: false, removed: false, group: "client" });
  spec.push({ key: "x_walks01", label: "How often walked?", type: "select", choices: ["Daily", "Weekly"], required: true, builtin: false, removed: false, group: "dog" });
  let result = B.validateEvalForm(body, null, spec);
  assert.deepEqual(result.errors, ["Vet's name is required."]);
  result = B.validateEvalForm({ ...body, client_custom: { x_vet00001: "Dr. Paws" } }, null, spec);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value.client_custom, [{ key: "x_vet00001", label: "Vet's name", value: "Dr. Paws" }]);
  assert.deepEqual(result.value.dogs[0].custom, [{ key: "x_walks01", label: "How often walked?", value: "Daily" }]);
  const bad = B.validateEvalForm({ ...body, client_custom: { x_vet00001: "Dr. Paws" }, dogs: [{ ...body.dogs[0], custom: { x_walks01: "Hourly" } }] }, null, spec);
  assert.deepEqual(bad.errors, ["Dog 1: How often walked? is required."], "an answer that is not one of the choices does not count");
});

test("booking page: questions come from the published form; removed ones are not drawn; without a config it asks the original 11", () => {
  const plain = renderBookingPage("lorenzo-miller", { practice: true });
  const spec = JSON.parse(plain.match(/var FORM = (\{.*?\});\n/)[1]);
  assert.deepEqual(spec.client.map(f => f.key), ["first_name", "last_name", "phone", "email", "address"]);
  assert.deepEqual(spec.dog.map(f => f.key), ["name", "sex", "fixed", "vaccinated", "age", "breed", "behavior"]);
  assert.ok([...spec.client, ...spec.dog].every(f => f.required));
  const fields = LF.defaultFields("booking_eval").map(f => (f.key === "age" ? { ...f, removed: true } : f));
  fields.push({ key: "x_vet00001", label: "Vet </script><script>alert(1)</script>", type: "text", required: true, builtin: false, removed: false, group: "client" });
  const page = renderBookingPage("lorenzo-miller", { practice: true, form: fields });
  assert.doesNotMatch(page, /<\/script><script>alert/, "office text can never close the page's script");
  const edited = JSON.parse(page.match(/var FORM = (\{.*?\});\n/)[1]);
  assert.ok(!edited.dog.some(f => f.key === "age"));
  assert.equal(edited.client.at(-1).key, "x_vet00001");
});

test("office emails carry the answers to added questions (booking page and website forms)", () => {
  const email = M.buildBookingEmail({
    lead: { id: "l1", raw_payload: { "Extra: Dog's age": "3", source_page: "contact.html" } },
    booking: { when_label: "Mon", client: { first_name: "Ann" }, client_custom: [{ label: "Vet's name", value: "Dr. Paws" }], dogs: [{ name: "Rex", custom: [{ label: "How often walked?", value: "Daily" }] }] }
  });
  assert.match(email.html, /Extra questions/);
  assert.match(email.html, /Dr\. Paws/);
  assert.match(email.html, /How often walked\?/);
  assert.match(email.text, /Dog's age: 3/);
  const plain = M.buildBookingEmail({ lead: { id: "l1", raw_payload: {} }, booking: { when_label: "Mon", client: { first_name: "Ann" }, dogs: [{ name: "Rex" }] } });
  assert.doesNotMatch(plain.html, /Extra questions/, "no section when there is nothing extra");
  assert.deepEqual(LF.extraAnswers({ "Extra: Q": "A", phone: "1" }), [{ label: "Q", value: "A" }]);
  // The 2.0 pages' extra answers are kept on the lead the same way.
  const intake = B.cleanLeadIntake({ first_name: "A", phone: "4405550100", answers: { "Dog's age": "2", "<b>x</b>": ["a", "b"] } }).value;
  assert.deepEqual(intake.extras, { "Extra: Dog's age": "2", "Extra: b x /b": "a, b" });
});

test("public pages: the form block only runs where /api/environment says so, never touches a pinned FormSubmit block, and live's environment answer is unchanged", async () => {
  const script = read("script.js");
  const block = script.slice(script.indexOf("// LEAD FORM EDITOR (portal chain step 4")).replace(/\/\/[^\n]*/g, ""); // code only, not the comments that name what it avoids
  assert.ok(block.length > 1000);
  assert.match(block, /if\(!env\?\.sandbox&&!env\?\.leadForms\) return;/);
  assert.match(block, /if\(!config\|\|!config\.changed\) return;/);
  assert.doesNotMatch(block, /formsubmit|form-delivery|relayFormDeliveries|submitEmailRelay|LDTT_FORM_DELIVERY/i);
  assert.ok(script.indexOf("// LEAD FORM EDITOR (portal chain step 4") > script.indexOf("const contactForm=document.querySelector('.contact-intake');"), "added after every pinned block");
  const env = require("../api/environment.js");
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status() { return this; }, json(p) { this.body = p; return this; } };
  process.env.LDTT_SANDBOX = "";
  try {
    await env({}, res);
    assert.equal("leadForms" in res.body, false, "live: the key is not even present");
  } finally { process.env.LDTT_SANDBOX = "1"; }
  await env({}, res);
  assert.equal(res.body.leadForms, true);
  // The portal: the third Page Editor door, the typing boxes on the whitelist, both shells load the editor.
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /tab\("formEditor", "Lead forms"/);
  assert.match(app, /\/\^data-lf-\(label\|choices\|new-label\|placeholder\|name\)=\/\.test\(pair\)/);
  assert.match(app, /\$\{leadExtraAnswersBlock\(lead\)\}\$\{leadBookingBlock\(lead\)\}<label>Status/);
  for (const shell of ["staff.html", "trainer-backoffice/index.html"]) assert.match(read(shell), /trainer-backoffice\/form-editor\.js\?v=/);
});
