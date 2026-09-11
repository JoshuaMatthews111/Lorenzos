// Website text spots (rule 61, Joshua 2026-09-11): api/site-text.js against a fake Supabase,
// and site_text_marker.py on sample pages. Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
const require = createRequire(import.meta.url);
const manifest = require("../site-text-manifest.json");
const HOME = manifest.pages.home.spots;
const SPOT = HOME.find(s => s.tag === "h2") || HOME[0];
const ADMIN_USER = { id: "admin-1", email: "office@example.test" };
const ADMIN_ROW = { user_id: "admin-1", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "office@example.test", display_name: "Office Login" };

function fakeSupabase(rows) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, path, headers: options.headers || {}, body });
    const json = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (path.startsWith("/auth/v1/user")) return json(200, ADMIN_USER);
    if (path.startsWith("/rest/v1/portal_users")) return json(200, [ADMIN_ROW]);
    if (path.startsWith("/rest/v1/site_text") && method === "GET") {
      const id = decodeURIComponent((path.match(/id=eq\.([^&]+)/) || [])[1] || "");
      const onlyDrafts = path.includes("draft_value=not.is.null");
      return json(200, rows.filter(r => (!id || r.id === id) && (!onlyDrafts || r.draft_value != null)));
    }
    if (path.startsWith("/rest/v1/site_text")) return json(200, [{ ...(body || {}) }]);
    if (path.startsWith("/rest/v1/audit_events")) return json(201, null);
    throw new Error(`Unexpected fake Supabase call: ${method} ${path}`);
  };
  return calls;
}
function load(sandbox) {
  delete require.cache[require.resolve("../api/site-text.js")];
  delete require.cache[require.resolve("../lib/sandbox.js")];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../api/site-text.js");
}
async function call(handler, { method = "GET", query = {}, body = null, auth = true } = {}) {
  const res = { statusCode: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, end() { return this; } };
  await handler({ method, query, body, headers: auth ? { authorization: "Bearer fake-token" } : {} }, res);
  return res;
}

test("the public sees only LIVE text for a page, never drafts, and nothing for spots the code removed", async () => {
  fakeSupabase([
    { id: `home:${SPOT.key}`, page: "home", key: SPOT.key, live_value: "Office words", draft_value: "Unfinished draft", base_default: SPOT.text },
    { id: "home:gone-spot", page: "home", key: "gone-spot", live_value: "Old spot" }
  ]);
  const res = await call(load(false), { query: { path: "/" }, auth: false });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.texts, { [SPOT.key]: "Office words" });
  assert.match(res.headers["Cache-Control"], /s-maxage=30/);
  const none = await call(load(false), { query: { path: "/find-a-trainer" }, auth: false });
  assert.equal(none.payload.page, null);
});

test("drafts need an office login; with it, drafts show over live", async () => {
  fakeSupabase([{ id: `home:${SPOT.key}`, page: "home", key: SPOT.key, live_value: "Office words", draft_value: "Unfinished draft" }]);
  const denied = await call(load(false), { query: { path: "/", draft: "1" }, auth: false });
  assert.ok(denied.statusCode === 401 || denied.statusCode === 403);
  const ok = await call(load(false), { query: { path: "/", draft: "1" } });
  assert.equal(ok.payload.texts[SPOT.key], "Unfinished draft");
  assert.equal(ok.headers["Cache-Control"], "no-store");
});

test("save_draft only for tagged spots, never empty; the code text the office saw is kept", async () => {
  let calls = fakeSupabase([]);
  let res = await call(load(false), { method: "POST", body: { operation: "save_draft", page: "home", key: "not-a-spot", value: "x" } });
  assert.equal(res.statusCode, 400);
  res = await call(load(false), { method: "POST", body: { operation: "save_draft", page: "home", key: SPOT.key, value: "   " } });
  assert.equal(res.statusCode, 400);
  res = await call(load(false), { method: "POST", body: { operation: "save_draft", page: "home", key: SPOT.key, value: SPOT.text } });
  assert.equal(res.payload.unchanged, true, "same as the code text and nothing saved yet: no row");
  calls = fakeSupabase([]);
  res = await call(load(false), { method: "POST", body: { operation: "save_draft", page: "home", key: SPOT.key, value: "  New   words " } });
  assert.equal(res.statusCode, 200);
  const write = calls.find(c => c.method === "POST" && c.path.startsWith("/rest/v1/site_text"));
  assert.equal(write.body.draft_value, "New words");
  assert.equal(write.body.base_default, SPOT.text);
  assert.ok(!("live_value" in write.body), "a draft never touches the live text");
});

