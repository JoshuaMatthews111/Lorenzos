// Angela's lead email ("What would you change about your dog's behavior?"), 2026-09-25. EMAIL ONLY, READY BUT NOT
// SENT: the batch is built on the same safe runner pattern as the re-engage blast (rule 101) and ships DISARMED with
// no send_at. Nothing here sends anything until a Super Admin arms site_settings key "email_campaign" by hand.
//
// The words are Angela's, exactly. The only changes allowed (and made) are the brand name in the signature
// ("Lorenzo's Dog Training Team") and the tagline "Serious Training. Serious Results.", plus the email opt-out line.
// Both buttons go to the person's OWN area link, resolved exactly like the 7 AM send (lib/pipeline.js
// reengageBookingLink with noZip "contact"): the LIVE city ad page with their ZIP prefilled, /contact when there is no
// ZIP, /book?zip= when no city page is within 50 miles. Never a 2.0 page, never the practice host on live.
//
// SAFETY (the re-engage pattern, rule 101):
//   - DISARM FIRST: the runner claims the key (version-guarded PATCH on updated_at, armed:false) BEFORE the first send.
//   - PER PERSON, ONCE EVER: each email address gets this campaign once. The send claims
//     raw_payload.pipeline.email_campaigns[<campaign id>] on the lead first; ANY record (sent, sending, a lost claim)
//     is final, and a person (email) already reached on ANY of their rows is never emailed again.
//   - DEDUPE BY EMAIL across the whole run (one email per address, the richest row kept: a ZIP first, then newest).
//   - WINDOW: max_age_days is a setting (blank = no window; the 60-day re-engage ceiling does not apply here because
//     Joshua asked for the window to be a choice). qa rows held out. Excluded: Do Not Contact, Archived, Became a
//     Client, Bad Lead, the hard-no Lost statuses, anyone whose email opted out (clients.email_consent = false), no email,
//     and (unless include_booked:true) anyone whose evaluation is already booked or done.
//   - Resend only, paced 600 ms with 429 retries (lib/office-email.js), one idempotency key per campaign + address.
//   - The practice copy redirects every email to Settings -> practice_email_to and sends at most 3 (a rehearsal).
"use strict";

const { isSandbox } = require("./sandbox");
const B = require("./booking");
const M = require("./office-email");
const P = require("./pipeline");
const METRICS = require("../trainer-backoffice/metrics.js");
const MARKETS = require("./ad-page-markets").markets || [];

const KEY = "email_campaign";
const DEFAULT_CAMPAIGN_ID = "angela_2026_09";
const SUBJECT = "What would you change about your dog's behavior?";
const OPT_OUT = P.CLIENT_EMAIL_OPT_OUT; // "Reply to this email with STOP and we won't email again."
const PACE_MS = 600;
const RETRY_429 = 4;
const BUDGET_MS = 10 * 60 * 1000;
const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000;
const PRACTICE_MAX = 3;
const POOLS = ["contact_us", "paid_ad", "ebook", "contacted_no_text_consent"];
const POOL_LABELS = {
  contact_us: "Contact Us form leads",
  paid_ad: "Paid ad form leads",
  ebook: "E-book requests",
  contacted_no_text_consent: "Office Contacted / Engaged who did NOT agree to texts"
};
const EXCLUDED_STATUSES = new Set(["do_not_contact", "archived", "became_client", "bad_lead", ...METRICS.HARD_NO_LOST_STATUSES]);
// 2026-09-25 (added while building the dry run, Joshua to confirm): someone whose evaluation is BOOKED or DONE is not
// "still looking for help", so they are held out by default. The key's include_booked:true lets them back in.
const BOOKED_STATUSES = new Set(["evaluation_scheduled", "evaluation_complete"]);

const clean = B.clean;
const rawOf = row => (row?.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {});
const emailOk = email => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(email);
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const emailOf = lead => clean(lead?.email || rawOf(lead).booking?.client?.email, 160).toLowerCase();

