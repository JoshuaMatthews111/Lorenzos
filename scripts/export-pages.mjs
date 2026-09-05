#!/usr/bin/env node
// Materialise every PUBLISHED Site Builder page into the repo (durability).
//
//   node scripts/export-pages.mjs                      → site/pages/*.html + *.json, INDEX.md,
//                                                        site/pages/index.json (the machine list),
//                                                        site/theme.json, site/menus.json
//   node scripts/export-pages.mjs --schema practice    → the practice copy's pages
//   node scripts/export-pages.mjs --out /some/dir      → anywhere (a GitHub-less backup)
//   node scripts/export-pages.mjs --rows dump.json     → no database: use a JSON dump
//                                                        {ad_pages, ad_page_revisions, site_settings}
//   node scripts/export-pages.mjs --check              → exit 1 when the files on disk differ
//                                                        from the database (nothing written)
//
// Needs SUPABASE_SERVICE_ROLE_KEY (or --rows). The HTML is produced by the SAME
// route that serves /p/<slug> and /ads/<slug> (api/ad-page.js run in-process),
// so the exported bytes are what visitors get. scripts/build-release.mjs runs
// this before every build and skips with a note if the database is unreachable
// — the export must never fail a build. NOT deployed itself (scripts/ is in
// .vercelignore); its OUTPUT under site/ is.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback = "") => { const i = args.indexOf(`--${name}`); return i === -1 ? fallback : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "1"); };
const schema = opt("schema", process.env.LDTT_SANDBOX === "1" ? "practice" : "public");
if (!["public", "practice"].includes(schema)) { console.error("--schema must be public or practice"); process.exit(2); }
process.env.LDTT_SANDBOX = schema === "practice" ? "1" : "";
const root = resolve(import.meta.dirname, "..");
const outRoot = resolve(opt("out", resolve(root, "site")));
const rowsFile = opt("rows");
const checkOnly = opt("check") === "1";
const quiet = opt("quiet") === "1";
const log = (...m) => { if (!quiet) console.log(...m); };

const require = createRequire(import.meta.url);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
if (!key && !rowsFile) { console.error("export-pages: SUPABASE_SERVICE_ROLE_KEY is not set and no --rows file given; nothing exported."); process.exit(3); }
if (!key) process.env.SUPABASE_SERVICE_ROLE_KEY = "rows-file";
const durability = require("../lib/page-durability.js");
const pagesApi = require("../api/pages.js");
const manifestApi = require("../api/pages-manifest.js");
const sitemapApi = require("../api/sitemap.js");

let rows = null;
if (rowsFile) {
  rows = JSON.parse(readFileSync(resolve(rowsFile), "utf8"));
  const fake = durability.rowsFetch(rows);
  pagesApi.deps.fetch = fake; manifestApi.deps.fetch = fake; sitemapApi.deps.fetch = fake;
}
const supabaseFetch = pagesApi.supabaseFetch;

async function load() {
  const pages = await supabaseFetch("/rest/v1/ad_pages?select=id,slug,page_type,title,status,published_revision,published_at,published_content,updated_by&status=eq.published&order=slug.asc&limit=500");
  const ids = pages.map(p => `"${p.id}"`).join(",");
  const revisions = pages.length ? await supabaseFetch(`/rest/v1/ad_page_revisions?select=id,page_id,revision,kind,created_by,created_at&kind=eq.published&page_id=in.(${ids})&order=revision.desc&limit=2000`).catch(() => []) : [];
  const theme = await pagesApi.siteTheme();
  const navigation = await pagesApi.siteNav();
  return { pages: pages.filter(p => p.published_content && /^[a-z0-9-]{2,80}$/.test(p.slug)), revisions, theme, navigation };
}

const { pages, revisions, theme, navigation } = await load();
const pagesDir = resolve(outRoot, "pages");
const exportedAt = new Date().toISOString();
const entries = [];
const files = new Map();
for (const row of pages) {
  const { html, json, meta } = await durability.renderExport(row, { revisions, theme, navigation, schema });
  json.exported_at = exportedAt; meta.exported_at = exportedAt;
  files.set(`${row.slug}.html`, html);
  files.set(`${row.slug}.json`, `${JSON.stringify(json, null, 2)}\n`);
  entries.push(meta);
}
files.set("index.json", `${JSON.stringify({ exported_at: exportedAt, schema, pages: entries }, null, 2)}\n`);
files.set("INDEX.md", durability.indexMarkdown(entries, { schema, exportedAt }));
const siteFiles = new Map([["theme.json", `${JSON.stringify({ exported_at: exportedAt, schema, theme }, null, 2)}\n`], ["menus.json", `${JSON.stringify({ exported_at: exportedAt, schema, navigation }, null, 2)}\n`]]);

// Only fields that change between identical exports are timestamps; compare without them.
const stable = text => text.replace(/"exported_at": "[^"]+"/g, "").replace(/on \d{4}-\d{2}-\d{2}T[^ ]+/g, "");
if (checkOnly) {
  const diffs = [];
  for (const [name, text] of files) { const p = resolve(pagesDir, name); if (!existsSync(p) || stable(readFileSync(p, "utf8")) !== stable(text)) diffs.push(`site/pages/${name}`); }
  for (const [name, text] of siteFiles) { const p = resolve(outRoot, name); if (!existsSync(p) || stable(readFileSync(p, "utf8")) !== stable(text)) diffs.push(`site/${name}`); }
  if (existsSync(pagesDir)) for (const name of readdirSync(pagesDir)) if (/\.(html|json)$/.test(name) && !files.has(name)) diffs.push(`site/pages/${name} (no longer published)`);
  console.log(JSON.stringify({ ok: diffs.length === 0, schema, published: pages.length, differences: diffs }, null, 2));
  process.exit(diffs.length ? 1 : 0);
}

mkdirSync(pagesDir, { recursive: true });
let removed = 0;
for (const name of readdirSync(pagesDir)) {
  if (/\.(html|json)$/.test(name) && !files.has(name)) { rmSync(resolve(pagesDir, name)); removed += 1; }
}
for (const [name, text] of files) writeFileSync(resolve(pagesDir, name), text);
for (const [name, text] of siteFiles) writeFileSync(resolve(outRoot, name), text);
log(JSON.stringify({ ok: true, schema, out: outRoot, published: pages.length, written: files.size + siteFiles.size, removed, pages: entries.map(e => `${e.path} (rev ${e.revision}, ${e.published_by || "?"})`) }, null, 2));
