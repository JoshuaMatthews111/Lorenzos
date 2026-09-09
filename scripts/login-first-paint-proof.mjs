// Offline proof for perf/portal-login-first-paint.
//
// Signing in used to wait for every table in the database, including a second
// full copy of every lead, application and client that only the Download button
// reads. This proves the sign-in request no longer asks for those, that a full
// request still returns everything exactly as before, and that a trimmed answer
// can never be mistaken for a full one.
import Module from "node:module";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const require_ = Module.createRequire(import.meta.url);

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
delete process.env.LDTT_SANDBOX;

// ---- stub the auth helper so no network or real token is involved -------------
const realLoad = Module._load;
const authPath = require_.resolve(path.join(root, "lib/portal-auth.js"));
let role = "admin";
Module._load = function (request, parent, isMain) {
  const resolved = (() => { try { return require_.resolve(request, { paths: [path.dirname(parent?.filename || root)] }); } catch { return null; } })();
  if (resolved === authPath) {
    return {
      authorizeRequest: async () => ({ role, portalUser: { user_id: "u1", role, trainer_id: role === "trainer" ? "t1" : null, active: true } })
    };
  }
  return realLoad.call(this, request, parent, isMain);
};

const handler = require_(path.join(root, "api/operational-data.js"));

// ---- stub Supabase -----------------------------------------------------------
let requestedPaths = [];
const TABLE_ROWS = {
  trainers: [{ id: "t1", full_name: "Test Trainer", updated_at: "2026-09-01" }],
  clients: [{ id: "c1", client_name: "Client One", created_at: "2026-09-01" }],
  dogs: [{ id: "d1", client_id: "c1", name: "Rex", breed: "Lab" }],
  leads: [{ id: "l1", created_at: "2026-09-01", raw_payload: { note: "x" } }],
  trainer_applications: [{ id: "a1", created_at: "2026-09-01" }],
  content_submissions: [{ id: "s1", created_at: "2026-09-01" }],
  portal_users: [{ id: "p1", user_id: "u1", role: "admin", created_at: "2026-09-01" }],
  office_notes: [{ id: "n1", created_at: "2026-09-01" }],
  audit_events: [{ id: "ae1", created_at: "2026-09-01" }],
  office_note_revisions: [{ id: "nr1", office_note_id: "n1", created_at: "2026-09-01" }],
  form_delivery_attempts: [{ id: "da1", created_at: "2026-09-01" }],
  office_leads_sheet: [{ id: "l1", received_at: "2026-09-01", every_answer: "a very long echo of the whole form" }],
  office_applications_sheet: [{ id: "a1", received_at: "2026-09-01", every_answer: "another long echo" }],
  office_clients_sheet: [{ id: "c1", client_name: "Client One", every_answer: "a third long echo" }]
};

globalThis.fetch = async (url, options = {}) => {
  const target = String(url).replace("https://example.supabase.co", "");
  requestedPaths.push(target);
  const table = (target.match(/\/rest\/v1\/([a-z_]+)/) || [])[1] || "";
  const offset = Number((target.match(/offset=(\d+)/) || [])[1] || 0);
  // Anything not named above answers empty, which is what a real optional table does.
  const rows = offset > 0 ? [] : (TABLE_ROWS[table] || []);
  const headers = new Map([["content-range", `0-${rows.length}/${rows.length}`]]);
  return {
    ok: true,
    status: 200,
    headers: { get: key => headers.get(String(key).toLowerCase()) ?? null },
    text: async () => JSON.stringify(rows),
    json: async () => rows
  };
};

// ---- a tiny res double -------------------------------------------------------
function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    ended: false,
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; this.ended = true; return this; },
    end() { this.ended = true; return this; }
  };
  return res;
}

async function call({ omit, ifNoneMatch, as = "admin" } = {}) {
  role = as;
  requestedPaths = [];
  const req = {
    method: "GET",
    query: omit ? { omit } : {},
    headers: { authorization: "Bearer test", ...(ifNoneMatch ? { "if-none-match": ifNoneMatch } : {}) }
  };
  const res = makeRes();
  await handler(req, res);
  return { res, paths: requestedPaths.slice() };
}

const asked = (paths, table) => paths.some(p => p.includes(`/rest/v1/${table}`));
let passed = 0;
const ok = label => { console.log("PASS ", label); passed += 1; };

// 1. A full request is unchanged.
{
  const { res, paths } = await call();
  assert.equal(res.statusCode, 200, "full request answers 200");
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.omitted, [], "nothing omitted");
  for (const table of ["office_leads_sheet", "office_applications_sheet", "audit_events", "office_note_revisions", "form_delivery_attempts"]) {
    assert.ok(asked(paths, table), `full request still reads ${table}`);
  }
  assert.equal(res.body.sheets.leads.length, 1, "the sheets are still built");
  assert.equal(res.body.auditEvents.length, 1, "the activity log is still there");
  ok("a request with no omit returns exactly what it always did");
}

