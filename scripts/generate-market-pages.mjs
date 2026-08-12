import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const markets = [
  {
    slug: "dog-training-cleveland-oh",
    arch: "hq", mk1: "#152569", mk2: "#C8102E",
    photo: "assets/facility-exterior-main.jpg",
    photoName: "Our 17,000 sq ft Cleveland headquarters",
    photoCaption: "Harley McGrew & Brady DeRemer — your Northeast Ohio trainers",
    tint: "21,37,105",
    tint2: "200,16,46",
    hook: "See where it started: a free evaluation backed by our 17,000 sq ft Cleveland headquarters — the facility where every Lorenzo's trainer is certified.",
    title: "Cleveland & Akron Dog Training",
    h1: "Dog training in Cleveland and Akron for real-world results.",
    market: "Cleveland / Akron, OH",
    city: "Cleveland",
    state: "OH",
    area: "Cleveland, Akron, Garfield Heights, Cleveland Heights, Streetsboro, and Northeast Ohio",
    trainers: "Harley McGrew and Brady DeRemer",
    proof: "Local Northeast Ohio support backed by Lorenzo's office-routed training system.",
    nearby: ["Cleveland Heights", "Garfield Heights", "Akron", "Streetsboro", "Northeast Ohio"],
    zipCodes: ["44118", "44241"]
  },
  {
    slug: "dog-training-columbus-oh",
    arch: "portrait", mk1: "#7A1E2C", mk2: "#EFE7DA",
    photo: "assets/trainer-bio-photos/shannon-paskins.jpg",
    photoName: "Shannon Paskins",
    photoCaption: "Your Columbus dog trainer",
    tint: "21,37,105",
    tint2: "120,20,60",
    hook: "Dogs fighting in the same house? Multi-dog conflict is exactly what we fix — ask about a same-week assessment.",
    title: "Columbus Dog Training",
    h1: "Dog training in Columbus, Reynoldsburg, and Central Ohio.",
    market: "Columbus / Reynoldsburg, OH",
    city: "Columbus",
    state: "OH",
    area: "Columbus, Reynoldsburg, and Central Ohio communities",
    trainers: "Shannon Paskins",
    proof: "Central Ohio dog owners can request obedience and behavior modification help through Lorenzo's office.",
    nearby: ["Columbus", "Reynoldsburg", "Central Ohio", "Franklin County", "Licking County"],
    zipCodes: ["43068"]
  },
  {
    slug: "dog-training-atlanta-ga",
    arch: "specialty", mk1: "#14101F", mk2: "#C9A227",
    photo: "assets/trainer-bio-photos/aryson-whorley.jpg",
    photoName: "Aryson Whorley",
    photoCaption: "One of three Atlanta trainers — specialty & service dog focus",
    tint: "30,25,90",
    tint2: "190,60,30",
    hook: "Specialty & service dog training few in Atlanta offer — ask about a free suitability assessment for your dog.",
    title: "Atlanta Dog Training",
    h1: "Dog training in Atlanta and surrounding Georgia communities.",
    market: "Atlanta, GA",
    city: "Atlanta",
    state: "GA",
    area: "Atlanta, Loganville, Dallas, and surrounding Georgia communities",
    trainers: "Aryson Whorley, Christopher Almonte, and Chloe Chisolm",
    proof: "Georgia dog owners can start with one office-routed request and be matched to the right next step.",
    nearby: ["Atlanta", "Loganville", "Dallas", "North Georgia", "Metro Atlanta"],
    zipCodes: ["30052", "30324", "30157"]
  },
  {
    slug: "dog-training-san-diego-ca",
    arch: "coast", mk1: "#0E5E8A", mk2: "#EAF4F9",
    photo: "assets/trainer-bio-photos/genevieve-twilla.jpg",
    photoName: "Genevieve Twilla",
    photoCaption: "One of three San Diego trainers",
    tint: "15,60,110",
    tint2: "200,16,46",
    hook: "Transparent pricing: professional dog training from $1,250 — no mystery quotes.",
    title: "San Diego Dog Training",
    h1: "San Diego dog training backed by Lorenzo's proven system.",
    market: "San Diego, CA",
    city: "San Diego",
    state: "CA",
    area: "San Diego, North Park, nearby beach communities, and surrounding San Diego County",
    trainers: "Genevieve Twilla, Karemela Sefferin, and Fred Harris",
    proof: "San Diego families can request obedience, behavior modification, service, and specialty training support.",
    nearby: ["San Diego", "North Park", "Chula Vista", "Mission Valley", "San Diego County"],
    zipCodes: ["92105", "92106"]
  },
  {
    slug: "dog-training-san-antonio-tx",
    arch: "mission", mk1: "#7E1F1F", mk2: "#D9A441",
    photo: "assets/trainer-bio-photos/carolina-perez.jpg",
    photoName: "Carolina Perez",
    photoCaption: "Your San Antonio trainer — hablamos español",
    tint: "90,30,30",
    tint2: "200,120,30",
    hook: "Military family? Your training follows you — Lorenzo's has certified trainers in cities nationwide, so a PCS move never means starting over.",
    title: "San Antonio Dog Training",
    h1: "Dog training in San Antonio and surrounding Texas communities.",
    market: "San Antonio, TX",
    city: "San Antonio",
    state: "TX",
    area: "San Antonio, Castroville, Bear Creek, and surrounding Texas communities",
    trainers: "Giovanni Gutierrez and Carolina Perez",
    spanish: true,
    proof: "Texas dog owners can request a fast follow-up for obedience, behavior modification, and advanced training needs.",
    nearby: ["San Antonio", "Castroville", "Bear Creek", "Bexar County", "Medina County"],
    zipCodes: ["78245", "78009"]
  },
  {
    slug: "dog-training-chicago-il",
    arch: "metro", mk1: "#0B1B3F", mk2: "#D64545",
    photo: "assets/trainer-bio-photos/jasmine-bland.jpg",
    photoName: "Jasmine Bland",
    photoCaption: "Your Chicago dog trainer — no waitlist",
    tint: "10,30,80",
    tint2: "200,16,46",
    hook: "No waitlist. Evaluations available this week across Chicagoland.",
    title: "Chicago Dog Training",
    h1: "Dog training for the Chicago market and Northwest Indiana.",
    market: "Chicago, IL",
    city: "Chicago",
    state: "IL",
    area: "Chicago, Northwest Indiana, Gary, and surrounding communities",
    trainers: "Jasmine Bland",
    proof: "A Chicago-market page lets the office route leads from stronger ad territory while preserving trainer attribution.",
    nearby: ["Chicago", "Northwest Indiana", "Gary", "South Suburbs", "Chicagoland"],
    zipCodes: ["46409"]
  },
  {
    slug: "dog-training-tallahassee-fl",
    arch: "portrait2", mk1: "#A63D2F", mk2: "#1E4D45",
    photo: "assets/trainer-bio-photos/victoria-bayleigh-morris.jpg",
    photoName: "Victoria Bayleigh Morris",
    photoCaption: "Your Tallahassee dog trainer",
    tint: "110,45,20",
    tint2: "21,37,105",
    hook: "He knows the commands — he just won't listen. Reactivity and reliability are what we fix.",
    title: "Tallahassee Dog Training",
    h1: "Dog training in Tallahassee and North Florida.",
    market: "Tallahassee, FL",
    city: "Tallahassee",
    state: "FL",
    area: "Tallahassee, Leon County, North Florida, and surrounding communities",
    trainers: "Victoria Bayleigh Morris",
    proof: "Tallahassee is Victoria's active ad market for dog owners who need a clearer next step now.",
    nearby: ["Tallahassee", "Leon County", "North Florida", "Capital Region", "Thomasville Area"],
    zipCodes: ["32504"]
  },
  {
    slug: "dog-training-miramar-beach-fl",
    arch: "resort", mk1: "#0F8A9D", mk2: "#F2E9D8",
    photo: "assets/trainer-bio-photos/trainers.jpg",
    photoName: "The Lorenzo's team",
    photoCaption: "Tabatha Shelley — your Emerald Coast trainer",
    tint: "10,90,120",
    tint2: "21,37,105",
    hook: "Vacation-ready: beach recall, restaurant manners, and a dog your rental will welcome back.",
    title: "Miramar Beach Dog Training",
    h1: "Dog training in Miramar Beach and the Emerald Coast.",
    market: "Miramar Beach, FL",
    city: "Miramar Beach",
    state: "FL",
    area: "Miramar Beach, Destin, Santa Rosa Beach, 30A, Walton County, and nearby Emerald Coast communities",
    trainers: "Tabatha Shelley",
    proof: "Emerald Coast families can request obedience, behavior modification, puppy training, and specialty support through Lorenzo's office.",
    nearby: ["Miramar Beach", "Destin", "Santa Rosa Beach", "30A", "Walton County"],
    zipCodes: ["32405"]
  },
  {
    slug: "dog-training-lexington-ky",
    arch: "heritage", mk1: "#234D32", mk2: "#B08A57",
    photo: "assets/trainer-bio-photos/bailey-brown.jpg",
    photoName: "Bailey Brown",
    photoCaption: "Your Lexington trainer — raised with horses",
    tint: "25,70,45",
    tint2: "21,37,105",
    hook: "Farm & property dogs: recall that holds on open acreage, and manners around horses and livestock.",
    title: "Lexington Dog Training",
    h1: "Dog training for Lexington, Harrodsburg, and Central Kentucky.",
    market: "Lexington / Harrodsburg, KY",
    city: "Lexington",
    state: "KY",
    area: "Lexington, Harrodsburg, Mercer County, and Central Kentucky communities",
    trainers: "Bailey Brown",
    proof: "Kentucky dog owners can start with a simple request and let Lorenzo's office guide the follow-up.",
    nearby: ["Lexington", "Harrodsburg", "Mercer County", "Central Kentucky", "Bluegrass Region"],
    zipCodes: ["40330"]
  },
  {
    slug: "dog-training-ann-arbor-mi",
    arch: "campus", mk1: "#1E3A8A", mk2: "#F0C93B",
    photo: "assets/trainer-bio-photos/dylan-atkinson.jpg",
    photoName: "Dylan Atkinson",
    photoCaption: "Your Ann Arbor dog trainer",
    tint: "40,40,100",
    tint2: "200,16,46",
    hook: "Apartment-friendly puppy training — built for small spaces, shared walls, and busy schedules.",
    title: "Ann Arbor Dog Training",
    h1: "Dog training in Ann Arbor and Southeast Michigan.",
    market: "Ann Arbor, MI",
    city: "Ann Arbor",
    state: "MI",
    area: "Ann Arbor, Ypsilanti, Washtenaw County, and surrounding Southeast Michigan communities",
    trainers: "Dylan Atkinson",
    proof: "Michigan dog owners can request obedience, behavior modification, and real-world training help through Lorenzo's office-routed system.",
    nearby: ["Ann Arbor", "Ypsilanti", "Washtenaw County", "Southeast Michigan", "Canton"],
    zipCodes: ["48103", "48104", "48105", "48108", "48109"]
  }
];

