// Ad landing pages 2.0 (Joshua 2026-09-14; meeting 2026-09-11: "Add the 2.0 pages into Page Studio so Arrison can
// edit them herself"). DO-NOT-BREAK rule 85.
//
// The three 2.0 designs (d1 Miramar Beach, d2 Panama City Beach, d3 Ann Arbor) were built on 2026-09-11 by a Python
// script (~/Desktop/LDTT Ad Pages 2.0 2026-09-11/tools/build.py) as a separate sandbox site. This file is that
// script in JavaScript, so Page Studio can store each page as a CONTENT object (page_type "ad2" in ad_pages) and
// the site can serve it at /ads/<slug>. The layout, positions and styles are the build's own (assets/v2/v2.css);
// only the words, photos, videos titles, reviews and states come from the saved content.
//
// Safety, like lib/ad-page-template.js: the office never stores HTML. Every text goes through escapeHtml, every
// photo through photoUrl() (our own /assets/v2/ files or an https address with no quotes, brackets or spaces), and
// normalizeContent() keeps only the fields the chosen design draws. The Meta pixel and Google Ads tag come only from
// lib/ad-page-template.js (rule 11) and are left out on the practice copy so test leads never reach the ad accounts.
//
// CommonJS + browser global (window.LDTT_AD2_PAGE_TEMPLATE). The browser loads lib/ad-page-template.js and
// lib/ad2-usmap.js first.
(function (root, factory) {
  const isNode = typeof module !== "undefined" && module.exports;
  const base = isNode ? require("./ad-page-template.js") : root.LDTT_AD_PAGE_TEMPLATE;
  const map = isNode ? require("./ad2-usmap.js") : root.LDTT_AD2_USMAP;
  const mod = factory(base, map);
  if (isNode) module.exports = mod;
  else root.LDTT_AD2_PAGE_TEMPLATE = mod;
})(typeof globalThis !== "undefined" ? globalThis : this, function (BASE, MAP) {
"use strict";
const { escapeHtml: E, metaPixelHead, googleAdsHead, safeSlug } = BASE;

const VERSION = "20260916ad8"; // 2026-09-16: elements can be hidden (trash) and given a font (elbox)
const LIVE = "https://lorenzosdogtrainingteam.com";
const TEL = "tel:+18664364959";
const PHONE = "866.436.4959";
const A = "/assets/v2/";
const BOOKING_ENDPOINT = "/api/booking-lead"; // same site: the practice booking flow on the practice copy (rule 71)
const MAX_STATES = 12; // the designs have room for two columns of six

const VIDEOS = {
  story: LIVE + "/assets/video/ldtt-cleveland-ad-reel.mp4",
  review: LIVE + "/assets/olivers-dad-and-mom-review.mp4",
  ad: LIVE + "/assets/ad-testimonial-take-1.mp4",
  campus: LIVE + "/assets/video/ldtt-hq-campus.mp4",
  trainers: LIVE + "/assets/ldtt-trainer-testimonials.mp4"
};
const SOCIAL = [
  ["facebook-f", "https://www.facebook.com/LorenzosDogTrainingTeam/", "Facebook"],
  ["instagram", "https://www.instagram.com/lorenzosdogtrainingteam/", "Instagram"],
  ["youtube", "https://www.youtube.com/user/mydogtrainingteam", "YouTube"]
];
// Real Google reviews already published on lorenzosdogtrainingteam.com (assets/reviews/*.png)
const REVIEWS = [
  { name: "Becca L.", text: "I honestly owe my sanity to Lorenzo's Dog Training Team, especially Eric. I adopted a Pitbull/Chihuahua mix and he was extremely anxious and could never settle." },
  { name: "Stephanie P.", text: "Robert truly changed my life. After Robert was done, my Hunter became a completely different dog! His reactivity with dogs is gone." },
  { name: "Jenn S.", text: "I cannot give enough stars to our trainer Bruce Maldonado. When I say that he has changed our lives, I mean it quite literally." }
];
// Meeting 11 Sep 2026: add Texas and New York.
const STATES = ["California", "Ohio", "Florida", "Michigan", "Kentucky", "Illinois", "Indiana", "New Hampshire", "Massachusetts", "Georgia", "Texas", "New York"];
const ABBR = {
  Alabama: "AL", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME",
  Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX",
  Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY"
};
const ALL_STATES = Object.keys(MAP.states).sort();
// SMS consent: single customer-care use case, word for word the portal's wording (DO-NOT-BREAK rule 47). Fixed HTML.
const SMS_CONSENT = "By checking this box, I agree to receive text messages from Lorenzo's Dog Training Team about my request: "
  + "follow-up on my inquiry, scheduling and confirming my free consultation or evaluation, and appointment reminders. "
  + "Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. "
  + "Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the "
  + '<a href="https://lorenzosdogtrainingteam.com/terms.html" target="_blank" rel="noopener">Terms of Service</a> and '
  + '<a href="https://lorenzosdogtrainingteam.com/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>.';

const DESIGNS = [
  { id: "d1", label: "Design 1 · coastal (Miramar Beach)" },
  { id: "d2", label: "Design 2 · founder video (Panama City Beach)" },
  { id: "d3", label: "Design 3 · reviews and stories (Ann Arbor)" }
];
const DESIGN_IDS = new Set(DESIGNS.map(d => d.id));
// Fonts the office can put on one element (the page loads Poppins, Oswald and Kaushan Script; the rest are on every computer).
const FONTS = ["Poppins", "Oswald", "Kaushan Script", "Georgia", "Arial", "Impact", "Trebuchet MS", "Times New Roman", "Courier New"];

// Site Builder 2.0 (Joshua 2026-09-15: "adding review block, logo changing, replacing photos ... rearrange sections").
// The sections each design draws, in page order, named by the class the build gives them. The header ("hdr") and the
// footer ("foot") never move or hide; a Site Builder block can sit after any of them. `fields` = the editor tabs
// (SECTIONS below) whose words that section shows; `photos` = its photo slots.
const ANCHORS = {
  d1: [["hdr", "Header"], ["hero", "Top photo and headline"], ["founder", "Founder"], ["eval", "Free evaluation"], ["ba-sec", "Before and after videos"], ["close1", "Closing call"], ["loc1", "States map"]],
  d2: [["hdr", "Header"], ["hero", "Top photo and headline"], ["founder2", "Founder"], ["svc", "Training cards"], ["rvs", "Google reviews"], ["ba-sec2", "Before and after videos"], ["ebook", "Free booklet"], ["band", "Red call band"], ["foot", "Footer"]],
  d3: [["hdr", "Header"], ["hero", "Top photo and headline"], ["about3", "About"], ["svc", "Training cards"], ["rvs", "Google reviews"], ["stl", "Stories and states map"], ["band", "Red call band"], ["foot", "Footer"]]
};
const FIXED_ANCHORS = new Set(["hdr", "foot"]);
const ANCHOR_FIELDS = { hdr: ["top"], hero: ["top"], founder: ["founder"], founder2: ["founder"], about3: ["founder"], eval: ["evaluation"], svc: ["services"], "ba-sec": ["videos"], "ba-sec2": ["videos"], rvs: ["reviews"], close1: ["closing"], ebook: ["booklet"], loc1: ["locations"], stl: ["videos", "locations"], band: [], foot: [] };
const ANCHOR_PHOTOS = { hero: ["hero", "heroM"], founder: ["founder", "founderM"], founder2: ["founder", "founderM"], about3: ["about"], eval: ["golden"], close1: ["aussie"], "ba-sec": ["ba1", "ba2", "ba3", "ba4"], "ba-sec2": ["ba1", "ba2", "ba3", "ba4"], svc: ["svc1", "svc2", "svc3", "svc4", "svc5", "svc6"], ebook: ["book"], stl: ["st1", "st2", "st3"] };
const DESIGN_COLORS = { d1: { primary: "#011731", accent: "#d0021b" }, d2: { primary: "#001f42", accent: "#d10f2d" }, d3: { primary: "#011730", accent: "#c40113" } };
// The block kit lives in lib/site-page-template.js (which needs this file's base first), so it is looked up when used.
const siteKit = () => (typeof module !== "undefined" && module.exports ? require("./site-page-template.js") : (typeof window !== "undefined" ? window.LDTT_SITE_PAGE_TEMPLATE : null));

// Photos each design draws, with the file it starts with (all in assets/v2/).
const PHOTO_SLOTS = {
  d1: [["hero", "Top photo (computer)", "d1-hero.webp", "2048×756 px"], ["heroM", "Top photo (phone)", "d1-hero-m.webp", "694×756 px"], ["founder", "Founder photo (computer)", "d1-founder.webp", "1292×550 px"], ["founderM", "Founder photo (phone)", "d1-founder-m.webp", "834×550 px"], ["golden", "Evaluation photo", "d1-golden.webp", "1026×406 px"], ["aussie", "Closing dog photo", "d1-aussie.webp", "404×332 px"], ["ba1", "Video 1 picture", "d1-ba1.webp", "460×150 px"], ["ba2", "Video 2 picture", "d1-ba2.webp", "462×150 px"], ["ba3", "Video 3 picture", "d1-ba3.webp", "462×150 px"], ["ba4", "Video 4 picture", "d1-ba4.webp", "462×150 px"]],
  d2: [["hero", "Top photo (computer)", "d2-hero.webp", "2048×680 px"], ["heroM", "Top photo (phone)", "d2-hero-m.webp", "688×680 px"], ["founder", "Founder photo (computer)", "d2-founder.webp", "1248×436 px"], ["founderM", "Founder photo (phone)", "d2-founder-m.webp", "834×436 px"], ["svc1", "Card 1 photo", "d2-svc1.webp", "310×206 px"], ["svc2", "Card 2 photo", "d2-svc2.webp", "302×206 px"], ["svc3", "Card 3 photo", "d2-svc3.webp", "300×206 px"], ["svc4", "Card 4 photo", "d2-svc4.webp", "300×206 px"], ["svc5", "Card 5 photo", "d2-svc5.webp", "302×206 px"], ["svc6", "Card 6 photo", "d2-svc6.webp", "306×206 px"], ["ba1", "Video 1 picture", "d2-ba1.webp", "442×104 px"], ["ba2", "Video 2 picture", "d2-ba2.webp", "464×104 px"], ["ba3", "Video 3 picture", "d2-ba3.webp", "458×104 px"], ["ba4", "Video 4 picture", "d2-ba4.webp", "436×104 px"], ["book", "Booklet picture", "d2-book.webp", "556×296 px"]],
  d3: [["hero", "Top photo (computer)", "d3-hero.webp", "2048×770 px"], ["heroM", "Top photo (phone)", "d3-hero-m.webp", "694×770 px"], ["about", "About photo", "d3-about.webp", "1126×480 px"], ["svc1", "Card 1 photo", "d3-svc1.webp", "304×268 px"], ["svc2", "Card 2 photo", "d3-svc2.webp", "302×268 px"], ["svc3", "Card 3 photo", "d3-svc3.webp", "302×268 px"], ["svc4", "Card 4 photo", "d3-svc4.webp", "300×268 px"], ["svc5", "Card 5 photo", "d3-svc5.webp", "300×268 px"], ["svc6", "Card 6 photo", "d3-svc6.webp", "298×268 px"], ["st1", "Story 1 picture", "d3-st1.webp", "272×140 px"], ["st2", "Story 2 picture", "d3-st2.webp", "272×140 px"], ["st3", "Story 3 picture", "d3-st3.webp", "276×140 px"]]
};
const ASSET_FILES = new Set(["emblem.png", ...Object.values(PHOTO_SLOTS).flat().map(s => s[2])]);

const SECTIONS = [
  { id: "top", label: "Top of page" },
  { id: "founder", label: "Founder" },
  { id: "evaluation", label: "Free evaluation" },
  { id: "services", label: "Training cards" },
  { id: "videos", label: "Videos" },
  { id: "reviews", label: "Reviews" },
  { id: "closing", label: "Closing call" },
  { id: "booklet", label: "Free booklet" },
  { id: "locations", label: "States" },
  { id: "photos", label: "Photos" },
  { id: "seo", label: "Address + search" }
];
const ALL3 = ["d1", "d2", "d3"];
// kind: text | area | lines (n boxes) | pairs (video title + line) | reviews | states | photos
const FIELDS = [
  { key: "top", section: "top", kind: "text", label: "Red bar at the very top", max: 110, designs: ALL3 },
  { key: "h1", section: "top", kind: "lines", n: 2, label: "Big headline (2 lines)", max: 28, designs: ALL3 },
  { key: "sub", section: "top", kind: "lines", n: 4, label: "Under the headline (4 short lines)", max: 60, designs: ALL3 },
  { key: "cta", section: "top", kind: "text", label: "Main button", max: 32, designs: ALL3 },
  { key: "f_eyebrow", section: "founder", kind: "text", label: "Small line above the name", max: 50, designs: ["d1", "d3"] },
  { key: "f_head", section: "founder", kind: "lines", n: 2, label: "Big words (2 lines)", max: 26, designs: ["d3"] },
  { key: "f_tag", section: "founder", kind: "text", label: "Line under the name", max: 50, designs: ["d1", "d2"] },
  { key: "f_p1", section: "founder", kind: "area", label: "Founder paragraph ({n} becomes the number of states)", max: 420, designs: ALL3 },
  { key: "f_p2", section: "founder", kind: "area", label: "Second paragraph", max: 420, designs: ["d1"] },
  { key: "f_btn", section: "founder", kind: "text", label: "Founder button", max: 24, designs: ALL3 },
  { key: "check", section: "evaluation", kind: "lines", n: 4, label: "Ticks on the photo (4)", max: 44, designs: ["d1"] },
  { key: "e_head", section: "evaluation", kind: "text", label: "Heading", max: 40, designs: ["d1"] },
  { key: "e_sub", section: "evaluation", kind: "area", label: "Paragraph", max: 220, designs: ["d1"] },
  { key: "inc", section: "evaluation", kind: "lines", n: 4, label: "\"Your free evaluation includes\" (4)", max: 40, designs: ["d1"] },
  { key: "svc", section: "services", kind: "lines", n: 6, label: "Card lines: Puppy, Obedience, Behavior, Board & Train, Service Dog, Advanced", max: 48, designs: ["d2", "d3"] },
  { key: "vids", section: "videos", kind: "pairs", label: "Video titles", max: 34, max2: 44, designs: ALL3 },
  { key: "reviews", section: "reviews", kind: "reviews", label: "The three Google reviews", max: 30, max2: 190, designs: ["d2", "d3"] },
  { key: "c_eyebrow", section: "closing", kind: "text", label: "Small line", max: 40, designs: ["d1"] },
  { key: "c_head", section: "closing", kind: "text", label: "Heading", max: 50, designs: ["d1"] },
  { key: "c_sub", section: "closing", kind: "area", label: "Paragraph", max: 180, designs: ["d1"] },
  { key: "b_eyebrow", section: "booklet", kind: "text", label: "Small line", max: 50, designs: ["d2"] },
  { key: "b_sub", section: "booklet", kind: "area", label: "Paragraph", max: 200, designs: ["d2"] },
  { key: "b_bul", section: "booklet", kind: "lines", n: 4, label: "Ticks (4)", max: 40, designs: ["d2"] },
  { key: "b_url", section: "booklet", kind: "text", label: "Booklet PDF web address (empty = the standard Calm Dog Blueprint)", max: 300, designs: ["d2"] },
  { key: "loc_sub", section: "locations", kind: "area", label: "Areas you serve here", max: 140, designs: ["d1", "d3"] },
  { key: "states", section: "locations", kind: "states", label: "States on the map (up to 12)", designs: ALL3 },
  { key: "photos", section: "photos", kind: "photos", label: "Photos", designs: ALL3 },
  { key: "market", section: "seo", kind: "text", label: "Market name (shown on the form), like Miramar Beach, FL", max: 60, designs: ALL3 },
  { key: "zip", section: "seo", kind: "text", label: "Example ZIP in the form", max: 10, designs: ALL3 },
  { key: "title", section: "seo", kind: "text", label: "Browser tab title", max: 90, designs: ALL3 },
  { key: "desc", section: "seo", kind: "area", label: "Search description", max: 200, designs: ALL3 }
];
const VIDEO_COUNT = { d1: 4, d2: 4, d3: 3 };

// The three pages as built on 2026-09-11/12 (research copy: market-copy.md in the 2.0 folder).
const pair = (t, s) => ({ t, s });
const STARTER_COPY = [
  {
    design: "d1", slug: "miramar-beach", market: "Miramar Beach, FL", zip: "32550",
    title: "Dog Training in Miramar Beach, Destin & 30A | Lorenzo's",
    desc: "Obedience, puppy and behavior training for Miramar Beach, Destin and 30A dog owners. Free in-home evaluation and a 90-day guarantee. Call 866.436.4959.",
    top: "Free In-Home Dog Training Evaluations for Destin, Miramar Beach & 30A",
    h1: ["CALM ON THE LEASH.", "CALM ON THE PATIO."],
    sub: ["For dogs who live on the coast all year.", "Leash walks at dawn, patios at sunset,", "and a calm house when the crowds arrive.", "Start with a free in-home evaluation."],
    cta: "Book My Free Evaluation",
    f_eyebrow: "Meet the Founder,", f_tag: "40+ Years. One Standard.",
    f_p1: "Lorenzo Miller has trained dogs for more than 40 years. He built Lorenzo's Dog Training Team in Cleveland, and today trainers in {n} states work from his one method. On the Emerald Coast, your request is coordinated by Lorenzo's office with trainer Tabatha Shelley.",
    f_p2: "Coast life is its own test. Walton County allows resident dogs on the sand only with a permit and a leash, and Destin's beaches are closed to dogs. So we train for how you really live here: loose-leash walks, calm on busy patios, and quiet when the neighbors' guests arrive.",
    f_btn: "Free Evaluation",
    check: ["Pulls hard on every leash walk", "Barks at guests, doors or dogs", "New puppy or new rescue at home", "Just moved here on PCS orders"],
    e_head: "Your Free In-Home Evaluation",
    e_sub: "A trainer meets you and your dog at home, sees what is really going on, and recommends a clear next step. No cost and no obligation.",
    inc: ["A trainer sees your dog at home", "Talk through your daily routine", "A clear program and next steps", "A straight answer on fit"],
    vids: [pair("Ruger: Before & After", "The calm we train for here"), pair("Bailey's Turnaround", "Same dog. Same home. New habits."), pair("Enzo, Weeks Later", "A walk worth taking again"), pair("Luna's Progress", "Quiet at home, steady outside")],
    c_eyebrow: "For Emerald Coast Locals", c_head: "Enjoy the Coast With a Dog Who Listens",
    c_sub: "Book a free in-home evaluation or call 866.436.4959. Away for part of the year? Ask about an online consult.",
    loc_sub: "Miramar Beach, Destin, Santa Rosa Beach, 30A and Walton County. In-home evaluations by appointment."
  },
  {
    design: "d2", slug: "panama-city-beach", market: "Panama City Beach, FL", zip: "32407",
    title: "Dog Training in Panama City Beach & Bay County | Lorenzo's",
    desc: "Obedience, puppy and behavior training for Panama City Beach, Lynn Haven and Tyndall families. Free in-home evaluation, 90-day guarantee. 866.436.4959.",
    top: "New to Bay County? Book a Free In-Home Dog Training Evaluation",
    h1: ["NEW HOME. NEW TOWN.", "SAME GOOD DOG."],
    sub: ["Moved to Bay County, or just got a dog?", "We help new neighbors and Tyndall", "families settle dogs who pull or bark,", "starting with a free in-home evaluation."],
    cta: "Book My Free Evaluation",
    f_tag: "Local Trainer. Proven Method.",
    f_p1: "In Bay County, your request is coordinated by Lorenzo's office with Tabatha Shelley, our trainer in Panama City. She trains the method Lorenzo Miller built over 40+ years in Cleveland, the same one used by more than 50 professional trainers across {n} states.",
    f_btn: "Free Evaluation",
    svc: ["New puppy, new house: habits done right", "Leash manners that hold at the dog beach", "Barking, lunging and fear, with a plan", "Trains with a pro, plus handoff lessons", "Task training after a suitability check", "Control that holds around distractions"],
    vids: [pair("Ruger: Before & After", "Same dog. New habits at home."), pair("Bailey's Turnaround", "From pulling to a loose leash"), pair("Enzo, Weeks Later", "Settled in and listening"), pair("Luna's Progress", "Calm at home, steady outside")],
    b_eyebrow: "Settling in? Start with the free guide",
    b_sub: "A move can unsettle any dog. The 5-Step Calm Dog Blueprint gives you a simple daily routine for focus and calmer behavior at home.",
    b_bul: ["Five steps to start this week", "A short routine for a new house", "Focus before the walk begins", "Calmer behavior, sooner"]
  },
  {
    design: "d3", slug: "ann-arbor", market: "Ann Arbor, MI", zip: "48104",
    title: "Ann Arbor Dog Training: Puppy, Obedience & Behavior | LDTT",
    desc: "Dog training for Ann Arbor and Ypsilanti apartments and homes: barking, reactivity, puppies and rescues. Free in-home evaluation. Call 866.436.4959.",
    top: "Ann Arbor Dog Owners: Free In-Home Training Evaluation, No Obligation",
    h1: ["SHARED WALLS.", "CALMER DOG."],
    sub: ["For apartments, condos and long shifts.", "Barking, pulling, reactivity, rescues.", "We explain the why, then train the how.", "Start with a free in-home evaluation."],
    cta: "Book My Free Evaluation",
    f_eyebrow: "Meet the Founder, Lorenzo Miller", f_head: ["KNOW THE WHY.", "SEE THE CHANGE."],
    f_p1: "Lorenzo Miller has trained dogs for more than 40 years and built one method that trainers in {n} states now follow. In Ann Arbor, your evaluation is with Dylan Atkinson, whose focus is helping owners understand why dogs do what they do, not just what to say.",
    f_btn: "Free Evaluation",
    svc: ["Potty and crate plans that fit a condo", "Loose leash on busy campus sidewalks", "Reactivity, barking and fear, explained", "Trains with a pro, from $2,500", "Task training after a suitability check", "Reliable focus around real distractions"],
    vids: [pair("Ruger: Before & After", ""), pair("Bailey's Turnaround", ""), pair("Enzo, Weeks Later", "")],
    loc_sub: "Ann Arbor, Ypsilanti and Canton. In-home evaluations by appointment."
  }
];
const defaultPhotos = design => Object.fromEntries(PHOTO_SLOTS[design].map(([key, , file]) => [key, A + file]));
const STARTERS = STARTER_COPY.map(c => ({ v: 2, ...c, states: STATES.slice(), reviews: REVIEWS.map(r => ({ ...r })), photos: defaultPhotos(c.design), seo: { noindex: true } }));
const STARTER_BY_DESIGN = Object.fromEntries(STARTERS.map(s => [s.design, s]));

// ───────────────────────── cleaning ─────────────────────────
const scrub = v => String(v ?? "").replace(/[ -]/g, " ");
const oneLine = (v, max) => scrub(v).replace(/\s+/g, " ").trim().slice(0, max);

// Our own 2.0 photos, or an https address that cannot break out of a url(...) or an attribute.
function photoUrl(value) {
  const u = String(value ?? "").trim();
  if (!u) return "";
  if (u.startsWith(A)) return ASSET_FILES.has(u.slice(A.length)) ? u : "";
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?\//i.test(u) || u.length > 600 || /['"()<>\\\s`]/.test(u)) return "";
  return u;
}

function cleanField(field, value, fallback, design) {
  if (field.kind === "text" || field.kind === "area") return typeof value === "string" ? oneLine(value, field.max) : (fallback ?? "");
  if (field.kind === "lines") {
    const src = Array.isArray(value) ? value : (fallback || []);
    // A shorter list the office saved stays shorter (2026-09-16: a 3-line page borrowed the starter's 4th line).
    return Array.from({ length: field.n }, (_, i) => oneLine(typeof src[i] === "string" ? src[i] : (Array.isArray(value) ? "" : (fallback?.[i] ?? "")), field.max));
  }
  if (field.kind === "pairs") {
    const n = VIDEO_COUNT[design];
    const src = Array.isArray(value) ? value : (fallback || []);
    return Array.from({ length: n }, (_, i) => {
      const item = src[i] && typeof src[i] === "object" ? src[i] : (fallback?.[i] || {});
      return { t: oneLine(item.t, field.max), s: design === "d3" ? "" : oneLine(item.s, field.max2) };
    });
  }
  if (field.kind === "reviews") {
    const src = Array.isArray(value) ? value : REVIEWS;
    return Array.from({ length: 3 }, (_, i) => {
      const item = src[i] && typeof src[i] === "object" ? src[i] : REVIEWS[i];
      return { name: oneLine(item.name, field.max), text: oneLine(item.text, field.max2) };
    });
  }
  if (field.kind === "states") {
    const src = Array.isArray(value) ? value : STATES;
    const seen = new Set();
    return src.map(s => oneLine(s, 40)).filter(s => ALL_STATES.includes(s) && !seen.has(s) && seen.add(s)).slice(0, MAX_STATES);
  }
  if (field.kind === "photos") {
    const src = value && typeof value === "object" ? value : {};
    return Object.fromEntries(PHOTO_SLOTS[design].map(([key, , file]) => [key, photoUrl(src[key]) || A + file]));
  }
  return fallback ?? "";
}

// Only the fields the chosen design draws are kept. A missing field starts from that design's starter words.
function normalizeContent(input) {
  const src = input && typeof input === "object" ? input : {};
  const design = DESIGN_IDS.has(src.design) ? src.design : "d1";
  const def = STARTER_BY_DESIGN[design];
  const out = { v: 2, design, slug: safeSlug(src.slug || "") || (typeof src.slug === "string" && src.slug.trim() ? "" : def.slug) };
  for (const field of FIELDS) {
    if (!field.designs.includes(design)) continue;
    out[field.key] = cleanField(field, src[field.key], def[field.key], design);
  }
  const parts = out.market.split(",").map(s => s.trim());
  out.city = parts[0] || "";
  out.state = /^[A-Z]{2}$/.test((parts[1] || "").toUpperCase()) ? parts[1].toUpperCase() : "";
  out.seo = { noindex: true }; // ad pages are for ads, not Google search
  // Site Builder 2.0 keys, stored ONLY when used, so a page saved before them keeps its exact shape and bytes.
  const anchors = ANCHORS[design].map(([id]) => id);
  const movable = anchors.filter(id => !FIXED_ANCHORS.has(id));
  if (Array.isArray(src.blocks) && src.blocks.length) {
    const kit = siteKit();
    const blocks = kit ? kit.normalizeKitBlocks(src.blocks, anchors) : src.blocks.slice(0, 20);
    if (blocks.length) out.blocks = blocks;
  }
  const logoPhoto = photoUrl(src.logo && typeof src.logo === "object" ? src.logo.photo : "");
  if (logoPhoto) { const size = parseInt(src.logo.size, 10); out.logo = { photo: logoPhoto, size: Number.isFinite(size) ? Math.min(220, Math.max(40, size)) : 100 }; }
  // Arrison 2026-09-16: her own videos on the founder photo and the before/after thumbnails.
  // An https MP4/WebM (the big-upload gives one) or a YouTube address; stored only when set.
  const videoUrl = value => { const u = String(value ?? "").trim(); return /^https:\/\/[a-z0-9.-]+(:\d+)?\//i.test(u) && u.length <= 600 && !/['"()<>\\\s`]/.test(u) ? u : ""; };
  const videos2 = {};
  for (const slot of ["founder", "ba1", "ba2", "ba3", "ba4", "st1", "st2", "st3"]) {
    const u = videoUrl(src.videos2 && typeof src.videos2 === "object" ? src.videos2[slot] : "");
    if (u) videos2[slot] = u;
  }
  if (Object.keys(videos2).length) out.videos2 = videos2;
  // Joshua 2026-09-16: "the words are way too big ... giving ability to resize" - headline size in percent.
  const h1Size = parseInt(src.h1_size, 10);
  if (Number.isFinite(h1Size) && h1Size >= 50 && h1Size <= 150 && h1Size !== 100) out.h1_size = h1Size;
  // Joshua 2026-09-16: "we need to resize the pictures in the frames" - zoom + focus point per photo slot.
  const pframe = {};
  if (src.pframe && typeof src.pframe === "object") {
    for (const [slot] of PHOTO_SLOTS[design]) {
      const f = src.pframe[slot];
      if (!f || typeof f !== "object") continue;
      const z = parseInt(f.z, 10), x = parseInt(f.x, 10), y = parseInt(f.y, 10);
      const kept = {};
      if (Number.isFinite(z) && z > 100 && z <= 250) kept.z = z;
      if (Number.isFinite(x) && x >= 0 && x <= 100 && x !== 50) kept.x = x;
      if (Number.isFinite(y) && y >= 0 && y <= 100 && y !== 50) kept.y = y;
      // the frame itself: move it and make it wider / taller (design pixels, +-300)
      for (const k of ["dx", "dy", "dw", "dh"]) { const v = parseInt(f[k], 10); if (Number.isFinite(v) && v !== 0 && Math.abs(v) <= 300) kept[k] = v; }
      // the top photo: "fit" shows the whole photo without stretching it; "shade" darkens it behind the words
      if (slot !== "hero" && slot !== "heroM" && f.hide === true) kept.hide = true; // the trash can on a photo
      if (slot === "hero") {
        if (f.fit === "cover") kept.fit = "cover";
        const sh = parseInt(f.shade, 10); if (Number.isFinite(sh) && sh > 0 && sh <= 70) kept.shade = sh;
      }
      if (Object.keys(kept).length) pframe[slot] = kept;
    }
  }
  if (Object.keys(pframe).length) out.pframe = pframe;
  // Joshua 2026-09-16: "click what I want and resize it like a page editor" — any positioned element of the
  // design (headline, the small line under it, a button...) keyed "<section>:<n>" in draw order.
  const elbox = {};
  if (src.elbox && typeof src.elbox === "object") {
    for (const [id, f] of Object.entries(src.elbox)) {
      if (!/^[a-z0-9-]{1,20}:\d{1,3}$/.test(id) || !f || typeof f !== "object") continue;
      const kept = {};
      for (const [k, lim] of [["dx", 400], ["dy", 400], ["dw", 600], ["dh", 400]]) { const v = parseInt(f[k], 10); if (Number.isFinite(v) && v !== 0 && Math.abs(v) <= lim) kept[k] = v; }
      const fs = parseInt(f.fs, 10); if (Number.isFinite(fs) && fs >= 30 && fs <= 300 && fs !== 100) kept.fs = fs;
      if (f.hide === true) { kept.hide = true; const label = oneLine(f.label, 40); if (label) kept.label = label; }
      if (FONTS.includes(f.font)) kept.font = f.font;
      if (Object.keys(kept).length) elbox[id] = kept;
    }
  }
  if (Object.keys(elbox).length) out.elbox = elbox;
  const pickList = list => [...new Set((Array.isArray(list) ? list : []).filter(id => movable.includes(id)))];
  const hidden = pickList(src.hidden);
  if (hidden.length) out.hidden = hidden;
  const order = pickList(src.order);
  if (order.length && order.join() !== movable.slice(0, order.length).join()) out.order = order;
  return out;
}

function fromStarter(slug, { market = "", newSlug = "" } = {}) {
  const starter = STARTERS.find(s => s.slug === slug) || STARTERS[0];
  const content = JSON.parse(JSON.stringify(starter));
  if (market) content.market = market;
  content.slug = safeSlug(newSlug) || starter.slug;
  return normalizeContent(content);
}

// ───────────────────────── drawing ─────────────────────────
const st = kv => Object.entries(kv).map(([k, v]) => `--${k}:${v}`).join(";");
const r1 = n => Math.round(n * 10) / 10;
const up = s => String(s || "").toUpperCase();
const fillN = (text, n) => String(text || "").split("{n}").join(String(n));
const ico = (name, extra = "") => `<i class="fa-solid fa-${name} ${extra}" aria-hidden="true"></i>`;
const brand = name => `<i class="fa-brands fa-${name}" aria-hidden="true"></i>`;

const G_ICON = '<svg class="gicon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>'
  + '<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>'
  + '<path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>'
  + '<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const GOOGLE_WORD = '<span class="gword"><b style="color:#4285F4">G</b><b style="color:#EA4335">o</b><b style="color:#FBBC05">o</b><b style="color:#4285F4">g</b><b style="color:#34A853">l</b><b style="color:#EA4335">e</b></span>';
// Training list, final order and names (meeting 11 Sep 2026). Same on all three designs.
const PANEL_ITEMS = [["dog", "Obedience On &amp; Off Leash<br>&amp; Household Manners"], ["bark", "Behavior<br>Modification"], ["dog", "Puppy Training<br>&amp; Socialization"], ["house", "Board &amp; Train<br>Programs"], ["dog", "Service Dog<br>Training"]];
// Barking dog: Font Awesome 6.5.2 "dog" (CC BY 4.0) + three bark arcs.
const BARK_ICON = '<svg class="pi pi-svg" viewBox="0 -8 700 528" aria-hidden="true" focusable="false">'
  + '<path d="M309.6 158.5L332.7 19.8C334.6 8.4 344.5 0 356.1 0c7.5 0 14.5 3.5 19 9.5L392 32h52.1c12.7 0 24.9 5.1 33.9 14.1L496 64h56c13.3 0 24 10.7 24 24v24c0 44.2-35.8 80-80 80H464 448 426.7l-5.1 30.5-112-64zM416 256.1L416 480c0 17.7-14.3 32-32 32H352c-17.7 0-32-14.3-32-32V364.8c-24 12.3-51.2 19.2-80 19.2s-56-6.9-80-19.2V480c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V249.8c-28.8-10.9-51.4-35.3-59.2-66.5L1 167.8c-4.3-17.1 6.1-34.5 23.3-38.8s34.5 6.1 38.8 23.3l3.9 15.5C70.5 182 83.3 192 98 192h30 16H303.8L416 256.1zM464 80a16 16 0 1 0 -32 0 16 16 0 1 0 32 0z"/>'
  + '<g fill="none" stroke="currentColor" stroke-width="30" stroke-linecap="round">'
  + '<path d="M612 58a52 52 0 0 1 0 64"/><path d="M646 26a100 100 0 0 1 0 128"/><path d="M680 -4a148 148 0 0 1 0 188"/></g></svg>';
const panelIcon = name => (name === "bark" ? BARK_ICON : ico(name, "pi"));

function mapSvg(served, label) {
  const on = new Set(served);
  const shapes = [];
  const labels = [];
  for (const [name, shape] of Object.entries(MAP.states)) {
    const isOn = on.has(name);
    shapes.push(`<path class="${isOn ? "on" : "off"}" d="${shape.d}"><title>${E(name)}</title></path>`);
    if (!isOn) continue;
    const ab = ABBR[name] || "";
    const [cx, cy] = shape.c;
    if (MAP.outside[name]) {
      const [lx, ly] = MAP.outside[name];
      labels.push(`<line x1="${cx}" y1="${cy}" x2="${lx - 20}" y2="${ly - 7}"/><text class="out" x="${lx}" y="${ly}">${ab}</text>`);
    } else {
      const [nx, ny] = MAP.nudge[name] || [0, 0];
      labels.push(`<text x="${cx + nx}" y="${cy + ny + 9}">${ab}</text>`);
    }
  }
  return `<svg class="usmap" viewBox="${MAP.viewBox}" role="img" aria-label="${E(label)}" xmlns="http://www.w3.org/2000/svg">${shapes.join("")}<g class="lbl">${labels.join("")}</g></svg>`;
}

function head(c, o) {
  // Rule 11: the pixel and Google Ads tag come only from lib/ad-page-template.js. The practice copy leaves them out.
  const tracking = o.practice ? "<!-- practice copy: no Meta pixel or Google Ads tag, so test leads never reach the ad accounts -->" : `${googleAdsHead()}\n${metaPixelHead()}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${E(c.title)}</title>
<meta name="description" content="${E(c.desc)}">
<meta name="robots" content="noindex,nofollow">${o.base ? `\n<base href="${E(o.base)}">` : ""}
<link rel="icon" href="${A}emblem.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Poppins:wght@400;500;600;700;800&family=Kaushan+Script&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="${A}v2.css?v=${VERSION}">
<link rel="preload" as="image" href="${E(c.photos.hero)}">
${tracking}
</head><body class="${c.design}" data-market="${E(c.market)}" data-slug="${E(c.slug)}">
${o.practice ? '<div class="sandbox-pill" role="note">PRACTICE COPY · 2.0 page · test only</div>\n' : ""}<main class="page">`;
}

const topbar = c => `<div class="topbar"><span>${E(c.top)}</span></div>`;

function logoBlock(x, y, w, cls = "hdr-logo") {
  return `<a class="a ${cls}" href="#top" style="${st({ x, y, w })}" aria-label="Lorenzo's Dog Training Team">`
    + `<img class="emb" src="${A}emblem.png" alt="" width="306" height="190">`
    + `<span class="lg-name">LORENZO'S</span><span class="lg-team">DOG TRAINING TEAM.</span>`
    + `<span class="lg-tag">SERIOUS TRAINING. SERIOUS RESULTS.</span></a>`;
}

function header(d) {
  const cfg = {
    d1: { h: 77, logo: [51, 8, 155], circ: [370, 15, 50], ct: [437, 15, 36], sub: null, btn: [797, 20, 185, 40] },
    d2: { h: 73, logo: [47, 3, 157], circ: [355, 12, 52], ct: [428, 12, 39], sub: null, btn: [797, 18, 193, 39] },
    d3: { h: 85, logo: [25, 8, 157], circ: [379, 20, 42], ct: [450, 14, 33], sub: [431, 54], btn: [795, 24, 203, 40] }
  }[d];
  const [cx, cy, cd] = cfg.circ;
  const [tx, ty, tfs] = cfg.ct;
  const [bx, by, bw, bh] = cfg.btn;
  const sub = cfg.sub ? `<span class="a call-sub" style="${st({ x: cfg.sub[0], y: cfg.sub[1] })}">Let's Get Started on a Better Tomorrow.</span>` : "";
  return `<header class="sec hdr" id="top" style="${st({ h: cfg.h })}">`
    + logoBlock(...cfg.logo)
    + `<a class="a call-circ" href="${TEL}" style="${st({ x: cx, y: cy, w: cd, h: cd })}" aria-label="Call ${PHONE}">${ico("phone")}</a>`
    + `<a class="a call-t" href="${TEL}" style="${st({ x: tx, y: ty, fs: tfs })}">CALL US TODAY!</a>` + sub
    + `<a class="a phone-btn" href="${TEL}" style="${st({ x: bx, y: by, w: bw, h: bh })}">${ico("phone")}<span>${PHONE}</span></a>`
    + "</header>";
}

function hero(c) {
  const d = c.design;
  const g = {
    d1: { h: 378, h1: [64, 57, 64, 55], rule: [65, 177, 362], sub: [65, 191, 16, 19.5], cta: [65, 293, 252, 39], panel: [727, 24, 253, 325, 17, 46, 44.5, 272, 210, 36] },
    d2: { h: 340, h1: [61, 42, 60, 51], rule: [63, 159, 369], sub: [63, 172, 15.5, 19], cta: [63, 262, 257, 40], panel: [725, 19, 258, 311, 13, 38, 44.5, 263, 215, 34] },
    d3: { h: 385, h1: [59, 70, 66, 58], rule: [60, 204, 368], sub: [60, 218, 16, 19.5], cta: [60, 306, 252, 40], panel: [727, 21, 253, 335, 17, 49, 46.5, 280, 210, 36] }
  }[d];
  const hRaw = parseInt(c.h1_size, 10);
  const hScale = (Number.isFinite(hRaw) && hRaw >= 50 && hRaw <= 150 ? hRaw : 100) / 100;
  const [hx, hy, hfs, hlh] = [g.h1[0], g.h1[1], r1(g.h1[2] * hScale), r1(g.h1[3] * hScale)];
  const [rx, ry, rw] = g.rule;
  const [sx, sy, sfs, slh] = g.sub;
  const [cx, cy, cw, ch] = g.cta;
  let [px, py, pw, ph, pty, piy, pp, pby, pbw, pbh] = g.panel;
  // the 11 Sep training names are longer than the design's: the panel grows 20 design px to the left
  px -= 20; pw += 20;
  const items = PANEL_ITEMS.map(([icn, txt], i) => `<li class="a" style="${st({ x: 30, y: r1(piy + i * pp) })}">${panelIcon(icn)}<span>${txt}</span></li>`).join("");
  return `<section class="sec hero" style="${st({ h: g.h })};--img:url(${E(c.photos.hero)});--img-m:url(${E(c.photos.heroM)})${heroVars(c)}">`
    + `<h1 class="a" style="${st({ x: hx, y: hy, fs: hfs, lh: hlh })}">${E(c.h1[0])} <br>${E(c.h1[1])}</h1>`
    + `<div class="a rule" style="${st({ x: rx, y: ry, w: rw })}"><span></span>${ico("star")}<span></span></div>`
    + `<p class="a hero-sub" style="${st({ x: sx, y: sy, fs: sfs, lh: slh, w: 420 })}">${c.sub.map(E).join("<br>")}</p>`
    + `<button class="a btn-red cta" data-open="eval" style="${st({ x: cx, y: cy, w: cw, h: ch })}">${E(up(c.cta))}</button>`
    + `<aside class="a panel" style="${st({ x: px, y: py, w: pw, h: ph })}"><h2 class="a" style="${st({ x: 0, y: pty, w: pw })}">PROFESSIONAL DOG TRAINING</h2>`
    + `<ul>${items}</ul><a class="a btn-white" href="${LIVE}/dog-training" style="${st({ x: Math.round((pw - pbw) / 2), y: pby, w: pbw, h: pbh })}">OUR TRAINING PROGRAMS</a></aside>`
    + "</section>";
}

const vsrc = (c, slot) => (c.videos2 && typeof c.videos2 === "object" && c.videos2[slot]) || "";
// Joshua 2026-09-16: "resize the frame". The design's box for a photo slot, moved / resized by the office.
function fbox(c, slot, base) {
  const f = c.pframe && typeof c.pframe === "object" ? c.pframe[slot] : null;
  const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(-300, Math.min(300, n)) : 0; };
  if (!f) return st(base);
  return st({ ...base, x: r1(base.x + num(f.dx)), y: r1(base.y + num(f.dy)), w: r1(Math.max(40, base.w + num(f.dw))), h: r1(Math.max(40, base.h + num(f.dh))) }) + (f.hide === true ? ";display:none" : "");
}
// The top photo: fit (no stretching), focus point, zoom and a shade behind the words, as CSS variables.
function heroVars(c) {
  const f = c.pframe && typeof c.pframe === "object" ? c.pframe.hero : null;
  if (!f) return "";
  const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
  const x = Math.max(0, Math.min(100, num(f.x, 50))), y = Math.max(0, Math.min(100, num(f.y, 50)));
  const z = Math.max(100, Math.min(250, num(f.z, 100)));
  const shade = Math.max(0, Math.min(70, num(f.shade, 0)));
  const cover = f.fit === "cover" || z > 100 || f.x !== undefined || f.y !== undefined;
  return `${cover ? `;--hpos:${x}% ${y}%;--hsz:${z > 100 ? `${z}% auto` : "cover"}` : ""}${shade ? `;--hshade:${r1(shade / 100)}` : ""}`;
}
// Every "class="a ..." element of a section, in draw order, is "<section>:<n>". The office's moves (elbox) shift
// its --x/--y/--w/--h and scale its --fs; in the editor each one is tagged data-sb-el so it can be clicked.
function applyElBoxes(html, c, editor) {
  const boxes = c.elbox && typeof c.elbox === "object" ? c.elbox : {};
  if (!editor && !Object.keys(boxes).length) return html;
  const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
  return html.replace(/<section (?:data-sb-sec="[^"]*" )?class="sec ([a-z0-9-]+)[^"]*"[\s\S]*?<\/section>/g, (sec, key) => {
    let n = 0;
    return sec.replace(/<([a-z0-9]+) class="a( [^"]*)?"([^>]*?)style="([^"]*)"/g, (m, tag, cls, mid, style) => {
      const id = `${key}:${n++}`;
      const box = boxes[id];
      let st = style;
      if (box) {
        const shift = (name, delta) => { if (!delta) return; const re = new RegExp(`--${name}:(-?[0-9.]+)`); st = re.test(st) ? st.replace(re, (mm, v) => `--${name}:${r1(Number(v) + delta)}`) : (name === "x" || name === "y" ? `${st};--${name}:${delta}` : st); };
        shift("x", num(box.dx)); shift("y", num(box.dy)); shift("w", num(box.dw)); shift("h", num(box.dh));
        const fs = num(box.fs); if (fs && fs !== 100) st = st.replace(/--fs:(-?[0-9.]+)/, (mm, v) => `--fs:${r1(Number(v) * fs / 100)}`).replace(/--lh:(-?[0-9.]+)/, (mm, v) => `--lh:${r1(Number(v) * fs / 100)}`);
        if (FONTS.includes(box.font)) st += `;font-family:'${box.font}',sans-serif`;
        if (box.hide === true) st += ";display:none";
      }
      return `<${tag} class="a${cls || ""}"${mid}${editor ? `data-sb-el="${id}" ` : ""}style="${st}"`;
    });
  });
}
// The office's zoom + focus for one photo slot, as an inline style (empty when the design's own framing is kept).
function pimg(c, slot) {
  const f = c.pframe && typeof c.pframe === "object" ? c.pframe[slot] : null;
  if (!f) return "";
  const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
  const x = Math.max(0, Math.min(100, num(f.x, 50)));
  const y = Math.max(0, Math.min(100, num(f.y, 50)));
  const z = Math.max(100, Math.min(250, num(f.z, 100)));
  return ` style="object-fit:cover;object-position:${x}% ${y}%;${z > 100 ? `transform:scale(${r1(z / 100)});transform-origin:${x}% ${y}%` : ""}"`;
}
const play = (px, py, size, video, label, src) => `<button class="o play" data-video="${E(src || VIDEOS[video] || "")}" style="--px:${px};--py:${py};--s:${size}" aria-label="Play video: ${E(label)}">${ico("play")}</button>`;

function quotePanel(x, y, w, h, fs = 16.5, lh = 21) {
  return `<figure class="a quote" style="${st({ x, y, w, h })}"><span class="qm">&ldquo;</span>`
    + `<blockquote style="--fs:${fs};--lh:${lh}">&ldquo;A well-trained dog is a happier dog, a safer community, and a stronger bond for life.&rdquo;</blockquote>`
    + "<figcaption><b>&mdash; Lorenzo Miller</b><span>Founder, Lorenzo's Dog Training Team</span></figcaption></figure>";
}

function reviews(c, d) {
  const d3 = d === "d3";
  const cards = d3 ? [[55, 1078], [364, 1078], [672, 1078]] : [[40, 932], [361, 932], [687, 932]];
  const top = d3 ? 1020 : 890;
  const [w, h] = d3 ? [297, 126] : [302, 103];
  return cards.map(([x, y], i) => {
    const r = c.reviews[i];
    const initial = (r.name.trim()[0] || "").toUpperCase();
    return `<article class="a rv" style="${st({ x, y: y - top, w, h })}"><div class="rv-top"><span class="stars">`
      + (d3 ? "<b>5</b>" : "") + ico("star").repeat(5) + '</span><span class="rv-date">Google review</span></div>'
      + `<p>${E(r.text)}</p><div class="rv-by"><span class="av">${E(initial)}</span><span>${E(r.name)}</span>${G_ICON}</div></article>`;
  }).join("");
}

function redBand(d) {
  const [h, circ, tx, btn] = d === "d3" ? [52, [258, 13, 38], [315, 9], [614, 11, 153, 34]] : [39, [301, 5, 34], [350, 5], [599, 7, 128, 27]];
  return `<section class="sec band" style="${st({ h })}">`
    + `<a class="a band-circ" href="${TEL}" style="${st({ x: circ[0], y: circ[1], w: circ[2], h: circ[2] })}" aria-label="Call">${ico("phone")}</a>`
    + `<div class="a band-t" style="${st({ x: tx[0], y: tx[1] })}"><b>READY TO GET STARTED?</b><span>Book your FREE evaluation today!</span></div>`
    + `<a class="a band-btn" href="${TEL}" style="${st({ x: btn[0], y: btn[1], w: btn[2], h: btn[3] })}">${PHONE}</a></section>`;
}

function footer(d, n) {
  const h = d === "d3" ? 124 : 129;
  const cols = [
    ["QUICK LINKS", [["About Us", "/about"], ["Training Programs", "/dog-training"], ["Service Dogs", "/specialty-advanced"], ["Board &amp; Train", "/dog-training"], ["Locations", "/find-a-trainer"]]],
    ["RESOURCES", [["Results", "/#reviews"], ["Success Stories", "/#reviews"], ["FAQs", "/contact"], ["Contact Us", "/contact"]]],
    ["LOCATIONS", [["Find a Location", "/find-a-trainer"], [`${n} States`, "/find-a-trainer"]]],
    ["CONTACT", [[PHONE, TEL], ["Contact Us", "/contact"], ["Get a Free Evaluation", "#eval"]]]
  ];
  const xs = [308, 444, 568, 688];
  const colHtml = cols.map(([t, links], i) => {
    const lk = links.map(([name, u]) => `<a href="${/^(tel:|#)/.test(u) ? u : LIVE + u}"${u === "#eval" ? ' data-open="eval"' : ""}>${name}</a>`).join("");
    return `<nav class="a fcol" style="${st({ x: xs[i], y: 18 })}"><h3>${t}</h3>${lk}</nav>`;
  }).join("");
  const soc = SOCIAL.map(([icon, u, name]) => `<a href="${u}" target="_blank" rel="noopener" aria-label="${name}">${brand(icon)}</a>`).join("");
  return `<footer class="sec foot" style="${st({ h })}">`
    + `<a class="a flogo" href="#top" style="${st({ x: 53, y: 12, w: 215 })}"><img class="emb" src="${A}emblem.png" alt="" width="306" height="190">`
    + `<span class="lg-name">LORENZO'S</span><span class="lg-team">DOG TRAINING TEAM.</span><span class="lg-tag">SERIOUS TRAINING. SERIOUS RESULTS.</span></a>`
    + colHtml + `<div class="a social" style="${st({ x: 814, y: 31 })}">${soc}</div></footer>`;
}

const legal = () => `<div class="legal">&copy; Lorenzo's Dog Training Team · <a href="${LIVE}/privacy-policy">Privacy Policy</a> · <a href="${TEL}">${PHONE}</a></div>`;

function modals(c, o) {
  const opts = ["Pulling on the leash", "Barking", "Jumping on people", "Reactive to dogs or people", "New puppy", "New rescue", "Board &amp; train", "Service dog", "Something else"].map(x => `<option>${x}</option>`).join("");
  // The editor's preview has no endpoint, so a test click in Page Studio never makes a lead.
  const endpoint = o.preview ? "" : BOOKING_ENDPOINT;
  const note = o.preview ? '<p class="sbx-note wide">Page Studio preview: this form sends nothing.</p>'
    : o.practice ? "<p class=\"sbx-note wide\">PRACTICE COPY &mdash; test only. This form goes to the practice copy, not to Lorenzo's office.</p>" : "";
  return `<div class="modal" id="m-eval" hidden><div class="mcard" role="dialog" aria-modal="true" aria-labelledby="m-eval-t">
<button class="mclose" data-close aria-label="Close">&times;</button>
<h2 id="m-eval-t">Book Your Free In-Home Evaluation</h2><p class="msub">${E(c.market)} · No cost, no obligation. Prefer to talk? <a href="${TEL}">Call ${PHONE}</a></p>
<form class="lead contact-intake" data-kind="evaluation" data-endpoint="${endpoint}" novalidate>
${note}
<label>First name<input name="first_name" autocomplete="given-name" required></label>
<label>Last name<input name="last_name" autocomplete="family-name" required></label>
<label>Phone<input name="phone" type="tel" autocomplete="tel" required></label>
<label>Email<input name="email" type="email" autocomplete="email" required></label>
<label>ZIP code<input name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="10" required placeholder="${E(c.zip)}"></label>
<label>Dog's name <small>(optional)</small><input name="dog_name" autocomplete="off"></label>
<label class="wide">What is going on with your dog?<select name="problem">${opts}</select></label>
<label class="consent wide"><input type="checkbox" name="sms_consent" value="yes"><span>${SMS_CONSENT}</span></label>
<p class="fnote wide">Phone is required so Lorenzo's office can call about your request. SMS consent is optional and separate from submitting this form.</p>
<button class="btn-red wide" type="submit">REQUEST MY FREE EVALUATION</button>
<p class="fstatus wide" role="status" aria-live="polite"></p></form></div></div>
<div class="modal" id="m-book" hidden><div class="mcard" role="dialog" aria-modal="true" aria-labelledby="m-book-t">
<button class="mclose" data-close aria-label="Close">&times;</button>
<h2 id="m-book-t">Get The 5-Step Calm Dog Blueprint</h2><p class="msub">Free guide, sent to your inbox.</p>
<form class="lead pdf-optin" data-kind="ebook" novalidate>
<label>Your name<input name="name" autocomplete="name" required></label>
<label>Email<input name="email" type="email" autocomplete="email" required></label>
<label class="wide">Phone<input name="phone" type="tel" autocomplete="tel" required></label>
<button class="btn-red wide" type="submit">SEND MY FREE GUIDE</button>
<a class="btn-navy wide bdl" href="${E(String(c.b_url || "").trim() || (LIVE + "/assets/calm-dog-blueprint-final.pdf"))}" target="_blank" rel="noopener" download>DOWNLOAD THE BOOKLET (PDF)</a>
<p class="fstatus wide" role="status" aria-live="polite"></p></form></div></div>
<div class="modal" id="m-video" hidden><div class="mcard mvideo" role="dialog" aria-modal="true" aria-label="Video">
<button class="mclose" data-close aria-label="Close">&times;</button><video controls playsinline preload="none"></video></div></div>`;
}

const tail = (c, o) => `</main><div class="mbar"><a href="${TEL}">${ico("phone")} Call</a><button data-open="eval">Free Evaluation</button></div>`
  + modals(c, o) + `<script src="${A}v2.js?v=${VERSION}" defer></script></body></html>`;

function svcCards(c, d) {
  const titles = ["PUPPY TRAINING", "OBEDIENCE TRAINING", "BEHAVIOR SOLUTIONS", "BOARD &amp; TRAIN", "SERVICE DOG TRAINING", "ADVANCED TRAINING"];
  const icons = ["paw", "person-walking", "bark", "house", "shield-dog", "heart"]; // Behavior Solutions = the barking dog
  const d3 = d === "d3";
  const xs = d3 ? [[40, 152], [201, 151], [361, 151], [521, 150], [681, 150], [840, 149]] : [[34, 155], [199, 151], [358, 150], [517, 150], [676, 151], [836, 153]];
  const [y, ph, ch] = d3 ? [37, 134, 214] : [35, 103, 185];
  return xs.map(([x, w], i) => `<article class="a card" style="${fbox(c, `svc${i + 1}`, { x, y, w, h: ch })}"><div class="cimg" style="${st({ h: ph })}">`
    + `<img src="${E(c.photos[`svc${i + 1}`])}" alt="" loading="lazy" width="${w * 2}" height="${ph * 2}"${pimg(c, `svc${i + 1}`)}><span class="cic">${icons[i] === "bark" ? BARK_ICON : ico(icons[i])}</span></div>`
    + `<h3>${titles[i]}</h3><p>${E(c.svc[i])}</p></article>`).join("");
}

function pageD1(c, o) {
  const P = c.photos;
  const n = c.states.length;
  const baX = [[32, 230], [276, 231], [519, 231], [764, 231]];
  const plays = [[116, 55], [115, 53], [116, 55], [115, 53]];
  const vids = ["review", "ad", "story", "trainers"];
  const ba = c.vids.map((v, i) => {
    const [x, w] = baX[i];
    return `<article class="a ba" style="${fbox(c, `ba${i + 1}`, { x, y: 87, w, h: 137 })}"><div class="baimg"><img src="${E(P[`ba${i + 1}`])}" alt="" loading="lazy" width="${w * 2}" height="150"${pimg(c, `ba${i + 1}`)}>`
      + play(r1(plays[i][0] / w * 100), plays[i][1] / 75 * 100, 42, vids[i], v.t, vsrc(c, `ba${i + 1}`)) // not rounded, as in the 11 Sep build
      + `</div><div class="lbl"><span>BEFORE</span><span>AFTER</span></div><h3>${E(v.t)}</h3><p>${E(v.s)}</p></article>`;
  }).join("");
  const checks = c.check.map((t, i) => `<li class="a" style="${st({ x: 254, y: 31 + i * 33 })}">${ico("check")}<span>${E(t)}</span></li>`).join("");
  const inc = c.inc.map(t => `<li>${ico("bone")}<span>${E(t)}</span></li>`).join("");
  const states = c.states.map((s, i) => `<li class="a" style="${st({ x: i < 6 ? 733 : 865, y: r1((i < 6 ? i : i - 6) * 21.6 + 13) })}">${ico("location-dot")}<span>${E(s)}</span></li>`).join("");
  return head(c, o) + topbar(c) + header("d1") + hero(c)
    + `<section class="sec founder" style="${st({ h: 283 })}">`
    + `<p class="a eyebrow ey-line" style="${st({ x: 40, y: -10, fs: 15 })}"><span></span>${E(up(c.f_eyebrow))}</p>`
    + `<h2 class="a f-name" style="${st({ x: 44, y: 8, fs: 44 })}">LORENZO MILLER</h2>`
    + `<p class="a f-tag" style="${st({ x: 45, y: 58, fs: 12 })}">${E(c.f_tag)}</p>`
    + `<p class="a f-p" style="${st({ x: 45, y: 76, w: 305, fs: 10.4 })}">${E(fillN(c.f_p1, n))}</p>`
    + `<p class="a f-p" style="${st({ x: 45, y: 152, w: 305, fs: 10.4 })}">${E(fillN(c.f_p2, n))}</p>`
    + `<button class="a btn-red" data-open="eval" style="${st({ x: 46, y: 238, w: 155, h: 31 })}">${E(up(c.f_btn))}</button>`
    + `<div class="a ph ph-founder" style="${fbox(c, "founder", { x: 378, y: -1, w: 646, h: 275 })}"><picture><source media="(max-width:760px)" srcset="${E(P.founderM)}"><img src="${E(P.founder)}" alt="Trainer kneeling with a German Shepherd" width="1292" height="550" loading="lazy"${pimg(c, "founder")}></picture></div>`
    + quotePanel(796, 8, 200, 207) + "</section>"
    + `<section class="sec eval" id="eval" style="${st({ h: 211 })}">`
    + `<div class="a ph ph-golden" style="${fbox(c, "golden", { x: 0, y: 8, w: 513, h: 203 })}"><img src="${E(P.golden)}" alt="Happy golden retriever" width="1026" height="406" loading="lazy"${pimg(c, "golden")}><ul class="checks">${checks}</ul></div>`
    + `<p class="a eyebrow" style="${st({ x: 553, y: 5, fs: 11 })}">START TODAY</p>`
    + `<h2 class="a e-h" style="${st({ x: 553, y: 21, fs: 26.5, w: 360 })}">${E(up(c.e_head))}</h2>`
    + `<p class="a e-p" style="${st({ x: 553, y: 54, w: 335, fs: 11.3 })}">${E(c.e_sub)}</p>`
    + `<h3 class="a e-inc-h" style="${st({ x: 553, y: 97, fs: 16.5 })}">YOUR FREE EVALUATION INCLUDES:</h3>`
    + `<ul class="a e-inc" style="${st({ x: 553, y: 118, w: 240 })}">${inc}</ul>`
    + `<button class="a btn-red" data-open="eval" style="${st({ x: 787, y: 125, w: 220, h: 35 })}">${E(up(c.cta))}</button>`
    + `<div class="a badge" style="${st({ x: 922, y: -5, w: 85, h: 90 })}"><b>FREE</b><span>IN-HOME</span><i>&#10022;</i><em>NO COST</em></div>`
    + "</section>"
    + `<section class="sec ba-sec" style="${st({ h: 262 })}">`
    + `<p class="a ba-ey" style="${st({ x: 0, y: 9, w: 1024 })}"><span></span>REAL TRANSFORMATIONS<span></span></p>`
    + `<h2 class="a ba-h" style="${st({ x: 0, y: 28, w: 1024, fs: 35 })}">BEFORE &amp; AFTER VIDEOS</h2>`
    + `<p class="a ba-p" style="${st({ x: 0, y: 67, w: 1024, fs: 12 })}">See the difference professional training can make. Real dogs. Real owners. Real results.</p>`
    + ba + `<a class="a btn-outline-w" href="${LIVE}/#reviews" style="${st({ x: 394, y: 230, w: 233, h: 24 })}">VIEW MORE SUCCESS STORIES</a></section>`
    + `<section class="sec close1" style="${st({ h: 147 })}">`
    + `<img class="a aussie" src="${E(P.aussie)}" alt="Smiling Australian Shepherd in a Lorenzo's bandana" width="404" height="332" loading="lazy" style="${fbox(c, "aussie", { x: 20, y: -22, w: 202, h: 166 })}">`
    + `<p class="a eyebrow" style="${st({ x: 264, y: 15, fs: 10.5 })}">${E(up(c.c_eyebrow))}</p>`
    + `<h2 class="a c-h" style="${st({ x: 264, y: 27, fs: 30, w: 560 })}">${E(up(c.c_head))}</h2>`
    + `<p class="a c-p" style="${st({ x: 264, y: 66, w: 470, fs: 12.3 })}">${E(c.c_sub)}</p>`
    + `<a class="a btn-red btn-phone" href="${TEL}" style="${st({ x: 264, y: 98, w: 187, h: 37 })}">${ico("phone")}<span>${PHONE}</span></a>`
    + `<button class="a btn-outline" data-open="eval" style="${st({ x: 478, y: 98, w: 251, h: 37 })}">BOOK YOUR FREE EVALUATION</button>`
    + `<div class="a script" style="${st({ x: 815, y: 18, w: 190, h: 125 })}"><span>&ldquo;Better Dogs.</span><span>Happier People.&rdquo;</span>`
    + '<svg viewBox="0 0 100 20" aria-hidden="true"><path d="M2 18 C 35 6, 70 2, 98 3" fill="none" stroke="#d0021b" stroke-width="2.4" stroke-linecap="round"/></svg>'
    + ico("paw", "spaw") + "</div></section>"
    + `<section class="sec loc1" style="${st({ h: 159 })}">`
    + `<p class="a eyebrow" style="${st({ x: 48, y: 13, fs: 10.5 })}">${n} STATES. ONE STANDARD.</p>`
    + `<h2 class="a l-h" style="${st({ x: 48, y: 26, fs: 21 })}">FIND A LOCATION NEAR YOU</h2>`
    + `<p class="a l-p" style="${st({ x: 48, y: 53, w: 270, fs: 11 })}">${E(c.loc_sub)}</p>`
    + `<a class="a btn-outline" href="${LIVE}/find-a-trainer" style="${st({ x: 48, y: 97, w: 159, h: 28 })}">VIEW ALL LOCATIONS</a>`
    + `<div class="a map" style="${st({ x: 340, y: 1, w: 350, h: 156 })}">${mapSvg(c.states, `Map of the ${n} states Lorenzo's serves`)}</div>`
    + `<ul class="states">${states}</ul></section>`
    + legal() + tail(c, o);
}

function pageD2(c, o) {
  const P = c.photos;
  const n = c.states.length;
  const baX = [[39, 221], [276, 232], [520, 229], [767, 218]];
  const plays = [[105, 36], [119, 36], [112, 36], [112, 36]];
  const vids = ["review", "ad", "story", "trainers"];
  const ba = c.vids.map((v, i) => {
    const [x, w] = baX[i];
    return `<article class="a ba ba2" style="${fbox(c, `ba${i + 1}`, { x, y: 61, w, h: 96 })}"><div class="baimg"><img src="${E(P[`ba${i + 1}`])}" alt="" loading="lazy" width="${w * 2}" height="104"${pimg(c, `ba${i + 1}`)}>`
      + play(r1(plays[i][0] / w * 100), r1(plays[i][1] / 52 * 100), 34, vids[i], v.t, vsrc(c, `ba${i + 1}`))
      + `</div><div class="lbl"><span>BEFORE</span><span>AFTER</span></div><h3>${E(v.t)}</h3><p>${E(v.s)}</p></article>`;
  }).join("");
  const bul = c.b_bul.map((t, i) => `<li class="a" style="${st({ x: 745, y: r1(24 + i * 27.5) })}">${ico("check")}<span>${E(t)}</span></li>`).join("");
  return head(c, o) + topbar(c) + header("d2") + hero(c)
    + `<section class="sec founder2" style="${st({ h: 227 })}"><span class="a vline" style="${st({ x: 38, y: 5, h: 207 })}"></span>`
    + `<p class="a eyebrow" style="${st({ x: 47, y: 3, fs: 13 })}">MEET THE FOUNDER,</p>`
    + `<h2 class="a f2-h" style="${st({ x: 46, y: 16, fs: 35 })}">LORENZO MILLER</h2>`
    + `<p class="a f2-tag" style="${st({ x: 47, y: 56, fs: 12 })}">${E(c.f_tag)}</p>`
    + `<p class="a f-p f2-p" style="${st({ x: 47, y: 78, w: 305, fs: 11.3 })}">${E(fillN(c.f_p1, n))}</p>`
    + `<button class="a btn-red" data-open="eval" style="${st({ x: 47, y: 188, w: 144, h: 32 })}">${E(up(c.f_btn))}</button>`
    + `<div class="a ph ph-founder" style="${fbox(c, "founder", { x: 370, y: 5, w: 624, h: 218 })}"><picture><source media="(max-width:760px)" srcset="${E(P.founderM)}"><img src="${E(P.founder)}" alt="Trainer kneeling with a German Shepherd" width="1248" height="436" loading="lazy"${pimg(c, "founder")}></picture>`
    + play(40.7, 57, 64, "story", "Our story", vsrc(c, "founder"))
    + `<div class="o vcap" style="--px:1.8;--py:82"><b>SEE THE LORENZO'S DIFFERENCE</b><span>Watch Our Story</span></div></div>`
    + quotePanel(788, 8, 205, 208, 14, 18.5) + "</section>"
    + `<section class="sec svc svc2" style="${st({ h: 225 })}"><h2 class="a svc-h" style="${st({ x: 0, y: 11, w: 1024 })}"><span></span>TRAINING FOR EVERY DOG. SOLUTIONS FOR EVERY OWNER.<span></span></h2>`
    + svcCards(c, "d2") + "</section>"
    + `<section class="sec rvs rvs2" style="${st({ h: 150 })}">`
    + `<h2 class="a rv-h" style="${st({ x: 344, y: 12, fs: 16.5 })}">READ OUR MOST <u>RECENT</u> CLIENT REVIEWS</h2>`
    + `<div class="a gbadge" style="${st({ x: 703, y: 7 })}">${GOOGLE_WORD}</div>`
    + `<p class="a gtxt" style="${st({ x: 810, y: 13, fs: 9.5 })}">600+ Google Reviews<br>Real clients. Real dogs.</p>`
    + reviews(c, "d2") + "</section>"
    + `<section class="sec ba-sec2" style="${st({ h: 188 })}">`
    + `<p class="a ba-ey" style="${st({ x: 0, y: 4, w: 1024 })}"><span></span>REAL TRANSFORMATIONS<span></span></p>`
    + `<h2 class="a ba-h" style="${st({ x: 0, y: 18, w: 1024, fs: 23 })}">BEFORE &amp; AFTER VIDEOS</h2>`
    + `<p class="a ba-p" style="${st({ x: 0, y: 44, w: 1024, fs: 9.5 })}">See the difference professional training can make. Real dogs. Real owners. Real results.</p>`
    + ba + `<a class="a btn-navy" href="${LIVE}/#reviews" style="${st({ x: 416, y: 163, w: 198, h: 20 })}">VIEW MORE SUCCESS STORIES</a></section>`
    + `<section class="sec ebook" style="${st({ h: 140 })}">`
    + `<img class="a book" src="${E(P.book)}" alt="The Calm Dog Blueprint booklet" width="556" height="296" loading="lazy" style="${fbox(c, "book", { x: 40, y: -6, w: 278, h: 148 })}">`
    + `<p class="a eyebrow" style="${st({ x: 364, y: 9, fs: 11.5 })}">${E(up(c.b_eyebrow))}</p>`
    + `<h2 class="a b-h" style="${st({ x: 364, y: 21, fs: 21.5 })}">THE CALM DOG BLUEPRINT</h2>`
    + `<p class="a b-p" style="${st({ x: 364, y: 46, w: 330, fs: 12.3 })}">${E(c.b_sub)}</p>`
    + `<button class="a btn-red" data-open="book" style="${st({ x: 364, y: 97, w: 259, h: 30 })}">GET YOUR FREE BOOKLET TODAY!</button>`
    + `<ul class="blist">${bul}</ul><span class="a bpaw" style="${st({ x: 962, y: 4 })}">${ico("paw")}</span></section>`
    + redBand("d2") + footer("d2", n) + legal() + tail(c, o);
}

function pageD3(c, o) {
  const P = c.photos;
  const n = c.states.length;
  const stX = [[27, 136], [174, 136], [322, 138]];
  const stPlay = [[68, 36], [68, 36], [69, 36]];
  const vids = ["review", "ad", "story"];
  const stories = c.vids.map((v, i) => {
    const [x, w] = stX[i];
    return `<article class="a story" style="${fbox(c, `st${i + 1}`, { x, y: 14, w, h: 114 })}"><div class="simg"><img src="${E(P[`st${i + 1}`])}" alt="" loading="lazy" width="${w * 2}" height="140"${pimg(c, `st${i + 1}`)}>`
      + play(r1(stPlay[i][0] / w * 100), r1(stPlay[i][1] / 70 * 100), 32, vids[i], v.t, vsrc(c, `st${i + 1}`))
      + `</div><p class="s-ey">SUCCESS STORY</p><h3>${E(v.t)}</h3></article>`;
  }).join("");
  const states = c.states.map((s, i) => `<li class="a" style="${st({ x: Math.floor(i / 6) === 0 ? 853 : 927, y: r1(14 + (i % 6) * 21.4) })}">${ico("location-dot")}<span>${E(s)}</span></li>`).join("");
  return head(c, o) + topbar(c) + header("d3") + hero(c)
    + `<section class="sec about3" style="${st({ h: 267 })}"><span class="a vline" style="${st({ x: 58, y: 18, h: 235 })}"></span>`
    + `<p class="a eyebrow" style="${st({ x: 77, y: 20, fs: 10.5 })}">${E(up(c.f_eyebrow))}</p>`
    + `<h2 class="a a3-h" style="${st({ x: 76, y: 36, fs: 31, lh: 32 })}">${E(c.f_head[0])} <br>${E(c.f_head[1])}</h2>`
    + `<p class="a f-p a3-p" style="${st({ x: 77, y: 114, w: 310, fs: 11.3 })}">${E(fillN(c.f_p1, n))}</p>`
    + `<button class="a btn-outline" data-open="eval" style="${st({ x: 77, y: 229, w: 164, h: 27 })}">${E(up(c.f_btn))}</button>`
    + `<div class="a ph ph-about" style="${fbox(c, "about", { x: 403, y: 17, w: 563, h: 240 })}"><img src="${E(P.about)}" alt="Trainer kneeling with a German Shepherd" width="1126" height="480" loading="lazy"${pimg(c, "about")}>`
    + play(47.6, 48.8, 70, "story", "Real dogs, real progress", vsrc(c, "founder"))
    + '<div class="o vcap" style="--px:4;--py:80"><b>REAL DOGS. REAL PROGRESS.</b><span>Watch How Training Changes Lives</span></div></div></section>'
    + `<section class="sec svc svc3" style="${st({ h: 256 })}"><h2 class="a svc-h" style="${st({ x: 0, y: 13, w: 1024 })}"><span></span>TRAINING FOR EVERY DOG. SOLUTIONS FOR EVERY OWNER.<span></span></h2>`
    + svcCards(c, "d3") + "</section>"
    + `<section class="sec rvs rvs3" style="${st({ h: 190 })}">`
    + `<h2 class="a rv-h" style="${st({ x: 336, y: 10, fs: 17.4 })}">READ OUR MOST <u>RECENT</u> CLIENT REVIEWS</h2>`
    + `<div class="a gbadge" style="${st({ x: 712, y: 8 })}">${GOOGLE_WORD}<small>REVIEWS ${ico("star").repeat(5)}</small></div>`
    + `<p class="a gtxt" style="${st({ x: 830, y: 18, fs: 10 })}">600+ Google Reviews<br>Real clients. Real dogs.</p>`
    + `<p class="a rv-ey" style="${st({ x: 56, y: 33, fs: 18 })}">HEAR FROM SATISFIED DOG OWNERS</p>`
    + reviews(c, "d3") + "</section>"
    + `<section class="sec stl" style="${st({ h: 150 })}">` + stories
    + `<span class="a vline" style="${st({ x: 478, y: 15, h: 120 })}"></span>`
    + `<p class="a eyebrow" style="${st({ x: 494, y: 13, fs: 8.5 })}">${n} STATES. ONE STANDARD.</p>`
    + `<h2 class="a l3-h" style="${st({ x: 494, y: 26, fs: 21, lh: 21 })}">FIND A LOCATION <br>NEAR YOU</h2>`
    + `<p class="a l3-p" style="${st({ x: 494, y: 74, w: 150, fs: 8.6 })}">${E(c.loc_sub)}</p>`
    + `<a class="a btn-outline" href="${LIVE}/find-a-trainer" style="${st({ x: 494, y: 115, w: 103, h: 25 })}">VIEW LOCATIONS</a>`
    + `<div class="a map" style="${st({ x: 643, y: 5, w: 199, h: 147 })}">${mapSvg(c.states, `Map of the ${n} states Lorenzo's serves`)}</div>`
    + `<ul class="states s3">${states}</ul></section>`
    + redBand("d3") + footer("d3", n) + legal() + tail(c, o);
}

// options: practice (no pixel, practice note), preview (form sends nothing), base (for an iframe srcdoc),
// editor (Site Builder canvas: section outlines, move/hide buttons, "+ Add block here"), data (reviews/trainers for
// kit blocks that show live data).
function renderPage(rawContent, options = {}) {
  const c = normalizeContent(rawContent);
  const o = { practice: Boolean(options.practice), preview: Boolean(options.preview), base: options.base || "" };
  const html = { d1: pageD1, d2: pageD2, d3: pageD3 }[c.design](c, o);
  // A page that uses none of the Site Builder 2.0 keys is returned exactly as the 11 Sep build draws it.
  if (!options.editor && !c.blocks && !c.logo && !c.hidden && !c.order && !c.elbox) return html;
  return arrange(html, c, { editor: options.editor === true, data: options.data || {} });
}

const SECTION_EDITOR_STYLE = `<style data-sb-sections>
[data-sb-el]{cursor:pointer}[data-sb-el]:hover{outline:2px dashed rgba(11,107,255,.7);outline-offset:-2px}
.sb-frame-sel{outline:3px solid #0b6bff!important;outline-offset:-3px;cursor:move!important;z-index:90!important}.sb-frame-sel img{pointer-events:none}
.sb-frame-handle{position:absolute;right:-8px;bottom:-8px;width:16px;height:16px;background:#0b6bff;border:2px solid #fff;border-radius:3px;cursor:nwse-resize;z-index:95;box-shadow:0 2px 8px rgba(0,0,0,.4);zoom:var(--sbz,1)}
.sb-clip>.sb-frame-handle{right:3px;bottom:3px}
.sb-eltools{position:absolute;left:0;top:-40px;z-index:96;display:flex;align-items:center;gap:4px;background:#0b6bff;padding:4px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:nowrap;zoom:var(--sbz,1)}
.sb-clip>.sb-eltools{top:6px;left:6px}
.sb-eltools span{color:#fff;font:800 11px/1 Inter,Arial,sans-serif;padding:0 8px;opacity:.95;max-width:220px;overflow:hidden;text-overflow:ellipsis}
.sb-eltools button{border:0;border-radius:7px;background:rgba(255,255,255,.16);color:#fff;font:800 12px/1 Inter,Arial,sans-serif;padding:8px 10px;cursor:pointer}.sb-eltools button:hover{background:#fff;color:#0b6bff}.sb-eltools button.x{background:rgba(0,0,0,.25)}
[data-sb-sec]{outline:2px dashed transparent;outline-offset:-2px;cursor:pointer}[data-sb-sec]:hover{outline-color:rgba(216,15,53,.55)}[data-sb-sec].sb-selected{outline:3px solid #d80f35;outline-offset:-3px}
[data-sb-sec]>.sb-label{position:absolute;top:8px;left:10px;z-index:60;display:none;background:#d80f35;color:#fff;font:900 11px/1 Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:7px 10px;border-radius:999px}
[data-sb-sec]:hover>.sb-label,[data-sb-sec].sb-selected>.sb-label{display:block}
.sb-sectools{position:absolute;top:6px;right:10px;z-index:60;display:none;gap:4px;background:#071f44;padding:4px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
[data-sb-sec]:hover>.sb-sectools,[data-sb-sec].sb-selected>.sb-sectools{display:flex}
.sb-sectools button{min-width:36px;height:34px;border:0;border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font:800 13px Inter,Arial,sans-serif;cursor:pointer;padding:0 10px}.sb-sectools button:hover{background:#fff;color:#071f44}
.sb-hidden-sec{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 18px;background:repeating-linear-gradient(45deg,#f4f7fb,#f4f7fb 10px,#e9eef5 10px,#e9eef5 20px);border:2px dashed #b8c6d8;color:#3b4d66;font:700 14px Inter,Arial,sans-serif}
.sb-hidden-sec button{min-height:38px;border-radius:10px;border:0;background:#082754;color:#fff;font:800 13px Inter,Arial,sans-serif;padding:0 14px;cursor:pointer}
.sb-add{display:flex;justify-content:center;padding:6px 0;background:#fff;position:relative;z-index:35}.sb-add button{min-height:42px;padding:0 20px;border:2px dashed #cbd8e8;border-radius:999px;background:#fff;color:#082754;font:900 13px Inter,Arial,sans-serif;cursor:pointer}.sb-add button:hover{border-color:#d80f35;color:#d80f35}
.hdr-logo,.flogo{cursor:pointer}
.sb-sectools,[data-sb-sec]>.sb-label,.sb-hidden-sec,.sb-add button{zoom:var(--sbz,1)}
</style>`;

// Site Builder 2.0: the page split at its sections, then put back in the office's order, hidden sections left out,
// kit blocks placed after the section they belong to, and a custom logo in the header and footer.
function arrange(html, c, { editor, data }) {
  const open = '<main class="page">';
  const start = html.indexOf(open);
  const end = html.lastIndexOf("</main>");
  if (start === -1 || end < start) return html;
  const kit = siteKit();
  const body = html.slice(start + open.length, end);
  const keyOf = chunk => { const m = chunk.match(/^<(?:section|header|footer) class="sec ([a-z0-9-]+)/); return m ? m[1] : chunk.startsWith('<div class="legal">') ? "legal" : "lead"; };
  const chunks = body.split(/(?=<section class="sec |<header class="sec |<footer class="sec |<div class="legal">)/).map(h => ({ key: keyOf(h), html: h }));
  const lead = chunks.filter(ch => ch.key === "lead"); // the red bar at the very top
  const legal = chunks.filter(ch => ch.key === "legal");
  const fixedTop = chunks.filter(ch => ch.key === "hdr");
  const fixedEnd = chunks.filter(ch => ch.key === "foot");
  let middle = chunks.filter(ch => !["lead", "legal", "hdr", "foot"].includes(ch.key));
  if (c.order) {
    const first = middle.map(ch => ch.key);
    const rank = key => { const i = c.order.indexOf(key); return i === -1 ? 100 + first.indexOf(key) : i; };
    middle = middle.slice().sort((a, b) => rank(a.key) - rank(b.key));
  }
  const hidden = new Set(c.hidden || []);
  const blocks = (c.blocks || []).map((block, index) => ({ block, index }));
  const after = key => blocks.filter(b => b.block.after === key);
  const label = key => (ANCHORS[c.design].find(([id]) => id === key) || [key, key])[1];
  const kitHtml = list => (kit && list.length ? kit.renderKitBlocks(list, { base: "/", data, editor }) : "");
  const addHere = key => (editor ? `<div class="sb-add" data-sb-add="after:${key}"><button type="button" data-sb-add-btn="after:${key}">+ Add block here</button></div>` : "");
  const movable = middle.map(ch => ch.key).filter(key => !hidden.has(key));
  const marked = ch => {
    if (!editor) return ch.html;
    const fixed = FIXED_ANCHORS.has(ch.key);
    const i = movable.indexOf(ch.key);
    const tools = `<span class="sb-label">${E(label(ch.key))}</span><div class="sb-sectools">${fixed ? "" : `<button type="button" data-sb-sectool="up" data-sec="${ch.key}" title="Move this section up" ${i <= 0 ? "disabled" : ""}>↑</button><button type="button" data-sb-sectool="down" data-sec="${ch.key}" title="Move this section down" ${i === movable.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-sb-sectool="hide" data-sec="${ch.key}" title="Hide this section">Hide</button>`}</div>`;
    const tagEnd = ch.html.indexOf(">");
    return ch.html.slice(0, tagEnd).replace(/^<(section|header|footer) /, `<$1 data-sb-sec="${ch.key}" `) + ">" + tools + ch.html.slice(tagEnd + 1);
  };
  const out = lead.map(ch => ch.html);
  const place = ch => {
    if (hidden.has(ch.key)) { if (editor) out.push(`<div class="sb-hidden-sec" data-sb-hidden-sec="${ch.key}"><span>${E(label(ch.key))} is hidden on the page</span><button type="button" data-sb-sectool="show" data-sec="${ch.key}">Show it again</button></div>`); }
    else out.push(marked(ch));
    out.push(kitHtml(after(ch.key)), addHere(ch.key));
  };
  fixedTop.forEach(place);
  middle.forEach(place);
  out.push(kitHtml(after("end")));
  fixedEnd.forEach(place);
  out.push(...legal.map(ch => ch.html));
  let page = html.slice(0, start + open.length) + out.join("") + html.slice(end);
  if (c.logo) {
    const img = `<img class="ldtt-custom-logo" src="${E(c.logo.photo)}" alt="Lorenzo's Dog Training Team" style="display:block;width:${c.logo.size}%;max-width:none;height:auto">`;
    // Function replacements: an address may hold "$", which a replacement STRING would treat as a pattern.
    page = page.replace(/(<a class="a hdr-logo"[^>]*>)[\s\S]*?(<\/a>)/, (m, open, close) => open + img + close).replace(/(<a class="a flogo"[^>]*>)[\s\S]*?(<\/a>)/, (m, open, close) => open + img + close);
  }
  page = applyElBoxes(page, c, editor);
  if (editor) {
    page = page.replace(/<a class="a (hdr-logo|flogo)"/g, '<a data-sb-img="logo.photo" class="a $1"');
    // Editor only: a click on one of the design's photos opens the photo picker for that photo slot.
    Object.entries(c.photos || {}).forEach(([slot, url]) => { const src = `src="${E(url)}"`; page = page.split(src).join(`${src} data-sb-img="photos.${slot}"`); });
  }
  const style = (kit && (c.blocks || editor) ? kit.kitStyle(c.blocks || [], { colors: DESIGN_COLORS[c.design], editor }) : "") + (editor ? SECTION_EDITOR_STYLE : "");
  return style ? page.replace("</head>", () => `${style}\n</head>`) : page;
}

// What must be true before a publish. The browser shows it; api/pages.js re-runs it.
function publishChecklist(rawContent) {
  const c = normalizeContent(rawContent);
  const checks = [];
  const add = (ok, name, fix) => checks.push({ ok: Boolean(ok), name, fix });
  add(c.slug, "Has a web address", "Type a web address, like miramar-beach (Address + search).");
  add(c.market, "Has a market name", "Type the market name, like Miramar Beach, FL (Address + search).");
  add(c.title, "Has a browser title", "Type the browser tab title (Address + search).");
  add(c.h1.every(Boolean), "Big headline has both lines", "Fill in both lines of the big headline (Top of page).");
  add(c.cta, "Main button has words", "Type the main button words (Top of page).");
  add(c.f_p1, "Founder paragraph is filled in", "Type the founder paragraph (Founder).");
  add(c.states.length >= 1, "At least one state on the map", "Tick at least one state (States).");
  const raw = rawContent && typeof rawContent === "object" && rawContent.photos && typeof rawContent.photos === "object" ? rawContent.photos : {};
  const bad = Object.entries(raw).filter(([, v]) => typeof v === "string" && v.trim() && !photoUrl(v)).map(([k]) => k);
  add(!bad.length, "Every photo has a safe address", `These photos cannot be used: ${bad.join(", ")}. Upload them again (Photos).`);
  const failures = checks.filter(check => !check.ok);
  return { ok: !failures.length, checks, failures };
}

return {
  VERSION, A, DESIGNS, SECTIONS, FIELDS, PHOTO_SLOTS, ALL_STATES, MAX_STATES, STATES, REVIEWS, STARTERS, VIDEO_COUNT,
  ASSET_FILES: [...ASSET_FILES], BOOKING_ENDPOINT, FONTS, photoUrl, normalizeContent, fromStarter, renderPage, publishChecklist, mapSvg,
  ANCHORS, FIXED_ANCHORS: [...FIXED_ANCHORS], ANCHOR_FIELDS, ANCHOR_PHOTOS, DESIGN_COLORS // Site Builder 2.0
};
});
