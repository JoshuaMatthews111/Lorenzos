const crypto = require("node:crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const SIMPLETEXTING_BASE = "https://api-app2.simpletexting.com/v2/api";
const RESEND_BASE = "https://api.resend.com";

const SECRET_SETTING_KEYS = new Set([
  "simpletexting_api_key",
  "simpletexting_signing_secret",
  "resend_api_key",
  "resend_signing_secret",
  "unsubscribe_secret"
]);
const SETTING_KEYS = new Set([
  ...SECRET_SETTING_KEYS,
  "simpletexting_sending_number",
  "resend_from_address",
  "default_quiet_hours",
  "default_escalation_minutes",
  "reply_keywords"
]);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

function clean(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function cleanPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : "";
}

function prettyName(value) {
  const input = clean(value, 80).toLowerCase();
  if (!input || input.length > 40 || /\d|@/.test(input) || /^(n\/?a|none|unknown|test)$/.test(input)) return "Friend";
  return input.split(/\s+/).map(part => part
    .split("-").map(piece => {
      const base = piece.charAt(0).toUpperCase() + piece.slice(1);
      return base.replace(/^Mc([a-z])/, (_match, letter) => `Mc${letter.toUpperCase()}`);
    }).join("-")).join(" ");
}

function noMergeTokens(value) {
  return String(value || "").replace(/{{\s*[^}]+\s*}}/g, "").replace(/\s{2,}/g, " ").trim();
}

