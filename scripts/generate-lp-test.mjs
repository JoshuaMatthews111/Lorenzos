/* Test landing page — quiz-funnel layout Tim liked, built on our own concept,
   our own copy, and the exact lead plumbing the live market pages use.

   It deliberately reuses the generated Cleveland page's <head> (Google Ads tag,
   Meta pixel, styles) and its closing script block (UTM capture, Supabase lead
   write, conversion fire) so a lead from this page lands in the office exactly
   like a lead from dog-training-cleveland-oh. Only the layout differs — that is
   the thing being tested. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = "dog-training-cleveland-oh.html";
const SLUG = "lp-test-cleveland-oh";
const src = readFileSync(resolve(SOURCE), "utf8");

const head = src.slice(src.indexOf("<head>"), src.indexOf("</head>"));
const tail = src.slice(src.indexOf('    (function(){\n      document.addEventListener'), src.lastIndexOf("</body>"));

/* Hidden inputs carry trainer routing and ad attribution. Taken verbatim so the
   office record is identical, with source_page repointed at the test slug so
   Tim can tell the two layouts apart in the leads table. */
const formBlock = src.slice(src.indexOf('<form class="ad-form-card ad-form-card-v2 contact-intake"'));
const hidden = (formBlock.slice(0, formBlock.indexOf("</form>")).match(/<input type="hidden"[^>]*>/g) || [])
  .map(tag => tag.replace('name="source_page" value="dog-training-cleveland-oh"', `name="source_page" value="${SLUG}"`))
  .map(tag => tag.replace('value="Paid ads market page"', 'value="Paid ads market page (quiz layout test)"'))
  .join("\n              ");
if (!hidden.includes(SLUG)) throw new Error("source_page hidden input not rewritten");

const PHONE = "(866) 436-4959";
const TEL = "+18664364959";

