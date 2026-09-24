// Audit 2026-09-24 (rule 7): the trainer's calendar (booked clients, Google link), team and phone answers load
// ONCE per sign-in into module variables and every loader returns early when its variable is set. The Sign out
// button reset only portalUser / remoteReady / session, and finishPortalSignIn cleared nothing, so trainer B
// signing in after trainer A in the same tab saw A's booked clients, A's team and A's phone last 4, plus A's
// half-filled deal, Lost and hand-off boxes. Every sign-out and every sign-in now starts clean.
// Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(import.meta.dirname, "..", "trainer-backoffice/app.js"), "utf8");
const fn = name => app.match(new RegExp(`(?:async )?function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];

test("resetPerUserPortalCaches empties every per-person cache and the half-filled trainer boxes", () => {
  const ctx = { state: { dealForm: { lead_id: "A-lead", client_name: "A client" }, trainerLost: { leadId: "x", reason: "Price" }, trainerHandoff: { leadId: "x", to: "t" }, selectedLeadId: "A-lead", activeView: "dashboard" } };
  vm.runInNewContext(
    `var trainerTeam = {trainers:[1]}, trainerTeamPromise = 1, trainerCalendar = {booked:[{name:"A's client"}]}, trainerCalendarPromise = 1,
         trainerPhoneChange = {current_last4:"1234"}, trainerPhoneChangePromise = 1, phoneChangeRequests = {requests:[1]}, phoneChangeRequestsPromise = 1;
     ${fn("resetPerUserPortalCaches")}
     resetPerUserPortalCaches();
     this.out = [trainerTeam, trainerTeamPromise, trainerCalendar, trainerCalendarPromise, trainerPhoneChange, trainerPhoneChangePromise, phoneChangeRequests, phoneChangeRequestsPromise];`,
    ctx
  );
  assert.deepEqual([...ctx.out], [null, null, null, null, null, null, null, null]);
  assert.deepEqual({ ...ctx.state.dealForm }, {}, "back to the default empty deal form");
  assert.equal(ctx.state.trainerLost, null);
  assert.equal(ctx.state.trainerHandoff, null);
  assert.equal(ctx.state.selectedLeadId, "");
  assert.equal(ctx.state.activeView, "dashboard", "nothing else in state is touched");
});

test("Sign out and every sign-in call it", () => {
  assert.match(app, /if \(event\.target\.id === "logoutBtn"\) \{\n\s*if \(window\.LDTT_PORTAL\?\.enabled\) await window\.LDTT_PORTAL\.signOut\(\);\n\s*portalUser = null;\n\s*remoteReady = false;\n\s*resetPerUserPortalCaches\(\);/);
  assert.match(fn("finishPortalSignIn"), /^async function finishPortalSignIn\(status\) \{\n\s*resetPerUserPortalCaches\(\);/);
});

test("the loaders still load once per sign-in (the early return is what the reset feeds)", () => {
  assert.match(fn("loadTrainerTeam"), /if \(trainerTeam \|\| trainerTeamPromise \|\| session\.role === "admin"\) return trainerTeamPromise;/);
  assert.match(fn("loadTrainerCalendar"), /if \(trainerCalendar \|\| trainerCalendarPromise \|\| session\.role === "admin"\) return trainerCalendarPromise;/);
  assert.match(fn("loadTrainerPhoneChange"), /if \(trainerPhoneChange \|\| trainerPhoneChangePromise \|\| session\.role === "admin"\) return trainerPhoneChangePromise;/);
});
