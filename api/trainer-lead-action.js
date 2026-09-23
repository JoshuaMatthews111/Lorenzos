// Trainer actions on their OWN leads (Joshua 2026-09-14, option A; meeting 2026-09-12 [0:09:36], [0:12:06]).
//   POST { action: "eval_completed" | "lost" | "alpha", lead_id, expected_version?, reason?, note?, value? }
//   - eval_completed: an Evaluation Scheduled lead -> evaluation_complete.
//   - lost: an open lead -> the Lost status for the reason picked (price / not_ready / other_provider /
//     no_response / complaint), with an optional short note for the office.
//   - alpha: added_to_alpha yes / no.
// Only the trainer the lead is assigned to (leads.trainer_id) or the office. The write is version-guarded, then
// logged exactly like an office change: audit_events, lifecycle_events (the funnel) and lead_events. It never
// writes any other field (no eval time, no booking, no deal, no client). DO-NOT-BREAK rule 83; rule 7 (trainers
// write only through their own doors); every table call goes through supabaseRequest (rule 5).
//
// Same-state team (Joshua 2026-09-16): "put those who are in the same state in their downline" until the MLM tree
// is known. A trainer's downline = every ACTIVE trainer in the SAME state (Ohio == OH), drafts and the caller left out.
//   GET ?team=1[&trainer_id=<id>]  -> { ok, trainer_id, state: "OH", trainers: [{ id, full_name, market, state, base_zip, slug }] }
//     trainer_id is only honoured for the office (admin); a trainer always sees their own downline.
//   POST { action: "handoff", lead_id, to_trainer_id, note?, expected_version? }
//     The assigned trainer (or the office) hands the lead to a teammate in the downline; anyone else -> 403
//     "Only a trainer in your state can take this lead." The PATCH writes leads.trainer_id (plus the trainer-name
//     column when the row has one: assigned_trainer_name / trainer_name / assigned_trainer) — nothing else — guarded
//     by version, then audit_events (trainer_lead_handoff) + lead_events (trainer_handoff). No funnel event fits, so
//     lifecycle_events is skipped. Summary: "Handed off to {name} (same-state team)".
const crypto = require("node:crypto");
const { supabaseRequest } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
const P = require("../lib/pipeline"); // Joshua 2026-09-16: "log the deal" trainer text after Eval completed

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const LOST_REASONS = {
  price: "lost_price_concern",
  not_ready: "lost_not_ready",
  other_provider: "lost_chose_another_provider",
  no_response: "lost_no_response",
  complaint: "lost_client_complaint"
};
// Same funnel words as api/operational-mutation.js LIFECYCLE_STATUS_EVENTS.
const LIFECYCLE = { evaluation_complete: "evaluation_completed", lost_no_response: "lost_no_response" };
const CLOSED = new Set(["became_client", "archived", "do_not_contact", "bad_lead", "lost_no_trainer_area", "canceled_refunded", "canceled_write_off", ...Object.values(LOST_REASONS)]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same table as lib/booking.js US_STATE_CODES (not exported there): full name -> code, so "Ohio" == "OH".
const STATE_CODES = {"alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE", "district of columbia": "DC", "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"};
const STATE_CODE_SET = new Set(Object.values(STATE_CODES));
const DRAFT_NAMES = new Set(["new trainer draft", "new trainer"]);
const DRAFT_STATES = new Set(["state pending"]);
// 2026-09-22 safety net: practice test rows ("Test …", "O'Brien Test 🐶 …") and office drafts (slug office-draft-…)
// never show in a hand-off list, even while still marked active.
function isTestOrDraftTrainer(row) {
  const name = clean(row?.full_name, 80);
  const slug = clean(row?.slug, 120).toLowerCase();
  return /^test\b/i.test(name) || /\btest\b/i.test(name) || /^draft\b/i.test(name) || /\bdraft$/i.test(name)
    || slug.startsWith("office-draft-") || /(^|-)test(-|$)/.test(slug);
}
// Trainer-name columns a leads row MAY carry; only the ones present on the row are written (checked on the row read first).
const TRAINER_NAME_COLUMNS = ["assigned_trainer_name", "trainer_name", "assigned_trainer"];

function clean(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

async function supabaseFetch(path, options = {}) {
  const target = supabaseRequest(path, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...target.headers }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw Object.assign(new Error(data?.message || `Supabase ${response.status}`), { status: response.status });
  return data;
}

const reply = (res, status, body) => res.status(status).json(body);

// "Ohio", "ohio", "OH", "oh", " Ohio " -> "OH"; anything unknown -> "".
function stateCode(value) {
  const text = clean(value, 60).replace(/\.$/, "");
  if (!text) return "";
  const upper = text.toUpperCase();
  if (STATE_CODE_SET.has(upper)) return upper;
  return STATE_CODES[text.toLowerCase()] || "";
}

const TEAM_SELECT = "id,full_name,market,state,base_zip,slug,status";
const teamRow = t => ({ id: t.id, full_name: t.full_name || "", market: t.market || "", state: t.state || "", base_zip: t.base_zip || "", slug: t.slug || "" });

// The downline of one trainer: every ACTIVE trainer in the same state, drafts and the trainer left out.
// Returns { trainer, state, trainers } or null when the trainer row is not there.
async function sameStateTeam(trainerId) {
  const id = clean(trainerId, 80);
  if (!id) return null;
  const [self] = (await supabaseFetch(`/rest/v1/trainers?select=${TEAM_SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`)) || [];
  if (!self) return null;
  const state = stateCode(self.state);
  if (!state) return { trainer: teamRow(self), state: "", trainers: [] };
  const rows = (await supabaseFetch(`/rest/v1/trainers?select=${TEAM_SELECT}&status=eq.active&order=full_name.asc`)) || [];
  const trainers = rows.filter(row =>
    String(row.id) !== String(self.id)
    && String(row.status || "") === "active"
    && !DRAFT_NAMES.has(clean(row.full_name, 80).toLowerCase())
    && !DRAFT_STATES.has(clean(row.state, 60).toLowerCase())
    && !isTestOrDraftTrainer(row)
    && stateCode(row.state) === state
  ).map(teamRow);
  return { trainer: teamRow(self), state, trainers };
}

// GET ?team=1: the caller's downline (the office may pass trainer_id to see any trainer's).
async function teamHandler(req, res, access) {
  if (String(req.query?.team || "") !== "1") return reply(res, 400, { ok: false, message: "Use ?team=1." });
  const asked = clean(req.query?.trainer_id, 80);
  const trainerId = access.isAdmin && asked ? asked : access.trainerId;
  if (!trainerId) return reply(res, 400, { ok: false, message: "Pass trainer_id to see a trainer's team." });
  const team = await sameStateTeam(trainerId);
  if (!team) return reply(res, 404, { ok: false, message: "That trainer record was not found." });
  return reply(res, 200, { ok: true, trainer_id: team.trainer.id, state: team.state, trainers: team.trainers });
}

// action "handoff": the assigned trainer (or the office) hands the lead to a same-state teammate.
async function handoff(res, access, body, before, note) {
  const toTrainerId = clean(body.to_trainer_id, 80);
  if (!toTrainerId) return reply(res, 400, { ok: false, message: "Pick the teammate who takes this lead." });
  // The downline is measured from the trainer the lead is assigned to (the caller, or for the office the assignee).
  const fromTrainerId = access.isAdmin ? String(before.trainer_id || "") : String(access.trainerId || "");
  if (!fromTrainerId) return reply(res, 409, { ok: false, message: "This lead has no trainer yet. Assign it from the office instead." });
  if (toTrainerId === fromTrainerId) return reply(res, 409, { ok: false, message: "This lead is already with that trainer." });
  const team = await sameStateTeam(fromTrainerId);
  if (!team) return reply(res, 404, { ok: false, message: "Your trainer record was not found." });
  const target = team.trainers.find(t => String(t.id) === toTrainerId);
  if (!target) return reply(res, 403, { ok: false, message: "Only a trainer in your state can take this lead." });

  const changes = { trainer_id: target.id };
  for (const column of TRAINER_NAME_COLUMNS) if (column in before) changes[column] = target.full_name;
  let summary = `Handed off to ${target.full_name} (same-state team)`;
  if (note) summary += `. Note: ${note}`;

  const requestId = crypto.randomUUID();
  const rows = await supabaseFetch(`/rest/v1/leads?id=eq.${encodeURIComponent(before.id)}&version=eq.${encodeURIComponent(before.version || 1)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(changes)
  });
  const record = rows?.[0];
  if (!record) return reply(res, 409, { ok: false, conflict: true, message: "The lead changed a moment ago. Reload and try again." });

  const actorId = access.actor?.id || access.user?.id || null;
  await supabaseFetch("/rest/v1/audit_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_user_id: actorId, actor_email: access.actor?.email || null, actor_name: access.actor?.name || null,
      action: "trainer_lead_handoff", entity_type: "lead", entity_id: String(record.id), summary,
      before_data: { trainer_id: before.trainer_id || null, status: before.status },
      after_data: { trainer_id: record.trainer_id || null, status: record.status, to_trainer_name: target.full_name, state: team.state },
      request_id: requestId
    })
  });
  // No funnel word fits a handoff (lifecycle_events skipped); the lead's own timeline still records it.
  await supabaseFetch("/rest/v1/lead_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      lead_id: record.id, event_type: "trainer_handoff", previous_status: before.status, new_status: record.status,
      actor_user_id: actorId, note: note || null,
      event_key: `lead:${record.id}:handoff:${record.version || record.updated_at}`,
      occurred_at: new Date().toISOString(),
      raw_payload: { request_id: requestId, by: access.isAdmin ? "office" : "trainer", from_trainer_id: before.trainer_id || null, to_trainer_id: target.id, to_trainer_name: target.full_name, state: team.state }
    })
  });
  return reply(res, 200, {
    ok: true, message: `Handed off to ${target.full_name}.`,
    record: { id: record.id, trainer_id: record.trainer_id, trainer_name: target.full_name, status: record.status, version: record.version || null }
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "GET") return reply(res, 405, { ok: false, message: "Use POST." });
  if (!SERVICE_ROLE_KEY) return reply(res, 500, { ok: false, message: "Supabase service role key is not configured." });
  try {
    const access = await authorizeRequest(req, res, { require: "any", message: "Sign in to the portal first." });
    if (!access) return;
    if (req.method === "GET") return await teamHandler(req, res, access);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = clean(body.action, 30);
    const leadId = clean(body.lead_id, 80);
    if (!["eval_completed", "lost", "alpha", "handoff"].includes(action)) return reply(res, 400, { ok: false, message: "Unknown action." });
    if (!UUID.test(leadId)) return reply(res, 400, { ok: false, message: "That lead id is not complete." });

    const [before] = (await supabaseFetch(`/rest/v1/leads?select=*&id=eq.${encodeURIComponent(leadId)}&limit=1`)) || [];
    if (!before) return reply(res, 404, { ok: false, message: "This lead is no longer available." });
    if (!access.isAdmin && String(before.trainer_id || "") !== String(access.trainerId || "")) {
      return reply(res, 403, { ok: false, message: "Only the office or the trainer this lead is assigned to can do that." });
    }
    if (body.expected_version !== undefined && body.expected_version !== null && Number(body.expected_version) !== Number(before.version || 1)) {
      return reply(res, 409, { ok: false, conflict: true, message: "The office changed this lead a moment ago. Reload and try again." });
    }

    const note = clean(body.note, 300);
    if (action === "handoff") return await handoff(res, access, body, before, note);
    let changes;
    let summary;
    if (action === "eval_completed") {
      if (before.status !== "evaluation_scheduled") return reply(res, 409, { ok: false, message: "Only a lead in Evaluation Scheduled can be marked Eval completed." });
      changes = { status: "evaluation_complete" };
      summary = "Trainer marked the evaluation completed.";
    } else if (action === "lost") {
      const status = LOST_REASONS[clean(body.reason, 30)];
      if (!status) return reply(res, 400, { ok: false, message: "Pick why the client was lost." });
      if (CLOSED.has(before.status)) return reply(res, 409, { ok: false, message: "This lead is already closed. Ask the office to change it." });
      changes = { status };
      summary = `Trainer marked the lead lost (${status.replace(/^lost_/, "").replace(/_/g, " ")}).`;
    } else {
      // Joshua 2026-09-23: the trainer answers "Have you logged this lead in Alpha?" Yes / No, and can
      // clear the answer back to blank. Blank (null) means "not answered yet" - different from No.
      const v = body.value === true ? true : body.value === false ? false : null;
      changes = { added_to_alpha: v };
      summary = v === true ? "Trainer answered Yes: this lead is logged in Alpha." : v === false ? "Trainer answered No: this lead is not logged in Alpha yet." : "Trainer cleared the Alpha answer.";
    }
    if (note) summary += ` Note: ${note}`;

    const requestId = crypto.randomUUID();
    const rows = await supabaseFetch(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&version=eq.${encodeURIComponent(before.version || 1)}`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(changes)
    });
    const record = rows?.[0];
    if (!record) return reply(res, 409, { ok: false, conflict: true, message: "The lead changed a moment ago. Reload and try again." });

    await supabaseFetch("/rest/v1/audit_events", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        actor_user_id: access.actor?.id || access.user?.id || null, actor_email: access.actor?.email || null, actor_name: access.actor?.name || null,
        action: `trainer_lead_${action}`, entity_type: "lead", entity_id: String(record.id), summary,
        before_data: { status: before.status, added_to_alpha: before.added_to_alpha ?? null },
        after_data: { status: record.status, added_to_alpha: record.added_to_alpha ?? null },
        request_id: requestId
      })
    });
    if (record.status !== before.status) {
      const eventType = LIFECYCLE[record.status];
      if (eventType) {
        await supabaseFetch("/rest/v1/lifecycle_events?on_conflict=event_key", {
          method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify({
            event_key: `lead:${record.id}:${eventType}:${record.version || record.updated_at}`,
            entity_type: "lead", entity_id: String(record.id), event_type: eventType,
            market: record.trainer_market || record.market || record.city || null,
            source_page: record.source_page || record.raw_payload?.source_page || null,
            actor_user_id: access.actor?.id || access.user?.id || null,
            raw_payload: { previous_status: before.status, new_status: record.status, request_id: requestId, by: "trainer" }
          })
        });
      }
      await supabaseFetch("/rest/v1/lead_events", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          lead_id: record.id, event_type: "status_changed", previous_status: before.status, new_status: record.status,
          actor_user_id: access.actor?.id || access.user?.id || null, note: note || null,
          event_key: `lead:${record.id}:status:${record.version || record.updated_at}`,
          occurred_at: new Date().toISOString(), raw_payload: { request_id: requestId, by: "trainer" }
        })
      });
    }
    if (action === "eval_completed") await P.afterEvalCompleted({ lead: record }).catch(error => console.error("after_eval_completed_failed", String(error?.message || error)));
    const message = action === "eval_completed" ? "Marked Eval completed." : action === "lost" ? "Marked lost. The office sees it." : changes.added_to_alpha === true ? "Saved: logged in Alpha." : changes.added_to_alpha === false ? "Saved: not logged in Alpha yet." : "Alpha answer cleared.";
    return reply(res, 200, { ok: true, message, record: { id: record.id, status: record.status, added_to_alpha: record.added_to_alpha ?? null, version: record.version || null } });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return reply(res, status, { ok: false, message: error.message || "The lead could not be updated." });
  }
};
