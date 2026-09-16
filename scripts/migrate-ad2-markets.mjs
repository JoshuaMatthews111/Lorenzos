// Joshua (chat 2026-09-16): "we need the landing pages 2.0 pages for all the markets we have, not only the
// three [Arrison] edited ... use the same photo on the original landing pages ... wording as well so we will
// migrate the content. Don't delete the old landing pages. Skip the three Arrison edited."
//
// Builds one 2.0 (ad2) page per remaining market from the ORIGINAL ad page's own copy and photos
// (lib/ad-page-markets.js), and prints the SQL that inserts them into practice.ad_pages (sandbox only).
// The three starter pages (miramar-beach d1, panama-city-beach d2, ann-arbor d3) are Arrison's: untouched.
// Old pixel ad pages are never changed or removed.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const A2 = require("../lib/ad2-page-template.js");
const MK = require("../lib/ad-page-markets.js");

const LIVE = "https://lorenzosdogtrainingteam.com";
const markets = MK.MARKETS || MK.markets || MK;
const SKIP = new Set(["dog-training-miramar-beach-fl", "dog-training-panama-city-beach-fl", "dog-training-ann-arbor-mi"]);
const SHORT = {
  "dog-training-cleveland-oh": "cleveland",
  "dog-training-columbus-oh": "columbus",
  "dog-training-atlanta-ga": "atlanta",
  "dog-training-san-diego-ca": "san-diego",
  "dog-training-san-antonio-tx": "san-antonio",
  "dog-training-chicago-il": "chicago",
  "dog-training-tallahassee-fl": "tallahassee",
  "dog-training-pensacola-fl": "pensacola",
  "dog-training-lexington-ky": "lexington"
};
const DESIGN_CYCLE = ["d1", "d2", "d3"];
const STARTER_FOR = { d1: "miramar-beach", d2: "panama-city-beach", d3: "ann-arbor" };

const cut = (text, max) => {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const at = head.lastIndexOf(" ");
  return (at > max * 0.6 ? head.slice(0, at) : head).replace(/[,;:]$/, "");
};
const wrap4 = (text, closing) => {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > 58) { lines.push(line.trim()); line = w; if (lines.length === 3) break; }
    else line = (line + " " + w).trim();
  }
  if (lines.length < 3 && line) lines.push(line.trim());
  while (lines.length < 3) lines.push("");
  lines.length = 3;
  lines.push(closing);
  return lines.filter(Boolean).length === 4 ? lines : [...lines.filter(Boolean), closing].slice(0, 4);
};

const pages = [];
for (const m of markets) {
  const short = SHORT[m.slug];
  if (!short || SKIP.has(m.slug)) continue;
  const design = DESIGN_CYCLE[pages.length % 3];
  const c = A2.fromStarter(STARTER_FOR[design], { market: m.market, newSlug: short });
  // Wording migrated from the original page
  c.top = cut(m.h1 || m.title, 110);
  c.h1 = [cut(`${m.city.toUpperCase()} DOG TRAINING.`, 28), "REAL RESULTS AT HOME."];
  c.sub = wrap4(m.hook, "Start with a free in-home evaluation.");
  c.title = cut(m.title ? `${m.title} | Lorenzo's` : m.market, 90);
  c.desc = cut(m.hook, 200);
  c.zip = (m.zipCodes && m.zipCodes[0]) || c.zip;
  c.f_p1 = cut(`In ${m.city}, your request is coordinated by Lorenzo's office with ${m.trainers}. They train the method Lorenzo Miller built over 40+ years in Cleveland, the same one used by professional trainers across {n} states.`, 420);
  if (design === "d1") {
    c.check = (m.issues || "").split("|").map(s => cut(s, 44)).filter(Boolean).slice(0, 4);
    while (c.check.length < 4) c.check.push("Free in-home evaluation");
    c.inc = (m.benefits || "").split("|").map(s => cut(s, 40)).filter(Boolean).slice(0, 4);
    const incPad = ["A trainer sees your dog at home", "A clear program and next steps", "A straight answer on fit", "Talk through your daily routine"];
    for (const p of incPad) { if (c.inc.length >= 4) break; if (!c.inc.includes(p)) c.inc.push(p); }
    if (m.care) {
      c.c_eyebrow = cut(m.care.eyebrow || c.c_eyebrow, 40);
      c.c_head = cut(m.care.h2 || c.c_head, 50);
      c.c_sub = cut(`${m.care.t || ""} Book a free in-home evaluation or call 866.436.4959.`, 180);
    }
    c.loc_sub = cut(`${m.area}. In-home evaluations by appointment.`, 140);
  }
  if (design === "d3") c.loc_sub = cut(`${m.area}. In-home evaluations by appointment.`, 140);
  // Photos migrated from the original page (same photos, absolute https so the 2.0 page can draw them)
  const url = rel => (rel ? `${LIVE}/${String(rel).replace(/^\/+/, "")}` : "");
  if (m.photo) { c.photos.hero = url(m.photo); c.photos.heroM = url(m.photo); }
  if (design === "d1" && m.photo2) { c.photos.golden = url(m.photo2); c.photos.aussie = url(m.photo2); }
  if (design === "d3" && m.photo2) c.photos.about = url(m.photo2);
  const clean = A2.normalizeContent(c);
  clean.slug = short;
  const html = A2.renderPage(clean, { practice: true }); // must render without crashing
  if (!html.includes(m.city)) throw new Error(`render check failed for ${short}`);
  pages.push({ short, m, clean, design });
}

const lit = v => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const txt = v => `'${String(v).replace(/'/g, "''")}'`;
let sql = "-- 2.0 pages for every market, content migrated from the original ad pages (chat 2026-09-16).\n";
sql += "-- The three Arrison starter pages and every old pixel ad page are untouched.\n";
for (const p of pages) {
  sql += `INSERT INTO practice.ad_pages (slug, page_type, status, title, market, city, state, draft_content, published_content, published_revision, published_at, created_by, updated_by)
SELECT ${txt(p.short)}, 'ad2', 'published', ${txt(p.clean.title)}, ${txt(p.clean.market)}, ${txt(p.clean.city)}, ${txt(p.clean.state)}, x.c, x.c, 1, now(), 'Joshua Matthews (2.0 market migration)', 'Joshua Matthews (2.0 market migration)'
FROM (SELECT ${lit(p.clean)} AS c) x
WHERE NOT EXISTS (SELECT 1 FROM practice.ad_pages WHERE slug = ${txt(p.short)});\n`;
}
writeFileSync(new URL("../.migrate-ad2-markets.sql", import.meta.url), sql);
console.log(`built ${pages.length} pages:`, pages.map(p => `${p.short}(${p.design})`).join(", "));
console.log("SQL written to .migrate-ad2-markets.sql");
