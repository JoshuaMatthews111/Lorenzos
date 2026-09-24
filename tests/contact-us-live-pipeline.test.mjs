// Contact Us goes live (Joshua 2026-09-24, in his words: "it should after filling that they should fill
// zip code mandatory and then it takes them to the preferred trainers then the same text flow starts and
// fires and the rest of the automation like the rest of the leads. don't break form submit.")
//
// Runs the REAL blocks out of script.js in a vm against a fake DOM and a fake network, and proves:
//   1. ZIP is mandatory on Contact Us and must be five digits, with a friendly message, through the same
//      native required/reportValidity path every other required field uses. The red asterisk and the
//      `required` attribute are in the served markup already (build.py) and are NOT changed.
//   2. DELIVERY IS UNTOUCHED AND FIRST: a live Contact Us submit still calls submit-contact, then
//      /api/form-delivery, then (when the server email failed) FormSubmit production@ from the browser -
//      same calls, same bodies, same order as before - and only THEN does anything new happen.
//   3. The lead enters the SAME pipeline door every other lead uses: POST /api/pipeline {op:"enter"}.
//   4. The hand-off follows the pipeline's own /book/<trainer>?lead=<uuid> link - an OPAQUE id. No name,
//      phone, email or ZIP is ever put in the URL.
//   5. A lane with no booking link (phone consultation / becoming a trainer / blank) never redirects:
//      the person keeps today's thank-you and the office follows up as it does now.
//   6. The practice copy is untouched: the hand-off returns without calling anything when sandbox.
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project, Make or Resend.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SCRIPT = read("script.js");
const CONTACT_HTML = read("contact.html");
const block = (a, b) => {
  const i = SCRIPT.indexOf(a);
  const j = SCRIPT.indexOf(b, i);
  assert.ok(i >= 0 && j > i, `block ${a}`);
  return SCRIPT.slice(i, j);
};

const LEAD_ID = "6f1b0f2a-6a1e-4f8e-9c2f-6d1a2b3c4d5e";
const BOOK_URL = `/book/lorenzo-miller?lead=${LEAD_ID}`;

