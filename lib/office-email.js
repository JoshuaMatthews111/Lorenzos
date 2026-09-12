// The office booking email (portal chain step 3b, Joshua 2026-09-12, DO-NOT-BREAK rule 73).
//
// JOSHUA, EXPLICITLY: "Do not break the form submit. Resend is for the SALES PIPELINE. FormSubmit is for
// the current Contact page." So this file sends ONLY through Resend (https://api.resend.com/emails, from
// RESEND_FROM, key RESEND_API_KEY). It never calls FormSubmit, /api/form-delivery or any other mailer.
// With no RESEND_API_KEY it sends nothing: lib/pipeline.js keeps the email QUEUED on the lead and sends it
// once the key is present (next booking, or "Send queued office emails" in the portal).
//
// The key lives only in the Vercel env (never in git, never in the browser, never logged).
const DEFAULT_FROM = "Lorenzo's Dog Training Team <no-reply@lorenzosdogtrainingteam.com>";
const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8000;

function resendConfig(env = process.env) {
  const key = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.RESEND_FROM || "").trim() || DEFAULT_FROM;
  return { ready: Boolean(key), key, from };
}

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const txt = value => String(value ?? "").trim();

const DOG_LABELS = [
  ["name", "Dog name"], ["sex", "Sex"], ["fixed", "Spayed/Neutered?"], ["vaccinated", "Vaccinations up to date?"],
  ["age", "Age"], ["breed", "Breed"], ["behavior", "Behavioral challenges"]
];

// Rule 75: a dog's rows = the 7 Alpha answers + any question the office added for each dog.
function dogRowsOf(dog) {
  const custom = Array.isArray(dog?.custom) ? dog.custom.map(x => [txt(x?.label), x?.value]) : [];
  return [...DOG_LABELS.map(([k, label]) => [label, dog?.[k]]), ...custom];
}
// Rule 75: office-added questions. Booking page: booking.client_custom. Website forms: "Extra: <question>" on the lead.
function extraRowsOf(booking, raw) {
  const fromBooking = Array.isArray(booking?.client_custom) ? booking.client_custom.map(x => [txt(x?.label), x?.value]) : [];
  const fromForm = Object.entries(raw || {}).filter(([k]) => k.startsWith("Extra: ")).map(([k, v]) => [k.slice(7), v]);
  return [...fromBooking, ...fromForm].filter(([k, v]) => k && txt(v));
}

