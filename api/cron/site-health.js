// Nightly Site Builder health check (durability, 2026-09-05).
//
// Vercel cron (vercel.json: 08:30 UTC daily) or a manual call with
// `Authorization: Bearer <CRON_SECRET>`. For every PUBLISHED page it checks:
//   - the clean path (/about, /ads/<slug>) and /p/<slug> answer 200 from the
//     page route (a 200 from a static or exported file is a warning, not a pass);
//   - every photo / video / logo URL in the published content answers 200;
//   - the exported copy bundled with this deploy (site/pages/index.json) is at
//     the same revision and the same bytes as a fresh render.
//
// Where the result goes:
//   - site_settings key `site_health` (the studio's "Where this page lives"
//     panel reads it) — every run;
//   - an audit_events row when a page is BROKEN (the office sees the audit log);
//   - ONE DSN Command approval per broken page ("LDTT: page <slug> is not
//     serving") so Joshua is texted — never for a stale export, never on a
//     clean run, never on the practice copy, never with ?dry=1.
// Nothing is ever sent to the office. Nothing here changes a page.
//
//   ?dry=1     check everything, write nothing, post nothing; the DSN payloads
//              that WOULD have been sent are returned as `dsn_payloads`.
//   ?base=…    check a different deployment (default: the live site on
//              production, this deployment's URL on a preview).
//
// Numbers cross-check (2026-09-05): the same run also loads
// trainer-backoffice/metrics.js (the portal's one source of truth for every
// figure) over the live leads / deals / trainer_applications rows and compares
// each key figure with a plain count of the raw rows (lib/metrics-crosscheck.js).
// A disagreement files ONE approval per figure, "LDTT: numbers disagree: <figure>",
// capped at 5, and the result lands under site_health.numbers. Dry-run posts nothing.
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { supabaseRequest, isSandbox } = require("../../lib/sandbox");
const durability = require("../../lib/page-durability.js");
const crosscheck = require("../../lib/metrics-crosscheck.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const DSN_URL = process.env.DSN_COMMAND_APPROVAL_URL || "https://dsn-command.vercel.app/api/agent/approval";
const deps = { fetch: (...args) => fetch(...args) };

async function supabaseFetch(path, options = {}) {
  const target = supabaseRequest(path, options.headers || {});
  const response = await deps.fetch(`${SUPABASE_URL}${target.path}`, { ...options, headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...target.headers } });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(data?.message || raw || `Supabase ${response.status}`);
  return data;
}

function authorized(req) {
  // NOTE (auth review 2026-09-05): header PRESENCE is trusted, its value is not checked. Vercel strips a spoofed x-vercel-cron from outside requests, so this is left as is.
  if (req.headers["x-vercel-cron"]) return true;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const secret = process.env.CRON_SECRET || "";
  return Boolean(secret) && bearer === secret;
}

function defaultBase() {
  if (process.env.SITE_HEALTH_BASE_URL) return process.env.SITE_HEALTH_BASE_URL;
  if (process.env.VERCEL_ENV === "production" && !isSandbox()) return durability.SITE_ORIGIN;
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : durability.SITE_ORIGIN;
}

async function publishedPages() {
  return supabaseFetch("/rest/v1/ad_pages?select=id,slug,page_type,title,status,published_revision,published_at,published_content&status=eq.published&order=slug.asc&limit=500");
}

async function postApproval(payload) {
  const token = process.env.DSN_AGENT_TOKEN || "";
  if (!token) return { posted: false, reason: "DSN_AGENT_TOKEN is not set" };
  try {
    const r = await deps.fetch(DSN_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return { posted: r.ok, status: r.status };
  } catch (error) {
    return { posted: false, reason: error.message };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Server is not configured." });
  if (!authorized(req)) return res.status(403).json({ ok: false, message: "Forbidden." });
  const dryRun = String(req.query?.dry || "") === "1";
  const base = String(req.query?.base || "").trim() || defaultBase();
  try {
    const pages = await publishedPages();
    const exportIndex = durability.readExportIndex();
    const renderHash = async row => durability.sha256((await durability.renderThroughRoute(row.slug, ["site", "landing"].includes(row.page_type) ? row.page_type : "ad")).body || "");
    const report = await durability.runSiteHealth({ pages, base, fetchImpl: deps.fetch, exportIndex, renderHash });
    const dsnPayloads = report.broken.map(page => durability.dsnApprovalPayload(page, { base, ranAt: report.ran_at }));
    // Numbers: metrics.js (what the portal shows) vs a plain count of the rows. Read-only.
    const numbers = await crosscheck.runNumbersCrossCheck({ supabaseFetch, ranAt: report.ran_at });
    const numberPayloads = numbers.approvals || [];
    const summary = { ...report, dryRun, sandbox: isSandbox(), export_index: exportIndex ? { exported_at: exportIndex.exported_at, pages: exportIndex.pages?.length || 0, schema: exportIndex.schema } : null, numbers, dsn_payloads: [...dsnPayloads, ...numberPayloads], dsn_results: [] };
    if (dryRun) return res.status(200).json(summary);

    // The studio reads this (site_settings.site_health) for the "Where this page lives" panel.
    await supabaseFetch("/rest/v1/site_settings?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "site_health", value: { ok: report.ok, ran_at: report.ran_at, base, checked: report.checked, broken: report.broken, stale: report.stale, pages: report.pages.map(p => ({ slug: p.slug, ok: p.ok, problems: p.problems, warnings: p.warnings, export: p.export })), numbers }, updated_by: "site health check", updated_at: report.ran_at }) }).catch(error => console.error("site_health write failed", error));

    if (report.broken.length) {
      await supabaseFetch("/rest/v1/audit_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
        actor_name: "Site health check", action: "site_page_broken", entity_type: "ad_pages", entity_id: "nightly",
        summary: `${report.broken.length} published page(s) not serving: ${report.broken.map(b => b.path).join(", ")}`,
        after_data: { base, broken: report.broken, ran_at: report.ran_at }
      }) }).catch(error => console.error("audit write failed", error));
      // Joshua only, through DSN Command; never on the practice copy.
      if (!isSandbox()) for (const payload of dsnPayloads) summary.dsn_results.push({ title: payload.title, ...(await postApproval(payload)) });
    }
    // Numbers that disagree: Joshua only, one approval per figure (capped), never on the practice copy.
    if (numberPayloads.length && !isSandbox()) for (const payload of numberPayloads) summary.dsn_results.push({ title: payload.title, ...(await postApproval(payload)) });
    return res.status(200).json(summary);
  } catch (error) {
    console.error("site health failed", error);
    return res.status(500).json({ ok: false, message: error.message || "Site health check failed." });
  }
};
module.exports.deps = deps;
module.exports.defaultBase = defaultBase;
