// Join duplicate lead cards into ONE card (owner Joshua + office manager Missy, 2026-09-28; DO-NOT-BREAK rules 129-133).
//
// Owner: "join them, keep the recycled logo on them, they will still count as one lead not two, and the history should
// be seen when someone clicks the Recycled badge - the recycle history and how and what page did they use to come in,
// keeping their history plainly written, also office notes and the other things Missy wanted to keep."
//
// HOW A JOIN WORKS (one database transaction per joined card: rpc ldtt_merge_lead, migration 20260928200000_lead_merge.sql)
//   (a) a FULL backup of the joined card and of every child row it has goes into private.lead_merge_backup FIRST;
//   (b) every child row moves onto the card that stays (lead_events, communications_alert_deliveries, deals, clients,
//       booking_holds, office_notes + office_note_revisions, lifecycle_events, form_delivery_attempts, audit_events);
//   (c) a plain-words snapshot of the joined request is appended to the staying card's raw_payload.merged_requests[]
//       (built here, in metrics.js words), and a field the staying card is missing is filled from the joined card;
//   (d) only THEN the joined card is deleted. Version-guarded on both cards; audit_events "lead_merged".
// The card that stays = the most advanced status, a tie goes to the NEWEST card (metrics.js chooseMergeMain). It keeps
// its own status, trainer, booking, phone and email. qa cards are never joined. unmergeFromBackup() puts a card back.
//
// THE ONE-TIME JOIN of the existing duplicates runs from the */15 cron behind site_settings "lead_merge_batch" (server
// only, ships DISARMED, the rule 101 / 128 pattern): armed -> it disarms itself first (version-guarded on updated_at);
// mode "dry" lists every group and every number and changes NOTHING; mode "send" joins them, with a time budget, and a
// run that stops part-way ("incomplete") is carried on by the next tick. Nothing here sends a text or an email.
"use strict";

const B = require("./booking");
const M = require("../trainer-backoffice/metrics.js");

const KEY = "lead_merge_batch";
const BUDGET_MS = 8 * 60 * 1000;
const STALE_MS = 14 * 60 * 1000;
const MAX_RESUMES = 8;
const CHILD_TABLES = [
  // [label, table, column, extra filter]
  ["office_notes", "office_notes", "entity_id", "entity_type=eq.lead"],
  ["office_note_revisions", "office_note_revisions", "entity_id", "entity_type=eq.lead"],
  ["lead_events", "lead_events", "lead_id", ""],
  ["lifecycle_events", "lifecycle_events", "entity_id", "entity_type=eq.lead"],
  ["form_delivery_attempts", "form_delivery_attempts", "entity_id", ""],
  ["booking_holds", "booking_holds", "lead_id", ""],
  ["deals", "deals", "lead_id", ""],
  ["clients", "clients", "lead_id", ""],
  ["communications_alert_deliveries", "communications_alert_deliveries", "lead_id", ""],
  ["audit_events", "audit_events", "entity_id", ""]
];

const list = rows => (Array.isArray(rows) ? rows : []);
const rawOf = row => (row && row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {});
// Never merge qa rows: the boolean flag (rule 1) AND the three old string "true" rows (rule 98).
const isQaRow = row => rawOf(row).qa === true || rawOf(row).qa === "true";
const keysOf = row => M.personMatchKeys(row);
const emailKey = row => (keysOf(row).find(k => k.startsWith("e:")) || "");
const phoneKey = row => (keysOf(row).find(k => k.startsWith("p:")) || "");
const tenDigits = value => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.length === 10 ? digits : "";
};
const firstNameKey = row => String((row && row.first_name) || "").trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z]/g, "");
const lastNameKey = row => String((row && row.last_name) || "").trim().toLowerCase().replace(/[^a-z]/g, "");
const shortName = row => `${String((row && row.first_name) || "?").trim() || "?"} ${String((row && row.last_name) || "").trim().slice(0, 1)}${String((row && row.last_name) || "").trim() ? "." : ""}`.trim();
const etTime = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
};
const statusWords = db => M.statusLabel(({ follow_up_call_needed: "Office Contacted" })[db] || Object.entries({
  "New Inquiry": "new_inquiry", "Office Contacted": "office_contacted", "Engaged Lead: No Outcome": "engaged_no_outcome",
  "Evaluation Scheduled": "evaluation_scheduled", "Evaluation Cancelled": "evaluation_cancelled", "Evaluation Complete": "evaluation_complete",
  "Became a Client": "became_client", "Archived": "archived", "Do Not Contact": "do_not_contact", "Bad Lead": "bad_lead"
}).find(([, v]) => v === db)?.[0] || String(db || "").replace(/_/g, " "));