test("publish needs a full name, puts drafts live, logs the typed name; a draft equal to the code text clears the override", async () => {
  const other = HOME.find(s => s.key !== SPOT.key);
  let calls = fakeSupabase([
    { id: `home:${SPOT.key}`, page: "home", key: SPOT.key, live_value: null, draft_value: "Fresh words" },
    { id: `home:${other.key}`, page: "home", key: other.key, live_value: "Old office words", draft_value: other.text }
  ]);
  let res = await call(load(false), { method: "POST", body: { operation: "publish", page: "home", name: "Rachel" } });
  assert.equal(res.statusCode, 400);
  res = await call(load(false), { method: "POST", body: { operation: "publish", page: "home", name: "Rachel Leggett" } });
  assert.equal(res.statusCode, 200); assert.equal(res.payload.published, 2);
  const patches = calls.filter(c => c.method === "PATCH");
  assert.equal(patches.find(p => p.path.includes(encodeURIComponent(`home:${SPOT.key}`))).body.live_value, "Fresh words");
  assert.equal(patches.find(p => p.path.includes(encodeURIComponent(`home:${other.key}`))).body.live_value, null);
  const log = calls.find(c => c.path.startsWith("/rest/v1/audit_events"));
  assert.equal(log.body.action, "site_text_published");
  assert.match(log.body.actor_name, /^Rachel Leggett \(login: Office Login\)$/);
  calls = fakeSupabase([]);
  res = await call(load(false), { method: "POST", body: { operation: "publish", page: "home", name: "Rachel Leggett" } });
  assert.equal(res.statusCode, 400, "nothing to publish");
});

test("reset needs a full name, returns the spot to the code text and is logged", async () => {
  const calls = fakeSupabase([{ id: `home:${SPOT.key}`, page: "home", key: SPOT.key, live_value: "Office words", draft_value: null }]);
  const res = await call(load(false), { method: "POST", body: { operation: "reset", page: "home", key: SPOT.key, name: "Missy Zuk" } });
  assert.equal(res.statusCode, 200);
  const patch = calls.find(c => c.method === "PATCH");
  assert.equal(patch.body.live_value, null); assert.equal(patch.body.draft_value, null);
  assert.equal(calls.find(c => c.path.startsWith("/rest/v1/audit_events")).body.action, "site_text_reset");
});

test("practice copy: reads and writes practice.site_text", async () => {
  const calls = fakeSupabase([]);
  await call(load(true), { method: "POST", body: { operation: "save_draft", page: "home", key: SPOT.key, value: "Practice words" } });
  assert.equal(calls.find(c => c.method === "POST" && c.path.startsWith("/rest/v1/site_text")).headers["Content-Profile"], "practice");
  delete process.env.LDTT_SANDBOX;
});