const cacheVersion = "20260812marketoffers1";
const googleEndpoint = "https://docs.google.com/forms/d/e/1FAIpQLSdV1-0yBlRusq9tkjymZKm_BfXfpmMKDDrcyqfP3KbEq-Qd_g/formResponse";
const googleAdsId = "AW-11463464040";
const consultationConversion = "AW-11463464040/kLPdCPzSo4oaEOiomtoq";
const pdfConversion = "AW-11463464040/EkfvCK6B8o8ZEOiomtoq";
const attributionFields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "landing_url"];

const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

const attributionInputs = () => attributionFields
  .map(name => `<input type="hidden" name="${name}" value="">`)
  .join("\n              ");

const googleAdsHead = () => `<script async src="https://www.googletagmanager.com/gtag/js?id=${googleAdsId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${googleAdsId}');
  </script>`;

const conversionAndAttributionScript = () => `<script>
    (function(){
      const conversions = {
        consultation: '${consultationConversion}',
        pdf: '${pdfConversion}'
      };
      const sendConversion = function(sendTo, value){
        if (typeof window.gtag !== 'function') return;
        window.gtag('event', 'conversion', {
          send_to: sendTo,
          value: value,
          currency: 'USD'
        });
      };
      document.addEventListener('submit', function(event){
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form.classList.contains('contact-intake')) sendConversion(conversions.consultation, 250);
        if (form.classList.contains('pdf-optin')) sendConversion(conversions.pdf, 25);
      }, true);
      document.addEventListener('DOMContentLoaded', function(){
        const params = new URLSearchParams(window.location.search);
        const values = {
          utm_source: params.get('utm_source') || '',
          utm_medium: params.get('utm_medium') || '',
          utm_campaign: params.get('utm_campaign') || '',
          utm_content: params.get('utm_content') || '',
          utm_term: params.get('utm_term') || '',
          gclid: params.get('gclid') || '',
          landing_url: window.location.href
        };
        Object.entries(values).forEach(function(entry){
          document.querySelectorAll('input[name="' + entry[0] + '"]').forEach(function(input){
            input.value = entry[1];
          });
        });
      });
    })();
  </script>`;

