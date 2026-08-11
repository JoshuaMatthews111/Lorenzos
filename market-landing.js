(function () {
  "use strict";

  const landing = document.querySelector(".market-landing");
  const hero = document.querySelector(".market-hero");
  const proofBand = document.querySelector(".ad-proof-band-v2");
  const consultation = document.querySelector(".market-consult-panel");
  if (!landing || !hero || !proofBand || !consultation) return;
  document.body.classList.add("market-funnel-redesign");

  const marketName = document.body.dataset.market || "your area";
  const marketCopy = document.querySelector(".market-copy");
  const pageSlug = window.location.pathname.split("/").pop()?.replace(/\.html$/i, "") || "get-started";
  const functionsBaseUrl = window.LDTT_SUPABASE?.functionsBaseUrl || "";
  const isReleaseQaHost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) || /\.vercel\.app$/i.test(window.location.hostname);
  const visitorId = (() => {
    const key = "ldttAnonymousVisitorId";
    let value = localStorage.getItem(key);
    if (!value) {
      value = crypto?.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(key, value);
    }
    return value;
  })();
  const sessionId = (() => {
    const key = "ldttMarketLandingSession";
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(key, value);
    }
    return value;
  })();
  const startedAt = Date.now();
  const utm = new URLSearchParams(window.location.search);
  const trackMarketEvent = (eventType, extra = {}) => {
    const payload = {
      event_id: `${isReleaseQaHost ? "qa-release-" : ""}${crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
      event_type: eventType,
      qa: isReleaseQaHost,
      trainer_slug: pageSlug,
      assigned_trainer: document.querySelector('[name="assigned_trainer"]')?.value || "Office market page",
      trainer_market: marketName,
      trainer_city: document.querySelector('[name="market_city"]')?.value || marketName.split(",")[0]?.trim() || "",
      trainer_state: document.querySelector('[name="market_state"]')?.value || marketName.split(",")[1]?.trim() || "",
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: window.location.pathname,
      page_url: window.location.href,
      landing_page_type: "Paid ads market page",
      ad_market: marketName,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      utm_source: utm.get("utm_source") || "",
      utm_medium: utm.get("utm_medium") || "",
      utm_campaign: utm.get("utm_campaign") || "",
      gclid: utm.get("gclid") || "",
      gbraid: utm.get("gbraid") || "",
      wbraid: utm.get("wbraid") || "",
      market_landing: true,
      timestamp: new Date().toISOString(),
      ...extra
    };
    if (!functionsBaseUrl) return;
    const url = `${functionsBaseUrl.replace(/\/$/, "")}/track-site-event`;
    try {
      if (eventType === "market_page_time" && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: "application/json" }));
        return;
      }
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: eventType === "market_page_time"
      }).catch(() => {});
    } catch {
      // Tracking must never block the advertising page or form delivery.
    }
  };

  trackMarketEvent("market_page_view");

  const heroTitle = marketCopy?.querySelector("h1");
  const heroLead = marketCopy?.querySelector(".ad-lead");
  if (heroTitle) {
    heroTitle.textContent = `Dog problems in ${marketName}? Start here.`;
  }
	  if (heroLead) {
	    heroLead.textContent =
	      "Watch a real client result, then request a free, no-obligation evaluation so the office can route the right next step for your dog.";
	  }

  document.querySelectorAll(".market-side-rail").forEach((node) => node.remove());
  const heroGrid = hero.querySelector(".market-hero-grid");
  let heroMedia = hero.querySelector(".market-hero-media");
  if (!heroMedia && heroGrid) {
    heroMedia = document.createElement("figure");
    heroMedia.className = "market-hero-media";
    heroGrid.insertBefore(heroMedia, consultation);
  }
  if (heroMedia) {
    heroMedia.classList.add("ad-hero-video-card");
    heroMedia.innerHTML = `
      <div class="ad-video-frame">
        <button class="ad-video-cover" type="button" data-video-cover aria-label="Play real client results video">
          <img src="assets/ad-testimonial-take-1-cover.png" alt="Real client results video cover" loading="eager" decoding="async">
          <span class="video-bubble">Real Client Results</span>
          <span class="video-play-mark" aria-hidden="true">▶</span>
        </button>
        <video controls preload="metadata" poster="assets/ad-testimonial-take-1-cover.png" playsinline>
          <source src="assets/ad-testimonial-take-1.mp4" type="video/mp4">
        </video>
      </div>
      <figcaption>
	        <strong>See the result. Book the right next step.</strong>
	        <span>Real family. Real client results.</span>
      </figcaption>
    `;
  }
  consultation.dataset.successMessage =
    "Thank you for choosing Lorenzo's. You and your dog matter to us. Your request was received and Lorenzo's office will reach out with the next step.";

  if (marketCopy && !marketCopy.querySelector(".market-hero-actions")) {
    const actions = document.createElement("div");
    actions.className = "market-hero-actions";
    actions.innerHTML = `
      <a class="btn market-primary-cta" href="#consultation">Book My Consultation</a>
      <a class="market-text-link" href="#market-services">Explore training options <span aria-hidden="true">&darr;</span></a>
    `;
    marketCopy.appendChild(actions);
  }
  if (marketCopy && !marketCopy.querySelector(".ad-issue-strip")) {
    const issueStrip = document.createElement("div");
    issueStrip.className = "ad-issue-strip";
    issueStrip.setAttribute("aria-label", "Common dog training problems");
    issueStrip.innerHTML = `
      <span>Leash pulling</span>
      <span>Barking</span>
      <span>Jumping</span>
      <span>House-soiling</span>
      <span>Reactivity</span>
    `;
    const benefits = marketCopy.querySelector(".ad-benefit-row");
    benefits?.insertAdjacentElement("afterend", issueStrip);
  }
	  marketCopy?.querySelector(".challenge-guide-card")?.remove();
  const consultHeader = consultation.querySelector(".ad-consult-header p");
  if (consultHeader) {
    consultHeader.textContent = "Tell us what is going on with your dog. The office routes the request and follows up with the next step.";
  }
	  const consultTitle = consultation.querySelector(".ad-consult-header h2");
	  if (consultTitle) {
	    consultTitle.textContent = "Book your free, no-obligation evaluation.";
	  }
	  const submitButton = consultation.querySelector('button[type="submit"]');
	  if (submitButton) {
	    submitButton.textContent = "Book My Consultation";
	  }
  const consultSmall = consultation.querySelector("form small");
  if (consultSmall) {
    consultSmall.textContent = "Securely sent to Lorenzo's production office with market attribution. No full address required to start.";
  }
	  consultation.querySelector('input[name="lead_magnet"]')?.remove();

  consultation.classList.add("market-hero-consult-panel");
  consultation.querySelector("form")?.addEventListener("submit", () => {
    trackMarketEvent("market_form_submit", { time_on_page_seconds: Math.round((Date.now() - startedAt) / 1000) });
  }, { capture: true });

  const services = document.querySelector(".market-service-paths");
  if (services) services.id = "market-services";

  const careSection = document.createElement("section");
  careSection.className = "market-care-section section";
  careSection.innerHTML = `
    <div class="container market-care-grid">
      <div>
        <span class="eyebrow">You and your dog matter</span>
        <h2>Clear training. Real support. A better life together.</h2>
      </div>
      <div class="market-care-copy">
        <p>There is no one-size-fits-all dog. We begin by understanding your household, your goals, and the behavior you are living with every day.</p>
        <a class="btn btn-secondary" href="#consultation">Book My Consultation</a>
      </div>
    </div>
  `;

  const testimonialSection = document.createElement("section");
  testimonialSection.className = "market-testimonial-section section";
  testimonialSection.innerHTML = `
    <div class="container">
      <div class="market-section-heading">
        <span class="eyebrow">Trusted by dog owners</span>
        <h2>Training built for life beyond the lesson.</h2>
      </div>
      <div class="market-testimonial-grid">
        <article><div class="market-proof-icon" aria-hidden="true">01</div><h3>Clear owner guidance</h3><p>Owners value trainers who explain the process, demonstrate the technique, and build confident leadership at home.</p></article>
        <article><div class="market-proof-icon" aria-hidden="true">02</div><h3>A plan that fits real life</h3><p>The evaluation considers the dog, the household, current behavior, and the goals that matter most to the family.</p></article>
        <article><div class="market-proof-icon" aria-hidden="true">03</div><h3>Results beyond the lesson</h3><p>Training focuses on dependable behavior at home, on walks, around distractions, and throughout everyday life.</p></article>
      </div>
    </div>
  `;

	  const guideSection = document.createElement("section");
	  guideSection.id = "free-ebook";
	  guideSection.className = "market-guide-section market-guide-strip section";
	  guideSection.innerHTML = `
	    <div class="container market-guide-card market-guide-mini">
	      <div>
	        <span class="eyebrow">Free PDF Guide</span>
	        <h2>Not ready to talk yet? Get the free guide.</h2>
	        <p><strong>The 5-Step Calm Dog Blueprint</strong> gives owners a simple daily foundation for focus, obedience, and calmer behavior before problems get worse.</p>
	      </div>
	      <form class="market-guide-form pdf-optin" novalidate>
	        <label><span>First name</span><input name="first_name" autocomplete="given-name" placeholder="First name" required></label>
	        <label><span>Email address</span><input type="email" name="email" autocomplete="email" placeholder="you@example.com" required></label>
        <label class="consent-row sms-opt-in"><input type="checkbox" name="sms_consent" value="yes"><span>By checking this box, I agree to receive recurring promotional and informational text messages from Lorenzo's Dog Training Team about dog training tips, consultation scheduling, follow-up, and offers. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the <a href="/terms.html">Terms of Service</a> and <a href="/privacy-policy.html">Privacy Policy</a>.</span></label>
        <a class="market-guide-download" href="assets/calm-dog-blueprint-final.pdf" download aria-hidden="true" tabindex="-1">Download the Free Guide</a>
        <button class="btn" type="submit">Download the Free Guide</button>
        <p class="market-guide-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  `;

  const insertTarget = document.querySelector(".market-office-route") || document.querySelector(".section.tight");
  if (insertTarget) {
    insertTarget.insertAdjacentElement("beforebegin", careSection);
    insertTarget.insertAdjacentElement("beforebegin", testimonialSection);
    insertTarget.insertAdjacentElement("beforebegin", guideSection);
  }

  const submitMarketLead = (payload) => {
    if (window.LDTT_FORM_DELIVERY?.submitCanonical) {
      return window.LDTT_FORM_DELIVERY.submitCanonical("submit-contact", payload);
    }
    if (!functionsBaseUrl) return Promise.reject(new Error("The live office connection is unavailable."));
    return fetch(`${functionsBaseUrl.replace(/\/$/, "")}/submit-contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async response => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "The live office record could not be saved.");
      return result;
    });
  };

  const relayMarketLead = async (payload, canonical, form) => {
    if (window.LDTT_FORM_DELIVERY?.relay) {
      return window.LDTT_FORM_DELIVERY.relay("contact", payload, canonical, form);
    }
    const response = await fetch("/api/form-delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form_type: "contact", entries: payload, canonical })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.message || "Backup delivery could not be logged.");
    return result;
  };

  const guideForm = guideSection.querySelector(".market-guide-form");
  if (guideForm) guideForm.dataset.adFunnelGuideBound = "true";
  guideForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (guideForm.dataset.submitting === "true") return;
    if (!guideForm.reportValidity()) return;
    const formData = new FormData(guideForm);
    const submissionId = `${isReleaseQaHost ? "qa-release-" : "ebook-"}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const firstName = String(formData.get("first_name") || "").trim();
    const lastName = String(formData.get("last_name") || "").trim();
    const additionalInterest = formData.getAll("additional_interest").map(value => String(value).trim()).filter(Boolean).join(", ");
	    const payload = {
	      submission_id: submissionId,
	      qa: isReleaseQaHost,
	      first_name: firstName,
	      last_name: lastName || "Ebook Lead",
	      email: String(formData.get("email") || "").trim(),
	      phone: String(formData.get("phone") || "").trim() || "Not provided - PDF opt-in",
	      zip: String(formData.get("zip") || "").trim(),
	      i_want_to: "Download the free 5-step calm dog blueprint",
	      service_interest: "Free ebook download",
	      lead_type: "pdf_download",
	      heard_about_us: "Paid ads market page",
	      vet_or_previous_client: "Free ebook landing page",
	      comments: `Requested immediate download of The 5-Step Calm Dog Blueprint from ${marketName}. This PDF opt-in collected first name and email only.${additionalInterest ? ` Additional interest: ${additionalInterest}.` : ""}`,
      additional_interest: additionalInterest,
      trainer_name: document.querySelector('[name="trainer_name"]')?.value || "",
      assigned_trainer: document.querySelector('[name="assigned_trainer"]')?.value || "Office market page",
      trainer_market: marketName,
      trainer_city: document.querySelector('[name="market_city"]')?.value || marketName.split(",")[0]?.trim() || "",
      trainer_state: document.querySelector('[name="market_state"]')?.value || marketName.split(",")[1]?.trim() || "",
      trainer_slug: document.querySelector('[name="trainer_slug"]')?.value || "",
      landing_page_type: "Paid ads market page",
      lead_magnet: "The 5-Step Calm Dog Blueprint",
      page_url: window.location.href,
      source_page: pageSlug,
	      timestamp: new Date().toISOString(),
	      utm_source: utm.get("utm_source") || "",
	      utm_medium: utm.get("utm_medium") || "",
	      utm_campaign: utm.get("utm_campaign") || "",
	      utm_content: utm.get("utm_content") || "",
	      utm_term: utm.get("utm_term") || "",
	      gclid: utm.get("gclid") || "",
	      gbraid: utm.get("gbraid") || "",
	      wbraid: utm.get("wbraid") || "",
	      landing_url: window.location.href,
      delivery_local: "saved",
      delivery_email: "pending",
      delivery_supabase: functionsBaseUrl ? "pending" : "not_connected"
    };
    const status = guideForm.querySelector(".market-guide-status");
    const button = guideForm.querySelector('button[type="submit"]');
    guideForm.dataset.submitting = "true";
    button?.setAttribute("disabled", "disabled");
    if (status) status.textContent = "Submitting securely...";
    try {
      const canonical = await submitMarketLead(payload);
      if (!canonical?.lead_id && !canonical?.application_id) throw new Error("The live office record could not be confirmed.");
      await relayMarketLead(payload, canonical, guideForm);
      trackMarketEvent("market_ebook_download", { submission_id: submissionId, time_on_page_seconds: Math.round((Date.now() - startedAt) / 1000) });
      guideForm.querySelector(".market-guide-download")?.click();
      if (status) status.textContent = "Thank you. Your request is saved and your free Ebook is ready.";
    } catch (error) {
      if (status) status.textContent = error.message || "We could not send that just yet. Please try again.";
    } finally {
      window.setTimeout(() => {
        guideForm.reset();
        delete guideForm.dataset.submitting;
        button?.removeAttribute("disabled");
      }, 800);
    }
  });

  let sentTimeEvent = false;
  const sendTimeEvent = () => {
    if (sentTimeEvent) return;
    sentTimeEvent = true;
    trackMarketEvent("market_page_time", { time_on_page_seconds: Math.round((Date.now() - startedAt) / 1000) });
  };
  window.addEventListener("pagehide", sendTimeEvent);
  window.addEventListener("beforeunload", sendTimeEvent);

})();