// ---- grouping -------------------------------------------------------------------------------------------------------
// Same normalized email => same person. A phone-only match joins ONLY when the first names match (first word, any case)
// AND the phone is not an ACTIVE communications_testers phone; every other phone-only match is left for the office.
// qa rows are never joined, and a person whose cards touch a qa row is skipped whole. Two cards that each have their
// own client record are skipped (the office decides which client record is the real one).
function groupDuplicates(rows, { testerPhones = [], clientLeadIds = [] } = {}) {
  const all = list(rows).filter(row => row && row.id);
  const real = all.filter(row => !isQaRow(row));
  const qaRows = all.filter(isQaRow);
  const parent = real.map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[rb] = ra; };
  const emailOwner = new Map();
  real.forEach((row, i) => {
    const key = emailKey(row);
    if (!key) return;
    if (emailOwner.has(key)) union(emailOwner.get(key), i); else emailOwner.set(key, i);
  });
  const emailRoot = real.map((_, i) => find(i));
  const testers = new Set(list(testerPhones).map(tenDigits).filter(Boolean));
  const byPhone = new Map();
  real.forEach((row, i) => {
    const key = phoneKey(row);
    if (!key) return;
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key).push(i);
  });
  const phoneLinks = [];
  const testerLinks = [];
  for (const [key, idx] of byPhone) {
    if (idx.length < 2 || new Set(idx.map(i => emailRoot[i])).size < 2) continue; // already one person by email
    if (testers.has(key.slice(2))) { testerLinks.push(idx); continue; }
    const byName = new Map();
    idx.forEach(i => {
      const name = firstNameKey(real[i]);
      if (!name) return;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(i);
    });
    for (const members of byName.values()) members.slice(1).forEach(i => union(members[0], i));
    phoneLinks.push(idx);
  }
  const comps = new Map();
  real.forEach((row, i) => {
    const root = find(i);
    if (!comps.has(root)) comps.set(root, []);
    comps.get(root).push(i);
  });
  // A person whose cards share an email or a real phone with a qa card is skipped whole.
  const qaKeys = new Set(qaRows.flatMap(keysOf));
  const clients = new Set(list(clientLeadIds).map(String));
  const at = row => new Date(row.created_at || row.createdAt || 0).getTime() || 0;
  const oldestFirst = members => members.map(i => real[i]).sort((a, b) => at(a) - at(b) || String(a.id).localeCompare(String(b.id)));
  const join = [];
  const skipped = [];
  for (const members of comps.values()) {
    if (members.length < 2) continue;
    const cards = oldestFirst(members);
    const kind = new Set(members.map(i => emailRoot[i])).size === 1 ? "email" : "phone_same_name";
    if (cards.some(row => keysOf(row).some(key => qaKeys.has(key)))) { skipped.push({ reason: "qa", kind, cards }); continue; }
    if (cards.filter(row => clients.has(String(row.id))).length > 1) { skipped.push({ reason: "two_clients", kind, cards }); continue; }
    join.push({ kind, cards });
  }
  const seen = new Set();
  const leftOver = [];
  for (const idx of phoneLinks) {
    const roots = [...new Set(idx.map(find))];
    if (roots.length < 2) continue;
    const sig = roots.sort().join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    leftOver.push({ reason: "phone_different_first_names", cards: oldestFirst(roots.flatMap(root => comps.get(root))) });
  }
  const testerGroups = testerLinks.map(idx => ({ reason: "tester_phone", cards: oldestFirst([...new Set(idx)]) }));
  // A qa card that shares a key with a real card: reported (never joined).
  return { join, skipped, leftOver, testerGroups };
}