function mergeTemplate(value, recipient = {}, unsubscribeUrl = "") {
  const replacements = {
    first_name: prettyName(recipient.first_name || recipient.client_name?.split(/\s+/)[0]),
    last_name: prettyName(recipient.last_name || recipient.client_name?.split(/\s+/).slice(1).join(" ")),
    city: clean(recipient.city || recipient.service_area || "your area", 80),
    unsubscribe: unsubscribeUrl
  };
  return noMergeTokens(String(value || "").replace(/{{\s*(first_name|last_name|city|unsubscribe)\s*}}/gi, (_all, key) => replacements[String(key).toLowerCase()] || ""));
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || data?.msg || raw || `Supabase request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function verifyPortalUser(accessToken) {
  if (!accessToken) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  const user = await response.json();
  const rows = await supabaseFetch(`/rest/v1/portal_users?select=*&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`);
  const portalUser = rows?.[0];
  if (!portalUser || ["disabled", "revoked"].includes(String(portalUser.access_status || "active"))) return null;
  if (!["admin", "trainer"].includes(portalUser.role)) return null;
  return { user, portalUser };
}

function isAdmin(access) {
  return access?.portalUser?.role === "admin" && ["super_admin", "office_admin"].includes(String(access.portalUser.permission_level || "super_admin"));
}

function isSuperAdmin(access) {
  return isAdmin(access) && String(access.portalUser.permission_level || "super_admin") === "super_admin";
}

function actorName(access) {
  const portal = access.portalUser || {};
  return clean(portal.display_name || [portal.first_name, portal.last_name].filter(Boolean).join(" ") || access.user?.email, 180);
}

async function audit(access, action, entityType, entityId, summary, before = null, after = null) {
  await supabaseFetch("/rest/v1/audit_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_user_id: access.user.id,
      actor_email: clean(access.portalUser.email || access.user.email, 254),
      actor_name: actorName(access),
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      summary: clean(summary, 1000) || null,
      before_data: before,
      after_data: after,
      request_id: crypto.randomUUID()
    })
  }).catch(() => {});
}

async function getSetting(key, includeSecret = false) {
  const rows = await supabaseFetch(`/rest/v1/communications_settings?select=*&setting_key=eq.${encodeURIComponent(key)}&limit=1`);
  const setting = rows?.[0] || null;
  if (!includeSecret || !setting?.secret_id) return { setting, secret: "" };
  const result = await supabaseFetch("/rest/v1/rpc/communications_read_setting_secret", {
    method: "POST",
    body: JSON.stringify({ p_key: key })
  });
  return { setting, secret: typeof result === "string" ? result : "" };
}

async function configurationStatus() {
  const rows = await supabaseFetch("/rest/v1/communications_settings?select=setting_key,secret_id,value,updated_at&order=setting_key.asc");
  const settings = new Map(rows.map(item => [item.setting_key, item]));
  return {
    simpletextingReady: Boolean(settings.get("simpletexting_api_key")?.secret_id && settings.get("simpletexting_sending_number")?.value?.value),
    resendReady: Boolean(settings.get("resend_api_key")?.secret_id && settings.get("resend_from_address")?.value?.value && settings.get("unsubscribe_secret")?.secret_id),
    values: Object.fromEntries(rows.map(item => [item.setting_key, {
      configured: Boolean(item.secret_id),
      value: SECRET_SETTING_KEYS.has(item.setting_key) ? "" : item.value?.value || "",
      updated_at: item.updated_at
    }]))
  };
}

async function loadCommunications(access) {
  const [lists, members, templates, testers, campaigns, deliveries, events, config] = await Promise.all([
    isAdmin(access) ? supabaseFetch("/rest/v1/communications_alert_lists?select=*&order=created_at.desc") : Promise.resolve([]),
    isAdmin(access) ? supabaseFetch("/rest/v1/communications_alert_members?select=*&order=created_at.asc") : supabaseFetch(`/rest/v1/communications_alert_members?select=*&portal_user_id=eq.${encodeURIComponent(access.user.id)}&active=eq.true&stopped_at=is.null`),
    isAdmin(access) ? supabaseFetch("/rest/v1/communications_templates?select=*&order=updated_at.desc") : Promise.resolve([]),
    isAdmin(access) ? supabaseFetch("/rest/v1/communications_testers?select=*&order=created_at.asc") : Promise.resolve([]),
    isAdmin(access) ? supabaseFetch("/rest/v1/communications_campaigns?select=*&order=created_at.desc&limit=50") : Promise.resolve([]),
    isAdmin(access) ? supabaseFetch("/rest/v1/communications_alert_deliveries?select=*&order=created_at.desc&limit=100") : Promise.resolve([]),
    isAdmin(access) ? supabaseFetch("/rest/v1/communications_webhook_events?select=provider,event_type,outcome,received_at&order=received_at.desc&limit=12") : Promise.resolve([]),
    isSuperAdmin(access) ? configurationStatus() : Promise.resolve(null)
  ]);
  return { lists, members, templates, testers, campaigns, deliveries, events, config, canManage: isAdmin(access), isSuperAdmin: isSuperAdmin(access) };
}

function listPayload(input = {}) {
  const rules = input.rules && typeof input.rules === "object" ? input.rules : {};
  return {
    name: clean(input.name, 120),
    active: input.active !== false,
    rules: {
      any_new_lead: rules.any_new_lead === true,
      markets: Array.isArray(rules.markets) ? rules.markets.map(value => clean(value, 100)).filter(Boolean).slice(0, 40) : [],
      cities: Array.isArray(rules.cities) ? rules.cities.map(value => clean(value, 100)).filter(Boolean).slice(0, 40) : [],
      service_interests: Array.isArray(rules.service_interests) ? rules.service_interests.map(value => clean(value, 160)).filter(Boolean).slice(0, 40) : [],
      urgent_keywords: Array.isArray(rules.urgent_keywords) ? rules.urgent_keywords.map(value => clean(value, 80)).filter(Boolean).slice(0, 30) : []
    },
    timezone: clean(input.timezone || "America/New_York", 80),
    quiet_hours_start: clean(input.quiet_hours_start, 8) || null,
    quiet_hours_end: clean(input.quiet_hours_end, 8) || null,
    urgent_overrides_quiet_hours: input.urgent_overrides_quiet_hours === true,
    escalation_list_id: clean(input.escalation_list_id, 80) || null,
    escalation_minutes: Math.max(1, Math.min(1440, Number(input.escalation_minutes || 10))),
    claim_follow_up_minutes: Math.max(1, Math.min(1440, Number(input.claim_follow_up_minutes || 20))),
    stale_claim_minutes: Math.max(5, Math.min(1440, Number(input.stale_claim_minutes || 30))),
    auto_release_stale_claims: input.auto_release_stale_claims !== false
  };
}

async function saveAlertList(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const payload = listPayload(body.list);
  if (!payload.name) throw Object.assign(new Error("Give the alert list a name."), { status: 400 });
  const id = clean(body.list?.id, 80);
  const before = id ? (await supabaseFetch(`/rest/v1/communications_alert_lists?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0] : null;
  const rows = await supabaseFetch(id ? `/rest/v1/communications_alert_lists?id=eq.${encodeURIComponent(id)}` : "/rest/v1/communications_alert_lists", {
    method: id ? "PATCH" : "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(id ? payload : { ...payload, created_by: access.user.id })
  });
  const record = rows?.[0];
  await audit(access, id ? "communications_alert_list_updated" : "communications_alert_list_created", "communications_alert_list", record.id, `Alert list ${record.name} saved.`, before, record);
  return { record };
}

