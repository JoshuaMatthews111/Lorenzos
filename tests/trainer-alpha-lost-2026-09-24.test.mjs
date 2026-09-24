// Audit 2026-09-24 (rule 83, the trainer's own lead actions):
//  1. answering the Alpha question (or Eval completed) emptied state.trainerLost, so a Lost reason + note the
//     trainer had already typed vanished and "Mark lost" then said "Pick why the client was lost.";
//  2. a refused Alpha answer stayed selected in the dropdown as if saved (redraws are held while it has focus).
// Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(import.meta.dirname, "..", "trainer-backoffice/app.js"), "utf8");
const fn = name => app.match(new RegExp(`(?:async )?function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];

async function act({ action, ok = true, value = "yes", alphaAnswer = "" }) {
  const lead = { id: "L1", remoteId: "r1", version: 3, owner: "Pat", status: "Evaluation Scheduled", alphaAnswer };
  const button = { dataset: { trainerLeadAction: action, leadRef: "L1" }, tagName: action === "alpha" ? "SELECT" : "BUTTON", value, disabled: false };
  const ctx = {
    state: { leads: [lead], trainerLost: { leadId: "L1", reason: "price", note: "Too far" }, trainerHandoff: null, selectedLeadId: "L1" },
    trainerTeam: null, showToast: () => {}, render: () => {}, reloadRemoteData: async () => {},
    window: { confirm: () => true, LDTT_PORTAL: { accessToken: async () => "t" } },
    fetch: async () => ({ ok, status: ok ? 200 : 409, json: async () => (ok ? { ok: true } : { ok: false, message: "Changed by someone else" }) })
  };
  vm.createContext(ctx);
  vm.runInContext(`${fn("trainerLeadAction")}; this.go = trainerLeadAction;`, ctx);
  await ctx.go(button);
  return { state: ctx.state, button };
}

test("answering Alpha keeps the Lost reason and note the trainer typed", async () => {
  const { state } = await act({ action: "alpha" });
  assert.equal(state.trainerLost?.reason, "price");
  assert.equal(state.trainerLost?.note, "Too far");
});

test("Eval completed keeps it too; a Lost save empties it", async () => {
  assert.equal((await act({ action: "eval_completed" })).state.trainerLost?.reason, "price");
  assert.equal((await act({ action: "lost" })).state.trainerLost, null);
});

test("a refused Alpha answer is put back to what is stored", async () => {
  const { button } = await act({ action: "alpha", ok: false, value: "yes", alphaAnswer: "no" });
  assert.equal(button.value, "no");
  assert.equal(button.disabled, false);
  const blank = await act({ action: "alpha", ok: false, value: "yes", alphaAnswer: "" });
  assert.equal(blank.button.value, "");
});