// ---- the plain-words snapshot -------------------------------------------------------------------------------------
const FOLLOWUP_WORDS = { tim: "the 15-minute follow-up", link: "the 30-minute follow-up", care: "the next-day follow-up" };
// Which texts / emails reached the CLIENT on that request (what the pipeline recorded as sent; nothing is guessed).
function requestMessages(raw) {
  const out = [];
  const p = raw && raw.pipeline && typeof raw.pipeline === "object" ? raw.pipeline : {};
  const sent = item => item && typeof item === "object" && item.status === "sent";
  if (sent(p.new_lead_text)) out.push("the booking-link text");
  if (sent(p.new_lead_client_email)) out.push("the booking-link email");
  if (sent(p.care_text)) out.push("the office-will-call text");
  if (sent(p.care_client_email)) out.push("the office-will-call email");
  for (const step of list(p.followups)) {
    const words = FOLLOWUP_WORDS[step && step.step] || "a follow-up";
    if (sent(step)) out.push(`${words} text`);
    if (sent(step && step.client_email)) out.push(`${words} email`);
  }
  const re = p.reengage && typeof p.reengage === "object" ? p.reengage : null;
  if (re && (re.status === "sent" || re.text_status === "sent" || re.text === "sent")) out.push("the re-engage invite text");
  if (re && (re.email_status === "sent" || (re.email && re.email.status === "sent"))) out.push("the re-engage invite email");
  const campaigns = p.email_campaigns && typeof p.email_campaigns === "object" ? Object.values(p.email_campaigns) : [];
  if (campaigns.some(sent)) out.push("the office's lead email");
  for (const notice of list(p.booking_notices)) if (sent(notice && notice.client_email)) out.push("the booking confirmation email");
  return [...new Set(out)];
}

function buildSnapshot(row, { trainerName = "", actorName = "" } = {}) {
  const raw = rawOf(row);
  const entry = M.requestEntryFromLead(row, { trainerName });
  const extras = Object.entries(raw).filter(([key, value]) => /^Extra: /.test(key) && value !== "" && value != null)
    .slice(0, 20).map(([key, value]) => [key.replace(/^Extra: /, "").slice(0, 120), String(value).slice(0, 300)]);
  const snapshot = {
    ...entry,
    messages: requestMessages(raw),
    lane: String(raw.pipeline?.lane?.label || "").slice(0, 120),
    sms_consent: row.sms_consent === true ? "yes" : row.sms_consent === false ? "no" : "",
    zip: String(row.zip || "").slice(0, 10),
    ...(extras.length ? { extra_answers: extras } : {}),
    office_note_text: String(row.office_notes || "").slice(0, 4000),
    lost_reason: String(row.lost_reason || "").slice(0, 300),
    merged_by: String(actorName || "").slice(0, 120)
  };
  snapshot.summary = M.requestSummary(snapshot);
  return snapshot;
}

// ---- the join -----------------------------------------------------------------------------------------------------
const plainDbError = error => String(error?.message || error || "The join failed.").replace(/^lead_(un)?merge:\s*/i, "");

async function trainerNames(ids) {
  const wanted = [...new Set(list(ids).filter(Boolean))];
  if (!wanted.length) return new Map();
  const rows = await B.sbOrThrow(`/rest/v1/trainers?select=id,full_name&id=in.(${wanted.map(encodeURIComponent).join(",")})`).catch(() => []);
  return new Map(list(rows).map(row => [row.id, row.full_name || ""]));
}