const py = code => execFileSync("python3", ["-c", code], { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8" });

test("marker: tags only plain text outside forms/footers/consent, is idempotent, and gives a reworded spot a new key and keeps the rest", () => {
  const out = JSON.parse(py(`
import json, site_text_marker as m
src = '<main><h2>Hello there</h2><p>Plain words here</p><p>Mixed <b>bold</b></p><form><p>Form words</p></form><div class="consent-row"><span>Text me please</span></div></main><footer><p>Footer words</p></footer>'
a, spots = m.mark_source(src)
b, spots2 = m.mark_source(a, spots)
changed = src.replace('Plain words here', 'Plain words right here')
c, spots3 = m.mark_source(changed, spots)
print(json.dumps({"a": a, "same": a == b, "keys": [s["key"] for s in spots], "keys3": [s["key"] for s in spots3], "texts3": [s["text"] for s in spots3]}))
`));
  assert.equal(out.keys.length, 2, "only the two plain-text spots");
  assert.ok(!/<form>[^]*data-edit[^]*<\/form>/.test(out.a) && !/<footer>[^]*data-edit/.test(out.a) && !/consent-row[^<]*<span data-edit/.test(out.a));
  assert.equal(out.same, true, "a second run changes nothing");
  assert.equal(out.keys3[0], out.keys[0], "the untouched spot keeps its key");
  assert.notEqual(out.keys3[1], out.keys[1], "a reworded spot gets a NEW key (its old office text is kept and flagged, never moved)");
  assert.equal(out.texts3[1], "Plain words right here");
});

test("marker: deleting a card and rewriting the next one never moves office text onto a different card", () => {
  const out = JSON.parse(py(`
import json, site_text_marker as m
before = '<main><h3>Destructive chewing</h3><p>Replace destructive patterns with structure.</p><h3>Excessive barking</h3><p>We calm the triggers.</p><h3>Jumping</h3></main>'
_, spots = m.mark_source(before)
after = '<main><h3>Barking and whining</h3><p>We find the trigger first.</p><h3>Jumping</h3></main>'
_, spots2 = m.mark_source(after, spots)
reword = '<main><h3>Destructive chewing habits</h3><p>Replace destructive patterns with structure.</p><h3>Excessive barking</h3><p>We calm the triggers.</p><h3>Jumping</h3></main>'
_, spots3 = m.mark_source(reword, spots)
print(json.dumps({"old": {s["text"]: s["key"] for s in spots}, "new": {s["text"]: s["key"] for s in spots2}, "reword": {s["text"]: s["key"] for s in spots3}}))
`));
  assert.notEqual(out.new["Barking and whining"], out.old["Destructive chewing"], "the rewritten card never inherits the deleted card's key");
  assert.notEqual(out.new["We find the trigger first."], out.old["Replace destructive patterns with structure."]);
  assert.equal(out.new["Jumping"], out.old["Jumping"], "untouched spots keep their key");
  assert.notEqual(out.reword["Destructive chewing habits"], out.old["Destructive chewing"], "a reworded spot gets a new key; nothing is ever moved");
  assert.equal(out.reword["Excessive barking"], out.old["Excessive barking"], "neighbours keep their keys");
});

test("marker: phone numbers, emails and call links are never spots", () => {
  const out = JSON.parse(py(`
import json, site_text_marker as m
src = '<main><a href="tel:+18664364959">Call now</a><p>(866) 436-4959</p><p>office@example.com</p><h2>Real heading</h2></main>'
_, spots = m.mark_source(src)
print(json.dumps([s["text"] for s in spots]))
`));
  assert.deepEqual(out, ["Real heading"]);
});

test("a draft keeps the code text the office first edited against; only publish moves it", async () => {
  let calls = fakeSupabase([{ id: `home:${SPOT.key}`, page: "home", key: SPOT.key, live_value: "Office words", draft_value: null, base_default: "Older code words" }]);
  await call(load(false), { method: "POST", body: { operation: "save_draft", page: "home", key: SPOT.key, value: "Newer office words" } });
  assert.equal(calls.find(c => c.method === "POST" && c.path.startsWith("/rest/v1/site_text")).body.base_default, "Older code words");
  calls = fakeSupabase([{ id: `home:${SPOT.key}`, page: "home", key: SPOT.key, live_value: "Office words", draft_value: "Newer office words", base_default: "Older code words" }]);
  await call(load(false), { method: "POST", body: { operation: "publish", page: "home", name: "Rachel Leggett" } });
  assert.equal(calls.find(c => c.method === "PATCH").body.base_default, SPOT.text);
});

test("safety net: office text whose code words changed is hidden until the office keeps it (logged)", async () => {
  fakeSupabase([{ id: `home:${SPOT.key}`, page: "home", key: SPOT.key, live_value: "Office words", base_default: "Some older code words" }]);
  const res = await call(load(false), { query: { path: "/" }, auth: false });
  assert.deepEqual(res.payload.texts, {}, "the code words show instead");
  let calls = fakeSupabase([{ id: `home:${SPOT.key}`, page: "home", key: SPOT.key, live_value: "Office words", base_default: "Some older code words" }]);
  const noName = await call(load(false), { method: "POST", body: { operation: "confirm", page: "home", key: SPOT.key, name: "Rachel" } });
  assert.equal(noName.statusCode, 400);
  const ok = await call(load(false), { method: "POST", body: { operation: "confirm", page: "home", key: SPOT.key, name: "Rachel Leggett" } });
  assert.equal(ok.statusCode, 200);
  assert.equal(calls.find(c => c.method === "PATCH").body.base_default, SPOT.text);
  assert.equal(calls.find(c => c.path.startsWith("/rest/v1/audit_events")).body.action, "site_text_confirmed");
});

const pyMark = code => JSON.parse(py(code));
test("marker: a card inserted before a reworded neighbour never takes the neighbour's key", () => {
  const out = pyMark(`
import json, site_text_marker as m
before = '<main><div class="card"><h3>In Home Training</h3></div><div class="card"><h3>Obedience Training</h3></div></main>'
_, s1 = m.mark_source(before)
after = '<main><div class="card"><h3>Home Training Camp</h3></div><div class="card"><h3>In-Home Training</h3></div><div class="card"><h3>Obedience Training</h3></div></main>'
_, s2 = m.mark_source(after, s1)
print(json.dumps({"old": {s["text"]: s["key"] for s in s1}, "new": {s["text"]: s["key"] for s in s2}}))
`);
  assert.notEqual(out.new["Home Training Camp"], out.old["In Home Training"]);
  assert.notEqual(out.new["In-Home Training"], out.old["In Home Training"], "a reworded spot gets a new key; the old office text is kept and flagged");
  assert.equal(out.new["Obedience Training"], out.old["Obedience Training"]);
});

test("marker: removing one of two identical buttons never gives its office text to the other", () => {
  const out = pyMark(`
import json, site_text_marker as m
before = '<main><section class="cta-band"><a class="btn">Book Evaluation</a></section></main><div class="floating-cta"><a class="btn">Book Evaluation</a></div>'
_, s1 = m.mark_source(before)
after = '<main></main><div class="floating-cta"><a class="btn">Book Evaluation</a></div>'
_, s2 = m.mark_source(after, s1)
print(json.dumps({"old": [[s["ctx"], s["key"]] for s in s1], "new": [[s["ctx"], s["key"]] for s in s2]}))
`);
  const floatingOld = out.old.find(([ctx]) => ctx.includes("floating-cta"))[1];
  const sectionOld = out.old.find(([ctx]) => ctx.includes("cta-band"))[1];
  assert.equal(out.new.length, 1);
  assert.notEqual(out.new[0][1], sectionOld, "the floating button never takes the section button's key");
  assert.equal(out.new[0][1], floatingOld, "it keeps its own key (same place, unique)");
});

test("marker: a retired key is never handed to a new spot later, and a spot that only moved keeps its key", () => {
  const out = pyMark(`
import json, site_text_marker as m
v1 = '<main><h2>Why Choose Us</h2><h2>Our Process</h2><p>Old promise text</p></main>'
_, s1 = m.mark_source(v1)
retired = []
v2 = '<main><h2>Our Process</h2><h2>Why Choose Us</h2></main>'
_, s2 = m.mark_source(v2, s1, None, retired)
v3 = '<main><h2>Our Process</h2><h2>Why Choose Us</h2><p>Old promise text</p></main>'
_, s3 = m.mark_source(v3, s2, None, retired)
print(json.dumps({"s1": {s["text"]: s["key"] for s in s1}, "s2": {s["text"]: s["key"] for s in s2}, "s3": {s["text"]: s["key"] for s in s3}, "retired": retired}))
`);
  assert.equal(out.s2["Why Choose Us"], out.s1["Why Choose Us"], "swapped spots keep their keys");
  assert.equal(out.s2["Our Process"], out.s1["Our Process"]);
  assert.ok(out.retired.includes(out.s1["Old promise text"]));
  assert.notEqual(out.s3["Old promise text"], out.s1["Old promise text"], "a retired key is never reused");
});
