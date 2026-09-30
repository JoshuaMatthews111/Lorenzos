// System alerts - the portal's alert bell (Angela + Lorenzo, Zoom 2026-09-29).
//
// "It should be based off of everything, not just a form, but anything that fell through the cracks ... who owns
// this issue and how do we fix it? And then it can't be closed until it's fixed." (Angela)
// "If it's a system issue, it's going to be Joshua, between Joshua and Missy." (Lorenzo)
//
// How it works:
//   - The 15-minute cron (api/cron/auto-followups.js) calls runSystemAlerts(). It looks at the live rows, builds the
//     list of OPEN problems, and saves it in site_settings key "system_alerts" (server only).
//   - Every alert names WHAT broke, WHO owns it and HOW to fix it. There is no close button: an alert leaves the list
//     only when the next check no longer finds the problem (it moves to "resolved" with the time it cleared).
//   - A NEW system alert (owner Joshua) also texts Joshua through DSN Command, the same channel the nightly site
//     health check uses - at most 5 a run, never on the practice copy. Office alerts stay in the bell (no emails:
//     Zoom 2026-09-24, one Office's-turn digest a day, never per-lead mail).
//   - The portal reads the list with GET /api/pipeline?op=system_alerts (office staff only). If the saved check is
//     older than 45 minutes the portal itself shows "automatic checks stopped" (the timer is the thing that died).
// Read only on leads: this never changes a lead, a text or an email.
"use strict";

const B = require("./booking");
const { isSandbox } = require("./sandbox");

const KEY = "system_alerts";
const DSN_URL = process.env.DSN_COMMAND_APPROVAL_URL || "https://dsn-command.vercel.app/api/agent/approval";
const DSN_PRODUCT_ID = "bb51502e-eb05-4919-82ce-ed5a39a8d609";
const WINDOW_DAYS = 3;          // failures older than this are history, not alerts
const WAITING_DAYS = 14;        // a New Inquiry lead older than this is the Leads board's problem, not a live alert
const MAX_TEXTS = 5;
const STALE_MINUTES = 45;
const JOSHUA = "Joshua (system)";
const OFFICE = "Office (Rachel / Missy)";
const deps = { fetch: (...args) => fetch(...args), now: () => Date.now() };