// Joins every card in otherIds into mainId. Refuses qa cards and a main that is not the most advanced (the server
// never lets a booked/client card be joined into a less advanced one). expectedVersions: { [id]: version }.
async function mergeLeadGroup(mainId, otherIds, actor = {}, { expectedVersions = {} } = {}) {
  const ids = [...new Set([mainId, ...list(otherIds)].map(String))].filter(Boolean);
  if (ids.length < 2 || !mainId) { const error = new Error("Two different cards are needed to join."); error.status = 400; throw error; }
  const rows = await B.sbOrThrow(`/rest/v1/leads?select=*&id=in.(${ids.map(encodeURIComponent).join(",")})`);
  const byId = new Map(list(rows).map(row => [String(row.id), row]));
  const main = byId.get(String(mainId));
  if (!main) { const error = new Error("The card that stays was not found."); error.status = 404; throw error; }
  const others = ids.filter(id => id !== String(mainId)).map(id => byId.get(id)).filter(Boolean);
  if (!others.length) { const error = new Error("The other card was not found (it may already be joined)."); error.status = 404; throw error; }
  if ([main, ...others].some(isQaRow)) { const error = new Error("Test (qa) cards are never joined."); error.status = 400; throw error; }
  const best = M.chooseMergeMain([main, ...others]);
  if ((M.MERGE_STATUS_RANK[best.status] || 1) > (M.MERGE_STATUS_RANK[main.status] || 1)) {
    const error = new Error("The card that stays must be the most advanced one."); error.status = 409; throw error;
  }
  const names = await trainerNames([main, ...others].map(row => row.trainer_id));
  const actorJson = { id: actor.id || null, email: actor.email || "", name: actor.name || actor.email || "Office" };
  let mainVersion = expectedVersions[String(mainId)] ?? main.version;
  const merged = [];
  const oldestFirst = others.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const other of oldestFirst) {
    const snapshot = buildSnapshot(other, { trainerName: names.get(other.trainer_id) || other.assigned_trainer_name || "", actorName: actorJson.name });
    try {
      const out = await B.sbOrThrow("/rest/v1/rpc/ldtt_merge_lead", {
        method: "POST",
        body: { p_main: main.id, p_other: other.id, p_main_version: mainVersion ?? null, p_other_version: expectedVersions[String(other.id)] ?? other.version ?? null, p_snapshot: snapshot, p_actor: actorJson }
      });
      mainVersion = out?.main_version ?? mainVersion;
      merged.push({ merged_id: other.id, ok: true, name: shortName(other), moved: out?.moved || {}, backup_id: out?.backup_id || null });
    } catch (error) {
      const failure = new Error(plainDbError(error));
      failure.status = error.code === "40001" ? 409 : error.status && error.status < 500 ? 400 : 500;
      failure.merged = merged;
      throw failure;
    }
  }
  return { ok: true, main_id: main.id, main_version: mainVersion, merged };
}

async function unmergeFromBackup(mergedId, actor = {}) {
  try {
    return await B.sbOrThrow("/rest/v1/rpc/ldtt_unmerge_lead", {
      method: "POST",
      body: { p_merged: mergedId, p_actor: { id: actor.id || null, email: actor.email || "", name: actor.name || actor.email || "Office" } }
    });
  } catch (error) {
    const failure = new Error(plainDbError(error));
    failure.status = error.status && error.status < 500 ? 400 : 500;
    throw failure;
  }
}

// ---- the one-time batch (cron) ---------------------------------------------------------------------------------------
async function inChunks(ids, fn, size = 40) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(...list(await fn(ids.slice(i, i + size))));
  return out;
}

async function childCounts(ids) {
  const counts = new Map(ids.map(id => [String(id), Object.fromEntries(CHILD_TABLES.map(([label]) => [label, 0]))]));
  for (const [label, table, column, filter] of CHILD_TABLES) {
    const rows = await inChunks(ids, chunk => B.sbOrThrow(`/rest/v1/${table}?select=id,${column}&${column}=in.(${chunk.map(encodeURIComponent).join(",")})${filter ? `&${filter}` : ""}&limit=5000`));
    for (const row of rows) {
      const entry = counts.get(String(row[column]));
      if (entry) entry[label] += 1;
    }
  }
  return counts;
}

