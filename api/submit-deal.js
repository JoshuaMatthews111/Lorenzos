// Trainer submits a closed deal from the trainer portal.
//
// Tim + Angela (2026-09-02): the trainer records what the program sold for,
// what was collected today, and how the balance is arranged. The balance is
// derived here and again by the database, and collected can never exceed sold,
// so the numbers cannot be fudged. Kathy remains the human safeguard on pay.
//
// Writes: one row in deals, N rows in deal_payments (sequence 0 = collected at
// signing, 1..n = scheduled), and flips the linked lead to became_client, which
// the existing trigger turns into a client record.

const crypto = require("crypto");
const { isSandbox } = require("../lib/sandbox");
const sandboxStore = require("../lib/sandbox-store");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const PLAN_TYPES = new Set(["paid_in_full", "weekly", "biweekly", "monthly", "custom"]);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}
function clean(v, max = 500) { return String(v ?? "").trim().slice(0, max); }
function money(v) {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
function isoDate(v) {
  const s = clean(v, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : "";
}
function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso, months) {
  const d = new Date(`${iso}T00:00:00Z`); const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw Object.assign(new Error(data?.message || `Supabase ${response.status}`), { status: response.status, detail: data });
  return data;
}

// Any active portal user may submit. Trainers are pinned to their own trainer_id;
// admins may submit on a trainer's behalf by passing trainer_id.
async function verifyPortalUser(token) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const user = await r.json();
  if (!user?.id) return null;
  const rows = await supabaseFetch(`/rest/v1/portal_users?select=user_id,role,permission_level,trainer_id,active,access_status,email,display_name&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`);
  const pu = rows?.[0];
  if (!pu || ["disabled", "revoked"].includes(String(pu.access_status || "active"))) return null;
  const isAdmin = pu.role === "admin" && ["super_admin", "office_admin"].includes(String(pu.permission_level || "super_admin"));
  return { user, portalUser: pu, isAdmin };
}

