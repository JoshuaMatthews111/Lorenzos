// Trainer 2.0 landing page template (paid add-on, 2026-10-05). DO-NOT-BREAK rule 169.
//
// renderTrainer2Page(page, { practice }) draws one trainer's premium, ad-driven landing page from an entry in
// lib/trainer2-pages.js. Same brand language as the ad pages 2.0 (Oswald + Poppins, navy + red, "Serious Training.
// Serious Results."), mobile first, one lead form, a sticky Call / Free Evaluation bar on phones.
//
// Lead capture: the form is the 2.0 evaluation form (class "lead contact-intake", data-kind "evaluation") and is
// driven by the unchanged assets/v2/v2.js (validation, phone formatting, sendEvaluation, then on to /book). It posts
// to /api/trainer2-lead?page=<slug>, which fixes the trainer and the source page on the SERVER: there is no trainer
// picker on this page and the browser cannot hand the lead to anybody else.
// Tracking: the Meta pixel (PageView + Lead with one eventID for dedup) and the Google tag come only from
// lib/ad-page-template.js, exactly like the 2.0 pages (rule 11). The practice copy leaves them out.
//
// Safety: every text goes through escapeHtml; photos and videos are our own /assets/ paths from the config.
"use strict";

const BASE = require("./ad-page-template.js");
const PAGES = require("./trainer2-pages.js");

const { escapeHtml: E, metaPixelHead, googleAdsHead } = BASE;
const VERSION = "20261005t2a";
const PHONE = "866.436.4959";
const TEL = "tel:+18664364959";
const LOGO = "/assets/lorenzo-logo-white.png";
const BRAND = "Lorenzo's Dog Training Team";
const TAGLINE = "Serious Training. Serious Results.";

// The program panels' words (office "Text for Thumbnail" document, rule 160), in the card order of rule 153.
const PROGRAMS = [
  { title: "Puppy Training", tagline: "Start Right Before Bad Habits Start",
    solves: "Potty-training struggles, puppy biting and chewing, jumping, leash introduction, basic commands, crate training, socialization, and lack of structure.",
    goal: "Build the right behaviors early so you don’t have to correct bigger problems later.", icon: "paw" },
  { title: "Obedience Training", tagline: "Your Dog Knows the Command. Now They Need to Listen When It Matters.",
    solves: "Pulling on the leash, jumping on people, ignoring commands, poor recall, bolting through doors, difficulty settling, and inconsistent behavior around distractions.",
    goal: "A dog you can confidently communicate with at home, in public, and around everyday distractions.", icon: "leash" },
  { title: "Advanced Training", tagline: "When Basic Obedience Isn’t Enough",
    solves: "Commands breaking down around distractions, unreliable recall, inconsistent off-leash control, difficulty maintaining position, and owners who want a higher level of performance.",
    goal: "Move from “my dog knows it” to “my dog reliably does it.”", icon: "star" },
  { title: "Behavior Modification", tagline: "Stop Managing the Behavior. Start Solving It.",
    solves: "Excessive barking, lunging, reactivity, fear, resource guarding, destructive behavior, separation-related problems, and other persistent behavioral challenges.",
    goal: "Replace chaotic or unwanted behavior with clearer communication, structure, and more manageable responses.", icon: "bolt" },
  { title: "Board & Train", tagline: "Professional Training When You Need More Than Weekly Lessons",
    solves: "Major obedience gaps, inconsistent training, difficult leash behavior, lack of structure, busy-owner schedules, and dogs needing concentrated professional training.",
    goal: "Accelerate training while giving the owner the tools to continue the results at home.", icon: "home" },
  { title: "Service Dog Training", tagline: "Train the Dog to Perform the Tasks You Need",
    solves: "The need for reliable task-specific assistance that ordinary pet obedience training does not provide.",
    goal: "Develop reliable trained behaviors that support the handler’s functional needs.", icon: "shield" }
];

// The four steps from the home page ("The Technique Behind Our Training").
const PROCESS = [
  { title: "Schedule an Evaluation", text: "Start with a professional evaluation so the trainer can understand your dog, your household, and your goals." },
  { title: "Read the Dog and the Owner", text: "We look at temperament, obedience level, behavior patterns, timing, handling, and the structure already in the home." },
  { title: "Build the Tailored Path", text: "Your trainer recommends the right path for your pet: obedience, behavior modification, specialty training, or advanced work." },
  { title: "Train for Real Life", text: "The program teaches the dog and the owner together so the results hold up at home, around distractions, and in daily life." }
];

// The 2.0 form's "What is going on with your dog?" answers, word for word.
const PROBLEMS = ["Pulling on the leash", "Barking", "Jumping on people", "Reactive to dogs or people", "New puppy", "New rescue", "Board & train", "Service dog", "Something else"];

// SMS consent: the 2.0 pages' exact wording (DO-NOT-BREAK rule 47). Fixed HTML.
const SMS_CONSENT = "By checking this box, I agree to receive text messages from Lorenzo's Dog Training Team about my request: "
  + "follow-up on my inquiry, scheduling and confirming my free consultation or evaluation, and appointment reminders. "
  + "Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. "
  + "Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the "
  + '<a href="https://lorenzosdogtrainingteam.com/terms.html" target="_blank" rel="noopener">Terms of Service</a> and '
  + '<a href="https://lorenzosdogtrainingteam.com/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>.';

const US_STATES = [["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"],
  ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]];

