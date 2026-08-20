import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const markets = [
  {
    slug: "trainer-opportunity-cleveland-oh",
    market: "Cleveland / Akron, OH",
    city: "Cleveland",
    state: "OH",
    region: "Cleveland, Akron, Garfield Heights, Cleveland Heights, Streetsboro, and Northeast Ohio",
    nearby: ["Cleveland", "Akron", "Garfield Heights", "Cleveland Heights", "Streetsboro", "Northeast Ohio"],
    headline: "Build your dog training business in Cleveland and Akron.",
    signal: "Northeast Ohio has Lorenzo's headquarters support, local brand recognition, and a strong need for serious dog training."
  },
  {
    slug: "trainer-opportunity-columbus-oh",
    market: "Columbus / Reynoldsburg, OH",
    city: "Columbus",
    state: "OH",
    region: "Columbus, Reynoldsburg, Franklin County, Licking County, and Central Ohio",
    nearby: ["Columbus", "Reynoldsburg", "Franklin County", "Licking County", "Central Ohio"],
    headline: "Central Ohio needs more serious dog trainers.",
    signal: "Columbus gives the right candidate room to build a client base in one of Ohio's strongest family and pet markets."
  },
  {
    slug: "trainer-opportunity-atlanta-ga",
    market: "Atlanta, GA",
    city: "Atlanta",
    state: "GA",
    region: "Atlanta, Loganville, Dallas, North Georgia, and Metro Atlanta",
    nearby: ["Atlanta", "Loganville", "Dallas", "North Georgia", "Metro Atlanta"],
    headline: "Turn your drive into a dog training business in Atlanta.",
    signal: "Metro Atlanta is a high-demand market for motivated candidates who want structure, mentorship, and room to grow."
  },
  {
    slug: "trainer-opportunity-san-diego-ca",
    market: "San Diego, CA",
    city: "San Diego",
    state: "CA",
    region: "San Diego, North Park, Chula Vista, Mission Valley, and San Diego County",
    nearby: ["San Diego", "North Park", "Chula Vista", "Mission Valley", "San Diego County"],
    headline: "San Diego needs trainers who can deliver real-life results.",
    signal: "San Diego families need obedience, behavior modification, and specialty support from serious professional trainers."
  },
  {
    slug: "trainer-opportunity-san-antonio-tx",
    market: "San Antonio, TX",
    city: "San Antonio",
    state: "TX",
    region: "San Antonio, Castroville, Bear Creek, Bexar County, and Medina County",
    nearby: ["San Antonio", "Castroville", "Bear Creek", "Bexar County", "Medina County"],
    headline: "Build a dog training business in the San Antonio market.",
    signal: "San Antonio is built for candidates who are coachable, people-focused, and ready to serve families with structure."
  },
  {
    slug: "trainer-opportunity-chicago-il",
    market: "Chicago, IL",
    city: "Chicago",
    state: "IL",
    region: "Chicago, Northwest Indiana, Gary, the South Suburbs, and Chicagoland",
    nearby: ["Chicago", "Northwest Indiana", "Gary", "South Suburbs", "Chicagoland"],
    headline: "Bring Lorenzo's serious training path to Chicagoland.",
    signal: "The Chicago market needs trainers who can communicate with owners, handle dogs safely, and follow a proven system."
  },
  {
    slug: "trainer-opportunity-tallahassee-fl",
    market: "Tallahassee, FL",
    city: "Tallahassee",
    state: "FL",
    region: "Tallahassee, Leon County, North Florida, the Capital Region, and nearby communities",
    nearby: ["Tallahassee", "Leon County", "North Florida", "Capital Region", "Thomasville Area"],
    headline: "Start your professional dog training path in North Florida.",
    signal: "Tallahassee is a focused market for candidates ready to help families solve real behavior and obedience problems."
  },
  {
    slug: "trainer-opportunity-miramar-beach-fl",
    market: "Miramar Beach, FL",
    city: "Miramar Beach",
    state: "FL",
    region: "Miramar Beach, Destin, Santa Rosa Beach, 30A, Walton County, and the Emerald Coast",
    nearby: ["Miramar Beach", "Destin", "Santa Rosa Beach", "30A", "Emerald Coast"],
    headline: "The Emerald Coast needs committed professional dog trainers.",
    signal: "This market is a strong fit for candidates who want independence, client relationships, and the backing of a national team."
  },
  {
    slug: "trainer-opportunity-lexington-ky",
    market: "Lexington / Harrodsburg, KY",
    city: "Lexington",
    state: "KY",
    region: "Lexington, Harrodsburg, Mercer County, Central Kentucky, and the Bluegrass Region",
    nearby: ["Lexington", "Harrodsburg", "Mercer County", "Central Kentucky", "Bluegrass Region"],
    headline: "Build a dog training business in Central Kentucky.",
    signal: "Kentucky families need trainers who can bring clear communication, structure, and dependable follow-through."
  },
  {
    slug: "trainer-opportunity-ann-arbor-mi",
    market: "Ann Arbor, MI",
    city: "Ann Arbor",
    state: "MI",
    region: "Ann Arbor, Ypsilanti, Washtenaw County, Southeast Michigan, and Canton",
    nearby: ["Ann Arbor", "Ypsilanti", "Washtenaw County", "Southeast Michigan", "Canton"],
    headline: "Ann Arbor needs serious dog trainers with a real system.",
    signal: "Southeast Michigan is a strong opportunity for candidates who want to build skill, confidence, and a local client base."
  }
];

