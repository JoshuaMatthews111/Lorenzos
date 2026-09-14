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
const { isSandbox, supabaseRequest } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");

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
  // Practice copy: schema profile headers / practice-* bucket (lib/sandbox.js).
  const target = supabaseRequest(path, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...target.headers
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw Object.assign(new Error(data?.message || `Supabase ${response.status}`), { status: response.status, detail: data });
  return data;
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

// Joshua 2026-09-14: "logged deals should be able to be edited". A trainer edits their OWN deal (the office
// may edit any). Names, dog, program and notes can always change. The money (sold, collected, date, plan) can
// change only while no installment is marked paid; then the payment plan is rebuilt from the new amounts
// (if saving the new plan fails, the old plan is put back). The lead is never touched. Every edit is kept in
// raw_payload.edits (who, when, what it was before).
const round2 = n => Math.round(n * 100) / 100;
const scheduleKey = rows => rows.map(p => `${p.due_on}:${Number(p.amount).toFixed(2)}`).join("|");
async function updateDeal(req, res, auth, body) {
  const dealId = clean(body.deal_id, 60);
  if (!/^[0-9a-f-]{36}$/i.test(dealId)) return res.status(400).json({ ok: false, message: "That deal id is not complete." });
  const [deal] = (await supabaseFetch(`/rest/v1/deals?id=eq.${encodeURIComponent(dealId)}&select=*&limit=1`)) || [];
  if (!deal) return res.status(404).json({ ok: false, message: "We could not find that deal." });
  if (!auth.isAdmin && deal.trainer_id !== auth.trainerId) return res.status(403).json({ ok: false, message: "You can only edit your own deals." });
  if (deal.status === "cancelled") return res.status(409).json({ ok: false, message: "This deal was cancelled by the office. Ask the office to change it." });
  const payments = (await supabaseFetch(`/rest/v1/deal_payments?deal_id=eq.${encodeURIComponent(dealId)}&select=*&order=sequence.asc`)) || [];
  const paidInstallment = payments.some(p => Number(p.sequence) > 0 && (p.status === "paid" || p.paid_on || Number(p.paid_amount) > 0));

  const clientName = body.client_name === undefined ? deal.client_name : clean(body.client_name, 160);
  const program = body.program === undefined ? deal.program : clean(body.program, 160);
  const dogName = body.dog_name === undefined ? deal.dog_name : (clean(body.dog_name, 120) || null);
  const notes = body.notes === undefined ? deal.notes : (clean(body.notes, 2000) || null);
  const sold = body.sold_amount === undefined ? Number(deal.sold_amount) : money(body.sold_amount);
  const collected = body.collected_amount === undefined ? Number(deal.collected_amount) : money(body.collected_amount ?? 0);
  const planType = PLAN_TYPES.has(clean(body.plan_type, 20)) ? clean(body.plan_type, 20) : deal.plan_type;
  const installments = body.installments === undefined ? Math.max(1, Number(deal.installments) || 1) : Math.max(0, Math.min(60, parseInt(body.installments, 10) || 0));
  const soldOn = isoDate(body.sold_on) || deal.sold_on;

  if (!clientName) return res.status(400).json({ ok: false, message: "Client name is required." });
  if (!program) return res.status(400).json({ ok: false, message: "Program is required." });
  if (!Number.isFinite(sold) || sold <= 0) return res.status(400).json({ ok: false, message: "Enter what the program sold for." });
  if (!Number.isFinite(collected) || collected < 0) return res.status(400).json({ ok: false, message: "Enter what was collected today (0 is fine)." });
  if (collected > sold) return res.status(400).json({ ok: false, message: `Collected ($${collected.toFixed(2)}) cannot be more than the deal was sold for ($${sold.toFixed(2)}).` });
  const balance = round2(sold - collected);
  // An edit that sends no money field never touches the money (names, dog, program, notes only).
  const moneySent = ["sold_amount", "collected_amount", "plan_type", "installments", "sold_on", "custom_dates"].some(key => body[key] !== undefined);
  let schedule = payments.filter(p => Number(p.sequence) > 0).map(p => ({ due_on: p.due_on, amount: Number(p.amount) }));
  if (moneySent) {
    if (balance > 0 && planType === "paid_in_full") return res.status(400).json({ ok: false, message: `There is a $${balance.toFixed(2)} balance. Choose weekly, monthly, or custom dates for it.` });
    // A custom plan with no new dates keeps the dates it has.
    const customDates = planType === "custom" && !Array.isArray(body.custom_dates) ? schedule.map(p => p.due_on) : body.custom_dates;
    schedule = buildSchedule({ balance, planType, installments, startDate: soldOn, customDates });
  }

  const moneyChanged = moneySent && (round2(sold) !== round2(Number(deal.sold_amount)) || round2(collected) !== round2(Number(deal.collected_amount))
    || soldOn !== deal.sold_on || scheduleKey(schedule) !== scheduleKey(payments.filter(p => Number(p.sequence) > 0)));
  if (moneyChanged && paidInstallment) {
    return res.status(409).json({ ok: false, message: "A payment on this deal is already marked paid by the office, so the amounts are locked. You can still change the names, dog, program and notes. Ask the office to change the amounts." });
  }

  const raw = deal.raw_payload && typeof deal.raw_payload === "object" ? deal.raw_payload : {};
  const edit = {
    at: new Date().toISOString(), by: auth.portalUser?.email || auth.user?.email || "", money_changed: moneyChanged,
    before: { client_name: deal.client_name, dog_name: deal.dog_name, program: deal.program, sold_amount: deal.sold_amount, collected_amount: deal.collected_amount, plan_type: deal.plan_type, installments: deal.installments, sold_on: deal.sold_on, notes: deal.notes }
  };
  const patch = { client_name: clientName, dog_name: dogName, program, notes, raw_payload: { ...raw, edits: [...(Array.isArray(raw.edits) ? raw.edits : []), edit].slice(-20) } };
  if (moneyChanged) Object.assign(patch, { sold_amount: sold, collected_amount: collected, plan_type: balance > 0 ? planType : "paid_in_full", installments: schedule.length, sold_on: soldOn, status: balance > 0 ? "open" : "paid" });
  const [updated] = await supabaseFetch(`/rest/v1/deals?id=eq.${encodeURIComponent(dealId)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });

  let paymentRows = payments;
  if (moneyChanged) {
    const fresh = [
      ...(collected > 0 ? [{ deal_id: dealId, sequence: 0, amount: collected, due_on: soldOn, paid_on: soldOn, paid_amount: collected, status: "collected" }] : []),
      ...schedule.map((p, i) => ({ deal_id: dealId, sequence: i + 1, amount: p.amount, due_on: p.due_on, paid_on: null, paid_amount: null, status: "scheduled" }))
    ];
    await supabaseFetch(`/rest/v1/deal_payments?deal_id=eq.${encodeURIComponent(dealId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    try {
      paymentRows = fresh.length ? await supabaseFetch("/rest/v1/deal_payments", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(fresh) }) : [];
    } catch (error) {
      // Put the old plan back so the deal is never left without its payments.
      const back = payments.map(({ id, created_at, updated_at, ...row }) => row);
      if (back.length) await supabaseFetch("/rest/v1/deal_payments", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(back) }).catch(() => {});
      throw error;
    }
  }
  return res.status(200).json({ ok: true, edited: true, sandbox: isSandbox(), deal: updated, payments: paymentRows, balance_due: balance, money_changed: moneyChanged });
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured." });

  try {
    // Any active portal user may submit (lib/portal-auth.js). Trainers are
    // pinned to their own trainer_id; admins may submit on a trainer's behalf
    // by passing trainer_id.
    const auth = await authorizeRequest(req, res, { require: "any", message: "Sign in to the portal to submit a deal." });
    if (!auth) return;

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (body.op === "update") return await updateDeal(req, res, auth, body);
    const trainerId = auth.isAdmin ? (clean(body.trainer_id, 60) || auth.trainerId) : auth.trainerId;
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

    // Practice copy: identical path against the practice schema (lib/sandbox.js).
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

    // Every row carries the same keys: PostgREST refuses a bulk insert whose
    // objects differ ("All object keys must match"). Found on the practice copy
    // 2026-09-05 — the first deal with money down AND a payment plan hit it.
    const payments = [
      ...(collected > 0 ? [{ deal_id: deal.id, sequence: 0, amount: collected, due_on: soldOn, paid_on: soldOn, paid_amount: collected, status: "collected" }] : []),
      ...schedule.map((p, i) => ({ deal_id: deal.id, sequence: i + 1, amount: p.amount, due_on: p.due_on, paid_on: null, paid_amount: null, status: "scheduled" }))
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

    return res.status(200).json({ ok: true, sandbox: isSandbox(), deal, payments: paymentRows, balance_due: balance });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return res.status(status).json({ ok: false, message: error.message || "The deal could not be saved.", detail: error.detail || null });
  }
};
