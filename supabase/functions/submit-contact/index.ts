import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { insertRows, selectRows } from "../_shared/rest.ts";

function clean(value: unknown) {
  return String(value ?? "").trim();
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

    return jsonResponse({ ok: true, lead_id: lead?.id ?? null });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unable to save contact submission" }, 500);
  }
});
