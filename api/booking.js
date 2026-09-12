// Online booking API (portal chain step 2 + step 3c, Joshua 2026-09-12, DO-NOT-BREAK rules 71 + 74).
// PRACTICE COPY ONLY this round: answers 404 on live, before anything else.
//
//   GET  ?zip=<5 digits>[&lead=<id>]   step 1 (rule 74): every listed trainer whose Base ZIP is within
//        50 miles, nearest first, as picture cards (photo, name, market, miles, calendar yes/no). With a
//        lead id the ZIP comes from the lead and the page gets the prefill (and "already booked" state).
//   GET  ?trainer=<slug>[&lead=<id>]   step 3: the trainer's REAL free times from Google (read-only
//        ListAvailableSlots, 60 s cache) minus times already held here, minus the next hour.
//   POST {trainer_slug, slot_start, lead_id?, location, client{...}, dogs[...]}   book a picked time:
//        re-checks Google (fresh), HOLDS it in booking_holds (one hold per trainer + time; the same time
//        again answers 409), moves the lead to Eval Scheduled with the eval time on the card (Leads AND
//        Sales "Booked": raw_payload.sales_pipeline = true), keeps every eval answer in raw_payload.booking.
//   POST {op:"request", trainer_slug, ...same form}   a trainer with NO calendar yet: the lead goes to the
//        office's follow-up with the chosen trainer and every answer. NOT Eval Scheduled (no time picked).
//   POST {op:"callback", zip, client{first_name,last_name,phone,email}, lead_id?}   no trainer within
//        50 miles: the office is told to call back.
// NEVER books in Google. The trainer / TC reserves the time in Google themselves.
const { isSandbox } = require("../lib/sandbox");
const B = require("../lib/booking");
const P = require("../lib/pipeline");
const LF = require("../lib/lead-forms"); // rule 75: the booking questions come from the form editor

// Rule 75: the published booking questions (null on any trouble -> the original 11, all required).
const bookingQuestions = () => LF.loadPublishedFields(B.sbOrThrow, "booking_eval");

// Rule 75: a question the office removed comes back blank. A blank answer never wipes what the lead
// already has (the name, phone and email it came in with stay). With every question asked (the original
// form) this is exactly the old update.
function answeredContact(client, dogs) {
  const names = dogs.map(d => d.name).filter(Boolean).join(", ");
  const breeds = dogs.map(d => d.breed).filter(Boolean).join(", ");
  return {
    ...(client.first_name ? { first_name: client.first_name } : {}),
    ...(client.last_name ? { last_name: client.last_name } : {}),
    ...(client.phone ? { phone: client.phone } : {}),
    ...(client.email ? { email: client.email } : {}),
    ...(client.address ? { address_line_1: client.address } : {}),
    ...(names ? { dog_name: names } : {}),
    ...(breeds ? { dog_breed: breeds } : {})
  };
}

const OFFICE_PHONE = "(866) 436-4959";
const LEAD_SELECT = "id,first_name,last_name,email,phone,zip,dog_name,status,version,raw_payload,trainer_slug,eval_scheduled_at,source_page,trainer_market,address_line_1";

const slotForClient = slot => ({ start: slot.start, minutes: slot.minutes });
const marketLabel = B.marketLabel;
const rawOf = row => (row?.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {});

function parseStart(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value > 1e12 ? value / 1000 : value);
  const text = String(value ?? "").trim();
  if (/^\d{9,13}$/.test(text)) return Math.round(Number(text) > 1e12 ? Number(text) / 1000 : Number(text));
  const date = new Date(text);
  return text && !Number.isNaN(date.getTime()) ? Math.round(date.getTime() / 1000) : 0;
}

