// Joshua 2026-09-21: a trainer asks to change the phone their texts go to (trainer portal Settings); the office
// approves or denies it (Trainers screen). api/trainer-phone-change.js. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "";
process.env.RESEND_API_KEY = "re_test";
process.env.LDTT_MAKE_HOOK_PATHWAY2 = "https://hook.us1.make.com/pathway2test";
const handler = require("../api/trainer-phone-change.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const EXACT = "Lorenzo's Dog Training Team: Your phone number has been changed for notifications. If you did not mean to do this, please go back to your trainer portal and update your number to the proper number you want to receive leads, bookings and notifications on.";
const USERS = [
  { user_id: "u-trainer", role: "trainer", permission_level: "trainer", trainer_id: "t-1", active: true, access_status: "active", email: "harley@example.com", first_name: "Harley" },
  { user_id: "u-other", role: "trainer", permission_level: "trainer", trainer_id: "t-2", active: true, access_status: "active", email: "other@example.com" },
  { user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@example.com", first_name: "Angela" }
];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function world({ sandbox = false, testers = [] } = {}) {
  process.env.LDTT_SANDBOX = sandbox ? "1" : "";
  const store = {
    portal_users: USERS.map(u => ({ ...u })),
    trainers: [{ id: "t-1", full_name: "Harley McGrew", phone: "(216) 555-0101" }, { id: "t-2", full_name: "Other Trainer", phone: "(216) 555-0202" }],
    site_settings: [{ key: "pipeline_office_emails", value: { practice_email_to: "practice@example.com" }, updated_at: "2026-09-20T00:00:00Z" }],
    communications_testers: testers.map(phone => ({ id: randomUUID(), phone, active: true })),
    audit_events: []
  };
  const writes = [];
  const hooks = [];
  const emails = [];
  const pick = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "on_conflict"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
      if (op === "in") { const list = value.replace(/^\(|\)$/g, "").split(","); out = out.filter(r => list.includes(String(r[key]))); }
    }
    return out;
  };
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    const body = options.body ? JSON.parse(options.body) : null;
    if (u.host === "hook.us1.make.com") { hooks.push(body); return new Response("Accepted", { status: 200 }); }
    if (u.host === "api.resend.com") { emails.push(body); return json(200, { id: `email-${emails.length}` }); }
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || headers.authorization || "").replace(/^Bearer\s+/, "");
      const pu = USERS.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    if (sandbox) assert.equal(headers["Accept-Profile"], "practice", "every table call goes through the schema switch");
    const table = u.pathname.replace("/rest/v1/", "");
    if (!store[table]) return method === "GET" ? json(200, []) : json(404, {});
    if (method === "GET") return json(200, pick(store[table], u.searchParams));
    writes.push({ table, method, body, query: u.search });
    if (method === "POST") { const rows = (Array.isArray(body) ? body : [body]).map(r => ({ id: randomUUID(), ...r })); store[table].push(...rows); return json(201, rows); }
    if (method === "PATCH") { const hits = pick(store[table], u.searchParams); hits.forEach(r => Object.assign(r, body)); return json(200, hits); }
    return json(405, {});
  };
  const pending = () => store.site_settings.find(r => r.key === "trainer_phone_requests")?.value?.requests || {};
  return { store, writes, hooks, emails, pending };
}

async function call(method, body, token) {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(p) { this.body = p; return this; }, end() { return this; } };
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body, query: {} }, res);
  return res;
}
const trainer = (body, method = "POST") => call(method, body, "u-trainer-token");
const office = (body, method = "POST") => call(method, body, "u-office-token");

