// One-shot resend of the leads that never reached the office Google Sheet (Joshua 2026-09-28, option A).
// Before rule 124 the Google Form refused e-book downloads and "Referred by a past client" rows (400), so 76 real
// leads since 2026-08-06 are in the portal but missing from the sheet. This sends each of them once, fitted to the
// form (api/form-delivery.js entriesForGoogleSheet), with "Resent 2026-09-28: first received <date>" first in Comments.
//
// SAFETY (the email_campaign / re-engage pattern): site_settings key "google_sheet_resend" (server only) ships
// DISARMED. The cron (api/cron/auto-followups.js, */15) does nothing unless armed. Armed: the run DISARMS the key
// first (version-guarded on updated_at), then works. mode "dry" builds and counts every row and sends NOTHING;
// mode "send" posts each row once, 1 per second, and records every result in form_delivery_attempts
// (payload_hash "resend-2026-09-28"), so a lead that is now accepted is never sent again. The practice copy never
// sends (it has no Google copy). Only the Google Sheet is touched: no lead, text, email or FormSubmit changes.
"use strict";

const { isSandbox } = require("./sandbox");
const B = require("./booking");
const FD = require("../api/form-delivery.js");

const KEY = "google_sheet_resend";
const PACE_MS = 1000;
const BUDGET_MS = 10 * 60 * 1000;
const FIELDS = ["trainer_name", "first_name", "last_name", "address_line_1", "address_line_2", "city", "state", "zip", "email", "phone",
  "i_want_to", "heard_about_us", "heard_about_us_other", "vet_or_previous_client", "comments", "sms_consent", "sms_consent_text",
  "phone_required_notice_text", "additional_interest"];
const REQUIRED = ["last_name", "address_line_1", "city", "state", "zip", "email", "phone", "i_want_to", "heard_about_us"];

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const label = lead => `${String(lead.first_name || "?").trim()} ${String(lead.last_name || "?").trim().slice(0, 1)}.`;

function entriesFor(lead) {
  const raw = lead.raw_payload && typeof lead.raw_payload === "object" ? lead.raw_payload : {};
  const entries = {};
  for (const field of FIELDS) if (raw[field] !== undefined && raw[field] !== null && raw[field] !== "") entries[field] = raw[field];
  for (const field of ["first_name", "last_name", "email", "phone", "city", "state", "zip"]) if (!entries[field] && lead[field]) entries[field] = lead[field];
  const received = new Date(lead.created_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
  entries.comments = [`Resent 2026-09-28: first received ${received} ET (it did not reach this sheet then).`, entries.comments].filter(Boolean).join("\n\n");
  return { entries, received };
}

async function pendingRows() {
  const attempts = await B.sbOrThrow("/rest/v1/form_delivery_attempts?select=submission_id,entity_id,status,created_at,attempt_count&destination=eq.google_form_sheet&limit=10000");
  const byKey = new Map();
  for (const a of Array.isArray(attempts) ? attempts : []) {
    const key = `${a.submission_id}|${a.entity_id}`;
    const cur = byKey.get(key) || { submission_id: a.submission_id, entity_id: a.entity_id, ok: false, first: a.created_at, max: 0 };
    if (a.status === "accepted") cur.ok = true;
    if (String(a.created_at) < String(cur.first)) cur.first = a.created_at;
    cur.max = Math.max(cur.max, Number(a.attempt_count || 0));
    byKey.set(key, cur);
  }
  const todo = [...byKey.values()].filter(x => !x.ok && x.entity_id).sort((a, b) => String(a.first).localeCompare(String(b.first)));
  const leads = new Map();
  for (let i = 0; i < todo.length; i += 50) {
    const ids = todo.slice(i, i + 50).map(x => encodeURIComponent(x.entity_id)).join(",");
    const rows = await B.sbOrThrow(`/rest/v1/leads?select=id,first_name,last_name,email,phone,city,state,zip,created_at,raw_payload&id=in.(${ids})`);
    for (const row of Array.isArray(rows) ? rows : []) leads.set(String(row.id), row);
  }
  return todo.map(item => ({ item, lead: leads.get(String(item.entity_id)) || null }));
}

async function runGoogleSheetResend({ clock = () => Date.now(), paceMs = PACE_MS, budgetMs = BUDGET_MS } = {}) {
  const started = clock();
  let row;
  try {
    row = (await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&select=key,value,updated_at&limit=1`))?.[0] || null;
  } catch (error) {
    return { armed: false, message: `The resend setting could not be read: ${String(error?.message || error).slice(0, 200)}` };
  }
  const value = row?.value && typeof row.value === "object" ? row.value : {};
  if (!row || value.armed !== true) return { armed: false, message: "google_sheet_resend is not armed." };
  const mode = value.mode === "send" ? "send" : "dry";
  const claim = await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&updated_at=eq.${encodeURIComponent(row.updated_at)}`, {
    method: "PATCH", prefer: "return=representation",
    body: { value: { ...value, armed: false, status: "running", mode }, updated_at: new Date().toISOString() }
  }).catch(() => null);
  if (!claim?.[0]) return { armed: true, message: "Another run claimed the resend first. Nothing done here." };

  const rows = await pendingRows();
  const details = [];
  let sent = 0, failed = 0, skipped = 0, remaining = 0, ready = 0, problems = 0;
  for (const { item, lead } of rows) {
    if (!lead || lead.raw_payload?.qa === true) { skipped += 1; continue; }
    const { entries, received } = entriesFor(lead);
    const fitted = FD.entriesForGoogleSheet("contact", entries);
    const missing = REQUIRED.filter(key => !String(fitted[key] || "").trim());
    if (mode === "dry") {
      if (missing.length) problems += 1; else ready += 1;
      details.push({ lead: label(lead), received, ready: !missing.length, ...(missing.length ? { missing } : {}) });
      continue;
    }
    if (isSandbox()) { skipped += 1; continue; }
    if (clock() - started >= budgetMs) { remaining += 1; continue; }
    let status = "accepted";
    let error = null;
    try {
      await FD.deliverContactToGoogle(entries);
      sent += 1;
    } catch (err) {
      status = "failed";
      error = String(err?.message || err).slice(0, 500);
      failed += 1;
    }
    await B.sbOrThrow("/rest/v1/form_delivery_attempts", {
      method: "POST", prefer: "return=minimal",
      body: { submission_id: item.submission_id, entity_type: "lead", entity_id: item.entity_id, destination: "google_form_sheet", status,
        request_id: null, error_summary: error, payload_hash: "resend-2026-09-28", attempt_count: item.max + 1 }
    }).catch(err => console.error("google_resend_record_failed", String(err?.message || err)));
    details.push({ lead: label(lead), received, status, ...(error ? { error: error.slice(0, 160) } : {}) });
    await pause(paceMs);
  }
  const summary = mode === "dry"
    ? { at: new Date().toISOString(), mode, to_send: ready, problems, skipped, details: details.slice(0, 200) }
    : { at: new Date().toISOString(), mode, sent, failed, skipped, remaining, details: details.slice(0, 200) };
  await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}`, {
    method: "PATCH", prefer: "return=minimal",
    body: { value: { ...value, armed: false, status: remaining ? "incomplete" : "done", mode, last_run: summary } }
  }).catch(err => console.error("google_resend_summary_failed", String(err?.message || err)));
  return { armed: true, ran: true, ...summary, details: undefined };
}

module.exports = { KEY, runGoogleSheetResend, entriesFor };
