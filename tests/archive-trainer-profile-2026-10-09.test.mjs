// Office 2026-10-09: a trainer stepped down. "Archive Trainer Profile" takes a trainer off the website in one click
// (nothing deleted); Genevieve Twilla is removed from the built files; /api/public-trainers lists archived slugs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const exists = f => fs.existsSync(new URL(`../${f}`, import.meta.url));

test("Genevieve Twilla is off the built site and her old links go to Find a Trainer", () => {
  for (const f of ["find-a-trainer.html", "trainer-roster.js", "trainer_bios.json", "build.py"]) assert.doesNotMatch(read(f).toLowerCase(), /genevieve/, f);
  assert.ok(!exists("trainer-bio-genevieve-twilla.html") && !exists("genevievetwilla.html"));
  const v = JSON.parse(read("vercel.json"));
  for (const src of ["/trainer-bio-genevieve-twilla", "/genevievetwilla"]) assert.ok(v.redirects.some(r => r.source === src && r.destination === "/find-a-trainer"), src);
});

test("archive_trainer_profile: trainer archived, pages taken down, booking off, login disabled; restore undoes it (booking stays off)", async () => {
  const calls = [];
  const settingsRow = { key: "booking_trainers", value: { trainers: [{ slug: "gone-trainer", active: true, schedule_id: "x" }, { slug: "other", active: true }] } };
  globalThis.__calls = calls;
  const src = read("api/operational-mutation.js");
  const fn = src.match(/async function setBookingActive[\s\S]*?\n\}\n/)[0];
  const setBookingActive = new Function("supabaseFetch", `${fn}; return setBookingActive;`)(async (path, opts) => {
    calls.push([path, opts?.body ? JSON.parse(opts.body) : null]);
    return path.includes("select=key,value") ? [settingsRow] : [];
  });
  await setBookingActive("gone-trainer", false, "archived");
  const patch = calls.find(([p, b]) => b && p.startsWith("/rest/v1/site_settings?key=eq.booking_trainers"))[1];
  assert.deepEqual(patch.value.trainers.map(t => [t.slug, t.active]), [["gone-trainer", false], ["other", true]]);
  assert.equal(patch.value.trainers[0].paused_reason, "archived");
  assert.match(src, /case "archive_trainer_profile": result = await archiveTrainerProfile/);
  assert.match(src, /case "restore_trainer_profile": result = await restoreTrainerProfile/);
  assert.match(src, /status: "archived", archived_at: now, archived_by: admin\.actor\.id, access_status: "disabled"/);
  assert.match(src, /trainer_pages\?trainer_id=eq\.\$\{encodeURIComponent\(id\)\}&page_status=neq\.archived/);
  assert.match(src, /status: "active", archived_at: null, archived_by: null, access_status: "active"/);
  assert.doesNotMatch(src.match(/async function restoreTrainerProfile[\s\S]*?\n\}\n/)[0], /setBookingActive/, "restore never turns booking back on");
});

test("portal: Archive button under Disable Trainer Access; archived list with Restore; typed-name dialog", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /Disable Trainer Access"\}<\/button>\$\{trainer\.remoteId \? `<button class="btn btn-outline btn-danger" data-archive-trainer-profile=/);
  assert.match(app, /data-restore-trainer-profile=/);
  assert.match(app, /operation: "archive_trainer_profile", entity_type: "trainer", id: trainer\.remoteId, archived_by_name: typed/);
  assert.match(app, /operation: "restore_trainer_profile", entity_type: "trainer", id: trainer\.remoteId, restored_by_name: typed/);
});

test("public pages hide archived slugs via /api/public-trainers", () => {
  const api = read("api/public-trainers.js");
  assert.match(api, /status=eq\.archived/);
  assert.match(api, /s-maxage=60/);
  const js = read("script.js");
  assert.match(js, /fetch\("\/api\/public-trainers"/);
  assert.match(js, /\.trainer-card\[data-trainer-slug\]/);
  assert.match(js, /This trainer is no longer with the team/);
});
