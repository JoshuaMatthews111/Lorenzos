(function () {
  "use strict";

  const isAdPage = document.body.classList.contains("ad-funnel-redesign")
    || document.body.classList.contains("market-funnel-redesign")
    || document.body.classList.contains("market-landing");
  if (!isAdPage) return;

  const marketName = document.body.dataset.market || "Nationwide";
  const pageTitle = document.title || "Lorenzo's Dog Training Team";
  const pageUrl = window.location.href;
  const ebookTitle = "The 5-Step Calm Dog Blueprint";
  const ebookUrl = "assets/calm-dog-blueprint-final.pdf";
  const pageSlug = window.location.pathname.split("/").pop()?.replace(/\.html$/i, "") || "get-started";
  const functionsBaseUrl = window.LDTT_SUPABASE?.functionsBaseUrl || "";
  const search = new URLSearchParams(window.location.search);
  const isReleaseQaHost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) || /\.vercel\.app$/i.test(window.location.hostname);
  const startedAt = Date.now();
  const isStandaloneAdPage = !document.body.classList.contains("market-landing");
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
    const key = "ldttAdLandingSession";
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(key, value);
    }
    return value;
  })();

  const trackStandaloneAdEvent = (eventType, extra = {}) => {
    if (!isStandaloneAdPage || !functionsBaseUrl) return;
    const payload = {
      event_id: `${isReleaseQaHost ? "qa-release-" : ""}${crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
      event_type: eventType,
      qa: isReleaseQaHost,
      trainer_slug: pageSlug,
      assigned_trainer: "Office market page",
      trainer_market: marketName,
      trainer_city: marketName.split(",")[0]?.trim() || "",
      trainer_state: marketName.split(",")[1]?.trim() || "",
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: window.location.pathname,
      page_url: window.location.href,
      landing_page_type: "Paid ads market page",
      ad_market: marketName,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      utm_source: search.get("utm_source") || "",
      utm_medium: search.get("utm_medium") || "",
      utm_campaign: search.get("utm_campaign") || "",
      gclid: search.get("gclid") || "",
      gbraid: search.get("gbraid") || "",
      wbraid: search.get("wbraid") || "",
      market_landing: true,
      timestamp: new Date().toISOString(),
      ...extra
    };
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
      // Analytics must never interrupt the advertising funnel.
    }
  };

  trackStandaloneAdEvent("market_page_view");
  if (isStandaloneAdPage) {
    let sentTimeEvent = false;
    const sendTimeEvent = () => {
      if (sentTimeEvent) return;
      sentTimeEvent = true;
      trackStandaloneAdEvent("market_page_time", {
        time_on_page_seconds: Math.round((Date.now() - startedAt) / 1000)
      });
    };
    window.addEventListener("pagehide", sendTimeEvent);
  }

  document.querySelectorAll("[data-video-cover]").forEach((cover) => {
    const frame = cover.closest(".ad-video-frame");
    const video = frame?.querySelector("video");
    if (!frame || !video) return;

    cover.addEventListener("click", async () => {
      frame.classList.add("is-playing");
      try {
        await video.play();
      } catch {
        video.controls = true;
      }
    });

    video.addEventListener("play", () => frame.classList.add("is-playing"));
  });

  const buildLeadPayload = (form, source) => {
    const data = new FormData(form);
    const submissionId = `${isReleaseQaHost ? "qa-release-" : "ebook-"}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const marketCity = document.querySelector('[name="market_city"]')?.value || marketName.split(",")[0]?.trim() || "";
    const marketState = document.querySelector('[name="market_state"]')?.value || marketName.split(",")[1]?.trim() || "";
    return {
      submission_id: submissionId,
      qa: isReleaseQaHost,
	      first_name: String(data.get("first_name") || "").trim(),
	      last_name: String(data.get("last_name") || "").trim() || "Ebook Lead",
	      email: String(data.get("email") || "").trim(),
	      phone: String(data.get("phone") || "").trim() || "Not provided - PDF opt-in",
	      zip: String(data.get("zip") || "").trim(),
	      additional_interest: data.getAll("additional_interest").map(value => String(value).trim()).filter(Boolean).join(", "),
	      i_want_to: `Send me ${ebookTitle}`,
	      lead_type: "pdf_download",
	      heard_about_us: "Paid Advertising",
	      comments: `${source} from ${marketName}. This PDF opt-in collected first name and email only${data.getAll("additional_interest").length ? `. Additional interest: ${data.getAll("additional_interest").join(", ")}.` : "."}`,
      address_line_1: "Free Ebook Request",
      address_line_2: "",
      city: marketCity,
      state: marketState,
      trainer_name: "Lorenzo's Office",
      assigned_trainer: "Lorenzo's Office",
      trainer_market: marketName,
      ad_market: marketName,
      trainer_city: marketCity,
      trainer_state: marketState,
      landing_page_type: "Paid ads market page",
      source_page: pageTitle,
      page_url: pageUrl,
	      timestamp: new Date().toISOString(),
	      lead_magnet: ebookTitle,
	      utm_source: search.get("utm_source") || "",
	      utm_medium: search.get("utm_medium") || "",
	      utm_campaign: search.get("utm_campaign") || "",
	      utm_content: search.get("utm_content") || "",
	      utm_term: search.get("utm_term") || "",
	      gclid: search.get("gclid") || "",
	      gbraid: search.get("gbraid") || "",
	      wbraid: search.get("wbraid") || "",
	      landing_url: pageUrl,
	      market: marketName,
      _subject: `New ${ebookTitle} request - ${marketName}`,
      _template: "table",
      _captcha: "false"
    };
  };

  const submitSupabaseLead = async (payload) => {
    if (window.LDTT_FORM_DELIVERY?.submitCanonical) {
      return window.LDTT_FORM_DELIVERY.submitCanonical("submit-contact", payload);
    }
    const base = window.LDTT_SUPABASE?.functionsBaseUrl;
    if (!window.LDTT_SUPABASE?.enabled || !base) throw new Error("The live office connection is unavailable.");
    const response = await fetch(`${base.replace(/\/$/, "")}/submit-contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Supabase lead save failed");
    return result;
  };

  const relayBackups = async (payload, canonical, form) => {
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

  const deliverEbookLead = async (form, source) => {
    const payload = buildLeadPayload(form, source);
    const canonical = await submitSupabaseLead(payload);
    if (!canonical?.lead_id && !canonical?.application_id) throw new Error("The live office record could not be confirmed.");
    await relayBackups(payload, canonical, form);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "ldtt_ebook_lead_submit",
      market: marketName,
      zip: payload.zip,
      submission_id: payload.submission_id
    });
    trackStandaloneAdEvent("market_form_submit", {
      time_on_page_seconds: Math.round((Date.now() - startedAt) / 1000)
    });
    return payload;
  };

  document.querySelectorAll(".market-guide-form").forEach((form) => {
    if (form.dataset.adFunnelGuideBound === "true") return;
    form.dataset.adFunnelGuideBound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const button = form.querySelector("button");
      const status = form.querySelector(".market-guide-status");
      const original = button?.textContent || "Download the Free Guide";
      if (button) {
        button.disabled = true;
        button.textContent = "Sending...";
      }
      if (status) {
        status.textContent = "";
        status.classList.remove("is-success");
      }

      try {
        await deliverEbookLead(form, "Free Ebook Request");
        if (status) {
          status.textContent = "Thank you. Your request is saved and your free Ebook is ready.";
          status.classList.add("is-success");
        }
        const download = form.querySelector(".market-guide-download");
        if (download) {
          download.href = ebookUrl;
          download.classList.add("is-ready");
          download.removeAttribute("aria-hidden");
        }
        form.reset();
      } catch {
        if (status) status.textContent = "We could not send that just yet. Please try again.";
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }
      }
    });
  });

	  const bookingStartedKey = `ldttBookingStarted:${pageSlug}`;
	  const hasStartedBookingForm = () => sessionStorage.getItem(bookingStartedKey) === "yes"
	    || Array.from(document.querySelectorAll(".contact-intake input, .contact-intake select, .contact-intake textarea"))
	      .some(control => control.type === "checkbox" ? control.checked : String(control.value || "").trim());
	  document.querySelectorAll(".contact-intake input, .contact-intake select, .contact-intake textarea").forEach(control => {
	    control.addEventListener("input", () => sessionStorage.setItem(bookingStartedKey, "yes"), { once: true });
	    control.addEventListener("change", () => sessionStorage.setItem(bookingStartedKey, "yes"), { once: true });
	  });

	  const showExitCapture = () => {
	    if (sessionStorage.getItem("ldttAdExitCaptureShown") === "yes") return;
	    if (hasStartedBookingForm()) return;
	    sessionStorage.setItem("ldttAdExitCaptureShown", "yes");

    let modal = document.querySelector(".ad-capture-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "ad-capture-modal";
      modal.innerHTML = `
        <div class="ad-capture-modal-card" role="dialog" aria-modal="true" aria-label="Free dog training ebook">
          <button class="ad-capture-close" type="button" aria-label="Close">×</button>
	          <span>Free PDF Guide</span>
	          <h2>Not ready to talk yet? Get the free guide.</h2>
	          <p>Join Lorenzo's training tips list and receive <strong>${ebookTitle}</strong> with practical steps you can start today.</p>
	          <form class="market-guide-form ad-exit-form pdf-optin" novalidate>
	            <label><span>First name</span><input required name="first_name" autocomplete="given-name" placeholder="First name"></label>
	            <label><span>Email address</span><input required type="email" name="email" autocomplete="email" placeholder="you@example.com"></label>
            <label class="consent-row sms-opt-in"><input type="checkbox" name="sms_consent" value="yes"><span>By checking this box, I agree to receive recurring promotional and informational text messages from Lorenzo's Dog Training Team about dog training tips, consultation scheduling, follow-up, and offers. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the <a href="/terms.html">Terms of Service</a> and <a href="/privacy-policy.html">Privacy Policy</a>.</span></label>
          <button class="btn" type="submit">Download the Free Guide</button>
            <p class="market-guide-status" role="status" aria-live="polite"></p>
          </form>
          <button class="ad-capture-secondary" type="button">No thanks, continue browsing</button>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector(".ad-capture-close")?.addEventListener("click", () => modal.classList.remove("open"));
      modal.querySelector(".ad-capture-secondary")?.addEventListener("click", () => modal.classList.remove("open"));
      modal.addEventListener("click", (event) => {
        if (event.target === modal) modal.classList.remove("open");
      });

      const form = modal.querySelector(".ad-exit-form");
      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const button = form.querySelector("button");
        const status = form.querySelector(".market-guide-status");
        button.disabled = true;
        button.textContent = "Sending...";
        status.textContent = "";
        try {
          await deliverEbookLead(form, "Exit Ebook Request");
          status.textContent = "Thank you. Your request is saved and your free Ebook is ready.";
          status.classList.add("is-success");
          window.open(ebookUrl, "_blank", "noopener");
          form.reset();
          setTimeout(() => modal.classList.remove("open"), 1300);
        } catch {
          status.textContent = "We could not send that just yet. Please try again.";
          status.classList.remove("is-success");
        } finally {
          button.disabled = false;
          button.textContent = "Download the Free Guide";
        }
      });
    }

    modal.classList.add("open");
  };

	  document.addEventListener("mouseleave", (event) => {
	    if (event.clientY <= 0) showExitCapture();
	  });
	})();