async function getLead(id) {
  return (await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(id)}&select=${LEAD_SELECT}&limit=1`))?.[0] || null;
}

function prefillOf(row) {
  const dogs = rawOf(row).booking?.dogs;
  return {
    first_name: row.first_name || "", last_name: row.last_name || "", phone: row.phone || "", email: row.email || "",
    address: row.address_line_1 || "", dog_name: Array.isArray(dogs) ? "" : (row.dog_name || ""),
    zip: B.digits(row.zip).slice(0, 5)
  };
}

const safePhoto = url => (/^(https:\/\/|\/(?!\/))/.test(String(url || "")) ? String(url) : "");

// What the congratulations screen needs when a lead that already booked / requested opens its link again.
async function leadOutcome(row) {
  const booking = rawOf(row).booking || {};
  if (!booking.trainer_slug || !(booking.slot_start || booking.requested_at)) return null;
  const trainer = await B.trainerRow(booking.trainer_slug).catch(() => null);
  const base = {
    trainer_slug: booking.trainer_slug,
    trainer_name: booking.trainer_name || trainer?.full_name || booking.trainer_slug,
    trainer_first_name: String(booking.trainer_name || trainer?.full_name || "").split(" ")[0],
    trainer_photo: safePhoto(trainer?.headshot_url),
    trainer_market: trainer ? marketLabel(trainer) : "",
    location: booking.location || "",
    location_label: booking.location_label || "",
    address: booking.client?.address || row.address_line_1 || ""
  };
  if (booking.slot_start) {
    const holds = await B.activeHolds(booking.trainer_slug).catch(() => []);
    if (!holds.some(h => h.lead_id === row.id)) return null; // released: let them book again
    return { ...base, booked: true, slot_start: booking.slot_start, when: booking.when_label || B.formatWhen(booking.slot_start, booking.time_zone || "America/New_York") };
  }
  return { ...base, requested: true };
}

// Step 1 (rule 74): trainers within 50 miles of the ZIP, nearest first.
async function nearby(req, res) {
  const leadId = B.clean(req.query?.lead, 60);
  const row = B.UUID.test(leadId) ? await getLead(leadId) : null;
  const lead = row ? prefillOf(row) : null;
  const outcome = row ? await leadOutcome(row) : null;
  const zip = B.digits(req.query?.zip).slice(0, 5) || lead?.zip || "";
  const base = { ok: true, zip, radius: B.RADIUS_MILES, lead, outcome, office_phone: OFFICE_PHONE };
  if (!zip) return res.status(200).json({ ...base, trainers: [], need_zip: true });
  if (zip.length !== 5) return res.status(400).json({ ok: false, message: "Please enter your 5-digit ZIP code." });
  if (!B.centroid(zip)) return res.status(200).json({ ...base, trainers: [], unknown_zip: true, message: `We could not find ZIP code ${zip}. Please check it and try again.` });
  const settings = await B.loadSettings();
  const trainers = B.nearbyTrainers(zip, await B.listedTrainers(), settings).map(card => ({ ...card, photo: safePhoto(card.photo) }));
  return res.status(200).json({ ...base, trainers });
}

async function availability(req, res) {
  const slug = B.clean(req.query?.trainer, 80).toLowerCase();
  const settings = await B.loadSettings();
  const setting = B.settingBySlug(settings, slug);
  const trainer = setting ? await B.trainerRow(slug) : null;
  if (!setting || !trainer) return res.status(404).json({ ok: false, message: `This trainer does not take online bookings yet. Please call ${OFFICE_PHONE}.` });

  let slots = [];
  let calendarError = "";
  try { slots = await B.googleSlots(setting.schedule_id); }
  catch (error) {
    console.error("booking_calendar_failed", slug, String(error?.message || error));
    calendarError = `We could not load ${trainer.full_name.split(" ")[0]}'s calendar right now. Please try again in a minute or call ${OFFICE_PHONE}.`;
  }
  const holds = await B.activeHolds(slug);
  const open = B.openSlots(slots, holds);

  const leadId = B.clean(req.query?.lead, 60);
  let lead = null;
  let booked = null;
  if (B.UUID.test(leadId)) {
    const row = await getLead(leadId);
    if (row) {
      lead = prefillOf(row);
      const hold = holds.find(h => h.lead_id === row.id);
      if (hold) booked = { slot_start: hold.slot_start, when: B.formatWhen(hold.slot_start, setting.time_zone), location: rawOf(row).booking?.location_label || "" };
    }
  }

  return res.status(200).json({
    ok: true,
    trainer: { slug, name: trainer.full_name, first_name: trainer.full_name.split(" ")[0], market: marketLabel(trainer), photo: trainer.headshot_url || "" },
    time_zone: setting.time_zone,
    slot_minutes: setting.slot_minutes,
    locations: B.allowedLocations(setting),
    training_center_address: setting.training_center_address,
    slots: open.map(slotForClient),
    calendar_error: calendarError,
    lead,
    booked
  });
}

