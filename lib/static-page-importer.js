// Turns one of the static site pages (about.html, facility.html, contact.html,
// dog-training.html, basic-obedience.html, behavior-help.html, get-started.html)
// into Site Builder block content, so the office can take a page over without
// retyping a word. The static file is NOT deleted: the database page only wins
// once it is published (middleware.js checks the published list), and
// Unpublish puts the static file straight back.
//
// How it reads a page: the <main>/<body> is split into <section> chunks; each
// chunk becomes the block that fits its markup (page hero → Hero, split with a
// photo → Image + text, gallery → Image gallery, stats band → Numbers, CTA band
// → Call to action, a contact-intake form → Contact form, headquarters card →
// Map + address, program cards → Feature columns). Anything else becomes a Rich
// text block holding the section's headings, paragraphs, lists and links, run
// through the sanitiser. Nothing is invented; words that do not fit a typed
// block are kept as rich text rather than dropped.
//
// Node only (reads files). Pure functions take the HTML string so tests can
// feed them anything.
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const site = require("./site-page-template.js");
const { sanitizeRichText, textOnly, decodeEntities } = require("./html-sanitize.js");

const IMPORTABLE = [
  { slug: "about", file: "about.html", title: "About" },
  { slug: "facility", file: "facility.html", title: "Our Facility" },
  { slug: "contact", file: "contact.html", title: "Contact" },
  { slug: "dog-training", file: "dog-training.html", title: "Dog Training" },
  { slug: "basic-obedience", file: "basic-obedience.html", title: "Basic Obedience" },
  { slug: "behavior-help", file: "behavior-help.html", title: "Behavior Help" },
  { slug: "get-started", file: "get-started.html", title: "Get Started" }
  // Rachel 2026-09-09: "you cannot get to all of the website pages" — every
  // general page the importer can faithfully turn into blocks is listed here
  // (terms, privacy-policy and onboarding do not slice into blocks, so they stay
  // static-only until they do).
  // Generated pages (trainer pages, recruiting cities, ad markets) stay out on
  // purpose: they are built by their own tools.
  // specialty-advanced and become-a-trainer stay static too (review 2026-09-10):
  // the importer drops their local mp4 videos, the second call-to-action button
  // and the stats band, so publishing an import would degrade the live page.
];