async function saveMember(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const member = body.member || {};
  const payload = {
    alert_list_id: clean(member.alert_list_id, 80),
    portal_user_id: clean(member.portal_user_id, 80) || null,
    display_name: clean(member.display_name, 160),
    phone: cleanPhone(member.phone),
    active: member.active !== false,
    consented_at: member.consented_at || null,
    stopped_at: member.stopped_at || null
  };
  if (!payload.alert_list_id || !payload.display_name || !payload.phone) throw Object.assign(new Error("List, staff name, and a valid mobile number are required."), { status: 400 });
  const id = clean(member.id, 80);
  const rows = await supabaseFetch(id ? `/rest/v1/communications_alert_members?id=eq.${encodeURIComponent(id)}` : "/rest/v1/communications_alert_members", {
    method: id ? "PATCH" : "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  const record = rows?.[0];
  await audit(access, id ? "communications_member_updated" : "communications_member_added", "communications_alert_member", record.id, `${record.display_name} alert membership saved.`);
  return { record };
}

async function saveTemplate(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const template = body.template || {};
  const payload = {
    name: clean(template.name, 120),
    channel: ["email", "sms", "mms"].includes(template.channel) ? template.channel : "email",
    subject: clean(template.subject, 250) || null,
    body_html: clean(template.body_html, 100000) || null,
    body_text: clean(template.body_text, 20000),
    media_url: clean(template.media_url, 2000) || null,
    active: template.active !== false,
    updated_by: access.user.id
  };
  if (!payload.name || !payload.body_text) throw Object.assign(new Error("Template name and message are required."), { status: 400 });
  const id = clean(template.id, 80);
  const rows = await supabaseFetch(id ? `/rest/v1/communications_templates?id=eq.${encodeURIComponent(id)}` : "/rest/v1/communications_templates", {
    method: id ? "PATCH" : "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(id ? payload : { ...payload, created_by: access.user.id })
  });
  const record = rows?.[0];
  await audit(access, id ? "communications_template_updated" : "communications_template_created", "communications_template", record.id, `Template ${record.name} saved.`);
  return { record };
}

async function saveTester(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const tester = body.tester || {};
  const payload = {
    display_name: clean(tester.display_name, 160),
    email: clean(tester.email, 254).toLowerCase() || null,
    phone: cleanPhone(tester.phone) || null,
    active: tester.active !== false
  };
  if (!payload.display_name || (!payload.email && !payload.phone)) throw Object.assign(new Error("Tester name plus an email or mobile number are required."), { status: 400 });
  const id = clean(tester.id, 80);
  const rows = await supabaseFetch(id ? `/rest/v1/communications_testers?id=eq.${encodeURIComponent(id)}` : "/rest/v1/communications_testers", {
    method: id ? "PATCH" : "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(id ? payload : { ...payload, created_by: access.user.id })
  });
  return { record: rows?.[0] };
}

async function saveSettings(access, body) {
  if (!isSuperAdmin(access)) throw Object.assign(new Error("Only a Super Admin can save provider settings."), { status: 403 });
  const settings = body.settings && typeof body.settings === "object" ? body.settings : {};
  const saved = [];
  for (const [key, entry] of Object.entries(settings)) {
    if (!SETTING_KEYS.has(key)) continue;
    const secret = SECRET_SETTING_KEYS.has(key) ? clean(entry?.secret, 10000) : "";
    const value = SECRET_SETTING_KEYS.has(key) ? {} : { value: clean(entry?.value, 2000) };
    if (!secret && !Object.keys(value).length) continue;
    const result = await supabaseFetch("/rest/v1/rpc/communications_store_setting", {
      method: "POST",
      body: JSON.stringify({ p_key: key, p_secret: secret || null, p_value: value, p_updated_by: access.user.id })
    });
    saved.push({ key, configured: Boolean(result?.secret_id), value: SECRET_SETTING_KEYS.has(key) ? "" : result?.value?.value || "" });
  }
  await audit(access, "communications_settings_saved", "communications_settings", "provider", "Provider settings saved without exposing key values.");
  return { saved, config: await configurationStatus() };
}

async function sendSms(phone, text) {
  const [{ secret: apiKey }, { setting: sender }] = await Promise.all([
    getSetting("simpletexting_api_key", true), getSetting("simpletexting_sending_number", false)
  ]);
  if (!apiKey || !sender?.value?.value) throw Object.assign(new Error("SimpleTexting is not configured. Add the API key and verified sending number in Communications Settings."), { status: 412 });
  const response = await fetch(`${SIMPLETEXTING_BASE}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contactPhone: phone, mode: "AUTO", text })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || Number(data?.code) < 0) throw new Error(data?.message || data?.error || "SimpleTexting refused this message.");
  return { id: data?.id || data?.messageId || "", provider: data };
}

async function unsubscribeUrl(email) {
  const { secret } = await getSetting("unsubscribe_secret", true);
  if (!secret || !email) return "";
  const normalized = clean(email, 254).toLowerCase();
  const signature = crypto.createHmac("sha256", secret).update(normalized).digest("hex");
  return `https://www.lorenzosdogtrainingteam.com/api/unsubscribe?email=${encodeURIComponent(normalized)}&sig=${signature}`;
}

async function sendEmail(email, subject, html, text, unsubscribe = "") {
  const [{ secret: apiKey }, { setting: sender }] = await Promise.all([
    getSetting("resend_api_key", true), getSetting("resend_from_address", false)
  ]);
  if (!apiKey || !sender?.value?.value) throw Object.assign(new Error("Resend is not configured. Add the API key and verified from-address in Communications Settings."), { status: 412 });
  const response = await fetch(`${RESEND_BASE}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender.value.value,
      to: [email],
      subject,
      html,
      text,
      headers: unsubscribe ? { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.message || data?.error?.message || "Resend refused this email.");
  return { id: data?.id || "", provider: data };
}

async function previewCampaign(_access, body) {
  const sample = body.sample || {};
  const email = clean(sample.email || "preview@lorenzosdogtrainingteam.com", 254).toLowerCase();
  const unsubscribe = await unsubscribeUrl(email);
  return {
    subject: mergeTemplate(body.subject, sample, unsubscribe),
    text: mergeTemplate(body.body_text, sample, unsubscribe),
    html: mergeTemplate(body.body_html || body.body_text, sample, unsubscribe)
  };
}

async function sendTest(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const channel = ["email", "sms"].includes(body.channel) ? body.channel : "email";
  const requestedIds = Array.isArray(body.recipients)
    ? body.recipients.map(item => clean(item?.id, 80)).filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 20)
    : [];
  if (!requestedIds.length) throw Object.assign(new Error("Choose at least one saved tester."), { status: 400 });
  const savedTesters = await supabaseFetch("/rest/v1/communications_testers?select=id,display_name,email,phone&active=eq.true");
  const wanted = new Set(requestedIds);
  const recipients = savedTesters.filter(tester => wanted.has(tester.id));
  if (!recipients.length) throw Object.assign(new Error("Choose at least one active saved tester."), { status: 400 });
  const outcomes = [];
  for (const tester of recipients) {
    const data = { client_name: tester.display_name, email: tester.email, phone: tester.phone, city: "Cleveland" };
    const unsubscribe = tester.email ? await unsubscribeUrl(tester.email) : "";
    if (channel === "email") {
      if (!tester.email) { outcomes.push({ name: tester.display_name, status: "skipped", message: "No email" }); continue; }
      let html = mergeTemplate(body.body_html || body.body_text, data, unsubscribe);
      let text = mergeTemplate(body.body_text, data, unsubscribe);
      if (unsubscribe && !html.includes(unsubscribe)) html += `<p style="font-size:12px;color:#52657e">Unsubscribe: <a href="${unsubscribe}">${unsubscribe}</a></p>`;
      if (unsubscribe && !text.includes(unsubscribe)) text += `\n\nUnsubscribe: ${unsubscribe}`;
      const result = await sendEmail(tester.email, mergeTemplate(body.subject, data, unsubscribe) || "Lorenzo's Dog Training Team test", html, text, unsubscribe);
      outcomes.push({ name: tester.display_name, status: "sent", id: result.id });
    } else {
      if (!tester.phone) { outcomes.push({ name: tester.display_name, status: "skipped", message: "No mobile number" }); continue; }
      const result = await sendSms(tester.phone, mergeTemplate(body.body_text, data, unsubscribe));
      outcomes.push({ name: tester.display_name, status: "sent", id: result.id });
    }
  }
  await audit(access, "communications_test_sent", "communications_test", channel, `Test ${channel} sent to ${outcomes.filter(item => item.status === "sent").length} recipient(s).`);
  return { outcomes };
}

async function leadAction(access, body) {
  const leadId = clean(body.lead_id, 80);
  if (!leadId) throw Object.assign(new Error("Lead is required."), { status: 400 });
  const operation = clean(body.operation, 40);
  const isManager = isAdmin(access);
  let result;
  if (operation === "claim_lead") {
    result = await supabaseFetch("/rest/v1/rpc/communications_claim_lead", { method: "POST", body: JSON.stringify({ p_lead_id: leadId, p_staff_id: access.user.id }) });
    const response = Array.isArray(result) ? result[0] : result;
    return { result: response, message: response?.claimed ? "Lead claimed." : `${response?.owner_name || "Another staff member"} already claimed this lead.` };
  }
  if (operation === "release_lead") {
    result = await supabaseFetch("/rest/v1/rpc/communications_release_lead", { method: "POST", body: JSON.stringify({ p_lead_id: leadId, p_staff_id: isManager ? null : access.user.id, p_reason: clean(body.reason, 200) || "passed" }) });
    return { record: result, message: "Lead released back to the team." };
  }
  if (operation === "mark_contacted") {
    result = await supabaseFetch("/rest/v1/rpc/communications_mark_contacted", { method: "POST", body: JSON.stringify({ p_lead_id: leadId, p_staff_id: isManager ? null : access.user.id, p_note: clean(body.note, 2000) || null }) });
    return { record: result, message: "First contact logged." };
  }
  throw Object.assign(new Error("Unsupported lead action."), { status: 400 });
}

async function removeRecord(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const table = {
    alert_list: "communications_alert_lists",
    member: "communications_alert_members",
    template: "communications_templates",
    tester: "communications_testers"
  }[body.entity];
  const id = clean(body.id, 80);
  if (!table || !id) throw Object.assign(new Error("Unsupported record."), { status: 400 });
  await supabaseFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await audit(access, "communications_record_removed", body.entity, id, `${body.entity} removed.`);
  return { removed: true };
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Secure portal server configuration is unavailable." });
  try {
    const token = clean(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const access = await verifyPortalUser(token);
    if (!access) return res.status(403).json({ ok: false, message: "Active portal access required." });
    const operation = req.method === "GET" ? clean(req.query?.operation || "load", 50) : clean(req.body?.operation, 50);
    let data;
    if (operation === "load") data = await loadCommunications(access);
    else if (operation === "save_alert_list") data = await saveAlertList(access, req.body || {});
    else if (operation === "save_member") data = await saveMember(access, req.body || {});
    else if (operation === "save_template") data = await saveTemplate(access, req.body || {});
    else if (operation === "save_tester") data = await saveTester(access, req.body || {});
    else if (operation === "save_settings") data = await saveSettings(access, req.body || {});
    else if (operation === "preview_campaign") data = await previewCampaign(access, req.body || {});
    else if (operation === "send_test") data = await sendTest(access, req.body || {});
    else if (["claim_lead", "release_lead", "mark_contacted"].includes(operation)) data = await leadAction(access, req.body || {});
    else if (operation === "remove") data = await removeRecord(access, req.body || {});
    else return res.status(400).json({ ok: false, message: "Unsupported communications action." });
    return res.status(200).json({ ok: true, ...data });
  } catch (error) {
    console.error("Communications API error", error);
    return res.status(error.status || 500).json({ ok: false, message: error.message || "Communications action could not be completed." });
  }
}

module.exports = handler;
module.exports.internal = {
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  clean,
  cleanPhone,
  getSetting,
  supabaseFetch,
  sendSms
};
