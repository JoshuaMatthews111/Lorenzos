// Joshua 2026-09-14: the trainer one page opens on Dashboard; a lead opens its full details (with where the
// pre-evaluation questions were answered); a logged deal can be edited; the deal form fills from the lead.
// DO-NOT-BREAK rule 80. Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "1";
const submitDeal = require("../api/submit-deal.js");
const app = readFileSync(resolve(import.meta.dirname, "..", "trainer-backoffice/app.js"), "utf8");

const TRAINER = { user_id: "u-trainer", role: "trainer", permission_level: "trainer", trainer_id: "t-1", active: true, access_status: "active", email: "harley@example.com" };
const OTHER = { user_id: "u-other", role: "trainer", permission_level: "trainer", trainer_id: "t-2", active: true, access_status: "active", email: "other@example.com" };
const USERS = [TRAINER, OTHER];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// A small fake Supabase with GET / POST / PATCH / DELETE and eq filters.
function world({ paidInstallment = false, failPaymentInsertOnce = false } = {}) {
  const dealId = randomUUID();
  const store = {
    portal_users: USERS.map(u => ({ ...u })),
    leads: [{ id: "lead-1", status: "became_client" }],
    deals: [{ id: dealId, trainer_id: "t-1", lead_id: "lead-1", client_name: "Kathy Robinson", dog_name: "Bella", program: "Basic", sold_amount: 5000, collected_amount: 1000, plan_type: "monthly", installments: 4, sold_on: "2026-09-01", status: "open", notes: null, raw_payload: { source: "trainer_portal" } }],
    deal_payments: [
      { id: randomUUID(), deal_id: dealId, sequence: 0, amount: 1000, due_on: "2026-09-01", paid_on: "2026-09-01", paid_amount: 1000, status: "collected" },
      ...[1, 2, 3, 4].map(i => ({ id: randomUUID(), deal_id: dealId, sequence: i, amount: 1000, due_on: ["", "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"][i], paid_on: paidInstallment && i === 1 ? "2026-10-01" : null, paid_amount: paidInstallment && i === 1 ? 1000 : null, status: paidInstallment && i === 1 ? "paid" : "scheduled" }))
    ]
  };
  const writes = [];
  let failInsert = failPaymentInsertOnce;
  const pick = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
    }
    const limit = Number(params.get("limit") || 0);
    return limit ? out.slice(0, limit) : out;
  };
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || headers.authorization || "").replace(/^Bearer\s+/, "");
      const pu = USERS.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    const table = u.pathname.replace("/rest/v1/", "");
    if (!store[table]) return method === "GET" ? json(200, []) : json(404, { message: `no table ${table}` });
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "GET") return json(200, pick(store[table], u.searchParams));
    writes.push({ table, method, body });
    if (method === "POST") {
      if (table === "deal_payments" && failInsert) { failInsert = false; return json(500, { message: "insert failed" }); }
      const rows = (Array.isArray(body) ? body : [body]).map(row => ({ id: randomUUID(), ...row }));
      store[table].push(...rows); return json(201, rows);
    }
    if (method === "PATCH") { const hits = pick(store[table], u.searchParams); hits.forEach(r => Object.assign(r, body)); return json(200, hits); }
    if (method === "DELETE") { const hits = new Set(pick(store[table], u.searchParams)); store[table] = store[table].filter(r => !hits.has(r)); return new Response(null, { status: 204 }); }
    return json(405, {});
  };
  return { store, writes, dealId };
}

async function call(body, token = "u-trainer-token") {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; }, end() { return this; } };
  await submitDeal({ method: "POST", headers: { authorization: `Bearer ${token}` }, body, query: {} }, res);
  return res;
}

