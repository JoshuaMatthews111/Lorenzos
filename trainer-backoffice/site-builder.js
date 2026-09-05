// Site Builder — the full-screen editor for SITE pages and LANDING pages
// (blocks), the Site Theme and the Menus. Ad pages keep their editor in
// page-studio.js; this file borrows its helpers (window.LDTT_PAGE_STUDIO.shared).
//
// Layout (the studio IS the screen):
//   top bar   Close · rails · page name + address · Saved/Saving pill · device
//             toggle · Undo/Redo · Preview · Publish · more
//   left rail Pages (list + New page) · Blocks (searchable library) · Theme ·
//             Menus
//   centre    the real page in an iframe at real width, "+ Add block" between
//             blocks, click a block to select it, drag ⋮⋮ to move it
//   right rail the selected block's fields + its design settings, or Page
//             settings + History when nothing is selected
//
// Safety: the office edits fields; lib/site-page-template.js renders and
// escapes everything and lib/html-sanitize.js rebuilds rich text from an
// allow-list. Autosave to the draft; Publish runs the checklist (browser and
// server); every publish keeps a version; Unpublish returns the static file.
(function () {
  "use strict";
  const S = () => window.LDTT_PAGE_STUDIO.shared;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  let T = null;   // window.LDTT_SITE_PAGE_TEMPLATE
  let sb = null;  // editor state
  let siteCache = { theme: null, nav: null, data: null };

  // ───────────────────────── boot ─────────────────────────
  async function ensure() {
    const { ensureTemplate, loadCss } = S();
    loadCss();
    await ensureTemplate();
    T = window.LDTT_SITE_PAGE_TEMPLATE;
    if (!T) throw new Error("The site template did not load. Refresh and try again.");
    return T;
  }
  async function loadSite(force = false) {
    if (siteCache.theme && !force) return siteCache;
    const data = await S().api({ operation: "data" });
    siteCache = { theme: T.normalizeTheme(data.theme || {}), nav: T.normalizeNav(data.navigation || {}), data: { reviews: data.reviews || [], trainers: data.trainers || [] } };
    return siteCache;
  }

  // Open the studio. `what` = page id | "new" | "theme" | "nav" | "" (pages list).
  async function openStudio(what = "") {
    const { toast, store, loadPages } = S();
    try {
      await ensure();
      if (S().hasAdEditor) S().closeAdEditor();
      if (!store.pages) await loadPages(true);
      await loadSite();
      if (!sb) {
        sb = { pageId: null, page: null, draft: null, savedJson: "", status: "saved", savedAt: null, revisions: [], device: "desktop", selectedId: null, leftTab: "pages", rightTab: "block", left: true, right: true, history: [], future: [], insertAt: null, panel: null, blockSearch: "", pageSearch: "", themeDraft: null, navDraft: null };
        mount();
      }
      if (what === "new") { sb.leftTab = "pages"; openNewPanel(); }
      else if (what === "theme") { sb.leftTab = "theme"; }
      else if (what === "nav") { sb.leftTab = "nav"; }
      else if (what) await openPage(what);
      paintAll();
    } catch (error) { toast(error.message, 6000); }
  }

  function closeStudio() {
    if (!sb) return;
    if (sb.status === "dirty" || sb.status === "saving") flushSave();
    $("#sbOverlay")?.remove();
    document.body.classList.remove("sb-open");
    sb = null;
    S().loadPages(true);
  }

  function mount() {
    $("#sbOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "sbOverlay"; overlay.className = "sb-overlay";
    overlay.innerHTML = `
      <header class="sb-top">
        <button type="button" data-sb-act="close" title="Back to the portal">← Close</button>
        <button type="button" data-sb-act="toggle-left" title="Show or hide the left rail (pages, blocks, theme, menus)">☰ Pages &amp; blocks</button>
        <div class="sb-title"><strong id="sbTitle">Site Builder</strong><span id="sbAddr"></span></div>
        <span class="ps-status saved" id="sbStatus">Saved</span>
        <div class="ps-seg" id="sbDevices"><button type="button" data-sb-device="desktop" class="active">Desktop</button><button type="button" data-sb-device="tablet">Tablet</button><button type="button" data-sb-device="mobile">Mobile</button></div>
        <button type="button" data-sb-act="undo" id="sbUndo" title="Undo (Cmd/Ctrl+Z)">↶</button>
        <button type="button" data-sb-act="redo" id="sbRedo" title="Redo (Shift+Cmd/Ctrl+Z)">↷</button>
        <span id="sbSendLive"></span>
        <button type="button" data-sb-act="preview" id="sbPreviewBtn">Preview draft</button>
        <button type="button" class="ps-primary" data-sb-act="publish" id="sbPublishBtn">Publish</button>
        <button type="button" data-sb-act="more" id="sbMoreBtn" title="More: unpublish, remove, history">⋯</button>
        <button type="button" data-sb-act="toggle-right" title="Show or hide the block settings">Settings ▸</button>
      </header>
      <div class="sb-body">
        <aside class="sb-left">
          <nav class="sb-tabs">${[["pages", "Pages"], ["blocks", "Blocks"], ["theme", "Theme"], ["nav", "Menus"]].map(([id, label]) => `<button type="button" data-sb-tab="${id}">${label}</button>`).join("")}</nav>
          <div class="sb-rail-scroll" id="sbLeft"></div>
        </aside>
        <main class="sb-canvas" id="sbCanvas">
          <div class="sb-canvas-bar"><span id="sbCanvasHint">Click any block to edit it · drag ⋮⋮ to move · big + buttons add a block</span><b id="sbCanvasLabel">Desktop</b></div>
          <div class="sb-frame-wrap" id="sbFrameWrap"><iframe id="sbFrame" title="Page live preview"></iframe><div class="sb-panel" id="sbPanel" hidden></div></div>
        </main>
        <aside class="sb-right">
          <nav class="sb-tabs"><button type="button" data-sb-rtab="block">Block</button><button type="button" data-sb-rtab="page">Page</button></nav>
          <div class="sb-rail-scroll" id="sbRight"></div>
        </aside>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add("sb-open");
    overlay.addEventListener("click", onClick);
    overlay.addEventListener("input", onInput);
    overlay.addEventListener("change", onInput);
    overlay.addEventListener("keydown", onRailKeys);
  }

  // ───────────────────────── page open / state ─────────────────────────
  async function openPage(pageId) {
    const { api } = S();
    if (sb.pageId && sb.pageId !== pageId) await flushSave();
    const data = await api({ operation: "get", id: pageId });
    const page = data.page;
    if ((page.page_type || "ad") === "ad") { closeStudio(); return window.LDTT_PAGE_STUDIO.open(pageId); }
    const draft = T.normalizeSitePage({ ...(page.draft_content || {}), pageType: page.page_type });
    let local = null;
    try { local = JSON.parse(localStorage.getItem(`sb-draft-${page.id}`) || "null"); } catch { local = null; }
    if (local && local.draft_revision === page.draft_revision && JSON.stringify(local.content) !== JSON.stringify(draft) && window.confirm("You have unsaved changes for this page from earlier in this browser. Put them back?")) {
      Object.assign(draft, T.normalizeSitePage(local.content));
    }
    Object.assign(sb, { pageId: page.id, page, draft, savedJson: JSON.stringify(draft), draftRevision: Number(page.draft_revision || 1), revisions: data.revisions || [], status: "saved", savedAt: page.updated_at, selectedId: null, rightTab: "page", history: [], future: [], insertAt: null, panel: null, durability: null });
    sb.left = window.innerWidth > 1100 || !sb.right;
    paintAll();
    loadDurability(page.id); // durability
  }

  // durability: "Where this page lives" — addresses, export file, who published,
  // revision, every photo with its bucket, the last nightly health run.
  async function loadDurability(pageId) {
    try {
      const info = await S().api({ operation: "durability", id: pageId });
      if (sb && sb.pageId === pageId) { sb.durability = info; if (sb.rightTab === "page" && !sb.selectedId) paintRight(); }
    } catch { /* the panel just says it could not load */ }
  }
  function durabilityPanel() {
    const { esc, dateLabel } = S();
    const d = sb.durability;
    const slug = sb.draft.slug || "…";
    if (!d) return `<h4>Where this page lives</h4><p class="ps-help">Loading…</p>`;
    const buckets = (d.buckets || []).map(b => `<b>${esc(b)}</b>`).join(", ") || "none";
    const health = d.health ? (d.health.ok === true ? `✅ Healthy on ${esc(dateLabel(d.health.ran_at))}${d.health.warnings?.length ? ` — note: ${esc(d.health.warnings.join(" "))}` : ""}` : d.health.ok === false ? `⚠️ Broken on ${esc(dateLabel(d.health.ran_at))}: ${esc((d.health.problems || []).join(" "))}` : `Not checked yet (${esc((d.health.warnings || []).join(" "))})`) : "No health check has run yet.";
    const exportLine = d.export ? (d.export.matches ? `Copy in git is current (revision ${esc(d.export.revision)}, exported ${esc(dateLabel(d.export.exported_at))}).` : `Copy in git is behind (revision ${esc(d.export.revision)} vs ${esc(d.revision)}) — the next deploy re-exports it.`) : "No copy in git yet — it is written by the next deploy (scripts/export-pages.mjs).";
    return `<h4>Where this page lives</h4>
      <div class="ps-help sb-durability">
        <div><b>Address:</b> <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.url)}</a>${d.alt_url ? ` · also <a href="${esc(d.alt_url)}" target="_blank" rel="noopener">${esc(d.alt_url)}</a>` : ""} ${d.status === "published" ? "(live)" : "(not published yet)"}</div>
        <div><b>Database:</b> ${esc(d.schema)} schema, table ad_pages, revision ${esc(d.revision)}${d.published_at ? `, published ${esc(dateLabel(d.published_at))}` : ""}${d.published_by ? ` by ${esc(d.published_by)}` : ""}</div>
        <div><b>Copy in git:</b> ${esc(d.export_html)} + .json — ${exportLine}</div>
        <div><b>Photos:</b> ${d.images.length} in ${buckets}${d.images.some(i => /practice-/.test(i.bucket)) && d.schema === "public" ? " — ⚠️ some still point at the practice copy; Publish copies them into the live bucket." : ""}</div>
        <div><b>Nightly check:</b> ${health}</div>
        <div>Photos upload to bucket <b>${esc(d.bucket)}</b> under site/ and pages/${esc(slug)}/. Full guide: docs/SITE-BUILDER.md.</div>
      </div>`;
  }

  const draftJson = () => JSON.stringify(sb.draft);
  function pushHistory(force = false) {
    if (!sb?.draft) return;
    const now = Date.now();
    if (!force && sb.history.length && now - (sb.lastPush || 0) < 700) return; // typing bursts = one undo step; structural changes always push
    sb.history.push(draftJson()); if (sb.history.length > 60) sb.history.shift();
    sb.future = []; sb.lastPush = now;
  }
  function undo() { if (!sb?.history.length) return; sb.future.push(draftJson()); sb.draft = T.normalizeSitePage(JSON.parse(sb.history.pop())); sb.lastPush = 0; afterStructuralChange(); }
  function redo() { if (!sb?.future.length) return; sb.history.push(draftJson()); sb.draft = T.normalizeSitePage(JSON.parse(sb.future.pop())); sb.lastPush = 0; afterStructuralChange(); }
  function afterStructuralChange() { if (!sb.draft.blocks.some(b => b.id === sb.selectedId)) sb.selectedId = null; markDirty({ rerail: true }); }

  function markDirty({ rerail = false, canvas = true } = {}) {
    if (!sb?.draft) return;
    sb.status = "dirty"; paintStatus(); paintTop();
    if (rerail) paintRight();
    if (canvas) repaintCanvas();
    try { localStorage.setItem(`sb-draft-${sb.pageId}`, JSON.stringify({ draft_revision: sb.draftRevision, content: sb.draft, at: Date.now() })); } catch { /* ignore */ }
    scheduleSave();
  }

  // ───────────────────────── saving ─────────────────────────
  let saveInFlight = null;
  const scheduleSave = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => flushSave(), 1500); }; })();
  async function saveDraft({ snapshot = false } = {}) {
    if (!sb?.draft) return;
    const body = draftJson();
    sb.status = "saving"; paintStatus();
    const data = await S().api({ operation: "save_draft", id: sb.pageId, content: sb.draft, snapshot });
    sb.draftRevision = Number(data.draft_revision || sb.draftRevision + 1);
    sb.savedAt = data.saved_at || new Date().toISOString();
    if (data.page?.slug) sb.page.slug = data.page.slug;
    sb.status = draftJson() === body ? "saved" : "dirty";
    if (sb.status === "saved") sb.savedJson = body;
    try { localStorage.removeItem(`sb-draft-${sb.pageId}`); } catch { /* ignore */ }
    paintStatus();
    if (sb.status === "dirty") scheduleSave();
  }
  function flushSave() {
    if (!sb?.draft || saveInFlight) return saveInFlight || Promise.resolve();
    if (draftJson() === sb.savedJson) { sb.status = "saved"; paintStatus(); return Promise.resolve(); }
    saveInFlight = saveDraft().catch(error => { if (!sb) return; sb.status = "error"; sb.errorMessage = error.message; paintStatus(); S().toast(`Not saved — ${error.message}`, 5000); }).finally(() => { saveInFlight = null; });
    return saveInFlight;
  }
  async function refreshRevisions() {
    const data = await S().api({ operation: "get", id: sb.pageId });
    sb.revisions = data.revisions || [];
    sb.page = { ...sb.page, ...data.page, draft_content: undefined, published_content: undefined };
  }

  // ───────────────────────── painting ─────────────────────────
  function paintAll() { if (!sb) return; paintTop(); paintLeft(); paintRight(); paintCanvas(); paintRails(); }
  function paintRails() {
    const o = $("#sbOverlay"); if (!o) return;
    o.classList.toggle("sb-left-hidden", !sb.left); o.classList.toggle("sb-right-hidden", !sb.right);
  }
  function paintTop() {
    if (!sb) return;
    const { esc, sendToLiveButton, sentToLiveLabel, practiceTag } = S();
    const d = sb.draft;
    $("#sbTitle").textContent = d ? (d.title || "Untitled page") : "Site Builder";
    $("#sbAddr").textContent = d ? `/${d.slug || "…"}${d.pageType === "landing" ? " · landing page" : ""}` : "Pick a page on the left, or make a new one";
    $$("[data-sb-device]").forEach(b => b.classList.toggle("active", b.dataset.sbDevice === sb.device));
    $$("[data-sb-tab]").forEach(b => b.classList.toggle("active", b.dataset.sbTab === sb.leftTab));
    $$("[data-sb-rtab]").forEach(b => b.classList.toggle("active", b.dataset.sbRtab === sb.rightTab));
    ["sbPreviewBtn", "sbPublishBtn", "sbMoreBtn", "sbUndo", "sbRedo", "sbDevices"].forEach(id => { const el = $(`#${id}`); if (el) el.style.display = d ? "" : "none"; });
    $("#sbStatus").style.display = d ? "" : "none";
    if (d) {
      $("#sbUndo").disabled = !sb.history.length; $("#sbRedo").disabled = !sb.future.length;
      $("#sbPublishBtn").textContent = sb.page.status === "published" ? "Publish changes" : (sb.page.sandbox || window.LDTT_IS_SANDBOX ? "Publish (practice copy)" : "Publish");
      const slot = $("#sbSendLive");
      slot.innerHTML = window.LDTT_IS_SANDBOX ? `${sendToLiveButton(sb.page, "ps-send-live")}${sb.page.sent_to_live_at ? `<small class="ps-sent-live">${esc(sentToLiveLabel(sb.page.sent_to_live_at, sb.page.sent_to_live_by_name))}</small>` : ""}` : practiceTag(sb.page);
    } else $("#sbSendLive").innerHTML = "";
    paintStatus();
  }
  function paintStatus() {
    const el = $("#sbStatus"); if (!el || !sb) return;
    const { timeLabel } = S();
    const map = { saved: ["saved", `Saved ${sb.savedAt ? timeLabel(sb.savedAt) : ""}`], saving: ["saving", "Saving…"], dirty: ["dirty", "Unsaved changes"], error: ["error", "Not saved — click to retry"] };
    const [cls, label] = map[sb.status] || map.saved;
    el.className = `ps-status ${cls}`; el.textContent = label; el.title = sb.errorMessage || "";
  }

  // ───────────────────────── left rail ─────────────────────────
  const BLOCK_ICONS = {
    hero: `<svg viewBox="0 0 60 36"><rect width="60" height="36" rx="4" fill="#0b2a55"/><rect x="8" y="10" width="26" height="5" rx="2" fill="#fff"/><rect x="8" y="18" width="18" height="3" rx="1.5" fill="#9fb1d6"/><rect x="8" y="25" width="12" height="5" rx="2" fill="#d80f35"/></svg>`,
    richtext: `<svg viewBox="0 0 60 36"><rect x="8" y="7" width="30" height="4" rx="2" fill="#0b2a55"/><rect x="8" y="15" width="44" height="2.5" rx="1" fill="#9fb1d6"/><rect x="8" y="21" width="40" height="2.5" rx="1" fill="#9fb1d6"/><rect x="8" y="27" width="30" height="2.5" rx="1" fill="#9fb1d6"/></svg>`,
    imagetext: `<svg viewBox="0 0 60 36"><rect x="6" y="7" width="22" height="22" rx="3" fill="#cbd8e8"/><rect x="33" y="9" width="20" height="4" rx="2" fill="#0b2a55"/><rect x="33" y="16" width="22" height="2.5" rx="1" fill="#9fb1d6"/><rect x="33" y="21" width="18" height="2.5" rx="1" fill="#9fb1d6"/></svg>`,
    columns: `<svg viewBox="0 0 60 36">${[6, 23, 40].map(x => `<rect x="${x}" y="7" width="14" height="22" rx="3" fill="#fff" stroke="#cbd8e8"/><rect x="${x + 3}" y="11" width="6" height="6" rx="3" fill="#d80f35"/><rect x="${x + 3}" y="20" width="8" height="2" fill="#9fb1d6"/>`).join("")}</svg>`,
    steps: `<svg viewBox="0 0 60 36">${[8, 26, 44].map((x, i) => `<circle cx="${x}" cy="14" r="6" fill="#d80f35"/><text x="${x}" y="17" font-size="8" fill="#fff" text-anchor="middle" font-weight="900">${i + 1}</text><rect x="${x - 6}" y="24" width="12" height="2.5" fill="#9fb1d6"/>`).join("")}</svg>`,
    faq: `<svg viewBox="0 0 60 36">${[7, 16, 25].map(y => `<rect x="6" y="${y}" width="48" height="6" rx="2" fill="#fff" stroke="#cbd8e8"/><text x="49" y="${y + 5}" font-size="6" fill="#d80f35" font-weight="900">+</text>`).join("")}</svg>`,
    gallery: `<svg viewBox="0 0 60 36">${[[6, 6], [23, 6], [40, 6], [6, 20], [23, 20], [40, 20]].map(([x, y]) => `<rect x="${x}" y="${y}" width="14" height="11" rx="2" fill="#cbd8e8"/>`).join("")}</svg>`,
    video: `<svg viewBox="0 0 60 36"><rect x="6" y="5" width="48" height="26" rx="3" fill="#0b2a55"/><path d="M26 12l12 6-12 6z" fill="#fff"/></svg>`,
    stats: `<svg viewBox="0 0 60 36">${[6, 23, 40].map(x => `<rect x="${x}" y="8" width="14" height="20" rx="3" fill="#0b2a55"/><rect x="${x + 3}" y="13" width="8" height="4" fill="#fff"/><rect x="${x + 3}" y="20" width="6" height="2" fill="#9fb1d6"/>`).join("")}</svg>`,
    testimonials: `<svg viewBox="0 0 60 36"><rect x="6" y="6" width="48" height="24" rx="3" fill="#fff" stroke="#cbd8e8"/><text x="10" y="16" font-size="7" fill="#f5b301">★★★★★</text><rect x="10" y="20" width="30" height="2.5" fill="#9fb1d6"/></svg>`,
    trainers: `<svg viewBox="0 0 60 36">${[8, 22, 36].map(x => `<circle cx="${x + 5}" cy="13" r="5" fill="#0b2a55"/><rect x="${x}" y="21" width="10" height="7" rx="3" fill="#cbd8e8"/>`).join("")}</svg>`,
    pricing: `<svg viewBox="0 0 60 36"><rect x="8" y="5" width="20" height="26" rx="3" fill="#fff" stroke="#cbd8e8"/><rect x="32" y="5" width="20" height="26" rx="3" fill="#fff" stroke="#d80f35" stroke-width="2"/><text x="18" y="16" font-size="7" fill="#0b2a55" text-anchor="middle" font-weight="900">$</text><text x="42" y="16" font-size="7" fill="#0b2a55" text-anchor="middle" font-weight="900">$$</text></svg>`,
    cta: `<svg viewBox="0 0 60 36"><rect x="4" y="9" width="52" height="18" rx="4" fill="#0b2a55"/><rect x="9" y="15" width="22" height="3" fill="#fff"/><rect x="38" y="13" width="14" height="8" rx="2" fill="#d80f35"/></svg>`,
    buttons: `<svg viewBox="0 0 60 36"><rect x="8" y="13" width="20" height="10" rx="3" fill="#d80f35"/><rect x="32" y="13" width="20" height="10" rx="3" fill="#fff" stroke="#0b2a55"/></svg>`,
    form: `<svg viewBox="0 0 60 36">${[6, 13, 20].map(y => `<rect x="10" y="${y}" width="40" height="5" rx="1" fill="#fff" stroke="#cbd8e8"/>`).join("")}<rect x="10" y="27" width="16" height="5" rx="2" fill="#d80f35"/></svg>`,
    map: `<svg viewBox="0 0 60 36"><rect x="6" y="6" width="48" height="24" rx="3" fill="#e6eef8"/><path d="M6 20l14-6 12 8 14-10 8 4" stroke="#9fb1d6" fill="none" stroke-width="2"/><circle cx="34" cy="18" r="4" fill="#d80f35"/></svg>`,
    divider: `<svg viewBox="0 0 60 36"><rect x="8" y="17" width="44" height="2" rx="1" fill="#cbd8e8"/></svg>`
  };

  function paintLeft() {
    if (!sb) return;
    const { esc, store, dateLabel } = S();
    const rail = $("#sbLeft");
    $$("[data-sb-tab]").forEach(b => b.classList.toggle("active", b.dataset.sbTab === sb.leftTab));
    if (sb.leftTab === "pages") {
      const q = sb.pageSearch.toLowerCase();
      const pages = (store.pages || []).filter(p => !q || `${p.title} ${p.slug} ${p.market}`.toLowerCase().includes(q));
      const group = (label, list, hint) => `<h3>${label}</h3>${list.length ? list.map(p => `<button type="button" class="sb-page-row ${p.id === sb.pageId ? "active" : ""}" data-sb-page="${esc(p.id)}" data-type="${esc(p.page_type || "ad")}"><span class="sb-page-dot ${p.status === "published" ? "live" : ""}"></span><span class="sb-page-name">${esc(p.title || p.market || p.slug)}<small>${esc(p.public_path || `/${p.slug}`)} · ${p.status === "published" ? "Live" : "Draft"}${p.updated_at ? ` · ${esc(dateLabel(p.updated_at))}` : ""}</small></span></button>`).join("") : `<p class="ps-help">${hint}</p>`}`;
      rail.innerHTML = `
        <button type="button" class="sb-big" data-sb-act="new-page">+ New page</button>
        <input class="sb-search" type="search" placeholder="Search pages…" value="${esc(sb.pageSearch)}" data-sb-search="pages">
        ${group("Site pages", pages.filter(p => p.page_type === "site"), "None yet. Press + New page.")}
        ${group("Landing pages", pages.filter(p => p.page_type === "landing"), "None yet.")}
        ${group("Ad pages", pages.filter(p => !p.page_type || p.page_type === "ad"), "None yet. Ad pages open in the ad editor.")}
        <p class="ps-help" style="margin-top:14px">Import the current website's pages (About, Facility, Contact, Dog Training…) from <b>+ New page → Import</b>. The original file stays live until you publish your copy.</p>`;
    } else if (sb.leftTab === "blocks") {
      const q = sb.blockSearch.toLowerCase();
      const groups = [...new Set(T.BLOCK_TYPES.map(b => b.group))];
      rail.innerHTML = `
        <input class="sb-search" type="search" placeholder="Search blocks… (hero, form, faq)" value="${esc(sb.blockSearch)}" data-sb-search="blocks">
        <p class="ps-help">${sb.draft ? (sb.insertAt !== null ? `Click a block to put it at position ${sb.insertAt + 1}.` : sb.selectedId ? "Click a block to add it after the selected one." : "Click a block to add it to the end of the page.") : "Open a page first, then add blocks."}</p>
        ${groups.map(g => { const list = T.BLOCK_TYPES.filter(b => b.group === g && (!q || `${b.label} ${b.help} ${b.type}`.toLowerCase().includes(q))); return list.length ? `<h3>${esc(g)}</h3><div class="sb-block-grid">${list.map(b => `<button type="button" class="sb-block-card" data-sb-addblock="${b.type}" ${sb.draft ? "" : "disabled"} title="${esc(b.help)}"><span class="sb-thumb">${BLOCK_ICONS[b.type] || ""}</span><strong>${esc(b.label)}</strong><small>${esc(b.help)}</small></button>`).join("")}</div>` : ""; }).join("") || `<p class="ps-help">No block matches “${esc(sb.blockSearch)}”.</p>`}`;
    } else if (sb.leftTab === "theme") {
      rail.innerHTML = themePanel();
    } else if (sb.leftTab === "nav") {
      rail.innerHTML = navPanel();
    }
  }

  // ───────────────────────── theme + menus panels ─────────────────────────
  const F = (label, path, value, opts = {}) => S().field(label, path, value, opts).replace(/data-ps-field=/g, "data-sb-field=").replace(/data-ps-list=/g, "data-sb-list=");
  const colorField = (label, path, value, fallback) => `<label class="ps-field"><span>${S().esc(label)}</span><div class="ps-row"><input type="color" data-sb-field="${S().esc(path)}" value="${S().esc(value || fallback)}"><input type="text" data-sb-field="${S().esc(path)}" value="${S().esc(value || "")}" placeholder="${S().esc(fallback)}"></div></label>`;
  const uploadField = (label, path, value, accept = "image/*") => `<div class="ps-field"><span>${S().esc(label)}</span>${value ? `<img class="sb-thumb-img" src="${S().esc(value)}" alt="">` : ""}<div class="ps-row"><input data-sb-field="${S().esc(path)}" value="${S().esc(value || "")}" placeholder="https://… or assets/…"><label class="ps-btn sb-upload-btn"><input type="file" accept="${accept}" data-sb-upload="${S().esc(path)}" hidden>Upload</label></div></div>`;

  function themePanel() {
    const { esc } = S();
    const t = sb.themeDraft || (sb.themeDraft = S().clone(siteCache.theme));
    const warnings = T.themeWarnings(t);
    const pairSel = T.FONT_PAIRS.find(p => p.head === t.fontHead && p.body === t.fontBody)?.id || "custom";
    return `
      <h3>Site theme</h3>
      <p class="ps-help">Fonts, colours, buttons and spacing for <b>every</b> Site Builder page. A page can override these under its Page tab. Saving applies within a minute.</p>
      <h4>Fonts</h4>
      <label class="ps-field"><span>Quick pick (headline + body)</span><select data-sb-theme="pair">${T.FONT_PAIRS.map(p => `<option value="${p.id}" ${pairSel === p.id ? "selected" : ""}>${esc(p.label)}</option>`).join("")}<option value="custom" ${pairSel === "custom" ? "selected" : ""}>Custom (below)</option></select></label>
      <div class="ps-row">${F("Headline font", "site.fontHead", t.fontHead, { type: "select", options: T.SITE_FONTS.map(f => [f.id, f.label]) })}${F("Body font", "site.fontBody", t.fontBody, { type: "select", options: T.SITE_FONTS.map(f => [f.id, f.label]) })}</div>
      <div class="sb-font-preview" style="font-family:${esc(T.SITE_FONTS.find(f => f.id === t.fontBody)?.stack || "Inter,Arial,sans-serif")}"><b style="font-family:${esc(T.SITE_FONTS.find(f => f.id === t.fontHead)?.stack || "Inter,Arial,sans-serif")}">Serious Training. Serious Results.</b><span>Obedience, behavior help and specialty training for real homes.</span></div>
      ${F("Base text size", "site.baseSize", t.baseSize, { type: "select", options: T.BASE_SIZES.map(s => [s, `${s}px${s === "16" ? " (default)" : ""}`]) })}
      <h4>Colours</h4>
      ${colorField("Primary (header, bands, headings)", "site.colors.primary", t.colors.primary, "#062650")}
      ${colorField("Accent (buttons, links)", "site.colors.accent", t.colors.accent, "#ce1233")}
      ${colorField("Secondary (soft backgrounds)", "site.colors.secondary", t.colors.secondary, "#f4f8fc")}
      ${colorField("Page background", "site.colors.background", t.colors.background, "#ffffff")}
      ${colorField("Text", "site.colors.text", t.colors.text, "#0f2340")}
      ${warnings.length ? `<div class="sb-warn">${warnings.map(w => `<div>⚠ ${esc(w)}</div>`).join("")}</div>` : `<div class="sb-ok">✓ Every colour pair is readable (4.5:1 or better).</div>`}
      <h4>Buttons and spacing</h4>
      <div class="ps-row">${F("Button shape", "site.buttonShape", t.buttonShape, { type: "select", options: [["rounded", "Rounded"], ["pill", "Pill"], ["square", "Square"]] })}${F("Button fill", "site.buttonFill", t.buttonFill, { type: "select", options: [["filled", "Filled"], ["outline", "Outline"]] })}</div>
      ${F("Section spacing", "site.spacing", t.spacing, { type: "select", options: [["tight", "Tight"], ["normal", "Normal"], ["roomy", "Roomy"]] })}
      <h4>Logo and favicon</h4>
      ${uploadField("Logo (header + footer; blank = the current logo)", "site.logo", t.logo)}
      ${uploadField("Favicon (browser tab icon; blank = current)", "site.favicon", t.favicon, "image/png,image/x-icon,image/svg+xml")}
      ${F("Tagline (top bar + footer)", "site.tagline", t.tagline)}
      ${F("Phone number shown", "site.phone", t.phone)}
      <button type="button" class="ps-btn red" data-sb-act="save-theme">Save site theme</button>
      <button type="button" class="ps-btn" data-sb-act="reset-theme">Back to the site's original look</button>
      <p class="ps-help" style="margin-top:10px">${siteCache.themeMeta ? esc(siteCache.themeMeta) : "The canvas shows the theme as you change it; nothing is saved until you press Save."}</p>`;
  }

  function navPanel() {
    const { esc } = S();
    const n = sb.navDraft || (sb.navDraft = S().clone(siteCache.nav));
    const linkRows = (list, path) => list.map((l, i) => `<div class="sb-nav-row"><input data-sb-field="${path}.${i}.label" value="${esc(l.label)}" placeholder="Menu words"><input data-sb-field="${path}.${i}.href" value="${esc(l.href)}" placeholder="/page-address"><button type="button" class="ps-icon-btn" data-sb-act="nav-move" data-path="${path}" data-index="${i}" data-dir="-1" title="Up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="ps-icon-btn" data-sb-act="nav-move" data-path="${path}" data-index="${i}" data-dir="1" title="Down" ${i === list.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="ps-icon-btn danger" data-sb-act="nav-remove" data-path="${path}" data-index="${i}" title="Remove">✕</button></div>${l.children?.length ? `<p class="ps-help" style="margin:-4px 0 8px 8px">↳ keeps its ${l.children.length} drop-down links (${esc(l.children.map(c => c.label).join(", "))})</p>` : ""}`).join("");
    const pageOptions = (S().store.pages || []).filter(p => p.page_type !== "ad").map(p => `<option value="${esc(p.public_path || `/${p.slug}`)}">${esc(p.title || p.slug)}${p.status !== "published" ? " (draft)" : ""}</option>`).join("");
    const empty = !n.header.links.length;
    return `
      <h3>Menus</h3>
      <p class="ps-help">Which pages appear in the header and footer, in what order. ${empty ? "<b>Nothing is saved yet, so every page shows the website's built-in menus.</b> Press “Start from the current menus” to edit them." : "Saved menus show on every Site Builder page within a minute."}</p>
      ${empty ? `<button type="button" class="ps-btn navy" data-sb-act="nav-start">Start from the current menus</button><div style="height:10px"></div>` : ""}
      <h4>Header menu</h4>
      ${linkRows(n.header.links, "nav.header.links")}
      <div class="ps-row"><select data-sb-nav-pick="nav.header.links"><option value="">Add a page…</option>${pageOptions}</select><button type="button" class="ps-btn" data-sb-act="nav-add" data-path="nav.header.links">+ Add a blank link</button></div>
      <h4>Header buttons (up to 2)</h4>
      ${n.header.ctas.map((b, i) => `<div class="sb-nav-row"><input data-sb-field="nav.header.ctas.${i}.label" value="${esc(b.label)}" placeholder="Button words"><input data-sb-field="nav.header.ctas.${i}.href" value="${esc(b.href)}" placeholder="/contact"><span></span><span></span><button type="button" class="ps-icon-btn danger" data-sb-act="nav-remove" data-path="nav.header.ctas" data-index="${i}">✕</button></div>`).join("")}
      ${n.header.ctas.length < 2 ? `<button type="button" class="ps-btn" data-sb-act="nav-add" data-path="nav.header.ctas">+ Add a button</button>` : ""}
      <h4>Footer</h4>
      ${F("Footer sentence", "nav.footer.blurb", n.footer.blurb, { type: "textarea", rows: 2 })}
      ${n.footer.groups.map((g, gi) => `<div class="ps-item"><div class="ps-item-head"><input data-sb-field="nav.footer.groups.${gi}.title" value="${esc(g.title)}" placeholder="Column title" style="font-weight:900"><button type="button" class="ps-icon-btn danger" data-sb-act="nav-remove" data-path="nav.footer.groups" data-index="${gi}" title="Remove column">✕</button></div>${linkRows(g.links, `nav.footer.groups.${gi}.links`)}<div class="ps-row"><select data-sb-nav-pick="nav.footer.groups.${gi}.links"><option value="">Add a page…</option>${pageOptions}</select><button type="button" class="ps-btn" data-sb-act="nav-add" data-path="nav.footer.groups.${gi}.links">+ Blank link</button></div></div>`).join("")}
      ${n.footer.groups.length < 4 ? `<button type="button" class="ps-btn" data-sb-act="nav-add" data-path="nav.footer.groups">+ Add a footer column</button>` : ""}
      <div style="height:12px"></div>
      <button type="button" class="ps-btn red" data-sb-act="save-nav">Save menus</button>
      <button type="button" class="ps-btn" data-sb-act="nav-clear">Clear (use the built-in menus)</button>`;
  }

  // ───────────────────────── right rail (inspector) ─────────────────────────
  function paintRight() {
    if (!sb) return;
    const rail = $("#sbRight");
    $$("[data-sb-rtab]").forEach(b => b.classList.toggle("active", b.dataset.sbRtab === sb.rightTab));
    if (!sb.draft) { rail.innerHTML = `<p class="ps-help">Open a page from the left, or press <b>+ New page</b>.</p>`; return; }
    const index = sb.draft.blocks.findIndex(b => b.id === sb.selectedId);
    if (sb.rightTab === "block") {
      if (index === -1) { rail.innerHTML = `<h3>No block selected</h3><p class="ps-help">Click a block on the page to change its words, photos and colours here.</p><button type="button" class="ps-btn navy" data-sb-act="show-blocks">+ Add a block</button>`; return; }
      rail.innerHTML = blockFields(sb.draft.blocks[index], index);
      wireRichEditors(rail);
    } else {
      rail.innerHTML = pageFields();
    }
  }

  const rich = (label, path, html) => `<div class="ps-field"><span>${S().esc(label)}</span><div class="sb-rich-toolbar">${[["bold", "B", "Bold"], ["italic", "I", "Italic"], ["underline", "U", "Underline"], ["h2", "H2", "Big heading"], ["h3", "H3", "Small heading"], ["ul", "• List", "Bullet list"], ["ol", "1. List", "Numbered list"], ["quote", "❝", "Quote"], ["link", "🔗", "Link"], ["unlink", "⛓", "Remove link"], ["image", "🖼", "Image by address"], ["clear", "Tx", "Clear formatting"]].map(([cmd, l, t]) => `<button type="button" data-sb-rich="${cmd}" title="${t}">${l}</button>`).join("")}</div><div class="sb-rich" contenteditable="true" data-sb-richfield="${S().esc(path)}" spellcheck="true">${html}</div><p class="ps-help">Bold, italic, links, lists and headings only. Anything else is cleaned out automatically.</p></div>`;
  function imageField(label, path, value) {
    const { esc, photoChoices } = S();
    const choices = photoChoices();
    return `<div class="ps-field"><span>${esc(label)}</span>${value ? `<img class="sb-thumb-img" src="${esc(value.startsWith("http") || value.startsWith("/") ? value : `/${value}`)}" alt="">` : ""}<div class="ps-row"><input data-sb-field="${esc(path)}" value="${esc(value || "")}" placeholder="assets/… or https://…"><label class="ps-btn sb-upload-btn"><input type="file" accept="image/*" data-sb-upload="${esc(path)}" hidden>Upload</label></div><details class="sb-photo-details"><summary>Choose from the site's photos</summary><div class="ps-photo-grid">${choices.map(p => `<button type="button" class="${p === value ? "selected" : ""}" data-sb-photo="${esc(path)}" data-src="${esc(p)}" style="background-image:url('/${esc(p)}')" title="${esc(p)}"></button>`).join("")}</div></details></div>`;
  }
  const btnFields = (label, path, b) => `<div class="ps-item"><div class="ps-item-head"><span>${S().esc(label)}</span></div><div class="ps-row">${F("Words", `${path}.label`, b?.label || "")}${F("Link", `${path}.href`, b?.href || "", { placeholder: "/contact or https://…" })}</div>${F("Style", `${path}.style`, b?.style || "primary", { type: "select", options: [["primary", "Filled (accent)"], ["outline", "Outline"], ["link", "Text link"]] })}</div>`;
  const listItem = (title, index, i, body, removable = true) => `<div class="ps-item"><div class="ps-item-head"><span>${S().esc(title)}</span><span>${i > 0 ? `<button type="button" class="ps-icon-btn" data-sb-act="item-move" data-index="${index}" data-item="${i}" data-dir="-1" title="Move up">↑</button>` : ""}${removable ? `<button type="button" class="ps-icon-btn danger" data-sb-act="item-remove" data-index="${index}" data-item="${i}" title="Remove">✕</button>` : ""}</span></div>${body}</div>`;

  function blockFields(block, index) {
    const { esc } = S();
    const p = key => `blocks.${index}.${key}`;
    let fields = "";
    switch (block.type) {
      case "hero":
        fields = `${F("Background", p("style"), block.style, { type: "select", options: [["image", "Photo"], ["video", "Video (MP4)"], ["solid", "Solid colour"]] })}
          ${block.style !== "solid" ? imageField(block.style === "video" ? "Poster photo (shows before the video plays)" : "Photo", block.style === "video" ? p("poster") : p("image"), block.style === "video" ? block.poster : block.image) : ""}
          ${block.style === "video" ? uploadField("Video file (MP4, under 4 MB) or https:// address", p("video"), block.video, "video/mp4") : ""}
          ${F("Small line above the headline", p("eyebrow"), block.eyebrow)}${F("Headline (H1)", p("headline"), block.headline, { type: "textarea", rows: 2 })}${F("Sentence under it", p("sub"), block.sub, { type: "textarea", rows: 3 })}
          ${btnFields("Button 1", p("buttons.0"), block.buttons[0])}${btnFields("Button 2 (blank = none)", p("buttons.1"), block.buttons[1])}
          <div class="ps-row">${F("Height", p("height"), block.height, { type: "select", options: [["short", "Short"], ["normal", "Normal"], ["tall", "Tall"]] })}${F("Darken photo (0–90)", p("overlay"), block.overlay)}</div>`;
        break;
      case "richtext": fields = rich("Words", p("html"), block.html); break;
      case "imagetext":
        fields = `${imageField("Photo", p("image"), block.image)}${F("Photo description (alt text)", p("alt"), block.alt)}${F("Photo side", p("side"), block.side, { type: "select", options: [["right", "Right"], ["left", "Left"]] })}${F("Small line", p("eyebrow"), block.eyebrow)}${F("Heading", p("heading"), block.heading)}${rich("Words", p("html"), block.html)}${btnFields("Button (blank = none)", p("button"), block.button)}`;
        break;
      case "columns":
        fields = `${F("Small line", p("eyebrow"), block.eyebrow)}${F("Heading", p("heading"), block.heading)}${F("Intro sentence", p("text"), block.text, { type: "textarea", rows: 2 })}${F("Columns", p("count"), block.count, { type: "select", options: [[2, "2"], [3, "3"], [4, "4"]] })}
          ${block.items.map((it, i) => listItem(`Card ${i + 1}`, index, i, `${F("Icon (emoji, optional)", `${p("items")}.${i}.icon`, it.icon)}${imageField("Photo (optional, replaces the icon)", `${p("items")}.${i}.image`, it.image)}${F("Title", `${p("items")}.${i}.title`, it.title)}${F("Text", `${p("items")}.${i}.text`, it.text, { type: "textarea", rows: 3 })}${F("Link (optional)", `${p("items")}.${i}.href`, it.href, { placeholder: "/dog-training" })}`)).join("")}
          <button type="button" class="ps-btn" data-sb-act="item-add" data-index="${index}">+ Add a card</button>`;
        break;
      case "steps":
        fields = `${F("Small line", p("eyebrow"), block.eyebrow)}${F("Heading", p("heading"), block.heading)}${F("Intro sentence", p("text"), block.text, { type: "textarea", rows: 2 })}
          ${block.items.map((it, i) => listItem(`Step ${i + 1}`, index, i, `${F("Title", `${p("items")}.${i}.title`, it.title)}${F("Text", `${p("items")}.${i}.text`, it.text, { type: "textarea", rows: 3 })}`)).join("")}
          <button type="button" class="ps-btn" data-sb-act="item-add" data-index="${index}">+ Add a step</button>`;
        break;
      case "faq":
        fields = `${F("Small line", p("eyebrow"), block.eyebrow)}${F("Heading", p("heading"), block.heading)}
          ${block.items.map((it, i) => listItem(`Question ${i + 1}`, index, i, `${F("Question", `${p("items")}.${i}.q`, it.q)}${F("Answer", `${p("items")}.${i}.a`, it.a, { type: "textarea", rows: 3 })}`)).join("")}
          <button type="button" class="ps-btn" data-sb-act="item-add" data-index="${index}">+ Add a question</button>`;
        break;
      case "gallery":
        fields = `${F("Heading (optional)", p("heading"), block.heading)}${F("Photos per row", p("columns"), block.columns, { type: "select", options: [[2, "2"], [3, "3"], [4, "4"]] })}
          ${block.items.map((it, i) => listItem(`Photo ${i + 1}`, index, i, `${imageField("Photo", `${p("items")}.${i}.image`, it.image)}${F("Caption (optional)", `${p("items")}.${i}.caption`, it.caption)}${F("Description (alt text)", `${p("items")}.${i}.alt`, it.alt)}`)).join("")}
          <button type="button" class="ps-btn" data-sb-act="item-add" data-index="${index}">+ Add a photo</button>`;
        break;
      case "video":
        fields = `${F("Where is the video?", p("provider"), block.provider, { type: "select", options: [["youtube", "YouTube"], ["vimeo", "Vimeo"]] })}${F("Video id (the part after v= or the last part of the link)", p("videoId"), block.videoId, { placeholder: "dQw4w9WgXcQ" })}${F("Heading (optional)", p("heading"), block.heading)}${F("Sentence (optional)", p("text"), block.text, { type: "textarea", rows: 2 })}`;
        break;
      case "stats":
        fields = `${block.items.map((it, i) => listItem(`Number ${i + 1}`, index, i, `<div class="ps-row">${F("Number", `${p("items")}.${i}.value`, it.value)}${F("Label", `${p("items")}.${i}.label`, it.label)}</div>`)).join("")}<button type="button" class="ps-btn" data-sb-act="item-add" data-index="${index}">+ Add a number</button>`;
        break;
      case "testimonials":
        fields = `${F("Small line", p("eyebrow"), block.eyebrow)}${F("Heading", p("heading"), block.heading)}${F("Where do the reviews come from?", p("source"), block.source, { type: "select", options: [["approved", "Approved reviews (Reviews tab)"], ["typed", "Reviews I type here"]] })}${F("How many to show", p("limit"), block.limit)}
          ${block.source === "approved" ? `<p class="ps-help">Shows the reviews approved and published for the homepage (lorenzos-team). ${siteCache.data?.reviews?.length ? `${siteCache.data.reviews.length} available right now.` : "None are published yet, so the block is empty until some are."}</p>` : block.items.map((it, i) => listItem(`Review ${i + 1}`, index, i, `${F("Words", `${p("items")}.${i}.quote`, it.quote, { type: "textarea", rows: 3 })}<div class="ps-row">${F("Name", `${p("items")}.${i}.name`, it.name)}${F("Place", `${p("items")}.${i}.location`, it.location)}</div>${F("Stars", `${p("items")}.${i}.rating`, it.rating, { type: "select", options: [[5, "5"], [4, "4"], [3, "3"]] })}`)).join("") + `<button type="button" class="ps-btn" data-sb-act="item-add" data-index="${index}">+ Add a review</button>`}`;
        break;
      case "trainers": {
        const all = siteCache.data?.trainers || [];
        fields = `${F("Small line", p("eyebrow"), block.eyebrow)}${F("Heading", p("heading"), block.heading)}${F("Sentence", p("text"), block.text, { type: "textarea", rows: 2 })}${F("Which trainers?", p("mode"), block.mode, { type: "select", options: [["market", "Everyone in a market"], ["picked", "Hand-picked"]] })}
          ${block.mode === "market" ? F("Market or state (e.g. Cleveland, or OH)", p("market"), block.market) : `<div class="ps-field"><span>Pick trainers (published pages only)</span><div class="sb-check-list">${all.map(t => `<label><input type="checkbox" data-sb-slugpick="${index}" value="${esc(t.slug)}" ${block.slugs.includes(t.slug) ? "checked" : ""}> ${esc(t.full_name)} <small>${esc(t.market || t.state || "")}</small></label>`).join("") || "<small>No published trainers found.</small>"}</div></div>`}
          ${F("How many to show", p("limit"), block.limit)}<p class="ps-help">Only trainers with a published page appear. ${all.length} published right now.</p>`;
        break;
      }
      case "pricing":
        fields = `${F("Small line", p("eyebrow"), block.eyebrow)}${F("Heading", p("heading"), block.heading)}${F("Intro sentence", p("text"), block.text, { type: "textarea", rows: 2 })}
          ${block.plans.map((pl, i) => listItem(`Plan ${i + 1}`, index, i, `<div class="ps-row">${F("Name", `${p("plans")}.${i}.name`, pl.name)}${F("Price", `${p("plans")}.${i}.price`, pl.price, { placeholder: "From $1,250" })}</div>${F("Note under the price", `${p("plans")}.${i}.note`, pl.note)}${F("What's included", `${p("plans")}.${i}.features`, pl.features, { list: true, rows: 4 })}${btnFields("Button", `${p("plans")}.${i}.button`, pl.button)}${F("Highlight this plan", `${p("plans")}.${i}.featured`, pl.featured, { type: "checkbox" })}`)).join("")}
          <button type="button" class="ps-btn" data-sb-act="item-add" data-index="${index}">+ Add a plan</button>`;
        break;
      case "cta":
        fields = `${F("Heading", p("heading"), block.heading)}${F("Sentence", p("text"), block.text, { type: "textarea", rows: 2 })}${btnFields("Button", p("button"), block.button)}${btnFields("Second button (blank = none)", p("button2"), block.button2)}`;
        break;
      case "buttons":
        fields = `${[0, 1, 2, 3].map(i => btnFields(`Button ${i + 1}${i ? " (blank = none)" : ""}`, `${p("buttons")}.${i}`, block.buttons[i])).join("")}`;
        break;
      case "form":
        fields = `${F("Heading", p("heading"), block.heading)}${F("Sentence beside the form", p("text"), block.text, { type: "textarea", rows: 3 })}${F("Source page name (shows on the lead)", p("sourcePage"), block.sourcePage)}<p class="ps-help">This is the office lead form: the fields, the pixel Lead event and the phone rule are fixed. ${window.LDTT_IS_SANDBOX ? "On the practice copy the form is switched off for visitors." : ""}</p>`;
        break;
      case "map":
        fields = `${F("Heading", p("heading"), block.heading)}${F("Sentence", p("text"), block.text, { type: "textarea", rows: 2 })}${F("Address", p("address"), block.address)}<div class="ps-row">${F("Phone", p("phone"), block.phone)}${F("Email", p("email"), block.email)}</div>${F("Hours", p("hours"), block.hours)}${F("Show the map", p("showMap"), block.showMap, { type: "checkbox" })}`;
        break;
      case "divider":
        fields = `<div class="ps-row">${F("Style", p("style"), block.style, { type: "select", options: [["line", "Thin line"], ["space", "Empty space"]] })}${F("Size", p("size"), block.size, { type: "select", options: [["small", "Small"], ["normal", "Normal"], ["large", "Large"]] })}</div>`;
        break;
      default: fields = "";
    }
    const d = block.design;
    const design = `<details class="sb-design" ${sb.designOpen ? "open" : ""}><summary>Design: background, spacing, width</summary>
      ${colorField("Background colour (blank = page background)", p("design.bgColor"), d.bgColor, "#ffffff")}
      ${imageField("Background photo (optional)", p("design.bgImage"), d.bgImage)}
      ${F("Text colour", p("design.tone"), d.tone, { type: "select", options: [["", "Automatic"], ["light", "Light (for dark backgrounds)"], ["dark", "Dark"]] })}
      <div class="ps-row">${F("Padding", p("design.padding"), d.padding, { type: "select", options: [["tight", "Tight"], ["normal", "Normal"], ["roomy", "Roomy"], ["none", "None"]] })}${F("Alignment", p("design.align"), d.align, { type: "select", options: [["left", "Left"], ["center", "Centred"]] })}</div>
      ${F("Width", p("design.width"), d.width, { type: "select", options: [["narrow", "Narrow (reading)"], ["normal", "Normal"], ["wide", "Wide"], ["full", "Full width"]] })}
      ${F("Hide on phones", p("design.hideMobile"), d.hideMobile, { type: "checkbox" })}
      ${F("Anchor (link to this block with #name)", p("design.anchor"), d.anchor, { placeholder: "about-us" })}</details>`;
    return `<div class="sb-block-head"><h3>${index + 1}. ${esc(T.BLOCK_LABEL(block.type))}</h3><div><button type="button" class="ps-icon-btn" data-sb-act="move" data-index="${index}" data-dir="-1" title="Move up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" class="ps-icon-btn" data-sb-act="move" data-index="${index}" data-dir="1" title="Move down" ${index === sb.draft.blocks.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="ps-icon-btn" data-sb-act="duplicate" data-index="${index}" title="Duplicate">⧉</button><button type="button" class="ps-icon-btn danger" data-sb-act="remove" data-index="${index}" title="Delete">✕</button></div></div>${fields}${design}`;
  }

  function pageFields() {
    const { esc, dateLabel } = S();
    const d = sb.draft;
    const t = d.theme;
    const imp = (S().store.importable || []).find(p => p.slug === d.slug);
    return `
      <h3>Page settings</h3>
      ${F("Page name", "title", d.title)}
      ${F("Web address", "slug", d.slug, { placeholder: "about" })}
      <p class="ps-help">Lives at <b>/${esc(d.slug || "…")}</b> and <b>/p/${esc(d.slug || "…")}</b>. Letters, numbers and dashes only.${imp ? ` This address belongs to <b>${esc(imp.file)}</b> on the website: once you publish, your page shows instead; Unpublish brings the file back.` : ""}</p>
      ${F("Page type", "pageType", d.pageType, { type: "select", options: [["site", "Site page (full menu header + footer)"], ["landing", "Landing page (slim header, form required)"]] })}
      ${F("Header / footer", "chrome", d.chrome, { type: "select", options: [["full", "Full site menus"], ["slim", "Slim (logo + phone + button)"], ["none", "None"]] })}
      <h4>Search (SEO)</h4>
      ${F("Search title (blank = page name)", "seo.title", d.seo.title)}
      ${F("Search description (one sentence)", "seo.description", d.seo.description, { type: "textarea", rows: 3 })}
      ${imageField("Share image (Facebook / text previews)", "seo.ogImage", d.seo.ogImage)}
      ${F("Hide from Google (noindex)", "seo.noindex", d.seo.noindex, { type: "checkbox" })}
      <h4>This page's look</h4>
      <p class="ps-help">Blank = use the Site theme. Set something here only to make this page different.</p>
      <div class="ps-row">${F("Headline font", "theme.fontHead", t.fontHead, { type: "select", options: [["", "Site theme"], ...T.SITE_FONTS.filter(f => f.id).map(f => [f.id, f.label])] })}${F("Body font", "theme.fontBody", t.fontBody, { type: "select", options: [["", "Site theme"], ...T.SITE_FONTS.filter(f => f.id).map(f => [f.id, f.label])] })}</div>
      ${colorField("Primary colour", "theme.colors.primary", t.colors.primary, siteCache.theme.colors.primary)}${colorField("Accent colour", "theme.colors.accent", t.colors.accent, siteCache.theme.colors.accent)}${colorField("Page background", "theme.colors.background", t.colors.background, siteCache.theme.colors.background)}${colorField("Text colour", "theme.colors.text", t.colors.text, siteCache.theme.colors.text)}
      ${F("Section spacing", "theme.spacing", t.spacing, { type: "select", options: [["", "Site theme"], ["tight", "Tight"], ["normal", "Normal"], ["roomy", "Roomy"]] })}
      <button type="button" class="ps-btn" data-sb-act="clear-page-theme">Use the site theme for everything</button>
      ${durabilityPanel()}
      <h4>History</h4>
      <p class="ps-help">Every publish keeps a version. Restore puts it back into the draft; publish again to make it live.</p>
      <button type="button" class="ps-btn navy" data-sb-act="snapshot">Save a version of the draft now</button>
      <div style="height:8px"></div>
      ${(sb.revisions || []).length ? sb.revisions.map(r => `<div class="ps-rev"><div><strong>${r.kind === "published" ? "Published" : "Draft"} v${esc(r.revision)}</strong><span>${esc(dateLabel(r.created_at))}${r.created_by ? ` · ${esc(r.created_by)}` : ""}</span></div><button type="button" class="ps-btn" data-sb-act="restore" data-rev="${esc(r.id)}">Restore</button></div>`).join("") : `<div class="ps-empty">No versions yet. The first publish creates one.</div>`}
      <h4>Danger zone</h4>
      ${sb.page.status === "published" ? `<button type="button" class="ps-btn" data-sb-act="unpublish">Take this page offline</button>` : ""}
      <button type="button" class="ps-btn" style="color:#b00020;border-color:#f1c2ca" data-sb-act="archive">Remove this page</button>`;
  }

  // ───────────────────────── canvas ─────────────────────────
  const repaintCanvas = (() => { let t; return () => { clearTimeout(t); t = setTimeout(paintCanvas, 200); }; })();
  function paintCanvas() {
    if (!sb) return;
    const frame = $("#sbFrame"); const canvas = $("#sbCanvas");
    canvas.className = `sb-canvas ${sb.device}`;
    $("#sbCanvasLabel").textContent = { desktop: "Desktop", tablet: "Tablet (820px)", mobile: "Mobile (430px)" }[sb.device];
    if (sb.panel) { $("#sbPanel").hidden = false; frame.style.display = "none"; return; }
    $("#sbPanel").hidden = true; frame.style.display = "";
    if (!sb.draft) { frame.srcdoc = `<body style="font-family:Inter,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#53677f;background:#fff"><div style="text-align:center;max-width:520px;padding:20px"><h1 style="color:#082754">Welcome to the Site Builder</h1><p style="font-size:17px;line-height:1.6">1. Pick a page on the left, or press <b>+ New page</b>.<br>2. Click any block on the page to change it on the right.<br>3. Press <b>Publish</b> when it looks right.</p></div></body>`; return; }
    let html = "";
    try { html = T.renderSitePage(sb.draft, { editor: true, base: "/", publicPath: `/${sb.draft.slug}`, siteTheme: sb.themeDraft || siteCache.theme, navigation: sb.navDraft || siteCache.nav, data: siteCache.data }); }
    catch (error) { html = `<p style="font-family:sans-serif;padding:20px">The preview could not render: ${S().esc(error.message)}</p>`; }
    try { sb.frameScroll = frame.contentWindow?.scrollY || sb.frameScroll || 0; } catch { /* ignore */ }
    frame.addEventListener("load", () => wireFrame(frame), { once: true });
    frame.srcdoc = html;
  }

  function wireFrame(frame) {
    const doc = frame.contentDocument; if (!doc || !sb) return;
    try { frame.contentWindow.scrollTo(0, sb.frameScroll || 0); } catch { /* ignore */ }
    doc.querySelectorAll("a, button, form").forEach(el => el.addEventListener("click", e => { if (!e.target.closest("[data-sb-tool],[data-sb-add-btn]")) e.preventDefault(); }, true));
    doc.querySelectorAll("form").forEach(f => f.addEventListener("submit", e => e.preventDefault()));
    doc.querySelectorAll("[data-sb-block]").forEach(el => {
      el.classList.toggle("sb-selected", el.dataset.sbBlock === sb.selectedId);
      el.addEventListener("click", event => {
        const tool = event.target.closest("[data-sb-tool]");
        const index = sb.draft.blocks.findIndex(b => b.id === el.dataset.sbBlock);
        if (tool) { event.stopPropagation(); if (tool.dataset.sbTool !== "drag") blockAction(tool.dataset.sbTool, index); return; }
        selectBlock(el.dataset.sbBlock, { scroll: false });
      });
      // drag to reorder
      el.addEventListener("dragstart", e => { if (!e.target.closest("[data-sb-tool=drag]")) { e.preventDefault(); return; } sb.dragId = el.dataset.sbBlock; el.classList.add("sb-dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", sb.dragId); } catch { /* ignore */ } });
      el.addEventListener("dragend", () => { el.classList.remove("sb-dragging"); doc.querySelectorAll(".sb-drop-before,.sb-drop-after").forEach(x => x.classList.remove("sb-drop-before", "sb-drop-after")); });
      el.addEventListener("dragover", e => { if (!sb.dragId || sb.dragId === el.dataset.sbBlock) return; e.preventDefault(); const r = el.getBoundingClientRect(); const before = e.clientY < r.top + r.height / 2; el.classList.toggle("sb-drop-before", before); el.classList.toggle("sb-drop-after", !before); });
      el.addEventListener("dragleave", () => el.classList.remove("sb-drop-before", "sb-drop-after"));
      el.addEventListener("drop", e => { e.preventDefault(); if (!sb.dragId) return; const from = sb.draft.blocks.findIndex(b => b.id === sb.dragId); let to = sb.draft.blocks.findIndex(b => b.id === el.dataset.sbBlock); if (from === -1 || to === -1) return; const r = el.getBoundingClientRect(); const before = e.clientY < r.top + r.height / 2; if (!before) to += 1; if (from < to) to -= 1; pushHistory(true); const [b] = sb.draft.blocks.splice(from, 1); sb.draft.blocks.splice(to, 0, b); sb.dragId = null; S().toast("Block moved."); markDirty({ rerail: true }); });
    });
    doc.querySelectorAll("[data-sb-add-btn]").forEach(btn => btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); sb.insertAt = Number(btn.dataset.sbAddBtn); sb.leftTab = "blocks"; sb.left = true; sb.blockSearch = ""; paintTop(); paintLeft(); paintRails(); $("#sbLeft .sb-search")?.focus(); }));
    // Keyboard inside the frame: Esc / undo reach the parent
    doc.addEventListener("keydown", e => onKeys(e, true));
  }

  function selectBlock(id, { scroll = true } = {}) {
    if (!sb) return;
    sb.selectedId = id; sb.rightTab = "block"; sb.right = true; sb.insertAt = null;
    paintTop(); paintRight(); paintRails();
    const doc = $("#sbFrame")?.contentDocument;
    if (doc) { doc.querySelectorAll("[data-sb-block]").forEach(el => el.classList.toggle("sb-selected", el.dataset.sbBlock === id)); if (scroll) doc.querySelector(`[data-sb-block="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  // ───────────────────────── editing ─────────────────────────
  function getPath(root, path) { return path.split(".").reduce((n, k) => (n == null ? undefined : n[k]), root); }
  function setPath(root, path, value) {
    const parts = path.split("."); let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) { if (node[parts[i]] == null) node[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {}; node = node[parts[i]]; }
    node[parts[parts.length - 1]] = value;
  }
  // Which object a path belongs to: page draft, the theme draft or the menus draft.
  function targetFor(path) {
    if (path.startsWith("nav.")) return { root: sb.navDraft || (sb.navDraft = S().clone(siteCache.nav)), path: path.slice(4), kind: "nav" };
    if (path.startsWith("site.")) return { root: sb.themeDraft || (sb.themeDraft = S().clone(siteCache.theme)), path: path.slice(5), kind: "theme" };
    return { root: sb.draft, path, kind: "page" };
  }

  function onInput(event) {
    if (!sb) return;
    const el = event.target;
    if (el.matches("[data-sb-search]")) { if (el.dataset.sbSearch === "blocks") sb.blockSearch = el.value; else sb.pageSearch = el.value; if (event.type === "input") { const pos = el.selectionStart; paintLeft(); const again = $("#sbLeft .sb-search"); again?.focus(); try { again.setSelectionRange(pos, pos); } catch { /* ignore */ } } return; }
    if (el.matches("[data-sb-theme=pair]")) { const pair = T.FONT_PAIRS.find(p => p.id === el.value); if (pair) { const t = sb.themeDraft || (sb.themeDraft = S().clone(siteCache.theme)); t.fontHead = pair.head; t.fontBody = pair.body; paintLeft(); repaintCanvas(); } return; }
    if (el.matches("[data-sb-nav-pick]") && el.value) { const page = (S().store.pages || []).find(p => (p.public_path || `/${p.slug}`) === el.value); const list = getPath(sb.navDraft || (sb.navDraft = S().clone(siteCache.nav)), el.dataset.sbNavPick.slice(4)); if (Array.isArray(list)) list.push({ label: page?.title || el.value.slice(1), href: el.value, children: [] }); paintLeft(); repaintCanvas(); return; }
    if (el.matches("[data-sb-slugpick]")) { const block = sb.draft.blocks[Number(el.dataset.sbSlugpick)]; if (!block) return; pushHistory(); block.slugs = $$(`[data-sb-slugpick="${el.dataset.sbSlugpick}"]:checked`).map(c => c.value); markDirty(); return; }
    if (el.matches("[data-sb-richfield]")) { if (event.type !== "input") return; const clean = T.sanitizeRichText(el.innerHTML); const t = targetFor(el.dataset.sbRichfield); pushHistory(); setPath(t.root, t.path, clean); markDirty({ canvas: true }); return; }
    const field = el.closest("[data-sb-field]");
    if (!field) return;
    const rawPath = field.dataset.sbField;
    let value;
    if (field.type === "checkbox") value = field.checked;
    else if (field.dataset.sbList) value = field.value.split("\n").map(v => v.trim()).filter(Boolean);
    else value = field.value;
    if (field.type === "color" || (field.type === "text" && /colors?\.|bgColor/.test(rawPath))) {
      $$(`[data-sb-field="${CSS.escape(rawPath)}"]`).forEach(twin => { if (twin !== field && /^#[0-9a-f]{6}$/i.test(value)) twin.value = value; });
      if (!/^#[0-9a-f]{6}$/i.test(value) && value !== "") return;
    }
    const t = targetFor(rawPath);
    if (t.kind === "page") {
      if (t.path === "slug") value = T.safeSlug(value);
      if (/\.(count|columns|limit|overlay|rating)$/.test(t.path)) value = Number(value);
      pushHistory();
      setPath(sb.draft, t.path, value);
      if (/^(title|slug|pageType)$/.test(t.path)) paintTop();
      const structural = event.type === "change" && (field.tagName === "SELECT" || field.type === "checkbox");
      markDirty({ rerail: structural });
      if (structural && sb.rightTab === "block") sb.designOpen = $("#sbRight .sb-design")?.open;
    } else {
      setPath(t.root, t.path, value);
      if (t.kind === "theme" && (event.type === "change" || /colors/.test(t.path))) { const open = $("#sbLeft .sb-warn, #sbLeft .sb-ok"); if (open) open.outerHTML = (() => { const w = T.themeWarnings(sb.themeDraft); return w.length ? `<div class="sb-warn">${w.map(x => `<div>⚠ ${S().esc(x)}</div>`).join("")}</div>` : `<div class="sb-ok">✓ Every colour pair is readable (4.5:1 or better).</div>`; })(); }
      if (t.kind === "theme" && event.type === "change" && field.tagName === "SELECT") paintLeft();
      repaintCanvas();
    }
  }

  function wireRichEditors(root) {
    root.querySelectorAll("[data-sb-rich]").forEach(btn => btn.addEventListener("mousedown", e => e.preventDefault()));
  }
  function richCommand(cmd, editor) {
    editor.focus();
    const exec = (c, v) => document.execCommand(c, false, v);
    switch (cmd) {
      case "bold": exec("bold"); break; case "italic": exec("italic"); break; case "underline": exec("underline"); break;
      case "h2": exec("formatBlock", "<h2>"); break; case "h3": exec("formatBlock", "<h3>"); break; case "quote": exec("formatBlock", "<blockquote>"); break;
      case "ul": exec("insertUnorderedList"); break; case "ol": exec("insertOrderedList"); break;
      case "link": { const url = window.prompt("Link address (like /contact or https://…)"); if (url) exec("createLink", url); break; }
      case "unlink": exec("unlink"); break;
      case "image": { const url = window.prompt("Image address (https://… or assets/…)"); if (url) exec("insertImage", url); break; }
      case "clear": exec("removeFormat"); exec("formatBlock", "<p>"); break;
      default:
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function blockAction(act, index, extra = {}) {
    const d = sb.draft; const { toast } = S();
    const block = d.blocks[index];
    switch (act) {
      case "remove": { if (!block) return; pushHistory(true); d.blocks.splice(index, 1); if (sb.selectedId === block.id) sb.selectedId = null; toast(`${T.BLOCK_LABEL(block.type)} removed. Undo with ↶ or Cmd/Ctrl+Z.`); markDirty({ rerail: true }); return; }
      case "duplicate": { if (!block) return; pushHistory(true); const copy = T.normalizeBlock(S().clone(block)); copy.id = `${block.type}-${Math.random().toString(36).slice(2, 8)}`; d.blocks.splice(index + 1, 0, copy); sb.selectedId = copy.id; toast(`${T.BLOCK_LABEL(block.type)} duplicated.`); markDirty({ rerail: true }); return; }
      case "up": case "down": case "move": { const dir = act === "up" ? -1 : act === "down" ? 1 : Number(extra.dir); const to = index + dir; if (!block || to < 0 || to >= d.blocks.length) return; pushHistory(true); d.blocks.splice(index, 1); d.blocks.splice(to, 0, block); markDirty({ rerail: true }); return; }
      default:
    }
  }
  function addBlock(type) {
    const d = sb.draft; if (!d) return;
    const block = T.blankBlock(type, { city: d.city, market: d.market, slug: d.slug });
    if (!block) return;
    pushHistory(true);
    let at = sb.insertAt;
    if (at === null || at === undefined) { const sel = d.blocks.findIndex(b => b.id === sb.selectedId); at = sel === -1 ? d.blocks.length : sel + 1; }
    at = Math.max(0, Math.min(d.blocks.length, at));
    d.blocks.splice(at, 0, block);
    sb.insertAt = null; sb.selectedId = block.id; sb.rightTab = "block"; sb.right = true;
    if (window.innerWidth < 1100) sb.left = false;
    S().toast(`${T.BLOCK_LABEL(type)} added. Change its words on the right.`);
    markDirty({ rerail: true }); paintLeft(); paintRails();
    setTimeout(() => selectBlock(block.id), 350);
  }
  function itemsOf(block) { return block.items || block.plans || block.buttons; }
  function blankItem(block) {
    switch (block.type) {
      case "columns": return { icon: "", image: "", title: "", text: "", href: "" };
      case "steps": return { title: "", text: "" };
      case "faq": return { q: "", a: "" };
      case "gallery": return { image: "", alt: "", caption: "" };
      case "stats": return { value: "", label: "" };
      case "testimonials": return { quote: "", name: "", location: "", rating: 5 };
      case "pricing": return { name: "", price: "", note: "", features: [], button: { label: "Book Evaluation", href: "/contact", style: "primary" }, featured: false };
      default: return {};
    }
  }

  async function uploadFile(file, path) {
    const { toast, api } = S();
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast("That file is bigger than 4 MB. Make it smaller and try again.", 5000); return; }
    toast("Uploading…", 8000);
    const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("Could not read the file.")); r.readAsDataURL(file); });
    const result = await api({ operation: "upload", name: file.name, type: file.type, data });
    const t = targetFor(path);
    if (t.kind === "page") pushHistory();
    setPath(t.root, t.path, result.url);
    toast(result.message || "Uploaded.");
    if (t.kind === "page") markDirty({ rerail: true }); else { paintLeft(); repaintCanvas(); }
  }

  // ───────────────────────── clicks ─────────────────────────
  async function onClick(event) {
    if (!sb) return;
    const { toast, api, modal, esc } = S();
    const target = event.target;
    const device = target.closest("[data-sb-device]"); if (device) { sb.device = device.dataset.sbDevice; paintTop(); paintCanvas(); return; }
    const tab = target.closest("[data-sb-tab]"); if (tab) { sb.leftTab = tab.dataset.sbTab; sb.left = true; if (sb.leftTab !== "blocks") sb.insertAt = null; paintTop(); paintLeft(); paintRails(); return; }
    const rtab = target.closest("[data-sb-rtab]"); if (rtab) { sb.rightTab = rtab.dataset.sbRtab; sb.right = true; paintTop(); paintRight(); paintRails(); return; }
    const pageRow = target.closest("[data-sb-page]"); if (pageRow) { if (pageRow.dataset.type === "ad") { closeStudio(); window.LDTT_PAGE_STUDIO.open(pageRow.dataset.sbPage).catch(e => toast(e.message)); return; } sb.panel = null; try { await openPage(pageRow.dataset.sbPage); } catch (e) { toast(e.message, 5000); } return; }
    const addBtn = target.closest("[data-sb-addblock]"); if (addBtn) { if (!sb.draft) { toast("Open a page first."); return; } addBlock(addBtn.dataset.sbAddblock); return; }
    const photo = target.closest("[data-sb-photo]"); if (photo) { const t = targetFor(photo.dataset.sbPhoto); if (t.kind === "page") pushHistory(); setPath(t.root, t.path, photo.dataset.src); if (t.kind === "page") markDirty({ rerail: true }); else { paintLeft(); repaintCanvas(); } return; }
    const richBtn = target.closest("[data-sb-rich]"); if (richBtn) { const ed = richBtn.closest(".ps-field")?.querySelector("[data-sb-richfield]"); if (ed) richCommand(richBtn.dataset.sbRich, ed); return; }
    const status = target.closest("#sbStatus"); if (status && sb.status === "error") { flushSave(); return; }
    const starter = target.closest("[data-sb-starter]"); if (starter) { newPagePick(starter.dataset.sbStarter); return; }
    const btn = target.closest("[data-sb-act]"); if (!btn) return;
    const act = btn.dataset.sbAct; const index = Number(btn.dataset.index);
    switch (act) {
      case "close": closeStudio(); return;
      case "toggle-left": sb.left = !sb.left; paintRails(); return;
      case "toggle-right": sb.right = !sb.right; paintRails(); return;
      case "undo": undo(); return;
      case "redo": redo(); return;
      case "new-page": openNewPanel(); return;
      case "close-panel": sb.panel = null; paintCanvas(); return;
      case "show-blocks": sb.leftTab = "blocks"; sb.left = true; paintTop(); paintLeft(); paintRails(); return;
      case "move": blockAction("move", index, { dir: btn.dataset.dir }); return;
      case "remove": case "duplicate": blockAction(act, index); return;
      case "item-add": { const b = sb.draft.blocks[index]; if (!b) return; pushHistory(true); itemsOf(b).push(blankItem(b)); markDirty({ rerail: true }); return; }
      case "item-remove": { const b = sb.draft.blocks[index]; if (!b) return; pushHistory(true); itemsOf(b).splice(Number(btn.dataset.item), 1); markDirty({ rerail: true }); return; }
      case "item-move": { const b = sb.draft.blocks[index]; const list = itemsOf(b); const i = Number(btn.dataset.item); const to = i + Number(btn.dataset.dir); if (to < 0 || to >= list.length) return; pushHistory(true); const [it] = list.splice(i, 1); list.splice(to, 0, it); markDirty({ rerail: true }); return; }
      case "clear-page-theme": pushHistory(); sb.draft.theme = T.normalizeTheme({}, { partial: true }); markDirty({ rerail: true }); return;
      case "save-theme": {
        try { btn.disabled = true; const data = await api({ operation: "theme_save", theme: sb.themeDraft }); siteCache.theme = T.normalizeTheme(data.theme); sb.themeDraft = S().clone(siteCache.theme); siteCache.themeMeta = `Saved ${S().timeLabel(data.updated_at)}.`; toast(data.message, 5000); paintLeft(); } catch (e) { toast(e.message, 5000); } finally { btn.disabled = false; }
        return;
      }
      case "reset-theme": sb.themeDraft = T.normalizeTheme({}); paintLeft(); repaintCanvas(); toast("Back to the original look on the canvas. Press Save site theme to keep it."); return;
      case "nav-start": sb.navDraft = T.normalizeNav(T.STATIC_NAV); paintLeft(); repaintCanvas(); return;
      case "nav-clear": if (!window.confirm("Clear the saved menus? Every page goes back to the website's built-in menus.")) return; sb.navDraft = T.normalizeNav({}); try { const data = await api({ operation: "nav_save", navigation: sb.navDraft }); siteCache.nav = T.normalizeNav(data.navigation); sb.navDraft = S().clone(siteCache.nav); toast(data.message, 5000); paintLeft(); repaintCanvas(); } catch (e) { toast(e.message, 5000); } return;
      case "nav-add": { const list = getPath(sb.navDraft, btn.dataset.path.slice(4)); if (!Array.isArray(list)) return; list.push(btn.dataset.path === "nav.footer.groups" ? { title: "New column", links: [] } : btn.dataset.path === "nav.header.ctas" ? { label: "Book Evaluation", href: "/contact", style: "primary" } : { label: "", href: "/", children: [] }); paintLeft(); repaintCanvas(); return; }
      case "nav-remove": { const list = getPath(sb.navDraft, btn.dataset.path.slice(4)); if (!Array.isArray(list)) return; list.splice(index, 1); paintLeft(); repaintCanvas(); return; }
      case "nav-move": { const list = getPath(sb.navDraft, btn.dataset.path.slice(4)); const to = index + Number(btn.dataset.dir); if (!Array.isArray(list) || to < 0 || to >= list.length) return; const [it] = list.splice(index, 1); list.splice(to, 0, it); paintLeft(); repaintCanvas(); return; }
      case "save-nav": {
        try { btn.disabled = true; const data = await api({ operation: "nav_save", navigation: sb.navDraft }); siteCache.nav = T.normalizeNav(data.navigation); sb.navDraft = S().clone(siteCache.nav); toast(data.message, 5000); paintLeft(); repaintCanvas(); } catch (e) { toast(e.message, 5000); } finally { btn.disabled = false; }
        return;
      }
      case "preview": {
        try { btn.disabled = true; await flushSave(); const data = await api({ operation: "preview", page_type: sb.draft.pageType, content: sb.draft }); const w = window.open("", "_blank"); if (!w) throw new Error("Your browser blocked the preview window. Allow pop-ups for this site."); w.document.open(); w.document.write(data.html); w.document.close(); } catch (e) { toast(e.message, 5000); } finally { btn.disabled = false; }
        return;
      }
      case "publish": publishFlow(); return;
      case "more": { const m = modal(`<h3>More</h3><div class="ps-actions" style="flex-direction:column"><button type="button" class="ps-btn" data-x="page">Page settings, history and versions</button>${sb.page.status === "published" ? `<button type="button" class="ps-btn" data-x="unpublish">Take this page offline</button>` : ""}<button type="button" class="ps-btn" style="color:#b00020;border-color:#f1c2ca" data-x="archive">Remove this page</button><button type="button" class="ps-btn" data-x="close">Cancel</button></div>`); m.addEventListener("click", e => { const x = e.target.closest("[data-x]")?.dataset.x; if (!x) return; m.remove(); if (x === "page") { sb.rightTab = "page"; sb.right = true; paintTop(); paintRight(); paintRails(); } else if (x === "unpublish") unpublish(); else if (x === "archive") archive(); }); return; }
      case "unpublish": unpublish(); return;
      case "archive": archive(); return;
      case "snapshot": try { await saveDraft({ snapshot: true }); toast("Version saved."); await refreshRevisions(); paintRight(); } catch (e) { toast(e.message); } return;
      case "restore": {
        try { btn.disabled = true; const data = await api({ operation: "restore", id: sb.pageId, revision_id: btn.dataset.rev }); pushHistory(); sb.draft = T.normalizeSitePage(data.content); sb.draftRevision = Number(data.draft_revision || sb.draftRevision + 1); sb.savedJson = draftJson(); sb.status = "saved"; sb.savedAt = new Date().toISOString(); sb.selectedId = null; paintAll(); toast(data.message || "Version restored into the draft."); } catch (e) { btn.disabled = false; toast(e.message); }
        return;
      }
      case "new-go": await createFromPanel(btn); return;
      case "import-page": {
        try { btn.disabled = true; btn.textContent = "Importing…"; const data = await api({ operation: "import_static", slug: btn.dataset.slug }); toast(data.message, 6000); S().store.pages = null; await S().loadPages(true); sb.panel = null; await openPage(data.page.id); } catch (e) { toast(e.message, 6000); btn.disabled = false; btn.textContent = "Import"; }
        return;
      }
      default:
    }
  }

  async function unpublish() {
    const { api, toast } = S();
    if (!window.confirm("Take this page offline? Visitors get the original page (or a not-found notice) at that address until you publish again. The draft is kept.")) return;
    try { const data = await api({ operation: "unpublish", id: sb.pageId }); sb.page.status = "draft"; paintTop(); paintRight(); toast(data.message, 6000); } catch (e) { toast(e.message, 5000); }
  }
  async function archive() {
    const { api, toast } = S();
    if (!window.confirm("Remove this page from the Site Builder and take it off the site? A Super Admin can bring it back from the database.")) return;
    try { const data = await api({ operation: "archive", id: sb.pageId }); toast(data.message); sb.status = "saved"; sb.pageId = null; sb.draft = null; sb.page = null; S().store.pages = null; await S().loadPages(true); paintAll(); } catch (e) { toast(e.message, 5000); }
  }

  // ───────────────────────── publish ─────────────────────────
  async function publishFlow() {
    if (!sb?.draft) return;
    const { api, toast, modal, esc } = S();
    await flushSave();
    const html = T.renderSitePage(sb.draft, { base: "/", publicPath: `/${sb.draft.slug}`, siteTheme: siteCache.theme, navigation: siteCache.nav, data: siteCache.data });
    const result = T.sitePublishChecklist(sb.draft, { html });
    const list = `<div class="ps-checklist">${result.checks.map(c => `<div class="ps-check ${c.ok ? "ok" : "bad"}">${esc(c.ok ? c.label : c.fix)}</div>`).join("")}</div>`;
    if (!result.ok) {
      modal(`<h3>Not published yet — ${result.failures.length} thing${result.failures.length === 1 ? "" : "s"} to fix</h3><p class="ps-help">Nothing changed on the live site. Fix these and press Publish again.</p>${list}<div class="ps-actions"><button type="button" class="ps-btn navy" data-ps-close>OK</button></div>`).querySelector("[data-ps-close]").addEventListener("click", e => e.target.closest(".ps-modal").remove());
      return;
    }
    const inNav = (siteCache.nav.header.links.length ? siteCache.nav : T.normalizeNav(T.STATIC_NAV)).header.links.some(l => l.href === `/${sb.draft.slug}`);
    const m = modal(`<h3>Publish this page?</h3><p class="ps-help">It goes live at <b>/${esc(sb.draft.slug)}</b> (and /p/${esc(sb.draft.slug)}) within about a minute. The previous version is kept under History.</p>${list}${!inNav && sb.draft.pageType === "site" ? `<label class="ps-field inline"><input type="checkbox" data-add-nav checked><span>Also add it to the header menu</span></label>` : ""}<div class="ps-actions"><button type="button" class="ps-btn" data-ps-close>Not yet</button><button type="button" class="ps-btn red" data-ps-go>Publish now</button></div>`);
    m.querySelector("[data-ps-close]").addEventListener("click", () => m.remove());
    m.querySelector("[data-ps-go]").addEventListener("click", async event => {
      event.target.disabled = true; event.target.textContent = "Publishing…";
      try {
        const data = await api({ operation: "publish", id: sb.pageId, content: sb.draft, add_to_nav: Boolean(m.querySelector("[data-add-nav]")?.checked) });
        m.remove();
        sb.page.status = "published"; sb.page.slug = sb.draft.slug; sb.savedJson = draftJson(); sb.status = "saved"; sb.savedAt = new Date().toISOString();
        sb.page.published_revision = data.revision; sb.durability = null; loadDurability(sb.pageId); // durability: refresh "Where this page lives"
        await Promise.all([refreshRevisions().catch(() => {}), loadSite(true).catch(() => {})]);
        S().store.pages = null; S().loadPages(true);
        paintAll();
        const done = modal(`<h3>Published</h3><p class="ps-help">${esc(data.message || "The page is live.")}</p><div class="ps-actions"><a class="ps-btn navy" href="${esc(data.url || `/${sb.draft.slug}`)}" target="_blank" rel="noopener" style="text-decoration:none">Open the live page</a><button type="button" class="ps-btn" data-ps-close>Keep editing</button></div>`);
        done.querySelector("[data-ps-close]").addEventListener("click", () => done.remove());
      } catch (error) {
        m.remove();
        const fails = error.data?.checklist?.failures || [];
        modal(`<h3>Not published</h3><p class="ps-help">${esc(error.message)}</p>${fails.length ? `<div class="ps-checklist">${fails.map(f => `<div class="ps-check bad">${esc(f.fix)}</div>`).join("")}</div>` : ""}<div class="ps-actions"><button type="button" class="ps-btn navy" data-ps-close>OK</button></div>`).querySelector("[data-ps-close]").addEventListener("click", e => e.target.closest(".ps-modal").remove());
      }
    });
  }

  // ───────────────────────── new page (full-screen panel) ─────────────────────────
  function openNewPanel() {
    sb.panel = "new"; sb.newPick = sb.newPick || "blank";
    paintTop(); paintCanvas(); paintNewPanel();
  }
  function newPagePick(id) { sb.newPick = id; paintNewPanel(); }
  function paintNewPanel() {
    const { esc, store } = S();
    const panel = $("#sbPanel");
    const pick = sb.newPick;
    const starters = T.STARTERS;
    const card = (id, label, help, extra = "") => `<button type="button" class="sb-start-card ${pick === id ? "active" : ""}" data-sb-starter="${esc(id)}"><strong>${esc(label)}</strong><small>${esc(help)}</small>${extra}</button>`;
    const needsCity = ["market", "recruiting"].includes(pick);
    const dupPages = (store.pages || []).filter(p => p.page_type && p.page_type !== "ad");
    const importable = store.importable || [];
    const name = $("#sbNewName")?.value ?? "";
    const slug = $("#sbNewSlug")?.value ?? "";
    panel.innerHTML = `
      <div class="sb-new">
        <div class="sb-new-head"><div><h2>New page</h2><p>Pick how to start. You can change everything after.</p></div><button type="button" class="ps-btn" style="width:auto" data-sb-act="close-panel">Cancel</button></div>
        <h3>Start from a template</h3>
        <div class="sb-start-grid">${starters.map(s => card(s.id, s.label, s.help)).join("")}</div>
        <h3>Take over a page from the current website</h3>
        <p class="ps-help">The words and photos are pulled in as blocks. The original file keeps showing to visitors until you publish your copy; Unpublish brings the file back.</p>
        <div class="sb-start-grid">${importable.map(p => `<div class="sb-start-card static"><strong>${esc(p.title)}</strong><small>/${esc(p.slug)} · ${esc(p.file)}</small>${p.imported ? `<span class="ps-pill published">Already in the Site Builder</span>` : `<button type="button" class="ps-btn navy" data-sb-act="import-page" data-slug="${esc(p.slug)}">Import</button>`}</div>`).join("")}</div>
        <h3>Or duplicate a page you already built</h3>
        <div class="sb-start-grid">${dupPages.length ? dupPages.map(p => card(`dup:${p.id}`, `Copy of ${p.title || p.slug}`, `${p.public_path || `/${p.slug}`} · ${p.status === "published" ? "Live" : "Draft"}`)).join("") : `<p class="ps-help">No pages to duplicate yet.</p>`}</div>
        <div class="sb-new-form">
          <h3>Name it</h3>
          <div class="ps-row"><label class="ps-field"><span>Page name</span><input id="sbNewName" value="${esc(name)}" placeholder="Services"></label><label class="ps-field"><span>Web address</span><input id="sbNewSlug" value="${esc(slug)}" placeholder="services"></label></div>
          ${needsCity ? `<div class="ps-row"><label class="ps-field"><span>City</span><input id="sbNewCity" placeholder="Toledo"></label><label class="ps-field"><span>State (2 letters)</span><input id="sbNewState" maxlength="2" placeholder="OH"></label></div>` : ""}
          <label class="ps-field"><span>Page type</span><select id="sbNewType"><option value="site">Site page (full menus)</option><option value="landing" ${["market", "recruiting"].includes(pick) ? "selected" : ""}>Landing page (slim header, form required)</option></select></label>
          <button type="button" class="ps-btn red" data-sb-act="new-go">Create the page and open it</button>
        </div>
      </div>`;
    panel.hidden = false;
    const nameEl = $("#sbNewName"), slugEl = $("#sbNewSlug");
    nameEl?.addEventListener("input", () => { if (!slugEl.dataset.touched) slugEl.value = T.safeSlug(nameEl.value); });
    slugEl?.addEventListener("input", () => { slugEl.dataset.touched = "1"; slugEl.value = T.safeSlug(slugEl.value); });
  }
  async function createFromPanel(btn) {
    const { api, toast } = S();
    const pick = sb.newPick || "blank";
    const name = $("#sbNewName")?.value.trim() || "";
    const slug = T.safeSlug($("#sbNewSlug")?.value || name);
    const type = $("#sbNewType")?.value === "landing" ? "landing" : "site";
    const city = $("#sbNewCity")?.value.trim() || ""; const state = ($("#sbNewState")?.value.trim() || "").toUpperCase();
    try {
      btn.disabled = true; btn.textContent = "Creating…";
      let content;
      if (pick.startsWith("dup:")) { const data = await api({ operation: "get", id: pick.slice(4) }); content = T.normalizeSitePage(data.page.draft_content); content.slug = slug || `${content.slug}-copy`; if (name) content.title = name; }
      else {
        if (["market", "recruiting"].includes(pick) && (!city || state.length !== 2)) throw new Error("Type the city and the two-letter state.");
        content = T.starter(pick, { city, state, market: city && state ? `${city}, ${state}` : "", title: name, slug, pageType: type });
        if (name) content.title = name;
        if (slug) content.slug = slug;
        if (!["market", "recruiting"].includes(pick)) content.pageType = type;
      }
      if (!content.slug) throw new Error("Give the page a name or a web address.");
      const data = await api({ operation: "create", page_type: content.pageType, content });
      toast(data.message || "Page created.");
      S().store.pages = null; await S().loadPages(true);
      sb.panel = null; sb.newPick = "blank";
      await openPage(data.page.id);
      sb.leftTab = "blocks"; paintLeft(); paintTop();
    } catch (error) { toast(error.message, 6000); btn.disabled = false; btn.textContent = "Create the page and open it"; }
  }

  // ───────────────────────── keyboard ─────────────────────────
  function onRailKeys(event) {
    // Enter in the new-page name box creates the page.
    if (event.key === "Enter" && (event.target.id === "sbNewName" || event.target.id === "sbNewSlug")) { event.preventDefault(); $("[data-sb-act=new-go]")?.click(); }
  }
  function onKeys(event, fromFrame = false) {
    if (!sb) return;
    const meta = event.metaKey || event.ctrlKey;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable;
    if (meta && event.key.toLowerCase() === "s") { event.preventDefault(); flushSave().then(() => S().toast("Saved.")); return; }
    if (meta && event.key.toLowerCase() === "z" && !typing) { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (event.key === "Escape") {
      if ($(".ps-modal")) { $$(".ps-modal").pop().remove(); return; }
      if (sb.panel) { sb.panel = null; paintCanvas(); return; }
      if (typing && !fromFrame) { event.target.blur(); return; }
      if (sb.left || sb.right) { sb.left = false; sb.right = false; paintRails(); S().toast("Rails hidden. Press ☰ Pages & blocks or Settings to bring them back."); return; }
      return;
    }
    if (typing) return;
    const index = sb.draft ? sb.draft.blocks.findIndex(b => b.id === sb.selectedId) : -1;
    if (index === -1) return;
    if (event.altKey && event.key === "ArrowUp") { event.preventDefault(); blockAction("up", index); }
    else if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); blockAction("down", index); }
    else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); blockAction("remove", index); }
    else if (meta && event.key.toLowerCase() === "d") { event.preventDefault(); blockAction("duplicate", index); }
  }
  document.addEventListener("keydown", event => { if (sb && !document.querySelector("#psOverlay")) onKeys(event); }, true);

  // ───────────────────────── wiring into the portal ─────────────────────────
  document.addEventListener("click", async event => {
    const t = event.target;
    const open = t.closest("[data-sb-open]"); if (open) { openStudio(open.dataset.sbOpen); return; }
    const studio = t.closest("[data-sb-studio]"); if (studio) { openStudio(studio.dataset.sbStudio || ""); return; }
    if (t.closest("[data-sb-new]")) { openStudio("new"); return; }
    const dup = t.closest("[data-sb-duplicate]"); if (dup) { await openStudio(""); if (sb) { sb.newPick = `dup:${dup.dataset.sbDuplicate}`; openNewPanel(); } return; }
    const upload = t.closest("[data-sb-upload]");
    if (upload) return;
  });
  document.addEventListener("change", event => {
    const input = event.target.closest?.("[data-sb-upload]");
    if (input && sb && input.files?.[0]) { uploadFile(input.files[0], input.dataset.sbUpload).catch(e => S().toast(e.message, 6000)); input.value = ""; }
  });
  window.addEventListener("beforeunload", event => { if (sb && (sb.status === "dirty" || sb.status === "saving" || sb.status === "error")) { event.preventDefault(); event.returnValue = ""; } });
  window.addEventListener("resize", () => { if (sb && window.innerWidth < 900 && sb.left && sb.right) { sb.right = false; paintRails(); } });

  window.LDTT_SITE_BUILDER = { open: openStudio, close: closeStudio, state: () => sb };
})();
