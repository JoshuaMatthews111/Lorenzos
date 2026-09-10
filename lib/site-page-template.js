// Site Builder — shared template for SITE pages and LANDING pages built from
// blocks (About, Services, Contact, Facility, market landing pages, anything
// the office wants). Ad landing pages keep lib/ad-page-template.js.
//
// Used by
//   - api/ad-page.js                     serves published pages (/p/<slug> and
//                                        the page's clean path, e.g. /about)
//   - api/pages.js                       normalises + checks before storing
//   - trainer-backoffice/page-studio.js  the live canvas in the browser
// so the three can never drift apart.
//
// Same rules as the ad template: the office edits STRUCTURED fields, never raw
// HTML. Every string is escaped, every URL and colour checked, every unknown
// key dropped by normalizeSitePage(). The one "rich text" field is a small
// allow-listed subset rebuilt by lib/html-sanitize.js. The head (Meta pixel,
// Google tag, canonical, OG) and the footer are shared with the ad template.
//
// CommonJS + browser global on purpose.
(function (root, factory) {
  const deps = typeof module !== "undefined" && module.exports
    ? { ad: require("./ad-page-template.js"), san: require("./html-sanitize.js") }
    : { ad: root.LDTT_AD_PAGE_TEMPLATE, san: root.LDTT_HTML_SANITIZE };
  const mod = factory(deps.ad, deps.san);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.LDTT_SITE_PAGE_TEMPLATE = mod;
})(typeof globalThis !== "undefined" ? globalThis : this, function (AD, SAN) {
"use strict";
const { escapeHtml, metaPixelHead, googleAdsHead, conversionAndAttributionScript, attributionInputs, SITE_ORIGIN, cacheVersion } = AD;
const { sanitizeRichText, textOnly } = SAN;

const SITE_VERSION = "20260905site1";
const PHONE = "(866) 436-4959";
const PHONE_HREF = "tel:+18664364959";
const HQ_ADDRESS = "4805 Orchard Rd, Garfield Heights, OH 44125";

// ---------------------------------------------------------------------------
// Curated design choices. Anything outside these lists is refused.
// ---------------------------------------------------------------------------
const SITE_FONTS = [
  { id: "", label: "Site default (Inter)", family: "", stack: "", kind: "sans" },
  { id: "inter", label: "Inter", family: "Inter", stack: `"Inter",Arial,sans-serif`, kind: "sans" },
  { id: "montserrat", label: "Montserrat", family: "Montserrat", stack: `"Montserrat","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "poppins", label: "Poppins", family: "Poppins", stack: `"Poppins","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "nunito", label: "Nunito", family: "Nunito", stack: `"Nunito","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "raleway", label: "Raleway", family: "Raleway", stack: `"Raleway","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "oswald", label: "Oswald", family: "Oswald", stack: `"Oswald","Inter",Arial,sans-serif`, kind: "display" },
  { id: "bebas", label: "Bebas Neue", family: "Bebas Neue", stack: `"Bebas Neue","Oswald",Arial,sans-serif`, kind: "display" },
  { id: "playfair", label: "Playfair Display", family: "Playfair Display", stack: `"Playfair Display",Georgia,serif`, kind: "serif" },
  { id: "lora", label: "Lora", family: "Lora", stack: `"Lora",Georgia,serif`, kind: "serif" },
  { id: "merriweather", label: "Merriweather", family: "Merriweather", stack: `"Merriweather",Georgia,serif`, kind: "serif" },
  { id: "roboto", label: "Roboto", family: "Roboto", stack: `"Roboto","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "opensans", label: "Open Sans", family: "Open Sans", stack: `"Open Sans","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "lato", label: "Lato", family: "Lato", stack: `"Lato","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "worksans", label: "Work Sans", family: "Work Sans", stack: `"Work Sans","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "dmsans", label: "DM Sans", family: "DM Sans", stack: `"DM Sans","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "manrope", label: "Manrope", family: "Manrope", stack: `"Manrope","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "outfit", label: "Outfit", family: "Outfit", stack: `"Outfit","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "rubik", label: "Rubik", family: "Rubik", stack: `"Rubik","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "sourcesans", label: "Source Sans 3", family: "Source Sans 3", stack: `"Source Sans 3","Inter",Arial,sans-serif`, kind: "sans" },
  { id: "librebaskerville", label: "Libre Baskerville", family: "Libre Baskerville", stack: `"Libre Baskerville",Georgia,serif`, kind: "serif" },
  { id: "cormorant", label: "Cormorant Garamond", family: "Cormorant Garamond", stack: `"Cormorant Garamond",Georgia,serif`, kind: "serif" },
  { id: "archivoblack", label: "Archivo Black", family: "Archivo Black", stack: `"Archivo Black","Inter",Arial,sans-serif`, kind: "display" }
];
const FONT_BY_ID = Object.fromEntries(SITE_FONTS.map(f => [f.id, f]));
// Quick picks: a headline + body pair that reads well together.
const FONT_PAIRS = [
  { id: "default", label: "Site default", head: "", body: "" },
  { id: "bold-modern", label: "Bold modern — Montserrat + Inter", head: "montserrat", body: "inter" },
  { id: "friendly", label: "Friendly — Poppins + Nunito", head: "poppins", body: "nunito" },
  { id: "classic", label: "Classic — Playfair Display + Lora", head: "playfair", body: "lora" },
  { id: "editorial", label: "Editorial — Libre Baskerville + Source Sans 3", head: "librebaskerville", body: "sourcesans" },
  { id: "strong", label: "Strong — Oswald + Open Sans", head: "oswald", body: "opensans" },
  { id: "poster", label: "Poster — Bebas Neue + Work Sans", head: "bebas", body: "worksans" },
  { id: "clean", label: "Clean — Manrope + DM Sans", head: "manrope", body: "dmsans" },
  { id: "warm", label: "Warm — Merriweather + Lato", head: "merriweather", body: "lato" },
  { id: "elegant", label: "Elegant — Cormorant Garamond + Raleway", head: "cormorant", body: "raleway" },
  { id: "punchy", label: "Punchy — Archivo Black + Rubik", head: "archivoblack", body: "rubik" },
  { id: "geometric", label: "Geometric — Outfit + Roboto", head: "outfit", body: "roboto" }
];

const DEFAULT_THEME = {
  version: 1,
  fontHead: "", fontBody: "", baseSize: "16",
  colors: { primary: "#062650", secondary: "#f4f8fc", accent: "#ce1233", background: "#ffffff", text: "#0f2340" },
  buttonShape: "rounded", buttonFill: "filled",
  spacing: "normal",
  logo: "", logoDark: "", favicon: "",
  tagline: "Serious Training. Serious Results.",
  phone: PHONE
};
const BASE_SIZES = ["15", "16", "17", "18"];
const BUTTON_SHAPES = ["rounded", "pill", "square"];
const BUTTON_FILLS = ["filled", "outline"];
const SPACINGS = ["tight", "normal", "roomy"];
const PADDINGS = ["tight", "normal", "roomy", "none"];
const WIDTHS = ["narrow", "normal", "wide", "full"];
const ALIGNS = ["left", "center"];
const TEXT_TONES = ["", "light", "dark"];
const PAGE_TYPES = ["site", "landing"];
const CHROMES = ["full", "slim", "none"];
const RESERVED_SLUGS = new Set(["api", "ads", "p", "assets", "trainer-backoffice", "lib", "staff", "index", "sitemap", "robots", "onboarding", "trainer-application", "trainer-profile", "terms", "privacy-policy", "find-a-trainer", "become-a-trainer", "specialty-advanced", "middleware"]);

// The static site's menus, used whenever the Navigation screen has nothing saved.
const STATIC_NAV = {
  header: {
    links: [
      { label: "Home", href: "/" },
      { label: "Dog Training", href: "/dog-training" },
      { label: "Behavior Help", href: "/behavior-help" },
      { label: "Specialty Training", href: "/specialty-advanced" },
      { label: "Become a Professional Dog Trainer", href: "/become-a-trainer" },
      { label: "Find a Trainer", href: "/find-a-trainer" },
      { label: "Our Facility", href: "/facility" },
      { label: "About", href: "/about", children: [{ label: "About Us", href: "/about#about-us" }, { label: "About the Founder", href: "/about#founder" }] },
      { label: "Contact", href: "/contact" }
    ],
    ctas: [{ label: "Leave a Review", href: "/#home-review-form" }, { label: "Book Evaluation", href: "/contact" }]
  },
  footer: {
    blurb: "Helping keep dogs out of shelters and in safe, happy homes through leadership, rules, and boundaries.",
    groups: [
      { title: "Dog Owners", links: [{ label: "Dog Training", href: "/dog-training" }, { label: "Behavior Help", href: "/behavior-help" }] },
      { title: "Explore", links: [{ label: "Specialty Training", href: "/specialty-advanced" }, { label: "Find a Trainer", href: "/find-a-trainer" }, { label: "Our Facility", href: "/facility" }] },
      { title: "Team", links: [{ label: "Become a Professional Dog Trainer", href: "/become-a-trainer" }, { label: "About", href: "/about" }, { label: "Contact", href: "/contact" }] }
    ]
  }
};

// ---------------------------------------------------------------------------
// Block library. `fields` documents what the office edits; `blank` is what a
// freshly added block holds. normalizeBlock() is written per type below.
// ---------------------------------------------------------------------------
const BLOCK_TYPES = [
  { type: "hero", label: "Hero", help: "Big headline with a photo, video or solid colour behind it, and up to two buttons.", group: "Top of page" },
  { type: "richtext", label: "Rich text", help: "Paragraphs with bold, italic, links, lists and headings.", group: "Words" },
  { type: "imagetext", label: "Image + text", help: "A photo on the left or right with a heading and text beside it.", group: "Words" },
  { type: "columns", label: "Feature columns", help: "2 to 4 cards side by side, each with an icon or photo, a title and text.", group: "Words" },
  { type: "steps", label: "Steps / How it works", help: "Numbered steps in order.", group: "Words" },
  { type: "faq", label: "FAQ", help: "Questions that open and close.", group: "Words" },
  { type: "gallery", label: "Image gallery", help: "A grid of photos with optional captions.", group: "Media" },
  { type: "video", label: "Video", help: "A YouTube or Vimeo video by its id.", group: "Media" },
  { type: "stats", label: "Numbers", help: "Big numbers with a label under each.", group: "Proof" },
  { type: "testimonials", label: "Reviews", help: "Approved reviews from the Reviews tab, or ones you type.", group: "Proof" },
  { type: "trainers", label: "Trainer strip", help: "Live trainers from a market, or hand-picked.", group: "Proof" },
  { type: "pricing", label: "Pricing / Offer", help: "Plans or offers with a price, a list and a button.", group: "Action" },
  { type: "cta", label: "Call to action band", help: "A coloured band with a heading and a button.", group: "Action" },
  { type: "buttons", label: "Button row", help: "One to four buttons in a row.", group: "Action" },
  { type: "form", label: "Contact form", help: "The office lead form. Tracked by the pixel; on the practice copy it is switched off.", group: "Action" },
  { type: "map", label: "Map + address", help: "The headquarters address, phone, hours and a map.", group: "Action" },
  { type: "divider", label: "Divider / spacer", help: "A thin line or empty space between blocks.", group: "Layout" }
];
const BLOCK_TYPE_SET = new Set(BLOCK_TYPES.map(b => b.type));
const BLOCK_LABEL = type => BLOCK_TYPES.find(b => b.type === type)?.label || type;

const text = (value, max = 600) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const longText = value => text(value, 4000);
const bool = value => value === true || value === "true" || value === "1" || value === 1;
const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);
const safeColor = (value, fallback = "") => (/^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim().toLowerCase() : fallback);
const safeSlug = value => text(value, 80).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const safeId = value => (/^[a-z0-9-]{1,40}$/.test(String(value || "")) ? String(value) : "");
const uid = prefix => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const safeHref = value => SAN.safeHref(value);
const safeSrc = value => SAN.safeSrc(value) || (/^https:\/\/[^\s"'<>\\]+$/i.test(text(value, 700)) ? text(value, 700) : "");
const safeVideoId = value => (/^[A-Za-z0-9_-]{3,40}$/.test(String(value || "").trim()) ? String(value).trim() : "");
const safeAnchor = value => text(value, 60).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
const clampInt = (value, min, max, fallback) => { const n = parseInt(value, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
const button = (raw, fallback = {}) => ({ label: text(raw?.label ?? fallback.label, 60), href: safeHref(raw?.href ?? fallback.href) || "", style: oneOf(raw?.style, ["primary", "outline", "link"], fallback.style || "primary") });
const items = (raw, max, shape) => (Array.isArray(raw) ? raw : []).slice(0, max).map(shape);

function blankDesign() { return { bgColor: "", bgImage: "", tone: "", padding: "normal", align: "left", width: "normal", hideMobile: false, anchor: "" }; }
function normalizeDesign(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    bgColor: safeColor(d.bgColor, ""), bgImage: safeSrc(d.bgImage), tone: oneOf(d.tone, TEXT_TONES, ""),
    padding: oneOf(d.padding, PADDINGS, "normal"), align: oneOf(d.align, ALIGNS, "left"), width: oneOf(d.width, WIDTHS, "normal"),
    hideMobile: bool(d.hideMobile), anchor: safeAnchor(d.anchor)
  };
}

function blankBlock(type, ctx = {}) {
  const city = ctx.city || "your city";
  const base = { id: uid(type), type, design: blankDesign() };
  switch (type) {
    case "hero": return { ...base, style: "image", image: "assets/get-started-premium-hero.jpg", video: "", poster: "", eyebrow: "Lorenzo's Dog Training Team", headline: "Serious Training. Serious Results.", sub: "Obedience, behavior help and specialty training for real homes, backed by the office.", buttons: [{ label: "Book Evaluation", href: "/contact", style: "primary" }, { label: "Find a Trainer", href: "/find-a-trainer", style: "outline" }], height: "normal", overlay: 60, design: { ...blankDesign(), padding: "none", width: "full" } };
    case "richtext": return { ...base, html: "<h2>Your heading here</h2><p>Your words here. Use the toolbar for <strong>bold</strong>, <em>italic</em>, links and lists.</p>" };
    case "imagetext": return { ...base, image: "assets/get-started-premium-hero.jpg", alt: "", side: "right", eyebrow: "Why families choose us", heading: "Real training for real dogs.", html: "<p>Tell the story here. What happens on day one, what changes by week four, and why the office stays involved.</p>", button: { label: "Book Evaluation", href: "/contact", style: "primary" } };
    case "columns": return { ...base, eyebrow: "What we do", heading: "Training built for real life.", text: "", count: 3, items: [
      { icon: "🐕", image: "", title: "Dog Obedience Training", text: "Practical obedience that helps your dog listen at home, on walks and around distractions.", href: "/dog-training" },
      { icon: "🛡️", image: "", title: "Behavior Modification", text: "Balanced support for aggression, reactivity, barking, pulling, jumping and anxiety.", href: "/behavior-help" },
      { icon: "⭐", image: "", title: "Specialty & Service Dog", text: "Protection, service, scent, utility and advanced control programs.", href: "/specialty-advanced" }
    ] };
    case "steps": return { ...base, eyebrow: "How it works", heading: "Three steps to a calmer dog.", text: "", items: [
      { title: "Free evaluation", text: "A trainer meets you and your dog and tells you what it will take." },
      { title: "A clear plan", text: "You know what happens next, and why." },
      { title: "Training that sticks", text: "Owner handoff lessons and the 90-day Limited Training Guarantee, in writing." }
    ] };
    case "faq": return { ...base, eyebrow: "Questions", heading: "Good questions. Straight answers.", items: [
      { q: "Is the evaluation really free?", a: "Yes. A trainer meets you and your dog, tells you what it will take, and there is no obligation." },
      { q: "How soon can we start?", a: "Most families are contacted the same day they submit the form and scheduled within the week." }
    ] };
    case "gallery": return { ...base, heading: "", columns: 3, items: [{ image: "assets/get-started-premium-hero.jpg", alt: "", caption: "" }] };
    case "video": return { ...base, provider: "youtube", videoId: "", heading: "", text: "" };
    case "stats": return { ...base, items: [{ value: "25+", label: "Years of experience" }, { value: "100,000+", label: "Dogs trained" }, { value: "50+", label: "Professional trainers" }, { value: "Free", label: "Evaluation" }] };
    case "testimonials": return { ...base, eyebrow: "Trusted by dog owners", heading: "What families say.", source: "typed", destinationId: "lorenzos-team", limit: 6, items: [{ quote: "Our dog listens now, at home and on walks. Worth every penny.", name: "A happy client", location: city, rating: 5 }] };
    case "trainers": return { ...base, eyebrow: "Your local team", heading: `Certified trainers serving ${city}.`, text: "Every Lorenzo's trainer is certified at our Cleveland headquarters and backed by the office.", mode: "market", market: ctx.market || "", slugs: [], limit: 6 };
    case "pricing": return { ...base, eyebrow: "Programs", heading: "Pick the path that fits.", text: "", plans: [
      { name: "Obedience", price: "From $1,250", note: "Private lessons, in-home options", features: ["Free evaluation", "Owner coaching built in", "90-day Limited Training Guarantee"], button: { label: "Book Evaluation", href: "/contact", style: "primary" }, featured: false },
      { name: "Board & Train", price: "From $2,500", note: "Your dog trains with a professional", features: ["Real skills that come home", "Handoff lessons included", "Slots fill 6–8 weeks ahead"], button: { label: "Book Evaluation", href: "/contact", style: "primary" }, featured: true }
    ] };
    case "cta": return { ...base, heading: "Ready for serious results?", text: "Submit the quick request and let Lorenzo's office help with the next step.", button: { label: "Book Evaluation", href: "/contact", style: "primary" }, button2: { label: "", href: "", style: "outline" }, design: { ...blankDesign(), padding: "tight" } };
    case "buttons": return { ...base, buttons: [{ label: "Book Evaluation", href: "/contact", style: "primary" }, { label: "Call " + PHONE, href: PHONE_HREF, style: "outline" }], design: { ...blankDesign(), align: "center", padding: "tight" } };
    case "form": return { ...base, heading: "Request a Service", text: "Tell us about your dog and the office will call you back.", sourcePage: ctx.slug || "" };
    case "map": return { ...base, heading: "Our Corporate Headquarters", address: HQ_ADDRESS, phone: PHONE, email: "production@lorenzosdogtrainingteam.com", hours: "Monday to Saturday, 9am to 6pm ET", showMap: true, text: "The Cleveland headquarters is where every Lorenzo's trainer is certified." };
    case "divider": return { ...base, style: "line", size: "normal", design: { ...blankDesign(), padding: "tight" } };
    default: return null;
  }
}

function normalizeBlock(raw, seen) {
  if (!raw || !BLOCK_TYPE_SET.has(raw.type)) return null;
  const type = raw.type;
  const base = blankBlock(type);
  const id = safeId(raw.id) && !seen.has(raw.id) ? raw.id : uid(type);
  seen.add(id);
  const block = { id, type, design: normalizeDesign(raw.design || base.design) };
  switch (type) {
    case "hero":
      Object.assign(block, { style: oneOf(raw.style, ["image", "video", "solid"], "image"), image: safeSrc(raw.image), video: safeSrc(raw.video), poster: safeSrc(raw.poster), eyebrow: text(raw.eyebrow, 80), headline: text(raw.headline, 160), sub: text(raw.sub, 400), buttons: items(raw.buttons, 2, b => button(b)).filter(b => b.label && b.href), height: oneOf(raw.height, ["short", "normal", "tall"], "normal"), overlay: clampInt(raw.overlay, 0, 90, 60) });
      break;
    case "richtext":
      block.html = sanitizeRichText(raw.html, { maxLength: 20000 });
      break;
    case "imagetext":
      Object.assign(block, { image: safeSrc(raw.image), alt: text(raw.alt, 200), side: oneOf(raw.side, ["left", "right"], "right"), eyebrow: text(raw.eyebrow, 80), heading: text(raw.heading, 160), html: sanitizeRichText(raw.html, { maxLength: 8000 }), button: button(raw.button, { label: "", href: "" }) });
      break;
    case "columns":
      Object.assign(block, { eyebrow: text(raw.eyebrow, 80), heading: text(raw.heading, 160), text: text(raw.text, 400), count: clampInt(raw.count, 2, 4, 3), items: items(raw.items, 8, i => ({ icon: text(i?.icon, 8), image: safeSrc(i?.image), title: text(i?.title, 80), text: text(i?.text, 400), href: safeHref(i?.href) })) });
      break;
    case "steps":
      Object.assign(block, { eyebrow: text(raw.eyebrow, 80), heading: text(raw.heading, 160), text: text(raw.text, 400), items: items(raw.items, 8, i => ({ title: text(i?.title, 80), text: text(i?.text, 400) })) });
      break;
    case "faq":
      Object.assign(block, { eyebrow: text(raw.eyebrow, 80), heading: text(raw.heading, 160), items: items(raw.items, 12, i => ({ q: text(i?.q, 200), a: text(i?.a, 1000) })) });
      break;
    case "gallery":
      Object.assign(block, { heading: text(raw.heading, 160), columns: clampInt(raw.columns, 2, 4, 3), items: items(raw.items, 16, i => ({ image: safeSrc(i?.image), alt: text(i?.alt, 200), caption: text(i?.caption, 160) })).filter(i => i.image) });
      break;
    case "video":
      Object.assign(block, { provider: oneOf(raw.provider, ["youtube", "vimeo"], "youtube"), videoId: safeVideoId(raw.videoId), heading: text(raw.heading, 160), text: text(raw.text, 400) });
      break;
    case "stats":
      block.items = items(raw.items, 6, i => ({ value: text(i?.value, 20), label: text(i?.label, 60) }));
      break;
    case "testimonials":
      Object.assign(block, { eyebrow: text(raw.eyebrow, 80), heading: text(raw.heading, 160), source: oneOf(raw.source, ["approved", "typed"], "typed"), destinationId: text(raw.destinationId, 120) || "lorenzos-team", limit: clampInt(raw.limit, 1, 12, 6), items: items(raw.items, 12, i => ({ quote: text(i?.quote, 800), name: text(i?.name, 80), location: text(i?.location, 80), rating: clampInt(i?.rating, 1, 5, 5) })) });
      break;
    case "trainers":
      Object.assign(block, { eyebrow: text(raw.eyebrow, 80), heading: text(raw.heading, 160), text: text(raw.text, 400), mode: oneOf(raw.mode, ["market", "picked"], "market"), market: text(raw.market, 80), slugs: (Array.isArray(raw.slugs) ? raw.slugs : []).map(safeSlug).filter(Boolean).slice(0, 12), limit: clampInt(raw.limit, 1, 12, 6) });
      break;
    case "pricing":
      Object.assign(block, { eyebrow: text(raw.eyebrow, 80), heading: text(raw.heading, 160), text: text(raw.text, 400), plans: items(raw.plans, 4, p => ({ name: text(p?.name, 60), price: text(p?.price, 40), note: text(p?.note, 120), features: (Array.isArray(p?.features) ? p.features : String(p?.features || "").split("\n")).map(f => text(f, 120)).filter(Boolean).slice(0, 8), button: button(p?.button, { label: "", href: "" }), featured: bool(p?.featured) })) });
      break;
    case "cta":
      Object.assign(block, { heading: text(raw.heading, 160), text: text(raw.text, 400), button: button(raw.button, { label: "", href: "" }), button2: button(raw.button2, { label: "", href: "", style: "outline" }) });
      break;
    case "buttons":
      block.buttons = items(raw.buttons, 4, b => button(b)).filter(b => b.label && b.href);
      break;
    case "form":
      Object.assign(block, { heading: text(raw.heading, 160), text: text(raw.text, 400), sourcePage: safeSlug(raw.sourcePage) });
      break;
    case "map":
      Object.assign(block, { heading: text(raw.heading, 160), address: text(raw.address, 200), phone: text(raw.phone, 40), email: text(raw.email, 120).replace(/[<>"'\s]/g, ""), hours: text(raw.hours, 200), showMap: raw.showMap !== false && raw.showMap !== "false", text: text(raw.text, 400) });
      break;
    case "divider":
      Object.assign(block, { style: oneOf(raw.style, ["line", "space"], "line"), size: oneOf(raw.size, ["small", "normal", "large"], "normal") });
      break;
    default: return null;
  }
  return block;
}

// Theme: `partial` allows "" (inherit) so a page can override only some things.
function normalizeTheme(raw, { partial = false } = {}) {
  const t = raw && typeof raw === "object" ? raw : {};
  const c = t.colors && typeof t.colors === "object" ? t.colors : {};
  const d = DEFAULT_THEME;
  const color = (value, fallback) => safeColor(value, partial ? "" : fallback);
  return {
    version: 1,
    fontHead: FONT_BY_ID[t.fontHead] ? t.fontHead : "", fontBody: FONT_BY_ID[t.fontBody] ? t.fontBody : "",
    baseSize: BASE_SIZES.includes(String(t.baseSize)) ? String(t.baseSize) : (partial ? "" : d.baseSize),
    colors: { primary: color(c.primary, d.colors.primary), secondary: color(c.secondary, d.colors.secondary), accent: color(c.accent, d.colors.accent), background: color(c.background, d.colors.background), text: color(c.text, d.colors.text) },
    buttonShape: oneOf(t.buttonShape, BUTTON_SHAPES, partial ? "" : d.buttonShape), buttonFill: oneOf(t.buttonFill, BUTTON_FILLS, partial ? "" : d.buttonFill),
    spacing: oneOf(t.spacing, SPACINGS, partial ? "" : d.spacing),
    logo: safeSrc(t.logo), logoDark: safeSrc(t.logoDark), favicon: safeSrc(t.favicon),
    tagline: partial ? text(t.tagline, 80) : (text(t.tagline, 80) || d.tagline),
    phone: partial ? text(t.phone, 40) : (text(t.phone, 40) || d.phone)
  };
}
// Site theme + page overrides → the theme the renderer uses.
function resolveTheme(site, page) {
  const s = normalizeTheme(site);
  const p = normalizeTheme(page, { partial: true });
  const pick = (a, b) => (a ? a : b);
  return {
    version: 1,
    fontHead: pick(p.fontHead, s.fontHead), fontBody: pick(p.fontBody, s.fontBody), baseSize: pick(p.baseSize, s.baseSize),
    colors: Object.fromEntries(Object.keys(s.colors).map(k => [k, pick(p.colors[k], s.colors[k])])),
    buttonShape: pick(p.buttonShape, s.buttonShape), buttonFill: pick(p.buttonFill, s.buttonFill), spacing: pick(p.spacing, s.spacing),
    logo: pick(p.logo, s.logo), logoDark: pick(p.logoDark, s.logoDark), favicon: pick(p.favicon, s.favicon),
    tagline: pick(p.tagline, s.tagline), phone: pick(p.phone, s.phone)
  };
}

function normalizeNav(raw) {
  const n = raw && typeof raw === "object" ? raw : {};
  const link = l => ({ label: text(l?.label, 60), href: safeHref(l?.href) || "/", children: items(l?.children, 8, c => ({ label: text(c?.label, 60), href: safeHref(c?.href) || "/" })).filter(c => c.label) });
  const header = n.header && typeof n.header === "object" ? n.header : {};
  const footer = n.footer && typeof n.footer === "object" ? n.footer : {};
  return {
    version: 1,
    header: { links: items(header.links, 12, link).filter(l => l.label), ctas: items(header.ctas, 2, b => button(b)).filter(b => b.label) },
    footer: { blurb: text(footer.blurb, 300), groups: items(footer.groups, 4, g => ({ title: text(g?.title, 40), links: items(g?.links, 10, link).filter(l => l.label) })) }
  };
}
// Empty menus fall back to the static site's menus (DO-NOT-BREAK: header/footer never go blank).
function effectiveNav(raw) {
  const nav = normalizeNav(raw);
  if (!nav.header.links.length) nav.header = normalizeNav(STATIC_NAV).header;
  if (!nav.footer.groups.length) nav.footer = normalizeNav(STATIC_NAV).footer;
  return nav;
}

function normalizeSitePage(input) {
  const src = input && typeof input === "object" ? input : {};
  const seo = src.seo && typeof src.seo === "object" ? src.seo : {};
  const pageType = oneOf(src.pageType, PAGE_TYPES, "site");
  const out = {
    version: 2,
    pageType,
    slug: safeSlug(src.slug),
    title: text(src.title, 120),
    seo: { title: text(seo.title, 120), description: text(seo.description, 300), ogImage: safeSrc(seo.ogImage), noindex: bool(seo.noindex) },
    chrome: oneOf(src.chrome, CHROMES, pageType === "landing" ? "slim" : "full"),
    market: text(src.market, 80), city: text(src.city, 60), state: text(src.state, 2).toUpperCase(),
    theme: normalizeTheme(src.theme, { partial: true }),
    blocks: []
  };
  const seen = new Set();
  (Array.isArray(src.blocks) ? src.blocks : []).slice(0, 40).forEach(raw => { const b = normalizeBlock(raw, seen); if (b) out.blocks.push(b); });
  return out;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const BLOCK_STYLE = `
:root{--sb-primary:var(--navy);--sb-accent:var(--red)}
body.site-page{background:var(--sb-bg,#fff);color:var(--ink);font-size:var(--sb-base,16px)}
.site-page .btn-red{background:var(--red)}.site-page .btn-navy{background:var(--navy)}
.site-page.btn-pill .btn{border-radius:999px}.site-page.btn-square .btn{border-radius:4px}
.site-page.btn-outline-fill .btn-red{background:#fff;color:var(--red);border-color:var(--red);box-shadow:none}
.site-page.spacing-tight .sb{padding:44px 0}.site-page.spacing-normal .sb{padding:78px 0}.site-page.spacing-roomy .sb{padding:110px 0}
.sb.pad-tight{padding:34px 0!important}.sb.pad-roomy{padding:120px 0!important}.sb.pad-none{padding:0!important}
.sb{position:relative}.sb .container{position:relative;z-index:1}
.sb.w-narrow .container{max-width:760px}.sb.w-wide .container{max-width:1440px}.sb.w-full .container{width:100%;max-width:none}
.sb.al-center{text-align:center}.sb.al-center .sb-head{margin-left:auto;margin-right:auto}.sb.al-center .check-list li{justify-content:center}
.sb.tone-light{color:#fff}.sb.tone-light h1,.sb.tone-light h2,.sb.tone-light h3,.sb.tone-light p{color:#fff}.sb.tone-light .eyebrow{background:rgba(255,255,255,.14);color:#fff}
.sb.tone-dark,.sb.tone-dark h2,.sb.tone-dark h3{color:var(--ink)}
.sb-bgimg{background-size:cover;background-position:center}.sb-bgimg:before{content:"";position:absolute;inset:0;background:rgba(2,20,43,.62)}
.sb-head{max-width:800px;margin:0 0 30px}.sb-head h2{font-size:clamp(2rem,3.5vw,3.35rem);line-height:1.03;letter-spacing:-.045em;color:var(--navy);margin:12px 0 12px}.sb-head p{color:var(--muted);margin:0;font-size:1.06rem}
.sb-hero{min-height:520px}.sb-hero.h-short{min-height:380px}.sb-hero.h-tall{min-height:680px}.sb-hero video.hero-bg{object-fit:cover}
.sb-hero:after{background:linear-gradient(90deg,rgba(2,21,47,var(--ov,.6)) 0%,rgba(2,25,54,calc(var(--ov,.6) * .7)) 43%,rgba(2,25,54,.06) 75%)}
.sb-hero.solid{background:linear-gradient(135deg,var(--navy2),var(--navy))}.sb-hero.solid:after{background:none}
.sb-rich h2,.sb-rich h3,.sb-rich h4{color:var(--navy);letter-spacing:-.03em;line-height:1.1}.sb-rich h2{font-size:clamp(1.8rem,3vw,2.6rem)}.sb-rich h3{font-size:1.4rem}.sb-rich p{font-size:1.04rem;line-height:1.6;color:var(--ink);margin:0 0 16px}.sb-rich ul,.sb-rich ol{padding-left:22px;line-height:1.6}.sb-rich a{color:var(--red);text-decoration:underline;text-underline-offset:3px}.sb-rich blockquote{border-left:4px solid var(--red);margin:18px 0;padding:6px 18px;font-size:1.15rem;color:var(--navy)}.sb-rich img{border-radius:14px;margin:14px 0}
.sb-split{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center}.sb-split.img-left .photo-card{order:-1}.sb-split .sb-rich{margin-top:12px}
.sb-cols{display:grid;gap:18px}.sb-cols.c-2{grid-template-columns:repeat(2,1fr)}.sb-cols.c-3{grid-template-columns:repeat(3,1fr)}.sb-cols.c-4{grid-template-columns:repeat(4,1fr)}
.sb-card{display:block;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:26px;box-shadow:0 9px 28px rgba(4,32,69,.06);color:var(--ink)}.sb-card .ic{font-size:2rem;line-height:1;margin-bottom:12px}.sb-card img{width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:14px}.sb-card h3{margin:0 0 8px;font-size:1.25rem;color:var(--navy)}.sb-card p{margin:0;color:var(--muted)}a.sb-card:hover{border-color:var(--red)}
.sb-steps{display:grid;gap:18px;counter-reset:step}.sb-steps.c-3{grid-template-columns:repeat(3,1fr)}.sb-steps.c-4{grid-template-columns:repeat(4,1fr)}.sb-steps.c-2{grid-template-columns:repeat(2,1fr)}.sb-step{position:relative;padding:26px 26px 26px 78px;background:#fff;border:1px solid var(--line);border-radius:var(--radius)}.sb-step:before{counter-increment:step;content:counter(step,decimal-leading-zero);position:absolute;left:22px;top:22px;width:40px;height:40px;border-radius:50%;background:var(--red);color:#fff;display:grid;place-items:center;font-weight:900}.sb-step h3{margin:0 0 6px;color:var(--navy)}.sb-step p{margin:0;color:var(--muted)}
.sb-faq details{border:1px solid var(--line);border-radius:14px;background:#fff;margin-bottom:10px;padding:0 20px}.sb-faq summary{cursor:pointer;font-weight:900;color:var(--navy);padding:18px 0;font-size:1.05rem;list-style:none;display:flex;justify-content:space-between;gap:12px}.sb-faq summary::-webkit-details-marker{display:none}.sb-faq summary:after{content:"+";color:var(--red);font-size:1.4rem}.sb-faq details[open] summary:after{content:"−"}.sb-faq details p{margin:0 0 18px;color:var(--muted);line-height:1.6}
.sb-gallery{display:grid;gap:14px}.sb-gallery.c-2{grid-template-columns:repeat(2,1fr)}.sb-gallery.c-3{grid-template-columns:repeat(3,1fr)}.sb-gallery.c-4{grid-template-columns:repeat(4,1fr)}.sb-gallery figure{margin:0;border-radius:14px;overflow:hidden;position:relative;background:#dce5f0}.sb-gallery img{width:100%;aspect-ratio:4/3;object-fit:cover}.sb-gallery figcaption{position:absolute;left:10px;bottom:10px;background:rgba(2,25,54,.86);color:#fff;padding:7px 10px;border-radius:7px;font-size:.72rem;font-weight:800}
.sb-video{position:relative;aspect-ratio:16/9;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);background:#000}.sb-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.sb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}.sb-stat{background:var(--navy);color:#fff;border-radius:var(--radius);padding:26px 18px;text-align:center}.sb-stat strong{display:block;font-size:2.4rem;letter-spacing:-.04em;line-height:1}.sb-stat span{display:block;margin-top:6px;color:#c9d4ec;font-size:.86rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.sb-quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}.sb-quote{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:26px;box-shadow:0 9px 28px rgba(4,32,69,.06)}.sb-quote .stars{color:#f5b301;letter-spacing:2px;margin-bottom:10px}.sb-quote p{margin:0 0 14px;font-size:1.02rem;line-height:1.6}.sb-quote strong{display:block;color:var(--navy)}.sb-quote span{color:var(--muted);font-size:.86rem}
.sb-trainers{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}.sb-trainer{display:block;background:#fff;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;color:var(--ink)}.sb-trainer img{width:100%;aspect-ratio:1;object-fit:cover;object-position:top}.sb-trainer div{padding:16px}.sb-trainer strong{display:block;color:var(--navy);font-size:1.05rem}.sb-trainer span{color:var(--muted);font-size:.86rem}
.sb-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;align-items:stretch}.sb-plan{background:#fff;border:2px solid var(--line);border-radius:var(--radius);padding:28px;display:flex;flex-direction:column;gap:12px}.sb-plan.featured{border-color:var(--red);box-shadow:var(--shadow)}.sb-plan h3{margin:0;color:var(--navy);font-size:1.3rem}.sb-plan .price{font-size:2rem;font-weight:900;letter-spacing:-.04em;color:var(--navy)}.sb-plan .note{color:var(--muted);margin:0}.sb-plan ul{list-style:none;padding:0;margin:0;display:grid;gap:8px;flex:1}.sb-plan li:before{content:"✓ ";color:#159455;font-weight:900}
.sb-btns{display:flex;gap:12px;flex-wrap:wrap}.sb.al-center .sb-btns{justify-content:center}
.sb-form-wrap{display:grid;grid-template-columns:.9fr 1.1fr;gap:40px;align-items:start}.sb-form-wrap .contact-intake{margin:0}
.sb-map{display:grid;grid-template-columns:1fr 1fr;gap:24px}.sb-map iframe{width:100%;min-height:340px;border:0;border-radius:var(--radius)}
.sb-divider hr{border:0;border-top:1px solid var(--line);margin:0}.sb-divider.s-small{padding:12px 0!important}.sb-divider.s-large{padding:70px 0!important}
.sb-link-btn{font-weight:900;color:var(--red);text-decoration:underline;text-underline-offset:4px;padding:13px 6px}
@media(max-width:760px){.sb-split,.sb-cols.c-2,.sb-cols.c-3,.sb-cols.c-4,.sb-steps.c-2,.sb-steps.c-3,.sb-steps.c-4,.sb-form-wrap,.sb-map{grid-template-columns:1fr}.sb-gallery.c-3,.sb-gallery.c-4{grid-template-columns:repeat(2,1fr)}.sb.hide-mobile{display:none}.sb-hero{min-height:440px}.sb-hero.h-tall{min-height:540px}.site-page.spacing-roomy .sb{padding:70px 0}}
`;
const EDITOR_STYLE = `
[data-sb-block]{outline:2px dashed transparent;outline-offset:-2px;transition:outline-color .15s;cursor:pointer}
[data-sb-block]:hover{outline-color:rgba(216,15,53,.55)}
[data-sb-block].sb-selected{outline:3px solid #d80f35;outline-offset:-3px}
.sb-tools{position:absolute;top:10px;right:14px;z-index:40;display:none;gap:4px;background:#071f44;padding:4px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
[data-sb-block]:hover .sb-tools,[data-sb-block].sb-selected .sb-tools{display:flex}
.sb-tools button{min-width:36px;height:36px;border:0;border-radius:8px;background:rgba(255,255,255,.1);color:#fff;font:900 14px Inter,Arial,sans-serif;cursor:pointer}.sb-tools button:hover{background:#fff;color:#071f44}.sb-tools button.danger:hover{background:#d80f35;color:#fff}
.sb-tools .sb-drag{cursor:grab}
.sb-label{position:absolute;top:10px;left:14px;z-index:40;display:none;background:#d80f35;color:#fff;font:900 11px/1 Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:7px 10px;border-radius:999px}
[data-sb-block]:hover .sb-label,[data-sb-block].sb-selected .sb-label{display:block}
.sb-add{display:flex;justify-content:center;padding:6px 0;position:relative;z-index:35}
.sb-add button{min-height:48px;padding:0 22px;border:2px dashed #cbd8e8;border-radius:999px;background:#fff;color:#082754;font:900 14px Inter,Arial,sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(4,32,69,.12)}
.sb-add button:hover{border-color:#d80f35;color:#d80f35}
.sb-add.empty{padding:90px 20px;text-align:center}.sb-add.empty div{max-width:560px;margin:auto;font:500 16px/1.6 Inter,Arial,sans-serif;color:#53677f}.sb-add.empty h2{color:#082754;margin:0 0 8px;font-size:1.8rem}.sb-add.empty ol{text-align:left;margin:14px auto 22px;padding-left:22px}.sb-add.empty button{min-height:60px;font-size:17px;padding:0 30px;border-style:solid;background:#d80f35;color:#fff;border-color:#d80f35}
[data-sb-block].sb-dragging{opacity:.4}[data-sb-block].sb-drop-before{box-shadow:inset 0 6px 0 #d80f35}[data-sb-block].sb-drop-after{box-shadow:inset 0 -6px 0 #d80f35}
body{padding-bottom:120px}
`;

function fontHead(theme) {
  const head = FONT_BY_ID[theme.fontHead];
  const body = FONT_BY_ID[theme.fontBody];
  const families = [...new Set([head, body].filter(f => f && f.family).map(f => f.family))];
  const links = families.length ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families.map(f => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700;800;900`).join("&")}&display=swap">` : "";
  const rules = [];
  if (body?.stack) rules.push(`body.site-page{font-family:${body.stack}}`);
  if (head?.stack) rules.push(`body.site-page h1,body.site-page h2,body.site-page h3,body.site-page h4,body.site-page .sb-stat strong,body.site-page .sb-plan .price{font-family:${head.stack}}`);
  return { links, rules: rules.join("") };
}

function hexToRgb(hex) { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ""); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null; }
function luminance(hex) { const rgb = hexToRgb(hex); if (!rgb) return 1; const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); }
function contrastRatio(a, b) { const l1 = luminance(a), l2 = luminance(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
function darken(hex, amount = 0.25) { const rgb = hexToRgb(hex); if (!rgb) return hex; return `#${rgb.map(v => Math.round(v * (1 - amount)).toString(16).padStart(2, "0")).join("")}`; }
// Plain-words warnings the Theme screen shows. Also used by the checklist.
function themeWarnings(theme) {
  const t = normalizeTheme(theme);
  const out = [];
  const check = (a, b, label) => { const r = contrastRatio(a, b); if (r < 4.5) out.push(`${label} is hard to read (contrast ${r.toFixed(1)}:1, needs 4.5:1). Pick a darker or lighter colour.`); };
  check(t.colors.text, t.colors.background, "Text on the page background");
  check("#ffffff", t.colors.primary, "White text on the primary colour (header, bands)");
  check("#ffffff", t.colors.accent, "White text on the accent colour (buttons)");
  check(t.colors.text, t.colors.secondary, "Text on the secondary (soft) background");
  return out;
}

function themeStyle(theme) {
  const c = theme.colors;
  const rgb = hexToRgb(c.accent) || [206, 18, 51];
  return `:root{--navy:${c.primary};--navy2:${darken(c.primary, 0.3)};--red:${c.accent};--ink:${c.text};--soft:${c.secondary};--sb-bg:${c.background};--sb-base:${theme.baseSize}px;--muted:#5d6e86}
.btn-red{box-shadow:0 9px 22px rgba(${rgb.join(",")},.23)}.check-list li:before{color:#159455}
.site-header{background:rgba(255,255,255,.97)}.topbar{background:var(--navy2)}`;
}

const btnClass = style => (style === "outline" ? "btn btn-outline" : style === "link" ? "sb-link-btn" : "btn btn-red");
const renderButton = b => (b && b.label && b.href ? `<a class="${btnClass(b.style)}" href="${escapeHtml(b.href)}">${escapeHtml(b.label)}</a>` : "");
const asset = (base, path) => (!path || /^(https?:)?\/\//i.test(path) || path.startsWith("/") ? path : `${base}${path}`);

function renderHeader(nav, theme, options) {
  const base = options.base || "/";
  const logo = theme.logo ? asset(base, theme.logo) : asset(base, "assets/lorenzo-logo-transparent.png");
  if (options.chrome === "none") return "";
  if (options.chrome === "slim") {
    return `<header class="site-header"><div class="container nav"><a href="/"><img class="logo" src="${escapeHtml(logo)}" alt="Lorenzo's Dog Training Team"></a><nav class="nav-links"><a class="btn btn-outline" href="${PHONE_HREF}">${escapeHtml(theme.phone)}</a><a class="btn btn-red" href="#contact">Book Evaluation</a></nav></div></header>`;
  }
  const current = options.publicPath || "";
  const links = nav.header.links.map(link => {
    const active = link.href === current ? " active" : "";
    if (link.children.length) return `<div class="nav-dropdown"><a href="${escapeHtml(link.href)}" class="dropdown-toggle${active}">${escapeHtml(link.label)}</a><div class="dropdown-menu">${link.children.map(c => `<a href="${escapeHtml(c.href)}">${escapeHtml(c.label)}</a>`).join("")}</div></div>`;
    return `<a href="${escapeHtml(link.href)}" class="${active.trim()}">${escapeHtml(link.label)}</a>`;
  }).join("");
  const ctas = nav.header.ctas.map((b, i) => `<a class="btn btn-red${i === 0 && nav.header.ctas.length > 1 ? " nav-review-cta" : ""}" href="${escapeHtml(b.href)}">${escapeHtml(b.label)}</a>`).join("");
  return `<div class="topbar"><div class="container"><span>${escapeHtml(theme.tagline)}</span><a href="${PHONE_HREF}">${escapeHtml(theme.phone)}</a></div></div><header class="site-header"><div class="container nav"><a href="/"><img class="logo" src="${escapeHtml(logo)}" alt="Lorenzo's Dog Training Team"></a><nav class="nav-links" id="navLinks">${links}${ctas}</nav><button class="mobile-toggle" aria-controls="navLinks" aria-expanded="false">Menu</button></div></header>`;
}

function renderFooter(nav, theme, options) {
  const base = options.base || "/";
  if (options.chrome === "none") return "";
  if (options.chrome === "slim") return `<footer class="footer ad-footer"><div class="container subfooter">&copy; Lorenzo's Dog Training Team. ${escapeHtml(theme.tagline)}<span class="subfooter-tel"> | <a href="${PHONE_HREF}">${escapeHtml(theme.phone)}</a></span></div></footer>`;
  const logo = theme.logo ? asset(base, theme.logo) : asset(base, "assets/lorenzo-logo-transparent.png");
  const groups = nav.footer.groups.map(g => `<div><h3>${escapeHtml(g.title)}</h3>${g.links.map(l => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`).join("")}</div>`).join("");
  return `<footer class="footer"><div class="container footer-grid"><div><img class="footer-logo" src="${escapeHtml(logo)}" alt="Lorenzo's Dog Training Team"><p>${escapeHtml(nav.footer.blurb || STATIC_NAV.footer.blurb)}</p><a href="${PHONE_HREF}">${escapeHtml(theme.phone)}</a></div>${groups}</div><div class="container subfooter">&copy; Lorenzo's Dog Training Team. ${escapeHtml(theme.tagline)}</div></footer><a class="floating-cta" href="/contact">Book Evaluation</a>`;
}

// The office lead form (same fields and classes as contact.html so script.js,
// the pixel Lead event and the practice-copy switch-off all apply unchanged).
function contactForm(sourcePage) {
  return `<form class="panel form contact-intake" action="https://formsubmit.co/production@lorenzosdogtrainingteam.com" method="POST" data-google-form-endpoint="${escapeHtml(AD.googleEndpoint)}" data-office-email="production@lorenzosdogtrainingteam.com" data-email-endpoint="https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com"><h3>Contact Information</h3><div class="form-grid-two"><label>First Name<input required name="first_name" autocomplete="given-name"></label><label>Last Name<input required name="last_name" autocomplete="family-name"></label></div><label>Address Line 1<input required name="address_line_1" autocomplete="address-line1"></label><label>Address Line 2 <small>(optional)</small><input name="address_line_2" autocomplete="address-line2"></label><div class="form-grid-three"><label>City<input required name="city" autocomplete="address-level2"></label><label>State<input required name="state" autocomplete="address-level1"></label><label>ZIP Code<input required name="zip" autocomplete="postal-code"></label></div><label>Email Address<input required type="email" name="email" autocomplete="email"></label><label>Phone <small>(required for callback)</small><input required name="phone" autocomplete="tel"></label><label>I want to...<select required name="i_want_to"><option value="">Select one</option><option>Schedule a free phone consultation to receive more information</option><option>Schedule an in person evaluation with a trainer in my area</option><option>Schedule a virtual evaluation</option><option>Schedule a training session with my dog trainer</option><option>Learn more about becoming a dog trainer</option></select></label><label>How did you hear about us?<select required name="heard_about_us"><option value="">Select one</option><option value="My Veternarian">My Veterinarian</option><option>My Dog Walker</option><option>My Dog Groomer</option><option>My Pet Store</option><option>My Neighbor</option><option>Your Website</option><option>Your Trainer</option><option>Is a past client</option><option>Referred by a past client</option><option>Google Search</option><option>Facebook or Instagram</option><option>Other</option></select></label><label>Vet Name or Previous Client Name <small>(optional)</small><input name="vet_or_previous_client"></label><h3>How can we help?</h3><label>Comments<textarea required name="comments" placeholder="Comments? Tell us about your dog, goals, concerns, and preferred evaluation option."></textarea></label><label class="consent-row"><input type="checkbox" name="sms_consent" value="yes"><span>By checking this box, I agree to receive text messages from Lorenzo's Dog Training Team about my request: follow-up on my inquiry, scheduling and confirming my free consultation or evaluation, and appointment reminders. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy-policy">Privacy Policy</a>.</span></label><p class="form-disclaimer">Phone is required so Lorenzo's office can call about your request. SMS consent is optional and separate from submitting this form.</p><input type="hidden" name="source_page" value="${escapeHtml(sourcePage || "site-page")}">${attributionInputs()}<input type="hidden" name="timestamp" value=""><div class="form-status" role="status" aria-live="polite"></div><button class="btn btn-red" type="submit">Submit</button></form>`;
}

const stars = n => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

function sectionHead(block, tag = "h2") {
  if (!block.eyebrow && !block.heading && !block.text) return "";
  return `<div class="sb-head">${block.eyebrow ? `<span class="eyebrow">${escapeHtml(block.eyebrow)}</span>` : ""}${block.heading ? `<${tag}>${escapeHtml(block.heading)}</${tag}>` : ""}${block.text ? `<p>${escapeHtml(block.text)}</p>` : ""}</div>`;
}

function renderBlock(block, ctx) {
  const { base, data, firstHeading } = ctx;
  const d = block.design;
  const hTag = ctx.h1Used ? "h2" : (firstHeading ? "h1" : "h2");
  const inner = (() => {
    switch (block.type) {
      case "hero": {
        const tag = ctx.h1Used ? "h2" : "h1";
        const media = block.style === "video" && block.video ? `<video class="hero-bg" autoplay muted loop playsinline ${block.poster ? `poster="${escapeHtml(asset(base, block.poster))}"` : ""}><source src="${escapeHtml(asset(base, block.video))}" type="video/mp4"></video>` : block.style !== "solid" && block.image ? `<img class="hero-bg" src="${escapeHtml(asset(base, block.image))}" alt="">` : "";
        return { html: `${media}<div class="container"><div class="page-hero-copy">${block.eyebrow ? `<span class="eyebrow">${escapeHtml(block.eyebrow)}</span>` : ""}<${tag}>${escapeHtml(block.headline)}</${tag}>${block.sub ? `<p class="lead">${escapeHtml(block.sub)}</p>` : ""}${block.buttons.length ? `<div class="hero-actions">${block.buttons.map(renderButton).join("")}</div>` : ""}</div></div>`, classes: `page-hero sb-hero h-${block.height} ${block.style === "solid" || (!block.image && !block.video) ? "solid" : ""}`, style: `--ov:${(block.overlay / 100).toFixed(2)}`, usedH1: tag === "h1" };
      }
      case "richtext": {
        const html = ctx.h1Used || !firstHeading ? block.html : block.html.replace(/<h2>/, "<h1>").replace(/<\/h2>/, "</h1>");
        return { html: `<div class="container"><div class="sb-rich">${html}</div></div>`, usedH1: /<h1>/.test(html) };
      }
      case "imagetext":
        return { html: `<div class="container sb-split ${block.side === "left" ? "img-left" : ""}"><div>${block.eyebrow ? `<span class="eyebrow">${escapeHtml(block.eyebrow)}</span>` : ""}${block.heading ? `<${hTag}>${escapeHtml(block.heading)}</${hTag}>` : ""}<div class="sb-rich">${block.html}</div>${renderButton(block.button)}</div>${block.image ? `<figure class="photo-card"><img src="${escapeHtml(asset(base, block.image))}" alt="${escapeHtml(block.alt)}"></figure>` : ""}</div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      case "columns":
        return { html: `<div class="container">${sectionHead(block, hTag)}<div class="sb-cols c-${block.count}">${block.items.map(i => `<${i.href ? `a href="${escapeHtml(i.href)}"` : "div"} class="sb-card">${i.image ? `<img src="${escapeHtml(asset(base, i.image))}" alt="">` : i.icon ? `<div class="ic">${escapeHtml(i.icon)}</div>` : ""}<h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.text)}</p></${i.href ? "a" : "div"}>`).join("")}</div></div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      case "steps":
        return { html: `<div class="container">${sectionHead(block, hTag)}<div class="sb-steps c-${Math.min(4, Math.max(2, block.items.length))}">${block.items.map(i => `<div class="sb-step"><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.text)}</p></div>`).join("")}</div></div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      case "faq":
        return { html: `<div class="container">${sectionHead(block, hTag)}<div class="sb-faq">${block.items.map((i, n) => `<details ${n === 0 ? "open" : ""}><summary>${escapeHtml(i.q)}</summary><p>${escapeHtml(i.a)}</p></details>`).join("")}</div></div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      case "gallery":
        return { html: `<div class="container">${block.heading ? `<div class="sb-head"><${hTag}>${escapeHtml(block.heading)}</${hTag}></div>` : ""}<div class="sb-gallery c-${block.columns}">${block.items.map(i => `<figure><img src="${escapeHtml(asset(base, i.image))}" alt="${escapeHtml(i.alt)}" loading="lazy">${i.caption ? `<figcaption>${escapeHtml(i.caption)}</figcaption>` : ""}</figure>`).join("")}</div></div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      case "video": {
        const src = block.provider === "vimeo" ? `https://player.vimeo.com/video/${block.videoId}` : `https://www.youtube-nocookie.com/embed/${block.videoId}`;
        return { html: `<div class="container">${sectionHead(block, hTag)}${block.videoId ? `<div class="sb-video"><iframe src="${escapeHtml(src)}" title="${escapeHtml(block.heading || "Video")}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>` : `<div class="sb-video" style="display:grid;place-items:center;color:#fff;font-weight:800">Paste a YouTube or Vimeo video id</div>`}</div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      }
      case "stats":
        return { html: `<div class="container"><div class="sb-stats">${block.items.map(i => `<div class="sb-stat"><strong>${escapeHtml(i.value)}</strong><span>${escapeHtml(i.label)}</span></div>`).join("")}</div></div>` };
      case "testimonials": {
        const approved = (data?.reviews || []).slice(0, block.limit).map(r => ({ quote: r.review_text, name: r.reviewer, location: r.location, rating: clampInt(r.rating, 1, 5, 5) }));
        const list = block.source === "approved" ? approved : block.items.slice(0, block.limit);
        return { html: `<div class="container">${sectionHead(block, hTag)}${list.length ? `<div class="sb-quotes">${list.map(q => `<div class="sb-quote"><div class="stars" aria-label="${q.rating} out of 5">${stars(q.rating)}</div><p>${escapeHtml(q.quote)}</p><strong>${escapeHtml(q.name)}</strong>${q.location ? `<span>${escapeHtml(q.location)}</span>` : ""}</div>`).join("")}</div>` : `<p class="sb-empty-note" style="color:#5d6e86">${block.source === "approved" ? "No approved reviews are published for this page yet. Approve some under Reviews, or switch this block to typed reviews." : "Add a review in the panel on the right."}</p>`}</div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      }
      case "trainers": {
        const all = data?.trainers || [];
        const pick = block.mode === "picked" ? block.slugs.map(s => all.find(t => t.slug === s)).filter(Boolean) : all.filter(t => !block.market || String(t.market || "").toLowerCase().includes(block.market.toLowerCase()) || String(t.state || "").toLowerCase() === block.market.toLowerCase());
        const list = pick.slice(0, block.limit);
        return { html: `<div class="container">${sectionHead(block, hTag)}${list.length ? `<div class="sb-trainers">${list.map(t => `<a class="sb-trainer" href="/${escapeHtml(t.page_slug || t.slug)}"><img src="${escapeHtml(t.headshot_url || asset(base, "assets/lorenzo-logo-transparent.png"))}" alt="${escapeHtml(t.full_name)}"><div><strong>${escapeHtml(t.full_name)}</strong><span>${escapeHtml(t.market || t.state || "")}</span></div></a>`).join("")}</div>` : `<p style="color:#5d6e86">No published trainers match yet. ${block.mode === "market" ? "Type a market like “Cleveland” or a state like “OH”." : "Pick trainers in the panel on the right."}</p>`}</div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      }
      case "pricing":
        return { html: `<div class="container">${sectionHead(block, hTag)}<div class="sb-plans">${block.plans.map(p => `<div class="sb-plan ${p.featured ? "featured" : ""}"><h3>${escapeHtml(p.name)}</h3><div class="price">${escapeHtml(p.price)}</div>${p.note ? `<p class="note">${escapeHtml(p.note)}</p>` : ""}<ul>${p.features.map(f => `<li>${escapeHtml(f)}</li>`).join("")}</ul>${renderButton(p.button)}</div>`).join("")}</div></div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      case "cta":
        return { html: `<div class="container"><div class="cta-band"><div><h2>${escapeHtml(block.heading)}</h2>${block.text ? `<p>${escapeHtml(block.text)}</p>` : ""}</div><div class="sb-btns">${renderButton(block.button)}${renderButton(block.button2)}</div></div></div>` };
      case "buttons":
        return { html: `<div class="container"><div class="sb-btns">${block.buttons.map(renderButton).join("")}</div></div>` };
      case "form":
        return { html: `<div class="container sb-form-wrap" id="contact"><div>${block.heading ? `<${hTag}>${escapeHtml(block.heading)}</${hTag}>` : ""}${block.text ? `<p class="lead" style="color:var(--muted)">${escapeHtml(block.text)}</p>` : ""}<p style="margin-top:18px"><a class="btn btn-navy" href="${PHONE_HREF}">Call ${escapeHtml(PHONE)}</a></p></div>${contactForm(block.sourcePage || ctx.slug)}</div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      case "map": {
        const map = block.showMap && block.address ? `<iframe title="Map to ${escapeHtml(block.address)}" src="https://www.google.com/maps?q=${encodeURIComponent(block.address)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : "";
        return { html: `<div class="container"><div class="sb-map"><div class="headquarters-card">${block.heading ? `<${hTag}>${escapeHtml(block.heading)}</${hTag}>` : ""}${block.text ? `<p>${escapeHtml(block.text)}</p>` : ""}<div class="contact-list">${block.address ? `<div class="contact-item"><strong>Address</strong>${escapeHtml(block.address)}</div>` : ""}${block.phone ? `<div class="contact-item"><strong>Phone</strong><a href="tel:${escapeHtml(block.phone.replace(/[^0-9+]/g, ""))}">${escapeHtml(block.phone)}</a></div>` : ""}${block.email ? `<div class="contact-item"><strong>Email</strong><a href="mailto:${escapeHtml(block.email)}">${escapeHtml(block.email)}</a></div>` : ""}${block.hours ? `<div class="contact-item"><strong>Hours</strong>${escapeHtml(block.hours)}</div>` : ""}</div></div>${map}</div></div>`, usedH1: hTag === "h1" && Boolean(block.heading) };
      }
      case "divider":
        return { html: `<div class="container">${block.style === "line" ? "<hr>" : ""}</div>`, classes: `sb-divider s-${block.size}` };
      default:
        return { html: "" };
    }
  })();
  const classes = ["sb", `sb-${block.type}`, inner.classes || "", `pad-${d.padding}`, `w-${d.width}`, `al-${d.align}`, d.tone ? `tone-${d.tone}` : "", d.hideMobile ? "hide-mobile" : "", d.bgImage ? "sb-bgimg" : ""].filter(Boolean).join(" ");
  const styles = [inner.style || "", d.bgColor ? `background:${d.bgColor}` : "", d.bgImage ? `background-image:url("${escapeHtml(asset(base, d.bgImage))}")` : ""].filter(Boolean).join(";");
  const editorBits = ctx.editor ? `<span class="sb-label">${escapeHtml(BLOCK_LABEL(block.type))}</span><div class="sb-tools"><button type="button" class="sb-drag" data-sb-tool="drag" title="Drag to move" draggable="true">⋮⋮</button><button type="button" data-sb-tool="up" title="Move up">↑</button><button type="button" data-sb-tool="down" title="Move down">↓</button><button type="button" data-sb-tool="duplicate" title="Duplicate">⧉</button><button type="button" class="danger" data-sb-tool="remove" title="Delete">✕</button></div>` : "";
  const attrs = ctx.editor ? ` data-sb-block="${escapeHtml(block.id)}" data-sb-type="${escapeHtml(block.type)}"` : "";
  return { html: `<section class="${classes}"${styles ? ` style="${styles}"` : ""}${d.anchor ? ` id="${escapeHtml(d.anchor)}"` : ""}${attrs}>${editorBits}${inner.html}</section>`, usedH1: Boolean(inner.usedH1) };
}

function renderSitePage(rawContent, options = {}) {
  const content = normalizeSitePage(rawContent);
  const theme = resolveTheme(options.siteTheme, content.theme);
  const nav = effectiveNav(options.navigation);
  const base = String(options.base || "/");
  const editor = options.editor === true;
  const publicPath = options.publicPath || `/${content.slug}`;
  const chrome = options.chrome || content.chrome;
  const title = content.seo.title || content.title || "Lorenzo's Dog Training Team";
  const description = content.seo.description || `${content.title} — Lorenzo's Dog Training Team. Serious Training. Serious Results.`;
  const ogImage = content.seo.ogImage ? (content.seo.ogImage.startsWith("http") ? content.seo.ogImage : `${SITE_ORIGIN}${content.seo.ogImage.startsWith("/") ? "" : "/"}${content.seo.ogImage}`) : `${SITE_ORIGIN}/assets/get-started-premium-hero.jpg`;
  const fonts = fontHead(theme);
  const ctx = { base, data: options.data || {}, editor, slug: content.slug, h1Used: false };
  const firstHeadingIndex = content.blocks.findIndex(b => b.type === "hero" ? b.headline : (b.heading || (b.type === "richtext" && /<h2>/.test(b.html))));
  const addButton = (index, label = "+ Add block") => (editor ? `<div class="sb-add" data-sb-add="${index}"><button type="button" data-sb-add-btn="${index}">${label}</button></div>` : "");
  const parts = [];
  content.blocks.forEach((block, index) => {
    parts.push(addButton(index));
    const rendered = renderBlock(block, { ...ctx, firstHeading: index === firstHeadingIndex });
    if (rendered.usedH1) ctx.h1Used = true;
    parts.push(rendered.html);
  });
  if (editor && !content.blocks.length) {
    parts.push(`<div class="sb-add empty" data-sb-add="0"><div><h2>This page is empty. Three steps:</h2><ol><li>Press <b>Add the first block</b> (or open <b>Blocks</b> on the left) and pick a Hero.</li><li>Click any block on this canvas to change its words, photo and colours on the right.</li><li>Press <b>Publish</b> at the top when it looks right. It goes live at <b>${escapeHtml(publicPath)}</b>.</li></ol><button type="button" data-sb-add-btn="0">+ Add the first block</button></div></div>`);
  } else {
    parts.push(addButton(content.blocks.length));
  }
  const favicon = theme.favicon ? asset(base, theme.favicon) : asset(base, "assets/ldtt-favicon.png");
  const bodyClass = `site-page page-${content.pageType} btn-${theme.buttonShape} btn-${theme.buttonFill}-fill spacing-${theme.spacing}${editor ? " sb-editor" : ""}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} | Lorenzo's Dog Training Team</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${content.seo.noindex || editor ? `<meta name="robots" content="noindex">` : ""}
  <link rel="canonical" href="${SITE_ORIGIN}${escapeHtml(publicPath)}">
  <link rel="icon" type="image/png" href="${escapeHtml(favicon)}">
  <link rel="apple-touch-icon" href="${escapeHtml(favicon)}">
  <link rel="stylesheet" href="${asset(base, "styles.css")}?v=${cacheVersion}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)} | Lorenzo's Dog Training Team">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${SITE_ORIGIN}${escapeHtml(publicPath)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  ${googleAdsHead()}
  ${metaPixelHead()}
  ${fonts.links}
  <style>${themeStyle(theme)}${fonts.rules}
${BLOCK_STYLE}${editor ? EDITOR_STYLE : ""}</style>
<script defer src="/_vercel/insights/script.js"></script><script defer src="/_vercel/speed-insights/script.js"></script></head>
<body class="${bodyClass}" data-site-page="${escapeHtml(content.slug)}">
  ${renderHeader(nav, theme, { base, chrome, publicPath })}
  <main>
${parts.join("\n")}
  </main>
  ${renderFooter(nav, theme, { base, chrome })}
  ${conversionAndAttributionScript()}
  <script src="${asset(base, "supabase-config.js")}"></script>
  <script src="${asset(base, "script.js")}?v=${cacheVersion}"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Publish checklist: plain sentences, browser and server.
// ---------------------------------------------------------------------------
function sitePublishChecklist(rawContent, options = {}) {
  const content = normalizeSitePage(rawContent);
  const html = typeof options.html === "string" ? options.html : renderSitePage(content, options);
  const checks = [];
  const add = (ok, label, fix) => checks.push({ ok: Boolean(ok), label, fix: ok ? "" : fix });
  add(/^[a-z0-9-]{2,80}$/.test(content.slug) && !RESERVED_SLUGS.has(content.slug), "Web address is set", "Give the page a web address with letters, numbers and dashes (not a reserved word like api or ads).");
  add(content.title, "Page title is filled in", "Type a page title in Page settings.");
  add(content.seo.description, "Search description is filled in", "Type a one-sentence search description in Page settings (Google shows it under the title).");
  add(content.blocks.length > 0, "At least one block on the page", "Add a block. A Hero is a good first block.");
  add(/<h1[^>]*>[^<]+<\/h1>/.test(html), "The page has one main headline (H1)", "Add a Hero with a headline, or a heading in the first block.");
  if (content.pageType === "landing") add(content.blocks.some(b => b.type === "form"), "Lead form is on the page", "Landing pages need the Contact form block so visitors can ask for a callback.");
  add(html.includes(`fbq('init', '${AD.metaPixelId}')`), "Meta pixel is on the page", "The Meta pixel is missing. This should never happen; contact support.");
  add(html.includes(AD.googleAdsId), "Google Ads tag is on the page", "The Google Ads tag is missing. This should never happen; contact support.");
  const missingImage = typeof options.imageExists === "function" ? content.blocks.flatMap(b => [b.image, ...(b.items || []).map(i => i.image), b.design?.bgImage].filter(Boolean)).find(src => !options.imageExists(src)) : null;
  add(!missingImage, "Every photo can be found", `The photo "${missingImage}" cannot be found. Pick another photo or upload it again.`);
  content.blocks.forEach((b, i) => {
    const where = `Block ${i + 1} (${BLOCK_LABEL(b.type)})`;
    switch (b.type) {
      case "hero": add(b.headline, `${where} has a headline`, `${where}: type the headline.`); add(b.style === "solid" || b.image || b.video, `${where} has a photo or video`, `${where}: pick a photo or video, or choose the solid colour style.`); break;
      case "richtext": add(textOnly(b.html).length > 0, `${where} has words`, `${where}: type some words or remove the block.`); break;
      case "imagetext": add(b.image, `${where} has a photo`, `${where}: pick a photo.`); add(b.heading || textOnly(b.html), `${where} has words`, `${where}: type a heading or text.`); break;
      case "columns": add(b.items.length >= 2 && b.items.every(x => x.title), `${where} cards are complete`, `${where}: every card needs a title (at least two cards).`); break;
      case "steps": add(b.items.length >= 2 && b.items.every(x => x.title), `${where} steps are complete`, `${where}: every step needs a title (at least two steps).`); break;
      case "faq": add(b.items.length >= 1 && b.items.every(x => x.q && x.a), `${where} questions are complete`, `${where}: every question needs an answer, or remove the empty one.`); break;
      case "gallery": add(b.items.length >= 1, `${where} has photos`, `${where}: add at least one photo.`); break;
      case "video": add(b.videoId, `${where} has a video id`, `${where}: paste the YouTube or Vimeo video id.`); break;
      case "stats": add(b.items.length >= 2 && b.items.every(x => x.value && x.label), `${where} numbers are complete`, `${where}: every number needs a value and a label.`); break;
      case "testimonials": add(b.source === "approved" || (b.items.length && b.items.every(x => x.quote && x.name)), `${where} reviews are complete`, `${where}: every review needs the words and a name, or switch to approved reviews.`); break;
      case "trainers": add(b.mode === "picked" ? b.slugs.length > 0 : b.market, `${where} knows which trainers`, `${where}: type a market or pick trainers.`); break;
      case "pricing": add(b.plans.length >= 1 && b.plans.every(p => p.name && p.price), `${where} plans are complete`, `${where}: every plan needs a name and a price.`); break;
      case "cta": add(b.heading && b.button.label && b.button.href, `${where} has a heading and a button`, `${where}: type the heading and give the button words and a link.`); break;
      case "buttons": add(b.buttons.length > 0, `${where} has a button`, `${where}: add at least one button with words and a link.`); break;
      case "map": add(b.address, `${where} has an address`, `${where}: type the address.`); break;
      default:
    }
  });
  return { ok: checks.every(c => c.ok), checks, failures: checks.filter(c => !c.ok) };
}

// ---------------------------------------------------------------------------
// Starters (New page → from template)
// ---------------------------------------------------------------------------
function starter(id, ctx = {}) {
  const b = type => blankBlock(type, ctx);
  const city = ctx.city || "";
  const market = ctx.market || (city && ctx.state ? `${city}, ${ctx.state}` : "");
  switch (id) {
    case "about":
      return { pageType: "site", title: "About Lorenzo's Dog Training Team", slug: "about", blocks: [
        { ...b("hero"), style: "solid", image: "", eyebrow: "About us", headline: "About Lorenzo's Dog Training Team", sub: "A mission-driven dog training company built on childhood passion, professional study, serious technique, and serious results." },
        { ...b("imagetext"), eyebrow: "About Us", heading: "Serious Training. Serious Results.", html: "<p>Lorenzo's Dog Training Team helps dogs of any age, size, breed, and temperament become more reliable in real life.</p><ul><li>Dog obedience training and advanced off-leash obedience.</li><li>Dog behavior modification for difficult or unsafe habits.</li><li>Specialty, service, assistance, alert, scent, utility, and retrieval training.</li></ul>", button: { label: "", href: "", style: "primary" } },
        { ...b("stats") }, { ...b("cta") }
      ] };
    case "services":
      return { pageType: "site", title: "Our Services", slug: "services", blocks: [
        { ...b("hero"), eyebrow: "Services", headline: "Training built for real life.", sub: "Obedience, behavior modification, specialty programs and board & train — with the office coordinating every step." },
        b("columns"), b("steps"), b("pricing"), b("faq"), b("cta")
      ] };
    case "contact":
      return { pageType: "site", title: "Contact", slug: "contact", blocks: [
        { ...b("hero"), style: "solid", image: "", eyebrow: "Contact", headline: "Book an Evaluation or Start the Right Path", sub: "Tell the office about your dog and the right trainer calls you back." },
        { ...b("form"), sourcePage: "contact" }, b("map")
      ] };
    case "facility":
      return { pageType: "site", title: "Our Facility", slug: "facility", blocks: [
        { ...b("hero"), eyebrow: "Our facility", headline: "Cleveland Training Facility Built for Real Results", sub: "Where every Lorenzo's trainer is certified." },
        b("stats"), b("gallery"), b("imagetext"), b("cta")
      ] };
    case "market":
      return { pageType: "landing", title: `${city || "City"} Dog Training`, slug: safeSlug(`dog-training-${city}-${ctx.state || ""}`), market, city, state: ctx.state || "", blocks: [
        { ...b("hero"), eyebrow: market || "Local dog training", headline: `Serious dog training in ${city || "your city"}.`, sub: "Free evaluation. A clear plan. Guaranteed in writing.", buttons: [{ label: "Book my free evaluation", href: "#contact", style: "primary" }, { label: `Call ${PHONE}`, href: PHONE_HREF, style: "outline" }] },
        b("stats"), b("columns"), b("steps"), { ...b("trainers"), market: city }, { ...b("testimonials"), source: "approved" }, b("faq"), { ...b("form"), heading: `Request ${city || "local"} dog training` }
      ] };
    case "recruiting":
      return { pageType: "landing", title: `Become a Dog Trainer in ${city || "your city"}`, slug: safeSlug(`dog-trainer-jobs-${city}-${ctx.state || ""}`), market, city, state: ctx.state || "", blocks: [
        { ...b("hero"), eyebrow: "Now hiring", headline: `Become a professional dog trainer in ${city || "your city"}.`, sub: "Certification at our Cleveland headquarters, leads from the office, a career with dogs.", buttons: [{ label: "Apply now", href: "#contact", style: "primary" }] },
        { ...b("columns"), eyebrow: "Why Lorenzo's", heading: "A real career, not a side gig.", items: [{ icon: "🎓", image: "", title: "Certification", text: "Trained and certified at the Cleveland academy.", href: "" }, { icon: "📞", image: "", title: "Leads from the office", text: "The office books evaluations; you train.", href: "" }, { icon: "📈", image: "", title: "Room to grow", text: "Advance into specialty and service work.", href: "" }] },
        b("steps"), b("faq"), { ...b("form"), heading: "Tell us about yourself" }
      ] };
    case "blank":
    default:
      return { pageType: ctx.pageType === "landing" ? "landing" : "site", title: ctx.title || "New page", slug: safeSlug(ctx.slug || ctx.title || "new-page"), blocks: [] };
  }
}
const STARTERS = [
  { id: "blank", label: "Blank page", help: "Start from nothing and add blocks." },
  { id: "about", label: "About page", help: "Hero, story with photo, numbers, closing band." },
  { id: "services", label: "Services page", help: "Hero, feature columns, steps, pricing, FAQ, closing band." },
  { id: "contact", label: "Contact page", help: "Hero, the office lead form, map and address." },
  { id: "facility", label: "Facility page", help: "Hero, numbers, photo gallery, story, closing band." },
  { id: "market", label: "Market landing page", help: "A city page: hero, numbers, columns, steps, local trainers, reviews, FAQ, form." },
  { id: "recruiting", label: "Recruiting landing page", help: "Hire trainers in a city: hero, reasons, steps, FAQ, form." }
];

return {
  SITE_VERSION, SITE_FONTS, FONT_PAIRS, DEFAULT_THEME, BLOCK_TYPES, STARTERS, STATIC_NAV, RESERVED_SLUGS, BASE_SIZES, BUTTON_SHAPES, BUTTON_FILLS, SPACINGS, PADDINGS, WIDTHS, ALIGNS, TEXT_TONES, PAGE_TYPES, CHROMES,
  blankBlock, blankDesign, normalizeBlock: raw => normalizeBlock(raw, new Set()), normalizeSitePage, normalizeTheme, resolveTheme, normalizeNav, effectiveNav, themeWarnings, contrastRatio,
  renderSitePage, sitePublishChecklist, starter, safeSlug, safeSrc, safeHref, BLOCK_LABEL, escapeHtml, contactForm, sanitizeRichText, textOnly
};
});