const newHead = head
  .replace(/<title>[\s\S]*?<\/title>/, "<title>Cleveland Dog Training | Free Evaluation | Lorenzo's Dog Training Team</title>")
  .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Aggression, leash pulling, or a new puppy? Book a free Cleveland dog training evaluation with Lorenzo\'s Dog Training Team. Published pricing and a 90-day guarantee.">')
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="https://www.lorenzosdogtrainingteam.com/${SLUG}">`)
  /* noindex: this is an A/B test of the live Cleveland page. Letting Google
     index both would split rankings and create duplicate content. */
  + `\n  <meta name="robots" content="noindex,nofollow">\n  <style>${css()}</style>\n`;

function css() {
  return `
  :root{--navy:#152569;--red:#C8102E;--ink:#101828;--muted:#5A6478;--line:#E4E8F0;--bg:#F6F8FC}
  .lp *{box-sizing:border-box}
  .lp{font-family:"Poppins","Helvetica Neue",Arial,sans-serif;color:var(--ink);background:#fff}
  .lp-wrap{width:min(1180px,92vw);margin-inline:auto}
  .lp img{max-width:100%;height:auto;display:block}

  /* Brand bar — logo and one call button. No nav links: on a paid-ads landing
     page every extra link is a way out that is not the form. */
  .lp-bar{background:#fff;padding:14px 0;border-bottom:1px solid var(--line)}
  .lp-bar .lp-wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
  .lp-bar img{height:52px;width:auto}
  .lp-call{display:inline-flex;align-items:center;gap:8px;background:var(--red);color:#fff;
    text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px;font-size:16px;
    box-shadow:0 8px 20px rgba(200,16,46,.28)}
  .lp-call:hover{background:#a60d26}

  /* Hero */
  .lp-hero{position:relative;background:#0b1020;color:#fff;overflow:hidden}
  .lp-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center 58%;opacity:.42}
  .lp-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,12,28,.92),rgba(8,12,28,.55))}
  .lp-hero .lp-wrap{position:relative;z-index:2;display:grid;grid-template-columns:1.05fr .95fr;
    gap:44px;align-items:center;padding:64px 0 72px}
  .lp-hero h1{font-size:clamp(30px,4vw,50px);line-height:1.08;margin:0 0 6px;font-weight:800;letter-spacing:-.5px}
  .lp-rule{width:96px;height:5px;background:var(--red);border-radius:3px;margin:18px 0 20px}
  .lp-pain{font-size:clamp(17px,1.7vw,21px);font-weight:600;color:#FFD9DE;margin:0 0 10px}
  .lp-gain{font-size:clamp(16px,1.5vw,19px);color:#DCE3F2;margin:0 0 22px;max-width:52ch}
  .lp-trust{display:flex;flex-wrap:wrap;gap:10px;list-style:none;padding:0;margin:0}
  .lp-trust li{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);
    border-radius:999px;padding:7px 15px;font-size:14px;font-weight:600}

  /* Quiz card */
  .lp-quiz{background:#fff;color:var(--ink);border-radius:18px;overflow:hidden;
    box-shadow:0 26px 60px rgba(0,0,0,.42)}
  .lp-quiz-head{padding:22px 24px 0}
  .lp-quiz-head p{margin:0;font-size:17px;font-weight:700;line-height:1.35}
  .lp-quiz-head em{color:var(--red);font-style:italic}
  .lp-progress{height:6px;background:var(--line);border-radius:99px;margin:16px 24px 0;overflow:hidden}
  .lp-progress span{display:block;height:100%;background:var(--red);width:25%;transition:width .3s ease}
  .lp-step{padding:18px 24px 22px}
  .lp-step[hidden]{display:none}
  .lp-step legend,.lp-q{font-weight:700;font-size:16px;margin:0 0 12px;display:block;border:0;padding:0}
  .lp-quiz input[type=text],.lp-quiz input[type=email],.lp-quiz input[type=tel],.lp-quiz select,.lp-quiz textarea{
    width:100%;padding:13px 14px;border:1.5px solid var(--line);border-radius:10px;font:inherit;background:#fff}
  .lp-quiz input:focus,.lp-quiz select:focus,.lp-quiz textarea:focus{outline:3px solid rgba(200,16,46,.25);border-color:var(--red)}
  .lp-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .lp-field{margin-bottom:12px}
  .lp-field span{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:5px}
  .lp-chips{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 4px}
  .lp-chip{border:1.5px solid var(--line);border-radius:12px;padding:13px 12px;background:#fff;
    font:inherit;font-weight:600;cursor:pointer;text-align:left;line-height:1.25}
  .lp-chip:hover{border-color:var(--red)}
  .lp-chip[aria-pressed=true]{border-color:var(--red);background:#FFF3F5;box-shadow:inset 0 0 0 1px var(--red)}
  .lp-next{width:100%;border:0;background:var(--red);color:#fff;font:inherit;font-weight:800;
    font-size:17px;padding:17px;cursor:pointer;display:block}
  .lp-next:hover{background:#a60d26}
  .lp-back{background:none;border:0;color:var(--muted);font:inherit;font-weight:600;
    cursor:pointer;padding:10px 0 0;text-decoration:underline}
  .lp-err{color:var(--red);font-weight:600;font-size:14px;margin:8px 0 0;min-height:1em}
  .lp-consent{display:flex;gap:9px;align-items:flex-start;font-size:11.5px;color:var(--muted);
    line-height:1.45;margin:10px 0 0}
  .lp-consent input{margin-top:3px;flex:0 0 auto}
  .lp-fineprint{font-size:11.5px;color:var(--muted);margin:8px 0 0;line-height:1.45}
  .lp-form,.lp-step,.lp-field,.lp-consent{min-width:0}
  .lp-consent span{min-width:0;overflow-wrap:anywhere;text-transform:none;letter-spacing:normal}
  .lp-quiz label,.lp-quiz label span{text-transform:none;letter-spacing:normal}
  .lp-offscreen{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0}
  .lp-quiz .form-status{padding:0 24px;font-weight:600}
  .lp-quiz .form-status.success{color:#146c43}
  .lp-quiz .form-status.error{color:var(--red)}

  /* Sections */
  .lp-sec{padding:70px 0}
  .lp-sec--tint{background:var(--bg)}
  .lp-sec h2{font-size:clamp(25px,3vw,38px);line-height:1.15;margin:0 0 14px;color:var(--navy);font-weight:800}
  .lp-sec .lead{font-size:18px;color:var(--muted);margin:0 auto 8px;max-width:70ch;line-height:1.6}
  .lp-center{text-align:center}
  .lp-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:20px;margin-top:34px;text-align:left}
  .lp-card{background:#fff;border:1px solid var(--line);border-radius:15px;padding:24px}
  .lp-sec--tint .lp-card{background:#fff}
  .lp-card h3{margin:0 0 8px;font-size:18px;color:var(--navy)}
  .lp-card p{margin:0;color:var(--muted);line-height:1.6}
  .lp-num{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;
    border-radius:9px;background:var(--red);color:#fff;font-weight:800;font-size:15px;margin-bottom:12px}

  /* CTA band, repeated down the page the way the reference does */
  .lp-band{background:var(--navy);color:#fff;text-align:center;padding:52px 0}
  .lp-band h2{color:#fff;margin:0 0 10px}
  .lp-band p{color:#C9D3EE;margin:0 0 22px;font-size:17px}
  .lp-btn{display:inline-block;background:var(--red);color:#fff;text-decoration:none;font-weight:800;
    font-size:18px;padding:17px 34px;border-radius:12px;border:0;cursor:pointer;font-family:inherit;
    box-shadow:0 10px 26px rgba(200,16,46,.34)}
  .lp-btn:hover{background:#a60d26}
  .lp-band small{display:block;margin-top:12px;color:#A9B6D8}

  /* Published pricing — our advantage, and the reference page has nothing like it */
  .lp-price{text-align:center}
  .lp-price .kicker{text-transform:uppercase;letter-spacing:.09em;font-size:13px;font-weight:700;color:var(--muted);margin:0}
  .lp-price-row{display:flex;flex-wrap:wrap;justify-content:center;gap:28px;margin-top:30px}
  .lp-price-block{background:#fff;border:1px solid var(--line);border-radius:15px;padding:26px 38px;min-width:250px}
  .lp-price-big{display:block;font-size:52px;font-weight:800;color:var(--navy);line-height:1}
  .lp-price-big sup{font-size:24px;top:-16px;position:relative}
  .lp-price-label{display:block;text-transform:uppercase;letter-spacing:.07em;font-size:12px;
    font-weight:700;color:var(--red);margin-bottom:8px}
  .lp-price-sub{display:block;color:var(--muted);font-size:14px;margin-top:8px}

  .lp-proof{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center}
  .lp-proof img{border-radius:15px;box-shadow:0 20px 44px rgba(0,0,0,.26)}
  .lp-proof h2{margin-top:0}

  .lp-foot{background:#0b1020;color:#93A2C4;text-align:center;padding:30px 0;font-size:14px}
  .lp-foot a{color:#fff}

  /* Sticky call bar: on a phone the thumb is at the bottom of the screen */
  .lp-sticky{position:fixed;left:0;right:0;bottom:0;z-index:60;display:none;
    background:var(--red);color:#fff;text-align:center;padding:15px;font-weight:800;
    text-decoration:none;font-size:17px;box-shadow:0 -6px 20px rgba(0,0,0,.28)}

  @media (max-width:900px){
    .lp-hero .lp-wrap{grid-template-columns:1fr;padding:40px 0 48px;gap:30px}
    .lp-proof{grid-template-columns:1fr}
    .lp-two{grid-template-columns:1fr}
    .lp-chips{grid-template-columns:1fr}
    .lp-sec{padding:52px 0}
    .lp-sticky{display:block}
    .lp-foot{padding-bottom:80px}
    .lp-bar img{height:42px}
    .lp-call{padding:11px 16px;font-size:14px}
  }`;
}

const CHALLENGES = [
  ["Aggression and reactivity", "Lunging, growling, or biting turns every walk and every visitor into a risk you have to manage."],
  ["Leash pulling", "A dog who drags you down the street makes the walk something you start skipping."],
  ["Barking and jumping", "The door, the mail, the neighbour. Noise you apologise for and guests you brace for."],
  ["A new puppy", "Potty training, crating, chewing, and biting hands. The habits set now are the ones you live with."],
  ["No recall", "A dog who will not come when called is a safety problem the moment a door is left open."]
];

const WHY = [
  ["Trainers certified at our HQ", "Cleveland is where Lorenzo's began. Trainers from across the country come here to certify — and your dog trains at that same facility."],
  ["Harley McGrew and Brady DeRemer", "Two named Northeast Ohio trainers, not a call centre. Your evaluation is with a person who works this area."],
  ["Owner coaching built in", "The dog learns and so do you. Handoff lessons are part of every program, because results have to survive after we leave."],
  ["Board &amp; train on campus", "Your dog lives and learns on site, then comes home with real skills and an owner handoff."],
  ["A written 90-day guarantee", "We put the promise in writing. Most trainers do not."]
];

const quizHead = `<div class="lp-quiz-head">
            <p>Tell us about your dog and request your free evaluation in <em>under 30 seconds</em>.</p>
          </div>
          <div class="lp-progress" aria-hidden="true"><span data-lp-bar></span></div>`;

const page = `<!DOCTYPE html>
<html lang="en">
${newHead}</head>
<body class="lp">

  <header class="lp-bar">
    <div class="lp-wrap">
      <img src="assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team">
      <a class="lp-call" href="tel:${TEL}">&#9742; Call: ${PHONE}</a>
    </div>
  </header>

  <section class="lp-hero">
    <div class="lp-hero-bg" style="background-image:url('assets/facility-exterior-main.jpg')"></div>
    <div class="lp-wrap">
      <div>
        <h1>Expert Dog Training in Cleveland &amp; Northeast Ohio</h1>
        <div class="lp-rule"></div>
        <p class="lp-pain">Feeling overwhelmed by aggression, biting, leash pulling, or a dog who simply will not listen?</p>
        <p class="lp-gain">Take back your walks, your front door, and your living room &mdash; with trainers certified at our 17,000 sq ft Cleveland headquarters.</p>
        <ul class="lp-trust">
          <li>&#9733; 600+ Google reviews</li>
          <li>17,000 sq ft HQ</li>
          <li>90-day guarantee</li>
          <li>Free evaluation</li>
        </ul>
      </div>

      <div class="lp-quiz" id="quiz">
        ${quizHead}
        <form class="contact-intake lp-form"
          action="https://formsubmit.co/production@lorenzosdogtrainingteam.com"
          method="POST"
          data-google-form-endpoint="https://docs.google.com/forms/d/e/1FAIpQLSdV1-0yBlRusq9tkjymZKm_BfXfpmMKDDrcyqfP3KbEq-Qd_g/formResponse"
          data-office-email="production@lorenzosdogtrainingteam.com"
          data-email-endpoint="https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com"
          data-form-type="market-ad-form"
          data-conversion-event="ldtt_market_ad_lead_submit">

          <div class="lp-step" data-lp-step="0">
            <span class="lp-q">What breed is your pup?</span>
            <input type="text" name="dog_breed" placeholder="Example: German Shepherd, mixed breed, not sure" autocomplete="off">
            <p class="lp-err" data-lp-err></p>
          </div>

          <div class="lp-step" data-lp-step="1" hidden>
            <span class="lp-q">What is the main thing going on?</span>
            <div class="lp-chips" role="group">
              <button type="button" class="lp-chip" aria-pressed="false" data-val="Dog behavior modification" data-note="Aggression or reactivity">Aggression or reactivity</button>
              <button type="button" class="lp-chip" aria-pressed="false" data-val="Dog obedience training" data-note="Leash pulling or will not listen">Leash pulling / will not listen</button>
              <button type="button" class="lp-chip" aria-pressed="false" data-val="Dog behavior modification" data-note="Barking or jumping">Barking or jumping</button>
              <button type="button" class="lp-chip" aria-pressed="false" data-val="Puppy training" data-note="New puppy">New puppy</button>
              <button type="button" class="lp-chip" aria-pressed="false" data-val="Specialty, service, or protection training" data-note="Specialty, service, or protection">Specialty or service dog</button>
              <button type="button" class="lp-chip" aria-pressed="false" data-val="Not sure yet" data-note="Not sure yet">Something else</button>
            </div>
            <p class="lp-err" data-lp-err></p>
            <button type="button" class="lp-back" data-lp-back>Back</button>
          </div>

          <div class="lp-step" data-lp-step="2" hidden>
            <span class="lp-q">Anything you want the trainer to know?</span>
            <textarea name="comments" rows="3" placeholder="Example: pulls hard on the leash, barks at every visitor, growls at other dogs"></textarea>
            <p class="lp-fineprint">Optional. Skip it if you would rather talk it through on the call.</p>
            <p class="lp-err" data-lp-err></p>
            <button type="button" class="lp-back" data-lp-back>Back</button>
          </div>

          <div class="lp-step" data-lp-step="3" hidden>
            <span class="lp-q">Where should the trainer reach you?</span>
            <div class="lp-two">
              <label class="lp-field"><span>First name</span><input type="text" required name="first_name" autocomplete="given-name"></label>
              <label class="lp-field"><span>Last name</span><input type="text" required name="last_name" autocomplete="family-name"></label>
            </div>
            <label class="lp-field"><span>Phone number</span><input type="tel" required name="phone" autocomplete="tel" inputmode="tel"></label>
            <label class="lp-field"><span>Email address</span><input type="email" required name="email" autocomplete="email"></label>
            <label class="lp-field"><span>ZIP code</span><input type="text" required name="zip" autocomplete="postal-code" inputmode="numeric"></label>

            <select required name="i_want_to" class="lp-offscreen" tabindex="-1" aria-label="What do you need help with">
              <option value="">Select one</option>
              <option>Schedule an in person evaluation with a trainer in my area</option>
              <option>Schedule an online consultation</option>
              <option>Dog obedience training</option>
              <option>Dog behavior modification</option>
              <option>Puppy training</option>
              <option>Specialty, service, or protection training</option>
              <option>Not sure yet</option>
            </select>

            <label class="lp-consent">
              <input type="checkbox" name="sms_consent" value="yes">
              <span>By checking this box, I agree to receive recurring promotional and informational text messages from Lorenzo's Dog Training Team about dog training, consultation scheduling, follow-up, and offers. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the <a href="terms.html">Terms of Service</a> and <a href="privacy-policy.html">Privacy Policy</a>.</span>
            </label>
            <p class="form-disclaimer lp-fineprint">Phone is required so Lorenzo's office can call about your request. SMS consent is optional and separate from submitting this form.</p>
            <p class="lp-err" data-lp-err></p>
            <button type="button" class="lp-back" data-lp-back>Back</button>
          </div>

          ${hidden}
          <div class="form-status" role="status" aria-live="polite"></div>
          <button type="button" class="lp-next" data-lp-next>NEXT &rarr;</button>
        </form>
      </div>
    </div>
  </section>

  <section class="lp-sec lp-center">
    <div class="lp-wrap">
      <h2>Achieve lifelong results with real obedience training</h2>
      <p class="lead">During your free evaluation a local trainer looks at your dog, your home, and what is actually going wrong &mdash; then builds a program around it. No obligation, no pressure, no charge.</p>
    </div>
  </section>

  <section class="lp-sec lp-sec--tint">
    <div class="lp-wrap lp-price">
      <p class="kicker">Most trainers make you call for a quote.</p>
      <h2>We&rsquo;ll just tell you.</h2>
      <div class="lp-price-row">
        <div class="lp-price-block">
          <span class="lp-price-label">Professional training</span>
          <span class="lp-price-big"><sup>$</sup>1,250</span>
          <span class="lp-price-sub">starting at &middot; obedience, behavior &amp; puppy programs</span>
        </div>
        <div class="lp-price-block">
          <span class="lp-price-label">Board &amp; train</span>
          <span class="lp-price-big"><sup>$</sup>2,500</span>
          <span class="lp-price-sub">starting at &middot; your dog lives and learns on campus</span>
        </div>
      </div>
    </div>
  </section>

  <section class="lp-band">
    <div class="lp-wrap">
      <h2>Ready to fix it?</h2>
      <p>Book the free evaluation. It takes under 30 seconds.</p>
      <button class="lp-btn" type="button" data-lp-jump>Get My Free Evaluation</button>
      <small>Virtual or in-home options available</small>
    </div>
  </section>

  <section class="lp-sec">
    <div class="lp-wrap lp-center">
      <h2>Common challenges Cleveland dog owners bring us</h2>
      <p class="lead">If you recognise your dog here, this is fixable &mdash; and it is what we do every day.</p>
      <div class="lp-cards">
        ${CHALLENGES.map(([h, p], i) => `<article class="lp-card"><span class="lp-num">${i + 1}</span><h3>${h}</h3><p>${p}</p></article>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="lp-sec lp-sec--tint">
    <div class="lp-wrap lp-proof">
      <img src="assets/market-photos/lorenzo-pack-down-stay.jpg" alt="Lorenzo Miller surrounded by more than twenty trained dogs, every one of them holding a calm down-stay on the grass" loading="lazy" decoding="async">
      <div>
        <h2>This is what trained looks like.</h2>
        <p class="lead" style="margin-left:0">Twenty-plus dogs. Every one holding a down-stay, off command, at the same time. That is not a trick &mdash; it is obedience that holds under pressure, which is the whole point of the work.</p>
      </div>
    </div>
  </section>

  <section class="lp-sec">
    <div class="lp-wrap lp-center">
      <h2>Why Cleveland families choose Lorenzo&rsquo;s</h2>
      <div class="lp-cards">
        ${WHY.map(([h, p]) => `<article class="lp-card"><h3>${h}</h3><p>${p}</p></article>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="lp-band">
    <div class="lp-wrap">
      <h2>Your free evaluation is waiting</h2>
      <p>Tell us about your dog. A local trainer takes it from there.</p>
      <button class="lp-btn" type="button" data-lp-jump>Get My Free Evaluation</button>
      <small>Or call <a href="tel:${TEL}" style="color:#fff">${PHONE}</a></small>
    </div>
  </section>

  <footer class="lp-foot">
    <div class="lp-wrap">
      &copy; Lorenzo's Dog Training Team. Serious Training. Serious Results.
      | <a href="tel:${TEL}">${PHONE}</a>
      | <a href="privacy-policy.html">Privacy</a>
      | <a href="terms.html">Terms</a>
    </div>
  </footer>

  <a class="lp-sticky" href="tel:${TEL}">&#9742; Call ${PHONE}</a>

  <script>
    /* Quiz stepper. The form stays one real <form> with every field in the DOM,
       so script.js wires it exactly like the live market form and the Supabase
       lead write is unchanged. This only controls which step is visible and
       refuses to advance until the current step is answered. */
    (function () {
      var form = document.querySelector('.contact-intake');
      if (!form) return;
      var steps = Array.prototype.slice.call(form.querySelectorAll('[data-lp-step]'));
      var next = form.querySelector('[data-lp-next]');
      var bar = document.querySelector('[data-lp-bar]');
      var intent = form.querySelector('[name="i_want_to"]');
      var breed = form.querySelector('[name="dog_breed"]');
      var notes = form.querySelector('[name="comments"]');
      var chosenNote = '';
      var at = 0;

      function show(i) {
        at = i;
        steps.forEach(function (s, n) { s.hidden = n !== i; });
        if (bar) bar.style.width = Math.round(((i + 1) / steps.length) * 100) + '%';
        next.textContent = i === steps.length - 1 ? 'GET MY FREE EVALUATION' : 'NEXT \\u2192';
        next.type = i === steps.length - 1 ? 'submit' : 'button';
        var focusable = steps[i].querySelector('input:not([type=hidden]),textarea,button.lp-chip');
        if (focusable && i > 0) { try { focusable.focus({ preventScroll: true }); } catch (e) {} }
      }

      function err(step, message) {
        var slot = step.querySelector('[data-lp-err]');
        if (slot) slot.textContent = message || '';
      }

      function valid(i) {
        var step = steps[i];
        err(step, '');
        if (i === 0) {
          if (!breed.value.trim()) { err(step, 'Tell us the breed, or just put "not sure".'); return false; }
          return true;
        }
        if (i === 1) {
          if (!intent.value) { err(step, 'Pick the one that fits best.'); return false; }
          return true;
        }
        if (i === 3) {
          var missing = Array.prototype.slice.call(step.querySelectorAll('input[required]'))
            .filter(function (el) { return !el.checkValidity(); });
          if (missing.length) {
            err(step, 'Please fill in your name, phone, email, and ZIP.');
            try { missing[0].focus(); } catch (e) {}
            return false;
          }
        }
        return true;
      }

      form.querySelectorAll('.lp-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          form.querySelectorAll('.lp-chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
          chip.setAttribute('aria-pressed', 'true');
          intent.value = chip.dataset.val;
          chosenNote = chip.dataset.note || '';
          err(steps[1], '');
        });
      });

      next.addEventListener('click', function (event) {
        if (!valid(at)) { event.preventDefault(); return; }
        if (at === steps.length - 1) return;   /* valid final step submits normally */
        event.preventDefault();
        show(at + 1);
      });

      form.querySelectorAll('[data-lp-back]').forEach(function (b) {
        b.addEventListener('click', function () { show(Math.max(0, at - 1)); });
      });

      /* Fold the quiz answers into the note the office actually reads, and make
         sure no earlier step is left invalid before the real handler runs. */
      form.addEventListener('submit', function (event) {
        for (var i = 0; i < steps.length; i++) {
          if (!valid(i)) { event.preventDefault(); event.stopImmediatePropagation(); show(i); return; }
        }
        var extra = [];
        if (breed.value.trim()) extra.push('Breed: ' + breed.value.trim() + '.');
        if (chosenNote) extra.push('Main concern: ' + chosenNote + '.');
        if (extra.length) {
          notes.value = [notes.value.trim(), extra.join(' ')].filter(Boolean).join('\\n\\n');
        }
      }, true);

      document.querySelectorAll('[data-lp-jump]').forEach(function (b) {
        b.addEventListener('click', function () {
          document.getElementById('quiz').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });

      show(0);
    })();
  </script>

${tail}</body>
</html>`;

writeFileSync(resolve(`${SLUG}.html`), page);
console.log(`generated ${SLUG}.html`);
