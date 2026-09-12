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
  const VERSION = "20260912photos2"; // rule 76: photo + logo upload, size, move
  const API = "/api/pages"; // site-builder: one API for ad, site and landing pages (api/ad-pages.js is an alias)
  const LIB_SCRIPTS = ["/lib/ad-page-markets.js", "/lib/ad-page-image-aspects.js", "/lib/ad-page-template.js", "/lib/html-sanitize.js", "/lib/site-page-template.js"]; // site-builder
  const store = { pages: null, markets: [], starters: [], importable: [], sandbox: false, loading: false, error: "" };
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
  // Who sent it and when, on both sides. Logins are shared in the office, so the
  // dialog asks for the sender's full name (two words) and keeps it.
  const sentToLiveLabel = (at, name) => (at ? `Sent to live ✓${name ? ` by ${name}` : ""} at ${dateLabel(at)}` : "");
  const isFromPractice = page => !window.LDTT_IS_SANDBOX && /from practice copy/i.test(String(page?.updated_by || ""));
  // updated_by is written by api/send-to-live.js as "<Full Name> <login> (from practice copy)".
  const practiceSender = page => String(page?.updated_by || "").match(/^(.*?)\s*<[^>]*>\s*\(from practice copy\)$/i)?.[1]?.trim() || "";
  const practiceTag = page => (isFromPractice(page) ? `<span class="ps-pill practice" title="This draft was sent here from the practice copy. Review it, then publish.">From practice copy${practiceSender(page) ? ` — Sent by ${esc(practiceSender(page))} on ${esc(dateLabel(page.updated_at))}` : ""}</span>` : "");
  const sentToLiveMeta = page => (window.LDTT_IS_SANDBOX && page?.sent_to_live_at ? `<span class="ps-meta ps-sent-live">${esc(sentToLiveLabel(page.sent_to_live_at, page.sent_to_live_by_name))}</span>` : "");
  function sendToLiveButton(page, cls = "btn btn-navy") {
    if (!window.LDTT_IS_SANDBOX) return "";
    const allowed = canSendToLive();
    const title = allowed ? "Copy this page to the live portal as a draft" : "Only a Super Admin or Office Admin can send a page to live";
    return `<button class="${cls}" type="button" data-ps-send-live="${esc(page.id)}" title="${esc(title)}" ${allowed ? "" : "disabled"}>Send to live</button>`;
  }
  const fullNameOrEmpty = value => { const name = String(value || "").replace(/\s+/g, " ").trim().slice(0, 200); return name.split(" ").filter(Boolean).length >= 2 ? name : ""; };
  // Resolves with the typed full name, or false when cancelled. The Send button
  // stays disabled until the box holds at least two words.
  function confirmSendToLive() {
    return new Promise(resolve => {
      const m = modal(`<h3>Send to live?</h3><div class="ps-warning" role="alert"><strong>Warning</strong>${esc(SEND_TO_LIVE_WARNING)}</div><label class="ps-field ps-sender-name"><span>Your full name (who is sending this)</span><input type="text" name="sent_by_name" data-ps-sender-name autocomplete="name" placeholder="First and last name" maxlength="200" required></label><p class="ps-help ps-sender-help">The live portal shows who sent this page. Your login is shared, so type your own name — first and last.</p><p class="ps-help">${esc(SEND_TO_LIVE_CONFIRM)}</p><div class="ps-actions"><button type="button" class="ps-btn" data-ps-close>Not yet</button><button type="button" class="ps-btn red" data-ps-go disabled>Send to live as a draft</button></div>`);
      const input = m.querySelector("[data-ps-sender-name]");
      const go = m.querySelector("[data-ps-go]");
      const check = () => { go.disabled = !fullNameOrEmpty(input.value); };
      input.addEventListener("input", check);
      input.addEventListener("keydown", event => { if (event.key === "Enter" && !go.disabled) go.click(); });
      m.querySelector("[data-ps-close]").addEventListener("click", () => { m.remove(); resolve(false); });
      go.addEventListener("click", () => { const name = fullNameOrEmpty(input.value); if (!name) return; m.remove(); resolve(name); });
      m.addEventListener("click", event => { if (event.target === m) resolve(false); });
      setTimeout(() => input.focus(), 50);
    });
  }
  async function sendToLiveFlow(pageId) {
    const sentByName = await confirmSendToLive();
    if (!sentByName) return;
    if (editor && editor.id === pageId) await flushSave();
    const response = await fetch("/api/send-to-live", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ kind: "ad_page", id: pageId, sent_by_name: sentByName })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `Send to live failed (${response.status}).`);
    toast(data.message || "Sent to live as a draft. Open the live portal → Page Studio to publish it.", 6000);
    if (editor && editor.id === pageId) { editor.page.sent_to_live_at = data.sent_at || new Date().toISOString(); editor.page.sent_to_live_by_name = data.sent_by_name || sentByName; paintTop(); }
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
    if (!template || !window.LDTT_SITE_PAGE_TEMPLATE) throw new Error("The page template did not load. Refresh and try again.");
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
      store.pages = data.pages || []; store.markets = data.markets || []; store.starters = data.starters || []; store.importable = data.importable || []; store.sandbox = Boolean(data.sandbox);
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

  // site-builder: the studio home. Every page type in one list; the Site
  // Builder itself is full screen (window.LDTT_SITE_BUILDER).
  const TYPE_LABEL = { ad: "Ad landing page", site: "Site page", landing: "Landing page" };
  function pageCard(page) {
    const type = page.page_type || "ad";
    const path = page.public_path || (type === "ad" ? `/ads/${page.slug}` : `/${page.slug}`);
    const coverSrc = page.cover ? (/^https?:\/\//i.test(page.cover) ? page.cover : `/${page.cover}`) : "";
    return `<article class="ps-page-card" data-ps-type="${esc(type)}">
        ${coverSrc ? `<div class="ps-card-cover" style="background-image:url('${esc(coverSrc)}')" role="img" aria-label="Page cover"></div>` : ""}
        <div><span class="ps-pill ${page.status === "published" ? "published" : "draft"}">${page.status === "published" ? "Live" : "Draft"}</span> <span class="ps-pill static">${esc(TYPE_LABEL[type] || type)}</span></div>
        <strong>${esc(page.title || page.market || page.slug)}</strong>
        <span class="ps-addr">${esc(path)}</span>
        <span class="ps-meta">Updated ${esc(dateLabel(page.updated_at))}${page.updated_by ? ` by ${esc(page.updated_by)}` : ""}${page.published_at ? ` · Published ${esc(dateLabel(page.published_at))}` : ""}</span>
        ${practiceTag(page)}${sentToLiveMeta(page)}
        <div class="ps-actions">
          <button class="btn btn-red" type="button" ${type === "ad" ? `data-ps-open="${esc(page.id)}"` : `data-sb-open="${esc(page.id)}"`}>Edit full screen</button>
          ${page.status === "published" ? `<a class="btn btn-outline" href="${esc(path)}" target="_blank" rel="noopener">Open live page</a>` : ""}
          ${type === "ad" ? `<button class="btn btn-outline" type="button" data-ps-duplicate-page="${esc(page.id)}">Duplicate</button>` : `<button class="btn btn-outline" type="button" data-sb-duplicate="${esc(page.id)}">Duplicate</button>`}
          ${sendToLiveButton(page)}
        </div>
      </article>`;
  }
  function launcherHtml() {
    const pages = store.pages || [];
    const sitePages = pages.filter(p => p.page_type === "site");
    const landingPages = pages.filter(p => p.page_type === "landing");
    const adPages = pages.filter(p => !p.page_type || p.page_type === "ad");
    const statics = (store.markets || []).map(market => `<article class="ps-page-card">
        <div><span class="ps-pill static">Built into the site</span></div>
        <strong>${esc(market.market)}</strong>
        <span class="ps-addr">/${esc(market.slug)}</span>
        <span class="ps-meta">Static ad page from the build. Duplicate it to edit a copy here.</span>
        <div class="ps-actions">
          <a class="btn btn-outline" href="/${esc(market.slug)}" target="_blank" rel="noopener">Open</a>
          <button class="btn btn-outline" type="button" data-ps-duplicate-market="${esc(market.slug)}">Duplicate into Page Studio</button>
        </div>
      </article>`).join("");
    const grid = (list, empty) => (list.length ? `<div class="ps-page-grid">${list.map(pageCard).join("")}</div>` : `<div class="ps-empty">${empty}</div>`);
    return `
      <section class="ps-launcher-hero">
        <div><p class="portal-tag" style="color:#ffd166">Page Studio · Site Builder</p><h2>Your whole website, edited full screen. Publish goes live in a minute, no code deploy.</h2>
        <p>Site pages (About, Services, Contact, anything), landing pages and ad pages. Pick fonts and colours for the whole site, build pages from blocks, set the menus, and publish. Every publish keeps a version you can put back.${store.sandbox ? " <b>Practice copy:</b> everything here is practice; use Send to live when a page is ready." : ""}</p></div>
        <div style="display:grid;gap:10px">
          <button class="ps-big-btn" type="button" data-sb-studio>⛶ Open the Site Builder</button>
          <button class="ps-big-btn ghost on-dark" type="button" data-sb-new>+ New page</button>
          <button class="ps-big-btn ghost on-dark" type="button" data-ps-new>+ New ad page</button>
        </div>
      </section>
      ${store.error ? `<div class="ps-empty" style="color:#8a0b1f;border-color:#f1c2ca;background:#fff1f3">${esc(store.error)}</div>` : ""}
      <section class="panel pad"><div class="panel-head"><h2>Site pages</h2><button class="btn btn-outline" type="button" data-sb-studio="theme">Site theme (fonts + colours)</button> <button class="btn btn-outline" type="button" data-sb-studio="nav">Menus</button></div>
        ${store.loading && !pages.length ? `<div class="ps-empty">Loading…</div>` : grid(sitePages, "No site pages yet. Press <b>+ New page</b> and start from a template, or import About / Contact / Facility from the current website.")}
      </section>
      <section class="panel pad"><div class="panel-head"><h2>Landing pages</h2></div>
        ${grid(landingPages, "No block-built landing pages yet. <b>+ New page</b> → Market landing or Recruiting landing.")}
      </section>
      <section class="panel pad"><div class="panel-head"><h2>Ad pages</h2></div>
        ${grid(adPages, "No Page Studio ad pages yet. Click <b>+ New ad page</b> to make the first one — it takes about a minute.")}
      </section>
      <section class="panel pad"><div class="panel-head"><h2>Market ad pages built into the site</h2></div>
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
    if (sendSlot) sendSlot.innerHTML = editor.sandbox ? `${sendToLiveButton(editor.page, "ps-send-live")}${editor.page.sent_to_live_at ? `<small class="ps-sent-live">${esc(sentToLiveLabel(editor.page.sent_to_live_at, editor.page.sent_to_live_by_name))}</small>` : ""}` : practiceTag(editor.page);
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
      case "image":
        return `${photoPicker("Photo", p("photo"), section.photo)}
          ${field("Photo description (alt text)", p("photoAlt"), section.photoAlt)}
          ${field("Caption under the photo (optional)", p("caption"), section.caption)}
          ${field("Link when clicked (optional, https://…)", p("link"), section.link, { placeholder: "https://…" })}
          <p class="ps-help">Pick a photo from the library or paste any https:// image address. Use “Photo size” and “Section width” below to resize and widen it.</p>`;
      default:
        return "";
    }
  }

  // Layout choices every section carries: width for all, photo size where a photo exists.
  function layoutFields(section, index) {
    const p = key => `sections.${index}.${key}`;
    const width = field("Section width", p("width"), section.width || "", { type: "select", options: [["", "Design width"], ["wide", "Wide (1400px)"], ["full", "Full bleed — edge to edge"]] });
    const size = section.photo !== undefined ? field("Photo size", p("size"), section.size || "", { type: "select", options: [["", "Design size"], ["small", "Small (420px)"], ["medium", "Medium (680px)"], ["large", "Large (1050px)"], ["full", "As wide as the section"]] }) : "";
    const media = section.photo !== undefined ? mediaControls(`sections.${index}`, section) : ""; // rule 76
    return `<div class="ps-item"><div class="ps-item-head"><span>Layout</span></div>${width}${size}</div>${media}`;
  }

  // rule 76: a stored photo value is a site path ("assets/…") or an https:// link.
  const assetSrc = value => (/^https?:\/\//i.test(value) || String(value).startsWith("/") ? value : `/${value}`);

  // rule 76: size + move for one photo (or the logo). The sliders write whitelisted
  // numbers only (template.normalizeContent clamps them); empty = the design's own.
  function mediaControls(path, item, kind = "photo") {
    const L = template.MEDIA_LIMITS;
    const isLogo = kind === "logo";
    const [wKey, xKey, yKey] = isLogo ? ["w", "x", "y"] : ["photoW", "photoX", "photoY"];
    const [wL, xL, yL] = isLogo ? [L.logoW, L.logoX, L.logoY] : [L.photoW, L.photoX, L.photoY];
    const w = item?.[wKey];
    const x = item?.[xKey] || 0;
    const y = item?.[yKey] || 0;
    const unit = isLogo ? "px" : "%";
    const thing = isLogo ? "logo" : "photo";
    const slider = (label, key, lim, value, shown, u) => `<label class="ps-field ps-slider"><span>${esc(label)} <b data-ps-readout>${esc(shown)}</b></span><input type="range" min="${lim[0]}" max="${lim[1]}" step="1" data-ps-field="${esc(`${path}.${key}`)}" data-ps-num="1" data-unit="${u}" value="${value}"></label>`;
    return `<div class="ps-item ps-media-controls"><div class="ps-item-head"><span>${isLogo ? "Logo size + place" : "Photo size + place"}</span></div>
      ${slider(isLogo ? "Logo size" : "Photo size", wKey, wL, w ?? (isLogo ? 164 : 100), w === undefined || w === "" ? "Design size" : `${w}${unit}`, unit)}
      ${slider("Move left / right", xKey, xL, x, `${x}px`, "px")}
      ${slider("Move up / down", yKey, yL, y, `${y}px`, "px")}
      <button type="button" class="ps-btn" data-ps-act="media-reset" data-path="${esc(path)}" data-kind="${kind}">Put the ${thing} back where the design puts it</button>
      <p class="ps-help">Or drag the ${thing} in the preview to move it, and drag its red corner handle to resize it. On phones a moved ${thing} keeps the design's place; its size still applies.</p></div>`;
  }

  function logoFields(d) {
    const logo = d.logo || {};
    return `<div class="ps-field"><span>Logo in the page header (blank = the standard LDTT logo)</span>
      <div class="ps-row ps-upload-row"><label class="ps-btn ps-upload-btn">Upload a new logo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" data-ps-upload="logo.photo" hidden></label><span class="ps-thumb ps-thumb-logo" style="background-image:url('${esc(assetSrc(logo.photo || "assets/lorenzo-logo-white.png"))}')" role="img" aria-label="Current logo"></span></div>
      <input data-ps-field="logo.photo" value="${esc(logo.photo || "")}" placeholder="https://… (blank = the standard logo)">
      ${logo.photo ? `<button type="button" class="ps-btn" data-ps-act="logo-standard">Use the standard LDTT logo again</button>` : ""}</div>
      ${mediaControls("logo", logo, "logo")}`;
  }

  // Phone photos are often 5-12 MB. Vercel refuses a request body over ~4.5 MB and the
  // upload travels as base64 (a third bigger), so a JPG/PNG/WebP over 3 MB is scaled down
  // here first (longest side 2400 px). A GIF or SVG over 3 MB is refused in plain words.
  const UPLOAD_RAW_LIMIT = 3 * 1024 * 1024;
  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("Could not read the file.")); r.readAsDataURL(file); });
  }
  async function shrinkForUpload(file) {
    const url = await readAsDataUrl(file);
    if (file.size <= UPLOAD_RAW_LIMIT) return { type: file.type, data: url };
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("That file is bigger than 3 MB. Make it smaller and try again.");
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("That picture could not be opened. Try a JPG or PNG.")); i.src = url; });
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const bytes = dataUrl => Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
    if (file.type === "image/png") { const png = canvas.toDataURL("image/png"); if (bytes(png) <= UPLOAD_RAW_LIMIT) return { type: "image/png", data: png }; }
    let quality = 0.86;
    let out = canvas.toDataURL("image/jpeg", quality);
    while (bytes(out) > UPLOAD_RAW_LIMIT && quality > 0.45) { quality -= 0.1; out = canvas.toDataURL("image/jpeg", quality); }
    if (bytes(out) > UPLOAD_RAW_LIMIT) throw new Error("That picture is still too big after shrinking. Try a smaller one.");
    return { type: "image/jpeg", data: out };
  }
  // Same upload path as the Site Builder: api/pages.js operation "upload" (UPLOAD_TYPES),
  // into trainer-page-assets (practice-trainer-page-assets on the practice copy). Publish
  // copies a practice upload into the live bucket (rule 27); Send to live does the same (rule 18).
  async function uploadInto(file, path) {
    if (!editor || !file) return;
    if (!/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.type)) { toast("Choose a JPG, PNG, WebP, GIF or SVG picture."); return; }
    try {
      toast("Uploading…", 20000);
      const prepared = await shrinkForUpload(file);
      const result = await api({ operation: "upload", name: file.name, type: prepared.type, data: prepared.data });
      setPath(path, result.url);
      markDirty({ rerail: true });
      toast("Uploaded. It is in the draft now; Publish puts it on the page.", 4500);
    } catch (error) {
      toast(`Upload failed: ${error.message}`, 6000);
    }
  }

  function photoPicker(label, path, value) {
    const choices = photoChoices();
    return `<div class="ps-field"><span>${esc(label)}</span>
      <div class="ps-row ps-upload-row"><label class="ps-btn ps-upload-btn">Upload a new photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-ps-upload="${esc(path)}" hidden></label>${value ? `<span class="ps-thumb" style="background-image:url('${esc(assetSrc(value))}')" role="img" aria-label="Current photo"></span>` : ""}</div>
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
      ${h.casePanel || h.heroVideo ? "" : mediaControls("hero", h)}
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
          ${open ? `<div class="ps-section-body">${sectionFields(section, index)}${layoutFields(section, index)}</div>` : ""}
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
        <h3>Card cover image</h3>
        ${photoPicker("Cover shown on this page's card in Page Studio (blank = the hero photo)", "cover", d.cover)}
        <h3>Danger zone</h3>
        ${editor.page.status === "published" ? `<button type="button" class="ps-btn" data-ps-act="unpublish">Take this page offline</button>` : ""}
        <button type="button" class="ps-btn" style="color:#b00020;border-color:#f1c2ca" data-ps-act="archive">Remove this page</button>`;
    } else if (editor.tab === "style") {
      rail.innerHTML = `
        <h3>Logo</h3>
        ${logoFields(d)}
        <h3>Fonts</h3>
        ${field("Headline font", "font", d.font, { type: "select", options: template.FONTS.map(f => [f.id, f.label]) })}
        ${field("Body font", "fontBody", d.fontBody, { type: "select", options: template.FONTS.map(f => [f.id, f.label]) })}
        <p class="ps-help">Fonts apply to the whole page. “Site default” is what every current market page uses.</p>
        <h3>Colours</h3>
        ${field("Design style", "arch", d.arch, { type: "select", options: template.ARCHES.map(a => [a.id, a.label]) })}
        ${field("Main colour", "mk1", d.mk1, { type: "color" })}
        ${field("Second colour", "mk2", d.mk2, { type: "color" })}
        ${field("Button accent (blank = the design's own)", "accent", d.accent, { type: "color" })}
        <button type="button" class="ps-btn" data-ps-act="clear-accent">Use the design's own button colour</button>
        <h3>Button hover effect</h3>
        ${field("When the mouse rests on a button", "hoverFx", d.hoverFx, { type: "select", options: template.HOVER_FX.map(fx => [fx.id, fx.label]) })}
        <p class="ps-help">Applies to every button and icon chip on this page. Pick one, then rest your mouse on any button in the preview to feel it. Swap it any time; it travels with the page through Send to live.</p>`;
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
    wireMediaDrag(doc); // rule 76
  }

  // rule 76: in the preview, drag a photo or the logo to MOVE it and drag its red corner
  // handle to RESIZE it. It writes the same keys as the sliders (photoW/X/Y, logo.w/x/y);
  // normalizeContent clamps them and the draft autosaves like any other edit. A press
  // without a real drag (under 4 px) stays a click: a photo opens its section, the logo
  // opens the Style tab. Nothing is published until Publish.
  function wireMediaDrag(doc) {
    if (!doc?.body || !editor) return;
    const L = template.MEDIA_LIMITS;
    const style = doc.createElement("style");
    style.textContent = ".ps-media-handle{position:absolute;z-index:2147483000;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:5px;background:#d80f35;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:nwse-resize;touch-action:none;display:none}";
    doc.head.appendChild(style);
    const handle = doc.createElement("div");
    handle.className = "ps-media-handle";
    handle.title = "Drag to resize";
    doc.body.appendChild(handle);
    const win = doc.defaultView;
    let current = null;
    let drag = null;
    let suppressClick = false;
    const clamp = (value, [min, max]) => Math.min(max, Math.max(min, Math.round(value)));
    const targetFor = key => {
      if (key === "hero") return { item: editor.draft.hero, logo: false, openId: "hero" };
      if (key === "logo") return { item: editor.draft.logo || {}, logo: true };
      const section = editor.draft.sections.find(s => s.id === key);
      return section ? { item: section, logo: false, openId: section.id } : null;
    };
    const placeHandle = el => {
      const rect = el.getBoundingClientRect();
      // A photo taller than the preview would hide its corner; keep the handle on screen.
      handle.style.left = `${Math.min(rect.right, win.innerWidth - 14) + win.scrollX}px`;
      handle.style.top = `${Math.min(rect.bottom, win.innerHeight - 14) + win.scrollY}px`;
      handle.style.display = "block";
      current = el;
    };
    function begin(event, el, mode) {
      if (event.button !== 0) return;
      const target = targetFor(el.dataset.psMedia);
      if (!target) return;
      const rect = el.getBoundingClientRect();
      const it = target.item;
      drag = {
        el, target, mode, x0: event.clientX, y0: event.clientY, rectWidth: rect.width,
        parentWidth: el.parentElement?.getBoundingClientRect().width || rect.width || 1,
        w0: target.logo ? it.w : it.photoW, x: (target.logo ? it.x : it.photoX) || 0, y: (target.logo ? it.y : it.photoY) || 0,
        moved: false, values: null
      };
      el.classList.add("ps-media-active");
      (mode === "resize" ? handle : el).setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }
    doc.querySelectorAll("[data-ps-media]").forEach(el => {
      el.setAttribute("draggable", "false");
      el.addEventListener("pointerenter", () => { if (!drag) placeHandle(el); });
      el.addEventListener("pointerdown", event => begin(event, el, "move"));
    });
    handle.addEventListener("pointerdown", event => { if (current) begin(event, current, "resize"); });
    win.addEventListener("scroll", () => { if (current && !drag) placeHandle(current); }, { passive: true });
    doc.addEventListener("pointermove", event => {
      if (!drag) return;
      const dx = event.clientX - drag.x0;
      const dy = event.clientY - drag.y0;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag.moved = true;
      const logo = drag.target.logo;
      if (drag.mode === "move") {
        const x = clamp(drag.x + dx, logo ? L.logoX : L.photoX);
        const y = clamp(drag.y + dy, logo ? L.logoY : L.photoY);
        drag.el.style.translate = `${x}px ${y}px`;
        drag.values = { x, y };
      } else if (logo) {
        const w = clamp((drag.w0 ?? drag.rectWidth) + dx, L.logoW);
        Object.assign(drag.el.style, { width: `${w}px`, height: "auto" });
        drag.values = { w };
      } else {
        const start = drag.w0 ?? (drag.rectWidth / drag.parentWidth) * 100;
        const w = clamp(start + (dx / drag.parentWidth) * 100, L.photoW);
        Object.assign(drag.el.style, { maxWidth: `${w}%`, marginInline: "auto", display: "block" });
        drag.values = { w };
      }
      placeHandle(drag.el);
    });
    const end = () => {
      if (!drag) return;
      const { el, target, moved, values } = drag;
      el.classList.remove("ps-media-active");
      drag = null;
      if (!moved || !values || !editor) return;
      suppressClick = true;
      const it = target.item;
      if (target.logo) {
        if ("w" in values) it.w = values.w; else { it.x = values.x; it.y = values.y; }
        editor.draft.logo = it;
        editor.tab = "style";
      } else {
        if ("w" in values) it.photoW = values.w; else { it.photoX = values.x; it.photoY = values.y; }
        editor.selectedId = target.openId; editor.openId = target.openId; editor.tab = "sections";
      }
      markDirty({ rerail: true });
      toast(`${target.logo ? "Logo" : "Photo"} ${"w" in values ? "resized" : "moved"} (draft). Publish puts it on the page.`);
    };
    doc.addEventListener("pointerup", end);
    doc.addEventListener("pointercancel", end);
    doc.addEventListener("click", event => {
      if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopPropagation(); return; }
      if (event.target.closest?.('[data-ps-media="logo"]')) { event.preventDefault(); event.stopPropagation(); editor.tab = "style"; paintTop(); paintRail(); }
    }, true);
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
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!node[parts[i]] || typeof node[parts[i]] !== "object") node[parts[i]] = {}; // rule 76: "logo.w" on a page with no logo yet
      node = node[parts[i]];
    }
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
    const upload = event.target.closest?.("[data-ps-upload]"); // rule 76: Upload a new photo / logo
    if (upload) {
      if (event.type === "change" && upload.files?.[0] && editor) { const file = upload.files[0]; upload.value = ""; uploadInto(file, upload.dataset.psUpload); }
      return;
    }
    const el = event.target.closest("[data-ps-field]");
    if (!el || !editor) return;
    const path = el.dataset.psField;
    let value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.dataset.psNum) {
      // rule 76: a size / move slider. A number; normalizeContent clamps it on save and render.
      value = Number(el.value);
      const readout = el.closest(".ps-field")?.querySelector("[data-ps-readout]");
      if (readout) readout.textContent = `${value}${el.dataset.unit || ""}`;
    }
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
      case "media-reset": { // rule 76: back to the design's own size and place
        const keys = btn.dataset.kind === "logo" ? ["w", "x", "y"] : ["photoW", "photoX", "photoY"];
        const item = String(btn.dataset.path || "").split(".").reduce((node, part) => node?.[part], d);
        if (item && typeof item === "object") keys.forEach(key => { delete item[key]; });
        markDirty({ rerail: true });
        toast(`${btn.dataset.kind === "logo" ? "Logo" : "Photo"} is back where the design puts it (draft).`);
        return;
      }
      case "logo-standard": { // rule 76
        if (d.logo) d.logo.photo = "";
        markDirty({ rerail: true });
        toast("The standard LDTT logo is back in the draft.");
        return;
      }
      case "preview": {
        try {
          btn.disabled = true;
          const data = await api({ operation: "preview", page_type: "ad", content: d });
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
      ...(store.pages || []).filter(p => !p.page_type || p.page_type === "ad").map(p => `<option value="page:${esc(p.id)}">${esc(p.market || p.slug)} — Page Studio</option>`),
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
        const data = await api({ operation: "create", page_type: "ad", content });
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
    if (event.key !== "Escape" || document.body.classList.contains("sb-open")) return; // site-builder handles its own keys
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
    // Step 5 (Joshua 2026-09-12, rule 76): the Page Editor OPENS full screen, every
    // time someone enters it — not only after pressing ⛶. The portal redraws the
    // shell often; only a real entry (shell absent -> present) turns it on, so a
    // person who pressed "Exit Full Screen" is not pulled back by a background redraw.
    let builderShown = false;
    const check = () => {
      if (document.getElementById("pageStudioRoot") && !store.pages && !store.loading) loadPages();
      decorateBuilder();
      const shown = Boolean($(".page-editor-shell.fullscreen-builder"));
      if (shown && !builderShown) setBuilderFullscreen(true);
      builderShown = shown;
    };
    new MutationObserver(check).observe(workspace, { childList: true, subtree: false });
    check();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe); else observe();

  // site-builder: shared helpers for trainer-backoffice/site-builder.js (same API, toast, modal, template loader, Send to live).
  window.LDTT_PAGE_STUDIO = { screen, open: openEditor, newPage: newPageFlow, reload: () => loadPages(true), version: VERSION,
    shared: { api, toast, modal, ensureTemplate, loadCss, token, esc, dateLabel, timeLabel, debounce, clone, store, loadPages, sendToLiveFlow, sendToLiveButton, practiceTag, sentToLiveMeta, sentToLiveLabel, fullNameOrEmpty, field, photoChoices, get hasAdEditor() { return Boolean(editor); }, closeAdEditor: closeEditor } };
})();