async function patchLeadWithRetry(lead, buildChanges) {
  let current = lead;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rows = await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(current.id)}&version=eq.${encodeURIComponent(current.version)}`, {
      method: "PATCH", prefer: "return=representation", body: buildChanges(current)
    });
    if (rows?.[0]) return rows[0];
    current = await getLead(current.id); // someone edited it a moment ago: read again, merge again
    if (!current) break;
  }
  throw new Error("The lead changed while booking. Please try again.");
}

// The lead for a booking-page submit: the one from the link, or a new practice lead from the form.
async function leadForForm({ leadId, client, dogs, slug, setting, trainer, zip, via }) {
  if (leadId) return getLead(leadId);
  const addressZip = (String(client.address || "").match(/\b(\d{5})(?:-\d{4})?\b/g) || []).pop()?.slice(0, 5) || "";
  const created = await B.createLead({
    // Rule 75: a removed first-name question -> the same stand-in the website forms use.
    intake: { first_name: client.first_name || LF.FALLBACKS.first_name, last_name: client.last_name, phone: client.phone, email: client.email, zip: B.digits(zip).slice(0, 5) || addressZip, problem: dogs[0]?.behavior?.slice(0, 300) || "", dog_name: dogs.map(d => d.name).join(", "), sms_consent: false, source_page: `book/${slug}` },
    setting, trainer, via
  });
  return getLead(created.lead.id);
}

async function book(req, res, body) {
  const slug = B.clean(body.trainer_slug, 80).toLowerCase();
  const settings = await B.loadSettings();
  const setting = B.settingBySlug(settings, slug);
  if (!setting) return res.status(404).json({ ok: false, message: `This trainer does not take online bookings yet. Please call ${OFFICE_PHONE}.` });
  const startSec = parseStart(body.slot_start);
  if (!startSec) return res.status(400).json({ ok: false, message: "Pick a time first." });
  const form = B.validateEvalForm(body, setting, await bookingQuestions());
  if (form.errors.length) return res.status(400).json({ ok: false, message: form.errors[0], errors: form.errors });
  const leadId = B.clean(body.lead_id, 60);
  if (leadId && !B.UUID.test(leadId)) return res.status(400).json({ ok: false, message: "That booking link is not complete. Please use the link from your text again." });

  let lead = leadId ? await getLead(leadId) : null;
  if (leadId && !lead) return res.status(404).json({ ok: false, message: `We could not find your request. Please call ${OFFICE_PHONE}.` });

  // Google is asked again right now (no cache), so a time taken in Google a minute ago is refused.
  let slots;
  try { slots = await B.googleSlots(setting.schedule_id, { fresh: true }); }
  catch { return res.status(503).json({ ok: false, message: `We could not reach the trainer's calendar. Please try again in a minute or call ${OFFICE_PHONE}.` }); }
  const open = B.openSlots(slots, await B.activeHolds(slug));
  const chosen = open.find(slot => slot.start === startSec);
  const taken = () => res.status(409).json({ ok: false, taken: true, message: "That time was just taken. Please pick another time.", slots: open.filter(s => s.start !== startSec).map(slotForClient) });
  if (!chosen) return taken();

  const trainer = await B.trainerRow(slug);
  const { client, dogs, location } = form.value;
  if (!lead) lead = await leadForForm({ leadId: "", client, dogs, slug, setting, trainer, zip: body.zip, via: "booking-page" });

  const slotIso = new Date(startSec * 1000).toISOString();
  const hold = await B.sb("/rest/v1/booking_holds", {
    method: "POST", prefer: "return=representation",
    body: { trainer_slug: slug, slot_start: slotIso, slot_minutes: chosen.minutes, lead_id: lead.id, location }
  });
  if (!hold.ok) {
    if (hold.status === 409 || hold.data?.code === "23505") return taken();
    throw new Error(hold.data?.message || `The time could not be held (${hold.status}).`);
  }
  const holdRow = hold.data?.[0] || {};
  const now = new Date().toISOString();
  const whenLabel = B.formatWhen(slotIso, setting.time_zone);
  const locationLabel = B.locationLabel(location, setting);

  let record;
  try {
    record = await patchLeadWithRetry(lead, current => {
      const raw = current.raw_payload && typeof current.raw_payload === "object" ? current.raw_payload : {};
      return {
        ...answeredContact(client, dogs),
        status: "evaluation_scheduled",
        eval_scheduled_at: slotIso,
        ...B.trainerFields(setting, trainer),
        raw_payload: {
          ...raw,
          ...(trainer?.market ? { trainer_market: trainer.market } : {}), // card market label (leadMarketLabel reads raw_payload)
          sales_pipeline: true,
          booking: {
            ...(raw.booking && typeof raw.booking === "object" ? raw.booking : {}),
            via: "online_booking",
            requested: undefined,
            requested_at: undefined, // a picked time replaces an earlier "request this trainer"
            trainer_slug: slug,
            trainer_name: trainer?.full_name || slug,
            slot_start: slotIso,
            slot_minutes: chosen.minutes,
            time_zone: setting.time_zone,
            when_label: whenLabel,
            location,
            location_label: locationLabel,
            client,
            client_custom: form.value.client_custom || undefined, // rule 75: office-added questions
            dogs,
            hold_id: holdRow.id || null,
            booked_at: now
          }
        }
      };
    });
  } catch (error) {
    // Never leave a time held for a lead that did not move.
    if (holdRow.id) await B.sb(`/rest/v1/booking_holds?id=eq.${encodeURIComponent(holdRow.id)}`, { method: "PATCH", prefer: "return=minimal", body: { status: "released", released_at: new Date().toISOString() } });
    throw error;
  }

  // A rebook releases this lead's earlier time, so it is offered to others again.
  if (holdRow.id) {
    await B.sb(`/rest/v1/booking_holds?lead_id=eq.${encodeURIComponent(lead.id)}&status=eq.held&id=neq.${encodeURIComponent(holdRow.id)}`, {
      method: "PATCH", prefer: "return=minimal", body: { status: "released", released_at: now }
    });
  }

  try {
    if (lead.status !== record.status) {
      await B.sbOrThrow("/rest/v1/lead_events", {
        method: "POST", prefer: "return=minimal",
        body: { lead_id: record.id, event_type: "status_changed", previous_status: lead.status, new_status: record.status, note: `Booked online with ${trainer?.full_name || slug}: ${whenLabel}.`, event_key: `lead:${record.id}:status:${record.version || now}`, occurred_at: now, raw_payload: { via: "online_booking", hold_id: holdRow.id || null } }
      });
      await B.sbOrThrow("/rest/v1/lifecycle_events?on_conflict=event_key", {
        method: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
        body: { event_key: `lead:${record.id}:evaluation_scheduled:${record.version || now}`, entity_type: "lead", entity_id: String(record.id), event_type: "evaluation_scheduled", market: record.trainer_market || null, source_page: record.source_page || null, raw_payload: { previous_status: lead.status, new_status: record.status, via: "online_booking" } }
      });
    }
  } catch (error) {
    console.error("booking_events_failed", String(error?.message || error));
  }

  // Step 3 (rule 72): Make pathway 2 (customer confirmation + trainer alert, tester phones only).
  // Step 3b (rule 73): the office booking email, RESEND ONLY, queued on the lead while RESEND_API_KEY is missing.
  // Never throws; what happened is kept in raw_payload.pipeline.booking_notices for the lead panel.
  await P.afterBooking({ lead: record, booking: record.raw_payload?.booking || {}, trainer, setting })
    .catch(error => console.error("pipeline_after_booking_failed", String(error?.message || error)));

  return res.status(200).json({
    ok: true,
    lead_id: record.id,
    eval_scheduled_at: slotIso,
    when: whenLabel,
    trainer_name: trainer?.full_name || slug,
    location: locationLabel,
    location_key: location,
    address: location === "training_center" ? (setting.training_center_address || B.TRAINING_CENTER_ADDRESS) : client.address
  });
}

