// The booking page, mobile-first (portal chain step 2, DO-NOT-BREAK rule 71).
// Trainer photo, name, market -> mock calendar (real free times from Google, read-only)
// -> the eval form (Rachel's 11 Alpha fields, more dogs) -> confirmation.
// Everything the page shows comes from /api/booking; every value is escaped before it is drawn.
function renderBookingPage(slug, { practice = false } = {}) {
  const safeSlug = JSON.stringify(String(slug)).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Book your free evaluation | Lorenzo's Dog Training Team</title>
<link rel="icon" type="image/png" href="/assets/ldtt-favicon.png">
<style>
:root{--red:#d80f35;--ink:#15171a;--muted:#5d636b;--line:#e3e5e8;--bg:#f6f6f4;--card:#fff;--ok:#1d7a46}
*{box-sizing:border-box}
body{margin:0;font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
.practice-bar{background:#111;color:#fff;font-size:13px;text-align:center;padding:8px 12px}
.practice-bar strong{color:#ffcc00}
.top{background:#fff;border-bottom:1px solid var(--line);padding:10px 16px;display:flex;align-items:center;gap:10px}
.top img{height:34px;width:auto}
.wrap{max-width:720px;margin:0 auto;padding:16px 14px 48px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-bottom:14px}
.trainer{display:flex;gap:14px;align-items:center}
.trainer img{width:84px;height:84px;border-radius:50%;object-fit:cover;background:#ddd;flex:none;border:3px solid var(--red)}
.trainer h1{font-size:22px;margin:0 0 2px}
.trainer p{margin:0;color:var(--muted)}
.trainer .tag{display:inline-block;margin-top:6px;font-size:13px;font-weight:700;color:var(--red)}
h2{font-size:19px;margin:0 0 4px}
.hint{color:var(--muted);font-size:14px;margin:0 0 12px}
.steps{display:flex;gap:6px;list-style:none;padding:0;margin:0 0 14px;font-size:13px;color:var(--muted)}
.steps li{flex:1;text-align:center;padding:6px 4px;border-bottom:3px solid var(--line)}
.steps li.on{color:var(--ink);font-weight:700;border-color:var(--red)}
.days{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x mandatory}
.day{flex:none;scroll-snap-align:start;min-width:74px;border:1px solid var(--line);background:#fff;border-radius:12px;padding:8px 6px;text-align:center;font:inherit;cursor:pointer}
.day b{display:block;font-size:13px;color:var(--muted);font-weight:600}
.day span{display:block;font-size:18px;font-weight:800}
.day small{display:block;font-size:12px;color:var(--muted)}
.day[aria-pressed="true"]{border-color:var(--red);background:#fff1f3}
.times{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin-top:12px}
.time{min-height:46px;border:1px solid var(--line);background:#fff;border-radius:10px;font:inherit;font-weight:700;cursor:pointer}
.time:hover,.time:focus-visible{border-color:var(--red);outline:none}
.msg{margin:12px 0 0;color:var(--muted)}
.msg.err,.form-error{color:#b00020;font-weight:600}
.picked{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#fff1f3;border:1px solid #f5c2cc;border-radius:12px;padding:10px 12px;margin-bottom:14px}
.linkbtn{background:none;border:0;color:var(--red);font:inherit;font-weight:700;text-decoration:underline;cursor:pointer;padding:0}
fieldset{border:0;padding:0;margin:0 0 16px}
legend{font-weight:800;font-size:16px;margin-bottom:8px;padding:0}
.grid{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:560px){.grid.two{grid-template-columns:1fr 1fr}}
label{display:block;font-size:14px;font-weight:600}
label .req{color:var(--red)}
input,select,textarea{display:block;width:100%;margin-top:4px;font:inherit;padding:11px 12px;border:1px solid #c9cdd2;border-radius:10px;background:#fff;min-height:46px}
textarea{min-height:88px;resize:vertical}
input:focus,select:focus,textarea:focus{border-color:var(--red);outline:2px solid #ffd6de}
.dog{border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
.dog-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.choice{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px;font-weight:600;cursor:pointer}
.choice input{width:auto;min-height:0;margin:3px 0 0}
.choice small{display:block;font-weight:400;color:var(--muted)}
.btn{display:block;width:100%;min-height:52px;border:0;border-radius:12px;background:var(--red);color:#fff;font:inherit;font-weight:800;font-size:17px;cursor:pointer}
.btn[disabled]{opacity:.6;cursor:wait}
.btn-ghost{background:#fff;color:var(--ink);border:1px solid #c9cdd2;min-height:46px;font-size:15px;margin-bottom:14px}
.done{text-align:center}
.done .check{width:64px;height:64px;border-radius:50%;background:var(--ok);color:#fff;font-size:36px;line-height:64px;margin:0 auto 10px}
.done dl{text-align:left;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:16px 0}
.done dt{color:var(--muted)}
.done dd{margin:0;font-weight:700}
.skeleton{color:var(--muted)}
</style>
</head>
<body>
${practice ? `<div class="practice-bar"><strong>PRACTICE COPY</strong> · test booking. It is saved in the practice portal only and nothing is reserved in Google.</div>` : ""}
<div class="top"><img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"></div>
<main class="wrap">
  <section class="card trainer" id="trainerCard" aria-live="polite"><p class="skeleton">Loading the trainer…</p></section>
  <ol class="steps" id="steps"><li class="on">1. Pick a time</li><li>2. Your details</li><li>3. Done</li></ol>

  <section class="card" id="stepTime">
    <h2>Pick a time for your free evaluation</h2>
    <p class="hint" id="tzHint"></p>
    <div class="days" id="days" aria-label="Days"></div>
    <div class="times" id="times" aria-label="Times"></div>
    <p class="msg" id="calMsg"></p>
  </section>

  <section class="card" id="stepForm" hidden>
    <div class="picked"><span>Your time: <strong id="pickedLabel"></strong></span><button type="button" class="linkbtn" id="changeTime">Change</button></div>
    <form id="evalForm" novalidate>
      <fieldset>
        <legend>Your details</legend>
        <div class="grid two">
          <label>First name <span class="req">*</span><input name="first_name" autocomplete="given-name" required></label>
          <label>Last name <span class="req">*</span><input name="last_name" autocomplete="family-name" required></label>
          <label>Phone <span class="req">*</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label>
          <label>Email <span class="req">*</span><input name="email" type="email" autocomplete="email" required></label>
        </div>
        <label style="margin-top:10px">Physical address <span class="req">*</span><input name="address" autocomplete="street-address" placeholder="Street, city, state, ZIP" required></label>
      </fieldset>
      <fieldset id="locationBox" hidden>
        <legend>Where should the evaluation happen? <span class="req">*</span></legend>
        <label class="choice"><input type="radio" name="location" value="in_home"> <span>In-home<small>Your trainer comes to your address above.</small></span></label>
        <label class="choice"><input type="radio" name="location" value="training_center"> <span>Training center<small id="centerAddress"></small></span></label>
      </fieldset>
      <div id="dogs"></div>
      <button type="button" class="btn btn-ghost" id="addDog">+ Add another dog</button>
      <p class="form-error" id="formError" role="alert"></p>
      <button type="submit" class="btn" id="submitBtn">Book my free evaluation</button>
    </form>
  </section>

  <section class="card done" id="stepDone" hidden>
    <div class="check" aria-hidden="true">✓</div>
    <h2 id="doneTitle">You're booked!</h2>
    <dl id="doneList"></dl>
    <p class="hint">Our office will add you to our system, and your trainer will call you before the visit. Need to change it? Call (866) 436-4959.</p>
  </section>
</main>
<script>
(function () {
  "use strict";
  var SLUG = ${safeSlug};
  var params = new URLSearchParams(location.search);
  var LEAD = params.get("lead") || "";
  var data = null, picked = null, dayKey = "";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(sec, opts) { return new Date(sec * 1000).toLocaleString("en-US", Object.assign({ timeZone: data.time_zone }, opts)); }
  function keyOf(sec) { return new Date(sec * 1000).toLocaleDateString("en-CA", { timeZone: data.time_zone }); }
  function tzName() { try { return new Date().toLocaleTimeString("en-US", { timeZone: data.time_zone, timeZoneName: "long" }).split(" ").slice(2).join(" "); } catch (e) { return data.time_zone; } }
  function step(n) {
    $("stepTime").hidden = n !== 1; $("stepForm").hidden = n !== 2; $("stepDone").hidden = n !== 3;
    Array.prototype.forEach.call($("steps").children, function (li, i) { li.className = i === n - 1 ? "on" : ""; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderTrainer() {
    var t = data.trainer;
    $("trainerCard").innerHTML = (t.photo ? '<img src="' + esc(t.photo) + '" alt="' + esc(t.name) + '">' : "") +
      '<div><h1>' + esc(t.name) + '</h1><p>' + esc(t.market) + '</p><span class="tag">Free evaluation · ' + esc(data.slot_minutes) + ' minutes</span></div>';
    $("tzHint").textContent = "Times are shown in " + tzName() + ", " + t.first_name + "'s time zone.";
  }

  function renderDays() {
    var groups = {};
    data.slots.forEach(function (s) { var k = keyOf(s.start); (groups[k] = groups[k] || []).push(s); });
    var keys = Object.keys(groups).sort();
    if (data.calendar_error) { $("calMsg").textContent = data.calendar_error; $("calMsg").className = "msg err"; }
    else if (!keys.length) { $("calMsg").textContent = "No open times in the next two weeks. Please call (866) 436-4959 and we will fit you in."; }
    else $("calMsg").textContent = "";
    if (keys.indexOf(dayKey) === -1) dayKey = keys[0] || "";
    $("days").innerHTML = keys.map(function (k) {
      var first = groups[k][0].start;
      return '<button type="button" class="day" data-day="' + esc(k) + '" aria-pressed="' + (k === dayKey) + '"><b>' + esc(fmt(first, { weekday: "short" })) + '</b><span>' + esc(fmt(first, { day: "numeric" })) + '</span><small>' + esc(fmt(first, { month: "short" })) + ' · ' + groups[k].length + '</small></button>';
    }).join("");
    $("times").innerHTML = (groups[dayKey] || []).map(function (s) {
      return '<button type="button" class="time" data-start="' + s.start + '">' + esc(fmt(s.start, { hour: "numeric", minute: "2-digit" })) + '</button>';
    }).join("");
  }

  function dogBlock(i) {
    return '<div class="dog" data-dog="' + i + '"><div class="dog-head"><strong class="dog-title">Dog ' + (i + 1) + '</strong>' + (i > 0 ? '<button type="button" class="linkbtn" data-remove-dog>Remove</button>' : "") + '</div>' +
      '<div class="grid two">' +
      '<label>Dog name <span class="req">*</span><input data-f="name" required></label>' +
      '<label>Sex <span class="req">*</span><select data-f="sex" required><option value="">Choose</option><option>Male</option><option>Female</option></select></label>' +
      '<label>Spayed/Neutered? <span class="req">*</span><select data-f="fixed" required><option value="">Choose</option><option>Yes</option><option>No</option></select></label>' +
      '<label>Vaccinations up to date? <span class="req">*</span><select data-f="vaccinated" required><option value="">Choose</option><option>Yes</option><option>No</option></select></label>' +
      '<label>Age <span class="req">*</span><input data-f="age" placeholder="e.g. 2 years" required></label>' +
      '<label>Breed <span class="req">*</span><input data-f="breed" required></label>' +
      '</div><label style="margin-top:10px">Behavioral challenges <span class="req">*</span><textarea data-f="behavior" placeholder="What would you like help with?" required></textarea></label></div>';
  }
  function renumberDogs() {
    Array.prototype.forEach.call($("dogs").querySelectorAll(".dog"), function (el, i) { el.dataset.dog = i; el.querySelector(".dog-title").textContent = "Dog " + (i + 1); });
    $("addDog").hidden = $("dogs").querySelectorAll(".dog").length >= 6;
  }

  function prefill() {
    var f = $("evalForm");
    $("dogs").innerHTML = dogBlock(0);
    var l = data.lead || {};
    ["first_name", "last_name", "phone", "email", "address"].forEach(function (k) { if (l[k]) f.elements[k].value = l[k]; });
    if (l.dog_name) $("dogs").querySelector('[data-f="name"]').value = l.dog_name;
    var locs = data.locations || ["in_home"];
    $("locationBox").hidden = locs.length < 2;
    $("centerAddress").textContent = data.training_center_address || "";
  }

  function showDone(result) {
    $("doneTitle").textContent = "You're booked with " + data.trainer.first_name + "!";
    $("doneList").innerHTML = "<dt>When</dt><dd>" + esc(result.when) + "</dd><dt>Trainer</dt><dd>" + esc(result.trainer_name || data.trainer.name) + "</dd>" + (result.location ? "<dt>Where</dt><dd>" + esc(result.location) + "</dd>" : "");
    step(3);
  }

  function collect() {
    var f = $("evalForm");
    var locs = data.locations || ["in_home"];
    var chosen = f.querySelector('input[name="location"]:checked');
    return {
      trainer_slug: SLUG,
      lead_id: LEAD || undefined,
      slot_start: picked,
      location: locs.length === 1 ? locs[0] : (chosen ? chosen.value : ""),
      client: { first_name: f.elements.first_name.value, last_name: f.elements.last_name.value, phone: f.elements.phone.value, email: f.elements.email.value, address: f.elements.address.value },
      dogs: Array.prototype.map.call($("dogs").querySelectorAll(".dog"), function (el) {
        var d = {}; Array.prototype.forEach.call(el.querySelectorAll("[data-f]"), function (x) { d[x.dataset.f] = x.value; }); return d;
      })
    };
  }

  function missing(body) {
    var labels = { first_name: "first name", last_name: "last name", phone: "phone", email: "email", address: "physical address" };
    for (var k in labels) if (!String(body.client[k] || "").trim()) return "Please add your " + labels[k] + ".";
    if (!body.location) return "Please pick where the evaluation should happen.";
    var dl = { name: "name", sex: "sex", fixed: "spayed/neutered answer", vaccinated: "vaccination answer", age: "age", breed: "breed", behavior: "behavioral challenges" };
    for (var i = 0; i < body.dogs.length; i++) for (var d in dl) if (!String(body.dogs[i][d] || "").trim()) return "Dog " + (i + 1) + ": please add the " + dl[d] + ".";
    return "";
  }

  function load() {
    var url = "/api/booking?trainer=" + encodeURIComponent(SLUG) + (LEAD ? "&lead=" + encodeURIComponent(LEAD) : "");
    return fetch(url, { cache: "no-store" }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {
      if (!res.ok || !res.j.ok) { $("trainerCard").innerHTML = '<p class="msg err">' + esc((res.j && res.j.message) || "This booking page is not available.") + "</p>"; $("stepTime").hidden = true; return; }
      data = res.j;
      renderTrainer(); renderDays();
      if (!$("evalForm").dataset.ready) { prefill(); $("evalForm").dataset.ready = "1"; }
      if (data.booked) showDone({ when: data.booked.when, location: data.booked.location });
    }).catch(function () { $("trainerCard").innerHTML = '<p class="msg err">We could not load this page. Please check your connection and try again.</p>'; });
  }

  $("days").addEventListener("click", function (e) { var b = e.target.closest("[data-day]"); if (!b) return; dayKey = b.dataset.day; renderDays(); });
  $("times").addEventListener("click", function (e) {
    var b = e.target.closest("[data-start]"); if (!b) return;
    picked = Number(b.dataset.start);
    $("pickedLabel").textContent = fmt(picked, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    step(2);
  });
  $("changeTime").addEventListener("click", function () { step(1); });
  $("addDog").addEventListener("click", function () { $("dogs").insertAdjacentHTML("beforeend", dogBlock($("dogs").querySelectorAll(".dog").length)); renumberDogs(); });
  $("dogs").addEventListener("click", function (e) { if (e.target.closest("[data-remove-dog]")) { e.target.closest(".dog").remove(); renumberDogs(); } });
  $("evalForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var body = collect();
    var problem = missing(body);
    $("formError").textContent = problem;
    if (problem) return;
    $("submitBtn").disabled = true; $("submitBtn").textContent = "Booking…";
    fetch("/api/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.j.ok) { showDone(res.j); return; }
        $("formError").textContent = (res.j && res.j.message) || "We could not book that time. Please try again.";
        if (res.status === 409) { picked = null; load().then(function () { step(1); $("calMsg").textContent = res.j.message; $("calMsg").className = "msg err"; }); }
      })
      .catch(function () { $("formError").textContent = "We could not reach the booking system. Please try again."; })
      .then(function () { $("submitBtn").disabled = false; $("submitBtn").textContent = "Book my free evaluation"; });
  });
  load();
})();
</script>
</body>
</html>`;
}

module.exports = { renderBookingPage };
