// The booking page, mobile-first (portal chain step 3c, Joshua 2026-09-12, DO-NOT-BREAK rules 71 + 74).
// Joshua's exact order:
//   1. "Enter your ZIP code" -> trainers within 50 miles pop up as picture cards (photo, name, market,
//      "12 mi away"), nearest first. ZIP pre-filled from the lead (or ?zip=). Nobody within 50 miles ->
//      "The office will match you with a trainer" + a callback form (the office is told).
//   2. The client taps a trainer -> Rachel's evaluation questions (11 Alpha fields, more than one dog;
//      Cleveland trainers add In-home vs Training center, 4815 Orchard Rd, Garfield Heights, OH 44128).
//   3. The mock calendar for THAT trainer (real free times, read-only; never booked in Google). A trainer
//      with no calendar link yet: "Request this trainer - the office will schedule you" (no time booked).
//   4. Congratulations: trainer photo + name, day/time, address or in-home, what happens next, 866.436.4959.
// Everything shown comes from /api/booking; every value is escaped before it is drawn.
function renderBookingPage(slug, { practice = false } = {}) {
  const safeSlug = JSON.stringify(String(slug || "")).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Book your free evaluation | Lorenzo's Dog Training Team</title>
<link rel="icon" type="image/png" href="/assets/ldtt-favicon.png">
<style>
:root{--red:#d80f35;--red-soft:#fff1f3;--ink:#15171a;--muted:#5d636b;--line:#e3e5e8;--bg:#f6f6f4;--card:#fff;--ok:#1d7a46;--ok-soft:#eaf6ef}
*{box-sizing:border-box}
body{margin:0;font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
.practice-bar{background:#111;color:#fff;font-size:13px;text-align:center;padding:8px 12px}
.practice-bar strong{color:#ffcc00}
.top{background:#fff;border-bottom:1px solid var(--line);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.top img{height:34px;width:auto}
.top a{color:var(--ink);font-weight:700;text-decoration:none;font-size:15px}
.wrap{max-width:760px;margin:0 auto;padding:16px 14px 64px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-bottom:14px}
h1{font-size:24px;line-height:1.2;margin:0 0 6px}
h2{font-size:20px;margin:0 0 4px}
.hint{color:var(--muted);font-size:15px;margin:0 0 12px}
.steps{display:flex;gap:6px;list-style:none;padding:0;margin:0 0 14px;font-size:13px;color:var(--muted)}
.steps li{flex:1;text-align:center;padding:6px 2px;border-bottom:3px solid var(--line)}
.steps li.on{color:var(--ink);font-weight:700;border-color:var(--red)}
.steps li.done{color:var(--ok);border-color:var(--ok)}
.zip-row{display:flex;gap:8px}
.zip-row input{flex:1;font-size:22px;letter-spacing:.12em;text-align:center;font-weight:700}
.zip-row .btn{width:auto;padding:0 20px;white-space:nowrap}
.trainers{display:grid;grid-template-columns:1fr;gap:12px;margin-top:14px}
@media(min-width:560px){.trainers{grid-template-columns:1fr 1fr}}
.tcard{display:flex;gap:12px;align-items:center;text-align:left;width:100%;border:1px solid var(--line);background:#fff;border-radius:16px;padding:12px;font:inherit;color:inherit;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.tcard:hover,.tcard:focus-visible{border-color:var(--red);box-shadow:0 0 0 3px #ffd6de;outline:none}
.tcard .photo,.pick .photo{width:76px;height:76px;border-radius:50%;object-fit:cover;background:#e8e8e8;flex:none;border:3px solid var(--red)}
.tcard .initial,.pick .initial{width:76px;height:76px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;flex:none}
.tcard strong{display:block;font-size:18px}
.tcard .market{display:block;color:var(--muted);font-size:14px}
.pill{display:inline-block;margin-top:6px;font-size:13px;font-weight:800;border-radius:999px;padding:3px 10px;background:var(--red-soft);color:var(--red)}
.pill.cal{background:var(--ok-soft);color:var(--ok);margin-left:4px}
.pill.req{background:#f1f2f4;color:var(--muted);margin-left:4px}
.pick{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.pick .photo,.pick .initial{width:58px;height:58px;font-size:24px}
.pick div{flex:1}
.pick strong{display:block;font-size:17px}
.pick span{color:var(--muted);font-size:14px}
.days{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x mandatory}
.day{flex:none;scroll-snap-align:start;min-width:74px;border:1px solid var(--line);background:#fff;border-radius:12px;padding:8px 6px;text-align:center;font:inherit;cursor:pointer}
.day b{display:block;font-size:13px;color:var(--muted);font-weight:600}
.day span{display:block;font-size:18px;font-weight:800}
.day small{display:block;font-size:12px;color:var(--muted)}
.day[aria-pressed="true"]{border-color:var(--red);background:var(--red-soft)}
.times{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin-top:12px}
.time{min-height:48px;border:1px solid var(--line);background:#fff;border-radius:10px;font:inherit;font-weight:700;cursor:pointer}
.time:hover,.time:focus-visible{border-color:var(--red);outline:none}
.time[aria-pressed="true"]{background:var(--red);border-color:var(--red);color:#fff}
.confirm{position:sticky;bottom:10px;margin-top:14px}
.msg{margin:12px 0 0;color:var(--muted)}
.msg.err,.form-error{color:#b00020;font-weight:600}
.linkbtn{background:none;border:0;color:var(--red);font:inherit;font-weight:700;text-decoration:underline;cursor:pointer;padding:0}
fieldset{border:0;padding:0;margin:0 0 16px}
legend{font-weight:800;font-size:16px;margin-bottom:8px;padding:0}
.grid{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:560px){.grid.two{grid-template-columns:1fr 1fr}}
label{display:block;font-size:14px;font-weight:600}
label .req{color:var(--red)}
input,select,textarea{display:block;width:100%;margin-top:4px;font:inherit;padding:11px 12px;border:1px solid #c9cdd2;border-radius:10px;background:#fff;min-height:48px}
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
.request-box{border:2px dashed #f5c2cc;background:var(--red-soft);border-radius:14px;padding:16px;margin-top:6px}
.request-box p{margin:0 0 12px}
.none{text-align:center}
.none .icon{font-size:40px;line-height:1;margin-bottom:6px}
.done{text-align:center}
.done .hero{position:relative;width:128px;height:128px;margin:4px auto 12px}
.done .hero img,.done .hero .initial{width:128px;height:128px;border-radius:50%;object-fit:cover;border:4px solid var(--ok);background:#e8e8e8}
.done .hero .initial{display:flex;align-items:center;justify-content:center;background:var(--red);color:#fff;font-size:48px;font-weight:800}
.done .hero .badge{position:absolute;right:0;bottom:4px;width:40px;height:40px;border-radius:50%;background:var(--ok);color:#fff;font-size:24px;line-height:40px;border:3px solid #fff}
.done h2{font-size:24px;line-height:1.25}
.done .sub{color:var(--muted);margin:0 0 14px}
.done dl{text-align:left;display:grid;grid-template-columns:auto 1fr;gap:8px 14px;margin:16px 0;background:var(--bg);border-radius:12px;padding:14px}
.done dt{color:var(--muted)}
.done dd{margin:0;font-weight:700}
.next{text-align:left;margin:0 0 16px;padding-left:22px}
.next li{margin-bottom:6px}
.phone{display:inline-block;font-size:20px;font-weight:800;color:var(--red);text-decoration:none}
.skeleton{color:var(--muted)}
</style>
</head>
<body>
${practice ? `<div class="practice-bar"><strong>PRACTICE COPY</strong> · test booking. It is saved in the practice portal only and nothing is reserved in Google.</div>` : ""}
<div class="top"><img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><a href="tel:+18664364959">866.436.4959</a></div>
<main class="wrap">
  <ol class="steps" id="steps"><li class="on">1. Your ZIP</li><li>2. Questions</li><li>3. Time</li><li>4. Done</li></ol>

  <section class="card" id="stepZip">
    <h1>Book your free evaluation</h1>
    <p class="hint">Enter your ZIP code to see the trainers near you.</p>
    <form id="zipForm" novalidate>
      <label for="zip">Enter your ZIP code</label>
      <div class="zip-row"><input id="zip" name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="5" pattern="[0-9]{5}" placeholder="44105" required><button type="submit" class="btn" id="zipBtn">Find trainers</button></div>
    </form>
    <p class="msg" id="zipMsg" aria-live="polite"></p>
    <div class="trainers" id="trainerList" aria-live="polite"></div>
    <div id="noTrainer" class="none" hidden>
      <div class="icon" aria-hidden="true">🐾</div>
      <h2>The office will match you with a trainer</h2>
      <p class="hint" id="noTrainerText">We do not have a trainer within 50 miles of your ZIP code yet. Leave your number and our office will call you to find the right trainer for your dog.</p>
      <form id="callbackForm" novalidate style="text-align:left">
        <div class="grid two">
          <label>First name <span class="req">*</span><input name="first_name" autocomplete="given-name" required></label>
          <label>Last name<input name="last_name" autocomplete="family-name"></label>
          <label>Phone <span class="req">*</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label>
          <label>Email<input name="email" type="email" autocomplete="email"></label>
        </div>
        <p class="form-error" id="callbackError" role="alert"></p>
        <button type="submit" class="btn" id="callbackBtn">Call me back</button>
      </form>
    </div>
  </section>

  <section class="card" id="stepForm" hidden>
    <div class="pick" id="pickForm"></div>
    <h2>A few questions about you and your dog</h2>
    <p class="hint">Your trainer uses these to get ready for the evaluation.</p>
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
      <button type="submit" class="btn" id="formNext">Next: pick a time</button>
    </form>
  </section>

  <section class="card" id="stepTime" hidden>
    <div class="pick" id="pickTime"></div>
    <div id="calendarBox">
      <h2>Pick a time for your free evaluation</h2>
      <p class="hint" id="tzHint"></p>
      <div class="days" id="days" aria-label="Days"></div>
      <div class="times" id="times" aria-label="Times"></div>
      <p class="msg" id="calMsg"></p>
      <div class="confirm" id="confirmBox" hidden><button type="button" class="btn" id="bookBtn">Book this time</button></div>
    </div>
    <div class="request-box" id="requestBox" hidden>
      <h2 id="requestTitle">Request this trainer</h2>
      <p id="requestText"></p>
      <button type="button" class="btn" id="requestBtn">Request this trainer — the office will schedule you</button>
    </div>
    <p class="form-error" id="timeError" role="alert"></p>
    <button type="button" class="linkbtn" id="backToForm" style="margin-top:12px">← Back to the questions</button>
  </section>

  <section class="card done" id="stepDone" hidden>
    <div class="hero" id="doneHero"></div>
    <h2 id="doneTitle">Congratulations!</h2>
    <p class="sub" id="doneSub"></p>
    <dl id="doneList"></dl>
    <h3 style="text-align:left;margin:0 0 6px">What happens next</h3>
    <ol class="next" id="doneNext"></ol>
    <p class="hint" style="margin-bottom:4px">Questions or need to change it? Call our office:</p>
    <a class="phone" href="tel:+18664364959">866.436.4959</a>
  </section>
</main>
<script>
(function () {
  "use strict";
  var SLUG = ${safeSlug};
  var OFFICE = "866.436.4959";
  var params = new URLSearchParams(location.search);
  var LEAD = params.get("lead") || "";
  var zipNow = "", cards = [], chosen = null, cal = null, picked = null, dayKey = "", answers = null, prefilled = false, leadInfo = null;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); }); }
  function postJSON(body) { return fetch("/api/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); }); }
  function step(n) {
    $("stepZip").hidden = n !== 1; $("stepForm").hidden = n !== 2; $("stepTime").hidden = n !== 3; $("stepDone").hidden = n !== 4;
    Array.prototype.forEach.call($("steps").children, function (li, i) { li.className = i === n - 1 ? "on" : (i < n - 1 ? "done" : ""); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function face(photo, name, cls) {
    return photo ? '<img class="' + (cls || "photo") + '" src="' + esc(photo) + '" alt="' + esc(name) + '" loading="lazy">' : '<span class="initial" aria-hidden="true">' + esc(String(name || "?").charAt(0)) + "</span>";
  }
  function milesText(m) { return m == null ? "" : (m < 1 ? "Under 1 mi away" : m + " mi away"); }
  function pickStrip(c) {
    return face(c.photo, c.name) + '<div><strong>' + esc(c.name) + '</strong><span>' + esc(c.market) + (c.miles != null ? " · " + esc(milesText(c.miles)) : "") + '</span></div><button type="button" class="linkbtn" data-change-trainer>Change</button>';
  }

  // ---------- Step 1: ZIP -> trainer cards ----------
  function renderCards() {
    $("noTrainer").hidden = true;
    if (!cards.length) { $("trainerList").innerHTML = ""; return; }
    $("zipMsg").className = "msg";
    $("zipMsg").textContent = cards.length === 1 ? "1 trainer within 50 miles of " + zipNow + "." : cards.length + " trainers within 50 miles of " + zipNow + ". Nearest first. Tap a trainer to continue.";
    $("trainerList").innerHTML = cards.map(function (c, i) {
      return '<button type="button" class="tcard" data-card="' + i + '">' + face(c.photo, c.name) +
        '<span><strong>' + esc(c.name) + '</strong><span class="market">' + esc(c.market) + '</span>' +
        '<span class="pill">' + esc(milesText(c.miles)) + '</span>' +
        (c.calendar ? '<span class="pill cal">Online calendar</span>' : '<span class="pill req">Office schedules</span>') + "</span></button>";
    }).join("");
  }
  function showNoTrainer(text) {
    $("trainerList").innerHTML = "";
    $("zipMsg").textContent = "";
    if (text) $("noTrainerText").textContent = text;
    $("noTrainer").hidden = false;
    var f = $("callbackForm"), l = leadInfo || {};
    ["first_name", "last_name", "phone", "email"].forEach(function (k) { if (l[k] && !f.elements[k].value) f.elements[k].value = l[k]; });
  }
  function search(zip) {
    zipNow = zip;
    $("zipMsg").className = "msg"; $("zipMsg").textContent = "Finding trainers near " + zip + "…";
    $("zipBtn").disabled = true;
    return getJSON("/api/booking?zip=" + encodeURIComponent(zip) + (LEAD ? "&lead=" + encodeURIComponent(LEAD) : "")).then(function (res) {
      if (res.status !== 200 || !res.j.ok) { $("trainerList").innerHTML = ""; $("zipMsg").className = "msg err"; $("zipMsg").textContent = (res.j && res.j.message) || "Please enter your 5-digit ZIP code."; return; }
      if (res.j.lead) leadInfo = res.j.lead;
      if (res.j.unknown_zip) { $("trainerList").innerHTML = ""; $("zipMsg").className = "msg err"; $("zipMsg").textContent = res.j.message; return; }
      cards = res.j.trainers || [];
      if (!cards.length) showNoTrainer("We do not have a trainer within 50 miles of " + zip + " yet. Leave your number and our office will call you to find the right trainer for your dog.");
      else renderCards();
    }).catch(function () { $("zipMsg").className = "msg err"; $("zipMsg").textContent = "We could not load trainers. Please check your connection and try again."; })
      .then(function () { $("zipBtn").disabled = false; });
  }
  $("zipForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var zip = String($("zip").value || "").replace(/\\D/g, "").slice(0, 5);
    $("zip").value = zip;
    if (zip.length !== 5) { $("zipMsg").className = "msg err"; $("zipMsg").textContent = "Please enter your 5-digit ZIP code."; $("trainerList").innerHTML = ""; return; }
    search(zip);
  });
  $("trainerList").addEventListener("click", function (e) {
    var b = e.target.closest("[data-card]"); if (!b) return;
    chosen = cards[Number(b.dataset.card)];
    cal = null; picked = null;
    openForm();
  });

  // ---------- Step 2: Rachel's questions ----------
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
  function openForm() {
    var f = $("evalForm");
    if (!prefilled) {
      $("dogs").innerHTML = dogBlock(0);
      var l = leadInfo || {};
      ["first_name", "last_name", "phone", "email", "address"].forEach(function (k) { if (l[k]) f.elements[k].value = l[k]; });
      if (l.dog_name) $("dogs").querySelector('[data-f="name"]').value = l.dog_name;
      prefilled = true;
    }
    var locs = chosen.locations || ["in_home"];
    $("locationBox").hidden = locs.length < 2;
    $("centerAddress").textContent = chosen.training_center_address || "";
    if (locs.length < 2) Array.prototype.forEach.call(f.querySelectorAll('input[name="location"]'), function (x) { x.checked = false; });
    $("pickForm").innerHTML = pickStrip(chosen);
    $("formNext").textContent = chosen.calendar ? "Next: pick a time" : "Next";
    $("formError").textContent = "";
    step(2);
  }
  function collect() {
    var f = $("evalForm");
    var locs = chosen.locations || ["in_home"];
    var sel = f.querySelector('input[name="location"]:checked');
    return {
      trainer_slug: chosen.slug,
      lead_id: LEAD || undefined,
      zip: zipNow,
      location: locs.length === 1 ? locs[0] : (sel ? sel.value : ""),
      client: { first_name: f.elements.first_name.value, last_name: f.elements.last_name.value, phone: f.elements.phone.value, email: f.elements.email.value, address: f.elements.address.value },
      dogs: Array.prototype.map.call($("dogs").querySelectorAll(".dog"), function (el) {
        var d = {}; Array.prototype.forEach.call(el.querySelectorAll("[data-f]"), function (x) { d[x.dataset.f] = x.value; }); return d;
      })
    };
  }
  function missing(body) {
    var labels = { first_name: "first name", last_name: "last name", phone: "phone", email: "email", address: "physical address" };
    for (var k in labels) if (!String(body.client[k] || "").trim()) return "Please add your " + labels[k] + ".";
    if (String(body.client.phone).replace(/\\D/g, "").length < 10) return "The phone number needs 10 digits.";
    if (!body.location) return "Please pick where the evaluation should happen.";
    var dl = { name: "name", sex: "sex", fixed: "spayed/neutered answer", vaccinated: "vaccination answer", age: "age", breed: "breed", behavior: "behavioral challenges" };
    for (var i = 0; i < body.dogs.length; i++) for (var d in dl) if (!String(body.dogs[i][d] || "").trim()) return "Dog " + (i + 1) + ": please add the " + dl[d] + ".";
    return "";
  }
  $("addDog").addEventListener("click", function () { $("dogs").insertAdjacentHTML("beforeend", dogBlock($("dogs").querySelectorAll(".dog").length)); renumberDogs(); });
  $("dogs").addEventListener("click", function (e) { if (e.target.closest("[data-remove-dog]")) { e.target.closest(".dog").remove(); renumberDogs(); } });
  $("evalForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var body = collect();
    var problem = missing(body);
    $("formError").textContent = problem;
    if (problem) return;
    answers = body;
    openTime();
  });

  // ---------- Step 3: the mock calendar, or "Request this trainer" ----------
  function fmt(sec, opts) { return new Date(sec * 1000).toLocaleString("en-US", Object.assign({ timeZone: cal.time_zone }, opts)); }
  function keyOf(sec) { return new Date(sec * 1000).toLocaleDateString("en-CA", { timeZone: cal.time_zone }); }
  function tzName() { try { return new Date().toLocaleTimeString("en-US", { timeZone: cal.time_zone, timeZoneName: "long" }).split(" ").slice(2).join(" "); } catch (e) { return cal.time_zone; } }
  function renderDays() {
    var groups = {};
    cal.slots.forEach(function (s) { var k = keyOf(s.start); (groups[k] = groups[k] || []).push(s); });
    var keys = Object.keys(groups).sort();
    $("calMsg").className = "msg";
    if (cal.calendar_error) { $("calMsg").textContent = cal.calendar_error; $("calMsg").className = "msg err"; }
    else if (!keys.length) $("calMsg").textContent = "No open times in the next two weeks. Please call " + OFFICE + " and we will fit you in.";
    else $("calMsg").textContent = "";
    if (keys.indexOf(dayKey) === -1) dayKey = keys[0] || "";
    $("days").innerHTML = keys.map(function (k) {
      var first = groups[k][0].start;
      return '<button type="button" class="day" data-day="' + esc(k) + '" aria-pressed="' + (k === dayKey) + '"><b>' + esc(fmt(first, { weekday: "short" })) + '</b><span>' + esc(fmt(first, { day: "numeric" })) + '</span><small>' + esc(fmt(first, { month: "short" })) + " · " + groups[k].length + "</small></button>";
    }).join("");
    $("times").innerHTML = (groups[dayKey] || []).map(function (s) {
      return '<button type="button" class="time" data-start="' + s.start + '" aria-pressed="' + (s.start === picked) + '">' + esc(fmt(s.start, { hour: "numeric", minute: "2-digit" })) + "</button>";
    }).join("");
    $("confirmBox").hidden = !picked;
  }
  function loadCalendar() {
    $("calMsg").className = "msg"; $("calMsg").textContent = "Loading " + chosen.first_name + "'s open times…";
    $("days").innerHTML = ""; $("times").innerHTML = ""; $("confirmBox").hidden = true;
    return getJSON("/api/booking?trainer=" + encodeURIComponent(chosen.slug) + (LEAD ? "&lead=" + encodeURIComponent(LEAD) : "")).then(function (res) {
      if (res.status !== 200 || !res.j.ok) { $("calMsg").className = "msg err"; $("calMsg").textContent = (res.j && res.j.message) || "This calendar is not available right now. Please call " + OFFICE + "."; return; }
      cal = res.j;
      $("tzHint").textContent = "Times are shown in " + tzName() + ", " + chosen.first_name + "'s time zone.";
      renderDays();
    }).catch(function () { $("calMsg").className = "msg err"; $("calMsg").textContent = "We could not load the calendar. Please check your connection and try again."; });
  }
  function openTime() {
    $("pickTime").innerHTML = pickStrip(chosen);
    $("timeError").textContent = "";
    $("calendarBox").hidden = !chosen.calendar;
    $("requestBox").hidden = !!chosen.calendar;
    if (chosen.calendar) { picked = null; loadCalendar(); }
    else {
      $("requestTitle").textContent = "Request " + chosen.first_name;
      $("requestText").textContent = chosen.first_name + " does not have an online calendar yet. Send your request and our office will call you to pick a day and time with " + chosen.first_name + ".";
    }
    step(3);
  }
  $("days").addEventListener("click", function (e) { var b = e.target.closest("[data-day]"); if (!b) return; dayKey = b.dataset.day; renderDays(); });
  $("times").addEventListener("click", function (e) {
    var b = e.target.closest("[data-start]"); if (!b) return;
    picked = Number(b.dataset.start);
    renderDays();
    $("bookBtn").textContent = "Book " + fmt(picked, { weekday: "short", month: "short", day: "numeric" }) + " at " + fmt(picked, { hour: "numeric", minute: "2-digit" });
    $("confirmBox").hidden = false;
  });
  $("bookBtn").addEventListener("click", function () {
    if (!picked || !answers) return;
    var body = Object.assign({}, answers, { slot_start: picked });
    $("bookBtn").disabled = true; $("bookBtn").textContent = "Booking…"; $("timeError").textContent = "";
    postJSON(body).then(function (res) {
      if (res.status === 200 && res.j.ok) { showDone({ booked: true, when: res.j.when, location_key: res.j.location_key, location_label: res.j.location, address: res.j.address, trainer_name: res.j.trainer_name }); return; }
      $("timeError").textContent = (res.j && res.j.message) || "We could not book that time. Please try again.";
      if (res.status === 409) { picked = null; loadCalendar().then(function () { $("calMsg").textContent = res.j.message; $("calMsg").className = "msg err"; }); }
    }).catch(function () { $("timeError").textContent = "We could not reach the booking system. Please try again."; })
      .then(function () { $("bookBtn").disabled = false; if (picked) $("bookBtn").textContent = "Book this time"; });
  });
  $("requestBtn").addEventListener("click", function () {
    if (!answers) return;
    var body = Object.assign({}, answers, { op: "request" });
    $("requestBtn").disabled = true; $("timeError").textContent = "";
    postJSON(body).then(function (res) {
      if (res.status === 200 && res.j.ok) { showDone({ requested: true, location_key: res.j.location_key, location_label: res.j.location, address: res.j.address, trainer_name: res.j.trainer_name }); return; }
      $("timeError").textContent = (res.j && res.j.message) || "We could not send your request. Please call " + OFFICE + ".";
    }).catch(function () { $("timeError").textContent = "We could not reach the booking system. Please try again."; })
      .then(function () { $("requestBtn").disabled = false; });
  });
  $("backToForm").addEventListener("click", function () { step(2); });
  document.addEventListener("click", function (e) { if (e.target.closest("[data-change-trainer]")) { step(1); } });

  // ---------- No trainer within 50 miles: callback ----------
  $("callbackForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = $("callbackForm");
    var client = { first_name: f.elements.first_name.value, last_name: f.elements.last_name.value, phone: f.elements.phone.value, email: f.elements.email.value };
    if (!String(client.first_name).trim()) { $("callbackError").textContent = "Please add your first name."; return; }
    if (String(client.phone).replace(/\\D/g, "").length < 10) { $("callbackError").textContent = "Please add a phone number with 10 digits so we can call you."; return; }
    $("callbackError").textContent = ""; $("callbackBtn").disabled = true;
    postJSON({ op: "callback", zip: zipNow, lead_id: LEAD || undefined, client: client }).then(function (res) {
      if (res.status === 200 && res.j.ok) { showDone({ callback: true, first_name: client.first_name }); return; }
      $("callbackError").textContent = (res.j && res.j.message) || "We could not send that. Please call " + OFFICE + ".";
    }).catch(function () { $("callbackError").textContent = "We could not reach our office system. Please call " + OFFICE + "."; })
      .then(function () { $("callbackBtn").disabled = false; });
  });

  // ---------- Step 4: congratulations ----------
  function whereText(r) {
    if (r.location_key === "training_center" || /^Training center/i.test(r.location_label || "")) return "Training center: " + (r.address || (chosen && chosen.training_center_address) || "");
    return "In-home" + (r.address ? ": " + r.address : "");
  }
  function showDone(r) {
    var who = chosen || { name: r.trainer_name || "", first_name: String(r.trainer_name || "").split(" ")[0], photo: r.trainer_photo || "", market: r.trainer_market || "" };
    var first = (answers && answers.client.first_name) || (leadInfo && leadInfo.first_name) || r.first_name || "";
    if (r.callback) {
      $("doneHero").innerHTML = '<span class="initial" aria-hidden="true">🐾</span>';
      $("doneTitle").textContent = "Thank you" + (first ? ", " + first : "") + "!";
      $("doneSub").textContent = "Our office will call you to match you with a trainer near you.";
      $("doneList").innerHTML = "<dt>Your ZIP</dt><dd>" + esc(zipNow) + "</dd>";
      $("doneNext").innerHTML = "<li>Our office looks for the best trainer for your area.</li><li>We call you at the number you gave us.</li><li>Together we set up your free evaluation.</li>";
      step(4); return;
    }
    $("doneHero").innerHTML = face(who.photo, who.name, "photo") + '<span class="badge" aria-hidden="true">✓</span>';
    if (r.booked) {
      $("doneTitle").textContent = "Congratulations" + (first ? ", " + first : "") + "! You're booked with " + who.first_name + ".";
      $("doneSub").textContent = "Your free evaluation is on the calendar.";
      $("doneList").innerHTML = "<dt>When</dt><dd>" + esc(r.when) + "</dd><dt>Trainer</dt><dd>" + esc(who.name) + (who.market ? " · " + esc(who.market) : "") + "</dd><dt>Where</dt><dd>" + esc(whereText(r)) + "</dd>";
      $("doneNext").innerHTML = "<li>Our office adds you to our client system.</li><li>" + esc(who.first_name) + " gets in touch before the visit.</li><li>Have your dog and your questions ready. The evaluation is free.</li>";
    } else {
      $("doneTitle").textContent = "Request sent" + (first ? ", " + first : "") + "! " + who.first_name + " is your trainer.";
      $("doneSub").textContent = "Our office will call you to pick a day and time.";
      $("doneList").innerHTML = "<dt>Trainer</dt><dd>" + esc(who.name) + (who.market ? " · " + esc(who.market) : "") + "</dd><dt>When</dt><dd>The office calls you to schedule</dd><dt>Where</dt><dd>" + esc(whereText(r)) + "</dd>";
      $("doneNext").innerHTML = "<li>Our office calls you to set the day and time.</li><li>We add you to our client system.</li><li>" + esc(who.first_name) + " meets you and your dog for the free evaluation.</li>";
    }
    step(4);
  }

  // ---------- Start: ZIP pre-filled from the lead or ?zip= ----------
  function start() {
    var zipParam = String(params.get("zip") || "").replace(/\\D/g, "").slice(0, 5);
    if (!LEAD && zipParam.length !== 5) { $("zip").focus(); return; }
    getJSON("/api/booking?" + (LEAD ? "lead=" + encodeURIComponent(LEAD) : "") + (zipParam ? (LEAD ? "&" : "") + "zip=" + encodeURIComponent(zipParam) : "")).then(function (res) {
      if (res.status !== 200 || !res.j.ok) return;
      leadInfo = res.j.lead || null;
      var o = res.j.outcome;
      if (o && (o.booked || o.requested)) {
        chosen = { slug: o.trainer_slug, name: o.trainer_name, first_name: o.trainer_first_name, photo: o.trainer_photo, market: o.trainer_market, training_center_address: "" };
        showDone({ booked: o.booked, requested: o.requested, when: o.when, location_key: o.location, location_label: o.location_label, address: o.location === "training_center" ? String(o.location_label || "").replace(/^Training center:\\s*/i, "") : o.address });
        return;
      }
      if (res.j.zip) {
        $("zip").value = res.j.zip;
        zipNow = res.j.zip;
        if (res.j.unknown_zip) { $("zipMsg").className = "msg err"; $("zipMsg").textContent = res.j.message; return; }
        cards = res.j.trainers || [];
        if (!cards.length) showNoTrainer("We do not have a trainer within 50 miles of " + res.j.zip + " yet. Leave your number and our office will call you to find the right trainer for your dog.");
        else renderCards();
      }
    }).catch(function () {});
  }
  start();
})();
</script>
</body>
</html>`;
}

module.exports = { renderBookingPage };