test("a trainer requests and cancels only for themselves; a bad number is refused; nothing on trainers changes", async () => {
  const w = world();
  assert.equal((await trainer({ action: "request", phone: "555-12" })).statusCode, 400);
  assert.equal((await trainer({ action: "request", phone: "(216) 555-0101" })).statusCode, 400, "the number already on file is refused");
  const res = await trainer({ action: "request", phone: "4405550199", trainer_id: "t-2" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(Object.keys(w.pending()), ["t-1"], "pinned to the caller's own trainer_id; the body's trainer_id is ignored");
  assert.equal(w.pending()["t-1"].phone, "(440) 555-0199");
  assert.equal(w.pending()["t-1"].requested_by_email, "harley@example.com");
  assert.equal(w.store.audit_events.at(-1).action, "trainer_phone_change_requested");
  assert.doesNotMatch(JSON.stringify(w.store.audit_events.at(-1)), /555-0199|5550199/, "the audit keeps phones masked");
  assert.equal(w.writes.filter(x => x.table === "trainers").length, 0, "no trainers write before the office approves");

  const mine = await trainer(undefined, "GET");
  assert.equal(mine.body.pending.phone, "(440) 555-0199");
  assert.equal(mine.body.current_last4, "0101");

  // The other trainer cannot cancel Harley's request (they only ever touch their own).
  assert.equal((await call("POST", { action: "cancel", trainer_id: "t-1" }, "u-other-token")).statusCode, 404);
  assert.ok(w.pending()["t-1"], "still pending");
  assert.equal((await trainer({ action: "cancel" })).statusCode, 200);
  assert.deepEqual(w.pending(), {});
  assert.equal(w.store.audit_events.at(-1).action, "trainer_phone_change_cancelled");
  // The office cannot file a request for a trainer.
  assert.equal((await office({ action: "request", phone: "4405550199" })).statusCode, 403);
});

test("live: the office approves -> trainers.phone formatted, the exact confirmation text to the NEW number, email to the portal login", async () => {
  const w = world();
  await trainer({ action: "request", phone: "+1 440 555 0199" });
  const list = await office(undefined, "GET");
  assert.equal(list.statusCode, 200);
  assert.deepEqual(list.body.requests.map(r => [r.trainer_id, r.trainer_name, r.phone, r.current_last4]), [["t-1", "Harley McGrew", "(440) 555-0199", "0101"]]);

  const res = await office({ action: "approve", trainer_id: "t-1", expected_phone: "(440) 555-0199" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const patch = w.writes.find(x => x.table === "trainers");
  assert.deepEqual(patch.body, { phone: "(440) 555-0199" }, "only the phone, formatted (xxx) xxx-xxxx");
  assert.match(patch.query, /id=eq\.t-1/);
  assert.equal(w.store.trainers[0].phone, "(440) 555-0199");
  assert.deepEqual(w.pending(), {}, "the request is gone");

  assert.equal(w.hooks.length, 1);
  assert.equal(w.hooks[0].pathway, "phone_changed");
  assert.equal(w.hooks[0].trainer_phone, "+14405550199", "to the NEW number");
  assert.equal(w.hooks[0].customer_phone, "", "trainer branch only");
  assert.equal(w.hooks[0].trainer_message, EXACT);
  assert.equal(res.body.text.status, "sent");

  assert.equal(w.emails.length, 1);
  assert.deepEqual(w.emails[0].to, ["harley@example.com"], "the trainer's portal login email");
  assert.ok(w.emails[0].text.includes(EXACT.replace("Lorenzo's Dog Training Team: ", "")));
  assert.equal(res.body.email.status, "sent");

  const approved = w.store.audit_events.find(a => a.action === "trainer_phone_change_approved");
  assert.deepEqual([approved.before_data.phone_last4, approved.after_data.phone_last4], ["0101", "0199"]);
  assert.equal(approved.actor_email, "angela@example.com");
  assert.equal((await office({ action: "approve", trainer_id: "t-1" })).statusCode, 404, "a second click finds nothing to approve");
  assert.equal(w.hooks.length, 1, "and texts nobody again");
});

test("practice copy: a new number that is not an active tester -> text skipped, email only to practice_email_to", async () => {
  const w = world({ sandbox: true, testers: ["+14402142915"] });
  await trainer({ action: "request", phone: "4405550199" });
  const res = await office({ action: "approve", trainer_id: "t-1" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(w.store.trainers[0].phone, "(440) 555-0199", "the practice trainer row changes");
  assert.equal(w.hooks.length, 0, "no text to a non-tester phone");
  assert.equal(res.body.text.status, "skipped");
  assert.match(res.body.text.reason, /not an active tester/);
  assert.deepEqual(w.emails.map(e => e.to), [["practice@example.com"]], "practice copy: never the trainer's real email");
  assert.match(w.emails[0].subject, /^\[PRACTICE COPY\]/);

  // A tester number does get the text on the practice copy.
  const t = world({ sandbox: true, testers: ["+14402142915"] });
  await trainer({ action: "request", phone: "(440) 214-2915" });
  const ok = await office({ action: "approve", trainer_id: "t-1" });
  assert.equal(ok.body.text.status, "sent");
  assert.equal(t.hooks[0].trainer_phone, "+14402142915");
  process.env.LDTT_SANDBOX = "";
});

test("deny: the request is removed, trainers untouched, the not-approved email goes out, audited", async () => {
  const w = world();
  await trainer({ action: "request", phone: "4405550199" });
  const res = await office({ action: "deny", trainer_id: "t-1" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(w.pending(), {});
  assert.equal(w.writes.filter(x => x.table === "trainers").length, 0);
  assert.equal(w.store.trainers[0].phone, "(216) 555-0101");
  assert.equal(w.hooks.length, 0, "no text on a denial");
  assert.deepEqual(w.emails[0].to, ["harley@example.com"]);
  assert.ok(w.emails[0].text.includes("Your phone change request was not approved. Contact the office."));
  assert.equal(w.store.audit_events.at(-1).action, "trainer_phone_change_denied");
});

test("a trainer cannot approve or deny (403) and cannot list other trainers' requests; no token -> 403", async () => {
  const w = world();
  await trainer({ action: "request", phone: "4405550199" });
  assert.equal((await trainer({ action: "approve", trainer_id: "t-1" })).statusCode, 403);
  assert.equal((await call("POST", { action: "deny", trainer_id: "t-1" }, "u-other-token")).statusCode, 403);
  assert.equal((await call("POST", { action: "approve", trainer_id: "t-1" })).statusCode, 403);
  const other = await call("GET", undefined, "u-other-token");
  assert.equal(other.body.pending, null, "another trainer sees only their own (none)");
  assert.equal(other.body.requests, undefined);
  assert.equal(w.writes.filter(x => x.table === "trainers").length, 0);
  assert.ok(w.pending()["t-1"], "still pending");
});

test("the portal: trainer Settings box, office Trainers section with Approve / Deny, the Trainers badge, typed-field whitelist", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /Phone for lead and booking texts/);
  assert.match(app, /Ask the office to change it/);
  assert.match(app, /Waiting for office approval: /);
  assert.match(app, /data-trainer-phone-cancel/);
  assert.match(app, /Phone change requests/);
  assert.match(app, /data-phone-change-decide="approve"/);
  assert.match(app, /data-phone-change-decide="deny"/);
  assert.match(app, /\["trainers", "Trainers", "users", phoneChangeRequestCount\(\)\]/);
  assert.match(app, /\/\^data-trainer-phone-new=\/\.test\(pair\)/, "rule 14: the new-phone box is on the typedFieldKey whitelist");
  const api = read("api/trainer-phone-change.js");
  assert.match(api, /supabaseRequest\(/);
  assert.match(api, /authorizeRequest\(req, res, \{ require: "any"/);
});
