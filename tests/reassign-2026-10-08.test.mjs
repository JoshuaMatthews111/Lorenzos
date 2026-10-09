// Office 2026-10-08: reassigning a lead (Shauna Leff, Brady -> Eric Beck) saved trainer_id but left trainer_slug on
// Brady, and the office screen matched the slug first. Now the id wins and both save paths move the slug too.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
test("office screen: trainer_id wins over a stale trainer_slug", () => {
  assert.match(read("trainer-backoffice/app.js"), /\(row\.trainer_id && state\.trainers\.find\(item => item\.remoteId === row\.trainer_id\)\) \|\| state\.trainers\.find\(item => item\.slug === row\.trainer_slug\)/);
});
test("hand-off and office assign both move trainer_slug", () => {
  assert.match(read("api/trainer-lead-action.js"), /changes\.trainer_slug = targetSlug \|\| targetRow\.slug/);
  assert.match(read("api/operational-mutation.js"), /if \(t\?\.slug\) changes\.trainer_slug = t\.slug;/);
});

test("a trainer note is saved once: server answers with the existing copy, the box empties", () => {
  assert.match(read("api/trainer-lead-action.js"), /if \(same\?\.id\) return reply\(res, 200, \{ ok: true, already: true/);
  assert.match(read("trainer-backoffice/app.js"), /if \(action === "note"\) \{ const box = document\.querySelector/);
});

test("an office note is saved once too", () => {
  assert.match(read("api/operational-mutation.js"), /if \(same\?\.id\) return \{ status: 200, body: \{ ok: true, already: true, record: same/);
});

// Missy 2026-10-09: Shauna Leff's lead was with Eric Beck but her client record still said Brady DeRemer.
test("moving a lead also moves its client record (only when it still pointed at the old trainer)", async () => {
  for (const file of ["api/trainer-lead-action.js", "api/operational-mutation.js"]) {
    const src = read(file);
    const fn = src.match(/async function moveLinkedClient\([\s\S]*?\n\}\n/)[0];
    const calls = [];
    const moveLinkedClient = new Function("supabaseFetch", `${fn}; return moveLinkedClient;`)(async (path, opts) => { calls.push([path, JSON.parse(opts.body)]); return null; });
    await moveLinkedClient("L1", "BRADY", "ERIC");
    await moveLinkedClient("L1", "ERIC", "ERIC");
    await moveLinkedClient("L2", null, "ERIC");
    assert.deepEqual(calls, [
      ["/rest/v1/clients?lead_id=eq.L1&trainer_id=eq.BRADY", { trainer_id: "ERIC" }],
      ["/rest/v1/clients?lead_id=eq.L2&trainer_id=is.null", { trainer_id: "ERIC" }]
    ], file);
  }
  assert.match(read("api/trainer-lead-action.js"), /await moveLinkedClient\(record\.id, before\.trainer_id, targetRow\.id\);/);
  assert.match(read("api/operational-mutation.js"), /if \(entityType === "lead" && "trainer_id" in changes\) await moveLinkedClient\(record\.id, before\.trainer_id, record\.trainer_id\);/);
  assert.match(read("trainer-backoffice/app.js"), /Now with: \$\{escapeHtml\(holder\?\.full_name/);
});
