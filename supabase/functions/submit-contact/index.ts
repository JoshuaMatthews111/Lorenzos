import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { insertRows, selectRows } from "../_shared/rest.ts";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

/* ---------- Meta Conversions API ----------
   The browser pixel only reaches Meta when nothing blocks it (Safari, iOS, ad
   blockers all do). This sends the same Lead from the server so Meta sees the
   real count. The browser and server share one event_id, so Meta de-duplicates
   and never counts a lead twice. Any failure here is logged and swallowed: the
   lead is already saved and the form response must never depend on Meta. */
const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID") || "3790623554504010";
const META_CAPI_ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN") || "";
const META_TEST_EVENT_CODE = Deno.env.get("META_TEST_EVENT_CODE") || "";

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hashed(value: unknown) {
  const v = clean(value).toLowerCase();
  return v ? [await sha256(v)] : undefined;
}
async function hashedPhone(value: unknown) {
  let digits = clean(value).replace(/\D/g, "");
  if (!digits || /not provided/i.test(clean(value))) return undefined;
  if (digits.length === 10) digits = "1" + digits;
  return [await sha256(digits)];
}
function isEbookLead(payload: Record<string, unknown>) {
  return clean(payload.lead_type) === "pdf_download"
    || /blueprint|ebook|e-book|5-step|five.step/i.test(clean(payload.i_want_to));
}