// ---------------------------------------------------------------------------
// The pools, by the SAME rules as the office dashboard buckets (app.js isPaidAdLandingPageLead /
// isEbookRequestLead / dashboardContactFormRows), so the counts match what Lorenzo and Angela read on the call.
// Contact Us = not a paid-ad lead; Paid ad = a paid-ad lead; E-book = a paid-ad lead that asked for the e-book.
// ---------------------------------------------------------------------------
const AD_SLUGS = MARKETS.map(m => String(m.slug || "").toLowerCase()).filter(slug => slug.startsWith("dog-training-"));
function isPaidAd(lead) {
  const raw = rawOf(lead);
  if (raw.landing_page_type === "Paid ads market page" || raw.ad_market) return true;
  const values = [raw.source_page, lead?.source_page, raw.page_path, raw.page_url, raw.landing_url, raw.landing_page, raw.page].map(v => String(v || "").toLowerCase());
  return AD_SLUGS.some(slug => values.some(value => value.includes(slug)));
}
function isEbook(lead) {
  const raw = rawOf(lead);
  const text = [raw.lead_type, raw.lead_magnet, raw.service_interest, raw.i_want_to, lead?.service_interest, raw.comments, lead?.comments]
    .map(v => String(v || "").toLowerCase()).join(" ");
  return /pdf|ebook|e-book|free guide|blueprint|download/.test(text);
}
function poolsOf(lead) {
  const out = [];
  const paid = isPaidAd(lead);
  if (!paid) out.push("contact_us");
  if (paid) out.push("paid_ad");
  if (paid && isEbook(lead)) out.push("ebook");
  if (["office_contacted", "follow_up_call_needed", "engaged_no_outcome"].includes(String(lead?.status || "")) && lead?.sms_consent !== true) out.push("contacted_no_text_consent");
  return out;
}

// Why a lead cannot get this email ("" = it can). optedOut: Set of lower-case emails with clients.email_consent false.
function exclusionReason(lead, { optedOut = new Set(), nowMs = Date.now(), maxAgeDays = null, includeBooked = false } = {}) {
  if (rawOf(lead).qa === true) return "test row";
  const status = String(lead?.status || "");
  if (status === "site_visit") return "not a form submission";
  if (EXCLUDED_STATUSES.has(status)) return `status ${status}`;
  if (!includeBooked && BOOKED_STATUSES.has(status)) return `already booked (${status})`;
  const email = emailOf(lead);
  if (!email || !emailOk(email)) return "no email address";
  if (optedOut.has(email)) return "opted out of email";
  if (Number.isFinite(maxAgeDays) && maxAgeDays > 0) {
    const created = Date.parse(String(lead?.created_at || ""));
    if (Number.isFinite(created) && nowMs - created > maxAgeDays * 86400000) return `older than ${maxAgeDays} days`;
  }
  return "";
}

// One row per email address. The kept row is the one whose link can be the most local (it has a ZIP), then the newest.
function dedupeByEmail(rows) {
  const best = new Map();
  for (const lead of rows) {
    const email = emailOf(lead);
    if (!email) continue;
    const have = best.get(email);
    const score = row => (String(row?.zip || rawOf(row).booking?.intake?.zip || "").replace(/\D/g, "").length === 5 ? 2 : 0);
    if (!have || score(lead) > score(have) || (score(lead) === score(have) && String(lead.created_at || "") > String(have.created_at || ""))) best.set(email, lead);
  }
  return best;
}

const reachedBy = (lead, campaignId) => rawOf(lead).pipeline?.email_campaigns?.[campaignId] || null;

