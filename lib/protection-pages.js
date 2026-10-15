// Protection Training landing pages (Joshua 2026-10-14, design from the office mockup).
// Six markets only, each with active trainers. Served at /protection/<slug> by api/protection-page.js.
// The lead form is the SAME flow as the market/ads pages: assets/v2/v2.js posts to /api/booking-lead,
// the ZIP box lists bookable trainers (GET /api/booking?zip=), and the client books on the next screen.
const html = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MARKETS = {
  "atlanta": { city: "Atlanta", state: "Georgia", code: "GA", zip: "30303", area: "Atlanta and surrounding Georgia communities" },
  "cleveland": { city: "Cleveland", state: "Ohio", code: "OH", zip: "44105", area: "Cleveland and surrounding Ohio communities", tc: "4815 Orchard Rd, Garfield Heights, OH" },
  "fort-worth": { city: "Fort Worth", state: "Texas", code: "TX", zip: "76102", area: "Fort Worth and surrounding Texas communities" },
  "san-antonio": { city: "San Antonio", state: "Texas", code: "TX", zip: "78205", area: "San Antonio and surrounding Texas communities" },
  "durham": { city: "Durham", state: "New Hampshire", code: "NH", zip: "03824", area: "Durham, the Seacoast and southern New Hampshire" },
  "navarre": { city: "Navarre", state: "Florida", code: "FL", zip: "32566", area: "Navarre and the Florida Panhandle" }
};

// Videos from Lorenzo's team (Joshua 2026-10-14): YouTube Shorts, titles set by Joshua.
const VIDEOS = [
  { id: "PHK-ADY03N4", title: "Security Training" },
  { id: "zAnd5G_-Ms4", title: "Personal Protection Training" }
];