const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag) || new RegExp(`\\s${name}='([^']*)'`, "i").exec(tag); return m ? decodeEntities(m[1]) : ""; };
const classesOf = tag => attr(tag, "class").split(/\s+/).filter(Boolean);
const clean = value => textOnly(value).slice(0, 4000);
const href = value => { const h = String(value || "").trim(); if (!h) return ""; if (/^https?:|^mailto:|^tel:|^#|^\//i.test(h)) return h.replace(/\.html(?=$|#|\?)/, ""); return `/${h.replace(/^\.\//, "").replace(/\.html(?=$|#|\?)/, "")}`; };
const src = value => { const s = String(value || "").trim(); return /^https?:/i.test(s) ? s : s ? `/${s.replace(/^\.?\//, "")}` : ""; };

// Balanced <tag ...>...</tag> slices (sections/figures/forms are never
// self-nested in these pages beyond one level, but this handles it anyway).
function slices(html, tag) {
  const out = [];
  const open = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
  let m;
  while ((m = open.exec(html))) {
    let depth = 1; let i = open.lastIndex;
    const re = new RegExp(`<(/?)${tag}(\\s[^>]*)?>`, "gi"); re.lastIndex = i;
    let n;
    while (depth && (n = re.exec(html))) { depth += n[1] ? -1 : 1; i = re.lastIndex; }
    out.push({ tag: m[0], inner: html.slice(open.lastIndex, depth ? html.length : i - (n ? n[0].length : 0)), outer: html.slice(m.index, i) });
    open.lastIndex = i;
  }
  return out;
}
const first = (html, re) => { const m = re.exec(html); return m ? m[1] : ""; };
const headingText = html => clean(first(html, /<h[123][^>]*>([\s\S]*?)<\/h[123]>/i));
const eyebrowText = html => clean(first(html, /<span class="eyebrow"[^>]*>([\s\S]*?)<\/span>/i));
const links = html => [...html.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/gi)].map(m => ({ tag: m[1], label: clean(m[2]), href: href(attr(`<a ${m[1]}>`, "href")) }));
const images = html => [...html.matchAll(/<img\s([^>]*)>/gi)].map(m => ({ src: src(attr(`<img ${m[1]}>`, "src")), alt: attr(`<img ${m[1]}>`, "alt") })).filter(i => i.src);
const buttonsOf = html => links(html).filter(l => /\bbtn\b/.test(l.tag)).slice(0, 2).map(l => ({ label: l.label, href: l.href, style: /btn-red|btn-navy/.test(l.tag) ? "primary" : "outline" }));
// Rich text from a chunk: drop the eyebrow/heading already used, drop figures/forms/buttons, keep the rest.
function richOf(html, { dropHeading = true } = {}) {
  let body = html.replace(/<figure[\s\S]*?<\/figure>/gi, "").replace(/<form[\s\S]*?<\/form>/gi, "").replace(/<span class="eyebrow"[^>]*>[\s\S]*?<\/span>/gi, "").replace(/<a\s[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "").replace(/<div class="hero-actions">[\s\S]*?<\/div>/gi, "");
  if (dropHeading) body = body.replace(/<h[123][^>]*>[\s\S]*?<\/h[123]>/i, "");
  return sanitizeRichText(body);
}
const design = (cls, extra = {}) => ({ ...site.blankDesign(), ...(cls.includes("soft") ? { bgColor: "#f4f8fc" } : {}), ...(cls.includes("navy") ? { bgColor: "#062650", tone: "light" } : {}), ...(cls.includes("tight") ? { padding: "tight" } : {}), ...extra });
const withId = block => ({ ...block, id: `${block.type}-${Math.random().toString(36).slice(2, 8)}` });

function sectionToBlocks(sec, page) {
  const cls = classesOf(sec.tag);
  const id = attr(sec.tag, "id");
  const inner = sec.inner;
  const anchor = id ? { anchor: id } : {};
  const blocks = [];
  const base = type => withId({ ...site.blankBlock(type, { slug: page.slug }), design: design(cls, anchor) });

  if (cls.includes("page-hero") || cls.includes("ad-hero-v2")) {
    const img = images(inner)[0];
    blocks.push({ ...base("hero"), style: img ? "image" : "solid", image: img ? img.src : "", eyebrow: eyebrowText(inner), headline: headingText(inner), sub: clean(first(inner, /<p class="(?:lead|ad-lead)"[^>]*>([\s\S]*?)<\/p>/i)) || clean(first(inner, /<p[^>]*>([\s\S]*?)<\/p>/i)), buttons: buttonsOf(inner), design: { ...site.blankDesign(), padding: "none", width: "full", ...anchor } });
    const stats = statsOf(inner); if (stats) blocks.push(stats);
    return blocks;
  }
  if (cls.includes("stats-wrap") || cls.includes("ad-proof-band-v2")) { const s = statsOf(sec.outer); if (s) blocks.push(s); return blocks; }
  if (/contact-intake/.test(inner)) {
    const before = inner.split(/<form/i)[0];
    blocks.push({ ...base("form"), heading: headingText(before) || "Request a Service", text: clean(first(before, /<p[^>]*>([\s\S]*?)<\/p>/i)).slice(0, 400), sourcePage: page.slug });
    return blocks;
  }
  if (/headquarters-card/.test(inner)) {
    const card = slices(inner, "div").find(d => /headquarters-card/.test(d.tag))?.inner || inner;
    const item = label => clean(first(card, new RegExp(`<strong>${label}</strong>([\\s\\S]*?)</div>`, "i")));
    blocks.push({ ...base("map"), heading: headingText(card), text: clean(first(card, /<p[^>]*>([\s\S]*?)<\/p>/i)), address: item("Address") || site.blankBlock("map").address, phone: item("Phone") || "(866) 436-4959", email: item("Email") || "production@lorenzosdogtrainingteam.com", hours: item("Hours") || "", showMap: true });
    const rest = inner.replace(/<div class="headquarters-card">[\s\S]*?<\/div><\/div><\/div>/i, "");
    const extra = richOf(rest, { dropHeading: false });
    if (textOnly(extra).length > 20) blocks.push({ ...base("richtext"), html: extra, design: design(cls) });
    return blocks;
  }
  if (cls.includes("market-guide-section") || /pdf-optin/.test(inner)) {
    blocks.push({ ...base("richtext"), html: sanitizeRichText(`<h2>${site.escapeHtml(headingText(inner))}</h2>${richOf(inner)}`) });
    blocks.push({ ...base("buttons"), buttons: [{ label: "Get the free guide", href: "/get-started#free-ebook", style: "primary" }] });
    return blocks;
  }
  if (/cta-band/.test(inner)) {
    const band = slices(inner, "div").find(d => /cta-band/.test(d.tag))?.inner || inner;
    const btn = buttonsOf(band);
    blocks.push({ ...base("cta"), heading: headingText(band), text: clean(first(band, /<p[^>]*>([\s\S]*?)<\/p>/i)), button: btn[0] || { label: "Book Evaluation", href: "/contact", style: "primary" }, button2: btn[1] || { label: "", href: "", style: "outline" }, design: design(cls, { padding: "tight", ...anchor }) });
    return blocks;
  }
  if (/facility-gallery|campus-row/.test(inner)) {
    const head = headingText(inner);
    const figs = slices(inner, "figure").map(f => ({ image: images(f.inner)[0]?.src || "", alt: images(f.inner)[0]?.alt || "", caption: clean(first(f.inner, /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)) })).filter(f => f.image);
    if (head) blocks.push({ ...base("richtext"), html: sanitizeRichText(`<h2>${site.escapeHtml(head)}</h2>${richOf(inner.replace(/<figure[\s\S]*?<\/figure>/gi, ""))}`), design: design(cls, { padding: "tight", ...anchor }) });
    blocks.push({ ...base("gallery"), heading: "", columns: figs.length === 4 ? 2 : Math.min(3, Math.max(2, figs.length)), items: figs });
    return blocks;
  }
  if (/facility-feature/.test(inner)) {
    const img = images(inner)[0];
    const cap = slices(inner, "div").find(d => /facility-caption/.test(d.tag))?.inner || "";
    blocks.push({ ...base("imagetext"), image: img?.src || "", alt: img?.alt || "", side: "left", eyebrow: eyebrowText(inner), heading: headingText(inner) || headingText(cap), html: sanitizeRichText(`<p>${site.escapeHtml(clean(first(cap, /<p[^>]*>([\s\S]*?)<\/p>/i)))}</p>${richOf(inner.replace(cap, ""))}`), button: { label: "", href: "", style: "primary" } });
    return blocks;
  }
  if (/program-detail|service-grid|ad-service-grid-v2/.test(inner)) {
    const cards = [...slices(inner, "article"), ...slices(inner, "a").filter(a => /service-card|ad-service-card/.test(a.tag)), ...slices(inner, "div").filter(d => /detail-card|service-card|ad-service-card/.test(d.tag))];
    const seen = new Set();
    const items = cards.filter(c => { if (seen.has(c.outer)) return false; seen.add(c.outer); return true; }).map(c => ({ icon: "", image: images(c.inner)[0]?.src || "", title: clean(first(c.inner, /<h[234][^>]*>([\s\S]*?)<\/h[234]>/i)), text: clean(c.inner.replace(/<h[234][^>]*>[\s\S]*?<\/h[234]>/i, "").replace(/<img[^>]*>/gi, "")).slice(0, 400), href: href(attr(c.tag, "href")) || links(c.inner)[0]?.href || "" })).filter(i => i.title).slice(0, 8);
    blocks.push({ ...base("columns"), eyebrow: eyebrowText(inner), heading: headingText(inner), text: clean(first(slices(inner, "div").find(d => /section-title/.test(d.tag))?.inner || "", /<p[^>]*>([\s\S]*?)<\/p>/i)).slice(0, 400), count: Math.min(4, Math.max(2, items.length || 3)), items });
    return blocks;
  }
  if (/review-summary|review-shot-grid/.test(inner)) {
    blocks.push({ ...base("testimonials"), eyebrow: eyebrowText(inner), heading: headingText(inner) || "Client feedback from real training results.", source: "approved", destinationId: "lorenzos-team", items: [] });
    return blocks;
  }
  if (/photo-card|founder-grid/.test(inner) && images(inner).length) {
    const img = images(inner)[0];
    const figFirst = inner.indexOf("<figure") !== -1 && inner.indexOf("<figure") < inner.search(/<(div|span|h2)/);
    blocks.push({ ...base("imagetext"), image: img.src, alt: img.alt, side: figFirst ? "left" : "right", eyebrow: eyebrowText(inner), heading: headingText(inner), html: richOf(inner), button: buttonsOf(inner)[0] || { label: "", href: "", style: "primary" } });
    return blocks;
  }
  // Fallback: everything as rich text (headings, paragraphs, lists, links, images kept).
  const html = sanitizeRichText(inner.replace(/<span class="eyebrow"[^>]*>([\s\S]*?)<\/span>/i, "<p><strong>$1</strong></p>"));
  if (textOnly(html)) blocks.push({ ...base("richtext"), html });
  const btn = buttonsOf(inner);
  if (btn.length) blocks.push({ ...base("buttons"), buttons: btn });
  return blocks;
}

function statsOf(html) {
  const items = [...html.matchAll(/<div class="stat"[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<span>([\s\S]*?)<\/span>/gi)].map(m => ({ value: clean(m[1]).slice(0, 20), label: clean(m[2]).slice(0, 60) }));
  const proof = [...html.matchAll(/<strong>([\s\S]*?)<\/strong>\s*<span>([\s\S]*?)<\/span>/gi)].map(m => ({ value: clean(m[1]).slice(0, 20), label: clean(m[2]).slice(0, 60) }));
  const list = (items.length ? items : proof).filter(i => i.value && i.label).slice(0, 6);
  return list.length >= 2 ? withId({ ...site.blankBlock("stats"), items: list }) : null;
}

// html → site page content (not yet normalised; callers run normalizeSitePage).
function importStaticHtml(html, page) {
  const bodyStart = Math.max(html.indexOf("</header>"), 0);
  const bodyEnd = html.indexOf("<footer");
  const body = html.slice(bodyStart, bodyEnd === -1 ? html.length : bodyEnd);
  const title = decodeEntities(first(html, /<title>([\s\S]*?)<\/title>/i)).replace(/\s*\|\s*Lorenzo's Dog Training Team\s*$/i, "").trim();
  const description = attr(first(html, /(<meta name="description"[^>]*>)/i) || "", "content");
  const blocks = [];
  slices(body, "section").forEach(sec => { try { blocks.push(...sectionToBlocks(sec, page)); } catch (error) { blocks.push(withId({ ...site.blankBlock("richtext"), html: sanitizeRichText(sec.inner) })); } });
  const content = site.normalizeSitePage({
    pageType: page.slug === "get-started" ? "landing" : "site",
    chrome: page.slug === "get-started" ? "slim" : "full",
    slug: page.slug, title: title || page.title,
    seo: { title, description },
    blocks
  });
  return { content, words: textOnly(body).length, importedWords: textOnly(blocks.map(blockWords).join(" ")).length };
}
function blockWords(b) { return Object.values(b).flatMap(v => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(i => (i && typeof i === "object" ? Object.values(i).filter(x => typeof x === "string") : [String(i)])) : [])).join(" "); }

function importStaticPage(slug, root = resolve(__dirname, "..")) {
  const page = IMPORTABLE.find(p => p.slug === slug);
  if (!page) throw Object.assign(new Error(`"${slug}" is not one of the pages that can be imported.`), { status: 400 });
  const file = resolve(root, page.file);
  if (!existsSync(file)) throw Object.assign(new Error(`${page.file} is not on this deployment, so it cannot be imported here.`), { status: 404 });
  return importStaticHtml(readFileSync(file, "utf8"), page);
}

module.exports = { IMPORTABLE, importStaticHtml, importStaticPage, slices };