// Step 3c (rule 74): "Request this trainer" for a trainer with no calendar link yet. The lead goes to the
// office's follow-up with the chosen trainer and every answer. It does NOT move to Eval Scheduled: only a
// real picked time does. No hold, no Google call, no text; the office gets the Resend email (queued without the key).
async function requestTrainer(req, res, body) {
  const slug = B.clean(body.trainer_slug, 80).toLowerCase();
  const settings = await B.loadSettings();
  if (B.settingBySlug(settings, slug)) return res.status(400).json({ ok: false, message: "This trainer takes online bookings. Please pick a time." });
  const trainer = /^[a-z0-9-]{2,80}$/.test(slug) ? await B.trainerRow(slug) : null;
  if (!trainer || trainer.status !== "active" || /^office-draft-/.test(slug) || !/^\d{5}$/.test(String(trainer.base_zip || ""))) {
    return res.status(404).json({ ok: false, message: `We could not find that trainer. Please call ${OFFICE_PHONE}.` });
  }
  const rule = B.locationRule(trainer, null);
  const form = B.validateEvalForm(body, rule, await bookingQuestions());
  if (form.errors.length) return res.status(400).json({ ok: false, message: form.errors[0], errors: form.errors });
  const leadId = B.clean(body.lead_id, 60);
  if (leadId && !B.UUID.test(leadId)) return res.status(400).json({ ok: false, message: "That booking link is not complete. Please use the link from your text again." });
  const { client, dogs, location } = form.value;
  const pseudo = { slug, trainer_id: trainer.id };
  let lead = await leadForForm({ leadId, client, dogs, slug, setting: pseudo, trainer, zip: body.zip, via: "booking-request" });
  if (!lead) return res.status(404).json({ ok: false, message: `We could not find your request. Please call ${OFFICE_PHONE}.` });
  if (rawOf(lead).booking?.slot_start) {
    return res.status(409).json({ ok: false, message: `You already have an evaluation booked. To change it, please call ${OFFICE_PHONE}.` });
  }
  const now = new Date().toISOString();
  const locationLabel = B.locationLabel(location, rule);
  const record = await patchLeadWithRetry(lead, current => {
    const raw = rawOf(current);
    const prior = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
    return {
      ...answeredContact(client, dogs),
      ...B.trainerFields(pseudo, trainer),
      raw_payload: {
        ...raw,
        ...(trainer.market ? { trainer_market: trainer.market } : {}),
        sales_pipeline: true, // the pipeline carries this lead (rule 2); its status is NOT changed
        booking: {
          ...(prior.intake ? { intake: prior.intake } : {}),
          ...(prior.callback ? { callback: prior.callback } : {}),
          via: "trainer_request",
          requested: true,
          requested_at: now,
          trainer_slug: slug,
          trainer_name: trainer.full_name,
          zip: B.digits(body.zip).slice(0, 5) || null,
          location,
          location_label: locationLabel,
          client,
          client_custom: form.value.client_custom || undefined, // rule 75: office-added questions
          dogs
        }
      }
    };
  });
  await P.afterOfficeRequest({ lead: record, kind: "trainer_request" })
    .catch(error => console.error("pipeline_after_request_failed", String(error?.message || error)));
  return res.status(200).json({
    ok: true,
    requested: true,
    lead_id: record.id,
    trainer_name: trainer.full_name,
    location: locationLabel,
    location_key: location,
    address: location === "training_center" ? rule.training_center_address : client.address
  });
}

