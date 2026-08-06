import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { insertRows, selectRows } from "../_shared/rest.ts";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

async function tooManyRecent(email: string) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const rows = await selectRows({ table: "trainer_applications", select: "id", filters: { email: `eq.${email}`, created_at: `gte.${since}` }, limit: 4 });
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
    const sourceSubmissionId = clean(payload.submission_id);
    const isQaSubmission = payload.qa === true
      || /^qa[_-]/i.test(sourceSubmissionId)
      || /(?:localhost|127\.0\.0\.1|\.vercel\.app)(?::\d+)?(?:\/|$)/i.test(clean(payload.page_url));
    const sourcePage = clean(payload.source_page || payload.page_url || "trainer-application.html");
    const inquiryType = clean(payload.inquiry_type) || (/trainer-opportunity-/i.test(sourcePage) ? "discovery_call" : "full_application");

    if (!firstName || !lastName || !email || !phone) {
      return jsonResponse({ error: "Missing required application fields" }, 400);
    }
    if (await tooManyRecent(email)) return jsonResponse({ error: "Please wait before sending another application" }, 429);

    const inserted = await insertRows({
      table: "trainer_applications",
      onConflict: sourceSubmissionId ? "source_submission_id" : undefined,
      body: {
        source_submission_id: sourceSubmissionId || null,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        referral_source: clean(payload.referral_source),
        address_line_1: clean(payload.address_line_1),
        address_line_2: clean(payload.address_line_2),
        city: clean(payload.city),
        state: clean(payload.state),
        zip: clean(payload.zip),
        status: inquiryType === "full_application" ? "new_application" : "discovery_follow_up",
        inquiry_type: ["discovery_call", "contact_form_interest", "full_application"].includes(inquiryType) ? inquiryType : "full_application",
        source_form: clean(payload.source_form || (inquiryType === "full_application" ? "trainer_application" : "trainer_opportunity")),
        source_page: sourcePage,
        market: clean(payload.market || payload.trainer_market || payload.opportunity_market || [payload.city, payload.state].filter(Boolean).join(", ")),
        utm_source: clean(payload.utm_source),
        utm_medium: clean(payload.utm_medium),
        utm_campaign: clean(payload.utm_campaign),
        utm_content: clean(payload.utm_content),
        utm_term: clean(payload.utm_term),
        received_at: clean(payload.timestamp) || new Date().toISOString(),
        raw_payload: payload
      }
    });

    const application = Array.isArray(inserted) ? inserted[0] : null;
    if (application?.id) await insertRows({
      table: "lifecycle_events",
      onConflict: "event_key",
      ignoreDuplicates: true,
      returning: "minimal",
      body: {
        event_key: `application:${application.id}:${inquiryType === "full_application" ? "full_application" : "recruiting_inquiry"}`,
        entity_type: "application",
        entity_id: application.id,
        event_type: isQaSubmission ? "qa_release_check" : inquiryType === "full_application" ? "full_application" : "recruiting_inquiry",
        market: clean(payload.market || payload.trainer_market || payload.opportunity_market || [payload.city, payload.state].filter(Boolean).join(", ")),
        source_page: sourcePage,
        visitor_id: clean(payload.visitor_id),
        session_id: clean(payload.session_id),
        utm_source: clean(payload.utm_source),
        utm_medium: clean(payload.utm_medium),
        utm_campaign: clean(payload.utm_campaign),
        raw_payload: payload,
        occurred_at: clean(payload.timestamp) || new Date().toISOString()
      }
    });
    return jsonResponse({ ok: true, entity_type: "application", inquiry_type: inquiryType, application_id: application?.id ?? null });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unable to save trainer application" }, 500);
  }
});