// ---------------------------------------------------------------------------
// The words (Angela's, exactly), the buttons, the signature, the opt-out line.
// ---------------------------------------------------------------------------
const PARAGRAPHS_TOP = [
  "Still looking for help with your dog?",
  "Maybe it's pulling on the leash. Not listening. Jumping. Barking. Reactivity. Anxiety. Aggression. Or maybe you just want a better-trained dog you can confidently enjoy life with.",
  "Whatever brought you to Lorenzo's Dog Training, you don't have to figure it out alone.",
  "Every dog is different—and before we recommend training, we want to understand what's actually happening with yours.",
  "That's why we offer a FREE Dog Training Evaluation.",
  "During your evaluation, we'll talk about what you're experiencing, what you'd like to change, and what may be standing between the dog you have today and the relationship you want with your dog.",
  "\u{1F43E} Choose what works for you: Schedule your FREE evaluation online or in person."
];
const PARAGRAPHS_MIDDLE = [
  "No guessing. No pressure. Just an opportunity to get answers and understand your options.",
  "You've already taken the first step by looking for help.",
  "We're here when you're ready for the next one."
];
const SIGNATURE = ["Lorenzo's Dog Training Team", "Serious Training. Serious Results."];
const PS = "P.S. Your dog doesn't need to be \"a bad dog\" to need training. Sometimes you simply need the right communication, structure, and guidance. Let's figure out what your dog needs together.";
const BUTTON_1 = "SCHEDULE MY FREE EVALUATION";
const BUTTON_2 = "BOOK MY FREE EVALUATION";

function renderEmail({ firstName = "", link = "" } = {}) {
  const name = P.clientGreetingName(firstName);
  const greeting = `Hi ${name},`;
  const safeLink = /^https:\/\//.test(String(link || "")) ? String(link) : "";
  const p = text => `<p style="margin:0 0 14px">${esc(text)}</p>`;
  const button = label => safeLink
    ? `<p style="margin:18px 0">\u{1F449} <a href="${esc(safeLink)}" style="display:inline-block;background:#d80f35;color:#fff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:bold;letter-spacing:.02em">${esc(label)}</a></p>`
    : "";
  const html = `<div style="font:16px/1.6 Arial,sans-serif;color:#111;max-width:600px">${p(greeting)}${PARAGRAPHS_TOP.map(p).join("")}${button(BUTTON_1)}${PARAGRAPHS_MIDDLE.map(p).join("")}<p style="margin:18px 0 0;font-weight:bold">${esc(SIGNATURE[0])}</p><p style="margin:0 0 18px;font-style:italic">${esc(SIGNATURE[1])}</p>${p(PS)}${button(BUTTON_2)}<p style="font-size:12px;color:#777;margin-top:22px">${esc(OPT_OUT)}</p></div>`;
  const text = [
    greeting, "", ...PARAGRAPHS_TOP.flatMap(t => [t, ""]),
    safeLink ? `\u{1F449} ${BUTTON_1}: ${safeLink}` : null, safeLink ? "" : null,
    ...PARAGRAPHS_MIDDLE.flatMap(t => [t, ""]),
    SIGNATURE[0], SIGNATURE[1], "", PS, "",
    safeLink ? `\u{1F449} ${BUTTON_2}: ${safeLink}` : null, safeLink ? "" : null,
    OPT_OUT
  ].filter(line => line !== null).join("\n");
  return { subject: SUBJECT, html, text, link: safeLink };
}

// ---------------------------------------------------------------------------
// The saved key. Shipped: { armed: false, send_at: "", pools: [], max_age_days: null, campaign_id }.
// ---------------------------------------------------------------------------
function normalizeCampaign(value) {
  const v = value && typeof value === "object" ? value : {};
  const sendAt = Date.parse(String(v.send_at || ""));
  const listed = Array.isArray(v.pools) ? v.pools : v.pools ? [v.pools] : [];
  const pools = [...new Set(listed.map(x => clean(x, 40).toLowerCase()).filter(x => POOLS.includes(x)))];
  const maxAge = Number(v.max_age_days);
  return {
    armed: v.armed === true,
    send_at: Number.isFinite(sendAt) ? new Date(sendAt).toISOString() : "",
    pools,
    max_age_days: v.max_age_days === null || v.max_age_days === "" || v.max_age_days === undefined ? null : (Number.isFinite(maxAge) && maxAge >= 1 && maxAge <= 3650 ? Math.floor(maxAge) : null),
    campaign_id: /^[a-z0-9_]{3,40}$/.test(String(v.campaign_id || "")) ? String(v.campaign_id) : DEFAULT_CAMPAIGN_ID,
    include_booked: v.include_booked === true
  };
}