// 2. The sign-in request skips the heavy blocks entirely.
let firstPaint;
{
  const { res, paths } = await call({ omit: "sheets,history" });
  firstPaint = res;
  assert.equal(res.statusCode, 200);
  for (const table of ["office_leads_sheet", "office_applications_sheet", "office_clients_sheet", "audit_events", "office_note_revisions", "form_delivery_attempts"]) {
    assert.ok(!asked(paths, table), `sign-in never reads ${table}`);
  }
  ok("sign-in does not run a single query for the sheets or the history");
}

// 3. What the dashboard draws is all still present.
{
  const body = firstPaint.body;
  for (const key of ["trainers", "leads", "clients", "applications", "submissions", "portalUsers", "officeNotes"]) {
    assert.ok(Array.isArray(body[key]) && body[key].length >= 1, `${key} still arrives on sign-in`);
  }
  assert.equal(body.clientsTotal ?? null, null, "clientsTotal is not in the response shape");
  ok("every record the dashboard draws still arrives on sign-in");
}

// 4. The trimmed answer says what it left out, and leaves it empty.
{
  const body = firstPaint.body;
  assert.deepEqual(body.omitted, ["history", "sheets"]);
  assert.deepEqual(body.sheets, { leads: [], applications: [], clients: [] });
  assert.deepEqual(body.auditEvents, []);
  assert.deepEqual(body.noteRevisions, []);
  assert.deepEqual(body.deliveryAttempts, []);
  ok("the answer names the blocks it left out so the portal cannot mistake them for empty");
}

// 5. A trimmed answer and a full answer never share an ETag.
{
  const full = await call();
  const trimmed = await call({ omit: "sheets,history" });
  assert.ok(full.res.headers.etag, "full answer carries an ETag");
  assert.notEqual(full.res.headers.etag, trimmed.res.headers.etag, "different documents, different ETag");
  const replay = await call({ omit: "sheets,history", ifNoneMatch: full.res.headers.etag });
  assert.equal(replay.res.statusCode, 200, "a full ETag never satisfies a trimmed request");
  ok("a browser holding the full set is never told 304 by a trimmed request");
}

// 6. The same request twice is still a 304.
{
  const first = await call({ omit: "sheets,history" });
  const second = await call({ omit: "sheets,history", ifNoneMatch: first.res.headers.etag });
  assert.equal(second.res.statusCode, 304, "unchanged data still answers 304");
  ok("the 30-second poll still gets an empty 304 when nothing changed");
}

// 7. An unknown omit value is ignored rather than trusted.
{
  const { res, paths } = await call({ omit: "leads,clients,sheets" });
  assert.deepEqual(res.body.omitted, ["sheets"], "only known blocks can be omitted");
  assert.ok(asked(paths, "leads"), "leads are always fetched");
  assert.equal(res.body.leads.length, 1);
  ok("a made-up omit value cannot strip the records the portal needs");
}

// 8. Trainers get the same treatment, and their serial history hop disappears.
{
  const { res, paths } = await call({ omit: "sheets,history", as: "trainer" });
  assert.equal(res.statusCode, 200);
  assert.ok(!asked(paths, "office_note_revisions"), "a trainer sign-in skips the note-revision hop");
  assert.deepEqual(res.body.omitted, ["history", "sheets"]);
  const full = await call({ as: "trainer" });
  assert.ok(asked(full.paths, "office_note_revisions"), "a full trainer request still reads them");
  ok("a trainer's sign-in loses a whole serial round trip, and a full request still has it");
}

// ---- the portal side, asserted against the source ---------------------------
const fs = await import("node:fs");
const appJs = fs.readFileSync(path.join(root, "trainer-backoffice/app.js"), "utf8");
{
  assert.ok(/loadOperationalData\(\{ omit: "sheets,history,events" \}\)/.test(appJs), "sign-in asks for the trimmed answer");
  assert.equal((appJs.match(/loadOperationalData\(\{ omit: "sheets,history,events" \}\)/g) || []).length, 2,
    "both ways in - the sign-in form and a restored session - ask for the trimmed answer");
  assert.ok(/startBackgroundHistoryLoad\(\);/.test(appJs), "history is loaded after the screen is up");
  assert.ok(/const omitted = new Set\(data\.omitted \|\| \[\]\);/.test(appJs), "the merge reads the omitted list");
  assert.ok(/if \(!omitted\.has\("history"\)\) \{/.test(appJs), "the merge refuses to blank history it did not ask for");
  assert.ok(/if \(!omitted\.has\("sheets"\)\) \{/.test(appJs), "the merge refuses to blank the sheets it did not ask for");
  assert.ok(/async function exportOperationalSheet\(kind\) \{/.test(appJs), "the download fetches its sheet on the click");
  assert.ok(/await ensureSheetsLoaded\(\);/.test(appJs), "and waits for it before building the file");
  ok("the portal asks for the trimmed answer and never blanks what it did not ask for");
}

console.log(`\nAll ${passed} login-speed checks passed.`);
