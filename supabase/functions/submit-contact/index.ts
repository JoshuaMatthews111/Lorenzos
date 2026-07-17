import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { insertRows, selectRows } from "../_shared/rest.ts";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const payload = await req.json();
    const firstName = clean(payload.first_name);
    const lastName = clean(payload.last_name);
    const email = clean(payload.email).toLowerCase();
    const phone = clean(payload.phone);
    const trainerSlug = clean(payload.trainer_slug);
    const assignedTrainerName = clean(payload.assigned_trainer);
    const sourceSubmissionId = clean(payload.submission_id);

    if (!firstName || !lastName || !email || !phone) {
      return jsonResponse({ error: "Missing required contact fields" }, 400);
    }

    const trainerRows = trainerSlug ? await selectRows({ table: "trainers", select: "id,slug,full_name", filters: { slug: `eq.${trainerSlug}` }, limit: 1 }) : [];
    const trainer = Array.isArray(trainerRows) ? trainerRows[0] : null;

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
    }

    return jsonResponse({ ok: true, lead_id: lead?.id ?? null });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unable to save contact submission" }, 500);
  }
});
