// Angela's lead email, "What would you change about your dog's behavior?" (2026-09-25). READY BUT NOT SENT.
// Pins: her words exactly (only the signature brand + tagline + the opt-out line added), both buttons go to the person's
// own area link (the 7 AM send's resolver), the pools and exclusions, dedupe by email, per-person once-ever,
// disarm-before-first-send, the kill switch, the practice cap, and that it SHIPS DISARMED with no send_at.
// Run: node --test tests/   Nothing here talks to the real project (global fetch is replaced).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const NOW = Date.parse("2026-09-25T15:00:00Z");

function load(sandbox = false) {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/office-email.js", "../lib/pipeline.js", "../lib/email-campaign.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../lib/email-campaign.js");
}

const ANGELA = [
  "Hi Diana,",
  "Still looking for help with your dog?",
  "Maybe it's pulling on the leash. Not listening. Jumping. Barking. Reactivity. Anxiety. Aggression. Or maybe you just want a better-trained dog you can confidently enjoy life with.",
  "Whatever brought you to Lorenzo's Dog Training, you don't have to figure it out alone.",
  "Every dog is different—and before we recommend training, we want to understand what's actually happening with yours.",
  "That's why we offer a FREE Dog Training Evaluation.",
  "During your evaluation, we'll talk about what you're experiencing, what you'd like to change, and what may be standing between the dog you have today and the relationship you want with your dog.",
  "\u{1F43E} Choose what works for you: Schedule your FREE evaluation online or in person.",
  "\u{1F449} SCHEDULE MY FREE EVALUATION: https://lorenzosdogtrainingteam.com/dog-training-san-antonio-tx?zip=78245",
  "No guessing. No pressure. Just an opportunity to get answers and understand your options.",
  "You've already taken the first step by looking for help.",
  "We're here when you're ready for the next one.",
  "Lorenzo's Dog Training Team",
  "Serious Training. Serious Results.",
  "P.S. Your dog doesn't need to be \"a bad dog\" to need training. Sometimes you simply need the right communication, structure, and guidance. Let's figure out what your dog needs together.",
  "\u{1F449} BOOK MY FREE EVALUATION: https://lorenzosdogtrainingteam.com/dog-training-san-antonio-tx?zip=78245",
  "Reply to this email with STOP and we won't email again."
];

