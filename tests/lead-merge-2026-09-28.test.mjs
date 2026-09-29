// Joining duplicate lead cards (Joshua + Missy, 2026-09-28; DO-NOT-BREAK rules 129-133). The same person often had 2-3
// cards (a first request, an e-book card, a booking from the re-engage link). They are joined into ONE card that keeps
// the Recycled badge; the badge opens the plain-words history; the person counts once.
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
delete process.env.LDTT_SANDBOX;
const M = require("../trainer-backoffice/metrics.js");
const LM = require("../lib/lead-merge.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const app = read("trainer-backoffice/app.js");
const sql = read("supabase/migrations/20260928200000_lead_merge.sql");
const libSrc = read("lib/lead-merge.js");
const mutation = read("api/operational-mutation.js");
const fn = (src, name) => src.match(new RegExp(`(?:async )?function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const lead = (id, extra = {}) => ({ id, first_name: "Diana", last_name: "Melendez", email: "", phone: "", status: "office_contacted", created_at: "2026-09-21T02:15:00Z", version: 1, raw_payload: {}, ...extra });

test("the card that stays: the most advanced status; a tie goes to the NEWEST card", () => {
  const a = lead("a", { status: "evaluation_scheduled", created_at: "2026-09-24T11:08:00Z" });
  const b = lead("b", { status: "office_contacted", created_at: "2026-09-26T11:08:00Z" });
  const c = lead("c", { status: "became_client", created_at: "2026-08-01T00:00:00Z" });
  assert.equal(M.chooseMergeMain([a, b]).id, "a", "booked beats a newer contacted card");
  assert.equal(M.chooseMergeMain([a, b, c]).id, "c", "a client card always stays");
  const e1 = lead("e1", { status: "new_inquiry", created_at: "2026-08-28T00:00:00Z" });
  const e2 = lead("e2", { status: "new_inquiry", created_at: "2026-09-27T00:00:00Z" });
  assert.equal(M.chooseMergeMain([e1, e2]).id, "e2", "same stage: the newest stays");
  assert.equal(M.chooseMergeMain([lead("l", { status: "lost_no_response", created_at: "2026-09-28T00:00:00Z" }), lead("n", { status: "new_inquiry" })]).id, "n", "lost/archived rank below new inquiry");
  assert.equal(M.chooseMergeMain([{ id: "u1", status: "Evaluation Scheduled", createdAt: "2026-09-01" }, { id: "u2", status: "Office Contacted", createdAt: "2026-09-20" }]).id, "u1", "portal rows (labels) rank the same");
  assert.deepEqual(M.MERGE_STATUS_RANK, { became_client: 6, evaluation_complete: 5, evaluation_scheduled: 4, engaged_no_outcome: 3, office_contacted: 3, follow_up_call_needed: 3, new_inquiry: 2 });
});

test("grouping: same email joins; same phone joins ONLY with the same first name; tester phones, qa cards and two client records never join", () => {
  const rows = [
    lead("email-1", { email: "Beth@x.com", first_name: "Beth", created_at: "2026-08-28T00:00:00Z" }),
    lead("email-2", { email: " beth@X.com ", first_name: "Elizabeth", created_at: "2026-08-31T00:00:00Z" }),
    lead("phone-1", { phone: "(210) 555-0142", first_name: "Ligia", email: "ligia@a.com", created_at: "2026-09-12T00:00:00Z" }),
    lead("phone-2", { phone: "+1 210 555 0142", first_name: "LIGIA ", email: "other@b.com", created_at: "2026-09-24T00:00:00Z" }),
    lead("diff-1", { phone: "2165550111", first_name: "Mark", email: "m@a.com" }),
    lead("diff-2", { phone: "2165550111", first_name: "Sue", email: "s@a.com" }),
    lead("tester-1", { phone: "+14402142915", first_name: "Josh", email: "j1@a.com" }),
    lead("tester-2", { phone: "440-214-2915", first_name: "Josh", email: "j2@a.com" }),
    lead("qa-real", { email: "qa-touch@x.com" }),
    lead("qa-real-2", { email: "qa-touch@x.com" }),
    lead("qa-row", { email: "qa-touch@x.com", raw_payload: { qa: true } }),
    lead("qa-only-1", { email: "t@t.com", raw_payload: { qa: "true" } }),
    lead("qa-only-2", { email: "t@t.com", raw_payload: { qa: true } }),
    lead("client-1", { email: "two@c.com", status: "became_client" }),
    lead("client-2", { email: "two@c.com", status: "became_client" }),
    lead("alone", { email: "solo@x.com" })
  ];
  const out = LM.groupDuplicates(rows, { testerPhones: ["+14402142915"], clientLeadIds: ["client-1", "client-2"] });
  const ids = groups => groups.map(g => g.cards.map(c => c.id).sort().join(",")).sort();
  assert.deepEqual(ids(out.join), ["email-1,email-2", "phone-1,phone-2"]);
  assert.equal(out.join.find(g => g.cards[0].id === "email-1").kind, "email");
  assert.equal(out.join.find(g => g.cards[0].id === "phone-1").kind, "phone_same_name");
  assert.deepEqual(ids(out.leftOver), ["diff-1,diff-2"], "different first names on one phone are left for the office");
  assert.deepEqual(ids(out.testerGroups), ["tester-1,tester-2"], "a tester phone never joins");
  assert.deepEqual(out.skipped.map(g => [g.reason, g.cards.map(c => c.id).sort().join(",")]).sort(), [["qa", "qa-real,qa-real-2"], ["two_clients", "client-1,client-2"]]);
  assert.ok(![...out.join, ...out.leftOver, ...out.skipped].some(g => g.cards.some(c => /^qa-(row|only)/.test(c.id))), "a qa card is never in any group");
});

test("the snapshot of a joined request is plain words: page, how they heard (and who referred them), what they asked, status, trainer, what we sent", () => {
  const row = lead("x", {
    status: "office_contacted", assigned_trainer_name: "Carolina Perez", source_page: "contact.html", office_notes: "Called, left a voicemail.", lead_source: "Referred by a past client",
    raw_payload: {
      source_page: "contact.html", heard_about_us: "Referred by a past client", vet_or_previous_client: "Maria G.", i_want_to: "Schedule an in-person evaluation",
      utm_source: "fb", "Extra: Best time to call": "Evenings",
      pipeline: { new_lead_text: { status: "sent" }, new_lead_client_email: { status: "sent" }, followups: [{ step: "tim", status: "sent", client_email: { status: "sent" } }, { step: "link", status: "skipped" }], ops_new_lead: { status: "sent" } }
    }
  });
  const snap = LM.buildSnapshot(row, { actorName: "Missy Z" });
  assert.equal(snap.page, "Contact Us page");
  assert.equal(snap.first_name, "Diana");
  assert.equal(snap.heard_about_us, "Referred by a past client");
  assert.equal(snap.referral, "Maria G.");
  assert.equal(snap.status, "office_contacted");
  assert.equal(snap.status_label, "Office/Trainer Contacted");
  assert.equal(snap.trainer_name, "Carolina Perez");
  assert.equal(snap.office_note_text, "Called, left a voicemail.");
  assert.deepEqual(snap.extra_answers, [["Best time to call", "Evenings"]]);
  assert.deepEqual(snap.messages, ["the booking-link text", "the booking-link email", "the 15-minute follow-up text", "the 15-minute follow-up email"], "client messages only, only what was sent");
  assert.equal(snap.summary, "came in through the Contact Us page. Heard about us: Referred by a past client (Maria G.). Asked for: Schedule an in-person evaluation. We sent: the booking-link text, the booking-link email, the 15-minute follow-up text, the 15-minute follow-up email. Status then: Office/Trainer Contacted (trainer: Carolina Perez).");
  const booked = M.requestSummary(M.requestEntryFromLead(lead("b", { status: "evaluation_scheduled", raw_payload: { source_page: "https://lorenzosdogtrainingteam.com/dog-training-san-antonio-tx", booking: { slot_start: "2026-09-25T15:00:00Z", when_label: "Thursday, September 25, 2026, 10:00 AM CDT", trainer_name: "Carolina Perez" } } })));
  assert.equal(booked, "came in through the San Antonio ad page. Booked an evaluation with Carolina Perez for Thursday, September 25, 2026, 10:00 AM CDT. Status then: Evaluation Scheduled.");
  for (const [page, raw, words] of [
    ["dog-training-cleveland-oh", {}, "Cleveland ad page"],
    ["dog-training-cleveland-oh", { lead_type: "pdf_download" }, "E-book download (Cleveland ad page)"],
    ["trainer landing page: Daniel Bainbridge", {}, "Trainer page: Daniel Bainbridge"],
    ["book/no-trainer-nearby", {}, "Booking page"],
    ["Contact | Lorenzo's Dog Training Team", {}, "Contact Us page"],
    ["https://lorenzosdogtrainingteam.com/ads/pensacola", {}, "Pensacola ad page 2.0"],
    ["Chicago Dog Training | Lorenzo's Dog Training Team", {}, "Chicago ad page"]
  ]) assert.equal(M.requestPageName({ source_page: page, raw_payload: raw }), words, page);
});

test("the database join: backup FIRST, then every child moves, then the snapshot, and ONLY THEN the delete; version-guarded; qa refused", () => {
  const body = sql.slice(sql.indexOf("create or replace function @S@.ldtt_merge_lead"), sql.indexOf("unmerge_tpl text"));
  const at = text => { const i = body.indexOf(text); assert.ok(i > 0, `missing: ${text}`); return i; };
  const backup = at("insert into private.lead_merge_backup");
  const moves = ["update lead_events set lead_id = p_main", "update communications_alert_deliveries set lead_id = p_main", "update deals set lead_id = p_main",
    "update clients set lead_id = p_main", "update booking_holds set lead_id = p_main", "update office_notes set entity_id = p_main",
    "update office_note_revisions set entity_id = p_main", "update lifecycle_events set entity_id = p_main::text",
    "update form_delivery_attempts set entity_id = p_main::text", "update audit_events set entity_id = p_main::text"].map(at);
  const snapshot = at("'merged_requests'");
  const del = at("delete from leads where id = p_other");
  assert.ok(moves.every(i => i > backup && i < snapshot), "children move after the backup, before the snapshot");
  assert.ok(snapshot < del && moves.every(i => i < del), "the delete is last");
  assert.equal((body.match(/delete from /g) || []).length, 1, "the only delete is the joined card itself");
  assert.match(body, /m\.version is distinct from p_main_version/);
  assert.match(body, /o\.version is distinct from p_other_version/);
  assert.match(body, /raw_payload->>'qa', ''\) = 'true'/, "qa (boolean or string) refused in the database too");
  assert.match(body, /both cards have their own client record/);
  assert.match(body, /'lead_merged', 'lead'/, "audit_events lead_merged");
  for (const table of LM.CHILD_TABLES.map(([label]) => label)) assert.match(body, new RegExp(`'${table}', coalesce\\(\\(select jsonb_agg\\(to_jsonb\\(x\\)\\)`), `backup holds every ${table} row`);
  assert.match(body, /to_jsonb\(o\)/, "the whole joined card row is backed up");
  assert.match(sql, /foreach s in array array\['public', 'practice'\]/, "both schemas (rule 5)");
  assert.match(sql, /revoke all on function %I\.ldtt_merge_lead[^']*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function %I\.ldtt_merge_lead[^']*to service_role/);
  assert.match(sql, /alter table private\.lead_merge_backup enable row level security;\nrevoke all on private\.lead_merge_backup from public, anon, authenticated;/);
  assert.match(sql, /create policy "lead_merge_batch_server_only" on public\.site_settings\n  as restrictive/);
  assert.match(sql, /create policy "lead_merge_batch_server_only" on practice\.site_settings\n  as restrictive/);
  assert.match(sql, /'lead_merge_batch', '\{"armed": false, "mode": "dry"/, "ships disarmed, dry");
  assert.ok(sql.indexOf('create policy "lead_merge_batch_server_only" on public') < sql.indexOf("insert into public.site_settings"), "policy before the row");
  const unmerge = sql.slice(sql.indexOf("create or replace function @S@.ldtt_unmerge_lead"));
  assert.match(unmerge, /insert into leads select \* from jsonb_populate_record\(null::leads, b\.lead_row\)/, "unmerge restores the card from the backup");
  assert.match(unmerge, /restored_at = now\(\)/);
});

test("mergeLeadGroup: one database call per joined card (backup + move + snapshot + delete inside it), never a REST delete; qa refused", async () => {
  assert.doesNotMatch(libSrc, /method:\s*"DELETE"/, "the library never deletes a lead through REST");
  const calls = [];
  const rows = [
    lead("11111111-1111-1111-1111-111111111111", { status: "evaluation_scheduled", created_at: "2026-09-24T11:08:00Z", version: 4 }),
    lead("22222222-2222-2222-2222-222222222222", { status: "office_contacted", created_at: "2026-09-21T02:15:00Z", version: 7, raw_payload: { source_page: "contact.html" } })
  ];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
    if (/\/rest\/v1\/leads\?/.test(url)) return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
    if (/\/rest\/v1\/trainers\?/.test(url)) return { ok: true, status: 200, text: async () => "[]" };
    if (/rpc\/ldtt_merge_lead/.test(url)) return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, main_version: 5, moved: { office_notes: 2 }, backup_id: "b1" }) };
    return { ok: false, status: 500, text: async () => "{}" };
  };
  const out = await LM.mergeLeadGroup(rows[0].id, [rows[1].id], { id: "u", email: "missy@x.com", name: "Missy" });
  assert.equal(out.merged.length, 1);
  const rpc = calls.filter(c => /rpc\/ldtt_merge_lead/.test(c.url));
  assert.equal(rpc.length, 1);
  assert.equal(rpc[0].body.p_main, rows[0].id);
  assert.equal(rpc[0].body.p_other, rows[1].id);
  assert.equal(rpc[0].body.p_main_version, 4);
  assert.equal(rpc[0].body.p_other_version, 7);
  assert.equal(rpc[0].body.p_snapshot.page, "Contact Us page");
  assert.match(rpc[0].body.p_snapshot.summary, /^came in through the Contact Us page\./);
  assert.ok(!calls.some(c => c.method === "DELETE" || (c.method === "PATCH" && /\/leads\?/.test(c.url))), "no direct lead write or delete");
  await assert.rejects(LM.mergeLeadGroup(rows[1].id, [rows[0].id], {}), /most advanced/, "a booked card is never joined into a less advanced one");
  rows[1].raw_payload = { qa: true };
  await assert.rejects(LM.mergeLeadGroup(rows[0].id, [rows[1].id], {}), /qa/);
});

test("the batch: not armed = nothing; dry = every group and every number, NOTHING changed; disarm first", async () => {
  const src = libSrc;
  assert.match(src, /updated_at=eq\.\$\{encodeURIComponent\(row\.updated_at\)\}/, "version-guarded claim");
  assert.match(src, /value: \{ \.\.\.value, armed: false, status: "running"/, "disarm first");
  assert.match(read("api/cron/auto-followups.js"), /await LM\.runLeadMergeBatch\(\)\n\s*\.catch\(/, "on the */15 cron, a failure never stops the rest");

  let settings = { key: LM.KEY, value: { armed: false, mode: "dry", note: "keep me" }, updated_at: "t0" };
  const calls = [];
  const people = [
    lead("a1", { email: "beth@x.com", first_name: "Beth", last_name: "Van Fleet", status: "new_inquiry", created_at: "2026-08-28T12:00:00Z" }),
    lead("a2", { email: "beth@x.com", first_name: "Beth", last_name: "Van Fleet", status: "new_inquiry", created_at: "2026-08-31T12:00:00Z", raw_payload: { lead_type: "pdf_download", source_page: "dog-training-cleveland-oh" } }),
    lead("a3", { email: "beth@x.com", first_name: "Beth", last_name: "Van Fleet", status: "new_inquiry", created_at: "2026-09-27T22:38:00Z" }),
    lead("b1", { email: "d@x.com", status: "office_contacted", created_at: "2026-09-21T02:15:00Z" }),
    lead("b2", { email: "d@x.com", status: "evaluation_scheduled", created_at: "2026-09-24T11:08:00Z" }),
    lead("q1", { email: "qa@x.com", raw_payload: { qa: true } }),
    lead("solo", { email: "solo@x.com", status: "archived" })
  ];
  global.fetch = async (url, opts = {}) => {
    const method = opts.method || "GET";
    calls.push({ url: String(url), method, body: opts.body ? JSON.parse(opts.body) : null });
    const ok = data => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });
    if (/site_settings/.test(url)) {
      if (method === "PATCH") { settings = { ...settings, value: JSON.parse(opts.body).value, updated_at: "t1" }; return ok([settings]); }
      return ok([settings]);
    }
    if (/\/rest\/v1\/leads\?/.test(url)) return ok(people);
    if (/office_notes\?/.test(url)) return ok([{ id: "n1", entity_id: "b1" }, { id: "n2", entity_id: "b1" }]);
    return ok([]);
  };
  assert.equal((await LM.runLeadMergeBatch()).armed, false);
  assert.equal(calls.filter(c => c.method !== "GET").length, 0, "not armed: no write");

  settings.value = { ...settings.value, armed: true, mode: "dry" };
  const out = await LM.runLeadMergeBatch();
  assert.equal(out.ran, true);
  assert.equal(out.mode, "dry");
  assert.ok(!calls.some(c => /rpc\//.test(c.url)), "dry never joins");
  assert.ok(!calls.some(c => c.method !== "GET" && !/site_settings/.test(c.url)), "dry writes only its own summary");
  const first = calls.find(c => c.method === "PATCH");
  assert.equal(first.body.value.armed, false, "the first write disarms");
  const run = settings.value.last_run;
  assert.equal(settings.value.armed, false);
  assert.equal(settings.value.note, "keep me", "the note survives");
  assert.equal(run.before.total_rows, 7);
  assert.equal(run.before.non_qa_rows, 6);
  assert.equal(run.groups.to_join, 2);
  assert.equal(run.groups.cards_removed, 3);
  assert.equal(run.after.total_rows, 4);
  assert.equal(run.after.non_qa_rows, 3);
  assert.equal(run.before.persons, 3);
  assert.equal(run.after.persons, 3);
  const beth = run.join.find(g => g.stays.name === "Beth V.");
  assert.equal(beth.stays.id, "a3", "same stage: the newest Beth card stays");
  assert.deepEqual(beth.joins.map(c => c.page), ["website form", "E-book download (Cleveland ad page)"]);
  const diana = run.join.find(g => g.stays.id === "b2");
  assert.match(diana.why_it_stays, /most advanced status \(Evaluation Scheduled\)/);
  assert.equal(diana.joins[0].children.office_notes, 2, "child counts per card");
  assert.equal(diana.check_no_less_advanced, true);
  assert.equal(run.before.recycled_badges, 3);
  assert.equal(run.after.recycled_badges, 2, "each card that stays wears the badge; the joined cards are gone");
  assert.match(run.after.changes[0], /^-3 rows: 3 older\/less advanced duplicate cards are joined/);
});

test("counting: a joined card is ONE lead (merged_requests are never rows); it is Recycled, first came in = its earliest request", () => {
  const joined = { id: "m", status: "New Inquiry", createdAt: "2026-09-27T22:38:00Z", email: "b@x.com", rawPayload: { merged_requests: [{ created_at: "2026-08-28T12:00:00Z" }, { created_at: "2026-08-31T12:00:00Z" }] } };
  const other = { id: "o", status: "New Inquiry", createdAt: "2026-09-01T00:00:00Z", email: "z@x.com", rawPayload: {} };
  assert.equal(M.leadRows([joined, other]).length, 2);
  assert.deepEqual(M.leadStatusCounts([joined, other]), M.leadStatusCounts([{ ...joined, rawPayload: {} }, other]), "the joined requests change no count");
  assert.deepEqual(M.recycledIndex([joined, other]).get("m"), { firstAt: "2026-08-28T12:00:00Z", firstLeadId: "m", count: 3 });
  assert.equal(M.recycledIndex([joined, other]).has("o"), false);
  const all = [...read("trainer-backoffice/metrics.js").matchAll(/merged_requests/g)].length;
  assert.ok(all <= 2, "metrics.js reads merged_requests only in mergedRequestsOf");
  assert.match(app, /"merged_requests", \/\/ rule 130/, "never a sheet / CSV column");
});

function portalContext({ role, leads }) {
  const ctx = {
    METRICS: M, session: { role }, state: { leads }, escapeHtml,
    formatDate: v => `D(${v})`, formatDateTime: v => `DT(${v})`,
    trainerName: id => (id === "t1" ? "Carolina Perez" : "Unassigned"), leadStatusLabel: s => M.statusLabel(s)
  };
  const names = ["recycledInfo", "recycledTag", "recycledLine", "recycledHistoryEntries", "recycledHistoryHtml", "joinOlderCards", "joinOlderBox", "joinConfirmText"];
  vm.runInNewContext(`${app.match(/const RECYCLE_ICON = `[^`]*`;\n/)[0]}let recycledCache = { rows: null, length: -1, index: new Map() };\n${names.map(n => fn(app, n)).join("\n")}\nthis.api = { ${names.join(", ")} };`, ctx);
  return ctx.api;
}

const joinedDiana = {
  id: "L2", remoteId: "L2", owner: "Diana Melendez", first_name: "Diana", last_name: "Melendez", email: "d@x.com", status: "Evaluation Scheduled", dbStatus: "evaluation_scheduled",
  createdAt: "2026-09-24T11:08:00Z", trainerId: "t1", version: 3,
  rawPayload: {
    source_page: "https://lorenzosdogtrainingteam.com/dog-training-san-antonio-tx",
    booking: { slot_start: "2026-09-25T15:00:00Z", when_label: "Thursday, September 25, 2026, 10:00 AM CDT", trainer_name: "Carolina Perez" },
    merged_requests: [{
      created_at: "2026-09-21T02:15:00Z", page: "Contact Us page", heard_about_us: "Referred by a past client", referral: "Maria G.", i_want_to: "Schedule an in-person evaluation",
      status: "office_contacted", status_label: "Office/Trainer Contacted", moved: { office_notes: 2 }, office_note_text: "Left a voicemail."
    }]
  }
};

test("the Recycled badge is a button that opens the history; office sees notes counts and separate cards, a trainer never does", () => {
  const separate = { id: "L0", remoteId: "L0", owner: "Diana Melendez", email: "D@X.com", status: "Archived", createdAt: "2026-07-01T00:00:00Z", rawPayload: { source_page: "dog-training-cleveland-oh", lead_type: "pdf_download" }, version: 1 };
  const office = portalContext({ role: "admin", leads: [joinedDiana, separate] });
  assert.match(office.recycledTag(joinedDiana), /^ <button type="button" class="lead-tag-recycled" data-recycled-history="L2"/);
  assert.match(office.recycledLine(joinedDiana), /data-recycled-history="L2">See their history<\/button>/);
  const html = office.recycledHistoryHtml(joinedDiana, { office: true });
  assert.match(html, /<strong>First came in:<\/strong> DT\(2026-07-01T00:00:00Z\)/, "first came in = the earliest card of this person");
  const items = [...html.matchAll(/<li[^>]*><time>DT\(([^)]+)\)<\/time>/g)].map(m => m[1]);
  assert.deepEqual(items, ["2026-09-24T11:08:00Z", "2026-09-21T02:15:00Z", "2026-07-01T00:00:00Z"], "newest first");
  assert.match(html, /This card<\/em><p>Came in through the San Antonio ad page\. Booked an evaluation with Carolina Perez for Thursday, September 25, 2026, 10:00 AM CDT\. Status now: Evaluation Scheduled\.<\/p>/);
  assert.match(html, /Joined into this card<\/em><p>Came in through the Contact Us page\. Heard about us: Referred by a past client \(Maria G\.\)\. Asked for: Schedule an in-person evaluation\. Status then: Office\/Trainer Contacted\.<\/p>/);
  assert.match(html, /2 office notes came over from this request \(they are in this card's Office Notes\)\. Note written on that card: "Left a voicemail\."/);
  assert.match(html, /Still a separate card<\/em><p>Came in through the E-book download \(Cleveland ad page\)/);

  const trainer = portalContext({ role: "trainer", leads: [joinedDiana] });
  assert.match(trainer.recycledTag(joinedDiana), /data-recycled-history="L2"/, "a trainer's joined card wears the badge from its own history");
  const theirs = trainer.recycledHistoryHtml(joinedDiana, { office: false });
  assert.match(theirs, /Came in through the Contact Us page/);
  assert.doesNotMatch(theirs, /office note/i, "trainers never see office notes");
  assert.doesNotMatch(theirs, /separate card/i, "trainers never see another card");
  assert.match(theirs, /2 requests are joined into this one card\. They count as one lead\./);
  assert.match(fn(app, "openRecycledHistory"), /office: session\.role === "admin"/);
  assert.match(fn(app, "openRecycledHistory"), /document\.body\.appendChild\(dialog\)/, "outside the redraw area");
  // The badge click runs before the card-open click and stops it.
  const handler = app.slice(app.indexOf("const recycledHistory = event.target.closest"), app.indexOf('const openLead = event.target.closest("[data-open-lead]");'));
  assert.match(handler, /event\.stopPropagation\(\); event\.preventDefault\(\); openRecycledHistory\(/);
  const css = read("trainer-backoffice/styles.css");
  assert.match(css, /\.recycled-history-dialog \{ width: min\(640px, calc\(100vw - 24px\)\); max-height: 88vh; overflow-y: auto;/, "fits a 375px phone");
});

test("'Join with older request' is for office admins only, names both cards, and the server re-checks and picks the card that stays", () => {
  const older = { id: "L1", remoteId: "L1", owner: "Diana Melendez", email: "d@x.com", status: "Office Contacted", createdAt: "2026-09-21T02:15:00Z", rawPayload: { source_page: "contact.html" }, version: 2 };
  const newer = { ...joinedDiana, rawPayload: { ...joinedDiana.rawPayload, merged_requests: [] } };
  const office = portalContext({ role: "admin", leads: [older, newer] });
  assert.match(office.joinOlderBox(newer), /data-join-lead="L2">Join with older request<\/button>/);
  assert.equal(office.joinOlderBox(older), "", "only on the card that has an OLDER separate card");
  const text = office.joinConfirmText(office.joinOlderCards(newer));
  assert.match(text, /STAYS: Diana Melendez - came in DT\(2026-09-24T11:08:00Z\) through the San Antonio ad page \(Evaluation Scheduled\)/);
  assert.match(text, /JOINS INTO IT: Diana Melendez - came in DT\(2026-09-21T02:15:00Z\) through the Contact Us page \(Office\/Trainer Contacted\)/);
  const trainer = portalContext({ role: "trainer", leads: [older, newer] });
  assert.equal(trainer.joinOlderBox(newer), "", "never for a trainer");
  assert.doesNotMatch(fn(app, "trainerLeadDetailPanel"), /joinOlderBox/, "the trainer panel has no join button");
  assert.match(app, /\$\{recycledLine\(lead\)\}\$\{joinOlderBox\(lead\)\}<p>/, "office lead panel");
  // Server: inside the admin-only handler; re-checks same person + qa; the SERVER picks the card that stays.
  assert.match(mutation, /authorizeRequest\(req, res, \{ require: "admin"/);
  assert.match(mutation, /case "merge_leads": result = await mergeLeads\(admin, body\); break;/);
  const merge = fn(mutation, "mergeLeads");
  assert.match(merge, /rows\.some\(LM\.isQaRow\)/);
  assert.match(merge, /METRICS\.personRows\(rows, ids\[0\]\)/);
  assert.match(merge, /const main = METRICS\.chooseMergeMain\(rows\);/);
  assert.doesNotMatch(read("api/trainer-lead-action.js"), /merge_leads|mergeLeadGroup/, "no trainer door can join cards");
});