const cacheVersion = "20260818reviewcta";
const metaPixelId = "3790623554504010";

/* Meta pixel. Lives here, not hand-pasted into the built pages: it used to be
   added to the HTML by hand, so every regeneration of these ten recruiting
   pages silently deleted it and Meta stopped seeing the traffic. Emitting it
   from the generator means a rebuild restores it instead of removing it.
   Kept byte-identical to what the pages already ship. */
const metaPixelHead = () => `  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${metaPixelId}');
    fbq('track', 'PageView');
    document.addEventListener('submit', function(e){
      var f = e.target;
      if (!(f instanceof HTMLFormElement) || typeof fbq !== 'function') return;
      if (f.classList.contains('contact-intake')) fbq('track', 'Lead', { value: 250, currency: 'USD' });
      if (f.classList.contains('pdf-optin')) fbq('track', 'CompleteRegistration', { value: 25, currency: 'USD' });
    }, true);
  </script>
  <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1" alt=""></noscript>`;

const googleEndpoint = "https://docs.google.com/forms/d/e/1FAIpQLSdm5gkPQl4LwPVIGZZQbOGYA05le1xMUybMngJIyWKeDmlF5Q/formResponse";

const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

const page = market => {
  const title = `Become a Dog Trainer in ${market.market} | Lorenzo's Dog Training Team`;
  const description = `Explore Lorenzo's Dog Training Team's professional dog trainer opportunity in ${market.market}. Learn the system, earn certification, and build an independent dog training business with support.`;
  const url = `https://www.lorenzosdogtrainingteam.com/${market.slug}`;
  const nearbyLinks = market.nearby.map(place => `<span>${escapeHtml(place)}</span>`).join("");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: `Professional Dog Trainer Opportunity - ${market.market}`,
    description,
    hiringOrganization: {
      "@type": "Organization",
      name: "Lorenzo's Dog Training Team",
      sameAs: "https://www.lorenzosdogtrainingteam.com/"
    },
    employmentType: "CONTRACTOR",
    applicantLocationRequirements: {
      "@type": "Country",
      name: "United States"
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: market.city,
        addressRegion: market.state,
        addressCountry: "US"
      }
    },
    directApply: true,
    industry: "Professional dog training",
    occupationalCategory: "Dog Trainer"
  };
  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Is this a dog trainer job in ${market.market}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "This page is for candidates interested in Lorenzo's Dog Training Team's professional trainer opportunity. The pathway is positioned as an independent business owner track with training, certification, systems, and support."
        }
      },
      {
        "@type": "Question",
        name: "Is Lorenzo's Dog Training Team a franchise?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Lorenzo's public recruiting materials describe the opportunity as not a traditional franchise. It is a licensing-style model built around independence, training, brand support, and ongoing guidance."
        }
      },
      {
        "@type": "Question",
        name: "Do trainer candidates need to travel for training?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Candidates should be willing and able to travel for required training in Cleveland, Ohio if accepted."
        }
      }
    ]
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:image" content="https://www.lorenzosdogtrainingteam.com/assets/ldtt-team-cover.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" href="assets/ldtt-favicon.png">
  <link rel="apple-touch-icon" href="assets/ldtt-favicon.png">
  <link rel="stylesheet" href="styles.css?v=${cacheVersion}">
  <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
  <script type="application/ld+json">${JSON.stringify(faqData)}</script>