const STATES = [["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]];

const WHY = [
  { icon: "paw", title: "Reliable Obedience &amp; Responses", text: "Your dog learns to listen and respond to your commands." },
  { icon: "eye", title: "Awareness &amp; Alerts", text: "Builds confidence and situational awareness." },
  { icon: "shield", title: "Controlled Protective Behaviors", text: "Develops appropriate responses based on your dog&#39;s suitability and training program." },
  { icon: "target", title: "Discipline &amp; Consistency", text: "Reinforces good habits and builds lasting results." },
  { icon: "clip", title: "Professional Evaluation", text: "We assess your dog&#39;s temperament and behavior before recommending specialized training." }
];

const INCLUDED = [
  ["Foundational &amp; Advanced Obedience", "/assets/protection/inc1.webp"],
  ["Handler Communication", "/assets/protection/inc2.webp"],
  ["Alert &amp; Response Training", "/assets/protection/inc3.webp"],
  ["Protection Exercises", "/assets/protection/inc4.webp"],
  ["Owner Education", "/assets/protection/inc5.webp"],
  ["Continued Reinforcement", "/assets/protection/inc6.webp"]
];

const EVAL_CHECKS = ["Temperament &amp; behavior history", "Confidence &amp; stress recovery", "Obedience foundation &amp; responsiveness", "Reactivity, fear or aggression concerns", "Health and other considerations", "Owner goals and experience"];
const SAFETY = ["Experienced, Certified Trainers", "Structured &amp; Progressive Plans", "Safe, Controlled Environments", "Focus on Long-Term Success"];

const ICONS = {
  paw: '<path d="M12 13c-2.9 0-5.5 2.1-5.5 4.6 0 1.4 1.1 2.4 2.5 2.4 1 0 1.9-.5 3-.5s2 .5 3 .5c1.4 0 2.5-1 2.5-2.4C17.5 15.1 14.9 13 12 13Zm-5-2.3c1 0 1.8-1 1.8-2.3S8 6.1 7 6.1 5.2 7.1 5.2 8.4 6 10.7 7 10.7Zm10 0c1 0 1.8-1 1.8-2.3s-.8-2.3-1.8-2.3-1.8 1-1.8 2.3.8 2.3 1.8 2.3Zm-7.5-3.2c1 0 1.9-1.1 1.9-2.5S10.5 2.5 9.5 2.5 7.6 3.6 7.6 5s.9 2.5 1.9 2.5Zm5 0c1 0 1.9-1.1 1.9-2.5s-.9-2.5-1.9-2.5-1.9 1.1-1.9 2.5.9 2.5 1.9 2.5Z"/>',
  eye: '<path d="M12 5C6.5 5 2.3 9.4 1 12c1.3 2.6 5.5 7 11 7s9.7-4.4 11-7c-1.3-2.6-5.5-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9Zm0-2A2.5 2.5 0 1 0 12 9.5a2.5 2.5 0 0 0 0 5Z"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 13.6-3.2-3.2 1.4-1.4 1.8 1.8 4.2-4.2 1.4 1.4-5.6 5.6Z"/>',
  target: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 15.8A6.8 6.8 0 1 1 12 5.2a6.8 6.8 0 0 1 0 13.6ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 5.8a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z"/>',
  clip: '<path d="M16 3h-2.2a2.5 2.5 0 0 0-3.6 0H8a2 2 0 0 0-2 2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1a2 2 0 0 0-2-2Zm-4 0a1 1 0 0 1 1 1h-2a1 1 0 0 1 1-1ZM8 10h8v2H8v-2Zm0 4h8v2H8v-2Z"/>',
  check: '<path d="M9.3 16.3 5 12l-1.4 1.4 5.7 5.7L21.4 7l-1.4-1.4L9.3 16.3Z"/>'
};
const icon = (name, cls) => `<svg class="${cls || "ic"}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${ICONS[name]}</svg>`;

function stateOptions(code) {
  return '<option value="">Choose a state</option>' + STATES.map(([value, label]) => `<option value="${value}"${value === code ? " selected" : ""}>${label}</option>`).join("");
}

function renderProtectionPage(slug) {
  const m = MARKETS[slug];
  if (!m) return null;
  const cityState = `${m.city}, ${m.code}`;
  const title = `Protection Training for Dogs in ${cityState} | Lorenzo's Dog Training Team`;
  const description = `Professional protection training for dogs in ${m.area}. Balanced, controlled and reliable — built on obedience, handler communication and a free in-person evaluation.`;
  const canonical = `https://www.lorenzosdogtrainingteam.com/protection/${slug}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(title)}</title>
<meta name="description" content="${html(description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/assets/lorenzo-logo-transparent.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-11463464040"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-11463464040');</script>
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','3790623554504010');fbq('track','PageView');</script>
<style>
:root{--navy:#0b2a4a;--ink:#0a1e36;--red:#d80f35;--red2:#b30c2c;--paper:#f4f6f9;--line:#dfe6ee;--txt:#20304a;--muted:#5b6883}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Poppins,Arial,sans-serif;color:var(--txt);background:#fff;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
.wrap{max-width:1120px;margin:0 auto;padding:0 16px}
h1,h2,h3,.kick{font-family:Oswald,Poppins,sans-serif;text-transform:uppercase;letter-spacing:.4px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:700 15px Poppins,sans-serif;border-radius:8px;padding:14px 22px;text-decoration:none;border:2px solid transparent;cursor:pointer;text-align:center}
.btn-red{background:var(--red);color:#fff}.btn-red:hover{background:var(--red2)}
.btn-ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.75)}.btn-ghost:hover{background:rgba(255,255,255,.12)}
.topbar{background:var(--ink);position:sticky;top:0;z-index:40;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;padding-top:10px;padding-bottom:10px}
.topbar img{height:46px;background:#fff;border-radius:8px;padding:4px 10px}
.topbar .call{font:700 14px Poppins;background:var(--red);color:#fff;border-radius:8px;padding:10px 16px;text-decoration:none;white-space:nowrap}
.hero{background:linear-gradient(100deg,var(--ink) 0%,var(--navy) 60%,#123a63 100%);color:#fff;overflow:hidden}
.hero .wrap{display:grid;grid-template-columns:1.05fr .95fr;gap:28px;align-items:center;padding-top:44px;padding-bottom:48px}
.kick{color:#ff5f7e;font-weight:600;font-size:15px;letter-spacing:2.5px;margin-bottom:6px}
.hero h1{font-size:52px;line-height:1.04;font-weight:700}
.hero .sub{margin:16px 0 22px;font-size:16px;line-height:1.6;color:#dbe6f2;max-width:52ch}
.hero .ctas{display:flex;gap:12px;flex-wrap:wrap}
.hero .assure{display:flex;gap:10px;align-items:flex-start;margin-top:18px;color:#cfdcea;font-size:13.5px;max-width:48ch}
.hero .assure .ic{width:20px;height:20px;flex:none;color:#ff5f7e;margin-top:2px}
.hero-photo{position:relative}
.hero-photo img{border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.45);aspect-ratio:563/270;object-fit:cover;width:100%}
.hero-script{position:absolute;right:10px;bottom:14px;background:rgba(10,30,54,.88);color:#fff;border-left:4px solid var(--red);padding:10px 16px;border-radius:8px;font-family:Oswald;font-size:20px;line-height:1.3;text-transform:none}
.section{padding:52px 0}
.section.alt{background:var(--paper)}
.h2kick{color:var(--red);font:600 13px Oswald;letter-spacing:2.5px;text-transform:uppercase}
h2{color:var(--navy);font-size:32px;margin:4px 0 14px}
.lead-copy{max-width:62ch;line-height:1.65;font-size:15.5px}
.why{display:grid;grid-template-columns:1.2fr repeat(5,1fr);gap:18px;align-items:start}
.why-card{text-align:center;padding:6px 4px}
.why-card .ic{width:34px;height:34px;color:var(--red);margin:0 auto 10px}
.why-card h3{font-size:14.5px;color:var(--navy);margin-bottom:6px;line-height:1.25}
.why-card p{font-size:12.5px;color:var(--muted);line-height:1.5}
.inc-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:22px}
.inc-card{position:relative;border-radius:10px;overflow:hidden;background:var(--navy)}
.inc-card img{aspect-ratio:1/1;object-fit:cover;object-position:center 30%;width:100%;opacity:.95}
.inc-card span{position:absolute;left:0;right:0;bottom:0;background:rgba(10,30,54,.92);color:#fff;font:600 11.5px/1.3 Oswald;letter-spacing:.6px;text-transform:uppercase;padding:8px;text-align:center}
.twocol{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:start}
.checklist{list-style:none;margin:14px 0 20px}
.checklist li{display:flex;gap:10px;align-items:flex-start;margin-bottom:9px;font-size:14.5px}
.checklist .ic{width:18px;height:18px;color:var(--red);flex:none;margin-top:2px}
.eval-photo img{border-radius:12px;box-shadow:0 12px 34px rgba(11,42,74,.22);object-fit:cover;width:100%}
.safety{background:var(--navy);color:#fff;border-radius:14px;padding:26px 26px 22px;margin-top:26px}
.safety h3{font-size:20px;margin-bottom:4px}
.safety .red{color:#ff5f7e;font:600 13px Oswald;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px}
.safety p{font-size:14px;color:#dbe6f2;line-height:1.6;margin-bottom:14px}
.safety ul{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:9px}
.safety li{display:flex;gap:9px;align-items:center;font-size:13.5px}
.safety .ic{width:17px;height:17px;color:#58d68d;flex:none}
.videos{background:var(--ink);color:#fff}
.videos h2{color:#fff}
.vid-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;max-width:980px;margin:24px auto 0}
.vid-card{background:#10263f;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.vid-card iframe{width:100%;aspect-ratio:16/9;border:0;display:block}
.vid-card h3{font-size:16px;padding:12px 14px;text-align:center}
.reviews-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}
.review{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px}
.review .stars{color:#f5b50a;font-size:15px;letter-spacing:2px;margin-bottom:8px}
.review p{font-size:13.5px;line-height:1.6;color:var(--txt)}
.review b{display:block;margin-top:10px;color:var(--navy);font-size:13px}
.review small{color:var(--muted)}
.cta-band{background:var(--navy);color:#fff;border-radius:14px;padding:30px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
.cta-band h2{color:#fff;margin:0;font-size:26px}
.form-card{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 14px 40px rgba(11,42,74,.12);padding:26px;max-width:720px;margin:28px auto 0}
.form-card h3{color:var(--navy);font-size:22px;margin-bottom:4px}
.form-card .hint{font-size:13.5px;color:var(--muted);margin-bottom:16px}
.form-card label{display:block;font:600 13px Poppins;color:var(--navy);margin-bottom:12px}
.form-card input,.form-card select{width:100%;margin-top:5px;padding:12px;border:1.5px solid var(--line);border-radius:8px;font:400 15px Poppins;background:#fff;color:var(--txt)}
.form-card input:focus,.form-card select:focus{outline:none;border-color:var(--navy)}
.form-grid-two{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.required-mark{color:var(--red);margin-left:3px}
.optional-mark{color:var(--muted);font-weight:400;margin-left:5px;font-size:12px}
.consent-optional{font-size:12.5px;margin:4px 0 8px}
.consent-row{display:flex;gap:10px;align-items:flex-start;font-weight:400!important;font-size:12px;color:var(--muted);line-height:1.5}
.consent-row input{width:auto;margin-top:3px}
.form-disclaimer{font-size:11.5px;color:var(--muted);margin:10px 0 14px}
.form-card .btn{width:100%}
.form-card small{display:block;text-align:center;margin-top:10px;color:var(--muted);font-size:12px}
.fstatus{margin-top:12px;font:600 14px Poppins;color:var(--navy);text-align:center;white-space:pre-line}
.tnear{border:1.5px solid var(--line);border-radius:10px;background:var(--paper);padding:14px 14px 12px;margin-bottom:14px}
.tnear[hidden]{display:none}
.tnear-h{font:600 15px Oswald;color:var(--navy);letter-spacing:.5px;text-transform:uppercase}
.tnear-sub{font-size:12px;color:var(--muted);margin:2px 0 8px}
.tnear-msg{font-size:13px;color:var(--txt);margin:0 0 6px}
.tnear-msg[hidden],.tnear-sub[hidden]{display:none}
.tnear-list{display:grid;grid-template-columns:1fr;gap:8px}
.tnear-list:empty{display:none}
.tcard{position:relative;display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid #cfd6e2;border-radius:8px;padding:8px 9px;cursor:pointer;font-weight:400;font-size:13px}
.tcard:hover{border-color:#9fb0cb}
.tcard.on{border-color:var(--red);box-shadow:0 0 0 2px rgba(216,15,53,.16)}
.tcard:focus-within{outline:2px solid var(--navy);outline-offset:2px}
.tc-radio{position:absolute;right:8px;top:8px;width:16px;height:16px;min-width:0;margin:0;padding:0;border:0;border-radius:50%;accent-color:var(--red);flex:none;box-shadow:none}
.tc-photo{width:44px;height:44px;border-radius:50%;object-fit:cover;background:#e7ecf4;flex:none}
.tc-blank{display:grid;place-items:center;font:700 18px/1 Oswald,sans-serif;color:#7386a5}
.tc-txt{display:flex;flex-direction:column;gap:1px;min-width:0;padding-right:18px}
.tc-name{font-size:13px;font-weight:700;color:var(--navy);line-height:1.2}
.tc-meta{font-size:11.5px;color:var(--muted);line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tc-cal{font-size:10.5px;font-weight:700;letter-spacing:.02em;color:#1d6a33;line-height:1.3}
footer{background:var(--ink);color:#cfdcea;padding:30px 0;margin-top:52px}
footer .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
footer img{height:44px;background:#fff;border-radius:8px;padding:4px 10px}
footer .tag{font-family:Oswald;letter-spacing:1px;text-transform:uppercase;font-size:13px}
footer a{color:#cfdcea;text-decoration:none;font-size:12.5px;margin-left:14px}
.redline{height:5px;background:var(--red)}
@media(max-width:960px){
 .hero .wrap{grid-template-columns:1fr;padding-top:30px;padding-bottom:34px}
 .hero h1{font-size:40px}
 .hero-photo{order:-1;margin:0 -16px}
 .hero-photo img{border-radius:0;aspect-ratio:563/270}
 .hero-script{font-size:16px;right:16px}
 .why{grid-template-columns:1fr 1fr;gap:16px}
 .why-intro{grid-column:1/-1}
 .why-card{text-align:left;display:grid;grid-template-columns:30px 1fr;gap:2px 12px}
 .why-card .ic{width:26px;height:26px;margin:0;grid-row:1/3}
 .inc-grid{grid-template-columns:repeat(3,1fr)}
 .twocol{grid-template-columns:1fr}

 .reviews-grid{grid-template-columns:1fr}
 h2{font-size:27px}
}
@media(max-width:620px){
 .hero h1{font-size:33px}
 .hero .ctas .btn{width:100%}
 .why{grid-template-columns:1fr}
 .inc-grid{grid-template-columns:repeat(2,1fr)}
 .form-grid-two{grid-template-columns:1fr}
 .vid-grid{grid-template-columns:1fr}
 .cta-band{justify-content:center;text-align:center}
 .topbar img{height:40px}
 footer .wrap{justify-content:center;text-align:center}
}
</style>
</head>
<body>
<header class="topbar"><div class="wrap">
  <img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team">
  <a class="call" href="tel:+18664364959">&#128222; CALL 866.436.4959</a>
</div></header>

<section class="hero"><div class="wrap">
  <div>
    <p class="kick">Professional &middot; ${html(cityState)}</p>
    <h1>Protection Training<br>For Dogs</h1>
    <p class="sub">Build a stronger foundation in obedience, handler communication and responsible management with a training path tailored to your dog and your goals &mdash; serving ${html(m.area)}.</p>
    <div class="ctas">
      <a class="btn btn-red" href="#book">&#128197; Book Your FREE Evaluation</a>
      <a class="btn btn-ghost" href="tel:+18664364959">&#128222; Call 866.436.4959</a>
    </div>
    <p class="assure">${icon("shield")}<span>Every dog is different. An evaluation helps identify suitability and the right next step.</span></p>
  </div>
  <div class="hero-photo">
    <img src="/assets/protection/hero.webp" alt="Professional trainer with a German Shepherd in a working harness" fetchpriority="high">
  </div>
</div></section>
<div class="redline"></div>

<section class="section"><div class="wrap">
  <div class="why">
    <div class="why-intro">
      <p class="h2kick">Why Professional</p>
      <h2>Protection Training?</h2>
      <p class="lead-copy">Protection training is not about creating aggression &mdash; it&#39;s about building confidence, control and trust. Professional instruction helps your dog develop the right skills, in the right way, for real-life situations.</p>
    </div>
    ${WHY.map(w => `<div class="why-card">${icon(w.icon)}<h3>${w.title}</h3><p>${w.text}</p></div>`).join("")}
  </div>
</div></section>

<section class="section alt"><div class="wrap">
  <h2>What&#39;s Included in the Protection Training Program</h2>
  <div class="inc-grid">${INCLUDED.map(([label, src]) => `<div class="inc-card"><img src="${src}" alt="" loading="lazy"><span>${label}</span></div>`).join("")}</div>
</div></section>

<section class="section"><div class="wrap twocol">
  <div>
    <h2>Temperament Evaluation &amp; Dog Suitability</h2>
    <p class="lead-copy">Protection training isn&#39;t right for every dog. We evaluate a range of factors to determine if it&#39;s the right fit, including:</p>
    <ul class="checklist">${EVAL_CHECKS.map(c => `<li>${icon("check")}<span>${c}</span></li>`).join("")}</ul>
    <a class="btn btn-red" href="#book">Book Your FREE Evaluation</a>
  </div>
  <div>
    <div class="eval-photo"><img src="/assets/protection/eval.webp" alt="Trainer evaluating a German Shepherd" loading="lazy"></div>
    <div class="safety">
      <h3>Our Training Approach &amp; Safety Standards</h3>
      <p class="red">Training with purpose. Always with safety.</p>
      <p>We use proven, balanced training methods, professional handlers and real-world scenarios &mdash; all in a safe, controlled environment. Your dog&#39;s safety, your peace of mind and long-term success are our priorities.</p>
      <ul>${SAFETY.map(s => `<li>${icon("check")}<span>${s}</span></li>`).join("")}</ul>
    </div>
  </div>
</div></section>

<section class="section videos"><div class="wrap">
  <h2 style="text-align:center">See Our Protection Training in Action</h2>
  <p style="text-align:center;color:#cfdcea;font-size:14px">Watch real training. Real dogs. Real results.</p>
  <div class="vid-grid">${VIDEOS.map(v => `<div class="vid-card"><iframe src="https://www.youtube-nocookie.com/embed/${v.id}?rel=0&modestbranding=1&playsinline=1" title="${v.title.replace(/&middot;/g, "-")}" loading="lazy" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe><h3>${html(v.title)}</h3></div>`).join("")}</div>
</div></section>

<section class="section alt" id="clientsay" data-reviews hidden><div class="wrap">
  <h2>What Our Clients Say</h2>
  <div class="reviews-grid"></div>
</div></section>

<section class="section" id="book"><div class="wrap">
  <div class="cta-band">
    <h2>Ready to take the next step?</h2>
    <a class="btn btn-red" href="#evalForm">Book Your FREE Evaluation</a>
  </div>
  <form id="evalForm" class="form-card lead booking-intake" data-kind="evaluation" data-endpoint="/api/booking-lead" data-form-type="protection-page-form" data-conversion-event="ldtt_protection_lead_submit" autocomplete="on" novalidate>
    <h3>Start Your FREE Evaluation in ${html(cityState)}</h3>
    <p class="hint">In person, not a phone call. A trainer meets you and your dog face to face. Type your ZIP to see the trainers near you.${m.tc ? ` <b>In-home or at our Training Center: ${html(m.tc)} &mdash; you pick on the next screen.</b>` : ""}</p>
    <div class="form-grid-two">
      <label>First name<span class="required-mark" aria-hidden="true">*</span><input name="first_name" autocomplete="given-name" required></label>
      <label>Last name<span class="required-mark" aria-hidden="true">*</span><input name="last_name" autocomplete="family-name" required></label>
    </div>
    <label>Phone<span class="required-mark" aria-hidden="true">*</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label>
    <label>Email<span class="required-mark" aria-hidden="true">*</span><input name="email" type="email" autocomplete="email" required></label>
    <label class="wide">Street address<span class="required-mark" aria-hidden="true">*</span><input name="address" autocomplete="street-address" maxlength="300" required placeholder="Where the trainer comes to see your dog"></label>
    <div class="form-grid-two">
      <label>City<span class="required-mark" aria-hidden="true">*</span><input name="city" autocomplete="address-level2" maxlength="80" required placeholder="${html(m.city)}"></label>
      <label>State<span class="required-mark" aria-hidden="true">*</span><select name="state" autocomplete="address-level1" required>${stateOptions(m.code)}</select></label>
    </div>
    <label>ZIP code<span class="required-mark" aria-hidden="true">*</span><input name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="10" required placeholder="${html(m.zip)}"></label>
    <div class="tnear wide" data-trainer-pick data-endpoint="/api/booking" data-debounce="400" data-owner="" data-loading="Looking for trainers near you&hellip;" data-empty="Our office will book you with a trainer near you. Send the form and we will call you." hidden>
      <h3 class="tnear-h">Trainers near you</h3><p class="tnear-sub">Pick who you want. You can still change this on the next screen.</p>
      <p class="tnear-msg" role="status" aria-live="polite"></p>
      <div class="tnear-list" role="group" aria-label="Trainers near you"></div>
      <input type="hidden" name="trainer_slug" value=""><input type="hidden" name="assigned_trainer" value="">
    </div>
    <label>Dog&#39;s name<span class="optional-mark">(optional)</span><input name="dog_name" autocomplete="off"></label>
    <label class="wide">What are your goals for your dog?<span class="optional-mark">(optional)</span>
      <select name="problem">
        <option>Protection training</option>
        <option>Security / alert work</option>
        <option>Obedience foundation first</option>
        <option>Reactive to dogs or people</option>
        <option>Board &amp; train</option>
        <option>Something else</option>
      </select>
    </label>
    <p class="consent-optional"><b>Optional &mdash; not required to book your evaluation.</b></p>
    <label class="consent-row">
      <input type="checkbox" name="sms_consent" value="yes">
      <span>By checking this box, I agree to receive text messages from Lorenzo's Dog Training Team about my request: follow-up on my inquiry, scheduling and confirming my free consultation or evaluation, and appointment reminders. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Service</a> and <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>.</span>
    </label>
    <p class="form-disclaimer">Phone is required so Lorenzo's office can call about your request. SMS consent is optional and separate from submitting this form.</p>
    <button class="btn btn-red" type="submit">Book My FREE Evaluation</button>
    <small>Free and no obligation. Your evaluation is booked on the next screen.</small>
    <p class="fstatus wide" role="status" aria-live="polite"></p>
  </form>
</div></section>

<footer><div class="wrap">
  <img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team">
  <p class="tag">Serious Training. Serious Results.&trade;</p>
  <p><a href="tel:+18664364959">Call 866.436.4959</a></p>
</div></footer>
<div class="redline"></div>

<script>
// Real approved client reviews (the same office-approved list the homepage shows). Section stays hidden if none.
(function(){
  fetch("/api/approved-homepage-reviews").then(function(r){return r.json();}).then(function(j){
    var list=(j&&j.reviews)||[]; if(!list.length) return;
    var grid=document.querySelector("#clientsay .reviews-grid");
    grid.innerHTML=list.slice(0,3).map(function(r){
      var text=String(r.review_text||"").trim(); if(text.length>210) text=text.slice(0,207).replace(/\\s+\\S*$/,"")+"…";
      var esc=function(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");};
      return '<div class="review"><div class="stars" aria-label="5 stars">★★★★★</div><p>“'+esc(text)+'”</p><b>'+esc(r.reviewer||"LDTT client")+'</b><small>'+esc(r.location||"")+'</small></div>';
    }).join("");
    document.getElementById("clientsay").hidden=false;
  }).catch(function(){});
})();
</script>
<script src="/script.js?v=20261009live77" defer></script>
<script src="/assets/v2/v2.js?v=20261009live77"></script>
</body>
</html>`;
}

module.exports = { MARKETS, renderProtectionPage };