function cardWords(row, { names, counts }) {
  const raw = rawOf(row);
  return {
    id: row.id,
    name: shortName(row),
    came_in: etTime(row.created_at),
    status: statusWords(row.status),
    trainer: names.get(row.trainer_id) || row.assigned_trainer_name || "",
    page: M.requestPageName(row),
    heard: String(raw.heard_about_us || row.lead_source || "").slice(0, 80),
    ...(raw.booking?.slot_start ? { booked: String(raw.booking.when_label || raw.booking.slot_start).slice(0, 80) } : {}),
    ...(row.eval_scheduled_at ? { eval_at: etTime(row.eval_scheduled_at) } : {}),
    ...(counts ? { children: counts.get(String(row.id)) || {} } : {})
  };
}

function groupFlags(cards, clientIds) {
  const flags = [];
  if (new Set(cards.map(firstNameKey).filter(Boolean)).size > 1) flags.push("different first names on the same email");
  else if (new Set(cards.map(lastNameKey).filter(Boolean)).size > 1) flags.push("different last names");
  if (new Set(cards.map(row => row.trainer_id).filter(Boolean)).size > 1) flags.push("different trainers");
  const booked = cards.filter(row => rawOf(row).booking?.slot_start || row.eval_scheduled_at);
  if (booked.length > 1 && new Set(booked.map(row => String(rawOf(row).booking?.slot_start || row.eval_scheduled_at))).size > 1) flags.push("more than one booking (different times)");
  if (cards.some(row => row.status === "became_client" || clientIds.has(String(row.id)))) flags.push("a client card is in this group");
  return flags;
}

function stats(rows) {
  const nonQa = rows.filter(row => rawOf(row).qa !== true); // exactly the screens' hold-out (rule 1 / 98)
  const byStatus = {};
  for (const row of nonQa) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  const portalRows = nonQa.map(row => ({ ...M.normalizeLeadRow(row), phone: row.phone || "" }));
  return {
    total_rows: rows.length,
    non_qa_rows: nonQa.length,
    by_status: Object.fromEntries(Object.entries(byStatus).sort()),
    board_columns: Object.fromEntries(M.leadBoardColumnCounts(portalRows).map(([label, n]) => [M.statusLabel(label), n])),
    recycled_badges: M.recycledIndex(portalRows).size
  };
}

async function loadEverything() {
  const leads = await B.sbOrThrow("/rest/v1/leads?select=*&order=created_at.asc&limit=10000");
  const testers = await B.sbOrThrow("/rest/v1/communications_testers?select=phone&active=is.true").catch(() => []);
  // Candidate ids = every card that shares an email or a real phone with another card (any rule), so the child
  // counts and client records are read only for those.
  const owners = new Map();
  for (const row of leads) for (const key of keysOf(row)) owners.set(key, (owners.get(key) || 0) + 1);
  const candidates = leads.filter(row => keysOf(row).some(key => owners.get(key) > 1)).map(row => String(row.id));
  const clientRows = await inChunks(candidates, chunk => B.sbOrThrow(`/rest/v1/clients?select=lead_id&lead_id=in.(${chunk.join(",")})`));
  return { leads, testers: list(testers).map(row => row.phone), candidates, clientIds: new Set(clientRows.map(row => String(row.lead_id))) };
}

