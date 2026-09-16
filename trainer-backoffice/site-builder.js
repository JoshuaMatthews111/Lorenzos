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
  // Site Builder 2.0 (Joshua 2026-09-15: one editor for every page). The Site Builder now also opens the 2.0 ad pages
  // (sb.kind "ad2", drawn by lib/ad2-page-template.js with its sections outlined); block pages are sb.kind "blocks".
  const A2 = () => window.LDTT_AD2_PAGE_TEMPLATE;
  const kindOf = page => (page?.page_type === "ad2" ? "ad2" : "blocks");
  const normalizeDraft = (content, kind = sb?.kind) => (kind === "trainer" ? { ...content, blocks: T.normalizeKitBlocks(content?.blocks || [], TRAINER_ANCHORS) } : kind === "ad2" ? A2().normalizeContent(content) : T.normalizeSitePage(content));
  const isKit = () => sb?.kind === "ad2" || sb?.kind === "trainer"; // pages that keep their own design: blocks go between their sections

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
      else if (String(what).startsWith("trainer:")) await openTrainer(String(what).slice(8));
      else if (String(what).startsWith("slug:")) {
        const slug = String(what).slice(5);
        const found = (store.pages || []).find(p => p.slug === slug && p.page_type !== "ad");
        if (found) await openPage(found.id);
        else { sb.leftTab = "pages"; openNewPanel(); toast((store.importable || []).some(p => p.slug === slug) ? `/${slug} is not in the Site Builder yet. Press Import next to it below to bring it in.` : "That page is not in the Site Builder yet. Import a page below, or start a new one.", 7000); }
      }
      else if (what) await openPage(what);
      paintAll();
      // The first time someone opens the Site Builder in this browser, the "How to use" steps show first.
      let seen = true;
      try { seen = localStorage.getItem("sb-help-seen") === "1"; localStorage.setItem("sb-help-seen", "1"); } catch { seen = true; }
      if (!seen && !sb.panel) openHelp();
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
        <button type="button" data-sb-act="help" title="How to use the Site Builder">? How to use</button>
        <button type="button" data-sb-act="toggle-left" title="Show or hide the left rail (pages, blocks, theme, menus)">☰ Pages &amp; blocks</button>
        <div class="sb-title"><strong id="sbTitle">Site Builder</strong><span id="sbAddr"></span></div>
        <label class="sb-jump"><span>Landing page</span><select id="sbJump" data-sb-jump aria-label="Open a landing page"></select></label>
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
    const kind = kindOf(page); // rule 85: the 2.0 pages open here too (their old editor stays under More)
    const draft = kind === "ad2" ? A2().normalizeContent(page.draft_content || {}) : T.normalizeSitePage({ ...(page.draft_content || {}), pageType: page.page_type });
    let local = null;
    try { local = JSON.parse(localStorage.getItem(`sb-draft-${page.id}`) || "null"); } catch { local = null; }
    if (local && local.draft_revision === page.draft_revision && JSON.stringify(normalizeDraft(local.content, kind)) !== JSON.stringify(draft) && window.confirm("You have unsaved changes for this page from earlier in this browser. Put them back?")) {
      Object.assign(draft, normalizeDraft(local.content, kind));
    }
    Object.assign(sb, { kind, selectedSec: null, pageId: page.id, page, draft, savedJson: JSON.stringify(draft), draftRevision: Number(page.draft_revision || 1), revisions: data.revisions || [], status: "saved", savedAt: page.updated_at, selectedId: null, rightTab: "page", history: [], future: [], insertAt: null, panel: null, durability: null });
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
  function undo() { if (!sb?.history.length) return; sb.future.push(draftJson()); sb.draft = normalizeDraft(JSON.parse(sb.history.pop())); sb.lastPush = 0; afterStructuralChange(); }
  function redo() { if (!sb?.future.length) return; sb.history.push(draftJson()); sb.draft = normalizeDraft(JSON.parse(sb.future.pop())); sb.lastPush = 0; afterStructuralChange(); }
  function afterStructuralChange() { if (!(sb.draft.blocks || []).some(b => b.id === sb.selectedId)) sb.selectedId = null; markDirty({ rerail: true }); }

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
    if (sb.kind === "trainer") {
      // The Page Editor's own draft save (markBuilderDraftDirty does the same). Rule 56: a live page stays live.
      const t = currentTrainer(); if (!t) throw new Error("That trainer is no longer in the portal. Refresh and try again.");
      const body = draftJson();
      sb.status = "saving"; paintStatus();
      applyChangedToTrainer(t, sb.trainerBase, sb.draft); sb.trainerBase = S().clone(sb.draft); t._editedAt = Date.now();
      t.pageStatus = "Draft"; t.locked = false;
      if (portalHas("persistStateSnapshot")) persistStateSnapshot();
      if (portalHas("persistTrainerRecord")) await persistTrainerRecord(t);
      if (!sb || sb.kind !== "trainer") return;
      sb.savedAt = new Date().toISOString();
      sb.status = draftJson() === body ? "saved" : "dirty";
      if (sb.status === "saved") sb.savedJson = body;
      try { localStorage.removeItem(`sb-draft-${sb.pageId}`); } catch { /* ignore */ }
      paintStatus();
      if (sb.status === "dirty") scheduleSave();
      return;
    }
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
    requestAnimationFrame(fitFrame);
  }
  // Site Builder 2.0: on a laptop the canvas is narrower than a computer screen, so "Desktop" draws the page at 1280 px
  // and shrinks it to fit. The page then looks exactly as it does on a computer, and a click still lands where you click.
  const DESKTOP_W = 1280;
  function fitFrame() {
    const frame = $("#sbFrame"); const wrap = $("#sbFrameWrap");
    if (!frame || !wrap || !sb) return;
    // The editor's own buttons (+ Add block, block tools) keep their real size while the page shrinks (--sbz = 1/scale).
    const zoomBack = value => { try { frame.contentDocument?.documentElement?.style.setProperty("--sbz", value); } catch { /* not loaded yet */ } };
    const reset = () => { frame.style.width = ""; frame.style.height = ""; frame.style.transform = ""; frame.style.justifySelf = ""; zoomBack("1"); };
    if (sb.device !== "desktop") { reset(); return; }
    const w = wrap.clientWidth; const h = wrap.clientHeight;
    if (!w || !h || w >= DESKTOP_W) { reset(); return; }
    const scale = w / DESKTOP_W;
    Object.assign(frame.style, { width: `${DESKTOP_W}px`, height: `${Math.ceil(h / scale)}px`, transform: `scale(${scale})`, transformOrigin: "0 0", justifySelf: "start" });
    zoomBack((1 / scale).toFixed(3));
  }
  function paintTop() {
    if (!sb) return;
    const { esc, sendToLiveButton, sentToLiveLabel, practiceTag } = S();
    const d = sb.draft;
    $("#sbTitle").textContent = d ? (sb.kind === "trainer" ? `${currentTrainer()?.name || "Trainer"} · trainer page` : sb.kind === "ad2" ? `${d.market || d.slug} · 2.0 ad page` : (d.title || "Untitled page")) : "Site Builder";
    $("#sbAddr").textContent = d ? (sb.kind === "trainer" ? (currentTrainer() && portalHas("trainerPageHref") ? trainerPageHref(currentTrainer()) : "") : sb.kind === "ad2" ? `/ads/${d.slug || "…"}` : `/${d.slug || "…"}${d.pageType === "landing" ? " · landing page" : ""}`) : "Pick a page on the left, or make a new one";
    paintJump();
    $$("[data-sb-device]").forEach(b => b.classList.toggle("active", b.dataset.sbDevice === sb.device));
    $$("[data-sb-tab]").forEach(b => b.classList.toggle("active", b.dataset.sbTab === sb.leftTab));
    $$("[data-sb-rtab]").forEach(b => b.classList.toggle("active", b.dataset.sbRtab === sb.rightTab));
    ["sbPreviewBtn", "sbPublishBtn", "sbMoreBtn", "sbUndo", "sbRedo", "sbDevices"].forEach(id => { const el = $(`#${id}`); if (el) el.style.display = d ? "" : "none"; });
    $("#sbStatus").style.display = d ? "" : "none";
    if (d) {
      $("#sbUndo").disabled = !sb.history.length; $("#sbRedo").disabled = !sb.future.length;
      $("#sbPublishBtn").textContent = sb.page.status === "published" ? "Publish changes" : (sb.page.sandbox || window.LDTT_IS_SANDBOX ? "Publish (practice copy)" : "Publish");
      const slot = $("#sbSendLive");
      slot.innerHTML = sb.kind === "trainer" ? "" : window.LDTT_IS_SANDBOX ? `${sendToLiveButton(sb.page, "ps-send-live")}${sb.page.sent_to_live_at ? `<small class="ps-sent-live">${esc(sentToLiveLabel(sb.page.sent_to_live_at, sb.page.sent_to_live_by_name))}</small>` : ""}` : practiceTag(sb.page);
    } else $("#sbSendLive").innerHTML = "";
    paintStatus();
  }
  // Office 2026-09-14: "a dropdown on the site editor for landing pages so they can get to them easier". Every
  // landing page (block-built, ad, and 2.0 on the practice copy) in one list; picking one opens it in its own editor.
  function paintJump() {
    const select = $("#sbJump"); if (!select || !sb) return;
    const { esc, store } = S();
    const pages = store.pages || [];
    const opt = p => `<option value="${esc(p.id)}" ${p.id === sb.pageId ? "selected" : ""}>${esc(p.page_type === "ad2" ? (p.market || p.title || p.slug) : (p.title || p.market || p.slug))}${p.status === "published" ? "" : " (draft)"}</option>`;
    const group = (label, list) => (list.length ? `<optgroup label="${esc(label)}">${list.map(opt).join("")}</optgroup>` : "");
    const html = `<option value="">${sb.pageId ? "Open another landing page…" : "Pick a landing page…"}</option>`
      + group("Landing pages", pages.filter(p => p.page_type === "landing"))
      + group("Ad pages", pages.filter(p => !p.page_type || p.page_type === "ad"))
      + (store.sandbox ? group("Ad pages 2.0", pages.filter(p => p.page_type === "ad2")) : "")
      + (portalHas("pageEditorPreviewDocument") && portalTrainers().length ? `<optgroup label="Trainer pages">${portalTrainers().map(t => `<option value="trainer:${esc(t.id)}" ${sb.pageId === `trainer:${t.id}` ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</optgroup>` : "");
    if (select.dataset.html !== html) { select.innerHTML = html; select.dataset.html = html; }
    if (!pages.some(p => p.id === sb.pageId && p.page_type !== "site") && !String(sb.pageId || "").startsWith("trainer:")) select.value = "";
  }
  async function jumpTo(id) {
    const { store, toast } = S();
    if (String(id).startsWith("trainer:")) { try { sb.panel = null; await openTrainer(String(id).slice(8)); } catch (e) { toast(e.message, 5000); } return; }
    const page = (store.pages || []).find(p => p.id === id);
    if (!page) return;
    try {
      if ((page.page_type || "ad") === "ad") { await flushSave(); closeStudio(); await window.LDTT_PAGE_STUDIO.open(id); return; }
      sb.panel = null; await openPage(id); paintAll(); // block pages and 2.0 ad pages open right here
    } catch (e) { toast(e.message, 5000); }
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
      const group = (label, list, hint) => `<h3>${label}</h3>${list.length ? list.map(p => `<div class="sb-page-item"><button type="button" class="sb-page-row ${p.id === sb.pageId ? "active" : ""}" data-sb-page="${esc(p.id)}" data-type="${esc(p.page_type || "ad")}"><span class="sb-page-dot ${p.status === "published" ? "live" : ""}"></span><span class="sb-page-name">${esc(p.title || p.market || p.slug)}<small>${esc(p.public_path || `/${p.slug}`)} · ${p.status === "published" ? "Live" : "Draft"}${p.updated_at ? ` · ${esc(dateLabel(p.updated_at))}` : ""}</small></span></button><button type="button" class="sb-page-dup" data-sb-act="dup-page" data-id="${esc(p.id)}" title="Make a copy of this page" aria-label="Make a copy of ${esc(p.title || p.slug)}">⧉ Copy</button></div>`).join("") : `<p class="ps-help">${hint}</p>`}`;
      rail.innerHTML = `
        <button type="button" class="sb-big" data-sb-act="new-page">+ New page</button>
        <input class="sb-search" type="search" placeholder="Search pages…" value="${esc(sb.pageSearch)}" data-sb-search="pages">
        ${group("Site pages", pages.filter(p => p.page_type === "site"), "None yet. Press + New page.")}
        ${group("Landing pages", pages.filter(p => p.page_type === "landing"), "None yet.")}
        ${group("Ad pages", pages.filter(p => !p.page_type || p.page_type === "ad"), "None yet. Ad pages open in the ad editor.")}
        ${S().store.sandbox ? group("Ad pages 2.0", pages.filter(p => p.page_type === "ad2"), "None yet. Page Studio → Ad landing pages 2.0.") : ""}
        ${trainerGroupHtml(q)}
        <p class="ps-help" style="margin-top:14px">Import the current website's pages (About, Facility, Contact, Dog Training…) from <b>+ New page → Import</b>. The original file stays live until you publish your copy.</p>`;
    } else if (sb.leftTab === "blocks" && !sb.draft) {
      rail.innerHTML = `<h3>First open a page</h3><p class="ps-help">Blocks are added to the page that is open. Pick a page below, or make a new one.</p><button type="button" class="sb-big" data-sb-act="new-page">+ New page</button>${(store.pages || []).filter(p => p.page_type === "site" || p.page_type === "landing").slice(0, 12).map(p => `<button type="button" class="sb-page-row" data-sb-page="${esc(p.id)}" data-type="${esc(p.page_type)}"><span class="sb-page-dot ${p.status === "published" ? "live" : ""}"></span><span class="sb-page-name">${esc(p.title || p.slug)}<small>/${esc(p.slug)}</small></span></button>`).join("")}`;
    } else if (sb.leftTab === "blocks") {
      const q = sb.blockSearch.toLowerCase();
      const groups = [...new Set(T.BLOCK_TYPES.map(b => b.group))];
      rail.innerHTML = `
        <input class="sb-search" type="search" placeholder="Search blocks… (hero, form, faq)" value="${esc(sb.blockSearch)}" data-sb-search="blocks">
        <p class="ps-help">${sb.draft ? (sb.insertAt !== null ? `Click a block to put it at position ${sb.insertAt + 1}.` : sb.selectedId ? "Click a block to add it after the selected one." : "Click a block to add it to the end of the page.") : "Open a page first, then add blocks."}</p>
        ${isKit() ? `<p class="ps-help sb-tip">On this page a new block goes under the section or block you clicked, or where you pressed <b>+ Add block here</b>.</p>` : ""}
        ${groups.map(g => { const list = T.BLOCK_TYPES.filter(b => b.group === g && !(isKit() && T.KIT_EXCLUDED.has(b.type)) && (!q || `${b.label} ${b.help} ${b.type}`.toLowerCase().includes(q))); return list.length ? `<h3>${esc(g)}</h3><div class="sb-block-grid">${list.map(b => `<button type="button" class="sb-block-card" data-sb-addblock="${b.type}" ${sb.draft ? "" : "disabled"} title="${esc(b.help)}"><span class="sb-thumb">${BLOCK_ICONS[b.type] || ""}</span><strong>${esc(b.label)}</strong><small>${esc(b.help)}</small></button>`).join("")}</div>` : ""; }).join("") || `<p class="ps-help">No block matches “${esc(sb.blockSearch)}”.</p>`}`;
    } else if (sb.leftTab === "theme") {
      rail.innerHTML = themePanel();
    } else if (sb.leftTab === "nav") {
      rail.innerHTML = navPanel();
    }
  }

  // ───────────────────────── theme + menus panels ─────────────────────────
  const F = (label, path, value, opts = {}) => S().field(label, path, value, opts).replace(/data-ps-field=/g, "data-sb-field=").replace(/data-ps-list=/g, "data-sb-list=");
  const colorField = (label, path, value, fallback) => `<label class="ps-field"><span>${S().esc(label)}</span><div class="ps-row"><input type="color" data-sb-field="${S().esc(path)}" value="${S().esc(value || fallback)}"><input type="text" data-sb-field="${S().esc(path)}" value="${S().esc(value || "")}" placeholder="${S().esc(fallback)}"></div></label>`;
  // Site Builder 2.0 helpers: a stored address as something the browser can show, a slider, and the video box
  // (upload straight to storage with a progress bar, up to 50 MB).
  const assetUrl = value => (!value || /^https?:\/\//i.test(value) || value.startsWith("/") ? value : `/${value}`);
  const slider = (label, path, value, min, max, unit = "") => `<label class="ps-field ps-slider"><span>${S().esc(label)} <b data-sb-readout>${S().esc(value)}${unit}</b></span><input type="range" min="${min}" max="${max}" step="1" data-sb-field="${S().esc(path)}" data-unit="${S().esc(unit)}" value="${S().esc(value)}"></label>`;
  const videoField = (label, path, value, placeholder = "or paste the https:// address of an MP4") => `<div class="ps-field"><span>${S().esc(label)}</span>${value ? `<video class="sb-thumb-video" src="${S().esc(assetUrl(value))}" muted playsinline preload="metadata"></video>` : ""}<div class="ps-row"><label class="ps-btn sb-upload-btn ${value ? "" : "red"}">${value ? "Replace the video" : "Upload a video"}<input type="file" accept="video/mp4,video/webm" data-sb-bigupload="${S().esc(path)}" data-kind="video" hidden></label>${value ? `<button type="button" class="ps-btn" data-sb-act="clear-field" data-path="${S().esc(path)}">Remove</button>` : ""}</div><div class="sb-progress" data-sb-progress="${S().esc(path)}" hidden><i></i><span></span></div><input data-sb-field="${S().esc(path)}" value="${S().esc(value || "")}" placeholder="${S().esc(placeholder)}"></div>`;
  const uploadField = (label, path, value, accept = "image/*") => `<div class="ps-field"><span>${S().esc(label)}</span>${value ? `<img class="sb-thumb-img" src="${S().esc(value)}" alt="">` : ""}<div class="ps-row"><input data-sb-field="${S().esc(path)}" value="${S().esc(value || "")}" placeholder="https://… or assets/…"><label class="ps-btn sb-upload-btn"><input type="file" accept="${accept}" data-sb-upload="${S().esc(path)}" hidden>Upload</label></div></div>`;

  function themePanel() {
    const { esc } = S();
    const t = sb.themeDraft || (sb.themeDraft = S().clone(siteCache.theme));
    const warnings = T.themeWarnings(t);
    const pairSel = T.FONT_PAIRS.find(p => p.head === t.fontHead && p.body === t.fontBody)?.id || "custom";
    return `
      ${sb.kind === "ad2" ? `<div class="sb-tip" style="margin-bottom:12px">This 2.0 ad page keeps its own design and colours. Change its logo on the <b>Page</b> tab, its photos by clicking them. The theme below is for the Site Builder's website pages.</div>` : ""}
      ${sb.kind === "trainer" ? `<div class="sb-tip" style="margin-bottom:12px">This trainer page keeps its own design. Change its colours, font and text size on the <b>Page</b> tab. The theme below is for the Site Builder's website pages only.</div>` : ""}
      <h3>Site theme</h3>
      <p class="ps-help">Fonts, colours, buttons and spacing for <b>every</b> Site Builder page. A page can override these under its Page tab. Saving applies within a minute.</p>
      <h4>Fonts</h4>
      <label class="ps-field"><span>Quick pick (headline + body)</span><select data-sb-theme="pair">${T.FONT_PAIRS.map(p => `<option value="${p.id}" ${pairSel === p.id ? "selected" : ""}>${esc(p.label)}</option>`).join("")}<option value="custom" ${pairSel === "custom" ? "selected" : ""}>Custom (below)</option></select></label>
      <div class="ps-row">${F("Headline font", "site.fontHead", t.fontHead, { type: "select", options: T.SITE_FONTS.map(f => [f.id, f.label]) })}${F("Body font", "site.fontBody", t.fontBody, { type: "select", options: T.SITE_FONTS.map(f => [f.id, f.label]) })}</div>
      <div class="sb-font-preview" style="font-family:${esc(T.SITE_FONTS.find(f => f.id === t.fontBody)?.stack || "Inter,Arial,sans-serif")}"><b style="font-family:${esc(T.SITE_FONTS.find(f => f.id === t.fontHead)?.stack || "Inter,Arial,sans-serif")}">Serious Training. Serious Results.</b><span>Obedience, behavior help and specialty training for real homes.</span></div>
      ${F("Base text size", "site.baseSize", t.baseSize, { type: "select", options: T.BASE_SIZES.map(s => [s, `${s}px${s === "16" ? " (default)" : ""}`]) })}
      ${F("Heading size across the site", "site.headScale", t.headScale, { type: "select", options: [["", "Normal"], ["sm", "Smaller"], ["lg", "Bigger"]] })}
      <h4>Colour scheme</h4>
      <p class="ps-help">One click sets all five colours below. You can change any colour after.</p>
      <div class="sb-schemes">${T.COLOR_SCHEMES.map(s => `<button type="button" class="sb-scheme" data-sb-act="scheme" data-scheme="${esc(s.id)}"><span>${[s.colors.primary, s.colors.accent, s.colors.secondary].map(c => `<i style="background:${esc(c)}"></i>`).join("")}</span>${esc(s.label)}</button>`).join("")}</div>
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
      ${slider("Logo size", "site.logoWidth", t.logoWidth || 164, 60, 360, "px")}
      ${t.logoWidth ? `<button type="button" class="ps-btn" data-sb-act="logo-size-reset">Use the design's logo size</button>` : ""}
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
    const pageOptions = (S().store.pages || []).filter(p => p.page_type !== "ad" && p.page_type !== "ad2").map(p => `<option value="${esc(p.public_path || `/${p.slug}`)}">${esc(p.title || p.slug)}${p.status !== "published" ? " (draft)" : ""}</option>`).join("");
    const empty = !n.header.links.length;
    return `
      ${isKit() ? `<div class="sb-tip" style="margin-bottom:12px">These menus are for the Site Builder's website pages. 2.0 ad pages and trainer pages keep their own top bar and footer.</div>` : ""}
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
    const index = (sb.draft.blocks || []).findIndex(b => b.id === sb.selectedId);
    if (sb.rightTab === "block") {
      if (index === -1 && isKit() && sb.selectedSec) { rail.innerHTML = sb.kind === "trainer" ? trainerSectionFields(sb.selectedSec) : ad2SectionFields(sb.selectedSec); return; }
      if (index === -1) { rail.innerHTML = `<h3>No block selected</h3><p class="ps-help">${isKit() ? "Click a section or a block on the page to change its words and photos here." : "Click a block on the page to change its words, photos and colours here."}</p><button type="button" class="ps-btn navy" data-sb-act="show-blocks">+ Add a block</button>`; return; }
      rail.innerHTML = blockFields(sb.draft.blocks[index], index);
      wireRichEditors(rail);
    } else {
      rail.innerHTML = sb.kind === "trainer" ? trainerPageFields() : sb.kind === "ad2" ? ad2PageFields() : pageFields();
    }
  }

  const rich = (label, path, html) => `<div class="ps-field"><span>${S().esc(label)}</span><div class="sb-rich-toolbar">${[["bold", "B", "Bold"], ["italic", "I", "Italic"], ["underline", "U", "Underline"], ["h2", "H2", "Big heading"], ["h3", "H3", "Small heading"], ["ul", "• List", "Bullet list"], ["ol", "1. List", "Numbered list"], ["quote", "❝", "Quote"], ["link", "🔗", "Link"], ["unlink", "⛓", "Remove link"], ["image", "🖼", "Image by address"], ["clear", "Tx", "Clear formatting"]].map(([cmd, l, t]) => `<button type="button" data-sb-rich="${cmd}" title="${t}">${l}</button>`).join("")}</div><div class="sb-rich" contenteditable="true" data-sb-richfield="${S().esc(path)}" spellcheck="true">${html}</div><p class="ps-help">Bold, italic, links, lists and headings only. Anything else is cleaned out automatically.</p></div>`;
  function imageField(label, path, value) {
    const { esc, photoChoices } = S();
    const choices = photoChoices();
    return `<div class="ps-field"><span>${esc(label)}</span>${value ? `<img class="sb-thumb-img" src="${esc(value.startsWith("http") || value.startsWith("/") ? value : `/${value}`)}" alt="">` : ""}<div class="ps-row"><input data-sb-field="${esc(path)}" value="${esc(value || "")}" placeholder="assets/… or https://…"><label class="ps-btn sb-upload-btn"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-sb-bigupload="${esc(path)}" data-kind="photo" hidden>Upload</label></div><div class="sb-progress" data-sb-progress="${esc(path)}" hidden><i></i><span></span></div><details class="sb-photo-details"><summary>Choose from the site's photos</summary><div class="ps-photo-grid">${choices.map(p => `<button type="button" class="${p === value ? "selected" : ""}" data-sb-photo="${esc(path)}" data-src="${esc(p)}" style="background-image:url('/${esc(p)}')" title="${esc(p)}"></button>`).join("")}</div></details></div>`;
  }
  const btnFields = (label, path, b) => `<div class="ps-item"><div class="ps-item-head"><span>${S().esc(label)}</span></div><div class="ps-row">${F("Words", `${path}.label`, b?.label || "")}${F("Link", `${path}.href`, b?.href || "", { placeholder: "/contact or https://…" })}</div>${F("Style", `${path}.style`, b?.style || "primary", { type: "select", options: [["primary", "Filled (accent)"], ["outline", "Outline"], ["link", "Text link"]] })}</div>`;
  const listItem = (title, index, i, body, removable = true) => `<div class="ps-item"><div class="ps-item-head"><span>${S().esc(title)}</span><span>${i > 0 ? `<button type="button" class="ps-icon-btn" data-sb-act="item-move" data-index="${index}" data-item="${i}" data-dir="-1" title="Move up">↑</button>` : ""}<button type="button" class="ps-icon-btn" data-sb-act="item-move" data-index="${index}" data-item="${i}" data-dir="1" title="Move down">↓</button>${removable ? `<button type="button" class="ps-icon-btn danger" data-sb-act="item-remove" data-index="${index}" data-item="${i}" title="Remove">✕</button>` : ""}</span></div>${body}</div>`;

  function blockFields(block, index) {
    const { esc } = S();
    const p = key => `blocks.${index}.${key}`;
    let fields = "";
    switch (block.type) {
      case "hero":
        fields = `${F("Background", p("style"), block.style, { type: "select", options: [["image", "Photo"], ["video", "Video (MP4)"], ["solid", "Solid colour"]] })}
          ${block.style !== "solid" ? imageField(block.style === "video" ? "Poster photo (shows before the video plays)" : "Photo", block.style === "video" ? p("poster") : p("image"), block.style === "video" ? block.poster : block.image) : ""}
          ${block.style === "video" ? videoField("Background video (MP4, up to 50 MB; plays with no sound)", p("video"), block.video) : ""}
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
        fields = `${F("Where is the video?", p("provider"), block.provider, { type: "select", options: [["file", "Upload a video file (MP4, up to 50 MB)"], ["youtube", "YouTube link"], ["vimeo", "Vimeo link"]] })}
          ${block.provider === "file"
            ? `${videoField("Video file", p("src"), block.src)}${imageField("Poster photo (shows before the video plays; optional)", p("poster"), block.poster)}<div class="ps-row">${F("Play by itself (no sound)", p("autoplay"), block.autoplay, { type: "checkbox" })}${F("Repeat", p("loop"), block.loop, { type: "checkbox" })}</div>${F("Show play and pause buttons", p("controls"), block.controls, { type: "checkbox" })}`
            : F("Paste the video link (or just its id)", p("videoId"), block.videoId, { placeholder: "https://www.youtube.com/watch?v=…" })}
          ${F("Heading (optional)", p("heading"), block.heading)}${F("Sentence (optional)", p("text"), block.text, { type: "textarea", rows: 2 })}`;
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
    const fontOpts = [["", "Same as the page"], ...T.SITE_FONTS.filter(f => f.id).map(f => [f.id, f.label])];
    const design = `<details class="sb-design" ${sb.designOpen ? "open" : ""}><summary>Design: background, colours, fonts, spacing</summary>
      <h4>Background</h4>
      ${colorField("Background colour (blank = page background)", p("design.bgColor"), d.bgColor, "#ffffff")}
      <div class="ps-row">${colorField("Colour fade: from", p("design.gradFrom"), d.gradFrom, "#062650")}${colorField("to", p("design.gradTo"), d.gradTo, "#ce1233")}</div>
      ${d.gradFrom && d.gradTo ? slider("Fade direction", p("design.gradAngle"), d.gradAngle === "" ? 135 : d.gradAngle, 0, 360, "°") : `<p class="ps-help">Pick both fade colours to put a colour fade behind this block.</p>`}
      ${imageField("Background photo (optional)", p("design.bgImage"), d.bgImage)}
      ${videoField("Background video (optional, plays with no sound)", p("design.bgVideo"), d.bgVideo)}
      ${d.bgImage || d.bgVideo ? slider("Darken the photo or video", p("design.overlay"), d.overlay === "" ? 62 : d.overlay, 0, 90, "%") : ""}
      <h4>Words</h4>
      ${F("Text colour", p("design.tone"), d.tone, { type: "select", options: [["", "Automatic"], ["light", "Light (for dark backgrounds)"], ["dark", "Dark"]] })}
      ${colorField("Or an exact text colour (blank = automatic)", p("design.textColor"), d.textColor, "#0f2340")}
      ${F("Heading size", p("design.headSize"), d.headSize, { type: "select", options: [["", "Normal"], ["sm", "Small"], ["md", "Medium"], ["lg", "Large"], ["xl", "Extra large"]] })}
      <div class="ps-row">${F("Heading font", p("design.headFont"), d.headFont, { type: "select", options: fontOpts })}${F("Text font", p("design.font"), d.font, { type: "select", options: fontOpts })}</div>
      <h4>Space and size</h4>
      <div class="ps-row">${F("Padding", p("design.padding"), d.padding, { type: "select", options: [["tight", "Tight"], ["normal", "Normal"], ["roomy", "Roomy"], ["none", "None"]] })}${F("Alignment", p("design.align"), d.align, { type: "select", options: [["left", "Left"], ["center", "Centred"]] })}</div>
      ${F("Width", p("design.width"), d.width, { type: "select", options: [["narrow", "Narrow (reading)"], ["normal", "Normal"], ["wide", "Wide"], ["full", "Full width"]] })}
      ${F("Hide on phones", p("design.hideMobile"), d.hideMobile, { type: "checkbox" })}
      ${F("Anchor (link to this block with #name)", p("design.anchor"), d.anchor, { placeholder: "about-us" })}
      <button type="button" class="ps-btn" data-sb-act="design-reset" data-index="${index}">Put this block's design back to normal</button></details>`;
    // On a 2.0 ad page a block can always step past the next section, so its arrows are never greyed out there.
    const kit = isKit();
    return `<div class="sb-block-head"><h3>${kit ? "" : `${index + 1}. `}${esc(T.BLOCK_LABEL(block.type))}</h3><div><button type="button" class="ps-icon-btn" data-sb-act="move" data-index="${index}" data-dir="-1" title="Move up" ${!kit && index === 0 ? "disabled" : ""}>↑</button><button type="button" class="ps-icon-btn" data-sb-act="move" data-index="${index}" data-dir="1" title="Move down" ${!kit && index === sb.draft.blocks.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="ps-icon-btn" data-sb-act="duplicate" data-index="${index}" title="Duplicate">⧉</button><button type="button" class="ps-icon-btn danger" data-sb-act="remove" data-index="${index}" title="Delete">✕</button></div></div><p class="ps-help sb-tip">Tip: click words on the page to type over them. Click a photo to change it.</p>${layoutChooser(block, index)}${fields}${design}`;
  }
  // Site Builder 2.0: the block's layout as big buttons (T.LAYOUTS; the first one is the original look).
  function layoutChooser(block, index) {
    const list = T.LAYOUTS[block.type];
    if (!list) return "";
    return `<div class="ps-field"><span>Layout</span><div class="sb-layouts">${list.map(([id, label]) => `<button type="button" class="sb-layout ${block.layout === id ? "active" : ""}" data-sb-act="layout" data-index="${index}" data-layout="${S().esc(id)}">${S().esc(label)}</button>`).join("")}</div></div>`;
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
    $("#sbPanel").hidden = true; frame.style.display = ""; fitFrame();
    if (!sb.draft) { frame.srcdoc = `<body style="font-family:Inter,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#53677f;background:#fff"><div style="text-align:center;max-width:520px;padding:20px"><h1 style="color:#082754">Welcome to the Site Builder</h1><p style="font-size:17px;line-height:1.6">1. Pick a page on the left, or press <b>+ New page</b>.<br>2. Click any block on the page to change it on the right.<br>3. Press <b>Publish</b> when it looks right.</p></div></body>`; return; }
    let html = "";
    try {
      html = sb.kind === "trainer"
        ? pageEditorPreviewDocument(trainerPreviewObject())
        : sb.kind === "ad2"
        ? A2().renderPage(sb.draft, { practice: Boolean(window.LDTT_IS_SANDBOX), preview: true, editor: true, base: `${location.origin}/`, data: siteCache.data }).replace(/<script src="\/assets\/v2\/v2\.js[^"]*" defer><\/script>/, "") // the page's own script (pop-ups) stays off in the editor
        : T.renderSitePage(sb.draft, { editor: true, base: "/", publicPath: `/${sb.draft.slug}`, siteTheme: sb.themeDraft || siteCache.theme, navigation: sb.navDraft || siteCache.nav, data: siteCache.data });
    }
    catch (error) { html = `<p style="font-family:sans-serif;padding:20px">The preview could not render: ${S().esc(error.message)}</p>`; }
    try { sb.frameScroll = frame.contentWindow?.scrollY || sb.frameScroll || 0; } catch { /* ignore */ }
    // The editor buttons' size (--sbz) is in the page from its first paint, so nothing shifts under the mouse after it loads.
    const wrapW = $("#sbFrameWrap")?.clientWidth || 0;
    const sbz = sb.device === "desktop" && wrapW && wrapW < DESKTOP_W ? (DESKTOP_W / wrapW).toFixed(3) : "1";
    html = html.replace("</head>", () => `<style>:root{--sbz:${sbz}}</style></head>`);
    frame.addEventListener("load", () => wireFrame(frame), { once: true });
    frame.srcdoc = html;
  }

  function wireFrame(frame) {
    const doc = frame.contentDocument; if (!doc || !sb) return;
    if (sb.kind === "trainer") prepareTrainerCanvas(doc); // sections, blocks and click-to-edit on the trainer page
    fitFrame(); // the new page gets the editor-button size back (--sbz)
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
      el.addEventListener("drop", e => { e.preventDefault(); if (!sb.dragId) return; const from = sb.draft.blocks.findIndex(b => b.id === sb.dragId); let to = sb.draft.blocks.findIndex(b => b.id === el.dataset.sbBlock); if (from === -1 || to === -1) return; const targetAfter = sb.draft.blocks[to].after; const r = el.getBoundingClientRect(); const before = e.clientY < r.top + r.height / 2; if (!before) to += 1; if (from < to) to -= 1; pushHistory(true); const [b] = sb.draft.blocks.splice(from, 1); if (isKit()) b.after = targetAfter; sb.draft.blocks.splice(to, 0, b); sb.dragId = null; S().toast("Block moved."); markDirty({ rerail: true }); });
    });
    doc.querySelectorAll("[data-sb-add-btn]").forEach(btn => btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); const at = btn.dataset.sbAddBtn; sb.insertAt = /^after:/.test(at) ? at : Number(at); sb.leftTab = "blocks"; sb.left = true; sb.blockSearch = ""; paintTop(); paintLeft(); paintRails(); $("#sbLeft .sb-search")?.focus(); }));
    // 2.0 ad pages: click a section to change its words and photos; its ↑ ↓ Hide buttons move or hide it.
    doc.querySelectorAll("[data-sb-sec]").forEach(el => {
      el.classList.toggle("sb-selected", el.dataset.sbSec === sb.selectedSec);
      el.addEventListener("click", e => { if (e.target.closest("[data-sb-sectool],[data-sb-img]")) return; e.preventDefault(); selectSection(el.dataset.sbSec); });
    });
    doc.querySelectorAll("[data-sb-sectool]").forEach(btn => btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); secAction(btn.dataset.sbSectool, btn.dataset.sec); }));
    // Site Builder 2.0: click words on the page and type over them; click a photo to change it.
    doc.querySelectorAll("[data-sb-edit],[data-sb-richedit]").forEach(el => el.addEventListener("click", event => { if (event.target.closest("[data-sb-tool]")) return; event.preventDefault(); event.stopPropagation(); startInlineEdit(el, event); }));
    doc.querySelectorAll("[data-sb-img]").forEach(el => el.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); const blockEl = el.closest("[data-sb-block]"); if (blockEl && sb.selectedId !== blockEl.dataset.sbBlock) selectBlock(blockEl.dataset.sbBlock, { scroll: false }); openPhotoPicker(el.dataset.sbImg); }));
    // Keyboard inside the frame: Esc / undo reach the parent
    doc.addEventListener("keydown", e => onKeys(e, true));
  }

  function selectBlock(id, { scroll = true } = {}) {
    if (!sb) return;
    sb.selectedId = id; sb.selectedSec = null; sb.rightTab = "block"; sb.right = true; sb.insertAt = null;
    if (window.innerWidth < 1400) sb.left = false; // small screen: the page and its settings get the room; Blocks / ☰ brings the list back
    paintTop(); paintRight(); paintRails();
    const doc = $("#sbFrame")?.contentDocument;
    if (doc) { doc.querySelectorAll("[data-sb-sec].sb-selected").forEach(el => el.classList.remove("sb-selected")); doc.querySelectorAll("[data-sb-block]").forEach(el => el.classList.toggle("sb-selected", el.dataset.sbBlock === id)); if (scroll) doc.querySelector(`[data-sb-block="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  // ───────────────────────── 2.0 ad pages (sb.kind "ad2") ─────────────────────────
  // The design's sections stay the design's own; the office changes their words and photos, moves or hides them,
  // swaps the logo, and puts any Site Builder block (reviews, video, gallery …) between them (content.blocks, each
  // with `after` = the section it follows). lib/ad2-page-template.js draws it all and checks every value.
  function selectSection(key) {
    if (!sb) return;
    sb.selectedSec = key; sb.selectedId = null; sb.rightTab = "block"; sb.right = true; sb.insertAt = null;
    if (window.innerWidth < 1400) sb.left = false;
    paintTop(); paintRight(); paintRails();
    const doc = $("#sbFrame")?.contentDocument;
    if (doc) { doc.querySelectorAll("[data-sb-block].sb-selected").forEach(el => el.classList.remove("sb-selected")); doc.querySelectorAll("[data-sb-sec]").forEach(el => el.classList.toggle("sb-selected", el.dataset.sbSec === key)); }
  }
  const a2Label = key => (A2().ANCHORS[sb.draft.design].find(([id]) => id === key) || [key, key])[1];
  function a2Order() {
    const d = sb.draft;
    const base = A2().ANCHORS[d.design].map(([id]) => id).filter(id => !A2().FIXED_ANCHORS.includes(id));
    if (!d.order) return base;
    const rank = key => { const i = d.order.indexOf(key); return i === -1 ? 100 + base.indexOf(key) : i; };
    return base.slice().sort((a, b) => rank(a) - rank(b));
  }
  function secAction(tool, key) {
    const d = sb?.draft; if (!d || !isKit()) return;
    const trainer = sb.kind === "trainer";
    const hk = trainer ? "hiddenSections" : "hidden";
    if (tool === "up" || tool === "down") {
      // Step past the next VISIBLE section (hidden ones keep their place), so every press visibly moves it.
      const order = trainer ? trainerOrder() : a2Order(); const i = order.indexOf(key); const hiddenSet = new Set(d[hk] || []);
      let j = i;
      do { j += tool === "up" ? -1 : 1; } while (j >= 0 && j < order.length && hiddenSet.has(order[j]) && !hiddenSet.has(key));
      if (i === -1 || j < 0 || j >= order.length) return;
      pushHistory(true);
      const [moved] = order.splice(i, 1);
      order.splice(j, 0, moved);
      if (trainer) d.customOrder = order; else d.order = order;
      S().toast(`${secLabel(key)} moved ${tool}.`);
    } else if (tool === "hide") { pushHistory(true); d[hk] = [...new Set([...(d[hk] || []), key])]; S().toast(`${secLabel(key)} is hidden. “Show it again” brings it back.`, 4500); }
    else if (tool === "show") { pushHistory(true); d[hk] = (d[hk] || []).filter(x => x !== key); if (!d[hk].length && !trainer) delete d[hk]; S().toast(`${secLabel(key)} is back on the page.`); }
    else if (tool === "reset") { pushHistory(true); if (trainer) { d.customOrder = []; d.hiddenSections = []; } else { delete d.order; delete d.hidden; } S().toast("Every section is back where the design puts it."); }
    else return;
    markDirty({ rerail: true });
  }
  // Move a block one step up or down the page: past its neighbour block, or past the next section (its `after` changes).
  function moveKitBlock(index, dir) {
    const d = sb.draft; const block = d.blocks?.[index]; if (!block) return;
    const seq = sb.kind === "trainer" ? ["hero", ...trainerOrder(), "end", "footer"] : ["hdr", ...a2Order(), "end", ...(A2().ANCHORS[d.design].some(([id]) => id === "foot") ? ["foot"] : [])];
    const same = d.blocks.map((b, i) => ({ b, i })).filter(x => x.b.after === block.after);
    const pos = same.findIndex(x => x.i === index);
    pushHistory(true);
    if (dir < 0 && pos > 0) { const j = same[pos - 1].i; [d.blocks[index], d.blocks[j]] = [d.blocks[j], d.blocks[index]]; }
    else if (dir > 0 && pos < same.length - 1) { const j = same[pos + 1].i; [d.blocks[index], d.blocks[j]] = [d.blocks[j], d.blocks[index]]; }
    else {
      const k = seq.indexOf(block.after) + (dir < 0 ? -1 : 1);
      if (k < 0 || k >= seq.length) { sb.history.pop(); return; }
      d.blocks.splice(index, 1);
      block.after = seq[k];
      if (dir < 0) d.blocks.push(block); // last under the section above
      else { const first = d.blocks.findIndex(b => b.after === block.after); d.blocks.splice(first === -1 ? d.blocks.length : first, 0, block); } // first under the section below
    }
    markDirty({ rerail: true });
  }
  function a2Field(f) {
    const { esc } = S(); const d = sb.draft; const v = d[f.key];
    if (f.kind === "text") return F(f.label, f.key, v);
    if (f.kind === "area") return F(f.label, f.key, v, { type: "textarea", rows: 4 });
    if (f.kind === "lines") return `<fieldset class="a2-group"><legend>${esc(f.label)}</legend>${v.map((line, i) => `<input type="text" data-sb-field="${f.key}.${i}" value="${esc(line)}" maxlength="${f.max}" aria-label="${esc(f.label)}, line ${i + 1}">`).join("")}</fieldset>`;
    if (f.kind === "pairs") return `<fieldset class="a2-group"><legend>${esc(f.label)}</legend>${v.map((item, i) => `<div class="a2-pair"><span class="a2-num">${i + 1}</span><input type="text" data-sb-field="vids.${i}.t" value="${esc(item.t)}" maxlength="${f.max}" aria-label="Video ${i + 1} title">${d.design === "d3" ? "" : `<input type="text" data-sb-field="vids.${i}.s" value="${esc(item.s)}" maxlength="${f.max2}" aria-label="Video ${i + 1} line">`}</div>`).join("")}<p class="ps-help">The titles are yours. To play YOUR OWN video behind a thumbnail, open that section and use the <b>Video</b> box under its picture (paste a YouTube link or upload an MP4). Empty = the standard LDTT video.</p></fieldset>`;
    if (f.kind === "reviews") return `<fieldset class="a2-group"><legend>${esc(f.label)}</legend>${v.map((r, i) => `<div class="a2-review"><span class="a2-num">${i + 1}</span><input type="text" data-sb-field="reviews.${i}.name" value="${esc(r.name)}" maxlength="${f.max}" aria-label="Review ${i + 1} name"><textarea data-sb-field="reviews.${i}.text" maxlength="${f.max2}" rows="3" aria-label="Review ${i + 1} words">${esc(r.text)}</textarea></div>`).join("")}<p class="ps-help">Use real Google reviews only. For more reviews (or reviews on Design 1), press <b>+ Add block here</b> and pick <b>Reviews</b>.</p></fieldset>`;
    if (f.kind === "states") { const on = new Set(v); return `<fieldset class="a2-group"><legend>${esc(f.label)} · <b>${v.length}</b> ticked</legend><div class="a2-states">${A2().ALL_STATES.map(name => `<label><input type="checkbox" data-sb-a2state="${esc(name)}" ${on.has(name) ? "checked" : ""}> ${esc(name)}</label>`).join("")}</div><p class="ps-help">The map, the state list and every "states" number follow these ticks (up to ${A2().MAX_STATES}).</p></fieldset>`; }
    return "";
  }
  // Which photo slots carry a play button, per design; the value is the videos2 key the play button reads.
  function a2VideoSlot(design, slot) {
    if (/^(ba[1-4]|st[1-3])$/.test(slot)) return slot;
    if (slot === "founder" && design === "d2") return "founder";
    if (slot === "about" && design === "d3") return "founder";
    return "";
  }
  function a2PhotoField(label, slot, value, file, size, vslot) {
    const { esc } = S(); const orig = `${A2().A}${file}`; const path = `photos.${slot}`;
    return `<div class="a2-photo"><img src="${esc(value || orig)}" alt="" loading="lazy"><div><strong>${esc(label)}</strong>${size ? `<small class="ps-help" style="display:block;margin:2px 0 4px">Best size: ${esc(size)} (JPG, PNG or WebP)</small>` : ""}<div class="a2-photo-actions"><label class="ps-btn sb-upload-btn">Upload<input type="file" accept="image/jpeg,image/png,image/webp" data-sb-bigupload="${path}" data-kind="photo" hidden></label><button type="button" class="ps-btn" data-sb-act="pick-photo" data-path="${path}">Choose</button>${value && value !== orig ? `<button type="button" class="ps-btn" data-sb-act="set-field" data-path="${path}" data-value="${esc(orig)}">Use the original</button>` : ""}</div><div class="sb-progress" data-sb-progress="${path}" hidden><i></i><span></span></div>${a2FrameSliders(slot)}${vslot ? videoField("Video behind this picture's play button (leave empty for the standard LDTT video)", `videos2.${vslot}`, sb.draft.videos2?.[vslot] || "", "or paste an MP4 https:// address or a YouTube link") : ""}</div></div>`;
  }
  // Joshua 2026-09-16: "we need to resize the pictures in the frames" — zoom + focus per photo slot.
  function a2FrameSliders(slot) {
    const f = sb.draft.pframe?.[slot] || {};
    const set = f.z || f.x !== undefined || f.y !== undefined;
    return `<details class="sb-photo-details" ${set ? "open" : ""}><summary>Resize in the frame (zoom + focus)</summary>
      ${slider("Zoom in", `pframe.${slot}.z`, f.z || 100, 100, 220, "%")}
      ${slider("Focus left ↔ right", `pframe.${slot}.x`, f.x === undefined ? 50 : f.x, 0, 100, "%")}
      ${slider("Focus up ↕ down", `pframe.${slot}.y`, f.y === undefined ? 50 : f.y, 0, 100, "%")}
      ${set ? `<button type="button" class="ps-btn" data-sb-act="clear-field" data-path="pframe.${slot}">Put the photo back the way the design frames it</button>` : ""}</details>`;
  }
  function ad2SectionFields(key) {
    const { esc } = S(); const a2 = A2(); const d = sb.draft; const design = d.design;
    const tabs = a2.ANCHOR_FIELDS[key] || [];
    const fields = a2.FIELDS.filter(f => tabs.includes(f.section) && f.designs.includes(design) && f.kind !== "photos");
    const slots = (a2.ANCHOR_PHOTOS[key] || []).map(k => (a2.PHOTO_SLOTS[design] || []).find(s => s[0] === k)).filter(Boolean);
    const fixed = a2.FIXED_ANCHORS.includes(key);
    const hidden = (d.hidden || []).includes(key);
    const order = a2Order(); const i = order.indexOf(key);
    return `<div class="sb-block-head"><h3>${esc(a2Label(key))}</h3>${fixed ? "" : `<div><button type="button" class="ps-icon-btn" data-sb-act="sec" data-tool="up" data-sec="${key}" title="Move this section up" ${i <= 0 ? "disabled" : ""}>↑</button><button type="button" class="ps-icon-btn" data-sb-act="sec" data-tool="down" data-sec="${key}" title="Move this section down" ${i === order.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="ps-btn" style="width:auto;min-height:36px;padding:0 12px" data-sb-act="sec" data-tool="${hidden ? "show" : "hide"}" data-sec="${key}">${hidden ? "Show" : "Hide"}</button></div>`}</div>
      <p class="ps-help sb-tip">This section is part of the 2.0 design: change its words and photos here. To add reviews, a video, photos or anything else, press <b>+ Add block here</b> under it on the page.</p>
      ${fields.map(a2Field).join("") || `<p class="ps-help">${key === "hdr" ? "The logo is on the <b>Page</b> tab, or click the logo on the page." : "This section has no words to change. You can move it or hide it."}</p>`}
      ${key === "hero" ? slider("Headline size", "h1_size", sb.draft.h1_size || 100, 50, 150, "%") : ""}
      ${slots.length ? `<h4>Photos</h4>${slots.map(([slot, label, file, size]) => a2PhotoField(label, slot, d.photos?.[slot], file, size, a2VideoSlot(design, slot))).join("")}<p class="ps-help">JPG, PNG or WebP, up to 10 MB.</p>` : ""}`;
  }
  function ad2PageFields() {
    const { esc, dateLabel } = S(); const a2 = A2(); const d = sb.draft;
    const seo = a2.FIELDS.filter(f => f.section === "seo" && f.designs.includes(d.design));
    const order = a2Order(); const logo = d.logo || {};
    return `<h3>Page settings</h3>
      ${F("Web address", "slug", d.slug, { placeholder: "miramar-beach" })}
      <p class="ps-help">Lives at <b>/ads/${esc(d.slug || "…")}</b>. Letters, numbers and dashes only. ${esc(a2.DESIGNS.find(x => x.id === d.design)?.label || "")}.</p>
      ${seo.map(a2Field).join("")}
      <h4>Logo</h4>
      <div class="ps-field"><span>Logo in the header and footer (blank = the standard LDTT logo)</span>${logo.photo ? `<img class="sb-thumb-img" style="object-fit:contain;background:#f4f7fb" src="${esc(logo.photo)}" alt="">` : ""}<div class="ps-row"><label class="ps-btn sb-upload-btn ${logo.photo ? "" : "red"}">${logo.photo ? "Replace the logo" : "Upload a logo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-sb-bigupload="logo.photo" data-kind="photo" hidden></label>${logo.photo ? `<button type="button" class="ps-btn" data-sb-act="clear-field" data-path="logo.photo">Use the standard logo</button>` : ""}</div><div class="sb-progress" data-sb-progress="logo.photo" hidden><i></i><span></span></div></div>
      ${logo.photo ? slider("Logo size", "logo.size", logo.size || 100, 40, 220, "%") : ""}
      <h4>Sections</h4>
      <p class="ps-help">The order the sections show on the page. A hidden section stays saved; show it again any time.</p>
      <div class="sb-sec-list">${order.map((key, i) => { const hid = (d.hidden || []).includes(key); return `<div class="sb-sec-row ${hid ? "is-hidden" : ""}"><span>${esc(a2Label(key))}${hid ? " <small>(hidden)</small>" : ""}</span><button type="button" class="ps-icon-btn" data-sb-act="sec" data-tool="up" data-sec="${key}" title="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="ps-icon-btn" data-sb-act="sec" data-tool="down" data-sec="${key}" title="Move down" ${i === order.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="ps-btn" data-sb-act="sec" data-tool="${hid ? "show" : "hide"}" data-sec="${key}">${hid ? "Show" : "Hide"}</button></div>`; }).join("")}</div>
      ${d.order || d.hidden ? `<button type="button" class="ps-btn" data-sb-act="sec" data-tool="reset" data-sec="">Put every section back the way the design has it</button>` : ""}
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

  // ───────────────────────── trainer pages (sb.kind "trainer") ─────────────────────────
  // Site Builder 2.0: a trainer's page opens here too. It is drawn by the trainer page's own code (app.js
  // pageEditorPreviewDocument), saved through the Page Editor's own draft save (persistTrainerRecord; a live page stays
  // live, rule 56) and published through its own publish (publishTrainerPageWorkflow). The Site Builder adds click-to-
  // edit words and photos, section order and hide, and Site Builder blocks between the sections (trainer.customBlocks).
  const TRAINER_SECTIONS = [["hero", "Top: headline, photos and the form"], ["stats", "Numbers"], ["services", "Services"], ["trainerVideo", "Trainer video"], ["trainer", "Meet the trainer (bio)"], ["reviewSubmission", "Leave a review"], ["reviews", "Reviews"], ["process", "How training begins"], ["consultation", "Closing call"], ["footer", "Footer"]];
  const TRAINER_ANCHORS = TRAINER_SECTIONS.map(([key]) => key);
  const TRAINER_FIELDS = ["heroHeadline", "tagline", "image", "heroTrainerPhoto", "landingBioPhoto", "companyLogo", "title", "bio", "seoTitle", "seoDescription", "layout", "review1Author", "review1Copy", "review1Show", "review2Author", "review2Copy", "review2Show", "review3Author", "review3Copy", "review3Show"];
  const TRAINER_FONTS = ["Inter", "Arial", "Georgia", "Trebuchet MS", "Impact"]; // the Page Editor's own list
  const portalHas = name => typeof window[name] === "function";
  const portalTrainers = () => { try { return typeof state !== "undefined" && Array.isArray(state.trainers) ? state.trainers.filter(t => t && t.name && !t.archived && !t.pageDeleted && !t.isOfficeDraft) : []; } catch { return []; } };
  const trainerLabel = key => (TRAINER_SECTIONS.find(([k]) => k === key) || [key, key])[1];
  const secLabel = key => (sb?.kind === "trainer" ? trainerLabel(key) : a2Label(key));
  function trainerDraftFrom(t) {
    const d = {};
    TRAINER_FIELDS.forEach(key => { d[key] = /Show$/.test(key) ? t[key] === true : (t[key] ?? ""); });
    const s = t.styleSettings || {};
    d.styleSettings = { fontFamily: s.fontFamily || "Inter", fontScale: Math.round(Number(s.fontScale || 1) * 100), brandPrimary: s.brandPrimary || "#071f44", brandAccent: s.brandAccent || "#d80f35" };
    d.hiddenSections = Array.isArray(t.hiddenSections) ? t.hiddenSections.slice() : [];
    d.customOrder = Array.isArray(t.customOrder) ? t.customOrder.slice() : [];
    d.blocks = T.normalizeKitBlocks(t.customBlocks || [], TRAINER_ANCHORS);
    return d;
  }
  function applyDraftToTrainer(t, d) {
    TRAINER_FIELDS.forEach(key => { t[key] = /Show$/.test(key) ? d[key] === true : String(d[key] ?? ""); });
    t.styleSettings = { ...(t.styleSettings || {}), ...(d.styleSettings || {}), fontScale: Math.min(1.25, Math.max(0.85, Number(d.styleSettings?.fontScale || 100) / 100)) };
    t.hiddenSections = (d.hiddenSections || []).slice();
    t.customOrder = (d.customOrder || []).slice();
    t.customBlocks = T.normalizeKitBlocks(d.blocks || [], TRAINER_ANCHORS);
  }
  // Only the fields changed here are written back, so a change made meanwhile in the Page Editor, Trainer Network or another
  // tab is never undone by an autosave from this screen.
  function applyChangedToTrainer(t, base, d) {
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    TRAINER_FIELDS.forEach(key => { if (!same(d[key], base?.[key])) t[key] = /Show$/.test(key) ? d[key] === true : String(d[key] ?? ""); });
    const ds = d.styleSettings || {}; const bs = base?.styleSettings || {};
    const style = { ...(t.styleSettings || {}) };
    ["fontFamily", "brandPrimary", "brandAccent"].forEach(key => { if (!same(ds[key], bs[key])) style[key] = ds[key]; });
    if (!same(ds.fontScale, bs.fontScale)) style.fontScale = Math.min(1.25, Math.max(0.85, Number(ds.fontScale || 100) / 100));
    t.styleSettings = style;
    if (!same(d.hiddenSections, base?.hiddenSections)) t.hiddenSections = (d.hiddenSections || []).slice();
    if (!same(d.customOrder, base?.customOrder)) t.customOrder = (d.customOrder || []).slice();
    if (!same(d.blocks, base?.blocks)) t.customBlocks = T.normalizeKitBlocks(d.blocks || [], TRAINER_ANCHORS);
  }
  function currentTrainer() {
    if (!portalHas("trainerById")) return null;
    const t = trainerById(sb.trainerId);
    return t && (String(t.id) === String(sb.trainerId) || String(t.remoteId) === String(sb.trainerId)) ? t : null;
  }
  function trainerPreviewObject() {
    const t = currentTrainer();
    const copy = { ...t, styleSettings: { ...(t?.styleSettings || {}) } };
    applyChangedToTrainer(copy, sb.trainerBase, sb.draft);
    copy.customBlocks = []; // the Site Builder puts the blocks in itself, with their editor buttons
    return copy;
  }
  function trainerOrder() {
    const base = TRAINER_ANCHORS.filter(key => key !== "hero" && key !== "footer");
    const order = sb.draft.customOrder || [];
    if (!order.length) return base;
    const rank = key => { const i = order.indexOf(key); return i === -1 ? 100 + base.indexOf(key) : i; };
    return base.slice().sort((a, b) => rank(a) - rank(b));
  }
  async function openTrainer(trainerId) {
    if (!portalHas("trainerById") || !portalHas("pageEditorPreviewDocument")) throw new Error("Trainer pages open from the staff portal. Sign in to the portal, then open the Site Builder.");
    const t = trainerById(trainerId);
    if (!t || (String(t.id) !== String(trainerId) && String(t.remoteId) !== String(trainerId))) throw new Error("That trainer could not be found. Refresh the portal and try again.");
    if (sb.pageId && sb.draft) await flushSave();
    const draft = trainerDraftFrom(t);
    Object.assign(sb, { kind: "trainer", trainerBase: S().clone(draft), trainerId: t.id, selectedSec: null, pageId: `trainer:${t.id}`, page: { id: `trainer:${t.id}`, status: t.pageStatus === "Published" && t.locked ? "published" : "draft", slug: t.slug }, draft, savedJson: JSON.stringify(draft), draftRevision: 1, revisions: [], status: "saved", savedAt: null, selectedId: null, rightTab: "page", history: [], future: [], insertAt: null, panel: null, durability: null });
    sb.left = window.innerWidth > 1100 || !sb.right;
    paintAll();
  }
  const TRAINER_EDITOR_STYLE = `<style data-sb-trainer-editor>
[data-sb-sec]{outline:2px dashed transparent;outline-offset:-2px;cursor:pointer}[data-sb-sec]:hover{outline-color:rgba(216,15,53,.55)}[data-sb-sec].sb-selected{outline:3px solid #d80f35;outline-offset:-3px}
[data-sb-sec]>.sb-label{position:absolute;top:8px;left:10px;z-index:60;display:none;background:#d80f35;color:#fff;font:900 11px/1 Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:7px 10px;border-radius:999px}
[data-sb-sec]:hover>.sb-label,[data-sb-sec].sb-selected>.sb-label{display:block}
.sb-sectools{position:absolute;top:6px;right:10px;z-index:60;display:none;gap:4px;background:#071f44;padding:4px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
[data-sb-sec]:hover>.sb-sectools,[data-sb-sec].sb-selected>.sb-sectools{display:flex}
.sb-sectools button{min-width:36px;height:34px;border:0;border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font:800 13px Inter,Arial,sans-serif;cursor:pointer;padding:0 10px}.sb-sectools button:hover{background:#fff;color:#071f44}
.sb-hidden-sec{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 18px;background:repeating-linear-gradient(45deg,#f4f7fb,#f4f7fb 10px,#e9eef5 10px,#e9eef5 20px);border:2px dashed #b8c6d8;color:#3b4d66;font:700 14px Inter,Arial,sans-serif}
.sb-hidden-sec button{min-height:38px;border-radius:10px;border:0;background:#082754;color:#fff;font:800 13px Inter,Arial,sans-serif;padding:0 14px;cursor:pointer}
.landing-brand img[data-sb-img]{cursor:pointer}
.sb-sectools,[data-sb-sec]>.sb-label,.sb-hidden-sec,.sb-add button{zoom:var(--sbz,1)}
</style>`;
  // The trainer page in the canvas: sections outlined with ↑ ↓ Hide, "+ Add block here" under each, blocks in place,
  // the headline and the line under it typeable, the photos and logo clickable.
  function prepareTrainerCanvas(doc) {
    const t = currentTrainer();
    if (!t || !doc.querySelector(".lp-page")) return;
    const p = trainerPreviewObject();
    try { applySectionBuilderSettings(doc, p); applyTrainerCustomOrder(doc, p); } catch { /* the page still shows */ }
    const kit = trainerKit({ ...p, customBlocks: sb.draft.blocks }, T, true);
    applyTrainerBlocksToDocument(doc, kit.items, kit.style);
    doc.head.insertAdjacentHTML("beforeend", TRAINER_EDITOR_STYLE);
    const page = doc.querySelector(".lp-page");
    const order = trainerOrder();
    const visible = order.filter(key => !(sb.draft.hiddenSections || []).includes(key));
    const esc = S().esc;
    TRAINER_ANCHORS.forEach(key => {
      const el = trainerPageSectionEl(doc, key);
      if (!el) return;
      const fixed = key === "hero" || key === "footer";
      let after = el;
      if (el.hidden) {
        el.insertAdjacentHTML("afterend", `<div class="sb-hidden-sec" data-sb-hidden-sec="${key}"><span>${esc(trainerLabel(key))} is hidden on the page</span><button type="button" data-sb-sectool="show" data-sec="${key}">Show it again</button></div>`);
        after = el.nextElementSibling;
      } else {
        el.setAttribute("data-sb-sec", key);
        if (doc.defaultView.getComputedStyle(el).position === "static") el.style.position = "relative";
        const i = visible.indexOf(key);
        el.insertAdjacentHTML("afterbegin", `<span class="sb-label">${esc(trainerLabel(key))}</span><div class="sb-sectools">${fixed ? "" : `<button type="button" data-sb-sectool="up" data-sec="${key}" title="Move this section up" ${i <= 0 ? "disabled" : ""}>↑</button><button type="button" data-sb-sectool="down" data-sec="${key}" title="Move this section down" ${i === visible.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-sb-sectool="hide" data-sec="${key}" title="Hide this section">Hide</button>`}</div>`);
      }
      const slots = [...page.querySelectorAll(`:scope > [data-ldtt-after="${key}"]`)];
      (slots.pop() || after).insertAdjacentHTML("afterend", `<div class="sb-add" data-sb-add="after:${key}"><button type="button" data-sb-add-btn="after:${key}">+ Add block here</button></div>`);
    });
    const hero = trainerPageSectionEl(doc, "hero");
    hero?.querySelector("h1")?.setAttribute("data-sb-edit", "heroHeadline");
    hero?.querySelector(".lp5-copy > p, .lp6-copy > p, .lp3-copy > p")?.setAttribute("data-sb-edit", "tagline");
    doc.querySelectorAll('[data-trainer-image-role="heroTrainerPhoto"]').forEach(img => img.setAttribute("data-sb-img", "heroTrainerPhoto"));
    doc.querySelectorAll('[data-trainer-image-role="landingBioPhoto"]').forEach(img => img.setAttribute("data-sb-img", "landingBioPhoto"));
    doc.querySelector(".landing-brand img")?.setAttribute("data-sb-img", "companyLogo");
    doc.querySelectorAll(".landing-brand, .landing-nav a").forEach(a => a.addEventListener("click", e => e.preventDefault()));
  }
  function trainerPhotoField(label, path, value, note = "") {
    const { esc } = S();
    return `<div class="ps-field"><span>${esc(label)}</span>${value ? `<img class="sb-thumb-img" src="${esc(assetUrl(value))}" alt="">` : ""}<div class="ps-row"><label class="ps-btn sb-upload-btn">Upload<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-sb-bigupload="${esc(path)}" data-kind="photo" hidden></label><button type="button" class="ps-btn" data-sb-act="pick-photo" data-path="${esc(path)}">Choose</button>${value ? `<button type="button" class="ps-btn" data-sb-act="clear-field" data-path="${esc(path)}">${esc(note || "Use the design's photo")}</button>` : ""}</div><div class="sb-progress" data-sb-progress="${esc(path)}" hidden><i></i><span></span></div></div>`;
  }
  function trainerSectionFields(key) {
    const { esc } = S(); const d = sb.draft;
    const fixed = key === "hero" || key === "footer";
    const hidden = (d.hiddenSections || []).includes(key);
    const order = trainerOrder(); const i = order.indexOf(key);
    const head = `<div class="sb-block-head"><h3>${esc(trainerLabel(key))}</h3>${fixed ? "" : `<div><button type="button" class="ps-icon-btn" data-sb-act="sec" data-tool="up" data-sec="${key}" title="Move this section up" ${i <= 0 ? "disabled" : ""}>↑</button><button type="button" class="ps-icon-btn" data-sb-act="sec" data-tool="down" data-sec="${key}" title="Move this section down" ${i === order.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="ps-btn" style="width:auto;min-height:36px;padding:0 12px" data-sb-act="sec" data-tool="${hidden ? "show" : "hide"}" data-sec="${key}">${hidden ? "Show" : "Hide"}</button></div>`}</div>`;
    const tip = `<p class="ps-help sb-tip">To add reviews, a video, photos or anything else, press <b>+ Add block here</b> under this section on the page.</p>`;
    let body = "";
    if (key === "hero") body = `${F("Big headline (blank = the design's own words)", "heroHeadline", d.heroHeadline, { type: "textarea", rows: 2 })}${F("Line under the headline", "tagline", d.tagline, { type: "textarea", rows: 3 })}${trainerPhotoField("Big photo behind the headline", "image", d.image)}${trainerPhotoField("Trainer photo in the top card", "heroTrainerPhoto", d.heroTrainerPhoto)}${trainerPhotoField("Logo in the top bar (blank = the LDTT logo)", "companyLogo", d.companyLogo, "Use the LDTT logo")}<p class="ps-help">Click the headline or the line under it on the page to type there. Photo size and place: the classic Page Editor (More → Open this page in the classic Page Editor).</p>`;
    else if (key === "trainer") body = `${F("Title under the name", "title", d.title)}${F("Bio (shows on the page and, after Publish, on the bio page)", "bio", d.bio, { type: "textarea", rows: 9 })}${trainerPhotoField("Bio photo", "landingBioPhoto", d.landingBioPhoto)}<p class="ps-help">The name, market, specialties and credentials come from Trainer Network → the trainer's profile.</p>`;
    else if (key === "reviews" || key === "reviewSubmission") body = `<p class="ps-help">Approved reviews from the Reviews inbox show here by themselves. Your own words, below, show only when "Show on page" is ticked.</p>${[1, 2, 3].map(n => `<div class="ps-item"><div class="ps-item-head"><span>Your testimonial ${n}</span></div>${F("Client name", `review${n}Author`, d[`review${n}Author`])}${F("Words", `review${n}Copy`, d[`review${n}Copy`], { type: "textarea", rows: 3 })}${F("Show on page", `review${n}Show`, d[`review${n}Show`], { type: "checkbox" })}</div>`).join("")}<p class="ps-help">Want reviews higher up, or a "Reviews" button that jumps here? Add a <b>Reviews</b> block, or a <b>Button row</b> with the link <b>#reviews</b>.</p>`;
    else if (key === "trainerVideo") body = `<p class="ps-help">The trainer's introduction video comes from Trainer Network. To add another video, press <b>+ Add block here</b> and pick <b>Video</b>.</p>`;
    else body = `<p class="ps-help">This section uses the company's standard words, the same on every trainer page. You can move it, hide it, or add blocks around it.</p>`;
    return head + tip + body;
  }
  function trainerPageFields() {
    const { esc } = S(); const d = sb.draft; const t = currentTrainer();
    const layouts = typeof approvedLayouts !== "undefined" && Array.isArray(approvedLayouts) ? approvedLayouts : [];
    const order = trainerOrder();
    const href = t && portalHas("trainerPageHref") ? trainerPageHref(t) : "";
    return `<h3>${esc(t?.name || "Trainer")}'s page</h3>
      <p class="ps-help">Lives at <b>${esc(href)}</b>. ${sb.page.status === "published" ? "It is live now; your changes show only after Publish." : "It is a draft until you press Publish."}</p>
      ${layouts.length ? F("Design", "layout", d.layout, { type: "select", options: layouts.map(l => [l.id, l.label || l.name || l.id]) }) : ""}
      <h4>Colours and letters</h4>
      ${colorField("Main colour", "styleSettings.brandPrimary", d.styleSettings.brandPrimary, "#071f44")}
      ${colorField("Accent colour (buttons)", "styleSettings.brandAccent", d.styleSettings.brandAccent, "#d80f35")}
      ${F("Font", "styleSettings.fontFamily", d.styleSettings.fontFamily, { type: "select", options: TRAINER_FONTS.map(f => [f, f]) })}
      ${slider("Text size", "styleSettings.fontScale", Number(d.styleSettings.fontScale || 100), 85, 125, "%")}
      <h4>Search (Google)</h4>
      ${F("Search title (blank = the standard title)", "seoTitle", d.seoTitle)}
      ${F("Search description", "seoDescription", d.seoDescription, { type: "textarea", rows: 3 })}
      <h4>Sections</h4>
      <p class="ps-help">The order the sections show on the page. A hidden section stays saved; show it again any time.</p>
      <div class="sb-sec-list">${order.map((key, i) => { const hid = (d.hiddenSections || []).includes(key); return `<div class="sb-sec-row ${hid ? "is-hidden" : ""}"><span>${esc(trainerLabel(key))}${hid ? " <small>(hidden)</small>" : ""}</span><button type="button" class="ps-icon-btn" data-sb-act="sec" data-tool="up" data-sec="${key}" title="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="ps-icon-btn" data-sb-act="sec" data-tool="down" data-sec="${key}" title="Move down" ${i === order.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="ps-btn" data-sb-act="sec" data-tool="${hid ? "show" : "hide"}" data-sec="${key}">${hid ? "Show" : "Hide"}</button></div>`; }).join("")}</div>
      ${(d.customOrder || []).length || (d.hiddenSections || []).length ? `<button type="button" class="ps-btn" data-sb-act="sec" data-tool="reset" data-sec="">Put every section back the way the design has it</button>` : ""}
      <h4>More</h4>
      <p class="ps-help">Photo size and place, the photo library, social links and the trainer's profile stay in the classic Page Editor and Trainer Network.</p>
      <button type="button" class="ps-btn navy" data-sb-act="classic-trainer">Open this page in the classic Page Editor</button>`;
  }
  async function publishTrainer() {
    const { modal, esc, toast } = S();
    const t = currentTrainer(); if (!t) { toast("That trainer could not be found. Refresh the portal and try again.", 6000); return; }
    const href = portalHas("trainerPageHref") ? trainerPageHref(t) : "";
    const m = modal(`<h3>Publish ${esc(t.name)}'s page?</h3><p class="ps-help">Every change you made here goes live at <b>${esc(href)}</b>, the same as Publish in the Page Editor. The page stays locked, and the bio page gets the new bio.</p><div class="ps-actions"><button type="button" class="ps-btn" data-ps-close>Not yet</button><button type="button" class="ps-btn red" data-ps-go>Publish now</button></div>`);
    m.querySelector("[data-ps-close]").addEventListener("click", () => m.remove());
    m.querySelector("[data-ps-go]").addEventListener("click", async event => {
      event.target.disabled = true; event.target.textContent = "Publishing…";
      applyChangedToTrainer(t, sb.trainerBase, sb.draft); sb.trainerBase = S().clone(sb.draft); t._editedAt = Date.now();
      t.pageStatus = "Published"; t.locked = true;
      const ok = portalHas("runRemoteMutation") && portalHas("publishTrainerPageWorkflow")
        ? await runRemoteMutation("Trainer page published and locked", () => publishTrainerPageWorkflow(t, true), { reload: false, type: "Trainer Page", detail: `${t.name} landing page published and locked from the Site Builder.` })
        : false;
      m.remove();
      if (!sb) return;
      if (!ok) { sb.page.status = t.pageStatus === "Published" && t.locked ? "published" : "draft"; paintTop(); toast("Not published. Your changes are still in the draft.", 7000); return; }
      sb.page.status = "published"; sb.savedJson = draftJson(); sb.status = "saved"; sb.savedAt = new Date().toISOString(); paintAll();
      const done = modal(`<h3>Published</h3><p class="ps-help">${esc(t.name)}'s page is live.</p><div class="ps-actions"><a class="ps-btn navy" href="${esc(href)}" target="_blank" rel="noopener" style="text-decoration:none">Open the live page</a><button type="button" class="ps-btn" data-ps-close>Keep editing</button></div>`);
      done.querySelector("[data-ps-close]").addEventListener("click", () => done.remove());
    });
  }
  function openClassicTrainerEditor() {
    const id = sb?.trainerId; if (!id) return;
    flushSave().then(() => {
      closeStudio();
      try { state.selectedTrainerId = id; state.builderSurface = "trainer"; state.activeView = "pageEditor"; if (portalHas("saveState")) saveState(); else if (portalHas("render")) render(); }
      catch (error) { S().toast(error.message, 6000); }
    });
  }
  function trainerGroupHtml(q) {
    if (!portalHas("pageEditorPreviewDocument")) return "";
    const { esc } = S();
    const list = portalTrainers().filter(t => !q || `${t.name} ${t.market} ${t.slug}`.toLowerCase().includes(q));
    return `<h3>Trainer pages</h3>${list.length ? list.map(t => { const id = `trainer:${t.id}`; const live = t.pageStatus === "Published" && t.locked; return `<div class="sb-page-item"><button type="button" class="sb-page-row ${sb.pageId === id ? "active" : ""}" data-sb-page="${esc(id)}" data-type="trainer"><span class="sb-page-dot ${live ? "live" : ""}"></span><span class="sb-page-name">${esc(t.name)}<small>${esc(portalHas("trainerPageHref") ? trainerPageHref(t) : `/${t.pageSlug || t.slug}`)} · ${live ? "Live" : "Draft"}${t.market ? ` · ${esc(t.market)}` : ""}</small></span></button></div>`; }).join("") : `<p class="ps-help">No trainers match.</p>`}`;
  }

  // Site Builder 2.0: type straight onto the page. The words go into the draft as you type (no redraw, so the
  // cursor stays put); the block's fields on the right catch up when you click away. Enter or Esc finishes a
  // one-line field; rich text keeps Enter for a new paragraph and goes through the same sanitiser as the toolbar box.
  function startInlineEdit(el, event) {
    if (!sb?.draft || el.isContentEditable) return;
    const blockEl = el.closest("[data-sb-block]");
    if (blockEl && sb.selectedId !== blockEl.dataset.sbBlock) selectBlock(blockEl.dataset.sbBlock, { scroll: false });
    const rich = el.hasAttribute("data-sb-richedit");
    const path = el.dataset.sbEdit || el.dataset.sbRichedit;
    const doc = el.ownerDocument;
    el.setAttribute("contenteditable", rich ? "true" : "plaintext-only");
    if (!rich && el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true");
    el.focus();
    try { const range = doc.caretRangeFromPoint?.(event.clientX, event.clientY); if (range) { const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(range); } } catch { /* the cursor starts at the beginning */ }
    sb.inlineEditing = path;
    const read = () => { if (rich) return T.sanitizeRichText(el.innerHTML); const clone = el.cloneNode(true); clone.querySelectorAll("br").forEach(br => br.replaceWith(" ")); return String(clone.textContent || "").replace(/\s+/g, " ").trim(); };
    const before = read(); const stored = getPath(sb.draft, path); let pushed = false;
    const onInput = () => { if (!sb?.draft) return; if (!pushed) { pushHistory(true); pushed = true; } setPath(sb.draft, path, read()); markDirty({ canvas: false }); };
    const onKey = e => { if (e.key === "Escape" || (!rich && e.key === "Enter")) { e.preventDefault(); e.stopPropagation(); el.blur(); } };
    const finish = () => {
      el.removeEventListener("input", onInput); el.removeEventListener("keydown", onKey); el.removeAttribute("contenteditable");
      if (!sb?.draft) return;
      sb.inlineEditing = null;
      const after = read();
      if (after === before) { // clicked and left, or typed it back the same: the draft keeps what it had
        if (pushed) { setPath(sb.draft, path, stored); sb.history.pop(); if (draftJson() === sb.savedJson) { sb.status = "saved"; paintStatus(); paintTop(); } else markDirty({ rerail: true, canvas: false }); }
        return;
      }
      setPath(sb.draft, path, after); markDirty({ rerail: true, canvas: false });
    };
    el.addEventListener("input", onInput); el.addEventListener("keydown", onKey); el.addEventListener("blur", finish, { once: true });
    S().toast(rich ? "Type to change the words. Bold is Cmd/Ctrl+B. Click outside when you are done." : "Type to change the words. Press Enter when you are done.", 3200);
  }

  // Site Builder 2.0: click a photo on the page → upload a new one, pick one of the site's photos, paste an address, or remove it.
  function openPhotoPicker(path) {
    const { esc, modal, photoChoices, toast } = S();
    const current = getPath(sb.draft, path) || "";
    const choices = sb?.kind === "ad2" && !path.startsWith("blocks.") ? (path === "logo.photo" ? [] : A2().ASSET_FILES.filter(f => /\.(webp|jpe?g|png)$/i.test(f) && f !== "emblem.png").map(f => `${A2().A}${f}`)) : sb?.kind === "trainer" && !path.startsWith("blocks.") ? (path === "companyLogo" ? [] : photoChoices().map(p => `/${p}`)) : photoChoices();
    const m = modal(`<h3>${/^(logo\.photo|companyLogo)$/.test(path) ? "Change the logo" : "Change this photo"}</h3>
      ${current ? `<img class="sb-thumb-img" style="max-height:180px;object-fit:contain;background:#f4f7fb" src="${esc(assetUrl(current))}" alt="The photo there now">` : ""}
      <div class="ps-actions" style="flex-wrap:wrap"><label class="ps-btn red sb-upload-btn">Upload a photo from this computer<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-sb-bigupload="${esc(path)}" data-kind="photo" hidden></label>${current ? `<button type="button" class="ps-btn" data-x="remove">Remove the photo</button>` : ""}</div>
      <div class="sb-progress" data-sb-progress="${esc(path)}" hidden><i></i><span></span></div>
      <h4 style="margin:14px 0 6px">Or pick one of the site's photos</h4>
      <div class="ps-photo-grid sb-picker-grid">${choices.map(p => `<button type="button" data-pick="${esc(p)}" style="background-image:url('${esc(assetUrl(p))}')" title="${esc(p)}" class="${p === current ? "selected" : ""}"></button>`).join("") || `<p class="ps-help">Upload one from this computer, or paste an address below.</p>`}</div>
      <label class="ps-field" style="margin-top:12px"><span>Or paste a photo address (https://…)</span><input data-x-url placeholder="https://…"></label>
      <div class="ps-actions"><button type="button" class="ps-btn" data-x="close">Close</button><button type="button" class="ps-btn navy" data-x="use-url">Use this address</button></div>`);
    const set = value => { if (!sb?.draft) return; pushHistory(true); setPath(sb.draft, path, value); markDirty({ rerail: true }); };
    m.addEventListener("click", e => {
      const pick = e.target.closest("[data-pick]");
      if (pick) { set(pick.dataset.pick); m.remove(); toast("Photo changed. Undo with ↶ if it is wrong."); return; }
      const x = e.target.closest("[data-x]")?.dataset.x;
      if (x === "close") m.remove();
      else if (x === "remove") { set(""); m.remove(); toast("Photo removed."); }
      else if (x === "use-url") { const v = m.querySelector("[data-x-url]").value.trim(); if (!/^https:\/\/\S+$/i.test(v)) { toast("Paste an address that starts with https://"); return; } set(v); m.remove(); toast("Photo changed."); }
    });
    sb.photoModal = m;
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
    if (el.matches("[data-sb-a2state]")) { // 2.0 ad page: the states on the map (the office's order: a new tick goes last)
      if (event.type !== "change" || sb.kind !== "ad2") return;
      const name = el.dataset.sbA2state; const list = (sb.draft.states || []).filter(x => x !== name);
      if (el.checked) { if (list.length >= A2().MAX_STATES) { el.checked = false; S().toast(`The map has room for ${A2().MAX_STATES} states. Untick one first.`); return; } list.push(name); }
      pushHistory(true); sb.draft.states = list; markDirty({ rerail: true }); return;
    }
    if (el.matches("[data-sb-jump]")) { if (event.type === "change" && el.value) jumpTo(el.value); return; }
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
    if (field.type === "color" || (field.type === "text" && /colors?\.|bgColor|gradFrom|gradTo|textColor/.test(rawPath))) {
      $$(`[data-sb-field="${CSS.escape(rawPath)}"]`).forEach(twin => { if (twin !== field && /^#[0-9a-f]{6}$/i.test(value)) twin.value = value; });
      if (!/^#[0-9a-f]{6}$/i.test(value) && value !== "") return;
    }
    if (field.type === "range") { const out = field.closest("label")?.querySelector("[data-sb-readout]"); if (out) out.textContent = `${value}${field.dataset.unit || ""}`; }
    const t = targetFor(rawPath);
    if (t.kind === "page") {
      if (t.path === "slug") value = T.safeSlug(value);
      if (/\.(count|columns|limit|overlay|rating|gradAngle|fontScale)$/.test(t.path)) value = Number(value);
      // A pasted YouTube / Vimeo link is fine: keep only the video id, and switch to Vimeo for a Vimeo link.
      if (/\.videoId$/.test(t.path) && /[/.]/.test(value)) {
        const m = String(value).match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|vimeo\.com\/(?:video\/)?)([A-Za-z0-9_-]{3,40})/);
        if (m) { if (/vimeo\.com/i.test(value)) setPath(sb.draft, t.path.replace(/videoId$/, "provider"), "vimeo"); value = m[1]; }
      }
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

  // Joshua 2026-09-16: "I definitely need a discard button." Puts the newest PUBLISHED version back into
  // the draft, so an accidental add or edit is gone in one press. ↶ Undo stays for single steps.
  async function discardToPublished() {
    const rev = (sb.revisions || []).find(r => r.kind === "published");
    if (!rev) { S().toast("This page has no published version yet. Use ↶ Undo instead."); return; }
    try {
      const data = await api({ operation: "restore", id: sb.pageId, revision_id: rev.id });
      pushHistory(true);
      sb.draft = normalizeDraft(data.content);
      sb.draftRevision = Number(data.draft_revision || sb.draftRevision + 1);
      sb.savedJson = draftJson(); sb.status = "saved"; sb.savedAt = new Date().toISOString(); sb.selectedId = null;
      paintAll();
      S().toast("Your changes were thrown away. The draft matches the published page again.", 6000);
    } catch (e) { S().toast(e.message, 6000); }
  }
  function blockAction(act, index, extra = {}) {
    const d = sb.draft; const { toast } = S();
    const block = d.blocks[index];
    switch (act) {
      case "remove": { if (!block) return; pushHistory(true); d.blocks.splice(index, 1); if (sb.selectedId === block.id) sb.selectedId = null; toast(`${T.BLOCK_LABEL(block.type)} removed. Undo with ↶ or Cmd/Ctrl+Z.`); markDirty({ rerail: true }); return; }
      case "duplicate": { if (!block) return; pushHistory(true); const copy = T.normalizeBlock(S().clone(block)); copy.id = `${block.type}-${Math.random().toString(36).slice(2, 8)}`; if (block.after) copy.after = block.after; d.blocks.splice(index + 1, 0, copy); sb.selectedId = copy.id; toast(`${T.BLOCK_LABEL(block.type)} duplicated.`); markDirty({ rerail: true }); return; }
      case "up": case "down": case "move": { const dir = act === "up" ? -1 : act === "down" ? 1 : Number(extra.dir); if (isKit()) { if (block) moveKitBlock(index, dir); return; } const to = index + dir; if (!block || to < 0 || to >= d.blocks.length) return; pushHistory(true); d.blocks.splice(index, 1); d.blocks.splice(to, 0, block); markDirty({ rerail: true }); return; }
      default:
    }
  }
  function addBlock(type) {
    const d = sb.draft; if (!d) return;
    const block = T.blankBlock(type, { city: d.city, market: d.market, slug: d.slug });
    if (!block) return;
    if (isKit()) {
      // 2.0 ad page / trainer page: the block goes under the section (or block) the office picked; the lead form is the page's own.
      if (T.KIT_EXCLUDED.has(type)) { S().toast("This page has its own lead form already. Pick another block."); return; }
      pushHistory(true);
      d.blocks = d.blocks || [];
      const firstOf = key => { const i = d.blocks.findIndex(b => b.after === key); return i === -1 ? d.blocks.length : i; };
      let after = "end"; let pos = d.blocks.length;
      if (typeof sb.insertAt === "string" && sb.insertAt.startsWith("after:")) { after = sb.insertAt.slice(6); pos = firstOf(after); }
      else { const sel = d.blocks.findIndex(b => b.id === sb.selectedId); if (sel !== -1) { after = d.blocks[sel].after; pos = sel + 1; } else if (sb.selectedSec) { after = sb.selectedSec; pos = firstOf(after); } }
      block.after = after;
      d.blocks.splice(pos, 0, block);
      sb.selectedSec = null;
    } else {
      pushHistory(true);
      let at = sb.insertAt;
      if (at === null || at === undefined) { const sel = d.blocks.findIndex(b => b.id === sb.selectedId); at = sel === -1 ? d.blocks.length : sel + 1; }
      at = Math.max(0, Math.min(d.blocks.length, at));
      d.blocks.splice(at, 0, block);
    }
    sb.insertAt = null; sb.selectedId = block.id; sb.rightTab = "block"; sb.right = true;
    if (window.innerWidth < 1100) sb.left = false;
    S().toast(`${T.BLOCK_LABEL(type)} added. Not what you wanted? Press the ✕ on the block, or ↶ Undo.`, 6000);
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

  // Site Builder 2.0: photos up to 10 MB and videos up to 50 MB. Small photos (3.5 MB or less) keep the proven
  // "upload" operation; bigger files get a one-time signed address from api/pages.js "upload_url" and go straight to
  // storage with a progress bar.
  const SMALL_PHOTO = 3.5 * 1024 * 1024;
  function paintUpload(path, pct, label = "") {
    document.querySelectorAll(`[data-sb-progress="${CSS.escape(path)}"]`).forEach(bar => { bar.hidden = pct === null; const i = bar.querySelector("i"); if (i) i.style.width = `${pct || 0}%`; const s = bar.querySelector("span"); if (s) s.textContent = label || `${pct || 0}%`; });
  }
  function putSigned(url, file, onPct) {
    const methods = ["PUT", "POST"];
    const attempt = index => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(methods[index], url, true);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = e => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        if ((xhr.status === 404 || xhr.status === 405) && index + 1 < methods.length) { attempt(index + 1).then(resolve, reject); return; }
        if (xhr.status < 200 || xhr.status >= 300) { let msg = ""; try { msg = JSON.parse(xhr.responseText).message || ""; } catch { msg = ""; } reject(new Error(msg || `the storage answered ${xhr.status}`)); return; }
        resolve();
      };
      xhr.onerror = () => reject(new Error("the connection dropped. Check the internet and try again"));
      xhr.send(file);
    });
    return attempt(0);
  }
  async function uploadBig(file, path, kind = "photo") {
    const { api, toast } = S();
    if (!file || !sb) return;
    if (file.type === "video/quicktime") { toast("That is an iPhone MOV video. Save it as MP4 first (iPhone: Settings → Camera → Formats → Most Compatible, or share it as MP4), then upload it.", 9000); return; }
    const isVideo = /^video\/(mp4|webm)$/.test(file.type);
    if (kind === "video" && !isVideo) { toast("Pick a video file: MP4 or WebM.", 5000); return; }
    if (kind === "photo" && !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { toast("Pick a JPG, PNG, WebP or GIF photo.", 5000); return; }
    const maxMb = isVideo ? 50 : 10;
    if (file.size > maxMb * 1024 * 1024) { toast(isVideo ? "That video is bigger than 50 MB. Make it shorter or smaller (for example with the phone's “compress” or “export” option), then try again." : "That photo is bigger than 10 MB. Make it smaller, then try again.", 8000); return; }
    let url = "";
    try {
      if (!isVideo && file.size <= SMALL_PHOTO) {
        paintUpload(path, 30, "Uploading…");
        const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("the file could not be read")); r.readAsDataURL(file); });
        url = (await api({ operation: "upload", name: file.name, type: file.type, data })).url;
      } else {
        paintUpload(path, 0, "Getting ready…");
        const sign = await api({ operation: "upload_url", name: file.name, type: file.type, size: file.size });
        await putSigned(sign.signedUrl, file, pct => paintUpload(path, pct, `Uploading ${isVideo ? "the video" : "the photo"}… ${pct}%`));
        url = sign.publicUrl;
      }
    } catch (error) {
      paintUpload(path, null);
      toast(`Upload failed: ${error.message}.`, 7000);
      return;
    }
    if (!sb) return;
    paintUpload(path, null);
    const t = targetFor(path);
    if (t.kind === "page") pushHistory(true);
    setPath(t.root, t.path, url);
    if (sb.photoModal?.isConnected) sb.photoModal.remove();
    toast(isVideo ? "Video uploaded. It is on the page now; Publish puts it live." : "Photo uploaded. Publish puts it live.", 4500);
    if (t.kind === "page") markDirty({ rerail: true }); else { paintLeft(); repaintCanvas(); }
  }

  // Site Builder 2.0: copy any page (site, landing, ad, 2.0). The copy is a draft with its own web address.
  function uniqueSlug(base) {
    const taken = new Set((S().store.pages || []).map(p => p.slug));
    const root = T.safeSlug(base) || "page-copy";
    if (!taken.has(root)) return root;
    for (let n = 2; n < 100; n += 1) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
    return `${root}-${Date.now().toString(36)}`;
  }
  function duplicatePage(id) {
    const { api, toast, modal, esc, store } = S();
    const row = (store.pages || []).find(p => p.id === id);
    if (!row) return;
    const type = row.page_type || "ad";
    const m = modal(`<h3>Make a copy of this page</h3><p class="ps-help">The copy has every block, word and photo of <b>${esc(row.title || row.market || row.slug)}</b>. It starts as a draft, so nothing changes on the site until you publish it.</p>
      <label class="ps-field"><span>Web address of the copy</span><input data-dup-slug value="${esc(uniqueSlug(`${row.slug}-copy`))}"></label>
      <div class="ps-actions"><button type="button" class="ps-btn" data-dup-x="close">Cancel</button><button type="button" class="ps-btn red" data-dup-x="go">Make the copy and open it</button></div>`);
    const input = m.querySelector("[data-dup-slug]");
    input.addEventListener("input", () => { const pos = input.selectionStart; input.value = T.safeSlug(input.value); try { input.setSelectionRange(pos, pos); } catch { /* ignore */ } });
    m.addEventListener("click", async e => {
      const x = e.target.closest("[data-dup-x]")?.dataset.dupX;
      if (x === "close") { m.remove(); return; }
      if (x !== "go") return;
      const slug = T.safeSlug(input.value);
      if (!slug) { toast("Type a web address: letters, numbers and dashes."); return; }
      e.target.disabled = true; e.target.textContent = "Copying…";
      try {
        if (sb?.pageId) await flushSave();
        const data = await api({ operation: "get", id });
        const content = { ...(data.page.draft_content || {}), slug };
        if (type === "site" || type === "landing") { content.pageType = type; content.title = `${content.title || row.title || slug} (copy)`; }
        if (type === "ad") content.title = `${content.title || row.title || slug} (copy)`;
        const created = await api({ operation: "create", page_type: type, content });
        m.remove();
        store.pages = null; await S().loadPages(true);
        toast(`Copy made at ${created.page.public_path || `/${slug}`}. It is a draft.`, 5000);
        await jumpTo(created.page.id);
        if (sb) paintAll();
      } catch (error) { toast(error.message, 6000); e.target.disabled = false; e.target.textContent = "Make the copy and open it"; }
    });
    setTimeout(() => input.focus(), 50);
  }

  // Site Builder 2.0: "How to use" — plain steps on the canvas, plus a short tour that points at each part.
  const HELP_STEPS = [
    ["Open a page", "Press <b>Pages</b> on the left and click a page. Or press <b>+ New page</b> to start one (from a template, from a page of the current website, or as a copy)."],
    ["Change words", "Click any words on the page and type. Press <b>Enter</b> when you are done. You can also change them in the box on the right."],
    ["Change a photo", "Click a photo on the page. Upload one from your computer (up to 10 MB), pick one of the site's photos, or paste an address."],
    ["Add a block", "Press a <b>+ Add block</b> button between two blocks, then click the block you want in the list on the left: reviews, video, photo gallery, questions, prices, a form and more."],
    ["Add a video", "Add a <b>Video</b> block and press <b>Upload a video</b> (MP4 up to 50 MB). Or paste a YouTube link. Any block can also have a video behind it: <b>Design → Background video</b>."],
    ["Move and copy blocks", "Hold your mouse on a block. Drag <b>⋮⋮</b> to move it, or use <b>↑ ↓</b>. <b>⧉</b> makes a copy. <b>✕</b> deletes it (↶ brings it back)."],
    ["Change the layout", "Click a block, then pick a <b>Layout</b> on the right, for example the photo on the left or the right, or reviews that slide."],
    ["Change colours, fonts and backgrounds", "One block: click it, then open <b>Design</b> on the right (colour, colour fade, photo or video behind it, fonts, heading size, spacing). Every page at once: the <b>Theme</b> tab on the left (colour schemes, fonts, logo, buttons)."],
    ["Menus", "The <b>Menus</b> tab changes the links at the top and bottom of every page."],
    ["Undo, save and publish", "Your work saves by itself (top bar: <b>Saved</b>). <b>↶</b> undoes, <b>↷</b> redoes. <b>Preview draft</b> shows the page in a new tab. <b>Publish</b> puts it on the website. Every publish keeps a version you can bring back (Page tab → History)."],
    ["Copy a whole page", "In <b>Pages</b>, press <b>⧉ Copy</b> next to any page, including ad landing pages. The copy is a draft with its own address."]
  ];
  function openHelp() {
    if (!sb) return;
    sb.panel = "help";
    const { esc } = S();
    const panel = $("#sbPanel");
    panel.innerHTML = `<div class="sb-new sb-help"><div class="sb-new-head"><div><h2>How to use the Site Builder</h2><p>Everything you can change, in order. You cannot break the live website from here: nothing goes live until you press Publish.</p></div><div style="display:flex;gap:8px"><button type="button" class="ps-btn navy" style="width:auto" data-sb-act="tour">Show me around</button><button type="button" class="ps-btn" style="width:auto" data-sb-act="close-panel">Close</button></div></div>
      <ol class="sb-help-steps">${HELP_STEPS.map(([title, body]) => `<li><strong>${esc(title)}</strong><span>${body}</span></li>`).join("")}</ol>
      <p class="ps-help">Keyboard: <b>Cmd/Ctrl+Z</b> undo · <b>Shift+Cmd/Ctrl+Z</b> redo · <b>Cmd/Ctrl+S</b> save now · <b>Esc</b> hides the side panels · with a block selected: <b>Alt+↑ / Alt+↓</b> move it, <b>Cmd/Ctrl+D</b> copy it, <b>Delete</b> removes it.</p></div>`;
    panel.hidden = false;
    paintCanvas();
  }
  const TOUR = [
    [".sb-left .sb-tabs", "Pages, Blocks, Theme and Menus live here. Start by opening a page in Pages."],
    ["#sbFrameWrap", "This is the real page. Click words to type over them, click a photo to change it, and use + Add block to add more."],
    [".sb-right", "The block you clicked shows here: its words, its layout and its Design (colours, background, fonts)."],
    ["#sbUndo", "Undo and redo any change."],
    ["#sbStatus", "Your work saves by itself. This says when it last saved."],
    ["#sbPublishBtn", "When the page looks right, Publish puts it on the website. Every publish keeps a version you can bring back."]
  ];
  function runTour(step = 0) {
    document.querySelectorAll(".sb-tour-target").forEach(el => el.classList.remove("sb-tour-target"));
    $("#sbTour")?.remove();
    if (!sb || step >= TOUR.length) return;
    if (sb.panel) { sb.panel = null; paintCanvas(); }
    sb.left = true; sb.right = true; paintRails();
    const [selector, words] = TOUR[step];
    const target = $(selector);
    if (!target || target.offsetParent === null) { runTour(step + 1); return; }
    target.classList.add("sb-tour-target");
    const r = target.getBoundingClientRect();
    const bubble = document.createElement("div");
    bubble.id = "sbTour"; bubble.className = "sb-tour"; bubble.setAttribute("role", "dialog");
    bubble.innerHTML = `<b>Step ${step + 1} of ${TOUR.length}</b><p>${S().esc(words)}</p><div><button type="button" data-tour="end">End the tour</button><button type="button" class="go" data-tour="next">${step + 1 === TOUR.length ? "Done" : "Next"}</button></div>`;
    document.body.appendChild(bubble);
    const w = bubble.offsetWidth, h = bubble.offsetHeight;
    const below = r.bottom + h + 16 < window.innerHeight;
    bubble.style.top = `${Math.max(8, below ? r.bottom + 10 : Math.min(window.innerHeight - h - 8, r.top + 20))}px`;
    bubble.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    bubble.addEventListener("click", e => { const t = e.target.closest("[data-tour]")?.dataset.tour; if (t === "next") runTour(step + 1); else if (t === "end") runTour(TOUR.length); });
    bubble.querySelector(".go").focus();
  }

  // ───────────────────────── clicks ─────────────────────────
  async function onClick(event) {
    if (!sb) return;
    const { toast, api, modal, esc } = S();
    const target = event.target;
    const device = target.closest("[data-sb-device]"); if (device) { sb.device = device.dataset.sbDevice; paintTop(); paintCanvas(); return; }
    const tab = target.closest("[data-sb-tab]"); if (tab) { sb.leftTab = tab.dataset.sbTab; sb.left = true; if (sb.leftTab !== "blocks") sb.insertAt = null; paintTop(); paintLeft(); paintRails(); return; }
    const rtab = target.closest("[data-sb-rtab]"); if (rtab) { sb.rightTab = rtab.dataset.sbRtab; sb.right = true; paintTop(); paintRight(); paintRails(); return; }
    const pageRow = target.closest("[data-sb-page]"); if (pageRow) { if (pageRow.dataset.type === "trainer") { sb.panel = null; openTrainer(pageRow.dataset.sbPage.slice(8)).catch(e => toast(e.message, 5000)); return; } if (pageRow.dataset.type === "ad") { closeStudio(); window.LDTT_PAGE_STUDIO.open(pageRow.dataset.sbPage).catch(e => toast(e.message)); return; } sb.panel = null; try { await openPage(pageRow.dataset.sbPage); } catch (e) { toast(e.message, 5000); } return; }
    const addBtn = target.closest("[data-sb-addblock]"); if (addBtn) { if (!sb.draft) { toast("Open a page first."); return; } addBlock(addBtn.dataset.sbAddblock); return; }
    const photo = target.closest("[data-sb-photo]"); if (photo) { const t = targetFor(photo.dataset.sbPhoto); if (t.kind === "page") pushHistory(); setPath(t.root, t.path, photo.dataset.src); if (t.kind === "page") markDirty({ rerail: true }); else { paintLeft(); repaintCanvas(); } return; }
    const richBtn = target.closest("[data-sb-rich]"); if (richBtn) { const ed = richBtn.closest(".ps-field")?.querySelector("[data-sb-richfield]"); if (ed) richCommand(richBtn.dataset.sbRich, ed); return; }
    const status = target.closest("#sbStatus"); if (status && sb.status === "error") { flushSave(); return; }
    const starter = target.closest("[data-sb-starter]"); if (starter) { newPagePick(starter.dataset.sbStarter); return; }
    const btn = target.closest("[data-sb-act]"); if (!btn) return;
    const act = btn.dataset.sbAct; const index = Number(btn.dataset.index);
    switch (act) {
      case "close": closeStudio(); return;
      case "help": openHelp(); return;
      case "tour": runTour(0); return;
      case "dup-page": duplicatePage(btn.dataset.id); return;
      case "sec": secAction(btn.dataset.tool, btn.dataset.sec); return;
      case "classic-trainer": openClassicTrainerEditor(); return;
      case "pick-photo": openPhotoPicker(btn.dataset.path); return;
      case "set-field": { const t = targetFor(btn.dataset.path); if (t.kind === "page") pushHistory(true); setPath(t.root, t.path, btn.dataset.value || ""); if (t.kind === "page") markDirty({ rerail: true }); else { paintLeft(); repaintCanvas(); } return; }
      case "layout": { const b = sb.draft?.blocks[index]; if (!b) return; pushHistory(true); b.layout = btn.dataset.layout; markDirty({ rerail: true }); return; }
      case "design-reset": { const b = sb.draft?.blocks[index]; if (!b) return; pushHistory(true); b.design = T.blankBlock(b.type).design; toast("This block's design is back to normal."); markDirty({ rerail: true }); return; }
      case "clear-field": { const t = targetFor(btn.dataset.path); if (t.kind === "page") pushHistory(true); setPath(t.root, t.path, ""); if (t.kind === "page") markDirty({ rerail: true }); else { paintLeft(); repaintCanvas(); } return; }
      case "scheme": { const s = T.COLOR_SCHEMES.find(x => x.id === btn.dataset.scheme); if (!s) return; const t = sb.themeDraft || (sb.themeDraft = S().clone(siteCache.theme)); t.colors = { ...s.colors }; paintLeft(); repaintCanvas(); toast(`${s.label}: on the canvas now. Press Save site theme to keep it for every page.`, 5000); return; }
      case "logo-size-reset": { const t = sb.themeDraft || (sb.themeDraft = S().clone(siteCache.theme)); t.logoWidth = ""; paintLeft(); repaintCanvas(); return; }
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
        try { btn.disabled = true; await flushSave(); if (sb.kind === "trainer") { const t = currentTrainer(); const href = t && portalHas("trainerPageHref") ? trainerPageHref(t) : ""; if (!href || !window.open(`${href}${href.includes("?") ? "&" : "?"}preview=1`, "_blank")) throw new Error("Your browser blocked the preview window. Allow pop-ups for this site."); return; } const data = await api({ operation: "preview", page_type: sb.kind === "ad2" ? "ad2" : sb.draft.pageType, content: sb.draft }); const w = window.open("", "_blank"); if (!w) throw new Error("Your browser blocked the preview window. Allow pop-ups for this site."); w.document.open(); w.document.write(data.html); w.document.close(); } catch (e) { toast(e.message, 5000); } finally { btn.disabled = false; }
        return;
      }
      case "publish": publishFlow(); return;
      case "more": { const m = modal(`<h3>More</h3><div class="ps-actions" style="flex-direction:column"><button type="button" class="ps-btn" data-x="page">Page settings, history and versions</button>${sb.kind === "ad2" ? `<button type="button" class="ps-btn" data-x="classic">Open this page in the old 2.0 editor</button>` : ""}${sb.kind === "trainer" ? `<button type="button" class="ps-btn" data-x="classic-trainer">Open this page in the classic Page Editor</button>` : ""}${sb.kind !== "trainer" && (sb.revisions || []).some(r => r.kind === "published") ? `<button type="button" class="ps-btn" data-x="discard">Throw away my changes (back to the published page)</button>` : ""}${sb.kind !== "trainer" && sb.page.status === "published" ? `<button type="button" class="ps-btn" data-x="unpublish">Take this page offline</button>` : ""}${sb.kind === "trainer" ? "" : `<button type="button" class="ps-btn" style="color:#b00020;border-color:#f1c2ca" data-x="archive">Remove this page</button>`}<button type="button" class="ps-btn" data-x="close">Cancel</button></div>`); m.addEventListener("click", e => { const x = e.target.closest("[data-x]")?.dataset.x; if (!x) return; m.remove(); if (x === "page") { sb.rightTab = "page"; sb.right = true; paintTop(); paintRight(); paintRails(); } else if (x === "discard") discardToPublished(); else if (x === "unpublish") unpublish(); else if (x === "archive") archive(); else if (x === "classic-trainer") openClassicTrainerEditor(); else if (x === "classic") { const id = sb.pageId; flushSave().then(() => { closeStudio(); window.LDTT_AD2_STUDIO?.open(id, { classic: true }).catch(e => toast(e.message, 6000)); }); } }); return; }
      case "unpublish": unpublish(); return;
      case "archive": archive(); return;
      case "snapshot": try { await saveDraft({ snapshot: true }); toast("Version saved."); await refreshRevisions(); paintRight(); } catch (e) { toast(e.message); } return;
      case "restore": {
        try { btn.disabled = true; const data = await api({ operation: "restore", id: sb.pageId, revision_id: btn.dataset.rev }); pushHistory(); sb.draft = normalizeDraft(data.content); sb.draftRevision = Number(data.draft_revision || sb.draftRevision + 1); sb.savedJson = draftJson(); sb.status = "saved"; sb.savedAt = new Date().toISOString(); sb.selectedId = null; paintAll(); toast(data.message || "Version restored into the draft."); } catch (e) { btn.disabled = false; toast(e.message); }
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
    if (sb.kind === "trainer") { publishTrainer(); return; }
    const isA2 = sb.kind === "ad2";
    const result = isA2 ? A2().publishChecklist(sb.draft) : T.sitePublishChecklist(sb.draft, { html: T.renderSitePage(sb.draft, { base: "/", publicPath: `/${sb.draft.slug}`, siteTheme: siteCache.theme, navigation: siteCache.nav, data: siteCache.data }) });
    const list = `<div class="ps-checklist">${result.checks.map(c => `<div class="ps-check ${c.ok ? "ok" : "bad"}">${esc(c.ok ? (c.label || c.name) : c.fix)}</div>`).join("")}</div>`;
    if (!result.ok) {
      modal(`<h3>Not published yet — ${result.failures.length} thing${result.failures.length === 1 ? "" : "s"} to fix</h3><p class="ps-help">Nothing changed on the live site. Fix these and press Publish again.</p>${list}<div class="ps-actions"><button type="button" class="ps-btn navy" data-ps-close>OK</button></div>`).querySelector("[data-ps-close]").addEventListener("click", e => e.target.closest(".ps-modal").remove());
      return;
    }
    const inNav = (siteCache.nav.header.links.length ? siteCache.nav : T.normalizeNav(T.STATIC_NAV)).header.links.some(l => l.href === `/${sb.draft.slug}`);
    const m = modal(`<h3>Publish this page?</h3><p class="ps-help">${isA2 ? `It shows at <b>/ads/${esc(sb.draft.slug)}</b>${window.LDTT_IS_SANDBOX ? " on the practice copy" : ""} within about a minute.` : `It goes live at <b>/${esc(sb.draft.slug)}</b> (and /p/${esc(sb.draft.slug)}) within about a minute.`} The previous version is kept under History.</p>${list}${!inNav && sb.draft.pageType === "site" ? `<label class="ps-field inline"><input type="checkbox" data-add-nav checked><span>Also add it to the header menu</span></label>` : ""}<div class="ps-actions"><button type="button" class="ps-btn" data-ps-close>Not yet</button><button type="button" class="ps-btn red" data-ps-go>Publish now</button></div>`);
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
    const dupPages = (store.pages || []).filter(p => p.page_type && p.page_type !== "ad" && p.page_type !== "ad2");
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
    const index = sb.draft ? (sb.draft.blocks || []).findIndex(b => b.id === sb.selectedId) : -1;
    if (index === -1) return;
    if (event.altKey && event.key === "ArrowUp") { event.preventDefault(); blockAction("up", index); }
    else if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); blockAction("down", index); }
    else if (event.key === "Delete") { event.preventDefault(); blockAction("remove", index); } // not Backspace: right after typing it must only fix the typing
    else if (meta && event.key.toLowerCase() === "d") { event.preventDefault(); blockAction("duplicate", index); }
  }
  document.addEventListener("keydown", event => { if (sb && !document.querySelector("#psOverlay")) onKeys(event); }, true);

  // ───────────────────────── wiring into the portal ─────────────────────────
  document.addEventListener("click", async event => {
    const t = event.target;
    const open = t.closest("[data-sb-open]");
    if (open) {
      // "current" = the page on the Page Editor's screen: a trainer page opens as itself, anything else opens the page list.
      let what = open.dataset.sbOpen || "";
      if (what === "current") {
        try {
          const main = String(state.builderMainPage || "").replace(/[?#].*$/, "");
          what = state.builderSurface === "trainer" && state.selectedTrainerId ? `trainer:${state.selectedTrainerId}`
            : state.builderSurface === "site" && main ? `slug:${main.replace(/^\/(ads\/)?/, "").replace(/\.html$/, "") || "index"}` : "";
        } catch { what = ""; }
      }
      openStudio(what);
      return;
    }
    const studio = t.closest("[data-sb-studio]"); if (studio) { openStudio(studio.dataset.sbStudio || ""); return; }
    if (t.closest("[data-sb-new]")) { openStudio("new"); return; }
    const dup = t.closest("[data-sb-duplicate]"); if (dup) { await openStudio(""); if (sb) { sb.newPick = `dup:${dup.dataset.sbDuplicate}`; openNewPanel(); } return; }
    const upload = t.closest("[data-sb-upload]");
    if (upload) return;
  });
  document.addEventListener("change", event => {
    const input = event.target.closest?.("[data-sb-upload]");
    if (input && sb && input.files?.[0]) { uploadFile(input.files[0], input.dataset.sbUpload).catch(e => S().toast(e.message, 6000)); input.value = ""; }
    const big = event.target.closest?.("[data-sb-bigupload]");
    if (big && sb && big.files?.[0]) { uploadBig(big.files[0], big.dataset.sbBigupload, big.dataset.kind || "photo").catch(e => S().toast(e.message, 6000)); big.value = ""; }
  });
  window.addEventListener("beforeunload", event => { if (sb && (sb.status === "dirty" || sb.status === "saving" || sb.status === "error")) { event.preventDefault(); event.returnValue = ""; } });
  window.addEventListener("resize", () => { if (!sb) return; if (window.innerWidth < 900 && sb.left && sb.right) { sb.right = false; paintRails(); } else fitFrame(); });

  window.LDTT_SITE_BUILDER = { open: openStudio, close: closeStudio, state: () => sb };
})();