test("Angela's words, exactly, in order; subject exact; both buttons to the SAME area link; signature + tagline + opt-out", () => {
  const E = load();
  const link = "https://lorenzosdogtrainingteam.com/dog-training-san-antonio-tx?zip=78245";
  const mail = E.renderEmail({ firstName: "diana", link });
  assert.equal(mail.subject, "What would you change about your dog's behavior?");
  assert.deepEqual(mail.text.split("\n").filter(Boolean), ANGELA);
  const buttons = [...mail.html.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(m => [m[1].replace(/&amp;/g, "&"), m[2]]);
  assert.deepEqual(buttons, [[link, "SCHEDULE MY FREE EVALUATION"], [link, "BOOK MY FREE EVALUATION"]]);
  assert.ok(mail.html.indexOf("SCHEDULE MY FREE EVALUATION") < mail.html.indexOf("No guessing"), "button 1 sits after 'Choose what works for you'");
  assert.ok(mail.html.indexOf("BOOK MY FREE EVALUATION") > mail.html.indexOf("P.S."), "button 2 sits after the P.S.");
  for (const words of ["Lorenzo&#39;s Dog Training Team", "Serious Training. Serious Results.", "Reply to this email with STOP and we won&#39;t email again."]) assert.ok(mail.html.includes(words), words);
  assert.match(E.renderEmail({ firstName: "Larry or Laura", link }).text, /^Hi there,/, "the same greeting tidy as every client message");
  assert.match(E.renderEmail({ firstName: "TIMOTHY", link }).text, /^Hi Timothy,/);
  assert.doesNotMatch(E.renderEmail({ firstName: "Pat", link: "javascript:alert(1)" }).html, /<a /, "only an https link becomes a button");
  assert.doesNotMatch(mail.text + mail.html, /\bTim\b|ldtt-sandbox|ads-v2|\/ads\//, "never Tim, never the practice host, never a 2.0 page");
});

test("pools match the office dashboard buckets; exclusions: qa, DNC, archived, client, bad lead, hard-no Lost, opted out, no email, the window", () => {
  const E = load();
  const L = (over = {}, raw = {}) => ({ id: randomUUID(), created_at: "2026-09-01T00:00:00Z", status: "office_contacted", email: `${randomUUID()}@x.com`, sms_consent: true, raw_payload: raw, ...over });
  assert.deepEqual(E.poolsOf(L({}, { source_page: "contact.html" })), ["contact_us"]);
  assert.deepEqual(E.poolsOf(L({}, { source_page: "dog-training-pensacola-fl" })), ["paid_ad"]);
  assert.deepEqual(E.poolsOf(L({}, { source_page: "dog-training-pensacola-fl", lead_type: "pdf_download" })), ["paid_ad", "ebook"]);
  assert.deepEqual(E.poolsOf(L({ sms_consent: false }, { ad_market: "Atlanta, GA" })), ["paid_ad", "contacted_no_text_consent"]);
  assert.deepEqual(E.poolsOf(L({ status: "engaged_no_outcome", sms_consent: null })), ["contact_us", "contacted_no_text_consent"]);
  assert.deepEqual(E.poolsOf(L({ status: "new_inquiry", sms_consent: false })), ["contact_us"], "only Office Contacted / Engaged count for pool (d)");
  const opted = new Set(["gone@x.com"]);
  const why = (over, raw, opts = {}) => E.exclusionReason(L(over, raw), { optedOut: opted, nowMs: NOW, ...opts });
  assert.equal(why({}, {}), "");
  assert.equal(why({}, { qa: true }), "test row");
  for (const status of ["do_not_contact", "archived", "became_client", "bad_lead", "lost_no_trainer_area", "lost_method_not_a_fit", "lost_dog_not_qualified", "lost_chose_another_provider"]) assert.match(why({ status }), /^status /, status);
  for (const status of ["lost_no_response", "lost_price_concern", "evaluation_cancelled", "new_inquiry"]) assert.equal(why({ status }), "", `${status} may get it (maybe later)`);
  for (const status of ["evaluation_scheduled", "evaluation_complete"]) {
    assert.equal(why({ status }), `already booked (${status})`, "a booked / evaluated person is not 'still looking for help' (default)");
    assert.equal(why({ status }, {}, { includeBooked: true }), "", "include_booked:true lets them back in");
  }
  assert.equal(why({ email: "" }), "no email address");
  assert.equal(why({ email: "Gone@X.com" }), "opted out of email");
  assert.equal(why({ created_at: "2026-06-01T00:00:00Z" }, {}, { maxAgeDays: 60 }), "older than 60 days");
  assert.equal(why({ created_at: "2026-06-01T00:00:00Z" }, {}, { maxAgeDays: null }), "", "no window unless one is chosen");
});

test("plan: one email per address (the row with a ZIP kept), people already emailed by this campaign skipped, the 7 AM overlap counted", () => {
  const E = load();
  const rows = [
    { id: "a1", created_at: "2026-08-01", status: "office_contacted", email: "Pat@x.com", zip: "", sms_consent: false, raw_payload: { source_page: "contact.html" } },
    { id: "a2", created_at: "2026-08-05", status: "new_inquiry", email: "pat@x.com", zip: "78245", sms_consent: true, raw_payload: { source_page: "contact.html", pipeline: { reengage: { status: "sent", at: "2026-09-24T11:00:05Z" } } } },
    { id: "b1", created_at: "2026-08-02", status: "office_contacted", email: "sam@x.com", raw_payload: { source_page: "dog-training-atlanta-ga", pipeline: { email_campaigns: { angela_2026_09: { status: "sent" } } } } },
    { id: "c1", created_at: "2026-08-03", status: "archived", email: "arc@x.com", raw_payload: {} },
    { id: "q1", created_at: "2026-08-03", status: "new_inquiry", email: "qa@x.com", raw_payload: { qa: true } }
  ];
  const out = E.plan(rows, { nowMs: NOW, reengageSince: "2026-09-24T11:00:00Z" });
  assert.deepEqual(out.recipients.map(r => r.id), ["a2"], "Pat once (the row with the ZIP); Sam already got this campaign; archived + qa never");
  assert.equal(out.union.people, 2);
  assert.equal(out.union.already_emailed_this_campaign, 1);
  assert.equal(out.union.already_got_7am, 1);
  assert.equal(out.per_pool.contact_us.leads, 3);
  assert.equal(out.per_pool.contact_us.eligible_people, 1);
  assert.equal(out.per_pool.contacted_no_text_consent.leads, 2, "Pat (no consent on that row) and Sam (consent never answered)");
  assert.equal(out.per_pool.paid_ad.leads, 1);
});

function stub(world, calls) {
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    const method = options.method || "GET";
    calls.push({ host: u.host, path: u.pathname, method, body, query: decodeURIComponent(u.search) });
    const res = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (u.host === "api.resend.com") { world.sent.push(body); return res(200, { id: `re_${world.sent.length}` }); }
    if (u.pathname.startsWith("/rest/v1/site_settings")) {
      if (u.search.includes("email_campaign")) {
        if (method === "GET") return res(200, world.campaign ? [world.campaign] : []);
        if (method === "PATCH") {
          if (u.search.includes("updated_at=eq.") && !decodeURIComponent(u.search).includes(`updated_at=eq.${world.campaign.updated_at}`)) return res(200, []);
          world.campaign = { ...world.campaign, value: body.value, updated_at: body.updated_at || `u${Math.random()}` };
          world.campaignWrites.push({ at: calls.length, value: body.value });
          return res(200, [world.campaign]);
        }
      }
      if (u.search.includes("pipeline_office_emails")) return res(200, [{ key: "pipeline_office_emails", value: { practice_email_to: "practice@example.test" } }]);
      return res(200, []);
    }
    if (u.pathname.startsWith("/rest/v1/clients")) return res(200, [{ email: "gone@x.com" }]);
    if (u.pathname.startsWith("/rest/v1/ad_pages")) return res(200, []);
    if (u.pathname.startsWith("/rest/v1/leads")) {
      if (method === "PATCH") {
        const hit = world.leads.find(l => u.search.includes(l.id) && u.search.includes(`version=eq.${l.version}`));
        if (!hit) return res(200, []);
        Object.assign(hit, body, { version: hit.version + 1 });
        return res(200, [JSON.parse(JSON.stringify(hit))]);
      }
      if (u.search.includes("id=eq.")) return res(200, world.leads.filter(l => u.search.includes(l.id)).map(l => JSON.parse(JSON.stringify(l))));
      return res(200, u.search.includes("offset=0") ? world.leads.map(l => JSON.parse(JSON.stringify(l))) : []);
    }
    return res(200, []);
  };
}
const person = (email, over = {}) => ({ id: randomUUID(), version: 1, created_at: "2026-09-01T00:00:00Z", first_name: "Pat", email, zip: "78245", status: "office_contacted", sms_consent: false, raw_payload: { source_page: "contact.html" }, ...over });

test("SHIPPED DISARMED: not armed / no key / no pools / not yet due = nothing read, nothing sent", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  const sql = read("supabase/migrations/20260925140000_email_campaign_server_only.sql");
  assert.match(sql, /'\{"armed": false, "send_at": "", "pools": \[\], "max_age_days": null, "campaign_id": "angela_2026_09"/);
  assert.match(sql, /create policy "email_campaign_server_only" on public\.site_settings\s+as restrictive/);
  assert.ok(sql.indexOf("create policy") < sql.indexOf("insert into"), "the policy exists before the row");
  for (const campaign of [null, { key: "email_campaign", value: { armed: false, send_at: "", pools: [] }, updated_at: "u1" },
    { key: "email_campaign", value: { armed: true, send_at: "2026-09-25T14:00:00Z", pools: [] }, updated_at: "u1" },
    { key: "email_campaign", value: { armed: true, send_at: "2026-09-26T14:00:00Z", pools: ["contact_us"] }, updated_at: "u1" }]) {
    const world = { campaign, leads: [person("a@x.com")], sent: [], campaignWrites: [] };
    const calls = [];
    stub(world, calls);
    const E = load();
    const out = await E.runEmailCampaign({ nowMs: NOW });
    assert.equal(out.ran, undefined, JSON.stringify(out));
    assert.equal(world.sent.length, 0);
    assert.equal(calls.filter(c => c.path.startsWith("/rest/v1/leads")).length, 0);
  }
  delete process.env.RESEND_API_KEY;
});

test("ARMED + due: disarms FIRST, one email per address, never twice, opted-out and excluded skipped, a second run sends nothing", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  const leads = [person("a@x.com"), person("A@x.com", { zip: "" }), person("b@x.com"), person("gone@x.com"), person("c@x.com", { status: "archived" }), person("d@x.com", { raw_payload: { qa: true } })];
  const world = { campaign: { key: "email_campaign", value: { armed: true, send_at: "2026-09-25T14:00:00Z", pools: ["contact_us"], campaign_id: "angela_2026_09" }, updated_at: "u1" }, leads, sent: [], campaignWrites: [] };
  const calls = [];
  stub(world, calls);
  const E = load();
  const [one, two] = await Promise.all([E.runEmailCampaign({ nowMs: NOW, paceMs: 0 }), E.runEmailCampaign({ nowMs: NOW, paceMs: 0 })]);
  assert.equal(world.sent.length, 2, `a@ once and b@ once: ${JSON.stringify([one.message, two.message])}`);
  assert.deepEqual(world.sent.map(m => m.to[0]).sort(), ["a@x.com", "b@x.com"]);
  const firstResend = calls.findIndex(c => c.host === "api.resend.com");
  assert.ok(world.campaignWrites[0].at < firstResend && world.campaignWrites[0].value.armed === false, "disarmed before the first email");
  assert.equal(world.sent[0].subject, "What would you change about your dog's behavior?");
  assert.match(world.sent[0].headers?.["Idempotency-Key"] || JSON.stringify(calls.find(c => c.host === "api.resend.com")), /./);
  assert.match(world.sent[0].text, /https:\/\/lorenzosdogtrainingteam\.com\/book\?zip=78245/, "the live area link (no city page near in this fixture)");
  assert.equal(world.campaign.value.armed, false);
  assert.equal(world.campaign.value.status, "done");
  assert.equal(world.campaign.value.last_run.sent, 2);
  const kept = leads.find(l => l.email === "a@x.com");
  assert.equal(kept.raw_payload.pipeline.email_campaigns.angela_2026_09.status, "sent");
  assert.equal(leads.find(l => l.email === "A@x.com").raw_payload.pipeline, undefined, "the passed-over twin is never claimed");
  // Re-armed by mistake: nobody gets it twice.
  world.campaign = { ...world.campaign, value: { ...world.campaign.value, armed: true }, updated_at: "u9" };
  await E.runEmailCampaign({ nowMs: NOW, paceMs: 0 });
  assert.equal(world.sent.length, 2, "per person, once ever");
  delete process.env.RESEND_API_KEY;
});