async function dryAudit() {
  const { leads, testers, candidates, clientIds } = await loadEverything();
  const grouping = groupDuplicates(leads, { testerPhones: testers, clientLeadIds: [...clientIds] });
  const counts = await childCounts(candidates);
  const names = await trainerNames(leads.map(row => row.trainer_id));
  const before = stats(leads);
  const removed = new Set();
  const plannedMain = new Map();
  const join = grouping.join.map((group, n) => {
    const main = M.chooseMergeMain(group.cards);
    const others = group.cards.filter(row => row !== main);
    others.forEach(row => removed.add(String(row.id)));
    plannedMain.set(String(main.id), others);
    const sameRank = others.some(row => (M.MERGE_STATUS_RANK[row.status] || 1) === (M.MERGE_STATUS_RANK[main.status] || 1));
    return {
      n: n + 1,
      kind: group.kind === "email" ? "same email" : "same phone + same first name",
      stays: cardWords(main, { names, counts }),
      why_it_stays: sameRank ? `same stage as the others (${statusWords(main.status)}), so the NEWEST card stays` : `most advanced status (${statusWords(main.status)})`,
      joins: others.map(row => cardWords(row, { names, counts })),
      flags: groupFlags(group.cards, clientIds),
      check_no_less_advanced: others.every(row => (M.MERGE_STATUS_RANK[row.status] || 1) <= (M.MERGE_STATUS_RANK[main.status] || 1))
    };
  });
  // AFTER, predicted: the joined cards are gone; each card that stays carries its joined requests (for the badge).
  const afterRows = leads.filter(row => !removed.has(String(row.id))).map(row => {
    const others = plannedMain.get(String(row.id));
    if (!others) return row;
    return { ...row, raw_payload: { ...rawOf(row), merged_requests: [...M.mergedRequestsOf(row), ...others.map(o => ({ created_at: o.created_at, merged_id: o.id }))] } };
  });
  const after = stats(afterRows);
  const moved = {};
  for (const id of removed) for (const [label, n] of Object.entries(counts.get(id) || {})) moved[label] = (moved[label] || 0) + n;
  const statusDrops = {};
  for (const row of leads) if (removed.has(String(row.id))) statusDrops[row.status] = (statusDrops[row.status] || 0) + 1;
  const persons = leads.filter(row => !isQaRow(row)).length - grouping.join.reduce((sum, g) => sum + g.cards.length - 1, 0)
    - grouping.skipped.reduce((sum, g) => sum + g.cards.length - 1, 0);
  const pack = rows => rows.map(row => cardWords(row, { names, counts }));
  return {
    before: { ...before, persons },
    groups: {
      to_join: join.length,
      email_groups: grouping.join.filter(g => g.kind === "email").length,
      phone_same_first_name_groups: grouping.join.filter(g => g.kind !== "email").length,
      rows_in_groups_to_join: grouping.join.reduce((sum, g) => sum + g.cards.length, 0),
      cards_removed: removed.size,
      left_for_office_phone_different_names: grouping.leftOver.length,
      skipped_tester_phone: grouping.testerGroups.length,
      skipped_qa: grouping.skipped.filter(g => g.reason === "qa").length,
      skipped_two_client_records: grouping.skipped.filter(g => g.reason === "two_clients").length
    },
    join,
    left_for_office: grouping.leftOver.map(g => ({ reason: "same phone, different first names", cards: pack(g.cards) })),
    skipped: [
      ...grouping.testerGroups.map(g => ({ reason: "a tester phone (never joined)", cards: pack(g.cards) })),
      ...grouping.skipped.map(g => ({ reason: g.reason === "qa" ? "touches a test (qa) card" : "two cards each have their own client record", cards: pack(g.cards) }))
    ],
    children_moved_total: moved,
    after: {
      ...after,
      persons,
      changes: [
        `${after.total_rows - before.total_rows} rows: ${removed.size} older/less advanced duplicate cards are joined into the card that stays.`,
        `${after.non_qa_rows - before.non_qa_rows} non-qa rows (no qa row is touched).`,
        ...Object.entries(statusDrops).map(([status, n]) => `${statusWords(status)}: -${n} (${n} joined card${n === 1 ? "" : "s"} had this status; the card that stays keeps its own).`),
        `Recycled badges: ${before.recycled_badges} -> ${after.recycled_badges} (every card that stays wears it; the joined cards are gone).`
      ]
    }
  };
}