const HOUR = 3600 * 1000;
const clean = (v, n = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const rawOf = row => (row?.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {});
const who = lead => `${clean(lead?.first_name, 40) || "?"} ${clean(lead?.last_name, 1)}${lead?.last_name ? "." : ""}`.trim();
const isQa = lead => rawOf(lead).qa === true || rawOf(lead).qa === "true";
const ago = (ms, nowMs) => {
  const h = Math.floor((nowMs - ms) / HOUR);
  return h < 1 ? "under an hour ago" : h < 48 ? `${h} hour${h === 1 ? "" : "s"} ago` : `${Math.floor(h / 24)} days ago`;
};

// The pipeline expects EVERY website lead to start its texts, except the free e-book (it is not a booking lead).
function expectsPipeline(lead) {
  const raw = rawOf(lead);
  if (raw.lead_type === "pdf_download") return false;
  const page = clean(raw.source_page || lead?.source_page, 200).toLowerCase();
  return /^https?:\/\//.test(page) || /contact(\.html)?$/.test(page) || /^trainer landing page/.test(page) || /^dog-training-/.test(page);
}

// One lead -> the problems it shows. Pure, so the tests can feed it rows.
function leadAlerts(lead, nowMs) {
  const out = [];
  if (!lead?.id || isQa(lead)) return out;
  const raw = rawOf(lead);
  const pipeline = raw.pipeline && typeof raw.pipeline === "object" ? raw.pipeline : null;
  const created = Date.parse(lead.created_at);
  const recent = Number.isFinite(created) && nowMs - created <= WINDOW_DAYS * 24 * HOUR;
  const name = who(lead);
  // A lead the office already picked up (moved out of New Inquiry) has reached a person: its "client never heard
  // from us" alerts are fixed. Joshua was still texted when the check first found the system cause.
  const waitingForUs = lead.status === "new_inquiry";
  const add = (type, owner, what, fix, extra = {}) => out.push({ id: `${type}:${lead.id}`, type, owner, lead_id: lead.id, lead: name, what, fix, since: extra.since || lead.created_at, level: extra.level || (owner === JOSHUA ? "system" : "office") });

  // 1. A website lead that never started its texts (Hadley A., 2026-09-29: trainer pages were practice-only).
  if (recent && waitingForUs && !pipeline && expectsPipeline(lead) && nowMs - created > 20 * 60 * 1000) {
    add("no_pipeline", JOSHUA, `${name} came in from the website but the automatic texts and emails never started.`,
      "Joshua: find why the form did not start the pipeline. Office: call the client now.");
  }
  if (recent && pipeline) {
    // 2. A client text Make refused (the hook did not accept it).
    const texts = [["first booking-link text", pipeline.new_lead_text], ["office-will-call text", pipeline.care_text], ["re-engage text", pipeline.reengage?.text],
      ...(Array.isArray(pipeline.followups) ? pipeline.followups.map(f => [`follow-up text (${clean(f?.step, 12)})`, f]) : [])];
    for (const [label, rec] of texts) {
      if (rec?.status === "failed" && waitingForUs) {
        add(`text_failed_${label.replace(/\W+/g, "_")}`, JOSHUA, `The ${label} to ${name} did not go out: ${clean(rec.reason, 140) || "the text service refused it"}.`,
          "Joshua: check Make and Twilio for this text. Office: call or email the client meanwhile.", { since: rec.at || lead.created_at });
      }
    }
    // 3. The office email for a new lead or a booking failed, or sat in the queue over 30 minutes.
    for (const notice of Array.isArray(pipeline.booking_notices) ? pipeline.booking_notices : []) {
      const mail = notice?.office_email || {};
      const queuedAt = Date.parse(mail.queued_at || notice?.requested_at || "");
      const stuck = (mail.status === "queued" || mail.status === "sending") && Number.isFinite(queuedAt) && nowMs - queuedAt > 30 * 60 * 1000;
      if (mail.status === "failed" || stuck) {
        add(`office_email_${clean(notice.hold_id || notice.kind, 40).replace(/\W+/g, "_")}`, JOSHUA,
          `The office email about ${name} (${clean(notice.kind, 30) || "lead"}) ${mail.status === "failed" ? "failed" : "is stuck in the queue"}${mail.reason ? `: ${clean(mail.reason, 120)}` : ""}.`,
          "Joshua: check the Resend email log. Office: open the lead in the portal - everything is there.", { since: mail.queued_at || notice.requested_at || lead.created_at });
      }
    }
  }
  // 4. Needs a call: nobody takes online bookings within 50 miles, and the lead is still waiting after the first
  //    follow-up moment, 15 minutes (Brandi H.).
  if (pipeline && lead.status === "new_inquiry" && /No trainer within/i.test(String(pipeline.new_lead_text?.reason || "")) && nowMs - created > 15 * 60 * 1000 && nowMs - created <= WAITING_DAYS * 24 * HOUR) {
    add("needs_call", OFFICE, `${name} has no trainer with an online calendar within 50 miles, so no booking link went out.`,
      "Office: call the client. Offer a virtual evaluation with Lorenzo, or move the lead to Lost - no trainer in area.", { level: "office" });
  } else if (lead.status === "new_inquiry" && nowMs - created > 15 * 60 * 1000 && nowMs - created <= WAITING_DAYS * 24 * HOUR) {
    // 5. Any lead still in New Inquiry after 15 minutes - the first follow-up (Joshua 2026-09-30: same timer as the
    // follow-ups, engage the customer as fast as possible). Its trainer is texted at 15 min / 30 min / 24 h too.
    const trainer = clean(lead.assigned_trainer_name, 60);
    add("waiting", trainer ? `${trainer} (trainer), then the office` : OFFICE, `${name} is still in New Inquiry - it came in ${ago(created, nowMs)}.`,
      `${trainer ? `${trainer}: call the client and move the card.` : "Office: call the client and move the card."} Moving it to any other column clears this alert.`, { level: "office" });
  }
  return out;
}

// Office email copies (FormSubmit to production@) that never arrived, even after the browser retry.
function deliveryAlerts(attempts, leadsById, nowMs) {
  const groups = new Map();
  for (const a of attempts || []) {
    if (a?.destination !== "formsubmit_email" && a?.destination !== "google_form_sheet") continue;
    const key = `${a.destination}:${a.submission_id || a.entity_id}`;
    const g = groups.get(key) || { destination: a.destination, entity_id: a.entity_id, ok: false, at: 0, err: "" };
    g.ok = g.ok || a.status === "accepted";
    const t = Date.parse(a.updated_at || a.created_at);
    if (Number.isFinite(t) && t > g.at) { g.at = t; if (a.status === "failed") g.err = clean(a.error_summary, 120); }
    groups.set(key, g);
  }
  const out = [];
  for (const [key, g] of groups) {
    if (g.ok || !g.at || nowMs - g.at > WINDOW_DAYS * 24 * HOUR || nowMs - g.at < 10 * 60 * 1000) continue;
    const lead = leadsById.get(String(g.entity_id));
    if (lead && isQa(lead)) continue;
    // The office copy only matters while nobody has picked the lead up; the lead itself is always in the portal.
    if (g.destination === "formsubmit_email" && lead && lead.status !== "new_inquiry") continue;
    const name = lead ? who(lead) : "a website visitor";
    const sheet = g.destination === "google_form_sheet";
    out.push({
      id: `delivery:${key}`, type: sheet ? "sheet_failed" : "office_copy_failed", owner: JOSHUA, lead_id: lead?.id || null, lead: name,
      what: sheet ? `${name} did not reach the office Google Sheet${g.err ? ` (${g.err})` : ""}.` : `The FormSubmit office email copy for ${name} never arrived${g.err ? ` (${g.err})` : ""}.`,
      fix: sheet ? "Joshua: resend the row to the Google Sheet. The lead itself is safe in the portal." : "The lead is safe in the portal. Office: work it from the Leads board. Joshua: check FormSubmit if this repeats.",
      since: new Date(g.at).toISOString(), level: "system"
    });
  }
  return out;
}

// The nightly page check (api/cron/site-health.js) already stored its result: a broken page is a system alert.
function pageAlerts(siteHealth) {
  const broken = Array.isArray(siteHealth?.broken) ? siteHealth.broken : [];
  return broken.slice(0, 20).map(p => ({
    id: `page:${clean(p.slug, 80)}`, type: "page_broken", owner: JOSHUA, lead_id: null, lead: "",
    what: `The page /${clean(p.slug, 80)} is not serving correctly (nightly check).`,
    fix: "Joshua: open Page Studio > the page > History, restore the last good version, and republish.",
    since: siteHealth.ran_at || new Date().toISOString(), level: "system"
  }));
}

function smsText(alert) {
  return {
    product_id: DSN_PRODUCT_ID, type: "other", risk: "medium", cost_cents: 0,
    title: `LDTT alert: ${clean(alert.what, 90)}`,
    body: `${alert.what}\n\nOwner: ${alert.owner}\nHow to fix: ${alert.fix}\n\nSee the bell in the office portal. It closes on its own once fixed.`
  };
}

async function postText(payload) {
  const token = process.env.DSN_AGENT_TOKEN || "";
  if (!token) return { posted: false, reason: "DSN_AGENT_TOKEN is not set" };
  try {
    const r = await deps.fetch(DSN_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return { posted: r.ok, status: r.status };
  } catch (error) {
    return { posted: false, reason: clean(error?.message || error, 160) };
  }
}

// Merge a fresh list with the saved one: keep first_seen, move what vanished to resolved.
function mergeAlerts(previous, fresh, nowIso) {
  const before = new Map((Array.isArray(previous?.open) ? previous.open : []).map(a => [a.id, a]));
  const open = fresh.map(a => ({ ...a, first_seen: before.get(a.id)?.first_seen || nowIso, texted: before.get(a.id)?.texted || false }));
  const openIds = new Set(open.map(a => a.id));
  const cleared = [...before.values()].filter(a => !openIds.has(a.id)).map(a => ({ id: a.id, type: a.type, owner: a.owner, lead: a.lead, what: a.what, first_seen: a.first_seen, resolved_at: nowIso }));
  const resolved = [...cleared, ...(Array.isArray(previous?.resolved) ? previous.resolved : [])].slice(0, 30);
  const fresh_ids = open.filter(a => !before.has(a.id)).map(a => a.id);
  return { open, resolved, fresh_ids };
}

async function computeAlerts(nowMs = deps.now()) {
  const since = new Date(nowMs - WAITING_DAYS * 24 * HOUR).toISOString();
  const [leads, attempts, health] = await Promise.all([
    B.sbOrThrow(`/rest/v1/leads?select=id,created_at,first_name,last_name,status,source_page,assigned_trainer_name,trainer_slug,raw_payload&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=1000`),
    B.sbOrThrow(`/rest/v1/form_delivery_attempts?select=submission_id,entity_id,destination,status,error_summary,created_at,updated_at&created_at=gte.${encodeURIComponent(new Date(nowMs - WINDOW_DAYS * 24 * HOUR).toISOString())}&limit=5000`).catch(() => []),
    B.sbOrThrow("/rest/v1/site_settings?key=eq.site_health&select=value&limit=1").then(r => r?.[0]?.value || null).catch(() => null)
  ]);
  const rows = Array.isArray(leads) ? leads : [];
  const byId = new Map(rows.map(l => [String(l.id), l]));
  const list = [...rows.flatMap(l => leadAlerts(l, nowMs)), ...deliveryAlerts(attempts, byId, nowMs), ...pageAlerts(health)];
  // System first, then oldest first.
  return list.sort((a, b) => (a.level === b.level ? Date.parse(a.since) - Date.parse(b.since) : a.level === "system" ? -1 : 1));
}

async function runSystemAlerts({ nowMs = deps.now() } = {}) {
  const nowIso = new Date(nowMs).toISOString();
  const fresh = await computeAlerts(nowMs);
  const row = (await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&select=value&limit=1`).catch(() => null))?.[0] || null;
  const merged = mergeAlerts(row?.value, fresh, nowIso);
  const texts = [];
  // The very first check only records what is already known (no row yet = baseline): it texts nobody.
  const baseline = !row;
  if (baseline) merged.open.forEach(a => { a.texted = true; });
  if (!isSandbox() && !baseline) {
    for (const alert of merged.open.filter(a => merged.fresh_ids.includes(a.id) && a.owner === JOSHUA && !a.texted).slice(0, MAX_TEXTS)) {
      const result = await postText(smsText(alert));
      alert.texted = Boolean(result.posted);
      texts.push({ id: alert.id, ...result });
    }
  }
  const value = { checked_at: nowIso, open: merged.open, resolved: merged.resolved, counts: { system: merged.open.filter(a => a.level === "system").length, office: merged.open.filter(a => a.level !== "system").length } };
  await B.sbOrThrow("/rest/v1/site_settings?on_conflict=key", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { key: KEY, value, updated_at: nowIso } });
  return { open: value.open.length, new: merged.fresh_ids.length, resolved_now: merged.resolved.filter(r => r.resolved_at === nowIso).length, texts };
}

async function readSystemAlerts(nowMs = deps.now()) {
  const value = (await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&select=value&limit=1`))?.[0]?.value || null;
  const checked = Date.parse(value?.checked_at || "");
  const stale = !Number.isFinite(checked) || nowMs - checked > STALE_MINUTES * 60 * 1000;
  const open = Array.isArray(value?.open) ? value.open.map(({ texted, ...a }) => a) : [];
  if (stale) {
    open.unshift({ id: "timer_stopped", type: "timer_stopped", owner: JOSHUA, lead: "", level: "system", since: value?.checked_at || null,
      what: Number.isFinite(checked) ? `The automatic checks have not run since ${ago(checked, nowMs)}. Follow-up texts and these alerts may be stopped too.` : "The automatic checks have not run yet.",
      fix: "Joshua: open Vercel > Cron Jobs and check /api/cron/auto-followups." });
  }
  return { checked_at: value?.checked_at || null, stale, open, resolved: Array.isArray(value?.resolved) ? value.resolved.slice(0, 10) : [] };
}

module.exports = { KEY, JOSHUA, OFFICE, STALE_MINUTES, deps, expectsPipeline, leadAlerts, deliveryAlerts, pageAlerts, mergeAlerts, computeAlerts, runSystemAlerts, readSystemAlerts, smsText };
