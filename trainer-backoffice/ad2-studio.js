// Page Studio: the full-screen editor for the Ad landing pages 2.0 (page_type "ad2"). DO-NOT-BREAK rule 85.
// Joshua 2026-09-14: "make them available in the sandbox, both in the dropdown and in Page Studio"; meeting
// 2026-09-11: "Add the 2.0 pages into Page Studio so Arrison can edit them herself."
//
// Left: the page's words, photos, videos, reviews and states, section by section. Right: the page itself, drawn by
// the SAME template the site serves (lib/ad2-page-template.js), updated as you type. Saves on its own (save_draft),
// Publish shows it at /ads/<slug> on the practice copy. The preview's form sends nothing.
// Uses Page Studio's helpers (window.LDTT_PAGE_STUDIO.shared): the API, toasts, dialogs and the template loader.
(function () {
  "use strict";
  const PS = () => window.LDTT_PAGE_STUDIO?.shared || null;
  let T = null;
  let ed = null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function ready() {
    const s = PS();
    if (!s) throw new Error("Page Studio did not load. Refresh the page and try again.");
    s.loadCss();
    await s.ensureTemplate();
    T = window.LDTT_AD2_PAGE_TEMPLATE;
    if (!T) throw new Error("The 2.0 page template did not load. Refresh the page and try again.");
    return s;
  }

  // ───────────────────────── open / close ─────────────────────────
  // Site Builder 2.0 (Joshua 2026-09-15: one editor): a 2.0 page opens in the Site Builder. This old editor stays
  // reachable from the Site Builder's More menu (open(id, { classic: true })).
  async function open(pageId, { classic = false } = {}) {
    if (!classic && window.LDTT_SITE_BUILDER) return window.LDTT_SITE_BUILDER.open(pageId);
    const s = await ready();
    const data = await s.api({ operation: "get", id: pageId });
    const page = data.page;
    if (page.page_type !== "ad2") return window.LDTT_PAGE_STUDIO.open(pageId);
    const draft = T.normalizeContent(page.draft_content || {});
    let local = null;
    try { local = JSON.parse(localStorage.getItem(`a2-draft-${page.id}`) || "null"); } catch { local = null; }
    if (local && local.draft_revision === page.draft_revision && JSON.stringify(T.normalizeContent(local.content)) !== JSON.stringify(draft)
      && window.confirm("You have unsaved changes for this page from earlier in this browser. Put them back?")) {
      Object.assign(draft, T.normalizeContent(local.content));
    }
    if (ed) close(true);
    ed = { id: page.id, page, draft, savedJson: JSON.stringify(draft), draftRevision: Number(page.draft_revision || 1), status: "saved", section: "top", device: "desktop", saving: null, timer: null, previewTimer: null };
    mount();
    if (JSON.stringify(draft) !== ed.savedJson) scheduleSave();
  }

  async function close(silent = false) {
    if (!ed) return;
    if (!silent) await flushSave();
    document.getElementById("a2Overlay")?.remove();
    document.body.classList.remove("a2-open");
    document.removeEventListener("keydown", onKeys);
    ed = null;
    if (!silent) { const s = PS(); if (s) { s.store.pages = null; window.LDTT_PAGE_STUDIO.reload?.(); } }
  }

  // ───────────────────────── drawing the editor ─────────────────────────
  function mount() {
    const overlay = document.createElement("div");
    overlay.id = "a2Overlay";
    overlay.className = "a2-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Edit a 2.0 ad page");
    overlay.innerHTML = shellHtml();
    document.body.appendChild(overlay);
    document.body.classList.add("a2-open");
    overlay.addEventListener("click", onClick);
    overlay.addEventListener("input", onInput);
    overlay.addEventListener("change", onChange);
    document.addEventListener("keydown", onKeys);
    paintFields();
    renderPreview();
  }

  function shellHtml() {
    const p = ed.page;
    const published = p.status === "published";
    return `<header class="a2-top">
        <div class="a2-title">
          <span class="ps-pill ${published ? "published" : "draft"}" data-a2-pill>${published ? "Live" : "Draft"}</span>
          <span class="ps-pill static">Ad page 2.0</span>
          <strong data-a2-name>${esc(ed.draft.market || ed.draft.slug)}</strong>
          <span class="a2-addr" data-a2-addr>/ads/${esc(ed.draft.slug)}</span>
          <span class="a2-save" data-a2-status role="status" aria-live="polite">Saved</span>
        </div>
        <div class="a2-actions">
          <div class="a2-seg" role="group" aria-label="Preview size"><button type="button" class="active" data-a2-device="desktop">Computer</button><button type="button" data-a2-device="mobile">Phone</button></div>
          <a class="ps-btn" data-a2-live href="/ads/${esc(p.slug)}" target="_blank" rel="noopener" ${published ? "" : "hidden"}>Open live page</a>
          <button type="button" class="ps-btn" data-a2-unpublish ${published ? "" : "hidden"}>Take offline</button>
          <button type="button" class="ps-btn red" data-a2-publish>Publish</button>
          <button type="button" class="ps-btn navy" data-a2-close>Close</button>
        </div>
      </header>
      <div class="a2-body">
        <aside class="a2-rail">
          <nav class="a2-tabs" aria-label="Page sections" data-a2-tabs></nav>
          <div class="a2-fields" data-a2-fields></div>
        </aside>
        <main class="a2-canvas"><div class="a2-frame-wrap" data-a2-wrap><iframe title="Live preview of the page" data-a2-frame sandbox="allow-scripts allow-same-origin allow-popups"></iframe></div></main>
      </div>`;
  }

  const sectionsFor = design => T.SECTIONS.filter(sec => T.FIELDS.some(f => f.section === sec.id && f.designs.includes(design)));

  function paintFields() {
    const root = document.getElementById("a2Overlay");
    if (!root) return;
    const design = ed.draft.design;
    const sections = sectionsFor(design);
    if (!sections.some(sec => sec.id === ed.section)) ed.section = sections[0].id;
    root.querySelector("[data-a2-tabs]").innerHTML = sections.map(sec => `<button type="button" class="${sec.id === ed.section ? "active" : ""}" data-a2-section="${sec.id}" aria-pressed="${sec.id === ed.section}">${esc(sec.label)}</button>`).join("");
    const design3 = T.DESIGNS.find(x => x.id === design)?.label || design;
    const fields = T.FIELDS.filter(f => f.section === ed.section && f.designs.includes(design)).map(fieldHtml).join("");
    root.querySelector("[data-a2-fields]").innerHTML = `<p class="ps-help a2-design">${esc(design3)}</p>${fields}`;
  }

  function fieldHtml(f) {
    const d = ed.draft;
    const v = d[f.key];
    if (f.kind === "text") return `<label class="ps-field"><span>${esc(f.label)}</span><input type="text" data-a2-key="${f.key}" maxlength="${f.max}" value="${esc(v)}"></label>`;
    if (f.kind === "area") return `<label class="ps-field"><span>${esc(f.label)}</span><textarea data-a2-key="${f.key}" maxlength="${f.max}" rows="4">${esc(v)}</textarea></label>`;
    if (f.kind === "lines") return `<fieldset class="a2-group"><legend>${esc(f.label)}</legend>${v.map((line, i) => `<input type="text" data-a2-key="${f.key}" data-a2-i="${i}" maxlength="${f.max}" value="${esc(line)}" aria-label="${esc(f.label)}, line ${i + 1}">`).join("")}</fieldset>`;
    if (f.kind === "pairs") return `<fieldset class="a2-group"><legend>${esc(f.label)}</legend>${v.map((item, i) => `<div class="a2-pair"><span class="a2-num">${i + 1}</span><input type="text" data-a2-key="vids" data-a2-i="${i}" data-a2-part="t" maxlength="${f.max}" value="${esc(item.t)}" aria-label="Video ${i + 1} title">${d.design === "d3" ? "" : `<input type="text" data-a2-key="vids" data-a2-i="${i}" data-a2-part="s" maxlength="${f.max2}" value="${esc(item.s)}" aria-label="Video ${i + 1} line">`}</div>`).join("")}<p class="ps-help">The play buttons open real LDTT videos. The titles are yours.</p></fieldset>`;
    if (f.kind === "reviews") return `<fieldset class="a2-group"><legend>${esc(f.label)}</legend>${v.map((r, i) => `<div class="a2-review"><span class="a2-num">${i + 1}</span><input type="text" data-a2-key="reviews" data-a2-i="${i}" data-a2-part="name" maxlength="${f.max}" value="${esc(r.name)}" aria-label="Review ${i + 1} name"><textarea data-a2-key="reviews" data-a2-i="${i}" data-a2-part="text" maxlength="${f.max2}" rows="3" aria-label="Review ${i + 1} words">${esc(r.text)}</textarea></div>`).join("")}<p class="ps-help">Use real Google reviews only.</p></fieldset>`;
    if (f.kind === "states") {
      const on = new Set(v);
      return `<fieldset class="a2-group"><legend>${esc(f.label)} · <b data-a2-state-count>${v.length}</b> ticked</legend><div class="a2-states">${T.ALL_STATES.map(name => `<label><input type="checkbox" data-a2-state="${esc(name)}" ${on.has(name) ? "checked" : ""}> ${esc(name)}</label>`).join("")}</div><p class="ps-help">The map, the state list and every "states" number follow these ticks.</p></fieldset>`;
    }
    if (f.kind === "photos") {
      return (T.PHOTO_SLOTS[d.design] || []).map(([key, label, file]) => {
        const url = d.photos[key];
        return `<div class="a2-photo"><img src="${esc(url)}" alt="" loading="lazy"><div><strong>${esc(label)}</strong>
          <input type="text" data-a2-photo="${key}" value="${esc(url)}" aria-label="${esc(label)} address">
          <div class="a2-photo-actions"><label class="ps-btn a2-upload">Upload<input type="file" accept="image/jpeg,image/png,image/webp" data-a2-upload="${key}" hidden></label>${url === T.A + file ? "" : `<button type="button" class="ps-btn" data-a2-photo-reset="${key}">Use the original</button>`}</div></div></div>`;
      }).join("") + `<p class="ps-help">JPG, PNG or WEBP, up to 4 MB. Uploads go to the practice copy's own photo storage.</p>`;
    }
    return "";
  }

  function paintTop() {
    const root = document.getElementById("a2Overlay");
    if (!root) return;
    root.querySelector("[data-a2-name]").textContent = ed.draft.market || ed.draft.slug;
    root.querySelector("[data-a2-addr]").textContent = `/ads/${ed.draft.slug}`;
    const published = ed.page.status === "published";
    root.querySelector("[data-a2-pill]").textContent = published ? "Live" : "Draft";
    root.querySelector("[data-a2-pill]").className = `ps-pill ${published ? "published" : "draft"}`;
    const live = root.querySelector("[data-a2-live]");
    live.hidden = !published; live.href = `/ads/${ed.page.slug}`;
    root.querySelector("[data-a2-unpublish]").hidden = !published;
  }

  function setStatus(text, kind = "") {
    const el = document.querySelector("[data-a2-status]");
    if (el) { el.textContent = text; el.dataset.kind = kind; }
  }

  // ───────────────────────── preview ─────────────────────────
  function renderPreview() {
    const frame = document.querySelector("[data-a2-frame]");
    if (!frame || !ed) return;
    let y = 0;
    try { y = frame.contentWindow?.scrollY || 0; } catch { y = 0; }
    const html = T.renderPage(ed.draft, { practice: Boolean(window.LDTT_IS_SANDBOX), preview: true, base: `${location.origin}/` });
    frame.onload = () => { try { frame.contentWindow.scrollTo(0, y); } catch { /* cross-origin never happens here */ } };
    frame.srcdoc = html;
  }
  const schedulePreview = () => { clearTimeout(ed.previewTimer); ed.previewTimer = setTimeout(renderPreview, 250); };

  // ───────────────────────── saving ─────────────────────────
  function scheduleSave() {
    if (!ed) return;
    ed.status = "dirty";
    setStatus("Saving soon…");
    try { localStorage.setItem(`a2-draft-${ed.id}`, JSON.stringify({ draft_revision: ed.draftRevision, content: ed.draft })); } catch { /* private mode */ }
    clearTimeout(ed.timer);
    ed.timer = setTimeout(() => { save().catch(() => {}); }, 1200);
  }

  async function save() {
    if (!ed) return;
    const json = JSON.stringify(ed.draft);
    if (json === ed.savedJson) { setStatus("Saved"); return; }
    if (ed.saving) { await ed.saving; return save(); }
    const s = PS();
    const current = ed;
    setStatus("Saving…");
    current.saving = s.api({ operation: "save_draft", id: current.id, content: current.draft })
      .then(data => {
        current.savedJson = json;
        current.draftRevision = Number(data.draft_revision || current.draftRevision + 1);
        current.page.slug = data.page?.slug || current.page.slug;
        try { localStorage.removeItem(`a2-draft-${current.id}`); } catch { /* private mode */ }
        if (ed === current) { setStatus(`Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`, "ok"); paintTop(); }
      })
      .catch(error => { if (ed === current) setStatus("Not saved", "bad"); s.toast(error.message, 6000); throw error; })
      .finally(() => { current.saving = null; });
    return current.saving;
  }

  async function flushSave() {
    if (!ed) return;
    clearTimeout(ed.timer);
    try { await save(); } catch { /* the toast already said why */ }
  }

  // ───────────────────────── events ─────────────────────────
  function onInput(event) {
    const t = event.target;
    if (t.matches("[data-a2-key]")) {
      const key = t.dataset.a2Key;
      const i = t.dataset.a2I !== undefined ? Number(t.dataset.a2I) : null;
      const part = t.dataset.a2Part;
      if (i === null) ed.draft[key] = t.value;
      else if (part) ed.draft[key][i] = { ...ed.draft[key][i], [part]: t.value };
      else ed.draft[key][i] = t.value;
      if (key === "market") paintTop();
      schedulePreview(); scheduleSave();
      return;
    }
    if (t.matches("[data-a2-photo]")) {
      const url = T.photoUrl(t.value);
      t.setAttribute("aria-invalid", url || !t.value.trim() ? "false" : "true");
      if (url) { ed.draft.photos[t.dataset.a2Photo] = url; schedulePreview(); scheduleSave(); }
    }
  }

  async function onChange(event) {
    const t = event.target;
    if (t.matches("[data-a2-state]")) {
      const name = t.dataset.a2State;
      const list = ed.draft.states.filter(x => x !== name);
      if (t.checked) {
        if (list.length >= T.MAX_STATES) { t.checked = false; PS().toast(`The map has room for ${T.MAX_STATES} states. Untick one first.`); return; }
        list.push(name);
      }
      ed.draft.states = list; // the office's order: states already on the page first, a new tick at the end
      const count = document.querySelector("[data-a2-state-count]"); if (count) count.textContent = String(ed.draft.states.length);
      schedulePreview(); scheduleSave();
      return;
    }
    if (t.matches("[data-a2-upload]")) {
      const file = t.files?.[0];
      if (!file) return;
      const s = PS();
      if (file.size > 4 * 1024 * 1024) { s.toast("That photo is bigger than 4 MB. Make it smaller and try again.", 5000); return; }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { s.toast("Upload a JPG, PNG or WEBP photo.", 5000); return; }
      setStatus("Uploading…");
      try {
        const data64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error("The photo could not be read.")); r.readAsDataURL(file); });
        const result = await s.api({ operation: "upload", type: file.type, name: file.name, data: data64 });
        const url = T.photoUrl(result.url);
        if (!url) throw new Error("The upload answered with an address the page cannot use.");
        ed.draft.photos[t.dataset.a2Upload] = url;
        paintFields(); renderPreview(); scheduleSave();
        s.toast(result.message || "Uploaded.");
      } catch (error) { setStatus("Upload failed", "bad"); s.toast(error.message, 6000); }
    }
  }

  async function onClick(event) {
    const t = event.target.closest("button, a");
    if (!t) return;
    const s = PS();
    if (t.dataset.a2Section) { ed.section = t.dataset.a2Section; paintFields(); return; }
    if (t.dataset.a2Device) {
      ed.device = t.dataset.a2Device;
      document.querySelectorAll("[data-a2-device]").forEach(b => b.classList.toggle("active", b === t));
      document.querySelector("[data-a2-wrap]").classList.toggle("is-phone", ed.device === "mobile");
      return;
    }
    if (t.dataset.a2PhotoReset) {
      const slot = (T.PHOTO_SLOTS[ed.draft.design] || []).find(x => x[0] === t.dataset.a2PhotoReset);
      if (slot) { ed.draft.photos[slot[0]] = T.A + slot[2]; paintFields(); renderPreview(); scheduleSave(); }
      return;
    }
    if (t.hasAttribute("data-a2-close")) { await close(); return; }
    if (t.hasAttribute("data-a2-publish")) { await publish(); return; }
    if (t.hasAttribute("data-a2-unpublish")) {
      if (!window.confirm("Take this page offline? Visitors get a not-found page. The words stay saved.")) return;
      try { const data = await s.api({ operation: "unpublish", id: ed.id }); ed.page.status = "draft"; paintTop(); s.toast(data.message || "The page is offline."); }
      catch (error) { s.toast(error.message, 6000); }
    }
  }

  function onKeys(event) {
    if (event.key === "Escape" && ed && !document.querySelector(".ps-modal")) close();
  }

  async function publish() {
    const s = PS();
    await flushSave();
    if (!ed) return;
    const check = T.publishChecklist(ed.draft);
    if (!check.ok) {
      const m = s.modal(`<h3>Fix these first</h3><div class="ps-checklist">${check.failures.map(f => `<div class="ps-check bad">${esc(f.fix)}</div>`).join("")}</div><div class="ps-actions"><button type="button" class="ps-btn navy" data-ps-close>OK</button></div>`);
      m.querySelector("[data-ps-close]").addEventListener("click", () => m.remove());
      return;
    }
    const where = window.LDTT_IS_SANDBOX ? "on the practice copy" : "on the live site";
    if (!window.confirm(`Publish this page ${where}? It shows at /ads/${ed.draft.slug} within a minute.`)) return;
    setStatus("Publishing…");
    try {
      const data = await s.api({ operation: "publish", id: ed.id, content: ed.draft });
      ed.page.status = "published"; ed.page.slug = ed.draft.slug; ed.savedJson = JSON.stringify(ed.draft);
      paintTop(); setStatus("Published", "ok");
      const m = s.modal(`<h3>Published</h3><p class="ps-help">${esc(data.message || "The page is live.")}</p><div class="ps-actions"><a class="ps-btn navy" href="${esc(data.url || `/ads/${ed.draft.slug}`)}" target="_blank" rel="noopener" style="text-decoration:none">Open the page</a><button type="button" class="ps-btn" data-ps-close>Keep editing</button></div>`);
      m.querySelector("[data-ps-close]").addEventListener("click", () => m.remove());
    } catch (error) {
      setStatus("Not published", "bad");
      const fails = error.data?.checklist?.failures || [];
      const m = s.modal(`<h3>Not published</h3><p class="ps-help">${esc(error.message)}</p>${fails.length ? `<div class="ps-checklist">${fails.map(f => `<div class="ps-check bad">${esc(f.fix)}</div>`).join("")}</div>` : ""}<div class="ps-actions"><button type="button" class="ps-btn navy" data-ps-close>OK</button></div>`);
      m.querySelector("[data-ps-close]").addEventListener("click", () => m.remove());
    }
  }

  // ───────────────────────── new / duplicate / add the three ─────────────────────────
  async function createFrom(content, s) {
    const data = await s.api({ operation: "create", page_type: "ad2", content });
    s.store.pages = null;
    return data.page;
  }

  async function newPage() {
    const s = await ready();
    const starters = T.STARTERS.map(x => `<option value="${esc(x.slug)}">${esc(x.market)} · ${esc(T.DESIGNS.find(d => d.id === x.design)?.label || x.design)}</option>`).join("");
    const m = s.modal(`<h3>New 2.0 ad page</h3><p class="ps-help">Start from one of the three 2.0 pages. You change every word and photo after.</p>
      <label class="ps-field"><span>Start from</span><select name="starter">${starters}</select></label>
      <label class="ps-field"><span>Market name</span><input name="market" placeholder="Tallahassee, FL"></label>
      <label class="ps-field"><span>Web address</span><input name="slug" placeholder="tallahassee"></label>
      <p class="ps-help">The page will show at /ads/&lt;web address&gt;.</p>
      <div class="ps-actions"><button type="button" class="ps-btn" data-ps-close>Cancel</button><button type="button" class="ps-btn red" data-a2-go>Create page</button></div>`);
    m.querySelector("[data-ps-close]").addEventListener("click", () => m.remove());
    m.querySelector("[data-a2-go]").addEventListener("click", async event => {
      const get = name => m.querySelector(`[name="${name}"]`).value.trim();
      const market = get("market");
      const slug = get("slug") || market.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      if (!market || !slug) { s.toast("Type the market name and the web address."); return; }
      event.target.disabled = true; event.target.textContent = "Creating…";
      try { const page = await createFrom(T.fromStarter(get("starter"), { market, newSlug: slug }), s); m.remove(); s.toast("Page created on the practice copy."); await open(page.id); }
      catch (error) { event.target.disabled = false; event.target.textContent = "Create page"; s.toast(error.message, 6000); }
    });
  }

  async function duplicate(pageId) {
    const s = await ready();
    const data = await s.api({ operation: "get", id: pageId });
    const content = T.normalizeContent(data.page.draft_content || {});
    const slug = window.prompt("Web address for the copy", `${content.slug}-copy`);
    if (!slug) return;
    content.slug = slug;
    try { const page = await createFrom(content, s); s.toast("Copy created."); await open(page.id); } catch (error) { s.toast(error.message, 6000); }
  }

  // Puts the three 2.0 pages from 11 Sep into Page Studio (the ones that are not there yet).
  async function addTheThree(button) {
    const s = await ready();
    if (button) { button.disabled = true; button.textContent = "Adding…"; }
    const have = new Set((s.store.pages || []).map(p => p.slug));
    let made = 0;
    try {
      for (const starter of T.STARTERS) { if (!have.has(starter.slug)) { await createFrom(T.normalizeContent(starter), s); made += 1; } }
      s.toast(made ? `Added ${made} page${made === 1 ? "" : "s"}. They are drafts until you publish.` : "The three 2.0 pages are already here.");
    } catch (error) { s.toast(error.message, 6000); }
    window.LDTT_PAGE_STUDIO.reload?.();
  }

  document.addEventListener("click", event => {
    const hit = event.target.closest("[data-a2-open], [data-a2-new], [data-a2-duplicate], [data-a2-seed]");
    if (!hit || hit.closest("#a2Overlay")) return;
    const fail = error => PS()?.toast(error.message, 6000);
    if (hit.dataset.a2Open) { open(hit.dataset.a2Open).catch(fail); return; }
    if (hit.hasAttribute("data-a2-new")) { newPage().catch(fail); return; }
    if (hit.dataset.a2Duplicate) { duplicate(hit.dataset.a2Duplicate).catch(fail); return; }
    if (hit.hasAttribute("data-a2-seed")) addTheThree(hit).catch(fail);
  });

  window.LDTT_AD2_STUDIO = { open, close, newPage, duplicate, addTheThree, get isOpen() { return Boolean(ed); } };
})();
