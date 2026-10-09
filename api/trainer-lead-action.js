// Trainer actions on their OWN leads (Joshua 2026-09-14, option A; meeting 2026-09-12 [0:09:36], [0:12:06]).
//   POST { action: "contacted" | "eval_completed" | "lost" | "alpha", lead_id, expected_version?, reason?, note?, value? }
//   - contacted (Rachel 2026-09-24): a New Inquiry lead -> office_contacted (shown as "Office/Trainer Contacted").
//     ONLY from new_inquiry: on the office Leads board "Engaged Lead: No Outcome" comes AFTER "Office Contacted",
//     so moving an engaged lead here would move it backwards. Anything else -> 409. No text, no email is sent.
//   - eval_completed: an Evaluation Scheduled lead -> evaluation_complete.
//   - lost (Zoom 2026-09-24): an open lead -> the Lost status for ONE of the four hard-no reasons (no_trainer_area /
//     method_not_a_fit / dog_not_qualified / competitor) + lost_reason in plain words, with an optional note.
//   - archive: an open lead -> archived (+ archived_at, raw_payload.archive_reason) for a maybe-later reason
//     (not_ready_money / family / unreachable / other). The office can Restore it.
//   - alpha: added_to_alpha yes / no.
//   - intro_called (Zoom 2026-09-24): "I called the client" on an Evaluation Scheduled lead -> raw_payload.pipeline.
//     trainer_intro_called_at (+ audit + a trainer_intro_called lead event). No status change. Stops the reminder.
// Only the trainer the lead is assigned to (leads.trainer_id) or the office. The write is version-guarded, then
// logged exactly like an office change: audit_events, lifecycle_events (the funnel) and lead_events. It never
// writes any other field (no eval time, no booking, no deal, no client). DO-NOT-BREAK rule 83; rule 7 (trainers
// write only through their own doors); every table call goes through supabaseRequest (rule 5).
//
// The trainer hierarchy (Joshua 2026-09-25, from the owner's chart "Hierarchy - 9-23-26"; DO-NOT-BREAK rule 105).
// It replaces the same-state team of 2026-09-16. The tree is site_settings key "trainer_hierarchy" (server only);
// the pure tree helpers are lib/hierarchy.js. A lead only ever moves DOWN: never up, never sideways.
//   GET ?team=1[&trainer_id=<id>]  -> { ok, me, rank, rank_label, is_owner, upline: [...], downline: [...nested...], count }
//     me/upline/downline entries: { id, slug, full_name, place, headshot_url, rank, rank_label, depth, children }
//     me + downline entries also carry email / phone when the trainer row has a usable one (rule 171, My Team pyramid).
//     upline = owner first, the caller's own parent last. downline = EVERY descendant, nested, each one only if the
//     trainer row is ACTIVE on this site (not on the site = not listed; their listed people move up a level).
//     The owner (lorenzo-miller) gets the whole tree. trainer_id is only honoured for the office (admin).
//   POST { action: "handoff", lead_id, to_trainer_id, note?, expected_version? }
//     The assigned trainer (or the office, measured from the assignee) may send the lead ONLY to an ACTIVE trainer
//     in that downline (the owner: anyone active on the tree); anything else -> 403 "You can only send a lead to
//     someone in your downline." and nothing is written. The PATCH writes leads.trainer_id (plus the trainer-name
//     column when the row has one: assigned_trainer_name / trainer_name / assigned_trainer) — nothing else — guarded
//     by version, then audit_events (trainer_lead_handoff) + lead_events (trainer_handoff). No funnel event fits, so
//     lifecycle_events is skipped. Summary: "Sent to {name} (downline)".
// Rule 106 (Joshua 2026-09-25): a SUPER ADMIN may send ANY lead (assigned or not) to ANY trainer who is ACTIVE on the
// site AND has an ACTIVE trainer portal login; GET ?handoff_targets=1 (super admin only) lists them. Same write, same
// logs; summary "Sent to {name} (super admin)". Office admins and trainers are unchanged (rule 105).
const crypto = require("node:crypto");
const { supabaseRequest } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
const P = require("../lib/pipeline"); // Joshua 2026-09-16: "log the deal" trainer text after Eval completed
const H = require("../lib/hierarchy"); // rule 105: the one home of the tree helpers

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const METRICS = require("../trainer-backoffice/metrics.js"); // the Lost / Archive vocabulary (one list for portal + API)

