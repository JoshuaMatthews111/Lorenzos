// Google Calendar busy times for the trainers (Joshua 2026-10-15, rule 181 follow-up / rule 158's missing half).
// Missy shared every trainer's calendar with Joshua's Google account; that account granted this app READ-ONLY
// calendar access (scope calendar.readonly — rule 71 stays true: we never write to Google). The booking flow
// merges these busy blocks into knownBookings, so clashesWithBooking hides any slot within TRAVEL_GAP_MINUTES
// (1 hour) of ANY calendar event — sessions, Alpha entries, personal blocks — not just our own bookings.
//
// Env (all three required, else this module is silent and booking behaves exactly as before):
//   GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET  — the existing TRAC500 Google OAuth app
//   GCAL_REFRESH_TOKEN                                   — refresh token for Joshua's calendar-reader account
const DAYS_AHEAD = 21;
const CACHE_MS = 60 * 1000; // same freshness as the Google slots cache
const TIMEOUT_MS = 6500;    // never let a Google hiccup take the booking page down

let tokenCache = { value: "", until: 0 };
const busyCache = new Map(); // email -> { at, items: [{start,end}] }

const ready = () => Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GCAL_REFRESH_TOKEN);

async function timedFetch(url, options = {}) {
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    return await fetch(url, { ...options, ...(ctrl ? { signal: ctrl.signal } : {}) });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function accessToken(now = Date.now()) {
  if (tokenCache.value && now < tokenCache.until) return tokenCache.value;
  const r = await timedFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GCAL_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`gcal_token_failed ${j.error || r.status}`);
  tokenCache = { value: j.access_token, until: now + Math.max(60, (Number(j.expires_in) || 3600) - 120) * 1000 };
  return tokenCache.value;
}

// Busy blocks for one trainer's calendar, [{start,end}] in epoch SECONDS (knownBookings shape).
// Any failure returns [] and logs: a Google outage must never hide the whole calendar (rule 158 kept slots
// working when OUR table failed; same stance here).
async function googleBusy(email, { now = Date.now() } = {}) {
  const id = String(email || "").trim().toLowerCase();
  if (!ready() || !/^[^@\s]+@[^@\s]+$/.test(id)) return [];
  const hit = busyCache.get(id);
  if (hit && now - hit.at < CACHE_MS) return hit.items;
  try {
    const token = await accessToken(now);
    const r = await timedFetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        timeMin: new Date(now - 6 * 3600 * 1000).toISOString(),
        timeMax: new Date(now + DAYS_AHEAD * 24 * 3600 * 1000).toISOString(),
        items: [{ id }]
      })
    });
    const j = await r.json().catch(() => ({}));
    const cal = j?.calendars?.[id];
    if (!r.ok || !cal || cal.errors?.length) throw new Error(`gcal_freebusy_failed ${cal?.errors?.[0]?.reason || r.status}`);
    const items = (cal.busy || [])
      .map(b => ({ start: Math.floor(Date.parse(b.start) / 1000), end: Math.floor(Date.parse(b.end) / 1000), source: "google" }))
      .filter(b => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start);
    busyCache.set(id, { at: now, items });
    return items;
  } catch (error) {
    console.error("gcal_busy_failed", id, String(error?.message || error));
    return [];
  }
}

const resetCaches = () => { tokenCache = { value: "", until: 0 }; busyCache.clear(); };

module.exports = { googleBusy, ready, resetCaches, DAYS_AHEAD };
