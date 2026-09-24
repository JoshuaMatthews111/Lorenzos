// Audit 2026-09-24: api/submit-deal.js flipped ANY lead id it was given to became_client with the
// service key. A trainer who knew another trainer's lead id (e.g. one they had handed off, rule 91)
// could close it, credit the sale to themselves and fire the lead -> client trigger. Rule 7: a trainer
// may only close THEIR OWN lead. The check runs before anything is written. Office path unchanged.
// Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "1";
const submitDeal = require("../api/submit-deal.js");

const USERS = [
  { user_id: "u-a", role: "trainer", permission_level: "trainer", trainer_id: "t-a", active: true, access_status: "active", email: "a@example.com" },
  { user_id: "u-b", role: "trainer", permission_level: "trainer", trainer_id: "t-b", active: true, access_status: "active", email: "b@example.com" },
  { user_id: "u-office", role: "admin", permission_level: "office_admin", trainer_id: null, active: true, access_status: "active", email: "office@example.com" }
];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function world() {
  const store = {
    portal_users: USERS.map(u => ({ ...u })),
    leads: [
      { id: "lead-a", trainer_id: "t-a", status: "eval_completed" },
      { id: "lead-b", trainer_id: "t-b", status: "eval_completed" }
    ],
    deals: [], deal_payments: []
  };
  const writes = [];
  const pick = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
    }
    return out;
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
    if (!store[table]) return method === "GET" ? json(200, []) : json(404, {});
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "GET") return json(200, pick(store[table], u.searchParams));
    writes.push({ table, method, body });
    if (method === "POST") { const rows = (Array.isArray(body) ? body : [body]).map(r => ({ id: randomUUID(), ...r })); store[table].push(...rows); return json(201, rows); }
    if (method === "PATCH") { const hits = pick(store[table], u.searchParams); hits.forEach(r => Object.assign(r, body)); return json(200, hits); }
    return json(405, {});
  };
  return { store, writes };
}

async function call(body, token) {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; }, end() { return this; } };
  await submitDeal({ method: "POST", headers: { authorization: `Bearer ${token}` }, body, query: {} }, res);
  return res;
}
const DEAL = { client_name: "Pat Client", program: "Basic", sold_amount: 1200, collected_amount: 1200 };

test("a trainer cannot close another trainer's lead: 403 and NOTHING is written", async () => {
  const w = world();
  const res = await call({ ...DEAL, lead_id: "lead-b" }, "u-a-token");
  assert.equal(res.statusCode, 403, JSON.stringify(res.body));
  assert.equal(w.writes.length, 0, "no deal, no payment, no lead flip");
  assert.equal(w.store.leads.find(l => l.id === "lead-b").status, "eval_completed");
});

test("a trainer cannot close a lead id that does not exist", async () => {
  const w = world();
  const res = await call({ ...DEAL, lead_id: "no-such-lead" }, "u-a-token");
  assert.equal(res.statusCode, 403);
  assert.equal(w.writes.length, 0);
});

test("a trainer still closes their OWN lead exactly as before", async () => {
  const w = world();
  const res = await call({ ...DEAL, lead_id: "lead-a" }, "u-a-token");
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(w.store.deals.length, 1);
  assert.equal(w.store.deals[0].trainer_id, "t-a");
  assert.equal(w.store.leads.find(l => l.id === "lead-a").status, "became_client");
});

test("the office path is unchanged: an admin may close any trainer's lead on their behalf", async () => {
  const w = world();
  const res = await call({ ...DEAL, lead_id: "lead-b", trainer_id: "t-b" }, "u-office-token");
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(w.store.leads.find(l => l.id === "lead-b").status, "became_client");
});

test("collected > sold is still refused with 400 before anything (incl. the owner check) runs", async () => {
  const w = world();
  const res = await call({ ...DEAL, collected_amount: 5000, lead_id: "lead-b" }, "u-a-token");
  assert.equal(res.statusCode, 400);
  assert.equal(w.writes.length, 0);
});