// Everything the office needs to log the client into Alpha, in one email.
function buildBookingEmail({ lead = {}, booking = {}, trainerName = "", staffLink = "", lane = null, practice = false, redirectedFrom = [], kind = "" }) {
  if (kind === "trainer_request" || kind === "no_trainer") return buildRequestEmail({ lead, booking, trainerName, staffLink, practice, redirectedFrom, kind });
  const raw = lead.raw_payload && typeof lead.raw_payload === "object" ? lead.raw_payload : {};
  const client = booking.client || {};
  const dogs = Array.isArray(booking.dogs) ? booking.dogs : [];
  const clientName = [client.first_name || lead.first_name, client.last_name || lead.last_name].filter(Boolean).join(" ") || "New client";
  const when = txt(booking.when_label) || txt(booking.slot_start);
  const trainer = txt(trainerName || booking.trainer_name || booking.trainer_slug) || "the trainer";
  const subject = `${practice ? "[PRACTICE COPY] " : ""}Eval booked: ${clientName} with ${trainer}, ${when}`.slice(0, 250);
  const instruction = "Log this client into Alpha, then open the staff portal and mark this lead \"Added to Alpha\".";

  const clientRows = [
    ["First and last name", clientName],
    ["Phone", client.phone || lead.phone],
    ["Email", client.email || lead.email],
    ["Physical address", client.address || lead.address_line_1]
  ];
  const bookingRows = [
    ["Booked time", when],
    ["Trainer", trainer],
    ["Where", booking.location_label || "In-home"],
    ["Length", booking.slot_minutes ? `${booking.slot_minutes} minutes` : ""]
  ];
  const leadRows = [
    ["Came in from", raw.source_page || lead.source_page],
    ["ZIP", lead.zip || raw.zip],
    ["I want to...", raw.i_want_to || ""],
    ["Pipeline lane", lane?.label || ""],
    ["What they asked about", lead.comments || raw.comments || raw.problem || ""],
    ["SMS consent", lead.sms_consent === true ? "Yes" : "No"],
    ["Request received", lead.created_at || ""],
    ["Lead id", lead.id]
  ];
  const table = rows => `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;font:14px/1.4 Arial,sans-serif">${rows
    .filter(([, v]) => txt(v))
    .map(([k, v]) => `<tr><td style="border:1px solid #ddd;background:#f6f6f6;width:38%;vertical-align:top"><strong>${esc(k)}</strong></td><td style="border:1px solid #ddd;vertical-align:top;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join("")}</table>`;
  const dogBlocks = dogs.map((dog, i) => `<h3 style="font:bold 15px Arial,sans-serif;margin:18px 0 6px">Dog ${i + 1}${dogs.length > 1 ? ` of ${dogs.length}` : ""}</h3>${table(dogRowsOf(dog))}`).join("");
  const extraRows = extraRowsOf(booking, raw);
  const extraBlock = extraRows.length ? `<h2 style="font:bold 17px Arial,sans-serif;margin:16px 0 6px">Extra questions</h2>${table(extraRows)}` : "";
  const practiceNote = practice
    ? `<p style="font:13px Arial,sans-serif;background:#fff4d6;border:1px solid #e8c66a;padding:8px">PRACTICE COPY. This booking was made on the practice copy (ldtt-sandbox), not by a real customer.${redirectedFrom.length ? ` It went to the practice test address instead of the office list (${esc(redirectedFrom.join(", "))}).` : ""}</p>`
    : "";
  const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#111">${practiceNote}
<p style="font:bold 16px Arial,sans-serif;background:#d80f35;color:#fff;padding:10px 12px;margin:0 0 12px">${esc(instruction)}</p>
<p>${staffLink ? `<a href="${esc(staffLink)}" style="display:inline-block;background:#0b2a4a;color:#fff;padding:10px 14px;text-decoration:none;border-radius:4px">Open this lead in the staff portal</a><br><span style="font-size:12px;color:#555">${esc(staffLink)}</span>` : ""}</p>
<h2 style="font:bold 17px Arial,sans-serif;margin:16px 0 6px">Evaluation booked online</h2>${table(bookingRows)}
<p style="font-size:13px;color:#555">Nothing was booked in Google. The trainer or TC reserves this time in Google.</p>
<h2 style="font:bold 17px Arial,sans-serif;margin:16px 0 6px">Client</h2>${table(clientRows)}
${dogBlocks}${extraBlock}
<h2 style="font:bold 17px Arial,sans-serif;margin:16px 0 6px">Lead details</h2>${table(leadRows)}
<p style="font-size:12px;color:#777">Sent by the LDTT sales pipeline through Resend. The new-lead emails from the website forms are separate and unchanged.</p></div>`;

  const lines = [
    practice ? `PRACTICE COPY: booked on the practice copy, not by a real customer.${redirectedFrom.length ? ` Sent to the practice test address instead of: ${redirectedFrom.join(", ")}.` : ""}` : "",
    `>> ${instruction}`,
    staffLink ? `Open the lead: ${staffLink}` : "",
    "",
    "EVALUATION BOOKED ONLINE",
    ...bookingRows.filter(([, v]) => txt(v)).map(([k, v]) => `${k}: ${v}`),
    "Nothing was booked in Google. The trainer or TC reserves this time in Google.",
    "",
    "CLIENT",
    ...clientRows.filter(([, v]) => txt(v)).map(([k, v]) => `${k}: ${v}`),
    ...dogs.flatMap((dog, i) => ["", `DOG ${i + 1}`, ...dogRowsOf(dog).filter(([, v]) => txt(v)).map(([label, v]) => `${label}: ${v}`)]),
    ...(extraRows.length ? ["", "EXTRA QUESTIONS", ...extraRows.map(([k, v]) => `${k}: ${v}`)] : []),
    "",
    "LEAD DETAILS",
    ...leadRows.filter(([, v]) => txt(v)).map(([k, v]) => `${k}: ${v}`)
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "");
  return { subject, html, text: lines.join("\n").trim() };
}

// Step 3c (rule 74): the two booking-page notices that are NOT a booked time.
//   trainer_request: the client picked a trainer with no online calendar yet -> the office schedules them.
//   no_trainer: no trainer within 50 miles of the client's ZIP -> the office calls back and matches a trainer.
function buildRequestEmail({ lead = {}, booking = {}, trainerName = "", staffLink = "", practice = false, redirectedFrom = [], kind }) {
  const raw = lead.raw_payload && typeof lead.raw_payload === "object" ? lead.raw_payload : {};
  const request = kind === "trainer_request";
  const client = request ? (booking.client || {}) : {};
  const dogs = request && Array.isArray(booking.dogs) ? booking.dogs : [];
  const clientName = [client.first_name || lead.first_name, client.last_name || lead.last_name].filter(Boolean).join(" ") || "New client";
  const trainer = txt(trainerName || booking.trainer_name || booking.trainer_slug) || "the trainer";
  const zip = txt(booking.callback?.zip || booking.zip || lead.zip);
  const prefix = practice ? "[PRACTICE COPY] " : "";
  const subject = (request
    ? `${prefix}Trainer requested: ${clientName} wants ${trainer}. Please schedule the eval`
    : `${prefix}Callback needed: ${clientName}, no trainer within 50 miles of ZIP ${zip}`).slice(0, 250);
  const instruction = request
    ? `Call this client and schedule the free evaluation with ${trainer} (no online calendar yet). Then log them into Alpha and mark this lead "Added to Alpha".`
    : `Call this client back: no trainer is within 50 miles of ZIP ${zip}. Match them with a trainer.`;
  const heading = request ? "Client asked for this trainer" : "No trainer within 50 miles";
  const note = request
    ? "No day or time was booked: this trainer has no online calendar yet, so the office picks the time with the client."
    : "The client asked for a callback on the booking page.";
  const topRows = request
    ? [["Requested trainer", trainer], ["Where", booking.location_label || "In-home"], ["Client ZIP", zip]]
    : [["Client ZIP", zip], ["Asked for a callback", booking.callback?.requested_at || ""]];
  const clientRows = [
    ["First and last name", clientName],
    ["Phone", client.phone || booking.callback?.phone || lead.phone],
    ["Email", client.email || lead.email],
    ["Physical address", client.address || lead.address_line_1]
  ];
  const leadRows = [
    ["Came in from", raw.source_page || lead.source_page],
    ["What they asked about", lead.comments || raw.comments || raw.problem || ""],
    ["SMS consent", lead.sms_consent === true ? "Yes" : "No"],
    ["Request received", lead.created_at || ""],
    ["Lead id", lead.id]
  ];
  const table = rows => `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;font:14px/1.4 Arial,sans-serif">${rows
    .filter(([, v]) => txt(v))
    .map(([k, v]) => `<tr><td style="border:1px solid #ddd;background:#f6f6f6;width:38%;vertical-align:top"><strong>${esc(k)}</strong></td><td style="border:1px solid #ddd;vertical-align:top;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join("")}</table>`;
  const dogBlocks = dogs.map((dog, i) => `<h3 style="font:bold 15px Arial,sans-serif;margin:18px 0 6px">Dog ${i + 1}${dogs.length > 1 ? ` of ${dogs.length}` : ""}</h3>${table(dogRowsOf(dog))}`).join("");
  const extraRows = extraRowsOf(request ? booking : {}, raw);
  const extraBlock = extraRows.length ? `<h2 style="font:bold 17px Arial,sans-serif;margin:16px 0 6px">Extra questions</h2>${table(extraRows)}` : "";
  const practiceNote = practice
    ? `<p style="font:13px Arial,sans-serif;background:#fff4d6;border:1px solid #e8c66a;padding:8px">PRACTICE COPY. This came from the practice copy (ldtt-sandbox), not a real customer.${redirectedFrom.length ? ` It went to the practice test address instead of the office list (${esc(redirectedFrom.join(", "))}).` : ""}</p>`
    : "";
  const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#111">${practiceNote}
<p style="font:bold 16px Arial,sans-serif;background:#d80f35;color:#fff;padding:10px 12px;margin:0 0 12px">${esc(instruction)}</p>
<p>${staffLink ? `<a href="${esc(staffLink)}" style="display:inline-block;background:#0b2a4a;color:#fff;padding:10px 14px;text-decoration:none;border-radius:4px">Open this lead in the staff portal</a><br><span style="font-size:12px;color:#555">${esc(staffLink)}</span>` : ""}</p>
<h2 style="font:bold 17px Arial,sans-serif;margin:16px 0 6px">${esc(heading)}</h2>${table(topRows)}
<p style="font-size:13px;color:#555">${esc(note)}</p>
<h2 style="font:bold 17px Arial,sans-serif;margin:16px 0 6px">Client</h2>${table(clientRows)}
${dogBlocks}${extraBlock}
<h2 style="font:bold 17px Arial,sans-serif;margin:16px 0 6px">Lead details</h2>${table(leadRows)}
<p style="font-size:12px;color:#777">Sent by the LDTT sales pipeline through Resend. The new-lead emails from the website forms are separate and unchanged.</p></div>`;
  const lines = [
    practice ? `PRACTICE COPY: from the practice copy, not a real customer.${redirectedFrom.length ? ` Sent to the practice test address instead of: ${redirectedFrom.join(", ")}.` : ""}` : "",
    `>> ${instruction}`,
    staffLink ? `Open the lead: ${staffLink}` : "",
    "",
    heading.toUpperCase(),
    ...topRows.filter(([, v]) => txt(v)).map(([k, v]) => `${k}: ${v}`),
    note,
    "",
    "CLIENT",
    ...clientRows.filter(([, v]) => txt(v)).map(([k, v]) => `${k}: ${v}`),
    ...dogs.flatMap((dog, i) => ["", `DOG ${i + 1}`, ...dogRowsOf(dog).filter(([, v]) => txt(v)).map(([label, v]) => `${label}: ${v}`)]),
    ...(extraRows.length ? ["", "EXTRA QUESTIONS", ...extraRows.map(([k, v]) => `${k}: ${v}`)] : []),
    "",
    "LEAD DETAILS",
    ...leadRows.filter(([, v]) => txt(v)).map(([k, v]) => `${k}: ${v}`)
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "");
  return { subject, html, text: lines.join("\n").trim() };
}

// One Resend call. Never throws: answers { ok, id, status, message }.
async function sendViaResend({ to, subject, html, text, idempotencyKey }, config = resendConfig()) {
  if (!config.ready) return { ok: false, status: 0, waiting: true, message: "Waiting for the Track 500 Resend key (RESEND_API_KEY is not set)." };
  const recipients = (Array.isArray(to) ? to : [to]).map(txt).filter(Boolean);
  if (!recipients.length) return { ok: false, status: 0, message: "No office email addresses are saved." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": String(idempotencyKey).slice(0, 256) } : {})
      },
      body: JSON.stringify({ from: config.from, to: recipients, subject, html, text }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.id) {
      return { ok: false, status: response.status, message: String(data?.message || data?.error?.message || data?.name || `Resend answered ${response.status}.`).slice(0, 300) };
    }
    return { ok: true, status: response.status, id: data.id };
  } catch (error) {
    return { ok: false, status: 0, message: error?.name === "AbortError" ? "Resend did not answer in time." : String(error?.message || error).slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { DEFAULT_FROM, RESEND_URL, resendConfig, buildBookingEmail, buildRequestEmail, sendViaResend };
