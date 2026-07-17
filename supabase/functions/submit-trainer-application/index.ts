import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { insertRows } from "../_shared/rest.ts";

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
    const sourceSubmissionId = clean(payload.submission_id);

    if (!firstName || !lastName || !email || !phone) {
      return jsonResponse({ error: "Missing required application fields" }, 400);
    }

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
        status: "new_application",
        raw_payload: payload
      }
    });

    const application = Array.isArray(inserted) ? inserted[0] : null;
    return jsonResponse({ ok: true, application_id: application?.id ?? null });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unable to save trainer application" }, 500);
  }
});