// ---------------------------------------------------------------------------
// A fake DOM just big enough for the real code
// ---------------------------------------------------------------------------
class El {
  constructor(tag = "div", attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attrs };
    this.dataset = {};
    this.children = [];
    this.listeners = {};
    this.value = attrs.value ?? "";
    this.textContent = "";
    this.validationMessage = "";
    this.classList = {
      _set: new Set(String(attrs.class || "").split(/\s+/).filter(Boolean)),
      contains: c => this.classList._set.has(c),
      add: c => this.classList._set.add(c),
      remove: c => this.classList._set.delete(c)
    };
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  fire(type, event = {}) { (this.listeners[type] || []).forEach(fn => fn({ preventDefault() {}, stopImmediatePropagation() {}, ...event })); }
  setCustomValidity(message) { this.validationMessage = String(message || ""); }
  // Enough HTML parsing for showFormSuccessModal's card: every <tag class="..."> becomes a child.
  set innerHTML(html) {
    this.children = [...String(html).matchAll(/<([a-z0-9]+)([^>]*)>/gi)]
      .map(([, tag, attrs]) => new El(tag, { class: (attrs.match(/class="([^"]*)"/) || [, ""])[1] }));
  }
  get innerHTML() { return ""; }
  appendChild(child) { this.children.push(child); return child; }
  focus() {}
  reset() {}
  matches() { return true; }
  reportValidity() { return this.all().every(el => !el.validationMessage); }
  closest() { return null; }
  all() { return [this, ...this.children.flatMap(c => c.all())]; }
  querySelectorAll(selector) {
    return this.all().filter(el => el !== this && el.matchesSelector(selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  matchesSelector(selector) {
    if (selector === "[name]") return typeof this.attributes.name === "string";
    const name = selector.match(/\[name="([^"]+)"\]/);
    if (name) return this.attributes.name === name[1];
    if (selector.startsWith(".")) {
      const want = selector.slice(1).split(/[.\s[]/)[0];
      return this.classList.contains(want) || String(this.className || "").split(/\s+/).includes(want);
    }
    if (selector === "p") return this.tagName === "P";
    if (/^form/.test(selector)) {
      const cls = selector.match(/\.([a-z-]+)/);
      return this.tagName === "FORM" && (!cls || this.classList.contains(cls[1]));
    }
    return false;
  }
}

const typeZip = (form, value) => { const input = form.querySelector('[name="zip"]'); input.value = value; input.fire("input"); };

function contactPage() {
  const form = new El("form", { class: "panel form contact-intake" });
  const field = (tag, attrs) => form.appendChild(new El(tag, attrs));
  field("input", { name: "source_page", type: "hidden", value: "contact.html" });
  const zip = field("input", { name: "zip", required: "", autocomplete: "postal-code" });
  field("input", { name: "first_name", value: "Dana" });
  field("input", { name: "last_name", value: "Practice" });
  field("input", { name: "email", value: "dana@example.test" });
  field("input", { name: "phone", value: "440-555-0142" });
  field("input", { name: "i_want_to", value: "Schedule an in person evaluation with a trainer in my area" });
  field("input", { name: "comments", value: "Our dog pulls on the leash." });
  form.appendChild(new El("div", { class: "form-status" }));
  form.appendChild(new El("button", { type: "submit" }));
  form.attributes["data-email-endpoint"] = "https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com";
  form.dataset.emailEndpoint = "https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com";
  return { form, zip };
}

// The real blocks, in file order. Nothing is rewritten: each is sliced straight out of script.js.
const REAL = [
  block("const buildMailPayload=", "\n};\n") + "\n};",
  block("const submitEmailRelay=", "\n};\n") + "\n};",
  block("const CONTACT_US_SOURCES=", "const submitPublicFormToSupabase="),
  block("const submitPublicFormToSupabase=", "\nconst TRAINER_ATTRIBUTION_KEY"),
  block("const showFormSuccessModal=", "\nconst trackLdttConversion="),
  block("const wireAsyncForm=", "const relayFormDeliveries="),
  block("const relayFormDeliveries=", "\n};\n") + "\n};",
  block("const CONTACT_ZIP_MISSING=", "const contactForm=document.querySelector"),
  block("const contactForm=document.querySelector", "document.querySelectorAll('a[href=\"contact.html#form\"]')")
].join("\n") + "\nthis.wireContactZipRequired=wireContactZipRequired;this.rememberContactLead=rememberContactLead;this.isContactUsEntries=isContactUsEntries;";

function run({ sandbox = false, bookUrl = BOOK_URL, serverEmailFailed = true } = {}) {
  const { form, zip } = contactPage();
  const body = new El("body");
  const calls = [];
  const assigned = [];
  class FakeFormData {
    constructor(f) { this.map = new Map(); if (f) f.querySelectorAll('[name]').forEach(el => this.map.set(el.attributes.name, el.value)); }
    get(k) { return this.map.has(k) ? this.map.get(k) : null; }
    set(k, v) { this.map.set(k, String(v)); }
    append(k, v) { this.map.set(k, String(v)); }
    entries() { return this.map.entries(); }
    [Symbol.iterator]() { return this.map.entries(); }
  }
  const context = {
    console, JSON, Error, String, Object, Array, Date, Math, Promise, URL, URLSearchParams, Symbol,
    FormData: FakeFormData,
    document: {
      title: "Contact | Lorenzo's Dog Training Team",
      body,
      createElement: tag => new El(tag),
      querySelector: s => (s === ".contact-intake" ? form : body.querySelector(s)),
      querySelectorAll: s => (s === "form.contact-intake" ? [form] : body.querySelectorAll(s)),
      addEventListener() {}
    },
    // Dependencies of the real blocks that are not themselves under test.
    publicEnvironment: Promise.resolve({ sandbox }),
    practiceFunctionOff: () => false,
    practiceHeaders: () => ({}),
    PRACTICE_FORM_OFF_MESSAGE: "off",
    ldttVisitorId: () => "v-1",
    ldttSessionId: () => "s-1",
    isReleaseQaHost: false,
    applyStoredTrainerAttribution: () => {},
    formToObject: data => Object.fromEntries([...data.entries()]),
    trackLdttConversion: () => {},
    updateStoredDelivery: () => {},
    fetch: async (url, options = {}) => {
      const target = String(url);
      calls.push({ url: target, body: options.body });
      if (/submit-contact$/.test(target)) return { ok: true, status: 200, json: async () => ({ lead_id: LEAD_ID }) };
      if (target === "/api/form-delivery") {
        const parsed = JSON.parse(options.body);
        if (parsed.client_delivery) return { ok: true, status: 200, json: async () => ({ ok: true }) };
        return { ok: true, status: 200, json: async () => ({ ok: true, deliveries: [{ destination: "google_sheet", status: "accepted" }, { destination: "formsubmit_email", status: serverEmailFailed ? "failed" : "accepted" }] }) };
      }
      if (target === "/api/pipeline") return { ok: true, status: 200, json: async () => ({ ok: true, lead_id: LEAD_ID, trainer_slug: "lorenzo-miller", book_url: bookUrl, texted: true }) };
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: "true" }) };
    }
  };
  context.window = {
    location: { search: "", href: "https://lorenzosdogtrainingteam.com/contact", assign: url => assigned.push(String(url)) },
    LDTT_SUPABASE: { enabled: true, functionsBaseUrl: "https://edge.test/functions/v1" },
    LDTT_IS_SANDBOX: sandbox
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(REAL, context);
  return { context, form, zip, calls, assigned, body };
}

// ---------------------------------------------------------------------------
// 1. ZIP is mandatory and must be five digits
// ---------------------------------------------------------------------------
test("ZIP keeps the same required treatment every other field has: `required` + the red asterisk, in the served markup", () => {
  assert.match(
    CONTACT_HTML,
    /<label>ZIP Code<span class="required-mark" aria-hidden="true">\*<\/span><input required name="zip" autocomplete="postal-code"><\/label>/,
    "contact.html keeps build.py's own required-mark markup for ZIP, unchanged"
  );
  // build.py writes that markup, so the page and its generator cannot drift apart.
  assert.match(read("build.py"), /ZIP Code<span class="required-mark" aria-hidden="true">\*<\/span><input required name="zip"/);
});

test("ZIP must be a valid 5-digit US ZIP, with a friendly message, through the native reportValidity path", () => {
  const { zip } = run();
  assert.equal(zip.getAttribute("pattern"), "\\d{5}");
  assert.equal(zip.getAttribute("inputmode"), "numeric");
  assert.equal(zip.getAttribute("maxlength"), "5");

  const type = value => { zip.value = value; zip.fire("input"); return zip.validationMessage; };
  assert.equal(type(""), "Please enter your ZIP code so we can show you the trainers nearest you.");
  assert.equal(type("   "), "Please enter your ZIP code so we can show you the trainers nearest you.");
  for (const bad of ["4412", "441288", "abcde", "4412a", "44128-1234"]) {
    assert.equal(type(bad), "Please enter a valid 5-digit US ZIP code, for example 44128.", `"${bad}" is refused`);
  }
  assert.equal(type("44128"), "", "a real 5-digit ZIP passes");
});

test("the ZIP check is only wired on the Contact Us form, and never twice", () => {
  const { context, form, zip } = run();
  assert.equal(zip.dataset.ldttZipWired, "true");
  const before = (zip.listeners.input || []).length;
  context.wireContactZipRequired(context.document);
  assert.equal((zip.listeners.input || []).length, before, "a second pass does not double-wire");
  form.querySelector('[name="source_page"]').value = "dog-training-atlanta-ga.html";
  const other = new El("input", { name: "zip" });
  form.appendChild(other);
  context.wireContactZipRequired(context.document);
  assert.equal(other.dataset.ldttZipWired, undefined, "a form that is not Contact Us is left alone");
});

// ---------------------------------------------------------------------------
// 2 + 3 + 4. The whole live journey, in order
// ---------------------------------------------------------------------------
test("LIVE Contact Us: delivery happens FIRST and unchanged, then the pipeline, then the trainer picker", async () => {
  const { context, form, calls, assigned } = run();
  typeZip(form, "44128");
  form.fire("submit");
  await new Promise(resolve => setTimeout(resolve, 20));

  const urls = calls.map(c => c.url);
  // The office's lead record and its delivery, byte-for-byte the path that was there before.
  assert.equal(urls[0], "https://edge.test/functions/v1/submit-contact", "the lead is saved first");
  assert.equal(urls[1], "/api/form-delivery", "then the Google Sheet row + the office FormSubmit email");
  assert.equal(JSON.parse(calls[1].body).form_type, "contact");
  assert.equal(urls[2], "https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com", "then the browser retry to FormSubmit production@");
  assert.equal(calls[2].body.get("_subject"), "New Lorenzo's Dog Training Team Contact Form Submission");
  assert.equal(JSON.parse(calls[3].body).client_delivery.status, "accepted", "the delivery result is logged back");

  // Only after all of that does anything new happen.
  const pipelineAt = urls.indexOf("/api/pipeline");
  assert.ok(pipelineAt > urls.lastIndexOf("/api/form-delivery"), "the pipeline is entered AFTER every delivery call");
  const sent = JSON.parse(calls[pipelineAt].body);
  assert.deepEqual(sent, { op: "enter", lead_id: LEAD_ID, via: "contact-us" }, "the same door /api/booking-lead uses");

  // The trainer picker, reached by opaque id only.
  assert.deepEqual(assigned, [BOOK_URL], "the browser follows the pipeline's own booking link");
  const url = new URL(assigned[0], "https://lorenzosdogtrainingteam.com");
  assert.deepEqual([...url.searchParams.keys()], ["lead"], "the only parameter is the opaque lead id");
  assert.match(url.searchParams.get("lead"), /^[0-9a-f-]{36}$/);
  for (const secret of ["Dana", "Practice", "dana@example.test", "440", "0142", "44128", "first_name", "phone", "email", "zip"]) {
    assert.ok(!assigned[0].includes(secret), `no PII in the URL: "${secret}"`);
  }
  assert.equal(context.window.LDTT_PENDING_CONTACT_LEAD, null, "the remembered lead is cleared");
});

test("the office's delivery is never skipped, retried or rerouted by the new code", async () => {
  const { calls } = run({ bookUrl: null });
  await new Promise(resolve => setTimeout(resolve, 5));
  const { form, calls: c2 } = run({ serverEmailFailed: false });
  typeZip(form, "44128");
  form.fire("submit");
  await new Promise(resolve => setTimeout(resolve, 20));
  const formSubmitCalls = c2.filter(c => /formsubmit\.co/.test(c.url));
  assert.equal(formSubmitCalls.length, 0, "the server email succeeded, so the browser does NOT re-send it");
  assert.equal(c2.filter(c => c.url === "/api/form-delivery" && !JSON.parse(c.body).client_delivery).length, 1, "form-delivery is called exactly once");
  assert.equal(calls.length, 0, "nothing is called until a form is actually submitted");
});

// ---------------------------------------------------------------------------
// 5 + 6. Lanes without a booking link, and the practice copy
// ---------------------------------------------------------------------------
test("no booking link (phone consultation / becoming a trainer / blank / nobody within 50 miles): no redirect", async () => {
  const { form, assigned, calls, body } = run({ bookUrl: null });
  typeZip(form, "44128");
  form.fire("submit");
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(calls.some(c => c.url === "/api/pipeline"), "the lead still enters the pipeline");
  assert.deepEqual(assigned, [], "but nobody is sent to a booking page that has nothing to show");
  const modal = body.querySelector(".form-success-modal");
  assert.match(modal.querySelector("p").textContent, /Lorenzo's office has your details/, "today's thank-you is put back");
});

test("the practice copy is untouched: the live hand-off does nothing there", async () => {
  const { context, calls } = run({ sandbox: true });
  context.window.LDTT_PENDING_CONTACT_LEAD = { lead_id: LEAD_ID, at: Date.now() };
  await context.window.LDTT_CONTACT_HANDOFF(null);
  assert.equal(calls.filter(c => c.url === "/api/pipeline").length, 0, "the practice copy keeps its own capture listener (rule 73)");
  assert.equal(context.window.LDTT_PENDING_CONTACT_LEAD, null);
});

test("a stale or missing remembered lead never enters the pipeline", async () => {
  const { context, calls } = run();
  await context.window.LDTT_CONTACT_HANDOFF(null);
  context.window.LDTT_PENDING_CONTACT_LEAD = { lead_id: LEAD_ID, at: Date.now() - 300000 };
  await context.window.LDTT_CONTACT_HANDOFF(null);
  assert.equal(calls.filter(c => c.url === "/api/pipeline").length, 0);
});

test("only a Contact Us lead is remembered: other pages that use submit-contact are left exactly as they are", () => {
  const { context } = run();
  const remember = context.rememberContactLead;
  const pending = () => context.window.LDTT_PENDING_CONTACT_LEAD;

  context.window.LDTT_PENDING_CONTACT_LEAD = null;
  remember({ source_page: "dog-training-atlanta-ga.html", page_url: "https://lorenzosdogtrainingteam.com/dog-training-atlanta-ga" }, { lead_id: LEAD_ID });
  assert.equal(pending(), null, "an ad/market page lead is not swept into this");

  remember({ source_page: "contact.html", page_url: "https://lorenzosdogtrainingteam.com/contact" }, { lead_id: LEAD_ID });
  assert.equal(pending().lead_id, LEAD_ID);

  context.window.LDTT_PENDING_CONTACT_LEAD = null;
  remember({ source_page: "", page_url: "https://lorenzosdogtrainingteam.com/contact" }, { lead_id: LEAD_ID });
  assert.equal(pending().lead_id, LEAD_ID, "the page URL alone is enough");

  context.window.LDTT_PENDING_CONTACT_LEAD = null;
  remember({ source_page: "contact.html" }, { lead_id: "" });
  assert.equal(pending(), null, "no lead id, nothing remembered");
});

// ---------------------------------------------------------------------------
// The new code sits outside the frozen blocks
// ---------------------------------------------------------------------------
test("none of the new code is inside a frozen block, and the frozen blocks call none of it", () => {
  const frozen = {
    relayFormDeliveries: block("const relayFormDeliveries=", "\n};\n"),
    contactHandler: block("const contactForm=document.querySelector", "document.querySelectorAll('a[href=\"contact.html#form\"]')"),
    deliveryObject: block("window.LDTT_FORM_DELIVERY={", "};"),
    submitEmailRelay: block("const submitEmailRelay=", "\n};\n"),
    wireAsyncForm: block("const wireAsyncForm=", "const relayFormDeliveries=")
  };
  for (const [name, text] of Object.entries(frozen)) {
    for (const added of ["LDTT_CONTACT_HANDOFF", "LDTT_PENDING_CONTACT_LEAD", "rememberContactLead", "wireContactZipRequired", "/api/pipeline", "CONTACT_ZIP_"]) {
      assert.ok(!text.includes(added), `${name} must not mention ${added}`);
    }
  }
  // The practice-copy listener stays practice-only and still never touches the office's delivery (rule 73).
  const practice = block("const enterPracticePipeline=", "const updateStoredDelivery=");
  assert.match(practice, /publicEnvironment\.then\(env=>\{\n  if\(!env\?\.sandbox\) return;/);
  assert.ok(!/formsubmit|form-delivery|relayFormDeliveries\(/i.test(practice));
});
