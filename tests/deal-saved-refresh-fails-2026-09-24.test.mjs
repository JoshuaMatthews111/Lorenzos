// Audit 2026-09-24: submitDealFromForm awaited reloadRemoteData() inside the same try as the POST. When the deal
// was SAVED but the refresh after it failed (a network blip, a cold server), the catch put the whole filled form
// back with an error, the trainer pressed Submit again, and api/submit-deal.js (no duplicate check on create)
// recorded the deal twice. The refresh failure is now logged and the success message stays.
// Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(import.meta.dirname, "..", "trainer-backoffice/app.js"), "utf8");
const fn = name => app.match(new RegExp(`(?:async )?function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];

async function run({ postOk = true, refreshFails = true } = {}) {
  const posts = [];
  const ctx = {
    state: { dealForm: { lead_id: "lead-a", client_name: "Pat", program: "Basic", sold_amount: 1200, collected_amount: 1200, plan_type: "paid_in_full" } },
    dealForm: () => ctx.state.dealForm,
    render: () => {}, showToast: () => {}, fmtMoney: v => `$${v}`,
    console: { warn: () => {} },
    window: { LDTT_PORTAL: { accessToken: async () => "tok" } },
    fetch: async (url, opts) => { posts.push(url); return { ok: postOk, status: postOk ? 200 : 400, json: async () => (postOk ? { ok: true, deal: { collected_amount: 1200 }, balance_due: 0 } : { ok: false, message: "Enter what the program sold for." }) }; },
    reloadRemoteData: async () => { if (refreshFails) throw new TypeError("Failed to fetch"); }
  };
  vm.createContext(ctx);
  vm.runInContext(`${fn("submitDealFromForm")}; this.go = submitDealFromForm;`, ctx);
  await ctx.go();
  return { form: ctx.state.dealForm, posts };
}

test("deal saved + refresh fails: the success stays, the filled form is NOT put back", async () => {
  const { form, posts } = await run({ refreshFails: true });
  assert.equal(posts.length, 1);
  assert.match(form.ok || "", /^Saved\./);
  assert.ok(!form.error, `no error shown: ${form.error}`);
  assert.equal(form.client_name, undefined, "the form is cleared, so a second Submit cannot duplicate the deal");
});

test("a real save failure still shows the error and keeps what was typed", async () => {
  const { form } = await run({ postOk: false, refreshFails: false });
  assert.match(form.error, /sold for/);
  assert.equal(form.client_name, "Pat");
  assert.equal(form.busy, false);
});