// Step 3c (rule 74): no trainer within 50 miles -> "The office will match you with a trainer" + callback.
async function callback(req, res, body) {
  const c = body.client || {};
  const client = { first_name: B.clean(c.first_name, 80), last_name: B.clean(c.last_name, 80), phone: B.clean(c.phone, 40), email: B.clean(c.email, 160).toLowerCase() };
  const zip = B.digits(body.zip).slice(0, 5);
  const errors = [];
  if (!client.first_name) errors.push("Please add your first name.");
  if (B.digits(client.phone).length < 10) errors.push("Please add a phone number with 10 digits so we can call you.");
  if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(client.email)) errors.push("The email address does not look right.");
  if (zip.length !== 5) errors.push("Please enter your 5-digit ZIP code.");
  if (errors.length) return res.status(400).json({ ok: false, message: errors[0], errors });
  const leadId = B.clean(body.lead_id, 60);
  if (leadId && !B.UUID.test(leadId)) return res.status(400).json({ ok: false, message: "That link is not complete. Please call us." });
  let lead = leadId ? await getLead(leadId) : null;
  if (leadId && !lead) return res.status(404).json({ ok: false, message: `We could not find your request. Please call ${OFFICE_PHONE}.` });
  if (!lead) {
    const created = await B.createLead({
      intake: { ...client, zip, problem: "", dog_name: "", sms_consent: false, source_page: "book/no-trainer-nearby" },
      setting: null, trainer: null, via: "booking-callback"
    });
    lead = await getLead(created.lead.id);
  }
  const now = new Date().toISOString();
  const record = await patchLeadWithRetry(lead, current => {
    const raw = rawOf(current);
    return {
      ...(current.first_name ? {} : { first_name: client.first_name }),
      ...(current.last_name || !client.last_name ? {} : { last_name: client.last_name }),
      ...(current.phone ? {} : { phone: client.phone }),
      ...(current.email || !client.email ? {} : { email: client.email }),
      raw_payload: {
        ...raw,
        booking: {
          ...(raw.booking && typeof raw.booking === "object" ? raw.booking : {}),
          callback: { zip, requested_at: now, phone: client.phone, reason: `No trainer within ${B.RADIUS_MILES} miles of ZIP ${zip}.` }
        }
      }
    };
  });
  await P.afterOfficeRequest({ lead: record, kind: "no_trainer" })
    .catch(error => console.error("pipeline_after_callback_failed", String(error?.message || error)));
  return res.status(200).json({ ok: true, callback: true, lead_id: record.id });
}

module.exports = async function handler(req, res) {
  if (!isSandbox()) return res.status(404).json({ ok: false, message: "Not found." });
  B.applyCors(req, res, "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") return req.query?.trainer ? await availability(req, res) : await nearby(req, res);
    if (req.method === "POST") {
      let body;
      try { body = B.readBody(req); } catch { return res.status(400).json({ ok: false, message: "The form could not be read. Please try again." }); }
      if (body.op === "request") return await requestTrainer(req, res, body);
      if (body.op === "callback") return await callback(req, res, body);
      return await book(req, res, body);
    }
    return res.status(405).json({ ok: false, message: "Use GET or POST." });
  } catch (error) {
    console.error("booking_failed", String(error?.message || error));
    return res.status(500).json({ ok: false, message: `Something went wrong. Please try again or call ${OFFICE_PHONE}.` });
  }
};
module.exports.parseStart = parseStart;
