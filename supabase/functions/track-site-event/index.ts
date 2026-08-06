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
    if (JSON.stringify(payload).length > 50000) return jsonResponse({ error: "Event payload is too large" }, 413);
    const eventType = clean(payload.event_type, 80);
    const trainerSlug = clean(payload.trainer_slug, 120);
    const allowedEventTypes = new Set(["page_view", "site_visit", "cta_click", "trainer_page_view", "trainer_cta_click", "trainer_form_started", "trainer_form_submitted", "ad_page_view", "ad_cta_click", "market_page_view", "market_page_time", "market_form_submit", "market_ebook_download", "recruiting_page_view", "recruiting_cta_click"]);
    if (!eventType || !allowedEventTypes.has(eventType)) return jsonResponse({ error: "Unsupported event type" }, 400);

    const trainerRows = trainerSlug ? await selectRows({
      table: "trainers",
      select: "id,slug,full_name",
      filters: { slug: `eq.${trainerSlug}` },
      limit: 1
    }) : [];
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
    const isQaEvent = payload.qa === true
      || /^qa[_-]/i.test(eventType)
      || /(?:localhost|127\.0\.0\.1|\.vercel\.app)(?::\d+)?(?:\/|$)/i.test(clean(payload.page_url, 1000));
    const lifecycleType = isQaEvent ? "qa_release_check" : /click/i.test(eventType) ? "cta_click" : "site_visit";
    const eventKey = clean(payload.event_id, 240) || `${lifecycleType}:${clean(payload.session_id, 160)}:${clean(payload.page_path, 500)}:${clean(payload.timestamp, 80)}`;
    await insertRows({
      table: "lifecycle_events",
      onConflict: "event_key",
      ignoreDuplicates: true,
      returning: "minimal",
      body: {
        event_key: eventKey,
        entity_type: "site_event",
        entity_id: eventKey,
        event_type: lifecycleType,
        market: clean(payload.trainer_market || payload.market, 160),
        source_page: clean(payload.page_path, 500),
        visitor_id: clean(payload.visitor_id, 160),
        session_id: clean(payload.session_id, 160),
        utm_source: clean(payload.utm_source, 160),
        utm_medium: clean(payload.utm_medium, 160),
        utm_campaign: clean(payload.utm_campaign, 240),
        raw_payload: payload,
        occurred_at: clean(payload.timestamp, 80) || new Date().toISOString()
      }
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unable to save site event" }, 500);
  }
});
