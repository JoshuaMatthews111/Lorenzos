// Online booking API (portal chain step 2, Joshua 2026-09-12, DO-NOT-BREAK rule 71).
// PRACTICE COPY ONLY this round: answers 404 on live, before anything else.
//
//   GET  ?trainer=<slug>[&lead=<id>]  trainer card + the trainer's REAL free times from Google
//        (read-only ListAvailableSlots, 60 s cache) minus times already held here, minus the next hour.
//   POST {trainer_slug, slot_start (epoch seconds or ISO), lead_id?, location, client{...}, dogs[...]}
//        re-checks the time with Google (fresh), HOLDS it in booking_holds (one hold per trainer + time,
//        a second booking of the same time answers 409), then moves the lead to Eval Scheduled with the
//        eval time on the card (Leads board AND Sales "Booked": raw_payload.sales_pipeline = true) and
//        keeps every eval answer in raw_payload.booking.
// NEVER books in Google. The trainer / TC reserves the time in Google themselves.
const { isSandbox } = require("../lib/sandbox");
const B = require("../lib/booking");
const P = require("../lib/pipeline");

const OFFICE_PHONE = "(866) 436-4959";
const LEAD_SELECT = "id,first_name,last_name,email,phone,zip,dog_name,status,version,raw_payload,trainer_slug,eval_scheduled_at,source_page,trainer_market,address_line_1";

const slotForClient = slot => ({ start: slot.start, minutes: slot.minutes });

function marketLabel(trainer) {
  const market = String(trainer?.market || "").trim();
  if (!market) return trainer?.service_area || "";
  return market.includes(",") ? market : [market, trainer?.state].filter(Boolean).join(", ");
}

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
      const dogs = row.raw_payload?.booking?.dogs;
      lead = {
        first_name: row.first_name || "", last_name: row.last_name || "", phone: row.phone || "", email: row.email || "",
        address: row.address_line_1 || "", dog_name: Array.isArray(dogs) ? "" : (row.dog_name || "")
      };
      const hold = holds.find(h => h.lead_id === row.id);
      if (hold) booked = { slot_start: hold.slot_start, when: B.formatWhen(hold.slot_start, setting.time_zone), location: row.raw_payload?.booking?.location_label || "" };
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

async function book(req, res) {
  let body;
  try { body = B.readBody(req); } catch { return res.status(400).json({ ok: false, message: "The form could not be read. Please try again." }); }
  const slug = B.clean(body.trainer_slug, 80).toLowerCase();
  const settings = await B.loadSettings();
  const setting = B.settingBySlug(settings, slug);
  if (!setting) return res.status(404).json({ ok: false, message: `This trainer does not take online bookings yet. Please call ${OFFICE_PHONE}.` });
  const startSec = parseStart(body.slot_start);
  if (!startSec) return res.status(400).json({ ok: false, message: "Pick a time first." });
  const form = B.validateEvalForm(body, setting);
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
  if (!lead) {
    const zip = (client.address.match(/\b(\d{5})(?:-\d{4})?\b/g) || []).pop()?.slice(0, 5) || "";
    const created = await B.createLead({
      intake: { first_name: client.first_name, last_name: client.last_name, phone: client.phone, email: client.email, zip, problem: dogs[0]?.behavior?.slice(0, 300) || "", dog_name: dogs.map(d => d.name).join(", "), sms_consent: false, source_page: `book/${slug}` },
      setting, trainer, via: "booking-page"
    });
    lead = await getLead(created.lead.id);
  }

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
        first_name: client.first_name,
        last_name: client.last_name,
        phone: client.phone,
        email: client.email,
        address_line_1: client.address,
        dog_name: dogs.map(d => d.name).join(", "),
        dog_breed: dogs.map(d => d.breed).join(", "),
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
            trainer_slug: slug,
            trainer_name: trainer?.full_name || slug,
            slot_start: slotIso,
            slot_minutes: chosen.minutes,
            time_zone: setting.time_zone,
            when_label: whenLabel,
            location,
            location_label: locationLabel,
            client,
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
  // Never throws; what happened is kept in raw_payload.pipeline.booking_notices for the lead panel.
  // The office booking email is step 3b (Resend) and is not sent here.
  await P.afterBooking({ lead: record, booking: record.raw_payload?.booking || {}, trainer, setting })
    .catch(error => console.error("pipeline_after_booking_failed", String(error?.message || error)));

  return res.status(200).json({
    ok: true,
    lead_id: record.id,
    eval_scheduled_at: slotIso,
    when: whenLabel,
    trainer_name: trainer?.full_name || slug,
    location: locationLabel
  });
}

module.exports = async function handler(req, res) {
  if (!isSandbox()) return res.status(404).json({ ok: false, message: "Not found." });
  B.applyCors(req, res, "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") return await availability(req, res);
    if (req.method === "POST") return await book(req, res);
    return res.status(405).json({ ok: false, message: "Use GET or POST." });
  } catch (error) {
    console.error("booking_failed", String(error?.message || error));
    return res.status(500).json({ ok: false, message: `Something went wrong. Please try again or call ${OFFICE_PHONE}.` });
  }
};
module.exports.parseStart = parseStart;
