// Follow-up texts to leads that did not book (Joshua 2026-09-14). SAVED, NOT SENDING. DO-NOT-BREAK rule 81.
// "Don't send to anybody now because we are building in sandbox, but save this."
//
// Who: a lead with SMS consent that has not booked (or requested) an evaluation, still open
// (new_inquiry / office_contacted / engaged_no_outcome), with a phone, and not in the recruiting or
// office-call lane. When: 15 minutes, 40 minutes, 24 hours and 48 hours after the lead came in. Texts
// that would land between 9 PM and 8 AM Eastern wait until 8 AM (meeting 2026-09-11: quiet hours).
// The backlog (Joshua: "the 95 leads sitting in the admin portal that consented") = the same leads
// older than 48 hours; each would get the text once when sending is switched on.
//
// There is NO send code in this file on purpose. Sending needs Joshua's go, its own Make route with the
// tester filter (rules 72-73), and the "Reply YES" answer handled. Until then this only PLANS and PREVIEWS.
const SENDING_ENABLED = false;
const SENDER_NAME = "Tim";
const FOLLOW_UP_TEXT = "Hi {{first_name}}, this is {{sender_name}} with Lorenzo's Dog Training Team. You reached out to us through our website for help with your dog, and I wanted to connect with you.\n\nAre you looking for help with training your dog? If so, reply YES and I will help you get started.";
// Toll-free customer-care texts carry an opt-out line (the booking-link text does too).
const OPT_OUT_LINE = "Reply STOP to opt out.";
const STEPS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 40, label: "40 minutes" },
  { minutes: 24 * 60, label: "24 hours" },
  { minutes: 48 * 60, label: "48 hours" }
];
const OPEN_STATUSES = ["new_inquiry", "office_contacted", "engaged_no_outcome"];
const QUIET_START_HOUR = 21; // 9 PM Eastern
const QUIET_END_HOUR = 8;    // 8 AM Eastern

const rawOf = row => (row?.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {});
const firstName = row => String(row?.first_name || "").trim().split(/\s+/)[0] || "there";

function textFor(row, sender = SENDER_NAME) {
  return `${FOLLOW_UP_TEXT.replace("{{first_name}}", firstName(row)).replace("{{sender_name}}", sender)}\n\n${OPT_OUT_LINE}`;
}

function easternHour(ms) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date(ms)));
}

// Moves a time inside quiet hours to the next 8 AM Eastern (hour steps, so it works across DST).
function outOfQuietHours(ms) {
  let at = ms;
  for (let i = 0; i < 12; i += 1) {
    const hour = easternHour(at);
    if (hour >= QUIET_END_HOUR && hour < QUIET_START_HOUR) return at;
    at = (Math.floor(at / 3600000) + 1) * 3600000; // next whole hour
  }
  return at;
}

// Why a lead would or would not get these texts. Decided from the row alone; nothing is written.
function eligibility(row) {
  const raw = rawOf(row);
  if (raw.qa === true) return { ok: false, reason: "Test record." };
  if (row?.sms_consent !== true) return { ok: false, reason: "No SMS consent." };
  if (!String(row?.phone || "").replace(/\D/g, "")) return { ok: false, reason: "No phone." };
  if (!OPEN_STATUSES.includes(String(row?.status || ""))) return { ok: false, reason: "Not an open inquiry." };
  const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
  if (booking.slot_start || booking.requested_at) return { ok: false, reason: "Already booked or requested." };
  const lane = raw.pipeline?.lane?.key;
  if (lane && lane !== "booking") return { ok: false, reason: `Lane: ${raw.pipeline.lane.label || lane}.` };
  if (raw.lead_type === "pdf_download") return { ok: false, reason: "Free booklet request." };
  return { ok: true };
}

// The next text this lead would get. new = inside its first 48 hours; backlog = older, gets it once.
function plan(row, nowMs = Date.now()) {
  const allowed = eligibility(row);
  if (!allowed.ok) return { group: null, reason: allowed.reason };
  const created = Date.parse(row.created_at || "");
  if (!Number.isFinite(created)) return { group: null, reason: "No received time." };
  const due = STEPS.map((step, i) => ({ step: i + 1, label: step.label, at: outOfQuietHours(created + step.minutes * 60000) }));
  const next = due.find(item => item.at >= nowMs);
  if (next) return { group: "new", next: { step: next.step, label: next.label, at: new Date(next.at).toISOString() } };
  return { group: "backlog", next: { step: 1, label: "once, when sending is switched on", at: null } };
}

function preview(rows = [], nowMs = Date.now(), { sample = 25 } = {}) {
  const counts = { new: 0, backlog: 0, backlog_contacted: 0, not_eligible: 0 };
  const reasons = {};
  const list = [];
  for (const row of rows) {
    const p = plan(row, nowMs);
    if (!p.group) { counts.not_eligible += 1; reasons[p.reason] = (reasons[p.reason] || 0) + 1; continue; }
    counts[p.group] += 1;
    if (p.group === "backlog" && row.status === "office_contacted") counts.backlog_contacted += 1;
    if (list.length < sample) list.push({ name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "No name", status: row.status, received: row.created_at, group: p.group, next: p.next });
  }
  return {
    sending: SENDING_ENABLED, sender: SENDER_NAME, text: FOLLOW_UP_TEXT.replace("{{sender_name}}", SENDER_NAME), opt_out: OPT_OUT_LINE,
    steps: STEPS.map(s => s.label), quiet_hours: "9 PM to 8 AM Eastern", counts, reasons, sample: list
  };
}

module.exports = { SENDING_ENABLED, SENDER_NAME, FOLLOW_UP_TEXT, OPT_OUT_LINE, STEPS, OPEN_STATUSES, textFor, eligibility, plan, preview, outOfQuietHours };