// Build the schedule. Balance is split evenly; the last installment absorbs
// rounding so the total always equals the balance exactly.
function buildSchedule({ balance, planType, installments, startDate, customDates }) {
  if (balance <= 0.004) return [];
  if (planType === "custom") {
    const dates = (customDates || []).map(isoDate).filter(Boolean);
    if (!dates.length) throw Object.assign(new Error("Custom plan needs at least one due date."), { status: 400 });
    return split(balance, dates);
  }
  const n = Math.max(1, Math.min(60, installments || 1));
  const step = planType === "weekly" ? d => addDays(d, 7) : planType === "biweekly" ? d => addDays(d, 14) : d => addMonths(d, 1);
  const dates = []; let cursor = startDate;
  for (let i = 0; i < n; i += 1) { cursor = step(cursor); dates.push(cursor); }
  return split(balance, dates);
}
function split(total, dates) {
  const cents = Math.round(total * 100); const n = dates.length;
  const base = Math.floor(cents / n); const remainder = cents - base * n;
  return dates.map((due_on, i) => ({ due_on, amount: (base + (i === n - 1 ? remainder : 0)) / 100 }));
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured." });

  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const auth = await verifyPortalUser(token);
    if (!auth) return res.status(403).json({ ok: false, message: "Sign in to the portal to submit a deal." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const trainerId = auth.isAdmin ? (clean(body.trainer_id, 60) || auth.portalUser.trainer_id) : auth.portalUser.trainer_id;
    if (!trainerId) return res.status(400).json({ ok: false, message: "This portal account is not linked to a trainer." });

    const clientName = clean(body.client_name, 160);
    const program = clean(body.program, 160);
    const sold = money(body.sold_amount);
    const collected = money(body.collected_amount ?? 0);
    const planType = PLAN_TYPES.has(clean(body.plan_type, 20)) ? clean(body.plan_type, 20) : "paid_in_full";
    const installments = Math.max(0, Math.min(60, parseInt(body.installments, 10) || 0));
    const soldOn = isoDate(body.sold_on) || new Date().toISOString().slice(0, 10);

    if (!clientName) return res.status(400).json({ ok: false, message: "Client name is required." });
    if (!program) return res.status(400).json({ ok: false, message: "Program is required." });
    if (!Number.isFinite(sold) || sold <= 0) return res.status(400).json({ ok: false, message: "Enter what the program sold for." });
    if (!Number.isFinite(collected) || collected < 0) return res.status(400).json({ ok: false, message: "Enter what was collected today (0 is fine)." });
    if (collected > sold) return res.status(400).json({ ok: false, message: `Collected ($${collected.toFixed(2)}) cannot be more than the deal was sold for ($${sold.toFixed(2)}).` });

    const balance = Math.round((sold - collected) * 100) / 100;
    if (balance > 0 && planType === "paid_in_full") {
      return res.status(400).json({ ok: false, message: `There is a $${balance.toFixed(2)} balance. Choose weekly, monthly, or custom dates for it.` });
    }
    const schedule = buildSchedule({ balance, planType, installments, startDate: soldOn, customDates: body.custom_dates });

    // Optional links back to the lead / client this deal closes.
    const leadId = clean(body.lead_id, 60) || null;
    const clientId = clean(body.client_id, 60) || null;

    // Sandbox: same rules, same shape, but the deal and its payments go into
    // the shared practice layer and the lead status flip is a practice op too.
    // Nothing reaches the real tables; every tester sees the practice deal.
    if (isSandbox()) {
      const stamp = new Date().toISOString();
      const deal = {
        id: `sbx-${crypto.randomUUID()}`, lead_id: leadId, client_id: clientId, trainer_id: trainerId, submitted_by: auth.user.id,
        client_name: clientName, dog_name: clean(body.dog_name, 120) || null, program,
        sold_amount: sold, collected_amount: collected, balance_due: balance,
        plan_type: balance > 0 ? planType : "paid_in_full", installments: schedule.length, sold_on: soldOn,
        status: balance > 0 ? "open" : "paid", notes: clean(body.notes, 2000) || null,
        raw_payload: { source: "trainer_portal", sandbox: true, submitted_email: auth.portalUser.email || auth.user.email },
        created_at: stamp, updated_at: stamp
      };
      const payments = [
        ...(collected > 0 ? [{ id: `sbx-${crypto.randomUUID()}`, deal_id: deal.id, sequence: 0, amount: collected, due_on: soldOn, paid_on: soldOn, paid_amount: collected, status: "collected", created_at: stamp, updated_at: stamp }] : []),
        ...schedule.map((p, i) => ({ id: `sbx-${crypto.randomUUID()}`, deal_id: deal.id, sequence: i + 1, amount: p.amount, due_on: p.due_on, status: "scheduled", created_at: stamp, updated_at: stamp }))
      ];
      await sandboxStore.appendOp({ operation: "create", entity_type: "deal", record: deal, actor: auth.portalUser.email });
      for (const payment of payments) await sandboxStore.appendOp({ operation: "create", entity_type: "deal_payment", record: payment, actor: auth.portalUser.email });
      if (leadId) await sandboxStore.appendOp({ operation: "update", entity_type: "lead", id: leadId, changes: { status: "became_client", updated_at: stamp }, actor: auth.portalUser.email });
      return res.status(200).json({ ok: true, sandbox: true, deal, payments, balance_due: balance });
    }

    const [deal] = await supabaseFetch("/rest/v1/deals", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        lead_id: leadId, client_id: clientId, trainer_id: trainerId, submitted_by: auth.user.id,
        client_name: clientName, dog_name: clean(body.dog_name, 120) || null, program,
        sold_amount: sold, collected_amount: collected, plan_type: balance > 0 ? planType : "paid_in_full",
        installments: schedule.length, sold_on: soldOn, status: balance > 0 ? "open" : "paid",
        notes: clean(body.notes, 2000) || null,
        raw_payload: { source: "trainer_portal", request_id: crypto.randomUUID(), submitted_email: auth.portalUser.email || auth.user.email }
      })
    });

    const payments = [
      ...(collected > 0 ? [{ deal_id: deal.id, sequence: 0, amount: collected, due_on: soldOn, paid_on: soldOn, paid_amount: collected, status: "collected" }] : []),
      ...schedule.map((p, i) => ({ deal_id: deal.id, sequence: i + 1, amount: p.amount, due_on: p.due_on, status: "scheduled" }))
    ];
    const paymentRows = payments.length
      ? await supabaseFetch("/rest/v1/deal_payments", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payments) })
      : [];

    // Closing the deal is what makes them a client. The existing trigger builds
    // the client record from the lead.
    if (leadId) {
      await supabaseFetch(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "became_client", updated_at: new Date().toISOString() })
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, deal, payments: paymentRows, balance_due: balance });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return res.status(status).json({ ok: false, message: error.message || "The deal could not be saved.", detail: error.detail || null });
  }
};