async function runLeadMergeBatch({ clock = () => Date.now(), budgetMs = BUDGET_MS } = {}) {
  const started = clock();
  let row;
  try {
    row = (await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&select=key,value,updated_at&limit=1`))?.[0] || null;
  } catch (error) {
    return { armed: false, message: `The join setting could not be read: ${String(error?.message || error).slice(0, 200)}` };
  }
  const value = row?.value && typeof row.value === "object" ? row.value : {};
  const runs = Number(value.runs || 0);
  const carryOn = value.mode === "send" && value.resume !== false && runs < MAX_RESUMES && (value.status === "incomplete"
    || (value.status === "running" && started - Date.parse(value.run_started_at || 0) > STALE_MS));
  if (!row || (value.armed !== true && !carryOn)) return { armed: false, message: "lead_merge_batch is not armed." };
  const mode = value.mode === "send" ? "send" : "dry";
  // Disarm FIRST (the claim is the kill switch; a crash mid-run leaves it disarmed).
  const claim = await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&updated_at=eq.${encodeURIComponent(row.updated_at)}`, {
    method: "PATCH", prefer: "return=representation",
    body: { value: { ...value, armed: false, status: "running", mode, run_started_at: new Date(started).toISOString(), runs: runs + 1 }, updated_at: new Date().toISOString() }
  }).catch(() => null);
  if (!claim?.[0]) return { armed: true, message: "Another run claimed the join first. Nothing done here." };
  const claimed = claim[0];

  let summary;
  let status = "done";
  if (mode === "dry") {
    summary = { at: new Date().toISOString(), mode, note: "DRY RUN: nothing was changed. These are the groups a send would join.", ...(await dryAudit()) };
  } else {
    const { leads, testers, clientIds } = await loadEverything();
    const grouping = groupDuplicates(leads, { testerPhones: testers, clientLeadIds: [...clientIds] });
    const details = [];
    let joined = 0, removed = 0, failed = 0, remaining = 0;
    for (const group of grouping.join) {
      if (clock() - started >= budgetMs) { remaining += 1; continue; }
      const main = M.chooseMergeMain(group.cards);
      const others = group.cards.filter(card => card !== main);
      try {
        const out = await mergeLeadGroup(main.id, others.map(card => card.id), { name: "Lead join (office request 2026-09-28)" },
          { expectedVersions: Object.fromEntries(group.cards.map(card => [String(card.id), card.version])) });
        joined += 1;
        removed += out.merged.length;
        details.push({ stays: `${shortName(main)} (${etTime(main.created_at)})`, joined: out.merged.map(m => m.name), moved: out.merged.map(m => m.moved) });
      } catch (error) {
        failed += 1;
        removed += list(error.merged).length;
        details.push({ stays: `${shortName(main)} (${etTime(main.created_at)})`, error: String(error.message).slice(0, 200), joined_before_error: list(error.merged).map(m => m.name) });
      }
    }
    if (remaining) status = "incomplete";
    const previous = value.status === "incomplete" || value.status === "running" ? (value.last_run || {}) : {};
    summary = {
      at: new Date().toISOString(), mode, groups_joined: joined + Number(previous.groups_joined || 0), cards_removed: removed + Number(previous.cards_removed || 0),
      failed, remaining, left_for_office: grouping.leftOver.length, skipped: grouping.skipped.length + grouping.testerGroups.length,
      details: [...list(previous.details), ...details].slice(0, 300)
    };
  }
  // Keep a stop the office wrote during the run (resume:false / status:"stopped"); the note survives.
  const latest = (await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&select=value&limit=1`).catch(() => null))?.[0]?.value || claimed.value || {};
  const stopped = latest.resume === false || latest.status === "stopped";
  await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}`, {
    method: "PATCH", prefer: "return=minimal",
    body: { value: { ...latest, armed: false, mode, status: stopped ? "stopped" : status, last_run: summary, run_log: [...list(latest.run_log), { at: summary.at, mode, status }].slice(-20) }, updated_at: new Date().toISOString() }
  }).catch(err => console.error("lead_merge_summary_failed", String(err?.message || err)));
  return { armed: true, ran: true, mode, status, ...(mode === "dry" ? { groups: summary.groups, before: { total_rows: summary.before.total_rows, non_qa_rows: summary.before.non_qa_rows }, after: { total_rows: summary.after.total_rows, non_qa_rows: summary.after.non_qa_rows } } : { groups_joined: summary.groups_joined, cards_removed: summary.cards_removed, failed: summary.failed, remaining: summary.remaining }) };
}

module.exports = {
  KEY, CHILD_TABLES, isQaRow, groupDuplicates, requestMessages, buildSnapshot, mergeLeadGroup, unmergeFromBackup,
  runLeadMergeBatch, dryAudit, stats, shortName
};
