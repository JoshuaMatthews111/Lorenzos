#!/usr/bin/env node
// Run the Site Builder health check from any machine (durability).
//
//   node scripts/site-health.mjs --base https://www.lorenzosdogtrainingteam.com
//   node scripts/site-health.mjs --base https://<preview>.vercel.app --schema practice
//   node scripts/site-health.mjs --base … --rows dump.json     (no service key)
//   node scripts/site-health.mjs --base … --from-export        (no key, no dump:
//        reads <base>/site/pages/index.json + each .json the deploy ships)
//   --post   actually POST a DSN Command approval per broken page (needs
//            DSN_AGENT_TOKEN in the environment). Default is DRY: the payloads
//            are printed, nothing is sent, nothing is written.
//
// Same checks as api/cron/site-health.js (lib/page-durability.js runSiteHealth):
// clean path + /p/ answer 200 from the page route, every image answers 200,
// the export files are at the database revision.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback = "") => { const i = args.indexOf(`--${name}`); return i === -1 ? fallback : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "1"); };
const base = opt("base", "https://www.lorenzosdogtrainingteam.com").replace(/\/$/, "");
const schema = opt("schema", "public");
process.env.LDTT_SANDBOX = schema === "practice" ? "1" : "";
const rowsFile = opt("rows");
const fromExport = opt("from-export") === "1";
const post = opt("post") === "1";
const require = createRequire(import.meta.url);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
if (!key) process.env.SUPABASE_SERVICE_ROLE_KEY = "rows-file";
const durability = require("../lib/page-durability.js");
const pagesApi = require("../api/pages.js");
const manifestApi = require("../api/pages-manifest.js");
const sitemapApi = require("../api/sitemap.js");

let pages = [];
let exportIndex = null;
let renderHash = null;
if (fromExport) {
  // Everything the deploy ships publicly: the export index and one JSON per page.
  const index = await (await fetch(`${base}/site/pages/index.json?ldtt_health=${Date.now()}`)).json();
  exportIndex = index;
  for (const entry of index.pages || []) {
    const meta = await (await fetch(`${base}/site/pages/${entry.slug}.json?ldtt_health=${Date.now()}`)).json();
    pages.push({ slug: entry.slug, page_type: entry.page_type, published_revision: entry.revision, published_at: entry.published_at, published_content: meta.content });
  }
  // The live manifest says which revision is current now; a newer one means the export is stale.
  const manifest = await (await fetch(`${base}/api/pages-manifest?ldtt_health=${Date.now()}`)).json().catch(() => null);
  if (manifest?.pages) for (const p of pages) { const m = manifest.pages.find(x => x.slug === p.slug); if (m && m.published_revision) p.published_revision = m.published_revision; }
} else {
  if (rowsFile) { const fake = durability.rowsFetch(JSON.parse(readFileSync(resolve(rowsFile), "utf8"))); pagesApi.deps.fetch = fake; manifestApi.deps.fetch = fake; sitemapApi.deps.fetch = fake; }
  else if (!key) { console.error("site-health: set SUPABASE_SERVICE_ROLE_KEY, or use --rows <dump.json> / --from-export"); process.exit(3); }
  pages = await pagesApi.supabaseFetch("/rest/v1/ad_pages?select=id,slug,page_type,status,published_revision,published_at,published_content&status=eq.published&order=slug.asc&limit=500");
  exportIndex = durability.readExportIndex();
  renderHash = async row => durability.sha256((await durability.renderThroughRoute(row.slug, ["site", "landing"].includes(row.page_type) ? row.page_type : "ad")).body || "");
}

const report = await durability.runSiteHealth({ pages, base, exportIndex, renderHash });
const payloads = report.broken.map(page => durability.dsnApprovalPayload(page, { base, ranAt: report.ran_at }));
const out = { ...report, mode: fromExport ? "from-export" : rowsFile ? "rows" : "database", dry: !post, dsn_payloads: payloads, dsn_results: [] };
if (post && payloads.length) {
  const token = process.env.DSN_AGENT_TOKEN || "";
  if (!token) { console.error("--post needs DSN_AGENT_TOKEN"); process.exit(3); }
  for (const payload of payloads) {
    const r = await fetch(process.env.DSN_COMMAND_APPROVAL_URL || "https://dsn-command.vercel.app/api/agent/approval", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    out.dsn_results.push({ title: payload.title, posted: r.ok, status: r.status });
  }
}
console.log(JSON.stringify(out, null, 2));
process.exit(report.ok ? 0 : 1);
