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
      var fr = m.querySelector("iframe");
      if (fr) fr.remove(); // a YouTube frame keeps playing unless it is removed
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
      var url = t.getAttribute("data-video");
      var card = document.querySelector("#m-video .mcard");
      var v = document.querySelector("#m-video video");
      var old = document.querySelector("#m-video iframe");
      if (old) old.remove();
      // Arrison 2026-09-16: a YouTube address plays in a YouTube frame; anything else is a plain video file.
      var yt = url.match(/^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
      if (yt) {
        v.hidden = true;
        v.removeAttribute("src");
        var fr = document.createElement("iframe");
        fr.src = "https://www.youtube-nocookie.com/embed/" + yt[1] + "?autoplay=1&rel=0";
        fr.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        fr.setAttribute("allowfullscreen", "");
        fr.style.cssText = "width:100%;aspect-ratio:16/9;border:0;display:block";
        card.appendChild(fr);
        open("m-video");
        return;
      }
      v.hidden = false;
      v.src = url;
      open("m-video");
      v.play().catch(function () {});
      return;
    }
    open("m-" + t.getAttribute("data-open"));
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

  // Joshua 2026-09-16: street address, city and state are required (the trainer comes to the home), in plain words.
  var WHY = {
    address: "Please add your street address so the trainer knows where to come.",
    city: "Please add your city.",
    state: "Please pick your state.",
    zip: "Please add your 5-digit ZIP code.",
    phone: "Please add a phone number with 10 digits.",
    email: "Please add an email address that looks like name@example.com."
  };

  // Meeting 2026-09-16: every required box wears a red asterisk, placed right after the label's words.
  function markRequired(root) {
    root.querySelectorAll("label").forEach(function (label) {
      var control = null;
      for (var i = 0; i < label.children.length; i += 1) {
        var c = label.children[i];
        if ((c.tagName === "INPUT" || c.tagName === "SELECT" || c.tagName === "TEXTAREA") && c.required && c.type !== "checkbox" && c.type !== "radio") { control = c; break; }
      }
      if (!control || label.querySelector(".required-mark")) return;
      var text = null;
      for (var j = 0; j < label.childNodes.length; j += 1) {
        var n = label.childNodes[j];
        if (n.nodeType === 3 && n.textContent.trim()) { text = n; break; }
      }
      if (!text) return;
      var mark = document.createElement("span");
      mark.className = "required-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "*";
      text.parentNode.insertBefore(mark, text.nextSibling);
    });
  }
  markRequired(document);

  // Joshua 2026-09-17: every box that is NOT required says "(optional)" after the label's words.
  // Skips checkboxes, radios, hidden/submit controls, and labels that already say "optional".
  function markOptional(root) {
    root.querySelectorAll("label").forEach(function (label) {
      var control = null;
      for (var i = 0; i < label.children.length; i += 1) {
        var c = label.children[i];
        if (c.tagName === "INPUT" || c.tagName === "SELECT" || c.tagName === "TEXTAREA") { control = c; break; }
      }
      if (!control || control.required || control.disabled) return;
      if (/^(checkbox|radio|hidden|submit|button|reset|file|image|range|color)$/.test(control.type || "")) return;
      if (label.querySelector(".required-mark, .optional-mark") || /optional/i.test(label.textContent)) return;
      var text = null;
      for (var j = 0; j < label.childNodes.length; j += 1) {
        var n = label.childNodes[j];
        if (n.nodeType === 3 && n.textContent.trim()) { text = n; break; }
      }
      if (!text) return;
      var mark = document.createElement("span");
      mark.className = "optional-mark";
      mark.textContent = "(optional)";
      text.parentNode.insertBefore(mark, text.nextSibling);
    });
  }
  markOptional(document);

  function validate(form, status) {
    var bad = null;
    form.querySelectorAll("[required]").forEach(function (el) {
      var v = String(el.value || "").trim();
      var ok = v !== "" && (el.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      if (el.type === "tel" && ok) ok = v.replace(/\D/g, "").length >= 10;
      if (el.name === "zip" && ok) ok = /^\d{5}(-?\d{4})?$/.test(v);
      el.setAttribute("aria-invalid", ok ? "false" : "true");
      if (!ok && !bad) bad = el;
    });
    if (bad) {
      status.className = "fstatus wide err";
      status.textContent = WHY[bad.name] || "Please check the highlighted box.";
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

  var qs = new URLSearchParams(location.search);

  function sendEbook(form, status, button) {
    var f = form.elements;
    var payload = {
      lead_kind: "ebook",
      first_name: f.first_name.value.trim(),
      last_name: f.last_name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      zip: f.zip ? f.zip.value.trim() : "",
      sms_consent: !!(f.sms_consent && f.sms_consent.checked),
      source_page: location.origin + location.pathname,
      utm_source: qs.get("utm_source") || "",
      utm_medium: qs.get("utm_medium") || "",
      utm_campaign: qs.get("utm_campaign") || ""
    };
    button.disabled = true;
    say(status, "busy", "Sending…");
    fetch(form.getAttribute("data-endpoint"), { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload) })
      .then(function (res) { return res.json().catch(function () { return null; }).then(function (data) { return { res: res, data: data || {} }; }); })
      .then(function (r) {
        if (!r.res.ok || r.data.ok !== true) throw new Error(r.data.message || ("HTTP " + r.res.status));
        var dl = form.querySelector(".bdl");
        if (dl) dl.click();
        say(status, "done", "Thank you, " + payload.first_name + ". Your free guide is downloading." + (payload.sms_consent ? " We will text you a link to book your free evaluation." : ""));
        form.querySelectorAll("input, button[type=submit]").forEach(function (el) { el.disabled = true; });
      })
      .catch(function (err) {
        button.disabled = false;
        say(status, "err", (err && err.message) || "We could not send that. Please try again or call (866) 436-4959.");
      });
  }

  function sendEvaluation(form, status, button) {
    var f = form.elements;
    var payload = {
      first_name: f.first_name.value.trim(),
      last_name: f.last_name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      address: f.address ? f.address.value.trim() : "", // Joshua 2026-09-16: the full address rides with the lead
      city: f.city ? f.city.value.trim() : "",
      state: f.state ? f.state.value : "",
      zip: f.zip.value.trim(),
      problem: f.problem.value,
      dog_name: f.dog_name.value.trim(),
      sms_consent: !!f.sms_consent.checked,
      // Joshua 2026-09-23: the trainer the visitor picked under the ZIP box travels with the lead. Same two names
      // the trainer pages send, so the pipeline routes this lead to that trainer.
      trainer_slug: f.trainer_slug ? f.trainer_slug.value : "",
      assigned_trainer: f.assigned_trainer ? f.assigned_trainer.value : "",
      source_page: location.origin + location.pathname,
      // Joshua 2026-09-23 (old ad pages get the 2.0 flow): the ad click's UTM tags ride with the lead
      // like they always did on the old market forms. Server-side cleanLeadIntake already accepts them.
      utm_source: qs.get("utm_source") || "",
      utm_medium: qs.get("utm_medium") || "",
      utm_campaign: qs.get("utm_campaign") || ""
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

  // Joshua 2026-09-15: phone digits format themselves as (216) 816-8026 while the visitor types,
  // and extra digits are dropped instead of the field silently cutting the number off.
  document.addEventListener("input", function (event) {
    var el = event.target;
    if (!el || el.tagName !== "INPUT" || el.name !== "phone") return;
    var d = String(el.value).replace(/[^0-9]/g, "");
    while (d.length > 10 && d.charAt(0) === "1") d = d.slice(1);
    d = d.slice(0, 10);
    el.value = d.length > 6 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : d.length > 3 ? "(" + d.slice(0, 3) + ") " + d.slice(3) : d;
  }, true);

  // Joshua 2026-09-23: "the trainers should appear when the ZIP code is typed on the page." As soon as the ZIP
  // box holds 5 digits the form asks GET /api/booking?zip=<zip> (rule 74: every listed trainer within 50 miles,
  // nearest first) and draws each answer as a real <label> + <input type=radio> card, so picking one works with
  // the keyboard and without any JavaScript styling tricks. The pick rides along with the lead (sendEvaluation).
  function trainerPicker(form) {
    var box = form.querySelector("[data-trainer-pick]");
    var zipField = form.elements ? form.elements.zip : null;
    if (!box || !zipField) return;
    var endpoint = box.getAttribute("data-endpoint") || "";
    if (!endpoint) return; // the Page Studio preview asks nothing
    var list = box.querySelector(".tnear-list");
    var msg = box.querySelector(".tnear-msg");
    var sub = box.querySelector(".tnear-sub");
    var slugField = form.elements.trainer_slug;
    var nameField = form.elements.assigned_trainer;
    var owner = String(box.getAttribute("data-owner") || "").toLowerCase();
    var wait = parseInt(box.getAttribute("data-debounce"), 10);
    if (!(wait >= 0 && wait <= 5000)) wait = 400;
    var LOADING = box.getAttribute("data-loading") || "Looking for trainers near you…";
    var EMPTY = box.getAttribute("data-empty") || "We do not have a trainer within 50 miles of that ZIP yet. Send the form and our office will call you.";
    var timer = null;
    var seq = 0;         // only the newest answer is drawn: a slow reply for an older ZIP is ignored
    var askedZip = "";

    function choose(slug, name) {
      if (slugField) slugField.value = slug || "";
      if (nameField) nameField.value = name || "";
      list.querySelectorAll(".tcard").forEach(function (label) {
        var on = label.getAttribute("data-slug") === slug;
        label.classList.toggle("on", on);
        var radio = label.querySelector("input[type=radio]");
        if (radio) radio.checked = on;
      });
    }

    function clearPick() { choose("", ""); }

    function note(text) {
      msg.textContent = text || "";
      msg.hidden = !text;
    }

    function card(t) {
      var label = document.createElement("label");
      label.className = "tcard";
      label.setAttribute("data-slug", t.slug);
      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "trainer_pick";
      radio.value = t.slug;
      radio.className = "tc-radio";
      label.appendChild(radio);
      var photo = String(t.photo || "");
      if (photo) {
        var img = document.createElement("img");
        img.className = "tc-photo";
        img.src = photo;
        img.alt = "";
        img.width = 54;
        img.height = 54;
        img.loading = "lazy";
        label.appendChild(img);
      } else {
        var blank = document.createElement("span");
        blank.className = "tc-photo tc-blank";
        blank.setAttribute("aria-hidden", "true");
        blank.textContent = String(t.name || "?").charAt(0);
        label.appendChild(blank);
      }
      var text = document.createElement("span");
      text.className = "tc-txt";
      var name = document.createElement("span");
      name.className = "tc-name";
      name.textContent = String(t.name || t.slug);
      text.appendChild(name);
      if (t.market) {
        var market = document.createElement("span");
        market.className = "tc-meta";
        market.textContent = String(t.market);
        text.appendChild(market);
      }
      var miles = document.createElement("span");
      miles.className = "tc-meta tc-miles";
      miles.textContent = (t.miles == null ? "" : t.miles) + " mi away";
      text.appendChild(miles);
      if (t.calendar) {
        var cal = document.createElement("span");
        cal.className = "tc-cal";
        cal.textContent = "Online calendar";
        text.appendChild(cal);
      }
      label.appendChild(text);
      return label;
    }

    function draw(trainers) {
      var keep = slugField ? slugField.value : "";
      list.textContent = "";
      if (!trainers.length) {
        sub.hidden = true;
        clearPick();
        note(EMPTY);
        return;
      }
      sub.hidden = false;
      note("");
      trainers.forEach(function (t) { list.appendChild(card(t)); });
      var slugs = trainers.map(function (t) { return t.slug; });
      // the page's own market trainer is picked first when they are in the answer; otherwise the nearest card
      var pick = slugs.indexOf(keep) > -1 ? keep : (owner && slugs.indexOf(owner) > -1 ? owner : slugs[0]);
      var chosen = trainers[slugs.indexOf(pick)];
      choose(pick, chosen ? (chosen.name || pick) : pick);
    }

    function ask(zip) {
      var mine = ++seq;
      box.hidden = false;
      sub.hidden = true;
      list.textContent = "";
      note(LOADING);
      fetch(endpoint + "?zip=" + encodeURIComponent(zip), { headers: { "Accept": "application/json" } })
        .then(function (res) { return res.json().catch(function () { return null; }); })
        .then(function (data) {
          if (mine !== seq) return; // a newer ZIP was typed while this answer was on its way
          draw(data && Array.isArray(data.trainers) ? data.trainers : []);
        })
        .catch(function (err) {
          if (mine !== seq) return;
          clearPick();
          sub.hidden = true;
          note(EMPTY);
          if (window.console) console.warn("[LDTT] trainers near ZIP failed:", err && (err.message || err));
        });
    }

    function look() {
      var zip = String(zipField.value || "").replace(/\D/g, "").slice(0, 5);
      if (zip.length < 5) {
        seq += 1;
        askedZip = "";
        box.hidden = true;
        list.textContent = "";
        note("");
        clearPick();
        return;
      }
      if (zip === askedZip) return;
      askedZip = zip;
      ask(zip);
    }

    zipField.addEventListener("input", function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(look, wait); // debounce: wait until the typing stops
    });
    zipField.addEventListener("change", function () { if (timer) clearTimeout(timer); look(); });
    list.addEventListener("change", function (event) {
      var radio = event.target.closest ? event.target.closest("input[type=radio]") : null;
      if (!radio) return;
      var label = radio.closest(".tcard");
      choose(radio.value, label ? (label.querySelector(".tc-name") || {}).textContent : "");
    });
    look(); // a ZIP the browser filled in already counts
  }

  // Joshua 2026-09-23 (re-engage invite): a link like /ads/pensacola?zip=32507 lands with the
  // visitor's ZIP already filled in, so the trainers near them appear the moment the form opens.
  var presetZip = String(qs.get("zip") || "").replace(/\D/g, "").slice(0, 5);

  document.querySelectorAll("form.lead").forEach(function (form) {
    if (presetZip.length === 5 && form.elements && form.elements.zip && !String(form.elements.zip.value || "").trim()) {
      form.elements.zip.value = presetZip;
    }
    trainerPicker(form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".fstatus");
      var button = form.querySelector("button[type=submit]");
      if (button.disabled || !validate(form, status)) return;
      if (form.getAttribute("data-kind") === "evaluation" && form.getAttribute("data-endpoint")) {
        sendEvaluation(form, status, button);
        return;
      }
      // Joshua 2026-09-30: the free-guide (e-book) form is a real lead now - first + last name, phone, email and the
      // optional SMS box go through the same door as the evaluation form (/api/booking-lead, lead_kind "ebook").
      // With SMS consent the pipeline texts the booking link and the follow-ups run; the guide downloads either way.
      if (form.getAttribute("data-kind") === "ebook" && form.getAttribute("data-endpoint")) {
        sendEbook(form, status, button);
        return;
      }
      // Page Studio preview (no endpoint): nothing leaves the page
      say(status, "ok", "Preview: nothing was sent. On the live page this request goes straight to Lorenzo's office.");
      button.disabled = true;
    });
  });
})();