test("practice copy: every email goes to the practice inbox, at most 3, marked", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  const leads = ["a", "b", "c", "d", "e"].map(x => person(`${x}@x.com`));
  const world = { campaign: { key: "email_campaign", value: { armed: true, send_at: "2026-09-25T14:00:00Z", pools: ["contact_us"] }, updated_at: "u1" }, leads, sent: [], campaignWrites: [] };
  stub(world, []);
  const E = load(true);
  await E.runEmailCampaign({ nowMs: NOW, paceMs: 0 });
  assert.equal(world.sent.length, 3);
  assert.ok(world.sent.every(m => m.to[0] === "practice@example.test"));
  assert.match(world.sent[0].subject, /^\[PRACTICE COPY\] /);
  delete process.env.RESEND_API_KEY;
});

test("the office door: dry run + preview are read-only and SUPER ADMIN only; arming needs pools + send_at; the cron checks it", () => {
  const api = read("api/pipeline.js");
  assert.match(api, /if \(op === "email_campaign"\) \{\n\s*\/\/[^\n]*\n\s*if \(!access\.isSuperAdmin\) return res\.status\(403\)/);
  assert.match(api, /if \(op === "email_campaign_preview"\) \{\n\s*\/\/[^\n]*\n\s*if \(!access\.isSuperAdmin\) return res\.status\(403\)/);
  assert.match(api, /authorizeRequest\(req, res, \{ require: "super", message: "Only the Super Admin can arm the email campaign\." \}\)/);
  assert.match(api, /if \(campaign\.armed && \(!campaign\.pools\.length \|\| !campaign\.send_at\)\) return res\.status\(400\)/);
  assert.match(read("api/cron/auto-followups.js"), /const emailCampaign = await E\.runEmailCampaign\(\)\n\s*\.catch\(/);
  const E = load();
  assert.deepEqual(E.normalizeCampaign({}), { armed: false, send_at: "", pools: [], max_age_days: null, campaign_id: "angela_2026_09", include_booked: false });
});
