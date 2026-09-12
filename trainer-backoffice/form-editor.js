// The lead form editor screen (portal chain step 4, Joshua 2026-09-12, DO-NOT-BREAK rule 75).
// Page Editor -> "Lead forms" (the third door next to Page Editor and Page Studio). Loaded after app.js by
// staff.html and trainer-backoffice/index.html; it uses app.js's panel(), escapeHtml(), render(), showToast(),
// portalActorName(), fullNameOrEmpty() and confirmSendToLive().
//
// Very simple on the surface: pick a form, change a question, Save, Publish on the practice copy, Send to live.
// Flexible underneath: add (9 answer types), remove (warning + name + log + undo), reorder, rename, required,
// dropdown / checkbox choices. Every typing box here carries a data-lf-* attribute that is on the portal's
// typedFieldKey() whitelist (rule 14), so a background redraw never eats what someone is typing.
(function () {
  "use strict";
  const S = { loaded: false, loading: false, error: "", data: null, selected: "contact", local: {}, dirty: {}, busy: false };
  const esc = value => escapeHtml(value == null ? "" : String(value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const CHOICE_TYPES = ["select", "checkboxes"];
  const fmt = iso => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  // The portal renews an expired sign-in token on its own first data request (rule 41). A screen that asks
  // before that renewal lands gets 401/403 with the old token, so it waits for the renewed token and asks again
  // (1 s, 2 s, 3 s). Same request every time, so a retried save is still one save.
  async function api(method, body) {
    let response;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      const token = await window.LDTT_PORTAL?.accessToken?.();
      response = await fetch(method === "GET" ? "/api/lead-forms?op=editor" : "/api/lead-forms", {
        method, cache: "no-store",
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token || ""}` },
        body: body ? JSON.stringify(body) : undefined
      });
      if (response.status !== 401 && response.status !== 403) break;
    }
    const payload = await response.json().catch(() => ({}));
    if (response.status === 404 && method === "GET") throw Object.assign(new Error("not_here"), { notHere: true });
    if (!response.ok || payload.ok === false) throw Object.assign(new Error(payload.message || `That did not save (${response.status}).`), { status: response.status });
    return payload;
  }

  // Take the server's answer. Forms with unsaved edits keep them unless `reset` names them.
  function accept(payload, reset = []) {
    S.data = payload;
    S.loaded = true;
    S.loading = false;
    S.error = "";
    reset.forEach(id => { S.dirty[id] = false; });
    payload.forms.forEach(form => {
      if (!S.dirty[form.id] || !S.local[form.id]) { S.local[form.id] = clone(form.draft); S.dirty[form.id] = false; }
    });
    if (!payload.forms.some(form => form.id === S.selected)) S.selected = payload.forms[0]?.id || "contact";
  }

  async function load() {
    if (S.loading) return;
    S.loading = true;
    try { accept(await api("GET")); }
    catch (error) { S.loading = false; S.loaded = true; S.data = null; S.error = error.notHere ? "not_here" : (error.message || "The forms did not load."); }
    render();
  }

  const formDef = id => S.data?.forms.find(form => form.id === id) || null;
  const fieldsOf = id => S.local[id] || (S.local[id] = clone(formDef(id)?.draft || []));
  const builtinOf = (form, key) => form.builtins.find(item => item.key === key) || null;
  const anyDirty = () => Object.values(S.dirty).some(Boolean);
  const myName = () => {
    try { return fullNameOrEmpty(portalActorName(portalUser)) || ""; } catch { return ""; }
  };

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------
  function previewHtml(form, fields) {
    const one = field => {
      const star = field.required ? ' <b class="lf-star">*</b>' : "";
      if (field.type === "consent") return `<label class="lf-p-consent"><input type="checkbox" disabled> <span>By checking this box, I agree to receive text messages from Lorenzo's Dog Training Team about my request… (the approved wording)</span></label>`;
      let control;
      if (field.type === "textarea") control = `<textarea disabled rows="2" placeholder="${esc(field.placeholder || "")}"></textarea>`;
      else if (field.type === "select") control = `<select disabled><option>Select one</option>${(field.choices || []).map(choice => `<option>${esc(choice)}</option>`).join("")}</select>`;
      else if (field.type === "checkboxes" || field.type === "yesno") control = `<span class="lf-p-choices">${(field.type === "yesno" ? ["Yes", "No"] : field.choices || []).map(choice => `<label><input type="${field.type === "yesno" ? "radio" : "checkbox"}" disabled> ${esc(choice)}</label>`).join("")}</span>`;
      else control = `<input disabled placeholder="${esc(field.placeholder || "")}">`;
      return `<label class="lf-p-field"><span>${esc(field.label)}${star}</span>${control}</label>`;
    };
    const shown = fields.filter(field => !field.removed);
    if (form.grouped) {
      return `<h5>About you</h5>${shown.filter(f => f.group !== "dog").map(one).join("") || "<p class=\"field-hint\">No questions.</p>"}<h5>About each dog (repeats per dog)</h5>${shown.filter(f => f.group === "dog").map(one).join("") || "<p class=\"field-hint\">No questions.</p>"}`;
    }
    return `${shown.map(one).join("")}<button class="btn btn-red" type="button" disabled>Submit</button>`;
  }

  function fieldRow(form, field, index, count) {
    const d = S.data;
    const b = builtinOf(form, field.key);
    const edit = d.can_edit;
    const labelBox = b?.lockLabel
      ? `<strong class="lf-fixed-label">${esc(field.label)}</strong>`
      : `<input type="text" class="lf-label-input" data-lf-label="${esc(field.key)}" value="${esc(field.label)}" maxlength="80" aria-label="Question wording" ${edit ? "" : "disabled"}>`;
    const typeBox = !field.builtin && edit
      ? `<select class="lf-type-select" data-lf-type="${esc(field.key)}" aria-label="Answer type">${Object.entries(d.types).map(([key, label]) => `<option value="${key}" ${key === field.type ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>`
      : `<span class="lf-type">${esc(field.type === "consent" ? "Texting consent" : d.types[field.type] || field.type)}</span>`;
    let choices = "";
    if (CHOICE_TYPES.includes(field.type)) {
      choices = b?.lockChoices
        ? `<p class="field-hint">Answers: ${esc((field.choices || []).join(" · "))}. Fixed, because Alpha needs these exact answers.</p>`
        : `<label class="lf-choices"><span>Choices people pick from, one per line</span><textarea data-lf-choices="${esc(field.key)}" rows="${Math.min(9, Math.max(3, (field.choices || []).length + 1))}" ${edit ? "" : "disabled"}>${esc((field.choices || []).join("\n"))}</textarea></label>${form.choice_notes[field.key] ? `<p class="lf-choice-note">${esc(form.choice_notes[field.key])}</p>` : ""}`;
    }
    const hint = !field.builtin && !CHOICE_TYPES.includes(field.type) && field.type !== "yesno" && edit
      ? `<label class="lf-placeholder"><span>Hint inside the box (optional)</span><input type="text" data-lf-placeholder="${esc(field.key)}" value="${esc(field.placeholder || "")}" maxlength="120"></label>`
      : "";
    const tags = [
      field.builtin ? `<em class="lf-tag">Built-in</em>` : `<em class="lf-tag lf-tag-new">Added question</em>`,
      b?.feeds ? `<em class="lf-tag lf-tag-feeds">${esc(b.feeds)}</em>` : "",
      b?.onlyOn ? `<em class="lf-tag">Only on ${esc(b.onlyOn)}</em>` : "",
      form.grouped ? `<em class="lf-tag">${field.group === "dog" ? "Each dog" : "About the client"}</em>` : ""
    ].join("");
    const required = b?.lockRequired
      ? `<span class="lf-req-fixed">Always optional</span>`
      : `<label class="lf-req"><input type="checkbox" data-lf-required="${esc(field.key)}" ${field.required ? "checked" : ""} ${edit ? "" : "disabled"}> Required</label>`;
    const move = edit ? `<div class="lf-move"><button type="button" class="lf-icon" data-lf-move="up" data-lf-key="${esc(field.key)}" ${index === 0 ? "disabled" : ""} aria-label="Move up" title="Move up">↑</button><button type="button" class="lf-icon" data-lf-move="down" data-lf-key="${esc(field.key)}" ${index === count - 1 ? "disabled" : ""} aria-label="Move down" title="Move down">↓</button></div>` : "";
    const remove = edit ? `<button type="button" class="btn btn-outline btn-small btn-danger-outline" data-lf-remove="${esc(field.key)}">Remove</button>` : "";
    return `<li class="lf-row" data-lf-row="${esc(field.key)}">${move}<div class="lf-row-main"><div class="lf-row-top">${labelBox}${typeBox}</div><div class="lf-tags">${tags}</div>${b?.lockLabel ? `<p class="field-hint">The texting consent wording is fixed by the Twilio approval (rule 47). You can move or remove the box, not reword it.</p>` : ""}${choices}${hint}</div><div class="lf-row-side">${required}${remove}</div></li>`;
  }

  function removedHtml(form, fields) {
    const removed = fields.filter(field => field.removed);
    if (!removed.length) return "";
    const d = S.data;
    return `<div class="lf-removed"><h4>Removed from this form</h4>${removed.map(field => {
      const entry = (d.log || []).find(item => item.action === "removed" && item.form === form.id && item.field_key === field.key && !item.undone_at);
      return `<div class="lf-removed-row"><div><strong>${esc(field.label)}</strong><small>${entry ? `Removed by ${esc(entry.by_name)} on ${esc(fmt(entry.at))}. ${esc(entry.effect || "")}` : "Removed."}</small></div>${d.can_edit ? `<button class="btn btn-outline btn-small" type="button" data-lf-restore="${esc(field.key)}" data-lf-form="${esc(form.id)}" data-lf-log="${esc(entry?.id || "")}">Undo: put it back</button>` : ""}</div>`;
    }).join("")}</div>`;
  }

  function logText(entry) {
    const what = {
      removed: `Removed "${entry.field_label}" from ${entry.form_label}. ${entry.effect || ""}`,
      restored: `Put "${entry.field_label}" back on ${entry.form_label}.`,
      published: `Published ${(entry.form_labels || []).join(", ") || "the forms"} (revision ${entry.revision || ""}).`,
      discarded: `Threw away the unpublished changes of ${entry.form_label}.`,
      reset: `Put ${entry.form_label} back to the original questions.`,
      sent_from_practice: entry.note || "Sent from the practice copy."
    }[entry.action] || entry.action;
    const undone = entry.undone_at ? ` <em class="lf-undone">Undone by ${esc(entry.undone_by || "office staff")} on ${esc(fmt(entry.undone_at))}.</em>` : "";
    return `${esc(what)}${entry.via ? ` <em class="lf-undone">(on the practice copy)</em>` : ""}${undone}`;
  }

  function logHtml() {
    const d = S.data;
    const rows = (d.log || []).slice(0, 60);
    if (!rows.length) return `<p class="panel-copy">No changes yet. Every removal, undo, publish and send is listed here with who did it.</p>`;
    return `<div class="table-wrap"><table class="lf-log-table"><thead><tr><th>When</th><th>Who</th><th>What</th><th></th></tr></thead><tbody>${rows.map(entry => {
      const stillRemoved = entry.action === "removed" && !entry.undone_at && (S.local[entry.form] || []).some(field => field.key === entry.field_key && field.removed);
      const undo = d.can_edit && stillRemoved ? `<button class="btn btn-outline btn-small" type="button" data-lf-restore="${esc(entry.field_key)}" data-lf-form="${esc(entry.form)}" data-lf-log="${esc(entry.id)}">Undo</button>` : "";
      return `<tr><td>${esc(fmt(entry.at))}</td><td>${esc(entry.by_name || "Office staff")}${entry.by_login ? `<small>${esc(entry.by_login)}</small>` : ""}</td><td>${logText(entry)}</td><td>${undo}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function statusChips() {
    const d = S.data;
    const unpublished = d.forms.filter(form => form.unpublished).length;
    const chips = [
      d.practice ? `<span class="lf-chip lf-chip-practice">Practice copy</span>` : `<span class="lf-chip lf-chip-live">Live website</span>`,
      d.published.revision ? `<span class="lf-chip">Published revision ${esc(d.published.revision)} by ${esc(d.published.published_by)} · ${esc(fmt(d.published.published_at))}</span>` : `<span class="lf-chip">Published: the original forms</span>`,
      unpublished ? `<span class="lf-chip lf-chip-warn">${unpublished} form${unpublished === 1 ? "" : "s"} not published yet</span>` : `<span class="lf-chip lf-chip-ok">Everything is published</span>`,
      d.last_sent ? `<span class="lf-chip lf-chip-ok">Sent to live ✓ by ${esc(d.last_sent.sent_by_name || d.last_sent.sent_by || "")} · ${esc(fmt(d.last_sent.sent_at))}</span>` : "",
      !d.practice && d.sent_from_practice ? `<span class="lf-chip lf-chip-practice">From practice copy — Sent by ${esc(d.sent_from_practice.name)} on ${esc(fmt(d.sent_from_practice.at))}</span>` : ""
    ];
    return chips.join("");
  }

  function screen() {
    if (!S.loaded) {
      if (!S.loading) setTimeout(load, 0);
      return panel("Lead forms", "", `<p class="panel-copy">Loading the lead forms…</p>`, "pad");
    }
    if (S.error === "not_here") {
      return panel("Lead forms", "", `<p class="panel-copy">Lead forms are edited on the practice copy for now: open <a href="https://ldtt-sandbox.vercel.app/staff" target="_blank" rel="noopener">the practice portal</a> → Page Editor → Lead forms. Changes reach the live portal through Send to live, as a draft.</p>`, "pad");
    }
    if (!S.data) return panel("Lead forms", "", `<p class="panel-copy">The forms did not load: ${esc(S.error)} <button class="btn btn-outline btn-small" type="button" data-lf-reload>Try again</button></p>`, "pad");
    const d = S.data;
    const form = formDef(S.selected) || d.forms[0];
    const fields = fieldsOf(form.id);
    const visible = fields.filter(field => !field.removed);
    const dirty = Boolean(S.dirty[form.id]);
    const unpublishedAny = d.forms.some(item => item.unpublished) || anyDirty();
    const intro = d.practice
      ? `<p class="lf-intro">Change any question on any lead form here. <b>1.</b> Make your change and press <b>Save this form</b>. <b>2.</b> Press <b>Publish on the practice copy</b>, then <b>Open the page</b> to check it. <b>3.</b> When it looks right, press <b>Send to live</b>: it lands on the live portal as a draft, and someone publishes it there.</p>`
      : `<p class="lf-intro">Forms are changed on the practice copy and sent here as a draft. Check the questions below, then press <b>Publish on the live website</b>.</p>`;
    const nav = d.forms.map(item => {
      const badge = S.dirty[item.id] ? `<em class="lf-badge lf-badge-unsaved">Not saved</em>` : item.unpublished ? `<em class="lf-badge">Not published yet</em>` : item.changed_from_original ? `<em class="lf-badge lf-badge-ok">Edited</em>` : "";
      return `<button type="button" class="lf-form-pick ${item.id === form.id ? "active" : ""}" data-lf-pick="${esc(item.id)}"><strong>${esc(item.label)}</strong>${badge}</button>`;
    }).join("");
    const add = d.can_edit
      ? `<div class="lf-add"><h4>Add a question</h4><div class="lf-add-row"><input type="text" data-lf-new-label placeholder="The question, e.g. How old is your dog?" maxlength="80" aria-label="New question"><select data-lf-new-type aria-label="Answer type">${Object.entries(d.types).map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join("")}</select>${form.grouped ? `<select data-lf-new-group aria-label="Who it is about"><option value="client">About the client</option><option value="dog">About each dog</option></select>` : ""}<button class="btn btn-red btn-small" type="button" data-lf-add>+ Add question</button></div><p class="field-hint">A new question is optional until you tick Required. Its answers show on the lead and in the office emails.</p></div>`
      : "";
    const actions = d.practice
      ? `<div class="lf-actions"><button class="btn btn-red" type="button" data-lf-save ${dirty ? "" : "disabled"}>Save this form</button><button class="btn btn-navy" type="button" data-lf-publish ${unpublishedAny ? "" : "disabled"}>Publish on the practice copy</button><button class="btn btn-outline" type="button" data-lf-send-live>Send to live…</button>${dirty ? `<button class="btn btn-outline btn-small" type="button" data-lf-undo-local>Undo unsaved edits</button>` : ""}${form.unpublished ? `<button class="btn btn-outline btn-small" type="button" data-lf-discard>Throw away unpublished changes</button>` : ""}<button class="btn btn-outline btn-small" type="button" data-lf-reset>Back to the original questions…</button></div>`
      : `<div class="lf-actions"><button class="btn btn-red" type="button" data-lf-publish ${d.forms.some(item => item.unpublished) ? "" : "disabled"}>Publish on the live website</button>${form.unpublished ? `<button class="btn btn-outline btn-small" type="button" data-lf-discard>Throw away the draft of this form</button>` : ""}</div>`;
    const savedLine = dirty ? "You have unsaved changes on this form." : d.draft.saved_at ? `Last saved by ${d.draft.saved_by} · ${fmt(d.draft.saved_at)}.` : "Nothing changed yet: these are the questions the page has today.";
    const body = `<div class="lf-editor">
      <div class="lf-status">${statusChips()}</div>
      ${intro}
      <div class="lf-layout">
        <nav class="lf-forms" aria-label="Lead forms">${nav}</nav>
        <div class="lf-main">
          <div class="lf-form-head"><div><h3>${esc(form.label)}</h3><p class="lf-where">${esc(form.where)}</p>${form.note ? `<p class="lf-note">${esc(form.note)}</p>` : ""}</div><a class="btn btn-outline btn-small" href="${esc(form.open)}" target="_blank" rel="noopener">Open the page</a></div>
          <ol class="lf-fields">${visible.map((field, i) => fieldRow(form, field, i, visible.length)).join("")}</ol>
          ${removedHtml(form, fields)}
          ${add}
          ${actions}
          <p class="lf-dirty-line" data-lf-dirty-line>${esc(savedLine)}</p>
        </div>
        <aside class="lf-preview"><h4>Preview</h4><p class="field-hint">How the questions read after you publish. The page keeps its own look.</p><div class="lf-preview-body" data-lf-preview>${previewHtml(form, fields)}</div></aside>
      </div>
      <section class="lf-log"><h3>Change log</h3>${logHtml()}</section>
    </div>`;
    return panel("Lead forms", "", body, "pad");
  }

  function refreshPreview() {
    const box = document.querySelector("[data-lf-preview]");
    const form = formDef(S.selected);
    if (box && form) box.innerHTML = previewHtml(form, fieldsOf(form.id));
  }
  function markDirty() {
    S.dirty[S.selected] = true;
    const line = document.querySelector("[data-lf-dirty-line]");
    if (line) line.textContent = "You have unsaved changes on this form.";
    document.querySelector("[data-lf-save]")?.removeAttribute("disabled");
    document.querySelector("[data-lf-publish]")?.removeAttribute("disabled");
    const pick = document.querySelector(`[data-lf-pick="${S.selected}"]`);
    if (pick && !pick.querySelector(".lf-badge-unsaved")) {
      pick.querySelector(".lf-badge")?.remove();
      pick.insertAdjacentHTML("beforeend", `<em class="lf-badge lf-badge-unsaved">Not saved</em>`);
    }
  }
  function editField(key, change) {
    const field = fieldsOf(S.selected).find(item => item.key === key);
    if (!field) return;
    change(field);
    markDirty();
    refreshPreview();
  }

  // -------------------------------------------------------------------------
  // Dialogs (same style as the portal's other confirmations)
  // -------------------------------------------------------------------------
  function nameDialog({ title, warningTitle = "Warning", warning, detail = "", button, prefill = "", nameLabel = "Your full name (who is doing this)", help = "" }) {
    return new Promise(resolve => {
      const dialog = document.createElement("dialog");
      dialog.className = "action-confirmation-dialog lf-dialog";
      dialog.innerHTML = `<button type="button" class="action-confirmation-close" aria-label="Close">×</button><div class="action-confirmation-icon">!</div><h2>${esc(title)}</h2><div class="send-live-warning" role="alert"><strong>${esc(warningTitle)}</strong>${esc(warning)}</div>${detail ? `<p>${esc(detail)}</p>` : ""}<label class="send-live-name"><span>${esc(nameLabel)}</span><input type="text" data-lf-name autocomplete="name" placeholder="First and last name" maxlength="200" value="${esc(prefill)}"></label>${help ? `<p class="send-live-name-help">${esc(help)}</p>` : ""}<div class="row-actions" style="justify-content:center"><button type="button" class="btn btn-outline" data-lf-dialog-cancel>Not yet</button><button type="button" class="btn btn-red" data-lf-dialog-go ${fullNameOrEmpty(prefill) ? "" : "disabled"}>${esc(button)}</button></div>`;
      document.body.appendChild(dialog);
      const input = dialog.querySelector("[data-lf-name]");
      const go = dialog.querySelector("[data-lf-dialog-go]");
      const done = value => { dialog.close(); dialog.remove(); resolve(value); };
      input.addEventListener("input", () => { go.disabled = !fullNameOrEmpty(input.value); });
      input.addEventListener("keydown", event => { if (event.key === "Enter" && !go.disabled) go.click(); });
      go.addEventListener("click", () => { const name = fullNameOrEmpty(input.value); if (name) done(name); });
      dialog.querySelectorAll(".action-confirmation-close,[data-lf-dialog-cancel]").forEach(item => item.addEventListener("click", () => done(false)));
      dialog.addEventListener("click", event => { if (event.target === dialog) done(false); });
      dialog.addEventListener("cancel", () => done(false));
      dialog.showModal();
      setTimeout(() => input.focus(), 50);
    });
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  async function run(label, work) {
    if (S.busy) return;
    S.busy = true;
    try { await work(); }
    catch (error) {
      showToast(error.message || `${label} did not work.`, 4200);
      if (error.status === 409) { S.loaded = false; S.loading = false; load(); }
    } finally { S.busy = false; }
  }
  async function saveDirtyForms() {
    for (const id of Object.keys(S.dirty).filter(key => S.dirty[key])) {
      accept(await api("POST", { op: "save_draft", form: id, fields: S.local[id] }), [id]);
    }
  }

  function moveField(key, direction) {
    const list = fieldsOf(S.selected);
    const visible = list.filter(field => !field.removed);
    const at = visible.findIndex(field => field.key === key);
    const to = direction === "up" ? at - 1 : at + 1;
    if (at < 0 || to < 0 || to >= visible.length) return;
    const a = list.indexOf(visible[at]);
    const b = list.indexOf(visible[to]);
    [list[a], list[b]] = [list[b], list[a]];
    S.dirty[S.selected] = true;
    render();
    setTimeout(() => document.querySelector(`[data-lf-move="${direction}"][data-lf-key="${key}"]`)?.focus(), 0);
  }

  function addField() {
    const input = document.querySelector("[data-lf-new-label]");
    const label = String(input?.value || "").replace(/\s+/g, " ").trim();
    if (!label) { showToast("Type the question first, then press + Add question."); input?.focus(); return; }
    const type = document.querySelector("[data-lf-new-type]")?.value || "text";
    const group = document.querySelector("[data-lf-new-group]")?.value || "client";
    const form = formDef(S.selected);
    const key = `x_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const field = { key, label: label.slice(0, 80), type, required: false, builtin: false, removed: false };
    if (CHOICE_TYPES.includes(type)) field.choices = ["Option 1", "Option 2"];
    if (type === "yesno") field.choices = ["Yes", "No"];
    if (form.grouped) field.group = group === "dog" ? "dog" : "client";
    // New questions go just above the texting consent box (the consent box stays last); move them with ↑ ↓.
    const list = fieldsOf(S.selected);
    const consentAt = list.findIndex(item => item.key === "sms_consent");
    if (consentAt >= 0) list.splice(consentAt, 0, field);
    else list.push(field);
    S.dirty[S.selected] = true;
    input.value = ""; // emptied before render (rule 15), so the safety net does not refill it
    render();
    setTimeout(() => document.querySelector(`[data-lf-label="${key}"]`)?.focus(), 0);
  }

  async function removeFlow(key) {
    const form = formDef(S.selected);
    const field = fieldsOf(form.id).find(item => item.key === key);
    if (!field) return;
    // A question added a moment ago and never saved has no history to log: it just goes.
    if (!field.builtin && !form.draft.some(item => item.key === key)) {
      S.local[form.id] = fieldsOf(form.id).filter(item => item.key !== key);
      render();
      return;
    }
    const name = await nameDialog({
      title: `Remove "${field.label}" from ${form.label}?`,
      warningTitle: "What this changes",
      warning: form.effects[key] || S.data.custom_effect,
      detail: `Once you publish, this question is gone from: ${form.where} You can put it back any time (Undo), and this removal is kept in the change log with your name.`,
      button: "Remove this question",
      prefill: myName(),
      nameLabel: "Your full name (filled in from your sign-in; change it if someone else is removing this)",
      help: "Logins are shared in the office, so the log keeps the name typed here."
    });
    if (!name) return;
    await run("Remove", async () => {
      accept(await api("POST", { op: "remove_field", form: form.id, key, name, fields: S.dirty[form.id] ? S.local[form.id] : undefined }), [form.id]);
      showToast(`Removed "${field.label}". It leaves the page when you publish. Undo is under "Removed from this form".`, 4200);
      render();
    });
  }

  async function restoreFlow(key, formId, logId) {
    const id = formId || S.selected;
    await run("Undo", async () => {
      accept(await api("POST", { op: "restore_field", form: id, key, log_id: logId || undefined, name: myName() || undefined, fields: S.dirty[id] ? S.local[id] : undefined }), [id]);
      const label = fieldsOf(id).find(item => item.key === key)?.label || "The question";
      showToast(`"${label}" is back on the form. Publish to show it on the page again.`, 3600);
      render();
    });
  }

  async function publishFlow() {
    const d = S.data;
    const names = [...new Set([...d.forms.filter(form => form.unpublished).map(form => form.label), ...d.forms.filter(form => S.dirty[form.id]).map(form => form.label)])];
    const name = await nameDialog({
      title: d.practice ? "Publish on the practice copy?" : "Publish on the live website?",
      warning: d.practice ? "The practice copy's pages use these forms right away. The live website does not change until the forms are sent to live and published there." : "The LIVE website's forms change right away, for every visitor.",
      detail: names.length ? `Forms with changes: ${names.join(", ")}.` : "",
      button: d.practice ? "Publish on the practice copy" : "Publish on the live website",
      prefill: myName()
    });
    if (!name) return;
    await run("Publish", async () => {
      await saveDirtyForms();
      accept(await api("POST", { op: "publish", name }));
      showToast(d.practice ? "Published on the practice copy. Open the page to check it." : "Published on the live website.", 4200);
      render();
    });
  }

  async function sendLiveFlow() {
    const name = await confirmSendToLive();
    if (!name) return;
    await run("Send to live", async () => {
      await saveDirtyForms();
      const token = await window.LDTT_PORTAL?.accessToken?.();
      const response = await fetch("/api/send-to-live", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ kind: "lead_forms", sent_by_name: name }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.message || `Send to live did not complete (${response.status}).`);
      showToast(result.message || "Sent to live as a draft.", 5200);
      S.loaded = false;
      S.loading = false;
      await load();
    });
  }

  async function discardFlow() {
    const form = formDef(S.selected);
    if (!window.confirm(`Throw away the unpublished changes of "${form.label}"? The form goes back to what is published now.`)) return;
    await run("Discard", async () => {
      accept(await api("POST", { op: "discard_draft", form: form.id }), [form.id]);
      showToast("Unpublished changes thrown away.");
      render();
    });
  }

  async function resetFlow() {
    const form = formDef(S.selected);
    const name = await nameDialog({
      title: `Put ${form.label} back to the original questions?`,
      warning: "Every question goes back to how the page had it before anyone edited it: removed questions come back, renamed ones get their old wording, and added questions are taken off (answers people already gave stay on their leads).",
      detail: "This only changes the draft. Nothing reaches the page until you publish.",
      button: "Back to the original",
      prefill: myName()
    });
    if (!name) return;
    await run("Reset", async () => {
      accept(await api("POST", { op: "reset_form", form: form.id, name }), [form.id]);
      showToast(`${form.label} is back to the original questions (draft). Publish to show it.`, 4200);
      render();
    });
  }

  async function saveFlow() {
    const id = S.selected;
    await run("Save", async () => {
      accept(await api("POST", { op: "save_draft", form: id, fields: S.local[id] }), [id]);
      showToast(S.data.practice ? "Saved. Press Publish on the practice copy to see it on the page." : "Saved.", 3600);
      render();
    });
  }

  // -------------------------------------------------------------------------
  // Events (delegated; only inside the editor)
  // -------------------------------------------------------------------------
  document.addEventListener("click", event => {
    if (!event.target.closest?.(".lf-editor, [data-lf-reload]")) return;
    const hit = selector => event.target.closest(selector);
    if (hit("[data-lf-reload]")) { S.loaded = false; S.loading = false; S.error = ""; load(); return; }
    const pick = hit("[data-lf-pick]");
    if (pick) { S.selected = pick.dataset.lfPick; render(); return; }
    const move = hit("[data-lf-move]");
    if (move) { moveField(move.dataset.lfKey, move.dataset.lfMove); return; }
    if (hit("[data-lf-add]")) { addField(); return; }
    const remove = hit("[data-lf-remove]");
    if (remove) { removeFlow(remove.dataset.lfRemove); return; }
    const restore = hit("[data-lf-restore]");
    if (restore) { restoreFlow(restore.dataset.lfRestore, restore.dataset.lfForm, restore.dataset.lfLog); return; }
    if (hit("[data-lf-save]")) { saveFlow(); return; }
    if (hit("[data-lf-publish]")) { publishFlow(); return; }
    if (hit("[data-lf-send-live]")) { sendLiveFlow(); return; }
    if (hit("[data-lf-discard]")) { discardFlow(); return; }
    if (hit("[data-lf-undo-local]")) { const form = formDef(S.selected); S.local[form.id] = clone(form.draft); S.dirty[form.id] = false; render(); return; }
    if (hit("[data-lf-reset]")) { resetFlow(); }
  });
  document.addEventListener("input", event => {
    const el = event.target;
    if (!el?.closest?.(".lf-editor")) return;
    if (el.matches("[data-lf-label]")) editField(el.dataset.lfLabel, field => { field.label = el.value.replace(/\s+/g, " ").slice(0, 80); });
    else if (el.matches("[data-lf-choices]")) editField(el.dataset.lfChoices, field => { field.choices = el.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean); });
    else if (el.matches("[data-lf-placeholder]")) editField(el.dataset.lfPlaceholder, field => { field.placeholder = el.value.slice(0, 120); });
  });
  document.addEventListener("change", event => {
    const el = event.target;
    if (!el?.closest?.(".lf-editor")) return;
    if (el.matches("[data-lf-required]")) { editField(el.dataset.lfRequired, field => { field.required = el.checked; }); return; }
    if (el.matches("[data-lf-type]")) {
      editField(el.dataset.lfType, field => {
        field.type = el.value;
        if (CHOICE_TYPES.includes(field.type)) { if (!Array.isArray(field.choices) || !field.choices.length || field.choices.join() === "Yes,No") field.choices = ["Option 1", "Option 2"]; }
        else if (field.type === "yesno") field.choices = ["Yes", "No"];
        else delete field.choices;
      });
      render();
    }
  });
  window.addEventListener("beforeunload", event => {
    if (!anyDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // -------------------------------------------------------------------------
  // Look
  // -------------------------------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `
.lf-editor{display:grid;gap:16px}
.lf-status{display:flex;flex-wrap:wrap;gap:8px}
.lf-chip{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px;background:#eef1f5;color:#34404f}
.lf-chip-practice{background:#fff4d6;color:#7a5a00}.lf-chip-live{background:#ffe3e8;color:#a00d2c}
.lf-chip-warn{background:#fff1f3;color:#b00020}.lf-chip-ok{background:#eaf6ef;color:#1d7a46}
.lf-intro{margin:0;font-size:15px;line-height:1.55;max-width:980px}
.lf-layout{display:grid;grid-template-columns:220px minmax(0,1fr) 300px;gap:18px;align-items:start}
@media(max-width:1180px){.lf-layout{grid-template-columns:200px minmax(0,1fr)}.lf-preview{grid-column:1/-1}}
@media(max-width:760px){.lf-layout{grid-template-columns:1fr}}
.lf-forms{display:grid;gap:6px;position:sticky;top:8px}
.lf-form-pick{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;border:1px solid #d9dde3;background:#fff;border-radius:12px;padding:10px 12px;font:inherit;cursor:pointer}
.lf-form-pick strong{font-size:14px}
.lf-form-pick.active{border-color:#d80f35;box-shadow:0 0 0 3px #ffd6de}
.lf-badge{font-style:normal;font-size:11px;font-weight:800;border-radius:999px;padding:2px 8px;background:#fff1f3;color:#b00020}
.lf-badge-unsaved{background:#d80f35;color:#fff}.lf-badge-ok{background:#eaf6ef;color:#1d7a46}
.lf-main{min-width:0}
.lf-form-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}
.lf-form-head h3{margin:0 0 4px;font-size:20px}
.lf-where{margin:0;color:#5d636b}.lf-note{margin:6px 0 0;font-size:13px;background:#f6f7f9;border-radius:8px;padding:8px 10px;color:#34404f}
.lf-fields{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.lf-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:start;border:1px solid #e3e5e8;border-radius:12px;padding:10px 12px;background:#fff}
.lf-move{display:grid;gap:4px}
.lf-icon{width:30px;height:28px;border:1px solid #d9dde3;background:#fff;border-radius:8px;cursor:pointer;font-weight:800}
.lf-icon[disabled]{opacity:.35;cursor:default}
.lf-row-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.lf-label-input{flex:1 1 260px;font:inherit;font-weight:700;padding:8px 10px;border:1px solid #c9cdd2;border-radius:8px;min-width:0}
.lf-fixed-label{flex:1 1 260px;padding:8px 0}
.lf-type,.lf-type-select{font-size:13px;color:#34404f}
.lf-type{background:#f1f2f4;border-radius:999px;padding:4px 10px}
.lf-type-select{padding:6px 8px;border:1px solid #c9cdd2;border-radius:8px;background:#fff}
.lf-tags{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0}
.lf-tag{font-style:normal;font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;background:#f1f2f4;color:#5d636b}
.lf-tag-feeds{background:#e8f0fb;color:#1f4f8a}.lf-tag-new{background:#eaf6ef;color:#1d7a46}
.lf-choices,.lf-placeholder{display:block;margin-top:8px;font-size:13px;font-weight:600}
.lf-choices textarea,.lf-placeholder input{display:block;width:100%;margin-top:4px;font:inherit;font-weight:400;padding:8px 10px;border:1px solid #c9cdd2;border-radius:8px}
.lf-choice-note{margin:6px 0 0;font-size:12px;color:#7a5a00;background:#fff8e6;border-radius:8px;padding:6px 8px}
.lf-row-side{display:grid;gap:8px;justify-items:end}
.lf-req{display:flex;gap:6px;align-items:center;font-size:13px;font-weight:700;white-space:nowrap}
.lf-req-fixed{font-size:12px;color:#5d636b;white-space:nowrap}
.lf-removed{margin-top:14px;border:1px dashed #f0b3bf;background:#fff8f9;border-radius:12px;padding:10px 12px}
.lf-removed h4,.lf-add h4{margin:0 0 8px;font-size:15px}
.lf-removed-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:6px 0;border-top:1px solid #f6d6dd}
.lf-removed-row:first-of-type{border-top:0}
.lf-removed-row small{display:block;color:#5d636b;font-size:12px;margin-top:2px}
.lf-add{margin-top:14px;border:1px solid #e3e5e8;border-radius:12px;padding:10px 12px;background:#fafbfc}
.lf-add-row{display:flex;gap:8px;flex-wrap:wrap}
.lf-add-row input{flex:1 1 260px;font:inherit;padding:8px 10px;border:1px solid #c9cdd2;border-radius:8px;min-width:0}
.lf-add-row select{padding:8px;border:1px solid #c9cdd2;border-radius:8px;background:#fff}
.lf-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;align-items:center}
.lf-dirty-line{margin:8px 0 0;font-size:13px;color:#5d636b}
.lf-preview{border:1px solid #e3e5e8;border-radius:12px;padding:12px;background:#fafbfc;position:sticky;top:8px}
.lf-preview h4{margin:0 0 4px}.lf-preview h5{margin:12px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#5d636b}
.lf-p-field{display:block;margin:0 0 10px;font-size:13px;font-weight:700}
.lf-p-field input,.lf-p-field select,.lf-p-field textarea{display:block;width:100%;margin-top:4px;padding:7px 9px;border:1px solid #d3d7dc;border-radius:8px;background:#fff;font:inherit;font-weight:400}
.lf-p-choices{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:4px;font-weight:400}
.lf-p-consent{display:flex;gap:8px;font-size:12px;color:#5d636b;margin:0 0 10px}
.lf-star{color:#d80f35}
.lf-log h3{margin:0 0 8px}
.lf-log-table{width:100%;border-collapse:collapse;font-size:13px}
.lf-log-table th,.lf-log-table td{border-bottom:1px solid #eceef1;padding:7px 8px;text-align:left;vertical-align:top}
.lf-log-table td small{display:block;color:#5d636b}
.lf-undone{color:#1d7a46;font-style:normal}
`;
  document.head.appendChild(style);

  window.LDTT_FORM_EDITOR = { screen, reload: () => { S.loaded = false; S.loading = false; return load(); } };
})();