<!-- Meta pixel -->
${metaPixelHead()}
</head>
<body class="ad-funnel-redesign trainer-recruiting-ad" data-market="${escapeHtml(market.market)}">
  <header class="ad-header ad-header-v2">
    <div class="container ad-nav ad-nav-v2">
      <a class="ad-brand-v2" href="index.html" aria-label="Lorenzo's Dog Training Team home">
        <img class="logo" src="assets/lorenzo-logo-white.png" alt="Lorenzo's Dog Training Team">
        <span>Serious Training. Serious Results.</span>
      </a>
      <div class="ad-header-actions">
        <a class="btn btn-ghost-light" href="become-a-trainer.html">Learn More</a>
        <a class="btn btn-red" href="#trainer-interest">Start the Conversation</a>
      </div>
    </div>
  </header>

  <main>
    <section class="ad-hero-v2 trainer-recruiting-hero">
      <div class="trainer-campaign-bg" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <div class="container ad-hero-v2-grid">
        <div class="ad-hero-v2-copy">
          <span class="eyebrow">Trainer opportunity / ${escapeHtml(market.market)}</span>
          <h1>${escapeHtml(market.headline)}</h1>
          <p class="ad-lead">Learn the system, earn certification, and build a dog training business with Lorenzo's behind you.</p>
          <a class="trainer-hero-primary btn btn-red" href="#trainer-interest">Start the Conversation</a>
          <div class="ad-benefit-row">
            <span>Not a franchise</span>
            <span>320+ hour training path</span>
            <span>Mentorship and support</span>
          </div>
          <div class="trainer-recruiting-local-seo" aria-label="Recruiting areas near ${escapeHtml(market.market)}">${nearbyLinks}</div>
          <div class="trainer-recruiting-brief">
            <span>Opportunity brief</span>
            <strong>${escapeHtml(market.signal)}</strong>
          </div>
          <ul class="ad-checks-v2">
            <li>Learn dog behavior, safe handling, owner communication, and real-world training technique.</li>
            <li>Build a client base in ${escapeHtml(market.region)} with the support of an established national team.</li>
            <li>Join a mission built around keeping dogs out of shelters and in happy homes.</li>
          </ul>
        </div>

        <figure class="ad-hero-video-card">
          <div class="trainer-media-label"><span>Watch the work</span><strong>1:30</strong></div>
          <video controls preload="metadata" playsinline poster="assets/ldtt-recruitment-video-poster.jpg">
            <source src="assets/ldtt-recruitment-video.mp4" type="video/mp4">
          </video>
          <figcaption>
            <strong>Lorenzo's trainer pathway</strong>
            <span>Training, business structure, and long-term support</span>
          </figcaption>
        </figure>

        <figure class="trainer-team-moment">
          <img src="assets/trainer-ownership-photo.png" alt="A Lorenzo's trainer working directly with a dog and owner" width="900" height="700" decoding="async">
          <figcaption>
            <span>Established team</span>
            <strong>Built for people ready to represent the brand locally.</strong>
          </figcaption>
        </figure>

        <aside id="trainer-interest" class="ad-consult-panel">
          <div class="ad-consult-header">
            <span>${escapeHtml(market.market)}</span>
            <h2>Start the business conversation.</h2>
            <p>Tell recruiting where you want to build. The full application can follow after the first review.</p>
          </div>
          <form class="ad-form-card-v2 trainer-application-form"
            action="https://formsubmit.co/recruiting@lorenzosdogtrainingteam.com"
            method="POST"
            data-email-endpoint="https://formsubmit.co/ajax/recruiting@lorenzosdogtrainingteam.com"
            data-google-form-endpoint="${googleEndpoint}"
            data-form-type="trainer-recruiting-ad"
            data-conversion-event="ldtt_trainer_recruiting_ad_submit"
            data-success-message="Thank you, your trainer interest form was submitted. Lorenzo's recruiting team will review your information.">
            <input type="hidden" name="_subject" value="New trainer recruiting ad lead - ${escapeHtml(market.market)}">
            <input type="hidden" name="_template" value="table">
            <input type="hidden" name="_captcha" value="false">
            <input type="hidden" name="source_page" value="${escapeHtml(market.slug)}">
            <input type="hidden" name="source_form" value="trainer_opportunity">
            <input type="hidden" name="inquiry_type" value="discovery_call">
            <input type="hidden" name="opportunity_market" value="${escapeHtml(market.market)}">
            <input type="hidden" name="timestamp" value="">
            <input type="hidden" name="referral_source" value="Paid trainer recruiting ad">
            <input type="hidden" name="trainer_market" value="${escapeHtml(market.market)}">
            <input type="hidden" name="market_city" value="${escapeHtml(market.city)}">
            <input type="hidden" name="market_state" value="${escapeHtml(market.state)}">
            <input type="hidden" name="landing_page_type" value="Trainer recruiting ad page">
            <input type="hidden" name="address_line_2" value="">
            <input type="hidden" name="utm_landing_intent" value="become a dog trainer">
            <input type="hidden" name="ad_market" value="${escapeHtml(market.market)}">
            <div class="form-grid-two">
              <label>First Name<input required name="first_name" autocomplete="given-name"></label>
              <label>Last Name<input required name="last_name" autocomplete="family-name"></label>
            </div>
            <label>Email Address<input required type="email" name="email" autocomplete="email"></label>
            <label>Phone<input required name="phone" autocomplete="tel" inputmode="tel"></label>
            <small class="form-callback-disclosure">Phone is required so Lorenzo's recruiting team can call about your request. Promotional SMS consent below is optional and separate.</small>
            <div class="form-grid-three">
              <label>City<input required name="city" autocomplete="address-level2" value="${escapeHtml(market.city)}"></label>
              <label>State<input required name="state" autocomplete="address-level1" value="${escapeHtml(market.state)}"></label>
              <label>ZIP<input required name="zip" autocomplete="postal-code" inputmode="numeric"></label>
            </div>
            <label>What interests you about becoming a trainer?
              <textarea required name="additional_training" rows="4" placeholder="Tell us about your dog experience, business goals, sales experience, or why this path stands out."></textarea>
            </label>
            <fieldset class="form-fieldset">
              <legend>Are you willing to travel for required training in Cleveland, Ohio if accepted?</legend>
              <div class="radio-grid">
                <label class="choice-pill"><input type="radio" name="cleveland_training" value="Yes" required><span>Yes</span></label>
                <label class="choice-pill"><input type="radio" name="cleveland_training" value="Yes, but not for a while" required><span>Yes, but not for a while</span></label>
                <label class="choice-pill"><input type="radio" name="cleveland_training" value="No" required><span>No</span></label>
              </div>
            </fieldset>
            <label class="consent-row">
              <input required type="checkbox" name="application_certification" value="yes">
              <span>I understand this is an interest form and certify that the information provided is true.</span>
            </label>
            <label class="consent-row">
              <input type="checkbox" name="sms_consent" value="yes">
              <span>I agree to receive recurring calls or text messages from Lorenzo's recruiting team about this opportunity. Messages may be sent via autodialer. Consent is not a condition of purchase. Message frequency varies; message and data rates may apply. Reply STOP to unsubscribe and HELP for help. See our <a href="terms.html">Terms</a> and <a href="privacy-policy.html">Privacy Policy</a>.</span>
            </label>
            <div class="form-status" role="status" aria-live="polite"></div>
            <button class="btn btn-red" type="submit">Start My Trainer Path</button>
            <small>No obligation. Recruiting reviews your location, background, and readiness before the full application step.</small>
          </form>
        </aside>
      </div>
    </section>

    <section class="ad-proof-band-v2">
      <div class="container ad-proof-grid-v2">
        <div><strong>1987</strong><span>Founded / incorporated</span></div>
        <div><strong>320+</strong><span>Training hours</span></div>
        <div><strong>50+</strong><span>Trainers nationwide</span></div>
        <div><strong>${escapeHtml(market.state)}</strong><span>Recruiting market</span></div>
      </div>
    </section>

    <section class="section ad-path-section-v2">
      <div class="container">
        <div class="section-title left">
          <h2>Build skill. Build clients. Build a real dog training business.</h2>
          <p>${escapeHtml(market.signal)} Lorenzo's gives serious candidates a structured path to learn the craft, understand the business, and represent the brand with professional standards.</p>
        </div>
        <div class="ad-service-grid-v2">
          <article><span>01</span><h3>Learn the Technique</h3><p>Study dog behavior, timing, handling, obedience, behavior modification, and how to communicate the work clearly to owners.</p></article>
          <article><span>02</span><h3>Build the Business</h3><p>Develop your client base, understand owner conversations, and learn how to operate with professional standards in your market.</p></article>
          <article><span>03</span><h3>Stay Supported</h3><p>Work independently while staying connected to brand standards, recruiting support, office systems, and a national trainer network.</p></article>
        </div>
      </div>
    </section>

    <section class="section trainer-recruiting-conversion">
      <div class="container trainer-recruiting-conversion-grid">
        <div>
          <h2>The opportunity is bigger than training dogs.</h2>
          <p>Lorenzo's Dog Training Team is built for candidates who want to learn a proven system, work with owners, develop skill, recruit interest in their local market, and build a dog training business with an established brand behind them.</p>
          <div class="trainer-recruiting-mini-proof">
            <strong>Not a franchise</strong>
            <strong>Hands-on training</strong>
            <strong>National brand support</strong>
            <strong>Local client opportunity</strong>
          </div>
        </div>
        <aside>
          <h3>Best-fit business builder signals</h3>
          <ul>
            <li>Entrepreneurial and self-starting</li>
            <li>Comfortable speaking with clients and selling value</li>
            <li>Ready to work with dogs of different breeds and temperaments</li>
            <li>Willing to follow standards, coaching, and a proven process</li>
          </ul>
          <a class="btn btn-red" href="#trainer-interest">Start the Conversation</a>
        </aside>
      </div>
    </section>

    <section class="ad-how-v2">
      <div class="container ad-how-grid-v2">
        <div>
          <h2>What recruiting looks for.</h2>
          <p>This opportunity is for coachable, motivated people who can work with dogs, guide owners, sell value, and follow a proven business-building system.</p>
        </div>
        <ol>
          <li><strong>Self-starting and entrepreneurial</strong><span>You want ownership, not just hourly work.</span></li>
          <li><strong>Comfortable with people</strong><span>You can explain, listen, sell, coach, and build trust.</span></li>
          <li><strong>Ready for real dog work</strong><span>You can handle dogs of different sizes, breeds, temperaments, and behavior challenges.</span></li>
          <li><strong>Willing to train in Cleveland</strong><span>The pathway requires hands-on work, classroom learning, testing, and mentorship.</span></li>
        </ol>
      </div>
    </section>

    <section class="section trainer-market-reviews" data-approved-market-reviews data-review-destination="${escapeHtml(market.slug.replace(/^trainer-opportunity-/, ""))}" hidden>
      <div class="container">
        <div class="section-title">
          <span class="eyebrow">Office-approved stories</span>
          <h2>What people say about Lorenzo's opportunity.</h2>
        </div>
        <div class="trainer-market-review-grid" data-approved-market-review-grid></div>
      </div>
    </section>

    <section class="section trainer-recruiting-faq">
      <div class="container">
        <div class="section-title">
          <h2>Before you apply.</h2>
        </div>
        <div class="trainer-recruiting-faq-grid">
          <article><h3>Is this a regular dog trainer job?</h3><p>No. The page is written for candidates interested in becoming a professional trainer through Lorenzo's certification and independent business owner pathway.</p></article>
          <article><h3>Do I need dog experience?</h3><p>Dog experience helps, but recruiting also looks for communication, organization, sales ability, coachability, physical readiness, and comfort working with owners.</p></article>
          <article><h3>What market is this page for?</h3><p>This page is focused on ${escapeHtml(market.region)} so recruiting outreach can match the local opportunity with the candidate's area.</p></article>
        </div>
      </div>
    </section>

    <section class="section tight">
      <div class="container">
        <div class="cta-band ad-cta-v2">
          <div>
            <h2>Interested in the ${escapeHtml(market.market)} opportunity?</h2>
            <p>Start with the short form so recruiting can review your location, background, and readiness.</p>
          </div>
          <a class="btn btn-red" href="#trainer-interest">Start the Conversation</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer ad-footer">
    <div class="container subfooter">&copy; Lorenzo's Dog Training Team. Serious Training. Serious Results. | <a href="trainer-application.html">Full Trainer Application</a></div>
  </footer>

  <script src="supabase-config.js"></script>
  <script src="script.js?v=${cacheVersion}"></script>
</body>
</html>`;
};

for (const market of markets) {
  writeFileSync(resolve(`${market.slug}.html`), page(market));
  console.log(`generated ${market.slug}.html`);
}