const LEAD_FIELDS = "id,version,created_at,first_name,last_name,email,phone,zip,sms_consent,status,source_page,service_interest,comments,raw_payload";

async function loadLeads() {
  const rows = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const page = await B.sbOrThrow(`/rest/v1/leads?select=${LEAD_FIELDS}&order=created_at.asc&limit=1000&offset=${offset}`);
    if (!Array.isArray(page) || !page.length) break;
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function loadOptedOut() {
  const rows = await B.sbOrThrow("/rest/v1/clients?select=email&email_consent=eq.false&limit=20000").catch(() => []);
  return new Set((Array.isArray(rows) ? rows : []).map(r => clean(r?.email, 160).toLowerCase()).filter(Boolean));
}

// Pure: who WOULD get the email for these pools. Used by the dry run and by the runner.
function plan(rows, { pools = POOLS, optedOut = new Set(), nowMs = Date.now(), maxAgeDays = null, campaignId = DEFAULT_CAMPAIGN_ID, reengageSince = "", includeBooked = false } = {}) {
  const wanted = new Set(pools);
  const reachedEmails = new Set(rows.filter(r => reachedBy(r, campaignId)).map(emailOf).filter(Boolean));
  const reengaged = row => {
    const rec = rawOf(row).pipeline?.reengage;
    if (!rec) return false;
    return !reengageSince || String(rec.at || "") >= reengageSince;
  };
  const reengagedEmails = new Set(rows.filter(reengaged).map(emailOf).filter(Boolean));
  const perPool = Object.fromEntries(POOLS.map(pool => [pool, { leads: 0, with_email: 0, eligible: 0, eligible_people: 0, already_got_7am: 0, eligible_people_not_7am: 0 }]));
  const eligibleRows = [];
  const poolPeople = Object.fromEntries(POOLS.map(pool => [pool, new Set()]));
  for (const lead of rows) {
    if (rawOf(lead).qa === true || String(lead.status || "") === "site_visit") continue;
    const inPools = poolsOf(lead);
    const email = emailOf(lead);
    const why = exclusionReason(lead, { optedOut, nowMs, maxAgeDays, includeBooked });
    for (const pool of inPools) {
      const s = perPool[pool];
      s.leads += 1;
      if (email && emailOk(email)) s.with_email += 1;
      if (!why) { s.eligible += 1; poolPeople[pool].add(email); }
    }
    if (!why && inPools.some(pool => wanted.has(pool))) eligibleRows.push(lead);
  }
  for (const pool of POOLS) {
    const people = poolPeople[pool];
    perPool[pool].eligible_people = people.size;
    perPool[pool].already_got_7am = [...people].filter(e => reengagedEmails.has(e)).length;
    perPool[pool].eligible_people_not_7am = perPool[pool].eligible_people - perPool[pool].already_got_7am;
  }
  const byEmail = dedupeByEmail(eligibleRows);
  const recipients = [...byEmail.values()].filter(lead => !reachedEmails.has(emailOf(lead)));
  return {
    per_pool: perPool,
    union: {
      eligible_rows: eligibleRows.length,
      people: byEmail.size,
      already_emailed_this_campaign: [...byEmail.keys()].filter(e => reachedEmails.has(e)).length,
      already_got_7am: [...byEmail.keys()].filter(e => reengagedEmails.has(e)).length,
      would_send: recipients.length,
      would_send_not_7am: recipients.filter(l => !reengagedEmails.has(emailOf(l))).length
    },
    recipients
  };
}

// ---------------------------------------------------------------------------
// One person: claim first, then send, then record. Never throws.
// ---------------------------------------------------------------------------
async function sendOne({ lead, campaignId, config, settings, by = "email_campaign" }) {
  const base = { campaign: campaignId, at: new Date().toISOString(), by };
  let claimed = false;
  const saved = await P.mergePipelineRecord(lead.id, pipeline => {
    claimed = false;
    const all = pipeline.email_campaigns && typeof pipeline.email_campaigns === "object" ? pipeline.email_campaigns : {};
    if (all[campaignId]) return pipeline;
    claimed = true;
    return { ...pipeline, email_campaigns: { ...all, [campaignId]: { status: "sending", at: base.at, by } } };
  }).catch(() => null);
  if (!saved || !claimed) return { ...base, status: "skipped", reason: "Already emailed with this campaign. It never goes twice." };
  let result;
  try {
    const link = await P.reengageBookingLink(lead, { noZip: "contact" });
    const pick = P.clientEmailFor(lead, settings);
    if (!pick.ok) result = { status: "skipped", reason: pick.reason };
    else {
      const mail = renderEmail({ firstName: lead.first_name, link: link.url });
      const subject = `${isSandbox() ? "[PRACTICE COPY] " : ""}${mail.subject}`;
      const sent = await M.sendViaResend({ to: [pick.email], subject, html: mail.html, text: mail.text, idempotencyKey: `campaign:${campaignId}:${emailOf(lead) || lead.id}` }, config);
      result = sent.ok
        ? { status: "sent", resend_id: sent.id, to_masked: P.maskEmail(pick.email), link: link.url, link_kind: link.kind }
        : { status: sent.waiting ? "skipped" : "failed", reason: clean(sent.message, 300), link: link.url };
    }
  } catch (error) {
    result = { status: "failed", reason: clean(error?.message || error, 300) };
  }
  await P.mergePipelineRecord(lead.id, pipeline => {
    const all = pipeline.email_campaigns && typeof pipeline.email_campaigns === "object" ? pipeline.email_campaigns : {};
    return { ...pipeline, email_campaigns: { ...all, [campaignId]: { ...(all[campaignId] || {}), ...base, ...result } } };
  }).catch(error => console.error("email_campaign_record_failed", String(error?.message || error)));
  return { ...base, ...result };
}

function resumeState(value, nowMs) {
  const v = value && typeof value === "object" ? value : {};
  if (v.armed === true) return { resume: false };
  if (v.status !== "incomplete") return { resume: false };
  if (v.resume === false) return { resume: false };
  const sendAt = Date.parse(String(v.send_at || ""));
  if (!Number.isFinite(sendAt) || nowMs < sendAt || nowMs - sendAt > RESUME_WINDOW_MS) return { resume: false };
  return { resume: true };
}

// The cron's entry point (api/cron/auto-followups.js, */15). Not armed (the shipped state) = a one-line no-op.
async function runEmailCampaign({ nowMs = Date.now(), clock = () => Date.now(), budgetMs = BUDGET_MS, paceMs = PACE_MS } = {}) {
  const started = clock();
  let row;
  try {
    row = (await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&select=key,value,updated_at&limit=1`))?.[0] || null;
  } catch (error) {
    return { armed: false, message: `The email campaign settings could not be read: ${clean(error?.message || error, 200)}` };
  }
  if (!row) return { armed: false, message: "No email_campaign key: nothing to do (kill switch)." };
  const campaign = normalizeCampaign(row.value);
  const resuming = !campaign.armed && resumeState(row.value, nowMs).resume;
  if (!campaign.armed && !resuming) return { armed: false, message: "email_campaign is not armed." };
  if (!campaign.pools.length) return { armed: false, message: "email_campaign has no pools: nothing sent." };
  if (!campaign.send_at || nowMs < Date.parse(campaign.send_at)) return { armed: true, waiting: true, message: `Armed, waiting for ${campaign.send_at || "a send_at time"}.` };

  // DISARM FIRST (version-guarded): the claim is the kill switch.
  const prior = row.value && typeof row.value === "object" ? row.value : {};
  const claim = await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&updated_at=eq.${encodeURIComponent(row.updated_at)}`, {
    // site_settings has no updated_at trigger: the claim moves updated_at itself, so a racing tick's guard fails.
    method: "PATCH", prefer: "return=representation", body: { value: { ...prior, armed: false, status: "running", run_started_at: new Date(nowMs).toISOString() }, updated_at: new Date().toISOString() }
  }).catch(() => null);
  if (!claim?.[0]) return { armed: true, message: "Another run claimed this campaign first. Nothing sent here." };

  const settings = await P.loadSettings().catch(() => null);
  const config = { ...(await M.officeResendConfig().catch(() => M.resendConfig())), paceMs, retry429: RETRY_429 };
  const rows = await loadLeads();
  const optedOut = await loadOptedOut();
  const { recipients } = plan(rows, { pools: campaign.pools, optedOut, nowMs, maxAgeDays: campaign.max_age_days, campaignId: campaign.campaign_id, includeBooked: campaign.include_booked });
  const list = isSandbox() ? recipients.slice(0, PRACTICE_MAX) : recipients;
  const sent = [];
  const skipped = [];
  let remaining = 0;
  for (const lead of list) {
    if (clock() - started >= budgetMs) { remaining += 1; continue; }
    const result = await sendOne({ lead, campaignId: campaign.campaign_id, config, settings });
    (result.status === "sent" ? sent : skipped).push({ lead: lead.id, status: result.status, ...(result.reason ? { reason: clean(result.reason, 160) } : {}) });
  }
  const summary = { at: new Date().toISOString(), pools: campaign.pools, campaign_id: campaign.campaign_id, max_age_days: campaign.max_age_days,
    planned: list.length, sent: sent.length, skipped: skipped.length, remaining, resumed: resuming, details: [...sent, ...skipped].slice(0, 300) };
  const current = await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&select=value&limit=1`).catch(() => null);
  const baseValue = current?.[0]?.value && typeof current[0].value === "object" ? current[0].value : prior;
  const stopped = baseValue.status === "stopped" || baseValue.resume === false;
  await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}`, {
    method: "PATCH", prefer: "return=minimal",
    body: { value: { ...baseValue, armed: false, status: stopped ? "stopped" : remaining ? "incomplete" : "done", run_started_at: undefined, last_run: summary } }
  }).catch(error => console.error("email_campaign_summary_failed", String(error?.message || error)));
  return { armed: true, ran: true, ...summary };
}

// The Super Admin's read-only dry run and preview (api/pipeline.js). Nothing is written.
async function dryRun({ pools = POOLS, maxAgeDays = null, nowMs = Date.now(), reengageSince = "", includeBooked = false } = {}) {
  const rows = await loadLeads();
  const optedOut = await loadOptedOut();
  const row = (await B.sbOrThrow(`/rest/v1/site_settings?key=eq.${KEY}&select=value&limit=1`).catch(() => null))?.[0] || null;
  const campaign = normalizeCampaign(row?.value);
  const result = plan(rows, { pools, optedOut, nowMs, maxAgeDays, campaignId: campaign.campaign_id, reengageSince, includeBooked });
  const ebookAnyPage = rows.filter(r => rawOf(r).qa !== true && String(r.status || "") !== "site_visit" && isEbook(r)).length;
  return { pools, pool_labels: POOL_LABELS, max_age_days: maxAgeDays, total_leads: rows.length, ebook_any_page: ebookAnyPage, opted_out: optedOut.size, campaign: { ...campaign, stored: Boolean(row) },
    per_pool: result.per_pool, union: result.union, sample_ids: result.recipients.slice(0, 5).map(l => l.id) };
}

async function preview(leadId) {
  const lead = (await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&select=${LEAD_FIELDS}&limit=1`))?.[0];
  if (!lead) return null;
  const link = await P.reengageBookingLink(lead, { noZip: "contact" });
  return { lead_id: lead.id, pools: poolsOf(lead), excluded: exclusionReason(lead) || "", link: link.url, link_kind: link.kind, ...renderEmail({ firstName: lead.first_name, link: link.url }) };
}

module.exports = {
  KEY, DEFAULT_CAMPAIGN_ID, SUBJECT, POOLS, POOL_LABELS, EXCLUDED_STATUSES, BOOKED_STATUSES, BUTTON_1, BUTTON_2, SIGNATURE,
  isPaidAd, isEbook, poolsOf, exclusionReason, dedupeByEmail, renderEmail, normalizeCampaign, plan, sendOne,
  runEmailCampaign, dryRun, preview, resumeState
};