const page = market => {
  const metaDescription = `Request ${market.market} dog training from Lorenzo's Dog Training Team. Obedience training, puppy training, dog behavior modification, and advanced programs with office-routed follow-up.`;
  const nearby = market.nearby.map(place => `<span>${escapeHtml(place)}</span>`).join("");
  const zipCodes = market.zipCodes.map(zip => `<span>${escapeHtml(zip)}</span>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(market.title)} | Lorenzo's Dog Training Team</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="https://www.lorenzosdogtrainingteam.com/${escapeHtml(market.slug)}">
  <link rel="icon" type="image/png" href="assets/ldtt-favicon.png">
  <link rel="apple-touch-icon" href="assets/ldtt-favicon.png">
  <link rel="stylesheet" href="styles.css?v=${cacheVersion}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(market.title)} | Lorenzo's Dog Training Team">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="https://www.lorenzosdogtrainingteam.com/${escapeHtml(market.slug)}">
  <meta property="og:image" content="https://www.lorenzosdogtrainingteam.com/assets/get-started-premium-hero.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `Lorenzo's Dog Training Team — ${market.market}`,
    url: `https://www.lorenzosdogtrainingteam.com/${market.slug}`,
    telephone: "+1-866-436-4959",
    priceRange: "$1,250+",
    address: { "@type": "PostalAddress", addressLocality: market.city, addressRegion: market.state, addressCountry: "US" },
    areaServed: market.nearby,
    description: metaDescription
  })}</script>
  ${googleAdsHead()}
  <style>
    .market-copy .ad-lead.market-hook{border-left:4px solid #c8102e;background:rgba(200,16,46,.07);padding:10px 14px;border-radius:0 10px 10px 0;font-size:1.02em}
    .market-spanish{border-left:4px solid #152569;background:rgba(21,37,105,.06);padding:10px 14px;border-radius:0 10px 10px 0}
    .market-pricing h2{margin-top:6px}
    .market-pricing .market-service-grid article{border-top:4px solid #c8102e}
    .market-pricing .market-service-grid article span{color:#c8102e;font-weight:800}
    .market-tint{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply}
    .market-trainer-media img{width:100%;height:100%;min-height:280px;object-fit:cover;object-position:top center;display:block}
    .market-trainer-media figcaption strong{display:block}

    /* ═══ per-market design archetypes ═══ */
    /* HQ — Cleveland: navy ground, the facility as a full-width banner */
    .arch-hq .market-hero{background:var(--mk1)}
    .arch-hq .market-hero-bg{opacity:.14}
    .arch-hq .market-copy h1,.arch-hq .market-copy .ad-lead{color:#fff}
    .arch-hq .market-copy .ad-lead.market-hook{background:rgba(255,255,255,.1);color:#fff;border-left-color:var(--mk2)}
    .arch-hq .market-hero-media{grid-column:1/-1;order:-1;max-height:320px;overflow:hidden;border:8px solid #fff;box-shadow:0 18px 40px rgba(0,0,0,.35)}
    .arch-hq .ad-checks-v2 li{color:#dfe4f5}

    /* PORTRAIT — Columbus: warm parchment, wine accents, framed trainer */
    .arch-portrait .market-hero{background:linear-gradient(180deg,#FBF8F2,var(--mk2))}
    .arch-portrait .market-copy h1{color:var(--mk1);text-transform:none;letter-spacing:0}
    .arch-portrait .market-hero-media{border:1px solid var(--mk1);border-radius:16px;overflow:hidden;box-shadow:12px 12px 0 var(--mk1)}
    .arch-portrait .market-hook{border-left-color:var(--mk1);background:#fff}
    .arch-portrait .ad-proof-band-v2{background:var(--mk1)}

    /* METRO — Chicago: midnight panel, giant type, tilted polaroid */
    .arch-metro .market-hero{background:linear-gradient(120deg,var(--mk1) 0%,#122a55 70%)}
    .arch-metro .market-hero-bg{opacity:.1}
    .arch-metro .market-copy h1{color:#fff;font-size:clamp(34px,5vw,54px);letter-spacing:-.03em}
    .arch-metro .market-copy .ad-lead{color:#c9d4ef}
    .arch-metro .market-copy .ad-lead.market-hook{background:var(--mk2);color:#fff;border-left-color:#fff}
    .arch-metro .market-hero-media{transform:rotate(-2deg);border:10px solid #fff;box-shadow:0 22px 45px rgba(0,0,0,.45)}
    .arch-metro .ad-checks-v2 li{color:#dfe6f8}

    /* SPECIALTY — Atlanta: near-black, gold detailing, premium quiet */
    .arch-specialty .market-hero{background:var(--mk1)}
    .arch-specialty .market-hero-bg{opacity:.08}
    .arch-specialty .market-copy h1{color:#fff;letter-spacing:.02em}
    .arch-specialty .market-copy .ad-lead{color:#cfc9de}
    .arch-specialty .market-copy .ad-lead.market-hook{background:transparent;border:1px solid var(--mk2);border-left:4px solid var(--mk2);color:var(--mk2)}
    .arch-specialty .ad-rating-row span{color:var(--mk2)}
    .arch-specialty .market-hero-media{border:1px solid var(--mk2);padding:8px;background:var(--mk1)}
    .arch-specialty .ad-checks-v2 li{color:#d8d3e6}

    /* COAST — San Diego: white air, ocean blue, soft pill geometry */
    .arch-coast .market-hero{background:linear-gradient(180deg,#fff,var(--mk2))}
    .arch-coast .market-copy h1{color:var(--mk1);text-transform:none}
    .arch-coast .market-hero-media{border-radius:28px;overflow:hidden;border:4px solid #fff;box-shadow:0 16px 36px rgba(14,94,138,.25)}
    .arch-coast .market-hook{border-radius:999px;border-left:none;border:2px solid var(--mk1);background:#fff;padding:12px 20px}
    .arch-coast .ad-benefit-row span{border-radius:999px;background:var(--mk1);color:#fff;padding:4px 12px}

    /* MISSION — San Antonio: deep red + gold, bilingual up front */
    .arch-mission .market-hero{background:linear-gradient(135deg,var(--mk1),#4d1414)}
    .arch-mission .market-hero-bg{opacity:.12}
    .arch-mission .market-copy h1,.arch-mission .market-copy .ad-lead{color:#fff}
    .arch-mission .market-copy .ad-lead.market-hook{background:rgba(217,164,65,.15);border-left-color:var(--mk2);color:#ffe9c4}
    .arch-mission .market-spanish{background:var(--mk2);border-left-color:#fff;color:var(--mk1);font-weight:700}
    .arch-mission .market-hero-media{border:6px double var(--mk2)}
    .arch-mission .ad-checks-v2 li{color:#f4dfd0}

    /* HERITAGE — Lexington: hunter green + saddle tan, farm-plate frame */
    .arch-heritage .market-hero{background:linear-gradient(180deg,#F7F4EC,#EDE6D6)}
    .arch-heritage .market-copy h1{color:var(--mk1);text-transform:none;letter-spacing:0}
    .arch-heritage .market-hook{border-left-color:var(--mk1);background:#fff}
    .arch-heritage .market-hero-media{border:4px solid var(--mk1);outline:2px solid var(--mk2);outline-offset:5px}
    .arch-heritage .ad-proof-band-v2{background:var(--mk1)}
    .arch-heritage .visit,.arch-heritage .btn-red{background:var(--mk1)}

    /* PORTRAIT² — Tallahassee: coral + palm, mirrored composition */
    .arch-portrait2 .market-hero{background:linear-gradient(180deg,#FDF6F1,#F6E7DF)}
    .arch-portrait2 .market-copy{order:2}
    .arch-portrait2 .market-hero-media{order:1;border-radius:0 60px 0 60px;overflow:hidden;border:3px solid var(--mk2)}
    .arch-portrait2 .market-copy h1{color:var(--mk2);text-transform:none}
    .arch-portrait2 .market-hook{border-left-color:var(--mk1);background:#fff}

    /* RESORT — Miramar: aqua band over sand, holiday postcard */
    .arch-resort .market-hero{background:linear-gradient(180deg,var(--mk1) 0 46%,var(--mk2) 46%)}
    .arch-resort .market-hero-bg{opacity:.1}
    .arch-resort .market-copy h1{color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.25)}
    .arch-resort .market-copy .ad-lead{color:#eafcff}
    .arch-resort .market-copy .ad-lead.market-hook{background:#fff;color:var(--mk1);border-left-color:var(--mk1)}
    .arch-resort .market-hero-media{border:8px solid #fff;border-bottom-width:30px;box-shadow:0 16px 34px rgba(0,0,0,.28);transform:rotate(1.5deg)}

    /* CAMPUS — Ann Arbor: clean white, blue + maize underline energy */
    .arch-campus .market-hero{background:#fff}
    .arch-campus .market-copy h1{color:var(--mk1);text-transform:none}
    .arch-campus .market-copy h1::after{content:"";display:block;width:110px;height:8px;background:var(--mk2);margin-top:10px}
    .arch-campus .market-hook{border-left-color:var(--mk1);background:#F6F8FE}
    .arch-campus .market-hero-media{border-radius:12px;overflow:hidden;border:3px solid var(--mk1)}
    .arch-campus .ad-proof-band-v2{background:var(--mk1)}

    /* market-landing.js repaints the hero dark at runtime — headings must stay
       readable on that ground, so light archetypes keep white type and express
       their identity through hooks, frames, buttons and bands instead. */
    .arch-portrait .market-copy h1,.arch-heritage .market-copy h1,.arch-coast .market-copy h1,
    .arch-campus .market-copy h1,.arch-portrait2 .market-copy h1{color:#fff}
    .arch-campus .market-copy h1::after{background:var(--mk2)}
    .arch-portrait .market-copy .ad-lead,.arch-heritage .market-copy .ad-lead,
    .arch-coast .market-copy .ad-lead,.arch-campus .market-copy .ad-lead,
    .arch-portrait2 .market-copy .ad-lead{color:#dfe3ee}
    .arch-portrait .market-hook,.arch-heritage .market-hook,.arch-coast .market-hook,
    .arch-campus .market-hook,.arch-portrait2 .market-hook{background:#fff;color:var(--mk1)}
  </style>
</head>
<body id="top" class="market-landing ad-landing ad-landing-v2 arch-${market.arch}" style="--mk1:${market.mk1};--mk2:${market.mk2}" data-market="${escapeHtml(market.market)}">
  <header class="ad-header ad-header-v2 market-header">
    <div class="container ad-nav ad-nav-v2">
      <a class="ad-brand-v2" href="index.html" aria-label="Lorenzo's Dog Training Team home">
        <img class="logo" src="assets/lorenzo-logo-white.png" alt="Lorenzo's Dog Training Team">
        <span>Serious Training. Serious Results.</span>
      </a>
      <div class="ad-header-actions">
        <a class="btn btn-ghost-light" href="#consultation">Book My Consultation</a>
        <a class="btn btn-red" href="tel:+18664364959"><span class="desktop-call">Call (866) 436-4959</span><span class="mobile-call">Call Now</span></a>
      </div>
    </div>
  </header>

  <main>
    <section class="market-hero">
      <img class="market-hero-bg" src="assets/get-started-premium-hero.jpg" alt="" width="1680" height="945" decoding="async" aria-hidden="true">
      <div class="market-tint" aria-hidden="true" style="background:linear-gradient(135deg, rgba(${market.tint},.55), rgba(${market.tint2},.28))"></div>
      <div class="market-side-rail market-side-rail-left" aria-hidden="true"><span>Obedience</span><span>Behavior Modification</span><span>Puppy Training</span></div>
      <div class="market-side-rail market-side-rail-right" aria-hidden="true"><span>Service Area</span><span>Office Routed</span><span>Local Follow-Up</span></div>
      <div class="container market-hero-grid">
        <div class="market-copy">
          <a class="ad-rating-row" href="index.html#reviews" aria-label="See Lorenzo's Dog Training Team reviews">
            <span>★★★★★</span>
            <strong>600+ Google reviews · ${escapeHtml(market.market)} request</strong>
          </a>
          <h1>${escapeHtml(market.h1)}</h1>
          <p class="ad-lead market-hook"><strong>${escapeHtml(market.hook)}</strong></p>
          <p class="ad-lead">Tell us what's going on with your dog. A certified ${escapeHtml(market.city)} dog trainer calls you back — usually the same day — and the evaluation is free.</p>
          ${market.spanish ? `<p class="ad-lead market-spanish" lang="es"><strong>Hablamos español.</strong> Entrenamiento profesional de perros en ${escapeHtml(market.city)} — puede enviar su solicitud en español y un entrenador que habla español le llamará.</p>` : ""}
          <div class="ad-benefit-row">
            <span>Local market page</span>
            <span>Fast office intake</span>
            <span>Market-routed follow-up</span>
          </div>
          <ul class="ad-checks ad-checks-v2">
            <li>Dogs of any age, size, breed, and temperament — from new puppies to newly adopted rescue dogs</li>
            <li>Behavior help: aggressive and reactive dogs, separation anxiety, biting, barking, jumping, and leash pulling</li>
            <li>Puppy help: potty training, crate training, and socialization</li>
            <li>In-home and private dog training available — plus board and train programs</li>
          </ul>
        </div>

        <figure class="market-hero-media market-trainer-media">
          <img src="${escapeHtml(market.photo)}" alt="${escapeHtml(market.photoName)} — dog trainer for ${escapeHtml(market.market)}" loading="lazy" decoding="async">
          <figcaption>
            <strong>${escapeHtml(market.photoName)}</strong>
            <span>${escapeHtml(market.photoCaption)}</span>
          </figcaption>
        </figure>

        <aside id="consultation" class="ad-consult-panel market-consult-panel">
          <div class="ad-consult-header">
            <span>${escapeHtml(market.market)}</span>
            <h2>Book your free, no-obligation evaluation.</h2>
            <p>Use the short form. The office reviews your ZIP code and training need for the fastest next step.</p>
          </div>
          <form class="ad-form-card ad-form-card-v2 contact-intake"
            action="https://formsubmit.co/production@lorenzosdogtrainingteam.com"
            method="POST"
            data-google-form-endpoint="${googleEndpoint}"
            data-office-email="production@lorenzosdogtrainingteam.com"
            data-email-endpoint="https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com"
            data-form-type="market-ad-form"
            data-conversion-event="ldtt_market_ad_lead_submit">
            <div class="form-grid-two">
              <label>First Name<input required name="first_name" autocomplete="given-name"></label>
              <label>Last Name<input required name="last_name" autocomplete="family-name"></label>
            </div>
            <label>Phone Number<input required name="phone" autocomplete="tel" inputmode="tel"></label>
            <label>Email Address<input required type="email" name="email" autocomplete="email"></label>
            <label>ZIP Code<input required name="zip" autocomplete="postal-code" inputmode="numeric"></label>
            <label>What do you need help with?
              <select required name="i_want_to">
                <option value="">Select one</option>
                <option>Schedule an in person evaluation with a trainer in my area</option>
                <option>Schedule an online consultation</option>
                <option>Dog obedience training</option>
                <option>Dog behavior modification</option>
                <option>Puppy training</option>
                <option>Specialty, service, or protection training</option>
                <option>Not sure yet</option>
              </select>
            </label>
            <label class="wide">What is happening with your dog?
              <textarea name="comments" rows="3" placeholder="${market.spanish ? "English or español — example: pulling on leash, barking, jumping / jala la correa, ladridos, ansiedad..." : "Example: pulling on leash, barking, jumping, potty training, aggression, anxiety..."}"></textarea>
            </label>
            <label class="consent-row">
              <input type="checkbox" name="sms_consent" value="yes">
              <span>By checking this box, I agree to receive recurring promotional and informational text messages from Lorenzo's Dog Training Team about dog training, consultation scheduling, follow-up, and offers. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the <a href="terms.html">Terms of Service</a> and <a href="privacy-policy.html">Privacy Policy</a>.</span>
            </label>
            <p class="form-disclaimer">Phone is required so Lorenzo's office can call about your request. SMS consent is optional and separate from submitting this form.</p>

            <input type="hidden" name="trainer_name" value="${escapeHtml(market.trainers)}">
            <input type="hidden" name="assigned_trainer" value="${escapeHtml(market.trainers)}">
            <input type="hidden" name="trainer_market" value="${escapeHtml(market.market)}">
            <input type="hidden" name="ad_market" value="${escapeHtml(market.market)}">
            <input type="hidden" name="market_city" value="${escapeHtml(market.city)}">
            <input type="hidden" name="market_state" value="${escapeHtml(market.state)}">
            <input type="hidden" name="market_trainers" value="${escapeHtml(market.trainers)}">
            <input type="hidden" name="landing_page_type" value="Paid ads market page">
            <input type="hidden" name="address_line_1" value="Short ad form - office to collect">
            <input type="hidden" name="address_line_2" value="">
            <input type="hidden" name="city" value="${escapeHtml(market.city)}">
            <input type="hidden" name="state" value="${escapeHtml(market.state)}">
            <input type="hidden" name="heard_about_us" value="Paid Advertising">
            <input type="hidden" name="vet_or_previous_client" value="Market ad landing page">
            <input type="hidden" name="internal_route_note" value="Market ad landing page lead for ${escapeHtml(market.market)}. Office to confirm full address and evaluation preference during follow-up. Nearby trainer group: ${escapeHtml(market.trainers)}.${market.spanish ? " SPANISH MARKET: lead may arrive in Spanish - Spanish-speaking trainer available in this market; office should translate before routing." : ""}">
            ${market.spanish ? `<input type="hidden" name="spanish_market" value="yes">` : ""}
            <input type="hidden" name="source_page" value="${escapeHtml(market.slug)}">
            ${attributionInputs()}
            <input type="hidden" name="timestamp" value="">
            <div class="form-status" role="status" aria-live="polite"></div>
            <button class="btn btn-red" type="submit">Book My Consultation</button>
            <small>Your request is logged for Lorenzo's production office with market and trainer attribution.</small>
          </form>
        </aside>
      </div>
    </section>

    <section class="ad-proof-band-v2">
      <div class="container ad-proof-grid-v2">
        <div><strong>39</strong><span>Years of experience</span></div>
        <div><strong>100,000+</strong><span>Dogs trained of all breeds</span></div>
        <div><strong>50+</strong><span>Professional trainers nationwide</span></div>
        <div><strong>${escapeHtml(market.state)}</strong><span>Market routing active</span></div>
      </div>
    </section>

    <section class="section market-path-section">
      <div class="container market-section-grid">
        <div>
          <span class="eyebrow">Training built for real life</span>
          <h2>One request. A clearer path for your dog.</h2>
          <p>${escapeHtml(market.proof)}</p>
          <div class="market-nearby">${nearby}</div>
          <div class="market-zip-coverage"><strong>Primary ZIP coverage</strong><div>${zipCodes}</div></div>
        </div>
        <div class="ad-service-grid-v2 market-service-grid">
          <article>
            <span>01</span>
            <h3>Dog Obedience Training</h3>
            <p>Practical obedience that helps your dog listen in the moments that matter: at home, on walks, around people, and around distractions. In-home and private dog training options available. From $1,250.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Behavior Modification</h3>
            <p>Balanced training support for aggression, reactivity, barking, pulling, jumping, anxiety, and house-soiling with owner guidance built in.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Specialty & Service Dog Training</h3>
            <p>Outcome-based support for protection, service and assistance needs, scent work, utility training, retrieval, and advanced control.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Board &amp; Train</h3>
            <p>Your dog trains with a professional and comes home with real skills — with owner handoff lessons included. From $2,500. Fall and holiday slots fill 6–8 weeks ahead.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section market-pricing">
      <div class="container">
        <span class="eyebrow">Straight answers on price</span>
        <h2>Transparent pricing. No mystery quotes.</h2>
        <div class="ad-service-grid-v2 market-service-grid">
          <article>
            <span>$</span>
            <h3>Training from $1,250</h3>
            <p>Professional dog training with a certified ${escapeHtml(market.city)} dog trainer — obedience, behavior help, and puppy programs. Your free evaluation tells you exactly what your dog needs before you spend anything.</p>
          </article>
          <article>
            <span>$$</span>
            <h3>Training with Boarding from $2,500</h3>
            <p>Board and train: your dog lives and trains with a professional, then we teach you how to keep the results. Fall and holiday spots book 6–8 weeks out — ask early.</p>
          </article>
        </div>
        <div class="cta-band ad-cta-v2" style="margin-top:24px">
          <div>
            <h2>The LDTT Training Guarantee</h2>
            <p>We stand behind our training. Every LDTT program includes a Limited Training Guarantee. If your dog is not demonstrating the behaviors addressed in your program within 90 days of completing training — and you've followed the training and practice instructions — we provide corrective instruction or follow-up training at no additional training fee. Dog training is a partnership: we do our part, and we show you how to do yours.</p>
          </div>
          <a class="btn btn-red" href="#consultation">Start With a Free Evaluation</a>
        </div>
      </div>
    </section>

    <section class="section tight">
      <div class="container">
        <div class="cta-band ad-cta-v2">
          <div>
            <h2>Need dog training in ${escapeHtml(market.market)}?</h2>
            <p>Submit the quick request and let Lorenzo's office help with the next step.</p>
          </div>
          <a class="btn btn-red" href="#consultation">Book My Consultation</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer ad-footer">
    <div class="container subfooter">&copy; Lorenzo's Dog Training Team. Serious Training. Serious Results. | <a href="tel:+18664364959">(866) 436-4959</a></div>
  </footer>

  ${conversionAndAttributionScript()}
  <script src="supabase-config.js"></script>
  <script src="script.js?v=${cacheVersion}"></script>
  <script src="market-landing.js?v=${cacheVersion}"></script>
  <script src="ad-funnel.js?v=${cacheVersion}"></script>
</body>
</html>`;
};

for (const market of markets) {
  writeFileSync(resolve(`${market.slug}.html`), page(market));
  console.log(`generated ${market.slug}.html`);
}