// Small inline icons (no icon font to download).
const SVG = {
  phone: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>',
  star: '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/>',
  check: '<path d="M9.2 16.6L4.9 12.3l-1.4 1.4 5.7 5.7L20.5 8.1l-1.4-1.4z"/>',
  paw: '<path d="M12 13c-2.8 0-6 2.9-6 5.4 0 1.5 1.2 2.1 2.6 2.1 1.5 0 2.3-.7 3.4-.7s1.9.7 3.4.7c1.4 0 2.6-.6 2.6-2.1C18 15.9 14.8 13 12 13zM5.2 12.4c1.3-.4 1.9-2.1 1.3-3.7S4.4 6.2 3.1 6.6 1.2 8.7 1.8 10.3s2.1 2.5 3.4 2.1zm4-3.6c1.5 0 2.6-1.6 2.6-3.6S10.7 1.6 9.2 1.6 6.6 3.2 6.6 5.2s1.1 3.6 2.6 3.6zm5.6 0c1.5 0 2.6-1.6 2.6-3.6s-1.1-3.6-2.6-3.6-2.6 1.6-2.6 3.6 1.1 3.6 2.6 3.6zm6.1-2.2c-1.3-.4-2.8.5-3.4 2.1s0 3.3 1.3 3.7 2.8-.5 3.4-2.1 0-3.3-1.3-3.7z"/>',
  leash: '<path d="M17 2a5 5 0 0 0-4.6 7l-8.7 8.7a2 2 0 1 0 2.8 2.8L15.2 12A5 5 0 1 0 17 2zm0 7.6A2.6 2.6 0 1 1 17 4.4a2.6 2.6 0 0 1 0 5.2z"/>',
  bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  home: '<path d="M12 3L2 11.5h3V21h5.5v-6h3v6H19v-9.5h3z"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5zm-1.2 13.6l6-6-1.4-1.4-4.6 4.6-2.2-2.2-1.4 1.4z"/>',
  pin: '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  arrow: '<path d="M5 11h11.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H5z"/>'
};
const icon = (name, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SVG[name] || ""}</svg>`;
const stars = () => `<span class="stars" aria-hidden="true">${icon("star").repeat(5)}</span>`;
const stateOptions = own => US_STATES.map(([code, name]) => `<option value="${code}"${code === own ? " selected" : ""}>${name}</option>`).join("");
const img = (p, { sizes = "100vw", lazy = true, cls = "", priority = false } = {}) =>
  `<img${cls ? ` class="${cls}"` : ""} src="${E(p.src)}"${p.small ? ` srcset="${E(p.small)} ${p.small.match(/-(\d+)\.webp$/)?.[1] || 800}w, ${E(p.src)} ${p.w}w" sizes="${E(sizes)}"` : ""} width="${p.w}" height="${p.h}" alt="${E(p.alt)}"${lazy ? ' loading="lazy" decoding="async"' : ""}${priority ? ' fetchpriority="high"' : ""}>`;

function jsonLd(page) {
  const url = PAGES.canonicalUrl(page.slug);
  const tc = page.trainingCenter;
  const image = PAGES.SITE_ORIGIN + page.photos.hero.src;
  const person = {
    "@type": "Person", "@id": `${url}#person`, name: page.name, jobTitle: page.jobTitle, image,
    worksFor: { "@type": "Organization", name: BRAND, url: PAGES.SITE_ORIGIN },
    address: { "@type": "PostalAddress", addressLocality: page.city, addressRegion: page.state, addressCountry: "US" }
  };
  const business = {
    "@type": ["LocalBusiness", "ProfessionalService"], "@id": `${url}#business`,
    name: `${page.name} | ${BRAND}`, description: page.seo.description, url, image, telephone: "+1-866-436-4959", slogan: TAGLINE,
    address: { "@type": "PostalAddress", streetAddress: tc.street, addressLocality: tc.city, addressRegion: tc.state, postalCode: tc.zip, addressCountry: "US" },
    areaServed: page.areas.map(name => ({ "@type": "Place", name })),
    employee: { "@id": `${url}#person` },
    parentOrganization: { "@type": "Organization", name: BRAND, url: PAGES.SITE_ORIGIN }
  };
  const faq = { "@type": "FAQPage", "@id": `${url}#faq`, mainEntity: page.faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  // "</" can never close the script tag early.
  const data = JSON.stringify({ "@context": "https://schema.org", "@graph": [business, person, faq] }).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${data}</script>`;
}

const STYLE = `<style>
:root{--navy:#011731;--navy2:#072548;--ink:#0d1b2e;--muted:#4b5b70;--line:#e3e8ef;--red:#d0021b;--red2:#a80016;--bg:#f6f8fb;--gold:#f5b301;--r:16px}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}body{margin:0;font:400 16px/1.6 Poppins,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:var(--ink);background:#fff}
img,video{max-width:100%;display:block}a{color:inherit}
h1,h2,h3{font-family:Oswald,Impact,"Arial Narrow",sans-serif;font-weight:700;line-height:1.08;letter-spacing:.01em;margin:0}
.wrap{width:100%;max-width:1180px;margin:0 auto;padding:0 20px}
.skip{position:absolute;left:-999px;top:0;background:#fff;color:var(--navy);padding:10px 14px;z-index:99}.skip:focus{left:10px;top:10px}
:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.ic{width:1em;height:1em;fill:currentColor;flex:none}
.stars{display:inline-flex;gap:2px;color:var(--gold)}.stars .ic{width:17px;height:17px}
.eyebrow{display:inline-flex;align-items:center;gap:10px;font:600 12.5px/1.3 Poppins,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--red)}
.eyebrow:before{content:"";width:28px;height:2px;background:currentColor}
.sec{padding:64px 0}.sec-alt{background:var(--bg)}.sec-dark{background:var(--navy);color:#fff}
.sec-head{max-width:760px;margin:0 0 34px}.sec-head.c{margin:0 auto 34px;text-align:center}.sec-head.c .eyebrow:after{content:"";width:28px;height:2px;background:currentColor}
.sec-head h2{font-size:clamp(30px,5.4vw,46px);text-transform:uppercase;margin:12px 0 10px;color:var(--navy)}.sec-dark .sec-head h2{color:#fff}
.sec-head p{margin:0;color:var(--muted);font-size:17px}.sec-dark .sec-head p{color:#c9d4e3}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 26px;border-radius:999px;border:0;font:700 15px/1 Poppins,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;cursor:pointer;transition:transform .15s ease,background .15s ease,box-shadow .15s ease}
.btn-red{background:var(--red);color:#fff;box-shadow:0 10px 24px -10px rgba(208,2,27,.7)}.btn-red:hover{background:var(--red2);transform:translateY(-1px)}
.btn-ghost{background:transparent;color:#fff;border:2px solid rgba(255,255,255,.55)}.btn-ghost:hover{border-color:#fff;background:rgba(255,255,255,.08)}
.btn-navy{background:var(--navy);color:#fff}.btn-navy:hover{background:var(--navy2)}
.btn .ic{width:19px;height:19px}
/* top + header */
.topbar{background:var(--red);color:#fff;text-align:center;font:600 13px/1.3 Poppins,sans-serif;letter-spacing:.06em;padding:8px 12px;text-transform:uppercase}
.hdr{position:sticky;top:0;z-index:40;background:rgba(1,23,49,.96);backdrop-filter:saturate(1.4) blur(8px);border-bottom:1px solid rgba(255,255,255,.08)}
.hdr .wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:66px}
.hdr .logo img{height:50px;width:auto}
.hdr-cta{display:flex;align-items:center;gap:10px}
.hdr-phone{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;font:600 15px/1 Poppins,sans-serif}.hdr-phone .ic{width:18px;height:18px;color:var(--red)}
.hdr .btn{min-height:44px;padding:0 18px;font-size:13px;display:none}
/* hero */
.hero{position:relative;background:radial-gradient(1200px 500px at 85% -10%,rgba(208,2,27,.28),transparent 60%),linear-gradient(180deg,var(--navy) 0%,#03203f 100%);color:#fff;overflow:hidden}
.hero-grid{display:grid;gap:28px;padding:0 0 40px}
.hero-photo{position:relative;margin:0 -20px}
.hero-photo img{width:100%;height:auto;aspect-ratio:4/3;max-height:52vh;object-fit:cover;object-position:50% 22%}
.hero-photo:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(1,23,49,0) 45%,rgba(1,23,49,.92) 100%)}
.hero-tag{position:absolute;left:20px;bottom:18px;z-index:2;display:flex;align-items:center;gap:12px}
.hero-tag b{display:block;font:700 19px/1.1 Oswald,sans-serif;letter-spacing:.03em;text-transform:uppercase}.hero-tag span{font-size:13px;color:#d6dfeb}
.hero-copy{position:relative;z-index:2}.hero-copy .eyebrow{color:#ff9aa8;display:none}
.hero h1{font-size:clamp(40px,10.6vw,68px);text-transform:uppercase;margin:4px 0 14px}.hero h1 .ln{display:block;white-space:nowrap}
.hero h1 .kick{display:block;font:600 clamp(15px,3.6vw,19px)/1.35 Poppins,sans-serif;letter-spacing:.02em;text-transform:none;color:#ffd7dd;margin-bottom:10px}
.hero h1 .red{color:var(--red)}
.hero-sub{font-size:17.5px;color:#d6dfeb;max-width:560px;margin:0 0 22px}
.hero-btns{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 22px}
.hero-rating{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:14.5px;color:#e7edf5}.hero-rating strong{color:#fff}
/* form */
.form-card{background:#fff;color:var(--ink);border-radius:20px;box-shadow:0 30px 60px -25px rgba(0,0,0,.55);padding:24px 20px;scroll-margin-top:84px;border-top:6px solid var(--red)}
.form-card h2{font-size:28px;text-transform:uppercase;color:var(--navy)}
.form-card .msub{margin:6px 0 16px;color:var(--muted);font-size:14.5px}.form-card .msub a{color:var(--red);font-weight:600}
.free-pill{display:inline-block;background:#fff1f3;color:var(--red);font:700 12px/1 Poppins,sans-serif;letter-spacing:.12em;padding:7px 11px;border-radius:999px;margin-bottom:10px;text-transform:uppercase}
form.lead{display:grid;grid-template-columns:1fr 1fr;gap:12px 12px}
form.lead label{display:block;font:600 13px/1.3 Poppins,sans-serif;color:var(--ink)}form.lead label>input,form.lead label>select{margin-top:6px}
form.lead .wide{grid-column:1/-1}
form.lead input,form.lead select{width:100%;min-height:48px;border:1.5px solid #cfd8e3;border-radius:12px;padding:10px 13px;font:400 16px/1.2 Poppins,sans-serif;color:var(--ink);background:#fff;transition:border-color .15s,box-shadow .15s}
form.lead input:focus,form.lead select:focus{outline:0;border-color:var(--navy2);box-shadow:0 0 0 4px rgba(7,37,72,.12)}
form.lead [aria-invalid=true]{border-color:var(--red);box-shadow:0 0 0 4px rgba(208,2,27,.1)}
.required-mark{color:var(--red);margin-left:2px}.optional-mark{color:#7a889a;font-weight:400;margin-left:4px}
form.lead label.consent{display:flex;align-items:flex-start;gap:10px;font:400 11.5px/1.5 Poppins,sans-serif;color:#556377}
form.lead label.consent input{width:20px;min-height:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--red)}
form.lead label.consent a{color:var(--navy2)}
.fnote{margin:0;font-size:12px;color:#6a788b}
form.lead button[type=submit]{width:100%;min-height:58px;font-size:16px}
.fstatus{margin:0;font-size:14px;min-height:1px}.fstatus.busy{color:var(--navy2)}.fstatus.done{color:#0b7a3b;font-weight:600}.fstatus.err{color:var(--red);font-weight:600}
.form-trust{display:flex;flex-wrap:wrap;gap:8px 16px;margin:14px 0 0;padding:0;list-style:none;font-size:13px;color:#3d4c60}.form-trust li{display:flex;align-items:center;gap:6px}.form-trust .ic{color:#0b7a3b;width:16px;height:16px}
/* proof */
.proof{background:#fff;border-bottom:1px solid var(--line)}
.proof ul{display:grid;grid-template-columns:repeat(2,1fr);margin:0;padding:0;list-style:none}
.proof li{padding:22px 10px;text-align:center;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.proof li:nth-child(2n){border-right:0}
.proof b{display:block;font:700 clamp(30px,7vw,44px)/1 Oswald,sans-serif;color:var(--navy)}.proof b em{font-style:normal;color:var(--red)}
.proof span{display:block;margin-top:6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
/* problems */
.probs{display:grid;grid-template-columns:1fr;gap:12px;margin:0;padding:0;list-style:none}
.probs li{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;font-weight:600}
.probs .ic{width:22px;height:22px;color:#fff;background:var(--red);border-radius:50%;padding:4px}
.inc{margin-top:26px;background:var(--navy);color:#fff;border-radius:var(--r);padding:24px;display:grid;gap:16px}
.inc h3{font-size:24px;text-transform:uppercase}.inc ul{margin:0;padding:0;list-style:none;display:grid;gap:10px}.inc li{display:flex;gap:10px;align-items:flex-start}.inc .ic{color:var(--gold);width:20px;height:20px;margin-top:3px}
/* videos */
.vids{display:grid;gap:18px}
.vid{background:#0a1a2e;border-radius:var(--r);overflow:hidden;border:1px solid rgba(255,255,255,.08)}
.vid-media{position:relative;background:#000}
.vid-media video{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;background:#000}
.vid.vertical .vid-media video{aspect-ratio:9/16;max-height:640px;object-fit:contain;margin:0 auto}
.vid figcaption{padding:16px 18px 18px}.vid figcaption b{display:block;font:700 20px/1.2 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.02em}.vid figcaption span{color:#c9d4e3;font-size:14.5px}
.vid-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border:0;background:linear-gradient(180deg,rgba(1,23,49,0),rgba(1,23,49,.35));cursor:pointer;padding:0}
.vid-play span{width:76px;height:76px;border-radius:50%;background:var(--red);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 10px rgba(208,2,27,.25);transition:transform .15s}
.vid-play:hover span{transform:scale(1.07)}.vid-play .ic{width:34px;height:34px;color:#fff;margin-left:4px}
/* about */
.about{display:grid;gap:30px;align-items:start}
.about-photo{position:relative}.about-photo img{border-radius:20px;width:100%;height:auto;box-shadow:0 30px 60px -30px rgba(1,23,49,.6)}
.about-badge{position:absolute;right:14px;bottom:-18px;background:var(--red);color:#fff;border-radius:14px;padding:12px 16px;text-align:center;box-shadow:0 14px 30px -12px rgba(208,2,27,.7)}
.about-badge b{display:block;font:700 30px/1 Oswald,sans-serif}.about-badge span{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase}
.about-copy p{color:#334257;margin:0 0 14px}
.motto{margin:22px 0;padding:18px 22px;border-left:5px solid var(--red);background:var(--bg);border-radius:0 14px 14px 0;font:500 17px/1.5 Poppins,sans-serif;color:var(--navy)}
.creds{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px;padding:0;list-style:none}.creds li{background:#eef2f8;color:var(--navy);border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600}
.pack{margin-top:46px;border-radius:20px;overflow:hidden;position:relative}.pack img{width:100%;height:auto}
.pack figcaption{position:absolute;left:0;right:0;bottom:0;padding:40px 20px 16px;background:linear-gradient(180deg,transparent,rgba(1,23,49,.85));color:#fff;font:600 14px/1.4 Poppins,sans-serif}
/* programs */
.progs{display:grid;gap:16px}
.prog{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:22px;display:flex;flex-direction:column;gap:10px;transition:box-shadow .2s,transform .2s}
.prog:hover{box-shadow:0 20px 40px -24px rgba(1,23,49,.35);transform:translateY(-2px)}
.prog-ic{width:50px;height:50px;border-radius:14px;background:#fff1f3;color:var(--red);display:flex;align-items:center;justify-content:center}.prog-ic .ic{width:26px;height:26px}
.prog h3{font-size:24px;text-transform:uppercase;color:var(--navy)}.prog .tag{margin:0;font-weight:600;color:var(--red);font-size:14.5px;line-height:1.4}
.prog p{margin:0;color:#3d4c60;font-size:14.5px}.prog .goal{color:var(--navy);font-weight:500}
.prog a{margin-top:auto;padding-top:6px;display:inline-flex;align-items:center;gap:6px;color:var(--red);font:700 13.5px/1 Poppins,sans-serif;text-transform:uppercase;letter-spacing:.06em;text-decoration:none}.prog a .ic{width:16px;height:16px}
/* process */
.steps{display:grid;gap:14px;margin:0;padding:0;list-style:none;counter-reset:s}
.steps li{counter-increment:s;position:relative;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:var(--r);padding:22px 20px 20px 78px}
.steps li:before{content:counter(s,decimal-leading-zero);position:absolute;left:20px;top:20px;font:700 34px/1 Oswald,sans-serif;color:var(--red)}
.steps h3{font-size:21px;text-transform:uppercase;margin-bottom:6px}.steps p{margin:0;color:#c9d4e3;font-size:15px}
/* reviews */
.rev-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
.rev-score{display:flex;align-items:center;gap:14px}.rev-score b{font:700 44px/1 Oswald,sans-serif;color:var(--navy)}.rev-score span{display:block;color:var(--muted);font-size:14px}
.revs{display:grid;grid-auto-flow:column;grid-auto-columns:min(86%,460px);gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 2px 18px;margin:0;list-style:none;-webkit-overflow-scrolling:touch}
.revs li{scroll-snap-align:start;background:#1f1f1f;border-radius:14px;overflow:hidden;box-shadow:0 14px 30px -18px rgba(0,0,0,.6);align-self:start}
.revs img{width:100%;height:auto}
.rev-hint{font-size:13px;color:var(--muted);margin:4px 0 0}
/* center */
.center{display:grid;gap:22px;align-items:center}
.center img{border-radius:20px;width:100%;height:auto}
.addr{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:18px;margin:18px 0}
.addr .ic{width:26px;height:26px;color:var(--red);margin-top:2px}.addr b{display:block;color:var(--navy)}.addr a{color:var(--red);font-weight:600;font-size:14px}
.areas{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}.areas li{background:#eef2f8;border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600;color:var(--navy)}
/* faq */
.faqs{max-width:860px;margin:0 auto;display:grid;gap:12px}
.faqs details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:0 20px}
.faqs summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:14px;align-items:center;padding:18px 0;font:600 16.5px/1.4 Poppins,sans-serif;color:var(--navy)}
.faqs summary::-webkit-details-marker{display:none}.faqs summary:after{content:"+";font:400 28px/1 Poppins,sans-serif;color:var(--red);flex:none}
.faqs details[open] summary:after{content:"\\2013"}.faqs details p{margin:0 0 18px;color:#3d4c60}
/* final */
.final{position:relative;background:linear-gradient(120deg,var(--red) 0%,#8f0013 100%);color:#fff;text-align:center;overflow:hidden}
.final h2{font-size:clamp(34px,7vw,58px);text-transform:uppercase;margin:12px 0}.final p{max-width:640px;margin:0 auto 26px;color:#ffe3e7;font-size:17.5px}
.final .eyebrow{color:#fff}.final .eyebrow:after{content:"";width:28px;height:2px;background:currentColor}
.final .btn-red{background:#fff;color:var(--red)}.final .btn-red:hover{background:#ffe9ec}
.final-btns{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
footer{background:#000c1c;color:#9fb0c6;font-size:13.5px;padding:34px 0 110px}
footer .wrap{display:grid;gap:18px}footer img{height:52px;width:auto}footer a{color:#dbe4ef}footer p{margin:0}
.flinks{display:flex;flex-wrap:wrap;gap:8px 18px}
/* sticky phone bar */
.mbar{position:fixed;left:0;right:0;bottom:0;z-index:50;display:grid;grid-template-columns:1fr 1.35fr;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(1,23,49,.97);box-shadow:0 -10px 30px rgba(0,0,0,.25)}
.mbar a{min-height:52px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font:700 15px/1 Poppins,sans-serif;text-transform:uppercase;letter-spacing:.04em}
.mbar .call{background:#fff;color:var(--navy)}.mbar .book{background:var(--red);color:#fff}.mbar .ic{width:18px;height:18px}
.sandbox-pill{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:60;background:#ffcc00;color:#000;font:700 12px/1 Poppins,sans-serif;padding:8px 12px;border-radius:999px}
@media (min-width:560px){.probs{grid-template-columns:1fr 1fr}.proof ul{grid-template-columns:repeat(4,1fr)}.proof li{border-bottom:0}.proof li:nth-child(2n){border-right:1px solid var(--line)}.proof li:last-child{border-right:0}}
@media (min-width:760px){.vids{grid-template-columns:1fr 1fr}.progs{grid-template-columns:1fr 1fr}.steps{grid-template-columns:1fr 1fr}.inc{grid-template-columns:1fr 1.4fr;align-items:center}.inc ul{grid-template-columns:1fr 1fr}}
@media (min-width:980px){
  .sec{padding:96px 0}.wrap{padding:0 32px}
  .hdr .btn{display:inline-flex}
  .hero-grid{grid-template-columns:minmax(0,1.12fr) minmax(380px,.88fr);gap:48px;align-items:start;padding:56px 0 72px}
  .hero-photo{margin:26px 0 0;border-radius:20px;overflow:hidden;order:2}.hero-copy .eyebrow{display:inline-flex}
  .hero-photo img{aspect-ratio:1600/837;max-height:none;object-position:50% 35%}
  .hero-copy{display:flex;flex-direction:column}
  .form-card{grid-row:1/span 2;grid-column:2;position:sticky;top:86px;padding:30px 28px}
  .progs{grid-template-columns:repeat(3,1fr)}
  .steps{grid-template-columns:repeat(4,1fr)}.steps li{padding:76px 22px 24px}.steps li:before{top:22px}
  .about{grid-template-columns:1fr 1.1fr;gap:56px}
  .center{grid-template-columns:1.1fr 1fr;gap:48px}
  .vids{grid-template-columns:repeat(3,1fr);grid-auto-flow:row dense;align-items:start}.vid.feature{grid-column:1/span 2}.vid.vertical{grid-column:3;grid-row:1/span 2}
  .mbar{display:none}footer{padding-bottom:40px}
  footer .wrap{grid-template-columns:auto 1fr auto;align-items:center}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
</style>`;

function leadForm(page, o) {
  const opts = PROBLEMS.map(x => `<option>${E(x)}</option>`).join("");
  const note = o.practice ? `<p class="fnote wide"><strong>PRACTICE COPY: test only.</strong> This form goes to the practice copy, not to ${E(page.firstName)}'s office.</p>` : "";
  return `<div class="form-card" id="book" aria-labelledby="book-t">
<span class="free-pill">Free · No obligation</span>
<h2 id="book-t">Book your free in-home evaluation with ${E(page.firstName)}</h2>
<p class="msub">${E(page.market)} · No cost, no obligation. Prefer to talk? <a href="${TEL}">Call ${PHONE}</a></p>
<form class="lead contact-intake" data-kind="evaluation" data-endpoint="${E(o.endpoint)}" data-trainer="${E(page.slug)}" autocomplete="on" novalidate>
${note}<label>First name<input name="first_name" autocomplete="given-name" required></label>
<label>Last name<input name="last_name" autocomplete="family-name" required></label>
<label>Phone<input name="phone" type="tel" autocomplete="tel" required></label>
<label>Email<input name="email" type="email" autocomplete="email" required></label>
<label class="wide">Street address<input name="address" autocomplete="street-address" maxlength="300" required placeholder="Where ${E(page.firstName)} comes to see your dog"></label>
<label>City<input name="city" autocomplete="address-level2" maxlength="80" required placeholder="${E(page.city)}"></label>
<label>State<select name="state" autocomplete="address-level1" required><option value="">Choose a state</option>${stateOptions(page.state)}</select></label>
<label>ZIP code<input name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="10" required placeholder="${E(page.zipExample)}"></label>
<label>Dog's name<input name="dog_name" autocomplete="off"></label>
<label class="wide">What is going on with your dog?<select name="problem">${opts}</select></label>
<label class="consent wide"><input type="checkbox" name="sms_consent" value="yes"><span>${SMS_CONSENT}</span></label>
<p class="fnote wide">Phone is required so ${E(page.firstName)}'s office can call about your request. SMS consent is optional and separate from submitting this form.</p>
<button class="btn btn-red wide" type="submit">Request my free evaluation</button>
<p class="fstatus wide" role="status" aria-live="polite"></p>
</form>
<ul class="form-trust"><li>${icon("check")}No cost</li><li>${icon("check")}No obligation</li><li>${icon("check")}Pick your time next</li></ul>
</div>`;
}

function videoCard(v, i) {
  const cls = ["vid", i === 0 ? "feature" : "", v.vertical ? "vertical" : ""].filter(Boolean).join(" ");
  return `<figure class="${cls}"><div class="vid-media"><video controls preload="none" playsinline poster="${E(v.poster)}" width="${v.w}" height="${v.h}" aria-label="${E(v.title)}"><source src="${E(v.src)}" type="video/mp4"></video>`
    + `<button class="vid-play" type="button" aria-label="Play video: ${E(v.title)}"><span>${icon("play")}</span></button></div>`
    + `<figcaption><b>${E(v.title)}</b><span>${E(v.text)}</span></figcaption></figure>`;
}

// The small page script: video play buttons, and every "book" link focuses the form's first box.
const PAGE_SCRIPT = `<script>
(function(){
  document.querySelectorAll(".vid-play").forEach(function(b){
    b.addEventListener("click",function(){var v=b.parentNode.querySelector("video");b.hidden=true;if(v){v.play().catch(function(){});v.focus();}});
  });
  document.querySelectorAll("video").forEach(function(v){
    v.addEventListener("play",function(){document.querySelectorAll("video").forEach(function(o){if(o!==v)o.pause();});var b=v.parentNode.querySelector(".vid-play");if(b)b.hidden=true;});
  });
  document.addEventListener("click",function(e){
    var a=e.target.closest&&e.target.closest('a[href="#book"]');if(!a)return;
    var f=document.querySelector('#book input[name="first_name"]');if(f)setTimeout(function(){f.focus({preventScroll:true});},450);
  });
})();
</script>`;

function renderTrainer2Page(page, options = {}) {
  if (!page || !page.slug) throw new Error("A trainer 2.0 page needs its entry from lib/trainer2-pages.js.");
  const o = { practice: Boolean(options.practice), endpoint: options.endpoint != null ? String(options.endpoint) : PAGES.leadEndpoint(page.slug) };
  const url = PAGES.canonicalUrl(page.slug);
  const P = page.photos;
  const ogImage = PAGES.SITE_ORIGIN + P.hero.src;
  const tracking = o.practice ? "<!-- practice copy: no Meta pixel or Google tag, so test leads never reach the ad accounts -->" : `${googleAdsHead()}\n${metaPixelHead()}`;
  const tc = page.trainingCenter;
  const tcLine = `${tc.street}, ${tc.city}, ${tc.state} ${tc.zip}`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tcLine)}`;

  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${E(page.seo.title)}</title>
<meta name="description" content="${E(page.seo.description)}">
<meta name="robots" content="${o.practice ? "noindex,nofollow" : "index,follow,max-image-preview:large"}">
<link rel="canonical" href="${E(url)}">
<meta name="theme-color" content="#011731">
<meta property="og:type" content="website"><meta property="og:site_name" content="${E(BRAND)}">
<meta property="og:title" content="${E(page.seo.title)}"><meta property="og:description" content="${E(page.seo.description)}">
<meta property="og:url" content="${E(url)}"><meta property="og:image" content="${E(ogImage)}"><meta property="og:image:width" content="${P.hero.w}"><meta property="og:image:height" content="${P.hero.h}"><meta property="og:image:alt" content="${E(P.hero.alt)}"><meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${E(page.seo.title)}"><meta name="twitter:description" content="${E(page.seo.description)}"><meta name="twitter:image" content="${E(ogImage)}">
<link rel="icon" href="/assets/ldtt-favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Poppins:wght@400;500;600;700&display=swap">
<link rel="preload" as="image" href="${E(P.hero.mobile)}" media="(max-width:979px)">
<link rel="preload" as="image" href="${E(P.hero.src)}" media="(min-width:980px)">
${STYLE}
${jsonLd(page)}
${tracking}
</head>`;

  const proof = page.proof.map(p => `<li><b>${E(p.value).replace(/\+$/, "<em>+</em>")}</b><span>${E(p.label)}</span></li>`).join("");
  const problems = PROBLEMS.filter(p => !/^(Something else|Service dog|Board & train)$/.test(p)).map(p => `<li>${icon("check")}${E(p)}</li>`).join("");
  const includes = page.includes.map(t => `<li>${icon("check")}<span>${E(t)}</span></li>`).join("");
  const programs = PROGRAMS.map(p => `<article class="prog"><span class="prog-ic">${icon(p.icon)}</span><h3>${E(p.title)}</h3><p class="tag">${E(p.tagline)}</p>`
    + `<p><strong>Problems we solve:</strong> ${E(p.solves)}</p><p class="goal">${E(p.goal)}</p><a href="#book">Book a free evaluation ${icon("arrow")}</a></article>`).join("");
  const steps = PROCESS.map(s => `<li><h3>${E(s.title)}</h3><p>${E(s.text)}</p></li>`).join("");
  const reviews = page.reviews.map(r => `<li><img src="${E(r.img)}" width="${r.w}" height="${r.h}" loading="lazy" decoding="async" alt="Five-star Google review from ${E(r.name)}"></li>`).join("");
  const faqs = page.faqs.map((f, i) => `<details${i === 0 ? " open" : ""}><summary>${E(f.q)}</summary><p>${E(f.a)}</p></details>`).join("");
  const bio = page.bio.map(p => `<p>${E(p)}</p>`).join("");
  const creds = page.credentials.map(c => `<li>${E(c)}</li>`).join("");
  const areas = page.areas.map(a => `<li>${E(a)}</li>`).join("");

  const body = `<body data-trainer2="${E(page.slug)}">
<a class="skip" href="#book">Skip to the evaluation form</a>
${o.practice ? '<div class="sandbox-pill" role="note">PRACTICE COPY · trainer 2.0 page · test only</div>\n' : ""}<div class="topbar">Free in-home evaluations · ${E(page.market)}</div>
<header class="hdr"><div class="wrap">
<a class="logo" href="#top" aria-label="${E(BRAND)}"><img src="${LOGO}" alt="${E(BRAND)}" width="300" height="150"></a>
<div class="hdr-cta"><a class="hdr-phone" href="${TEL}">${icon("phone")}<span>${PHONE}</span></a><a class="btn btn-red" href="#book">Free Evaluation</a></div>
</div></header>
<main id="top">
<section class="hero" aria-labelledby="hero-t"><div class="wrap"><div class="hero-grid">
<div class="hero-photo"><picture><source media="(min-width:980px)" srcset="${E(P.hero.small)} 800w, ${E(P.hero.src)} ${P.hero.w}w" sizes="(min-width:1180px) 640px, 55vw"><img src="${E(P.hero.mobile)}" width="${P.hero.mw}" height="${P.hero.mh}" alt="${E(P.hero.alt)}" fetchpriority="high"></picture>
<div class="hero-tag"><div><b>${E(page.name)}</b><span>${E(page.role)}</span></div></div></div>
<div class="hero-copy">
<p class="eyebrow">${E(page.hero.eyebrow)}</p>
<h1 id="hero-t"><span class="kick">${E(page.hero.kicker)}</span><span class="ln">${E(page.hero.title[0])}</span><span class="ln red">${E(page.hero.title[1])}</span></h1>
<p class="hero-sub">${E(page.hero.sub)}</p>
<div class="hero-btns"><a class="btn btn-red" href="#book">${E(page.hero.cta)} ${icon("arrow")}</a><a class="btn btn-ghost" href="${TEL}">${icon("phone")} Call ${PHONE}</a></div>
<div class="hero-rating">${stars()}<span><strong>600+ Google reviews</strong> · 40+ years · ${E(page.market)}</span></div>
</div>
${leadForm(page, o)}
</div></div></section>

<section class="proof" aria-label="Lorenzo's Dog Training Team by the numbers"><div class="wrap"><ul>${proof}</ul></div></section>

<section class="sec sec-alt" aria-labelledby="probs-t"><div class="wrap">
<div class="sec-head"><p class="eyebrow">Sound familiar?</p><h2 id="probs-t">Your dog. Your home. Real problems.</h2><p>${E(page.firstName)} works with dogs of any age, size, breed and temperament. Start with the problem you live with every day.</p></div>
<ul class="probs">${problems}</ul>
<div class="inc"><h3>Your free evaluation includes</h3><ul>${includes}</ul></div>
<p style="margin:26px 0 0"><a class="btn btn-red" href="#book">${E(page.hero.cta)} ${icon("arrow")}</a></p>
</div></section>

<section class="sec sec-dark" aria-labelledby="vid-t"><div class="wrap">
<div class="sec-head"><p class="eyebrow">Real families. Real results.</p><h2 id="vid-t">See the training for yourself</h2><p>Real clients and the real Cleveland headquarters of ${E(BRAND)}.</p></div>
<div class="vids">${page.videos.map(videoCard).join("")}</div>
</div></section>

<section class="sec" id="about" aria-labelledby="about-t"><div class="wrap">
<div class="about">
<div class="about-photo">${img(P.portrait, { sizes: "(min-width:980px) 520px, 100vw" })}<div class="about-badge"><b>40+</b><span>Years training dogs</span></div></div>
<div class="about-copy"><p class="eyebrow">Meet your trainer</p><h2 id="about-t" style="font-size:clamp(32px,5.6vw,48px);text-transform:uppercase;color:var(--navy);margin:12px 0 18px">${E(page.name)}</h2>
<ul class="creds">${creds}</ul>
${bio}
<blockquote class="motto">${E(page.motto)}</blockquote>
<a class="btn btn-red" href="#book">Train with ${E(page.firstName)} ${icon("arrow")}</a></div>
</div>
<figure class="pack">${img(P.pack, { sizes: "(min-width:1180px) 1116px, 100vw" })}<figcaption>${E(page.firstName)} and a field of trained dogs holding a down-stay.</figcaption></figure>
</div></section>

<section class="sec sec-alt" aria-labelledby="prog-t"><div class="wrap">
<div class="sec-head c"><p class="eyebrow">Training programs</p><h2 id="prog-t">Training built for real life</h2><p>Every program starts with the free evaluation, so you get the right path for your dog, not a one-size plan.</p></div>
<div class="progs">${programs}</div>
</div></section>

<section class="sec sec-dark" aria-labelledby="proc-t"><div class="wrap">
<div class="sec-head"><p class="eyebrow">How it works</p><h2 id="proc-t">The technique behind the training</h2><p>Technique, timing, communication, leadership, rules and boundaries. The goal is not a quick trick: it is a dog that understands what is expected and an owner who knows how to lead with consistency.</p></div>
<ol class="steps">${steps}</ol>
<p style="margin:30px 0 0"><a class="btn btn-red" href="#book">Start with step one ${icon("arrow")}</a></p>
</div></section>

<section class="sec" aria-labelledby="rev-t"><div class="wrap">
<div class="rev-top"><div class="sec-head" style="margin:0"><p class="eyebrow">Google reviews</p><h2 id="rev-t">What clients say</h2></div>
<div class="rev-score">${stars()}<div><b>600+</b><span>Google reviews for ${E(BRAND)}</span></div></div></div>
<ul class="revs" tabindex="0" aria-label="Google review screenshots, scroll sideways">${reviews}</ul>
<p class="rev-hint">Swipe for more. <a href="${E(page.googleReviewsUrl)}" target="_blank" rel="noopener">Read the reviews on Google</a></p>
</div></section>

<section class="sec sec-alt" aria-labelledby="center-t"><div class="wrap"><div class="center">
<div>${img(P.center, { sizes: "(min-width:980px) 600px, 100vw" })}</div>
<div><p class="eyebrow">Where it all started</p><h2 id="center-t" style="font-size:clamp(30px,5.4vw,44px);text-transform:uppercase;color:var(--navy);margin:12px 0 12px">Cleveland is home</h2>
<p style="margin:0;color:#334257">Cleveland is where Lorenzo's began. Evaluations happen in your home, where the problems really happen, or at the Cleveland training center, next door to the 17,000 sq ft headquarters where Lorenzo's trainers come to learn and earn their certification.</p>
<div class="addr">${icon("pin")}<div><b>Cleveland training center</b>${E(tcLine)}<br><a href="${E(mapUrl)}" target="_blank" rel="noopener">Get directions</a></div></div>
<ul class="areas" aria-label="Areas served">${areas}</ul></div>
</div></div></section>

<section class="sec" aria-labelledby="faq-t"><div class="wrap">
<div class="sec-head c"><p class="eyebrow">Questions</p><h2 id="faq-t">Frequently asked questions</h2></div>
<div class="faqs">${faqs}</div>
</div></section>

<section class="sec final" aria-labelledby="final-t"><div class="wrap">
<p class="eyebrow">${E(TAGLINE)}</p><h2 id="final-t">Ready for a dog who listens?</h2>
<p>Book your FREE in-home evaluation with ${E(page.firstName)} today. No cost, no obligation, and you pick the time on the next screen.</p>
<div class="final-btns"><a class="btn btn-red" href="#book">${E(page.hero.cta)} ${icon("arrow")}</a><a class="btn btn-ghost" href="${TEL}">${icon("phone")} Call ${PHONE}</a></div>
</div></section>
</main>
<footer><div class="wrap">
<a href="#top" aria-label="Back to the top"><img src="${LOGO}" alt="${E(BRAND)}" width="300" height="150" loading="lazy"></a>
<div><p>© ${E(BRAND)}. ${E(TAGLINE)}</p><p>${E(page.name)} · ${E(tcLine)} · <a href="${TEL}">${PHONE}</a></p></div>
<div class="flinks"><a href="https://lorenzosdogtrainingteam.com/terms.html" target="_blank" rel="noopener">Terms</a><a href="https://lorenzosdogtrainingteam.com/privacy-policy.html" target="_blank" rel="noopener">Privacy</a></div>
</div></footer>
<nav class="mbar" aria-label="Quick contact"><a class="call" href="${TEL}">${icon("phone")} Call</a><a class="book" href="#book">Free Evaluation</a></nav>
${PAGE_SCRIPT}
<script src="/assets/v2/v2.js?v=${VERSION}" defer></script>
</body></html>`;
  return head + "\n" + body;
}

module.exports = { VERSION, PROGRAMS, PROCESS, PROBLEMS, SMS_CONSENT, renderTrainer2Page };