test("deal edit: names, dog, program and notes change; the money and the plan stay; the lead is never touched", async () => {
  const w = world();
  const res = await call({ op: "update", deal_id: w.dealId, client_name: "Kathy R. Robinson", dog_name: "Bella, Max", program: "Board & Train Programs", notes: "Two dogs" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.money_changed, false);
  const deal = w.store.deals[0];
  assert.deepEqual([deal.client_name, deal.dog_name, deal.program, deal.notes, deal.sold_amount], ["Kathy R. Robinson", "Bella, Max", "Board & Train Programs", "Two dogs", 5000]);
  assert.equal(w.store.deal_payments.length, 5, "the plan is untouched");
  assert.ok(!w.writes.some(x => x.table === "deal_payments"), "no payment write");
  assert.ok(!w.writes.some(x => x.table === "leads"), "the lead is never touched");
  assert.equal(deal.raw_payload.edits.length, 1);
  assert.equal(deal.raw_payload.edits[0].before.client_name, "Kathy Robinson", "what it was before is kept");
});

test("deal edit: new amounts rebuild the payment plan (no installment paid yet)", async () => {
  const w = world();
  const res = await call({ op: "update", deal_id: w.dealId, sold_amount: 6000, collected_amount: 2000, plan_type: "monthly", installments: 2, sold_on: "2026-09-01" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.money_changed, true);
  assert.equal(res.body.balance_due, 4000);
  const plan = w.store.deal_payments.filter(p => p.deal_id === w.dealId).sort((a, b) => a.sequence - b.sequence).map(p => [p.sequence, p.amount, p.status]);
  assert.deepEqual(plan, [[0, 2000, "collected"], [1, 2000, "scheduled"], [2, 2000, "scheduled"]]);
  assert.deepEqual([w.store.deals[0].sold_amount, w.store.deals[0].installments, w.store.deals[0].status], [6000, 2, "open"]);
});

test("deal edit: once the office marked a payment paid, the amounts are locked (409) but names still change", async () => {
  const w = world({ paidInstallment: true });
  const locked = await call({ op: "update", deal_id: w.dealId, sold_amount: 7000 });
  assert.equal(locked.statusCode, 409);
  assert.match(locked.body.message, /already marked paid/);
  assert.equal(w.store.deals[0].sold_amount, 5000);
  const names = await call({ op: "update", deal_id: w.dealId, program: "Service Dog Training" });
  assert.equal(names.statusCode, 200);
  assert.equal(w.store.deals[0].program, "Service Dog Training");
  assert.equal(w.store.deal_payments.length, 5, "the paid plan is never rebuilt");
});

test("deal edit: another trainer's deal is refused; a bad amount writes nothing", async () => {
  const w = world();
  const other = await call({ op: "update", deal_id: w.dealId, program: "Hack" }, "u-other-token");
  assert.equal(other.statusCode, 403);
  const bad = await call({ op: "update", deal_id: w.dealId, sold_amount: 100, collected_amount: 500 });
  assert.equal(bad.statusCode, 400);
  const none = await call({ op: "update", deal_id: w.dealId, sold_amount: 5000, collected_amount: 1000, plan_type: "paid_in_full" });
  assert.equal(none.statusCode, 400, "a balance cannot be 'paid in full'");
  assert.equal(w.writes.length, 0, "nothing was written");
  assert.equal((await call({ op: "update", deal_id: "not-an-id" })).statusCode, 400);
});

test("deal edit: if the new plan cannot be saved, the old plan is put back", async () => {
  const w = world({ failPaymentInsertOnce: true });
  const res = await call({ op: "update", deal_id: w.dealId, sold_amount: 6000, collected_amount: 2000, plan_type: "monthly", installments: 2 });
  assert.notEqual(res.statusCode, 200);
  const plan = w.store.deal_payments.filter(p => p.deal_id === w.dealId).map(p => p.sequence).sort();
  assert.deepEqual(plan, [0, 1, 2, 3, 4], "the original five payments are back");
});

test("deal submit (create) still works exactly as before", async () => {
  const w = world();
  const res = await call({ client_name: "New Client", program: "Basic", sold_amount: 1200, collected_amount: 1200 });
  assert.equal(res.statusCode, 200);
  assert.equal(w.store.deals.length, 2);
});

test("screens: opens on Dashboard, lead details with the pre-evaluation questions, deal form fills from the lead, deals edit", () => {
  // Opens at the top on Dashboard; only a tab tap from another screen jumps.
  assert.match(app, /if \(jump && jump !== "dashboard"\) requestAnimationFrame\(\(\) => scrollToTrainerSection\(jump, false\)\);/);
  assert.match(app, /else \{ state\.activeView = "dashboard"; window\.scrollTo\(0, 0\); markTrainerTab\("dashboard"\); \}/);
  // Joshua 2026-09-23: the one exception — a trainer who arrived on the deep link in their alert text
  // (/trainer-backoffice?view=leads&lead=<id>; old view=leadPipeline links land there too) opens on My Leads.
  assert.match(app, /else if \(state\.selectedLeadId && trainerOnePageViews\(\)\.includes\(state\.activeView\)\) \{\n\s*const landing = state\.activeView;\n\s*markTrainerTab\(landing\);\n\s*requestAnimationFrame\(\(\) => scrollToTrainerSection\(landing, false\)\);\n\s*\}/);
  // The deep link itself: an explicit ?view= is honoured, so the trainer portal is not forced to the
  // office "leads" screen, and /staff?lead=<id> still falls back to it.
  assert.match(app, /if \(leadId && \/\^\[0-9a-f-\]\{36\}\$\/i\.test\(leadId\)\) \{\n\s*if \(!view\) state\.activeView = "leads";\n\s*state\.selectedLeadId = leadId;\n\s*\}/);
  // Lead details: cards and rows open it; it is read-only and shows where the questions were answered.
  assert.match(app, /<article class="sales-card trainer-card" data-open-lead="\$\{escapeHtml\(lead\.id\)\}"/);
  const panel = app.match(/function trainerLeadDetailPanel\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(panel, /Pre-evaluation questions<\/span>\$\{leadPreEvalBlock\(booking\)\}/);
  assert.match(panel, /officeNotesFor\("lead", lead\.remoteId\)/);
  assert.match(panel, /portalActorName\(note\.created_by\)/, "office note bylines are names, never the login email (rule 70)");
  assert.doesNotMatch(panel, /data-lead-status|data-save-lead|data-new-office-note|runRemoteMutation/, "trainers cannot change the lead here (rule 7)");
  assert.match(app, /\$\{strip\}\$\{sections\}\$\{trainerLeadDetailPanel\(\)\}<\/div>/);
  // Deal form fills from the booking (name + every dog) and shows what the lead gave.
  const fill = app.match(/function dealPrefillFromLead\(lead\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(fill, /booking\.dogs/);
  assert.match(fill, /client\.first_name, client\.last_name/);
  assert.match(app, /\$\{dealLeadSummary\(f\.lead_id\)\}/);
  // Deals can be edited: button in View more, edit mode, op update, money locked when a payment is paid.
  assert.match(app, /data-deal-edit="\$\{escapeHtml\(deal\.id\)\}">Edit this deal<\/button>/);
  assert.match(app, /const editBody = f\.deal_id \? \{ op: "update", deal_id: f\.deal_id,/);
  assert.match(app, /money_locked: scheduled\.some\(p => p\.status === "paid" \|\| p\.paid_on \|\| Number\(p\.paid_amount\) > 0\)/);
});
