import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { insertRows, selectRows } from "../_shared/rest.ts";

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const payload = await req.json();
    const eventType = clean(payload.event_type, 80);
    const trainerSlug = clean(payload.trainer_slug, 120);
    if (!eventType || !trainerSlug) return jsonResponse({ error: "Missing attribution fields" }, 400);

    const trainerRows = await selectRows({
      table: "trainers",
      select: "id,slug,full_name",
      filters: { slug: `eq.${trainerSlug}` },
      limit: 1
    });
    const trainer = Array.isArray(trainerRows) ? trainerRows[0] : null;
    await insertRows({
      table: "site_events",
      returning: "minimal",
      body: {
        trainer_id: trainer?.id ?? null,
        trainer_slug: trainerSlug,
        assigned_trainer_name: clean(payload.assigned_trainer || trainer?.full_name, 160),
        trainer_market: clean(payload.trainer_market, 160),
        trainer_city: clean(payload.trainer_city, 120),
        trainer_state: clean(payload.trainer_state, 120),
        event_type: eventType,
        visitor_id: clean(payload.visitor_id, 160),
        session_id: clean(payload.session_id, 160),
        page_path: clean(payload.page_path, 500),
        referrer: clean(payload.referrer, 1000),
        user_agent: clean(payload.user_agent, 1000),
        utm_source: clean(payload.utm_source, 160),
        utm_medium: clean(payload.utm_medium, 160),
        utm_campaign: clean(payload.utm_campaign, 240),
        raw_payload: payload
      }
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unable to save site event" }, 500);
  }
});