// Lost vs Archive (Zoom 2026-09-24, Lorenzo: "Lost would be there's no need in us contacting them again").
// "lost" takes ONLY the four hard-no reasons; "archive" takes the maybe-later reasons. other_provider is kept as an
// alias of competitor so a portal page opened before this change still works for that one reason.
const LOST_REASONS = Object.fromEntries(METRICS.HARD_NO_LOST_REASONS.map(([key, , status]) => [key, status]));
LOST_REASONS.other_provider = "lost_chose_another_provider";
const LOST_LABELS = Object.fromEntries(METRICS.HARD_NO_LOST_REASONS.map(([key, label]) => [key, label]));
LOST_LABELS.other_provider = LOST_LABELS.competitor;
const SOFT_REASONS = new Set(["price", "not_ready", "no_response", "complaint"]); // the old trainer choices: now Archive
const ARCHIVE_LABELS = Object.fromEntries(METRICS.ARCHIVE_REASONS);
// Same funnel words as api/operational-mutation.js LIFECYCLE_STATUS_EVENTS.
const LIFECYCLE = { evaluation_scheduled: "evaluation_scheduled", evaluation_complete: "evaluation_completed", lost_no_response: "lost_no_response" }; // evaluation_scheduled: office 2026-10-03 (same event the office save writes)
// Office 2026-10-03: the open statuses before an evaluation; saving an eval time from any of them moves the
// lead to Evaluation Scheduled (same list in api/operational-mutation.js).
const BEFORE_EVAL = new Set(["site_visit", "new_inquiry", "office_contacted", "engaged_no_outcome", "follow_up_call_needed", "evaluation_cancelled"]);
const CLOSED = new Set(["became_client", "archived", "do_not_contact", "bad_lead", "canceled_refunded", "canceled_write_off",
  ...METRICS.HARD_NO_LOST_STATUSES, ...METRICS.SOFT_LOST_STATUSES, "lost_chose_another_provider"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same table as lib/booking.js US_STATE_CODES (not exported there): full name -> code, so "Ohio" == "OH".
const STATE_CODES = {"alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE", "district of columbia": "DC", "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"};
const STATE_CODE_SET = new Set(Object.values(STATE_CODES));
const DRAFT_NAMES = new Set(["new trainer draft", "new trainer"]);
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

// "Milton" + "Florida" -> "Milton, FL"; "Pensacola, FL" stays as it is.
function placeLabel(row) {
  const market = clean(row?.market, 80);
  const code = stateCode(row?.state) || clean(row?.state, 40);
  if (!market) return code;
  if (market.includes(",") || !code) return market;
  return `${market}, ${code}`;
}

// The headshot the site already shows (Find a Trainer): trainers.headshot_url, with the same file-name clean-up as
// the portal's safeTrainerAssetUrl ("Karemela Sefferin 360_x_360.jpg" -> karemela-sefferin-360-x-360.jpg).
// Only our own /assets/ files and this project's public Storage objects pass; anything else -> "".
function headshotUrl(value) {
  const url = clean(value, 400);
  const asset = url.match(/^\/?(assets\/(?:trainer-headshots|trainer-bio-photos)\/)([^?#]+)$/i);
  if (asset) {
    let decoded = asset[2];
    try { decoded = decodeURIComponent(asset[2]); } catch { /* keep as is */ }
    const extension = /\.([a-z0-9]{2,5})$/i.test(decoded) ? decoded.split(".").pop().toLowerCase() : "jpg";
    const stem = decoded.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return stem ? `/${asset[1]}${stem}.${extension}` : "";
  }
  if (url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/`) && !/["'<>\s]/.test(url)) return url;
  return "";
}

const TEAM_SELECT = "id,full_name,market,state,slug,status,headshot_url";
// My Team pyramid (DO-NOT-BREAK rule 171): the cards also show email + phone. Read ONLY by the team view (the hand-off
// list keeps TEAM_SELECT), and added ONLY to "me" and the downline entries — the same people as before, no one new.
const TEAM_VIEW_SELECT = `${TEAM_SELECT},email,phone`;
const person = (row, node) => ({
  id: row.id, slug: row.slug || "", full_name: row.full_name || "", place: placeLabel(row), headshot_url: headshotUrl(row.headshot_url),
  rank: node?.rank || "", rank_label: H.rankLabel(node?.rank)
});
// A plain address only ("x@y.z", no spaces, quotes or angle brackets); anything else -> "".
function contactEmail(value) {
  const email = clean(value, 200).toLowerCase();
  return /^[^\s@"'<>()]+@[^\s@"'<>()]+\.[a-z]{2,}$/.test(email) ? email : "";
}
// Digits only: a 10/11-digit US number becomes +1XXXXXXXXXX, an 8-15 digit number written with a leading + keeps
// it; anything else -> "".
function contactPhone(value) {
  const digits = clean(value, 40).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 && digits.length <= 15 && /^\s*\+/.test(clean(value, 40)) ? `+${digits}` : "";
}
// person() plus email / phone, each key only when there is a usable value (a card shows only what is present).
const contactPerson = (row, node) => {
  const out = person(row, node);
  const email = contactEmail(row?.email);
  const phone = contactPhone(row?.phone);
  if (email) out.email = email;
  if (phone) out.phone = phone;
  return out;
};

// The chart + every ACTIVE trainer on this site. Returns { tree, bySlug } (tree.ok false when the chart is missing
// or does not validate: then nobody can hand anything off — fail closed).
async function loadHierarchy(select = TEAM_SELECT) {
  const [setting] = (await supabaseFetch(`/rest/v1/site_settings?select=value&key=eq.${H.SETTINGS_KEY}&limit=1`)) || [];
  const tree = H.readTree(setting?.value);
  const rows = (await supabaseFetch(`/rest/v1/trainers?select=${select}&status=eq.active&order=full_name.asc`)) || [];
  const bySlug = new Map();
  for (const row of rows) {
    if (String(row.status || "") !== "active" || isTestOrDraftTrainer(row) || DRAFT_NAMES.has(clean(row.full_name, 80).toLowerCase())) continue;
    const slug = clean(row.slug, 120).toLowerCase();
    if (slug) bySlug.set(slug, row);
  }
  return { tree, bySlug };
}

// One trainer's view of the tree. Returns null when the trainer row is not there.
async function hierarchyView(trainerId) {
  const id = clean(trainerId, 80);
  if (!id) return null;
  const [self] = (await supabaseFetch(`/rest/v1/trainers?select=${TEAM_VIEW_SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`)) || [];
  if (!self) return null;
  const { tree, bySlug } = await loadHierarchy(TEAM_VIEW_SELECT);
  const slug = clean(self.slug, 120).toLowerCase();
  const node = tree.ok ? tree.nodes.get(slug) : null;
  const listed = s => bySlug.has(s);
  const downline = node ? H.nestedDownline(tree, slug, listed, (s, n) => contactPerson(bySlug.get(s), n)) : [];
  const upline = node ? H.uplineOf(tree, slug).filter(listed).reverse().map(s => person(bySlug.get(s), tree.nodes.get(s))) : [];
  return {
    tree, bySlug, slug,
    body: {
      me: contactPerson(self, node), rank: node?.rank || "", rank_label: H.rankLabel(node?.rank), is_owner: Boolean(tree.ok && slug === tree.owner),
      on_chart: Boolean(node), chart_ok: tree.ok, updated_from: tree.ok ? tree.updated_from : "",
      upline, downline, count: H.flattenNested(downline).length
    }
  };
}

// GET ?team=1: the caller's hierarchy view (the office may pass trainer_id to see any trainer's).
async function teamHandler(req, res, access) {
  if (String(req.query?.team || "") !== "1") return reply(res, 400, { ok: false, message: "Use ?team=1." });
  const asked = clean(req.query?.trainer_id, 80);
  const trainerId = access.isAdmin && asked ? asked : access.trainerId;
  if (!trainerId) return reply(res, 400, { ok: false, message: "Pass trainer_id to see a trainer's team." });
  const view = await hierarchyView(trainerId);
  if (!view) return reply(res, 404, { ok: false, message: "That trainer record was not found." });
  if (!view.tree.ok) console.error("trainer_hierarchy_invalid", JSON.stringify(view.tree.errors || []).slice(0, 500));
  return reply(res, 200, { ok: true, trainer_id: view.body.me.id, ...view.body });
}

const DOWNLINE_ONLY = "You can only send a lead to someone in your downline.";
const NO_PORTAL = "That trainer is not active on the site with an active portal login, so they cannot take a lead yet.";

// Rule 106 (Joshua 2026-09-25): a SUPER ADMIN (permission_level super_admin) may send ANY lead to ANY trainer who is
// ACTIVE on the site AND has an ACTIVE portal login (portal_users role trainer, active, access_status active). The
// chart does not limit the super admin. Office admins keep rule 105 exactly (from the assignee's downline, never up);
// trainers keep rule 105 exactly (down only). Practice test rows and office drafts are never listed or accepted.
async function superHandoffTargets() {
  const rows = (await supabaseFetch(`/rest/v1/trainers?select=${TEAM_SELECT}&status=eq.active&order=full_name.asc`)) || [];
  const logins = (await supabaseFetch("/rest/v1/portal_users?select=trainer_id,role,active,access_status&role=eq.trainer&active=eq.true&access_status=eq.active")) || [];
  const withLogin = new Set(logins
    .filter(login => login.role === "trainer" && login.active === true && String(login.access_status || "") === "active" && login.trainer_id)
    .map(login => String(login.trainer_id)));
  return rows
    .filter(row => String(row.status || "") === "active" && !isTestOrDraftTrainer(row) && !DRAFT_NAMES.has(clean(row.full_name, 80).toLowerCase()) && withLogin.has(String(row.id)))
    .map(row => ({ id: row.id, slug: clean(row.slug, 120).toLowerCase(), full_name: row.full_name || "", place: placeLabel(row) }));
}

// GET ?handoff_targets=1: the super admin's searchable list (name + city). Anyone else: 403.
async function targetsHandler(res, access) {
  if (!access.isSuperAdmin) return reply(res, 403, { ok: false, message: "Only a Super Admin can send a lead to any trainer." });
  const trainers = await superHandoffTargets();
  return reply(res, 200, { ok: true, trainers, count: trainers.length });
}

// The one write every hand-off makes (rule 91 / 105 / 106): PATCH trainer_id (+ the trainer-name column when present),
// version guarded; audit_events trainer_lead_handoff + lead_events trainer_handoff; no lifecycle_events; no text/email.
// Missy 2026-10-09 (Shauna Leff): a lead that already became a client has a client record with its own trainer_id.
// When the lead moves to another trainer, the client record moves too, but only if it still pointed at the old trainer.
async function moveLinkedClient(leadId, fromTrainerId, toTrainerId) {
  if (!leadId || String(fromTrainerId || "") === String(toTrainerId || "")) return;
  const from = fromTrainerId ? `eq.${encodeURIComponent(String(fromTrainerId))}` : "is.null";
  await supabaseFetch(`/rest/v1/clients?lead_id=eq.${encodeURIComponent(String(leadId))}&trainer_id=${from}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ trainer_id: toTrainerId || null })
  }).catch(error => console.error("client_trainer_follow_failed", String(error?.message || error)));
}

async function writeHandoff(res, access, before, note, { targetRow, targetSlug, fromSlug, path, tag }) {
  const targetName = targetRow.full_name || "";
  const changes = { trainer_id: targetRow.id };
  for (const column of TRAINER_NAME_COLUMNS) if (column in before) changes[column] = targetName;
  // Office 2026-10-08 (Shauna Leff): the lead's trainer_slug must follow the new trainer, or screens and the booking
  // clash check keep seeing the old trainer.
  if ("trainer_slug" in before && (targetSlug || targetRow.slug)) changes.trainer_slug = targetSlug || targetRow.slug;
  let summary = `Sent to ${targetName} (${tag})`;
  if (note) summary += `. Note: ${note}`;

  const requestId = crypto.randomUUID();
  const rows = await supabaseFetch(`/rest/v1/leads?id=eq.${encodeURIComponent(before.id)}&version=eq.${encodeURIComponent(before.version || 1)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(changes)
  });
  const record = rows?.[0];
  if (!record) return reply(res, 409, { ok: false, conflict: true, message: "The lead changed a moment ago. Reload and try again." });
  await moveLinkedClient(record.id, before.trainer_id, targetRow.id);

  const actorId = access.actor?.id || access.user?.id || null;
  const by = access.isSuperAdmin && tag === "super admin" ? "super_admin" : access.isAdmin ? "office" : "trainer";
  await supabaseFetch("/rest/v1/audit_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_user_id: actorId, actor_email: access.actor?.email || null, actor_name: access.actor?.name || null,
      action: "trainer_lead_handoff", entity_type: "lead", entity_id: String(record.id), summary,
      before_data: { trainer_id: before.trainer_id || null, status: before.status },
      after_data: { trainer_id: record.trainer_id || null, status: record.status, to_trainer_name: targetName, from_slug: fromSlug, to_slug: targetSlug, ...path },
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
      raw_payload: { request_id: requestId, by, from_trainer_id: before.trainer_id || null, to_trainer_id: targetRow.id, to_trainer_name: targetName, from_slug: fromSlug, to_slug: targetSlug, ...path }
    })
  });
  return reply(res, 200, {
    ok: true, message: `Sent to ${targetName}.`,
    record: { id: record.id, trainer_id: record.trainer_id, trainer_name: targetName, status: record.status, version: record.version || null }
  });
}

// action "handoff": a super admin sends the lead to any portal trainer (rule 106); the assigned trainer (or an office
// admin) sends it DOWN the tree (rule 105).
async function handoff(res, access, body, before, note) {
  const toTrainerId = clean(body.to_trainer_id, 80);
  if (!toTrainerId) return reply(res, 400, { ok: false, message: "Pick the person in your downline who takes this lead." });
  if (access.isSuperAdmin) {
    if (toTrainerId === String(before.trainer_id || "")) return reply(res, 409, { ok: false, message: "This lead is already with that trainer." });
    const target = (await superHandoffTargets()).find(t => String(t.id) === toTrainerId);
    if (!target) return reply(res, 403, { ok: false, message: NO_PORTAL });
    let fromSlug = "";
    if (before.trainer_id) {
      const [from] = (await supabaseFetch(`/rest/v1/trainers?select=slug&id=eq.${encodeURIComponent(String(before.trainer_id))}&limit=1`)) || [];
      fromSlug = clean(from?.slug, 120).toLowerCase();
    }
    return writeHandoff(res, access, before, note, { targetRow: target, targetSlug: target.slug, fromSlug, path: { owner: false, super_admin: true }, tag: "super admin" });
  }
  // The downline is measured from the trainer the lead is assigned to (the caller, or for the office the assignee).
  const fromTrainerId = access.isAdmin ? String(before.trainer_id || "") : String(access.trainerId || "");
  if (!fromTrainerId) return reply(res, 409, { ok: false, message: "This lead has no trainer yet. Assign it from the office instead." });
  if (toTrainerId === fromTrainerId) return reply(res, 409, { ok: false, message: "This lead is already with that trainer." });
  const [from] = (await supabaseFetch(`/rest/v1/trainers?select=${TEAM_SELECT}&id=eq.${encodeURIComponent(fromTrainerId)}&limit=1`)) || [];
  if (!from) return reply(res, 404, { ok: false, message: "Your trainer record was not found." });
  const { tree, bySlug } = await loadHierarchy();
  if (!tree.ok) {
    console.error("trainer_hierarchy_invalid", JSON.stringify(tree.errors || []).slice(0, 500));
    return reply(res, 403, { ok: false, message: DOWNLINE_ONLY });
  }
  const fromSlug = clean(from.slug, 120).toLowerCase();
  // The target must be ACTIVE on this site AND below the sender on the chart (the owner: anyone on the chart).
  let target = null;
  for (const [slug, row] of bySlug) if (String(row.id) === toTrainerId) { target = { slug, row }; break; }
  if (!target || !H.canSendTo(tree, fromSlug, target.slug)) return reply(res, 403, { ok: false, message: DOWNLINE_ONLY });
  return writeHandoff(res, access, before, note, { targetRow: target.row, targetSlug: target.slug, fromSlug, path: { owner: fromSlug === tree.owner }, tag: "downline" });
}

// Missy 2026-09-28: "he couldn't save a note to a lead". A trainer's note goes into the SAME Office Notes list the
// office reads on that lead (office_notes, entity lead), labelled as the trainer's, with an audit row. No status change.
async function trainerNote(res, access, before, text) {
  if (!text) return reply(res, 400, { ok: false, message: "Type the note first." });
  const who = access.actor?.name || access.actor?.email || "Trainer";
  const noteText = `Trainer note (${who}): ${text}`;
  // Office 2026-10-08 (Robert Wesling's note saved 3 times, 7 s and 3 s apart): the same note on the same lead within
  // 10 minutes is the same note - answer with the saved one instead of adding a copy.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [same] = (await supabaseFetch(`/rest/v1/office_notes?entity_type=eq.lead&entity_id=eq.${encodeURIComponent(String(before.id))}&note=eq.${encodeURIComponent(noteText)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`).catch(() => [])) || [];
  if (same?.id) return reply(res, 200, { ok: true, already: true, message: "Note already saved. The office sees it on this lead.", note: { id: same.id } });
  const rows = await supabaseFetch("/rest/v1/office_notes", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ entity_type: "lead", entity_id: String(before.id), note: noteText, created_by: access.actor?.id || access.user?.id || null })
  });
  const record = rows?.[0];
  if (!record) return reply(res, 500, { ok: false, message: "The note could not be saved. Please try again." });
  await supabaseFetch("/rest/v1/audit_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_user_id: access.actor?.id || access.user?.id || null, actor_email: access.actor?.email || null, actor_name: access.actor?.name || null,
      action: "trainer_lead_note", entity_type: "lead", entity_id: String(before.id), summary: `Trainer note: ${text}`.slice(0, 240),
      before_data: null, after_data: { office_note_id: record.id }, request_id: crypto.randomUUID()
    })
  }).catch(() => {});
  return reply(res, 200, { ok: true, message: "Note saved. The office sees it on this lead.", note: { id: record.id } });
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
    if (req.method === "GET") {
      if (String(req.query?.handoff_targets || "") === "1") return await targetsHandler(res, access);
      return await teamHandler(req, res, access);
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = clean(body.action, 30);
    const leadId = clean(body.lead_id, 80);
    if (!["contacted", "eval_completed", "lost", "archive", "alpha", "handoff", "intro_called", "note", "eval_time"].includes(action)) return reply(res, 400, { ok: false, message: "Unknown action." });
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
    if (action === "note") return await trainerNote(res, access, before, clean(body.note, 1000));
    let changes;
    let summary;
    if (action === "contacted") {
      if (before.status !== "new_inquiry") return reply(res, 409, { ok: false, message: "Only a New Inquiry lead can be marked contacted. This lead is already past that step." });
      changes = { status: "office_contacted" };
      summary = "Trainer marked the lead contacted (Office/Trainer Contacted).";
    } else if (action === "eval_completed") {
      if (before.status !== "evaluation_scheduled") return reply(res, 409, { ok: false, message: "Only a lead in Evaluation Scheduled can be marked Eval completed." });
      changes = { status: "evaluation_complete" };
      summary = "Trainer marked the evaluation completed.";
    } else if (action === "lost") {
      const reason = clean(body.reason, 30);
      if (SOFT_REASONS.has(reason)) return reply(res, 400, { ok: false, message: "Lost is only for a hard no now. Price, not ready, no answer or a complaint means Archive (maybe later)." });
      const status = LOST_REASONS[reason];
      if (!status) return reply(res, 400, { ok: false, message: "Pick why the client was lost." });
      if (CLOSED.has(before.status)) return reply(res, 409, { ok: false, message: "This lead is already closed. Ask the office to change it." });
      changes = { status, lost_reason: LOST_LABELS[reason] };
      summary = `Trainer marked the lead lost: ${LOST_LABELS[reason]}.`;
    } else if (action === "intro_called") {
      // Zoom 2026-09-24: "I called the client" - the trainer checks off the introduction call after an evaluation is
      // booked, which stops the 30-minute reminder (lib/pipeline.js runTrainerCallReminders). No status change.
      if (before.status !== "evaluation_scheduled") return reply(res, 409, { ok: false, message: "This is for a lead in Evaluation Scheduled." });
      const raw = before.raw_payload && typeof before.raw_payload === "object" ? before.raw_payload : {};
      const pipeline = raw.pipeline && typeof raw.pipeline === "object" ? raw.pipeline : {};
      if (pipeline.trainer_intro_called_at) return reply(res, 200, { ok: true, already: true, message: "Already checked off.", record: { id: before.id, status: before.status, version: before.version || null, trainer_intro_called_at: pipeline.trainer_intro_called_at } });
      const at = new Date().toISOString();
      changes = { raw_payload: { ...raw, pipeline: { ...pipeline, trainer_intro_called_at: at, trainer_intro_called_by: access.actor?.name || access.actor?.email || (access.isAdmin ? "office" : "trainer") } } };
      summary = "Trainer checked off: called the client to introduce themselves.";
    } else if (action === "eval_time") {
      // Missy 2026-09-28: a trainer reschedules the evaluation on their own lead, the same field as the office's
      // "Eval date + time" box (leads.eval_scheduled_at). Blank clears it.
      if (CLOSED.has(before.status)) return reply(res, 409, { ok: false, message: "This lead is closed. Ask the office to change it." });
      const raw = clean(body.eval_at, 40);
      const when = raw ? new Date(raw) : null;
      if (when && Number.isNaN(when.getTime())) return reply(res, 400, { ok: false, message: "The eval date and time could not be read. Pick it again." });
      changes = { eval_scheduled_at: when ? when.toISOString() : null };
      summary = when ? `Trainer set the evaluation date and time to ${when.toISOString()}${before.eval_scheduled_at ? ` (was ${before.eval_scheduled_at})` : ""}.` : "Trainer cleared the evaluation date and time.";
      // Office 2026-10-03: "if you put a scheduled eval time and date the card automatically moves to eval
      // scheduled" - an open lead that is not yet scheduled moves to Evaluation Scheduled. Clearing the time
      // never moves a card back.
      if (when && BEFORE_EVAL.has(before.status)) { changes.status = "evaluation_scheduled"; summary += " The lead moved to Evaluation Scheduled."; }
    } else if (action === "archive") {
      // "Archive (maybe later)": the lead leaves the trainer's board (rule 80: archived is never drawn for a trainer),
      // stays on file with its reason, and the office can bring it back at any time (Restore).
      const reason = clean(body.reason, 30);
      const label = ARCHIVE_LABELS[reason];
      if (!label) return reply(res, 400, { ok: false, message: "Pick why this lead is archived for later." });
      if (CLOSED.has(before.status)) return reply(res, 409, { ok: false, message: "This lead is already closed. Ask the office to change it." });
      const at = new Date().toISOString();
      const raw = before.raw_payload && typeof before.raw_payload === "object" ? before.raw_payload : {};
      changes = {
        status: "archived", archived_at: at,
        raw_payload: { ...raw, archive_reason: { reason, label, ...(note ? { note } : {}), at, by: "trainer", by_name: access.actor?.name || "" } }
      };
      summary = `Trainer archived the lead for later: ${label}.`;
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
        after_data: { status: record.status, added_to_alpha: record.added_to_alpha ?? null, ...(action === "intro_called" ? { trainer_intro_called_at: record.raw_payload?.pipeline?.trainer_intro_called_at || null } : {}) },
        request_id: requestId
      })
    });
    if (action === "intro_called") {
      await supabaseFetch("/rest/v1/lead_events", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          lead_id: record.id, event_type: "trainer_intro_called", previous_status: before.status, new_status: record.status,
          actor_user_id: access.actor?.id || access.user?.id || null, note: note || null,
          event_key: `lead:${record.id}:intro_called`, occurred_at: new Date().toISOString(),
          raw_payload: { request_id: requestId, by: access.isAdmin ? "office" : "trainer" }
        })
      });
    }
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
    const message = action === "eval_time" ? (record.status !== before.status ? "Eval date and time saved. The lead moved to Evaluation Scheduled." : "Eval date and time saved. The office sees it.") : action === "contacted" ? "Marked contacted. The office sees it." : action === "eval_completed" ? "Marked Eval completed." : action === "lost" ? "Marked lost. The office sees it." : action === "archive" ? "Archived for later. The office sees it and can bring it back." : action === "intro_called" ? "Checked off: you called the client. No more reminders for this one." : changes.added_to_alpha === true ? "Saved: logged in Alpha." : changes.added_to_alpha === false ? "Saved: not logged in Alpha yet." : "Alpha answer cleared.";
    return reply(res, 200, { ok: true, message, record: { id: record.id, status: record.status, added_to_alpha: record.added_to_alpha ?? null, version: record.version || null, ...(action === "intro_called" ? { trainer_intro_called_at: record.raw_payload?.pipeline?.trainer_intro_called_at || null } : {}) } });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return reply(res, status, { ok: false, message: error.message || "The lead could not be updated." });
  }
};
