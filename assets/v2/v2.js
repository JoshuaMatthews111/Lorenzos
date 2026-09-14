/* LDTT ad pages 2.0 — sandbox behaviour.
   The evaluation form posts to the SANDBOX booking flow (data-endpoint on the form).
   The booklet form still sends nothing. */
(function () {
  var lastFocus = null;
  var PHONE = "866.436.4959";

  function open(id) {
    var m = document.getElementById(id);
    if (!m) return;
    lastFocus = document.activeElement;
    m.hidden = false;
    document.body.style.overflow = "hidden";
    var f = m.querySelector("input, select, video, button.mclose");
    if (f) setTimeout(function () { f.focus(); }, 30);
  }

  function closeAll() {
    document.querySelectorAll(".modal").forEach(function (m) {
      if (m.hidden) return;
      m.hidden = true;
      var v = m.querySelector("video");
      if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
    });
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open],[data-video],[data-close]");
    if (!t) {
      if (e.target.classList && e.target.classList.contains("modal")) closeAll();
      return;
    }
    if (t.hasAttribute("data-close")) { closeAll(); return; }
    e.preventDefault();
    if (t.hasAttribute("data-video")) {
      var v = document.querySelector("#m-video video");
      v.src = t.getAttribute("data-video");
      open("m-video");
      v.play().catch(function () {});
      return;
    }
    open("m-" + t.getAttribute("data-open"));
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

  function validate(form, status) {
    var bad = null;
    form.querySelectorAll("[required]").forEach(function (el) {
      var v = el.value.trim();
      var ok = v !== "" && (el.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      if (el.type === "tel" && ok) ok = v.replace(/\D/g, "").length >= 10;
      if (el.name === "zip" && ok) ok = /^\d{5}(-?\d{4})?$/.test(v);
      el.setAttribute("aria-invalid", ok ? "false" : "true");
      if (!ok && !bad) bad = el;
    });
    if (bad) {
      status.className = "fstatus wide err";
      status.textContent = "Please check the highlighted box.";
      bad.focus();
    }
    return !bad;
  }

  function say(status, cls, text) {
    status.className = "fstatus wide " + cls;
    status.textContent = text;
  }

  function safeUrl(u) {
    try {
      var url = new URL(u, location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (e) { return ""; }
  }

  function sendEvaluation(form, status, button) {
    var f = form.elements;
    var payload = {
      first_name: f.first_name.value.trim(),
      last_name: f.last_name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      zip: f.zip.value.trim(),
      problem: f.problem.value,
      dog_name: f.dog_name.value.trim(),
      sms_consent: !!f.sms_consent.checked,
      source_page: location.origin + location.pathname
    };
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    button.disabled = true;
    say(status, "busy", "Sending…");

    fetch(form.getAttribute("data-endpoint"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        var data = r.data || {};
        if (!r.res.ok || data.ok !== true) {
          var err = new Error(data.error || data.message || ("HTTP " + r.res.status));
          err.http = r.res.status;
          throw err;
        }
        var next = data.book_url ? safeUrl(data.book_url) : "";
        if (next) {
          say(status, "done", "Thank you. Taking you to pick a time with your trainer…");
          location.assign(next);
          return;
        }
        // trainer_slug null (or no booking page yet): a person routes this lead
        say(status, "done", "Thank you, " + payload.first_name + ". We got your request. The office will call you to set up your free evaluation.");
        form.querySelectorAll("input, select, button[type=submit]").forEach(function (el) { el.disabled = true; });
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        button.disabled = false;
        var why = err && err.name === "AbortError" ? "It took too long to answer." :
          err && err.http ? "The booking system answered with an error (" + err.http + ")." :
          "The booking system could not be reached.";
        say(status, "err", "We could not send your request. " + why + " Your answers are still here, so you can try again, or call " + PHONE + ".");
        if (window.console) console.warn("[LDTT sandbox] booking-lead failed:", err && (err.message || err));
      });
  }

  document.querySelectorAll("form.lead").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".fstatus");
      var button = form.querySelector("button[type=submit]");
      if (button.disabled || !validate(form, status)) return;
      if (form.getAttribute("data-kind") === "evaluation" && form.getAttribute("data-endpoint")) {
        sendEvaluation(form, status, button);
        return;
      }
      // booklet form: sandbox preview, nothing leaves the page
      say(status, "ok", "Sandbox preview: nothing was sent. On the live page this request goes straight to Lorenzo's office.");
      button.disabled = true;
    });
  });
})();
