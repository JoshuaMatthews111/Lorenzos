// Page Studio — full-screen ad landing page editor for the staff portal.
//
// What it does
//   1. Gives the EXISTING trainer page builder a true full-screen mode (a
//      button in its top bar; Esc returns) with a collapsible controls rail.
//   2. Adds "Page Studio": a full-screen overlay editor for paid-ad landing
//      pages stored in the ad_pages table. Edits autosave to the draft; Publish
//      makes /ads/<slug> serve the page within a minute, with no code deploy.
//
// How it stays safe
//   - The office edits structured fields only; the page is rendered by the
//     same lib/ad-page-template.js the static pages and the /ads route use,
//     and that template escapes everything.
//   - Publish runs the template's checklist first and refuses with plain
//     sentences. Every publish keeps a revision; any one can be restored.
//
// This file is self-contained: it registers on window.LDTT_PAGE_STUDIO and
// app.js only calls screen() for the launcher. It never edits app.js state.
(function () {
  "use strict";
  const VERSION = "20260905practice";
  const API = "/api/ad-pages";
  const LIB_SCRIPTS = ["/lib/ad-page-markets.js", "/lib/ad-page-image-aspects.js", "/lib/ad-page-template.js"];
  const store = { pages: null, markets: [], sandbox: false, loading: false, error: "" };
  let template = null;
  let editor = null;
  let toastTimer = null;

  // ───────────────────────── helpers ─────────────────────────
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const timeLabel = value => { const d = value ? new Date(value) : new Date(); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
  const dateLabel = value => { if (!value) return ""; const d = new Date(value); return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeLabel(d)}`; };
  const token = () => window.LDTT_PORTAL?.accessToken?.() || "";
  const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
  const clone = value => JSON.parse(JSON.stringify(value));

  function toast(message, ms = 3200) {
    let el = $("#psToast");
    if (!el) { el = document.createElement("div"); el.id = "psToast"; el.className = "ps-toast"; document.body.appendChild(el); }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms);
  }

  // ───────────────────────── send-to-live ─────────────────────────
  // Sandbox only: copy a practice page to the live database as a DRAFT.
  // Publishing stays on the live portal. Live side: tag drafts that came in this way.
  const SEND_TO_LIVE_CONFIRM = "This copies the page to the live portal as a DRAFT. It will not be public until someone presses Publish on the live portal. Continue?";
  const SEND_TO_LIVE_WARNING = "You are copying this to the LIVE portal. It arrives as a DRAFT and is not public until someone presses Publish on the live portal. One page per click.";
  const canSendToLive = () => (typeof window.LDTT_CAN_SEND_TO_LIVE === "function" ? window.LDTT_CAN_SEND_TO_LIVE() : true);
  const sentToLiveLabel = at => (at ? `Sent to live ✓ at ${dateLabel(at)}` : "");
  const isFromPractice = page => !window.LDTT_IS_SANDBOX && /from practice copy/i.test(String(page?.updated_by || ""));
  const practiceTag = page => (isFromPractice(page) ? `<span class="ps-pill practice" title="This draft was sent here from the practice copy. Review it, then publish.">From practice copy</span>` : "");
  const sentToLiveMeta = page => (window.LDTT_IS_SANDBOX && page?.sent_to_live_at ? `<span class="ps-meta ps-sent-live">${esc(sentToLiveLabel(page.sent_to_live_at))}</span>` : "");
  function sendToLiveButton(page, cls = "btn btn-navy") {
    if (!window.LDTT_IS_SANDBOX) return "";
    const allowed = canSendToLive();
    const title = allowed ? "Copy this page to the live portal as a draft" : "Only a Super Admin or Office Admin can send a page to live";
    return `<button class="${cls}" type="button" data-ps-send-live="${esc(page.id)}" title="${esc(title)}" ${allowed ? "" : "disabled"}>Send to live</button>`;
  }
  function confirmSendToLive() {
    return new Promise(resolve => {
      const m = modal(`<h3>Send to live?</h3><div class="ps-warning" role="alert"><strong>Warning</strong>${esc(SEND_TO_LIVE_WARNING)}</div><p class="ps-help">${esc(SEND_TO_LIVE_CONFIRM)}</p><div class="ps-actions"><button type="button" class="ps-btn" data-ps-close>Not yet</button><button type="button" class="ps-btn red" data-ps-go>Send to live as a draft</button></div>`);
      m.querySelector("[data-ps-close]").addEventListener("click", () => { m.remove(); resolve(false); });
      m.querySelector("[data-ps-go]").addEventListener("click", () => { m.remove(); resolve(true); });
      m.addEventListener("click", event => { if (event.target === m) resolve(false); });
    });
  }
  async function sendToLiveFlow(pageId) {
    if (!(await confirmSendToLive())) return;
    if (editor && editor.id === pageId) await flushSave();
    const response = await fetch("/api/send-to-live", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ kind: "ad_page", id: pageId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `Send to live failed (${response.status}).`);
    toast(data.message || "Sent to live as a draft. Open the live portal → Page Studio to publish it.", 6000);
    if (editor && editor.id === pageId) { editor.page.sent_to_live_at = data.sent_at || new Date().toISOString(); paintTop(); }
    loadPages(true);
  }

  function loadCss() {
    if ($("#psCss")) return;
    const link = document.createElement("link");
    link.id = "psCss"; link.rel = "stylesheet"; link.href = `/trainer-backoffice/page-studio.css?v=${VERSION}`;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `${src}?v=${VERSION}`; s.onload = resolve; s.onerror = () => reject(new Error(`${src} did not load`));
      document.head.appendChild(s);
    });
  }

  async function ensureTemplate() {
    if (template) return template;
    for (const src of LIB_SCRIPTS) await loadScript(src);
    template = window.LDTT_AD_PAGE_TEMPLATE;
    if (!template) throw new Error("The page template did not load. Refresh and try again.");
    return template;
  }

  async function api(payload, method = "POST") {
    const response = await fetch(method === "GET" ? `${API}?operation=${encodeURIComponent(payload.operation || "list")}` : API, {
      method, cache: "no-store",
      headers: { Authorization: `Bearer ${token()}`, ...(method === "GET" ? {} : { "Content-Type": "application/json" }) },
      ...(method === "GET" ? {} : { body: JSON.stringify(payload) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || `Page Studio request failed (${response.status}).`);
      error.status = response.status; error.data = data;
      throw error;
    }
    return data;
  }

  function imageAspect(path) { return window.LDTT_AD_PAGE_IMAGE_ASPECTS?.[path] || null; }
  function photoChoices() { return Object.keys(window.LDTT_AD_PAGE_IMAGE_ASPECTS || {}).filter(p => /\.(jpe?g|png|webp)$/i.test(p)); }

  // ───────────────────────── launcher (inside the portal) ─────────────────────────
  async function loadPages(force = false) {
    if (store.loading || (store.pages && !force)) return;
    store.loading = true; store.error = "";
    paintLauncher();
    try {
      const data = await api({ operation: "list" }, "GET");
      store.pages = data.pages || []; store.markets = data.markets || []; store.sandbox = Boolean(data.sandbox);
    } catch (error) {
      store.error = error.message; store.pages = store.pages || [];
    } finally {
      store.loading = false;
      paintLauncher();
    }
  }

  function screen() {
    loadCss();
    return `<div id="pageStudioRoot" class="ps-launcher">${launcherHtml()}</div>`;
  }

  function launcherHtml() {
    const pages = store.pages || [];
    const cards = pages.map(page => `<article class="ps-page-card">
        <div><span class="ps-pill ${page.status === "published" ? "published" : "draft"}">${page.status === "published" ? "Live" : "Draft"}</span></div>
        <strong>${esc(page.market || page.slug)}</strong>
        <span class="ps-addr">/ads/${esc(page.slug)}</span>
        <span class="ps-meta">Updated ${esc(dateLabel(page.updated_at))}${page.updated_by ? ` by ${esc(page.updated_by)}` : ""}${page.published_at ? ` · Published ${esc(dateLabel(page.published_at))}` : ""}</span>
        ${practiceTag(page)}${sentToLiveMeta(page)}
        <div class="ps-actions">
          <button class="btn btn-red" type="button" data-ps-open="${esc(page.id)}">Edit full screen</button>
          ${page.status === "published" ? `<a class="btn btn-outline" href="/ads/${esc(page.slug)}" target="_blank" rel="noopener">Open live page</a>` : ""}
          <button class="btn btn-outline" type="button" data-ps-duplicate-page="${esc(page.id)}">Duplicate</button>
          ${sendToLiveButton(page)}
        </div>
      </article>`).join("");
    const statics = (store.markets || []).map(market => `<article class="ps-page-card">
        <div><span class="ps-pill static">Built into the site</span></div>
        <strong>${esc(market.market)}</strong>
        <span class="ps-addr">/${esc(market.slug)}</span>
        <span class="ps-meta">Static page from the build. Duplicate it to edit a copy here.</span>
        <div class="ps-actions">
          <a class="btn btn-outline" href="/${esc(market.slug)}" target="_blank" rel="noopener">Open</a>
          <button class="btn btn-outline" type="button" data-ps-duplicate-market="${esc(market.slug)}">Duplicate into Page Studio</button>
        </div>
      </article>`).join("");
    return `
      <section class="ps-launcher-hero">
        <div><p class="portal-tag" style="color:#ffd166">Page Studio</p><h2>Ad landing pages, edited full screen. Live in a minute, no code deploy.</h2>
        <p>Pick a market, get a finished page in the same format as the ones already running, change the words, font and sections, and publish. Every publish keeps a version you can put back.${store.sandbox ? " <b>Sandbox:</b> drafts are practice only and Publish is switched off here." : ""}</p></div>
        <div style="display:grid;gap:10px">
          <button class="ps-big-btn" type="button" data-ps-new>+ New ad page</button>
          <button class="ps-big-btn ghost on-dark" type="button" data-ps-refresh>Refresh list</button>
        </div>
      </section>
      ${store.error ? `<div class="ps-empty" style="color:#8a0b1f;border-color:#f1c2ca;background:#fff1f3">${esc(store.error)}</div>` : ""}
      <section class="panel pad"><div class="panel-head"><h2>Your ad pages</h2></div>
        ${store.loading && !pages.length ? `<div class="ps-empty">Loading…</div>` : pages.length ? `<div class="ps-page-grid">${cards}</div>` : `<div class="ps-empty">No Page Studio pages yet. Click <b>+ New ad page</b> to make the first one — it takes about a minute.</div>`}
      </section>
      <section class="panel pad"><div class="panel-head"><h2>Market pages built into the site</h2></div>
        ${statics ? `<div class="ps-page-grid">${statics}</div>` : `<div class="ps-empty">${store.loading ? "Loading…" : "The built-in market list loads with the page list."}</div>`}
      </section>`;
  }

  function paintLauncher() {
    const root = $("#pageStudioRoot");
    if (root) root.innerHTML = launcherHtml();
  }

  // ───────────────────────── existing builder: full-screen mode ─────────────────────────
  function decorateBuilder() {
    const shell = $(".page-editor-shell.fullscreen-builder");
    if (!shell) { document.body.classList.remove("ps-builder-fullscreen"); return; }
    const actions = $(".page-editor-topbar .row-actions", shell);
    if (!actions || $("[data-ps-builder-fullscreen]", actions)) return;
    loadCss();
    const on = document.body.classList.contains("ps-builder-fullscreen");
    const fs = document.createElement("button");
    fs.type = "button"; fs.className = `btn btn-outline ps-fs-btn${on ? " is-on" : ""}`; fs.dataset.psBuilderFullscreen = "1";
    fs.textContent = on ? "Exit Full Screen (Esc)" : "⛶ Full Screen";
    const rail = document.createElement("button");
    rail.type = "button"; rail.className = "btn btn-outline ps-rail-btn"; rail.dataset.psBuilderRail = "1";
    rail.textContent = document.body.classList.contains("ps-rail-hidden") ? "Show Controls" : "Hide Controls";
    actions.prepend(rail); actions.prepend(fs);
  }

  function setBuilderFullscreen(on) {
    document.body.classList.toggle("ps-builder-fullscreen", on);
    if (!on) document.body.classList.remove("ps-rail-hidden");
    try { localStorage.setItem("ps-builder-fullscreen", on ? "1" : ""); } catch { /* private mode */ }
    $$("[data-ps-builder-fullscreen]").forEach(btn => { btn.textContent = on ? "Exit Full Screen (Esc)" : "⛶ Full Screen"; btn.classList.toggle("is-on", on); });
    $$("[data-ps-builder-rail]").forEach(btn => { btn.textContent = document.body.classList.contains("ps-rail-hidden") ? "Show Controls" : "Hide Controls"; });
  }

  // ───────────────────────── editor state ─────────────────────────
  const SECTION_LABEL = type => (template?.SECTION_TYPES.find(t => t.type === type)?.label || type);

  async function openEditor(pageId) {
    loadCss();
    await ensureTemplate();
    const data = await api({ operation: "get", id: pageId });
    const page = data.page;
    const draft = template.normalizeContent(page.draft_content || {});
    let local = null;
    try { local = JSON.parse(localStorage.getItem(`ps-draft-${page.id}`) || "null"); } catch { local = null; }
    if (local && local.draft_revision === page.draft_revision && JSON.stringify(local.content) !== JSON.stringify(draft) && window.confirm("You have unsaved changes for this page from earlier in this browser. Put them back?")) {
      Object.assign(draft, template.normalizeContent(local.content));
    }
    editor = {
      id: page.id, page, draft, savedJson: JSON.stringify(draft), draftRevision: Number(page.draft_revision || 1),
      revisions: data.revisions || [], sandbox: Boolean(data.sandbox),
      status: "saved", savedAt: page.updated_at, tab: "sections", device: "desktop", selectedId: "hero", openId: "hero", frameScroll: 0
    };
    mountOverlay();
    paintAll();
  }

  function closeEditor() {
    if (!editor) return;
    if (editor.status === "dirty" || editor.status === "saving") {
      flushSave();
    }
    $("#psOverlay")?.remove();
    document.body.classList.remove("ps-open");
    editor = null;
    loadPages(true);
  }

  function mountOverlay() {
    $("#psOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "psOverlay"; overlay.className = "ps-overlay";
    overlay.innerHTML = `
      <header class="ps-top">
        <button type="button" data-ps-act="close" title="Back to the portal (Esc)">← Close</button>
        <button type="button" data-ps-act="rail" title="Show or hide the controls">☰ Controls</button>
        <div class="ps-title"><strong id="psTitle"></strong><span id="psAddr"></span></div>
        <span class="ps-status" id="psStatus">Saved</span>
        <div class="ps-seg"><button type="button" data-ps-device="desktop" class="active">Desktop</button><button type="button" data-ps-device="mobile">Mobile</button></div>
        <span id="psSendLive"></span>
        <button type="button" data-ps-act="preview">Preview draft</button>
        <button type="button" class="ps-primary" data-ps-act="publish" id="psPublishBtn">Publish</button>
      </header>
      <div class="ps-body">
        <aside class="ps-rail">
          <nav class="ps-tabs">${[["sections", "Sections"], ["page", "Page"], ["style", "Style"], ["history", "History"]].map(([id, label]) => `<button type="button" data-ps-tab="${id}">${label}</button>`).join("")}</nav>
          <div class="ps-rail-scroll" id="psRail"></div>
        </aside>
        <main class="ps-canvas" id="psCanvas">
          <div class="ps-canvas-bar"><span>Live preview · click any section to edit it</span><b id="psCanvasLabel">Desktop</b></div>
          <div class="ps-frame-wrap"><iframe id="psFrame" title="Ad page live preview"></iframe></div>
        </main>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add("ps-open");
    overlay.addEventListener("click", onOverlayClick);
    overlay.addEventListener("input", onFieldInput);
    overlay.addEventListener("change", onFieldInput);
  }

  function paintAll() { paintTop(); paintRail(); paintCanvas(); }

  function paintTop() {
    if (!editor) return;
    $("#psTitle").textContent = editor.draft.title || editor.draft.market || "Untitled page";
    $("#psAddr").textContent = `/ads/${editor.draft.slug || "…"}`;
    $$("[data-ps-device]").forEach(btn => btn.classList.toggle("active", btn.dataset.psDevice === editor.device));
    $$("[data-ps-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.psTab === editor.tab));
    const publish = $("#psPublishBtn");
    // Practice copy: publishing works there too — it publishes the practice
    // page at /ads/<slug> on the practice deployment, never on the real site.
    publish.disabled = false;
    publish.textContent = editor.page.status === "published" ? "Publish changes" : editor.sandbox ? "Publish (practice copy)" : "Publish";
    // send-to-live: sandbox gets the button (+ last sent time); live gets the origin tag.
    const sendSlot = $("#psSendLive");
    if (sendSlot) sendSlot.innerHTML = editor.sandbox ? `${sendToLiveButton(editor.page, "ps-send-live")}${editor.page.sent_to_live_at ? `<small class="ps-sent-live">${esc(sentToLiveLabel(editor.page.sent_to_live_at))}</small>` : ""}` : practiceTag(editor.page);
    paintStatus();
  }

  function paintStatus() {
    const el = $("#psStatus");
    if (!el || !editor) return;
    const map = {
      saved: ["saved", `Saved ${timeLabel(editor.savedAt)}`],
      saving: ["saving", "Saving…"],
      dirty: ["dirty", "Unsaved changes"],
      error: ["error", "Not saved — click to retry"]
    };
    const [cls, label] = map[editor.status] || map.saved;
    el.className = `ps-status ${cls}`;
    el.textContent = label;
    el.title = editor.errorMessage || "";
  }

  // ───────────────────────── rail ─────────────────────────
  const field = (label, path, value, opts = {}) => {
    const attr = `data-ps-field="${esc(path)}"${opts.list ? ' data-ps-list="1"' : ""}`;
    if (opts.type === "textarea" || opts.list) return `<label class="ps-field"><span>${esc(label)}${opts.list ? " <small style='font-weight:600;color:#64758d'>(one per line)</small>" : ""}</span><textarea ${attr} ${opts.rows ? `rows="${opts.rows}"` : ""}>${esc(opts.list ? (value || []).join("\n") : value)}</textarea></label>`;
    if (opts.type === "select") return `<label class="ps-field"><span>${esc(label)}</span><select ${attr}>${opts.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value ?? "") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
    if (opts.type === "checkbox") return `<label class="ps-field inline"><input type="checkbox" ${attr} ${value ? "checked" : ""}><span>${esc(label)}</span></label>`;
    if (opts.type === "color") return `<label class="ps-field"><span>${esc(label)}</span><div class="ps-row"><input type="color" ${attr} value="${esc(value || "#152569")}"><input type="text" ${attr} value="${esc(value || "")}" placeholder="#RRGGBB"></div></label>`;
    return `<label class="ps-field"><span>${esc(label)}</span><input ${attr} value="${esc(value)}" ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ""}></label>`;
  };

  function sectionFields(section, index) {
    const p = key => `sections.${index}.${key}`;
    switch (section.type) {
      case "proof":
        return section.stats.map((stat, i) => `<div class="ps-row">${field(`Number ${i + 1}`, `${p("stats")}.${i}.value`, stat.value)}${field("Label", `${p("stats")}.${i}.label`, stat.label)}</div>`).join("");
      case "path":
        return `${field("Eyebrow", p("eyebrow"), section.eyebrow)}${field("Heading", p("heading"), section.heading)}${field("Intro paragraph", p("text"), section.text, { type: "textarea" })}
          ${section.services.map((s, i) => `<div class="ps-item"><div class="ps-item-head"><span>Path 0${i + 1}</span></div>${field("Title", `${p("services")}.${i}.title`, s.title)}${field("Description", `${p("services")}.${i}.text`, s.text, { type: "textarea", rows: 3 })}</div>`).join("")}`;
      case "pricing":
        return `${field("Show prices?", p("mode"), section.mode, { type: "select", options: [["quiet", "Guarantee only (no prices)"], ["forward", "Published prices + guarantee"]] })}<p class="ps-help">The prices and guarantee wording are fixed company copy, so they read the same on every market page.</p>`;
      case "care":
        return `${field("Eyebrow", p("eyebrow"), section.eyebrow)}${field("Heading", p("heading"), section.heading)}${field("Paragraph", p("text"), section.text, { type: "textarea", rows: 5 })}${field("Button text", p("button"), section.button)}${photoPicker("Photo", p("photo"), section.photo)}${field("Photo description (alt text)", p("photoAlt"), section.photoAlt)}`;
      case "testi":
        return `${field("Eyebrow", p("eyebrow"), section.eyebrow)}${field("Heading", p("heading"), section.heading)}
          ${section.items.map((item, i) => `<div class="ps-item"><div class="ps-item-head"><span>Card 0${i + 1}</span><button type="button" class="ps-icon-btn danger" data-ps-act="remove-item" data-index="${index}" data-item="${i}" title="Remove this card">✕</button></div>${field("Title", `${p("items")}.${i}.h`, item.h)}${field("Text", `${p("items")}.${i}.p`, item.p, { type: "textarea", rows: 2 })}</div>`).join("")}
          <button type="button" class="ps-btn" data-ps-act="add-item" data-index="${index}">+ Add a card</button>`;
      case "faq":
        return `${field("Eyebrow", p("eyebrow"), section.eyebrow)}${field("Heading", p("heading"), section.heading)}
          ${section.items.map((item, i) => `<div class="ps-item"><div class="ps-item-head"><span>Question ${i + 1}</span><button type="button" class="ps-icon-btn danger" data-ps-act="remove-item" data-index="${index}" data-item="${i}" title="Remove">✕</button></div>${field("Question", `${p("items")}.${i}.q`, item.q)}${field("Answer", `${p("items")}.${i}.a`, item.a, { type: "textarea", rows: 3 })}</div>`).join("")}
          <button type="button" class="ps-btn" data-ps-act="add-item" data-index="${index}">+ Add a question</button>`;
      case "guide":
        return `${field("Eyebrow", p("eyebrow"), section.eyebrow)}${field("Heading", p("heading"), section.heading)}${field("Guide name (bold)", p("bookTitle"), section.bookTitle)}${field("Text after the guide name", p("text"), section.text, { type: "textarea", rows: 3 })}<p class="ps-help">The download form and its consent wording are fixed.</p>`;
      case "cta":
        return `${field("Heading", p("heading"), section.heading)}${field("Text", p("text"), section.text, { type: "textarea", rows: 2 })}${field("Button text", p("button"), section.button)}<p class="ps-help">City reviews published from the Reviews tab show above this band automatically.</p>`;
      case "trainers":
        return `${field("Eyebrow", p("eyebrow"), section.eyebrow)}${field("Heading", p("heading"), section.heading)}${field("Paragraph", p("text"), section.text, { type: "textarea", rows: 4 })}<p class="ps-help">The trainer names come from the Page tab (“Trainers”).</p>`;
      case "custom":
        return `${field("Eyebrow (optional)", p("eyebrow"), section.eyebrow)}${field("Heading", p("heading"), section.heading)}${field("Paragraph", p("text"), section.text, { type: "textarea", rows: 5 })}${field("Button text (blank = no button)", p("button"), section.button)}`;
      default:
        return "";
    }
  }

  function photoPicker(label, path, value) {
    const choices = photoChoices();
    return `<div class="ps-field"><span>${esc(label)}</span>
      <div class="ps-photo-grid">${choices.map(p => `<button type="button" class="${p === value ? "selected" : ""}" data-ps-photo="${esc(path)}" data-src="${esc(p)}" style="background-image:url('/${esc(p)}')" title="${esc(p)}"></button>`).join("")}</div>
      <input data-ps-field="${esc(path)}" value="${esc(value || "")}" placeholder="assets/market-photos/… or https://…"></div>`;
  }

  function heroFields() {
    const h = editor.draft.hero;
    return `${field("Big headline (H1)", "hero.h1", h.h1, { type: "textarea", rows: 3 })}
      ${field("Hook line (bold strip under the headline)", "hero.hook", h.hook, { type: "textarea", rows: 3 })}
      ${field("Giant background word", "hero.word", h.word, { placeholder: "e.g. AGGRESSION" })}
      ${field("Benefit pills", "hero.benefits", h.benefits, { list: true, rows: 3 })}
      ${field("Problem chips", "hero.issues", h.issues, { list: true, rows: 4 })}
      ${field("Check list", "hero.checks", h.checks, { list: true, rows: 5 })}
      ${field("Show the price pill?", "hero.priceMode", h.priceMode, { type: "select", options: [["quiet", "No"], ["forward", "Yes — “Training from $1,250”"]] })}
      ${photoPicker("Hero photo", "hero.photo", h.photo)}
      ${field("Photo title", "hero.photoName", h.photoName)}${field("Photo caption", "hero.photoCaption", h.photoCaption)}
      ${field("Designed panel instead of a photo", "hero.casePanel", h.casePanel, { type: "select", options: template.CASE_PANELS.map(c => [c.id, c.label]) })}
      <p class="ps-help">The lead form, phone number, Google tag and Meta pixel are part of every page and cannot be removed.</p>`;
  }

  function paintRail() {
    if (!editor) return;
    const rail = $("#psRail");
    const d = editor.draft;
    $$("[data-ps-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.psTab === editor.tab));
    if (editor.tab === "sections") {
      const heroOpen = editor.openId === "hero";
      const rows = d.sections.map((section, index) => {
        const open = editor.openId === section.id;
        return `<article class="ps-section ${editor.selectedId === section.id ? "selected" : ""}" data-ps-section-row="${esc(section.id)}">
          <div class="ps-section-head" data-ps-act="select" data-id="${esc(section.id)}">
            <strong>${index + 2}. ${esc(SECTION_LABEL(section.type))}</strong>
            <button type="button" class="ps-icon-btn" data-ps-act="move" data-index="${index}" data-dir="-1" title="Move up" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="ps-icon-btn" data-ps-act="move" data-index="${index}" data-dir="1" title="Move down" ${index === d.sections.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="ps-icon-btn" data-ps-act="duplicate" data-index="${index}" title="Duplicate">⧉</button>
            <button type="button" class="ps-icon-btn danger" data-ps-act="remove" data-index="${index}" title="Remove">✕</button>
          </div>
          ${open ? `<div class="ps-section-body">${sectionFields(section, index)}</div>` : ""}
        </article>`;
      }).join("");
      rail.innerHTML = `
        <h3>Sections</h3>
        <p class="ps-help">Click a section here or in the preview to edit it. Use the arrows to reorder, ⧉ to duplicate, ✕ to remove.</p>
        <div class="ps-section-list">
          <article class="ps-section ${editor.selectedId === "hero" ? "selected" : ""}" data-ps-section-row="hero">
            <div class="ps-section-head" data-ps-act="select" data-id="hero"><strong>1. Hero + lead form</strong><small>always first</small></div>
            ${heroOpen ? `<div class="ps-section-body">${heroFields()}</div>` : ""}
          </article>
          ${rows}
        </div>
        <h3 style="margin-top:18px">Add a section</h3>
        <div class="ps-add-grid">${template.SECTION_TYPES.map(t => `<button type="button" data-ps-act="add" data-type="${t.type}">${esc(t.label)}<small>${esc(t.help)}</small></button>`).join("")}</div>`;
    } else if (editor.tab === "page") {
      rail.innerHTML = `
        <h3>Page settings</h3>
        ${field("Page title (browser tab + Google)", "title", d.title)}
        ${field("Web address", "slug", d.slug, { placeholder: "dog-training-city-st" })}
        <p class="ps-help">The page will live at <b>/ads/${esc(d.slug || "…")}</b>. Letters, numbers and dashes only.</p>
        ${field("Search description (optional)", "description", d.description, { type: "textarea", rows: 3 })}
        <h3>Market</h3>
        ${field("Market name (shown on the page)", "market", d.market, { placeholder: "Toledo, OH" })}
        <div class="ps-row">${field("City", "city", d.city)}${field("State (2 letters)", "state", d.state)}</div>
        ${field("Service area sentence", "area", d.area, { type: "textarea", rows: 2 })}
        ${field("Trainers (names the office routes to)", "trainers", d.trainers)}
        ${field("Nearby places", "nearby", d.nearby, { list: true, rows: 4 })}
        ${field("ZIP codes", "zipCodes", d.zipCodes, { list: true, rows: 3 })}
        ${field("Spanish-speaking market (adds the Spanish strip)", "spanish", d.spanish, { type: "checkbox" })}
        <h3>Danger zone</h3>
        ${editor.page.status === "published" ? `<button type="button" class="ps-btn" data-ps-act="unpublish">Take this page offline</button>` : ""}
        <button type="button" class="ps-btn" style="color:#b00020;border-color:#f1c2ca" data-ps-act="archive">Remove this page</button>`;
    } else if (editor.tab === "style") {
      rail.innerHTML = `
        <h3>Fonts</h3>
        ${field("Headline font", "font", d.font, { type: "select", options: template.FONTS.map(f => [f.id, f.label]) })}
        ${field("Body font", "fontBody", d.fontBody, { type: "select", options: template.FONTS.map(f => [f.id, f.label]) })}
        <p class="ps-help">Fonts apply to the whole page. “Site default” is what every current market page uses.</p>
        <h3>Colours</h3>
        ${field("Design style", "arch", d.arch, { type: "select", options: template.ARCHES.map(a => [a.id, a.label]) })}
        ${field("Main colour", "mk1", d.mk1, { type: "color" })}
        ${field("Second colour", "mk2", d.mk2, { type: "color" })}
        ${field("Button accent (blank = the design's own)", "accent", d.accent, { type: "color" })}
        <button type="button" class="ps-btn" data-ps-act="clear-accent">Use the design's own button colour</button>`;
    } else if (editor.tab === "history") {
      const revs = editor.revisions || [];
      rail.innerHTML = `
        <h3>Versions</h3>
        <p class="ps-help">Every publish keeps a version. Restoring puts that version back into the draft; publish again to make it live.</p>
        <button type="button" class="ps-btn navy" data-ps-act="snapshot">Save a version of the draft now</button>
        <div style="height:12px"></div>
        ${revs.length ? revs.map(r => `<div class="ps-rev"><div><strong>${r.kind === "published" ? "Published" : "Draft"} v${esc(r.revision)}</strong><span>${esc(dateLabel(r.created_at))}${r.created_by ? ` · ${esc(r.created_by)}` : ""}</span></div><button type="button" class="ps-btn" data-ps-act="restore" data-rev="${esc(r.id)}">Restore this version</button></div>`).join("") : `<div class="ps-empty">No versions yet. The first publish creates one.</div>`}`;
    }
  }

  // ───────────────────────── canvas ─────────────────────────
  function paintCanvas() {
    if (!editor) return;
    const frame = $("#psFrame");
    const canvas = $("#psCanvas");
    canvas.classList.toggle("mobile", editor.device === "mobile");
    $("#psCanvasLabel").textContent = editor.device === "mobile" ? "Mobile (430px)" : "Desktop";
    let html = "";
    try {
      html = template.renderAdPage(editor.draft, { editor: true, base: "/", publicPath: `/ads/${editor.draft.slug}`, imageAspect });
    } catch (error) {
      html = `<p style="font-family:sans-serif;padding:20px">The preview could not render: ${esc(error.message)}</p>`;
    }
    const scroll = frame.contentWindow ? frame.contentWindow.scrollY : 0;
    editor.frameScroll = scroll || editor.frameScroll;
    frame.addEventListener("load", () => wireFrame(frame), { once: true });
    frame.srcdoc = html;
  }

  function wireFrame(frame) {
    const doc = frame.contentDocument;
    if (!doc || !editor) return;
    try { frame.contentWindow.scrollTo(0, editor.frameScroll || 0); } catch { /* ignore */ }
    doc.querySelectorAll("[data-ps-section]").forEach(el => {
      el.classList.toggle("ps-selected", el.dataset.psSection === editor.selectedId);
      el.addEventListener("click", event => {
        // Links and the form stay inert inside the editor; a click means "edit this".
        event.preventDefault();
        selectSection(el.dataset.psSection, { scroll: false });
      }, true);
    });
    doc.querySelectorAll("form").forEach(form => form.addEventListener("submit", e => e.preventDefault()));
  }

  function selectSection(id, { scroll = true } = {}) {
    if (!editor) return;
    editor.selectedId = id; editor.openId = id; editor.tab = "sections";
    paintTop(); paintRail();
    const row = $(`[data-ps-section-row="${CSS.escape(id)}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const doc = $("#psFrame")?.contentDocument;
    if (doc) {
      doc.querySelectorAll("[data-ps-section]").forEach(el => el.classList.toggle("ps-selected", el.dataset.psSection === id));
      if (scroll) doc.querySelector(`[data-ps-section="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const repaintCanvas = debounce(() => paintCanvas(), 220);

  // ───────────────────────── editing ─────────────────────────
  function setPath(path, value) {
    const parts = path.split(".");
    let node = editor.draft;
    for (let i = 0; i < parts.length - 1; i += 1) node = node[parts[i]];
    node[parts[parts.length - 1]] = value;
  }

  function markDirty({ rerail = false } = {}) {
    editor.status = "dirty";
    paintStatus();
    paintTop();
    if (rerail) paintRail();
    repaintCanvas();
    try { localStorage.setItem(`ps-draft-${editor.id}`, JSON.stringify({ draft_revision: editor.draftRevision, content: editor.draft, at: Date.now() })); } catch { /* ignore */ }
    scheduleSave();
  }

  function onFieldInput(event) {
    const el = event.target.closest("[data-ps-field]");
    if (!el || !editor) return;
    const path = el.dataset.psField;
    let value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.dataset.psList) value = el.value.split("\n").map(v => v.trim()).filter(Boolean);
    else value = el.value;
    if (el.type === "color" || (el.type === "text" && /^(mk1|mk2|accent)$/.test(path))) {
      // keep the twin (colour swatch + hex box) in sync
      $$(`[data-ps-field="${CSS.escape(path)}"]`).forEach(twin => { if (twin !== el && /^#[0-9a-f]{6}$/i.test(value)) twin.value = value; });
      if (!/^#[0-9a-f]{6}$/i.test(value) && value !== "") return;
    }
    if (path === "state") value = String(value).toUpperCase().slice(0, 2);
    if (path === "slug") value = template.safeSlug(value);
    setPath(path, value);
    if (/^(title|slug|market)$/.test(path)) paintTop();
    // Structural pickers redraw the rail so the twin controls agree; plain typing does not.
    const structural = event.type === "change" && (el.tagName === "SELECT" || el.type === "checkbox");
    markDirty({ rerail: structural });
  }

  async function onOverlayClick(event) {
    if (!editor) return;
    const photo = event.target.closest("[data-ps-photo]");
    if (photo) { setPath(photo.dataset.psPhoto, photo.dataset.src); markDirty({ rerail: true }); return; }
    const device = event.target.closest("[data-ps-device]");
    if (device) { editor.device = device.dataset.psDevice; paintTop(); paintCanvas(); return; }
    const tab = event.target.closest("[data-ps-tab]");
    if (tab) { editor.tab = tab.dataset.psTab; paintTop(); paintRail(); return; }
    const status = event.target.closest("#psStatus");
    if (status && editor.status === "error") { flushSave(); return; }
    const btn = event.target.closest("[data-ps-act]");
    if (!btn) return;
    const act = btn.dataset.psAct;
    const index = Number(btn.dataset.index);
    const d = editor.draft;
    switch (act) {
      case "close": closeEditor(); return;
      case "rail": $("#psOverlay").classList.toggle("ps-rail-collapsed"); return;
      case "select": selectSection(btn.dataset.id); return;
      case "add": {
        const section = template.blankSection(btn.dataset.type, { city: d.city, market: d.market, priceMode: d.hero.priceMode });
        if (!section) return;
        const at = editor.selectedId && editor.selectedId !== "hero" ? d.sections.findIndex(s => s.id === editor.selectedId) + 1 : d.sections.length;
        d.sections.splice(at, 0, section);
        editor.selectedId = section.id; editor.openId = section.id;
        markDirty({ rerail: true });
        toast(`${SECTION_LABEL(section.type)} added.`);
        return;
      }
      case "remove": {
        const section = d.sections[index];
        if (!section) return;
        d.sections.splice(index, 1);
        if (editor.selectedId === section.id) { editor.selectedId = "hero"; editor.openId = "hero"; }
        markDirty({ rerail: true });
        toast(`${SECTION_LABEL(section.type)} removed. Nothing is live until you publish.`);
        return;
      }
      case "duplicate": {
        const section = d.sections[index];
        if (!section) return;
        const copy = clone(section); copy.id = `${section.type}-${Math.random().toString(36).slice(2, 8)}`;
        d.sections.splice(index + 1, 0, copy);
        editor.selectedId = copy.id; editor.openId = copy.id;
        markDirty({ rerail: true });
        toast(`${SECTION_LABEL(section.type)} duplicated.`);
        return;
      }
      case "move": {
        const dir = Number(btn.dataset.dir);
        const target = index + dir;
        if (target < 0 || target >= d.sections.length) return;
        const [section] = d.sections.splice(index, 1);
        d.sections.splice(target, 0, section);
        markDirty({ rerail: true });
        return;
      }
      case "add-item": {
        const section = d.sections[index];
        section.items.push(section.type === "faq" ? { q: "", a: "" } : { h: "", p: "" });
        markDirty({ rerail: true });
        return;
      }
      case "remove-item": {
        const section = d.sections[index];
        section.items.splice(Number(btn.dataset.item), 1);
        markDirty({ rerail: true });
        return;
      }
      case "clear-accent": d.accent = ""; markDirty({ rerail: true }); return;
      case "preview": {
        try {
          btn.disabled = true;
          const data = await api({ operation: "preview", content: d });
          const w = window.open("", "_blank");
          if (!w) throw new Error("Your browser blocked the preview window. Allow pop-ups for this site.");
          w.document.open(); w.document.write(data.html); w.document.close();
        } catch (error) { toast(error.message); } finally { btn.disabled = false; }
        return;
      }
      case "publish": publishFlow(); return;
      case "snapshot": {
        try { await saveDraft({ snapshot: true }); toast("Version saved."); await refreshRevisions(); paintRail(); } catch (error) { toast(error.message); }
        return;
      }
      case "restore": {
        try {
          btn.disabled = true;
          const data = await api({ operation: "restore", id: editor.id, revision_id: btn.dataset.rev });
          editor.draft = template.normalizeContent(data.content);
          editor.draftRevision = Number(data.draft_revision || editor.draftRevision + 1);
          editor.savedJson = JSON.stringify(editor.draft); editor.status = "saved"; editor.savedAt = new Date().toISOString();
          editor.tab = "sections";
          paintAll();
          toast(data.message || "Version restored into the draft.");
        } catch (error) { btn.disabled = false; toast(error.message); }
        return;
      }
      case "unpublish": {
        if (!window.confirm("Take this page offline? Visitors will see a “not published” notice until you publish again. The draft is kept.")) return;
        try { const data = await api({ operation: "unpublish", id: editor.id }); editor.page.status = "draft"; paintTop(); paintRail(); toast(data.message); } catch (error) { toast(error.message); }
        return;
      }
      case "archive": {
        if (!window.confirm("Remove this page from Page Studio and take it off the site? You can ask a Super Admin to bring it back from the database.")) return;
        try { const data = await api({ operation: "archive", id: editor.id }); toast(data.message); editor.status = "saved"; closeEditor(); } catch (error) { toast(error.message); }
        return;
      }
      default:
    }
  }

  // ───────────────────────── saving ─────────────────────────
  const scheduleSave = debounce(() => flushSave(), 1500);
  let saveInFlight = null;

  async function saveDraft({ snapshot = false } = {}) {
    if (!editor) return;
    const body = JSON.stringify(editor.draft);
    editor.status = "saving"; paintStatus();
    const data = await api({ operation: "save_draft", id: editor.id, content: editor.draft, snapshot });
    editor.draftRevision = Number(data.draft_revision || editor.draftRevision + 1);
    editor.savedAt = data.saved_at || new Date().toISOString();
    if (data.page?.slug) editor.page.slug = data.page.slug;
    // Only "saved" if nothing changed while the request was out.
    editor.status = JSON.stringify(editor.draft) === body ? "saved" : "dirty";
    if (editor.status === "saved") editor.savedJson = body;
    try { localStorage.removeItem(`ps-draft-${editor.id}`); } catch { /* ignore */ }
    paintStatus();
    if (editor.status === "dirty") scheduleSave();
  }

  function flushSave() {
    if (!editor || saveInFlight) return saveInFlight;
    if (JSON.stringify(editor.draft) === editor.savedJson) { editor.status = "saved"; paintStatus(); return Promise.resolve(); }
    saveInFlight = saveDraft().catch(error => {
      if (!editor) return;
      editor.status = "error"; editor.errorMessage = error.message; paintStatus();
      toast(`Not saved — ${error.message}`, 5000);
    }).finally(() => { saveInFlight = null; });
    return saveInFlight;
  }

  async function refreshRevisions() {
    const data = await api({ operation: "get", id: editor.id });
    editor.revisions = data.revisions || [];
    editor.page = { ...editor.page, ...data.page, draft_content: undefined, published_content: undefined };
  }

  // ───────────────────────── publish ─────────────────────────
  function modal(html) {
    const wrap = document.createElement("div");
    wrap.className = "ps-modal"; wrap.innerHTML = `<div class="ps-modal-card">${html}</div>`;
    wrap.addEventListener("click", event => { if (event.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);
    return wrap;
  }

  async function publishFlow() {
    if (!editor) return;
    await flushSave();
    const result = template.publishChecklist(editor.draft, { base: "/", publicPath: `/ads/${editor.draft.slug}`, imageAspect });
    const list = `<div class="ps-checklist">${result.checks.map(c => `<div class="ps-check ${c.ok ? "ok" : "bad"}">${esc(c.ok ? c.label : c.fix)}</div>`).join("")}</div>`;
    if (!result.ok) {
      modal(`<h3>Not published yet — ${result.failures.length} thing${result.failures.length === 1 ? "" : "s"} to fix</h3><p class="ps-help">Nothing changed on the live site. Fix these and press Publish again.</p>${list}<div class="ps-actions"><button type="button" class="ps-btn navy" data-ps-close>OK</button></div>`)
        .querySelector("[data-ps-close]").addEventListener("click", e => e.target.closest(".ps-modal").remove());
      return;
    }
    const m = modal(`<h3>Publish this page?</h3><p class="ps-help">It goes live at <b>/ads/${esc(editor.draft.slug)}</b> within about a minute. The previous version is kept under History.</p>${list}<div class="ps-actions"><button type="button" class="ps-btn" data-ps-close>Not yet</button><button type="button" class="ps-btn red" data-ps-go>Publish now</button></div>`);
    m.querySelector("[data-ps-close]").addEventListener("click", () => m.remove());
    m.querySelector("[data-ps-go]").addEventListener("click", async event => {
      event.target.disabled = true; event.target.textContent = "Publishing…";
      try {
        const data = await api({ operation: "publish", id: editor.id, content: editor.draft });
        m.remove();
        editor.page.status = "published"; editor.page.slug = editor.draft.slug;
        editor.savedJson = JSON.stringify(editor.draft); editor.status = "saved"; editor.savedAt = new Date().toISOString();
        await refreshRevisions().catch(() => {});
        paintAll();
        const done = modal(`<h3>Published</h3><p class="ps-help">${esc(data.message || "The page is live.")}</p><div class="ps-actions"><a class="ps-btn navy" href="${esc(data.url || `/ads/${editor.draft.slug}`)}" target="_blank" rel="noopener" style="text-decoration:none">Open the live page</a><button type="button" class="ps-btn" data-ps-close>Keep editing</button></div>`);
        done.querySelector("[data-ps-close]").addEventListener("click", () => done.remove());
      } catch (error) {
        m.remove();
        const fails = error.data?.checklist?.failures || [];
        modal(`<h3>Not published</h3><p class="ps-help">${esc(error.message)}</p>${fails.length ? `<div class="ps-checklist">${fails.map(f => `<div class="ps-check bad">${esc(f.fix)}</div>`).join("")}</div>` : ""}<div class="ps-actions"><button type="button" class="ps-btn navy" data-ps-close>OK</button></div>`)
          .querySelector("[data-ps-close]").addEventListener("click", e => e.target.closest(".ps-modal").remove());
      }
    });
  }

  // ───────────────────────── new page / duplicate ─────────────────────────
  async function newPageFlow(preset = {}) {
    loadCss();
    try { await ensureTemplate(); } catch (error) { toast(error.message); return; }
    if (!store.pages) await loadPages();
    const marketOptions = template.markets.map(m => `<option value="${esc(m.slug)}" ${m.slug === (preset.templateSlug || "dog-training-columbus-oh") ? "selected" : ""}>${esc(m.market)} (${esc(m.arch)})</option>`).join("");
    const dupOptions = [
      ...(store.pages || []).map(p => `<option value="page:${esc(p.id)}">${esc(p.market || p.slug)} — Page Studio</option>`),
      ...template.markets.map(m => `<option value="market:${esc(m.slug)}" ${preset.duplicateMarket === m.slug ? "selected" : ""}>${esc(m.market)} — built-in page</option>`)
    ].join("");
    const mode = preset.duplicateMarket || preset.duplicatePage ? "dup" : "market";
    const m = modal(`
      <h3>New ad page</h3>
      <p class="ps-help">Start from a market template (same format as the pages already running) or duplicate an existing page.</p>
      <div class="ps-start-grid">
        <button type="button" data-mode="market" class="${mode === "market" ? "active" : ""}">New market<small>Pick city + state, choose a template</small></button>
        <button type="button" data-mode="dup" class="${mode === "dup" ? "active" : ""}">Duplicate a page<small>Copy any page and change it</small></button>
      </div>
      <div data-pane="market" ${mode === "market" ? "" : "hidden"}>
        <div class="ps-row"><label class="ps-field"><span>City</span><input name="city" placeholder="Toledo" value="${esc(preset.city || "")}"></label><label class="ps-field"><span>State (2 letters)</span><input name="state" maxlength="2" placeholder="OH" value="${esc(preset.state || "")}"></label></div>
        <label class="ps-field"><span>Template (which live page to copy the format of)</span><select name="template">${marketOptions}</select></label>
      </div>
      <div data-pane="dup" ${mode === "dup" ? "" : "hidden"}>
        <label class="ps-field"><span>Page to duplicate</span><select name="source">${dupOptions}</select></label>
        <div class="ps-row"><label class="ps-field"><span>New city (optional)</span><input name="dupcity" placeholder="Keep the same"></label><label class="ps-field"><span>New state</span><input name="dupstate" maxlength="2" placeholder="OH"></label></div>
      </div>
      <label class="ps-field"><span>Web address</span><input name="slug" placeholder="dog-training-toledo-oh" value="${esc(preset.slug || "")}"></label>
      <p class="ps-help">Leave blank to build it from the city and state.</p>
      <div class="ps-actions"><button type="button" class="ps-btn" data-ps-close>Cancel</button><button type="button" class="ps-btn red" data-ps-go>Create page</button></div>`);
    let current = mode;
    m.querySelectorAll("[data-mode]").forEach(btn => btn.addEventListener("click", () => {
      current = btn.dataset.mode;
      m.querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("active", b === btn));
      m.querySelectorAll("[data-pane]").forEach(p => { p.hidden = p.dataset.pane !== current; });
    }));
    m.querySelector("[data-ps-close]").addEventListener("click", () => m.remove());
    m.querySelector("[data-ps-go]").addEventListener("click", async event => {
      const get = name => m.querySelector(`[name="${name}"]`).value.trim();
      try {
        event.target.disabled = true; event.target.textContent = "Creating…";
        let content;
        if (current === "market") {
          const city = get("city"), state = get("state").toUpperCase();
          if (!city || state.length !== 2) throw new Error("Type the city and the two-letter state.");
          content = template.contentForNewMarket({ city, state, templateSlug: get("template"), slug: get("slug") });
        } else {
          const source = get("source");
          if (source.startsWith("market:")) {
            const market = template.markets.find(x => x.slug === source.slice(7));
            content = template.marketToContent(market);
          } else {
            const data = await api({ operation: "get", id: source.slice(5) });
            content = template.normalizeContent(data.page.draft_content);
          }
          const city = get("dupcity"), state = get("dupstate").toUpperCase();
          if (city && state.length === 2) {
            // Re-place the copy in a new market, keeping its design and sections.
            const templateSlug = content.slug;
            content = template.contentForNewMarket({ city, state, templateSlug: template.markets.some(x => x.slug === templateSlug) ? templateSlug : "dog-training-columbus-oh", slug: get("slug") });
          } else {
            content.slug = template.safeSlug(get("slug")) || `${content.slug}-copy`;
            content.hq = false; content.hero.resultsVideo = false;
          }
        }
        if (get("slug")) content.slug = template.safeSlug(get("slug"));
        const data = await api({ operation: "create", content });
        m.remove();
        toast(data.message || "Page created.");
        store.pages = null;
        await openEditor(data.page.id);
      } catch (error) {
        event.target.disabled = false; event.target.textContent = "Create page";
        toast(error.message, 5000);
      }
    });
  }

  // ───────────────────────── wiring into the portal ─────────────────────────
  document.addEventListener("click", async event => {
    const open = event.target.closest("[data-ps-open]");
    if (open) { try { await openEditor(open.dataset.psOpen); } catch (error) { toast(error.message, 5000); } return; }
    if (event.target.closest("[data-ps-new]")) { newPageFlow(); return; }
    if (event.target.closest("[data-ps-refresh]")) { loadPages(true); return; }
    const dupMarket = event.target.closest("[data-ps-duplicate-market]");
    if (dupMarket) { newPageFlow({ duplicateMarket: dupMarket.dataset.psDuplicateMarket }); return; }
    const dupPage = event.target.closest("[data-ps-duplicate-page]");
    if (dupPage) { newPageFlow({ duplicatePage: dupPage.dataset.psDuplicatePage }); return; }
    const sendLive = event.target.closest("[data-ps-send-live]");
    if (sendLive) {
      if (sendLive.disabled) return;
      sendLive.disabled = true;
      try { await sendToLiveFlow(sendLive.dataset.psSendLive); } catch (error) { toast(`Not sent: ${error.message}`, 6000); }
      finally { sendLive.disabled = false; }
      return;
    }
    if (event.target.closest("[data-ps-builder-fullscreen]")) { setBuilderFullscreen(!document.body.classList.contains("ps-builder-fullscreen")); return; }
    if (event.target.closest("[data-ps-builder-rail]")) { document.body.classList.toggle("ps-rail-hidden"); setBuilderFullscreen(document.body.classList.contains("ps-builder-fullscreen")); return; }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if ($(".ps-modal")) { $$(".ps-modal").pop().remove(); return; }
    if (editor) { closeEditor(); return; }
    if (document.body.classList.contains("ps-builder-fullscreen")) setBuilderFullscreen(false);
  });

  window.addEventListener("beforeunload", event => {
    if (editor && (editor.status === "dirty" || editor.status === "saving" || editor.status === "error")) { event.preventDefault(); event.returnValue = ""; }
  });

  // The portal redraws #workspaceView often. Watch it so the launcher loads its
  // list the first time it appears and the builder gets its full-screen button
  // back after every redraw — no hooks inside app.js's render() needed.
  const observe = () => {
    const workspace = document.getElementById("workspaceView");
    if (!workspace) return;
    const check = () => {
      if (document.getElementById("pageStudioRoot") && !store.pages && !store.loading) loadPages();
      decorateBuilder();
    };
    new MutationObserver(check).observe(workspace, { childList: true, subtree: false });
    check();
    try { if (localStorage.getItem("ps-builder-fullscreen") === "1" && $(".page-editor-shell.fullscreen-builder")) setBuilderFullscreen(true); } catch { /* ignore */ }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe); else observe();

  window.LDTT_PAGE_STUDIO = { screen, open: openEditor, newPage: newPageFlow, reload: () => loadPages(true), version: VERSION };
})();