async function sendMetaConversion(req: Request, payload: Record<string, unknown>, leadId: string | number) {
  if (!META_CAPI_ACCESS_TOKEN) return { skipped: "no_token" };
  const ebook = isEbookLead(payload);
  const eventId = clean(payload.meta_event_id) || `lead-${leadId}`;
  const ip = clean(req.headers.get("x-forwarded-for")).split(",")[0].trim() || undefined;
  const ua = clean(req.headers.get("user-agent")) || undefined;
  const occurred = Date.parse(clean(payload.timestamp));
  const eventTime = Math.floor((Number.isFinite(occurred) ? occurred : Date.now()) / 1000);
  const userData: Record<string, unknown> = {
    em: await hashed(payload.email),
    ph: await hashedPhone(payload.phone),
    fn: await hashed(payload.first_name),
    ln: await hashed(payload.last_name),
    zp: await hashed(clean(payload.zip).slice(0, 5)),
    ct: await hashed(clean(payload.city).replace(/[^a-z]/gi, "")),
    st: await hashed(clean(payload.state).slice(0, 2)),
    country: await hashed("us"),
    client_ip_address: ip,
    client_user_agent: ua,
    fbp: clean(payload.fbp) || undefined,
    fbc: clean(payload.fbc) || undefined,
    external_id: [await sha256(String(leadId))]
  };
  for (const k of Object.keys(userData)) if (userData[k] === undefined) delete userData[k];
  const body: Record<string, unknown> = {
    data: [{
      event_name: ebook ? "CompleteRegistration" : "Lead",
      event_time: eventTime,
      event_id: eventId,
      event_source_url: clean(payload.page_url || payload.landing_url) || undefined,
      action_source: "website",
      user_data: userData,
      custom_data: {
        value: ebook ? 25 : 250,
        currency: "USD",
        content_name: clean(payload.trainer_market || payload.ad_market) || undefined,
        lead_source: clean(payload.utm_source) || undefined
      }
    }]
  };
  if (META_TEST_EVENT_CODE) body.test_event_code = META_TEST_EVENT_CODE;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_CAPI_ACCESS_TOKEN)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) console.error("meta_capi_error", res.status, text.slice(0, 400));
    else console.log("meta_capi_ok", eventId, text.slice(0, 200));
    return { ok: res.ok, status: res.status };
  } catch (error) {
    console.error("meta_capi_exception", String(error));
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function tooManyRecent(table: "leads" | "trainer_applications", email: string) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const rows = await selectRows({ table, select: "id", filters: { email: `eq.${email}`, created_at: `gte.${since}` }, limit: 4 });
  return Array.isArray(rows) && rows.length >= 4;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const payload = await req.json();
    if (JSON.stringify(payload).length > 220000) return jsonResponse({ error: "Form payload is too large" }, 413);
    if (clean(payload.company_website)) return jsonResponse({ ok: true, spam_filtered: true });
    const firstName = clean(payload.first_name);
    const lastName = clean(payload.last_name);
    const email = clean(payload.email).toLowerCase();
    const phone = clean(payload.phone);
    const trainerSlug = clean(payload.trainer_slug);
    const assignedTrainerName = clean(payload.assigned_trainer);
    const sourceSubmissionId = clean(payload.submission_id);
    const isQaSubmission = payload.qa === true
      || /^qa[_-]/i.test(sourceSubmissionId)
      || /(?:localhost|127\.0\.0\.1|\.vercel\.app)(?::\d+)?(?:\/|$)/i.test(clean(payload.page_url));
    const trainerInterest = /becom(?:e|ing) a dog trainer|trainer opportunity|dog trainer business/i.test(
      [payload.i_want_to, payload.additional_interest, payload.source_page].map(value => clean(value)).join(" ")
    );

    if (!firstName || !lastName || !email || !phone) {
      return jsonResponse({ error: "Missing required contact fields" }, 400);
    }

    if (await tooManyRecent(trainerInterest ? "trainer_applications" : "leads", email)) {
      return jsonResponse({ error: "Please wait before sending another request" }, 429);
    }

    const trainerRows = trainerSlug ? await selectRows({ table: "trainers", select: "id,slug,full_name", filters: { slug: `eq.${trainerSlug}` }, limit: 1 }) : [];
    const trainer = Array.isArray(trainerRows) ? trainerRows[0] : null;

    if (trainerInterest) {
      const insertedApplications = await insertRows({
        table: "trainer_applications",
        onConflict: sourceSubmissionId ? "source_submission_id" : undefined,
        body: {
          source_submission_id: sourceSubmissionId || null,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          referral_source: clean(payload.heard_about_us),
          address_line_1: clean(payload.address_line_1),
          address_line_2: clean(payload.address_line_2),
          city: clean(payload.city),
          state: clean(payload.state),
          zip: clean(payload.zip),
          status: "discovery_follow_up",
          inquiry_type: "contact_form_interest",
          source_form: "contact",
          source_page: clean(payload.source_page || payload.page_url || "contact.html"),
          market: clean(payload.trainer_market || [payload.city, payload.state].filter(Boolean).join(", ")),
          utm_source: clean(payload.utm_source),
          utm_medium: clean(payload.utm_medium),
          utm_campaign: clean(payload.utm_campaign),
          utm_content: clean(payload.utm_content),
          utm_term: clean(payload.utm_term),
          received_at: clean(payload.timestamp) || new Date().toISOString(),
          raw_payload: payload
        }
      });
      const application = Array.isArray(insertedApplications) ? insertedApplications[0] : null;
      if (application?.id) await insertRows({
        table: "lifecycle_events",
        onConflict: "event_key",
        ignoreDuplicates: true,
        returning: "minimal",
        body: {
          event_key: `application:${application.id}:recruiting_inquiry`,
          entity_type: "application",
          entity_id: application.id,
          event_type: isQaSubmission ? "qa_release_check" : "recruiting_inquiry",
          market: clean(payload.trainer_market || [payload.city, payload.state].filter(Boolean).join(", ")),
          source_page: clean(payload.source_page || payload.page_url || "contact.html"),
          raw_payload: payload,
          occurred_at: clean(payload.timestamp) || new Date().toISOString()
        }
      });
      return jsonResponse({ ok: true, entity_type: "application", application_id: application?.id ?? null });
    }

    const inserted = await insertRows({
      table: "leads",
      onConflict: sourceSubmissionId ? "source_submission_id" : undefined,
      body: {
        source_submission_id: sourceSubmissionId || null,
        trainer_id: trainer?.id ?? null,
        trainer_slug: trainerSlug || trainer?.slug || null,
        assigned_trainer_name: assignedTrainerName || trainer?.full_name || null,
        trainer_market: clean(payload.trainer_market),
        trainer_city: clean(payload.trainer_city),
        trainer_state: clean(payload.trainer_state),
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        address_line_1: clean(payload.address_line_1),
        address_line_2: clean(payload.address_line_2),
        city: clean(payload.city),
        state: clean(payload.state),
        zip: clean(payload.zip),
        service_interest: clean(payload.i_want_to || payload.service_interest),
        lead_source: clean(payload.heard_about_us || "Website"),
        referral_detail: clean(payload.vet_or_previous_client),
        comments: clean(payload.comments),
        sms_consent: clean(payload.sms_consent).toLowerCase() === "yes",
        status: "new_inquiry",
        source_page: clean(payload.source_page || payload.page_url || "website"),
        raw_payload: payload
      }
    });

    const lead = Array.isArray(inserted) ? inserted[0] : null;
    if (lead?.id) {
      const existingEvents = sourceSubmissionId
        ? await selectRows({
            table: "lead_events",
            select: "id",
            filters: {
              lead_id: `eq.${lead.id}`,
              event_type: "eq.form_submitted"
            },
            limit: 1
          })
        : [];
      if (!Array.isArray(existingEvents) || existingEvents.length === 0) await insertRows({
        table: "lead_events",
        returning: "minimal",
        body: {
          lead_id: lead.id,
          event_type: "form_submitted",
          note: assignedTrainerName ? `Trainer landing page form submitted for ${assignedTrainerName}.` : "Website contact form submitted.",
          raw_payload: payload
        }
      });
      await insertRows({
        table: "lifecycle_events",
        onConflict: "event_key",
        ignoreDuplicates: true,
        returning: "minimal",
        body: {
          event_key: `lead:${lead.id}:form_received`,
          entity_type: "lead",
          entity_id: lead.id,
          event_type: isQaSubmission ? "qa_release_check" : "form_received",
          market: clean(payload.trainer_market || [payload.city, payload.state].filter(Boolean).join(", ")),
          source_page: clean(payload.source_page || payload.page_url || "website"),
          visitor_id: clean(payload.visitor_id),
          session_id: clean(payload.session_id),
          utm_source: clean(payload.utm_source),
          utm_medium: clean(payload.utm_medium),
          utm_campaign: clean(payload.utm_campaign),
          raw_payload: payload,
          occurred_at: clean(payload.timestamp) || new Date().toISOString()
        }
      });
    }

    if (lead?.id && !isQaSubmission) {
      try { await sendMetaConversion(req, payload, lead.id); } catch (error) { console.error("meta_capi_unhandled", String(error)); }
    }

    return jsonResponse({ ok: true, lead_id: lead?.id ?? null });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unable to save contact submission" }, 500);
  }
});
