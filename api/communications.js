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

// A "both" template keeps the short text wording in body_text, so the email's own
// plain-text part is taken from the email HTML rather than from the text message.
function htmlToText(html) {
  return String(html || "")
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|ul|ol|table)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n")
    .split("\n").map(line => line.trim()).join("\n").trim();
}

function noMergeTokens(value) {
  return String(value || "").replace(/{{\s*[^}]+\s*}}/g, "").replace(/\s{2,}/g, " ").trim();
}

function mergeTemplate(value, recipient = {}, unsubscribeUrl = "") {
  const replacements = {
    first_name: prettyName(recipient.first_name || recipient.client_name?.split(/\s+/)[0]),
    last_name: prettyName(recipient.last_name || recipient.client_name?.split(/\s+/).slice(1).join(" ")),
    city: clean(recipient.city || recipient.service_area || "your area", 80),
    dog_name: prettyName(recipient.dog_name),
    unsubscribe: unsubscribeUrl,
    // Designers hand over templates using several names for the same opt-out link.
    opt_out_url: unsubscribeUrl,
    unsubscribe_url: unsubscribeUrl
  };
  return noMergeTokens(String(value || "").replace(
    /{{\s*(first_name|last_name|city|dog_name|unsubscribe|opt_out_url|unsubscribe_url)\s*}}/gi,
    (_all, key) => replacements[String(key).toLowerCase()] || ""
  ));
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
    // Opt-out is handled by the providers themselves: SimpleTexting processes STOP at
    // the carrier level, and Resend suppresses anyone who uses the List-Unsubscribe
    // link it adds. A local unsubscribe secret is therefore optional, not required.
    resendReady: Boolean(settings.get("resend_api_key")?.secret_id && settings.get("resend_from_address")?.value?.value),
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

const TEMPLATE_FORMATS = new Set(["visual", "html", "text"]);
const BLOCK_TYPES = new Set(["logo", "bar", "heading", "text", "button", "image", "spacer"]);
const BLOCK_ALIGNMENTS = new Set(["left", "center", "right"]);

function safeColor(value, fallback = "") {
  const input = clean(value, 40);
  return /^#[0-9a-f]{3,8}$/i.test(input) || /^rgba?\([\d\s.,%]+\)$/i.test(input) ? input : fallback;
}

function safeFont(value) {
  // Email-safe stacks only. Anything else falls back to Arial so a saved design
  // can never inject arbitrary CSS into a sent message.
  const input = clean(value, 120);
  return /^[a-z0-9 '",\-]+$/i.test(input) ? input : "Arial, Helvetica, sans-serif";
}

function safeMediaUrl(value) {
  const input = clean(value, 2000);
  return /^https:\/\//i.test(input) ? input : "";
}

function safeNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

function designPayload(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.blocks)) return null;
  const blocks = input.blocks
    .filter(block => block && BLOCK_TYPES.has(block.type))
    .slice(0, 60)
    .map(block => ({
      type: block.type,
      text: clean(block.text, 5000),
      url: safeMediaUrl(block.url),
      href: safeMediaUrl(block.href),
      alt: clean(block.alt, 200),
      font: safeFont(block.font),
      size: safeNumber(block.size, 8, 72, 16),
      lineHeight: safeNumber(block.lineHeight, 100, 250, 150),
      color: safeColor(block.color, "#1f2d3d"),
      background: safeColor(block.background, ""),
      align: BLOCK_ALIGNMENTS.has(block.align) ? block.align : "left",
      bold: block.bold === true,
      italic: block.italic === true,
      width: safeNumber(block.width, 20, 600, 180),
      height: safeNumber(block.height, 1, 200, 8),
      radius: safeNumber(block.radius, 0, 40, 6),
      padding: safeNumber(block.padding, 0, 80, 16)
    }));
  if (!blocks.length) return null;
  return {
    blocks,
    width: safeNumber(input.width, 320, 800, 600),
    background: safeColor(input.background, "#f4f7fb"),
    contentBackground: safeColor(input.contentBackground, "#ffffff")
  };
}

async function saveTemplate(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const template = body.template || {};
  const channel = ["email", "sms", "mms", "both"].includes(template.channel) ? template.channel : "email";
  const carriesEmail = channel === "email" || channel === "both";
  const design = designPayload(template.design);
  const requestedFormat = clean(template.format, 20);
  const format = TEMPLATE_FORMATS.has(requestedFormat)
    ? requestedFormat
    : (carriesEmail ? (design ? "visual" : "html") : "text");
  const payload = {
    name: clean(template.name, 120),
    channel,
    subject: clean(template.subject, 250) || null,
    body_html: clean(template.body_html, 400000) || null,
    body_text: clean(template.body_text, 20000),
    media_url: clean(template.media_url, 2000) || null,
    active: template.active !== false,
    format,
    design: format === "visual" ? design : null,
    updated_by: access.user.id
  };
  if (format === "visual" && !design) {
    throw Object.assign(new Error("Add at least one block to the design before saving."), { status: 400 });
  }
  if (channel === "both" && !payload.body_html) {
    throw Object.assign(new Error("A template for both needs the email version as well as the text version."), { status: 400 });
  }
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

// Resend adds and hosts the opt-out link when the message carries these headers, and
// records the opt-out on their side. Our own signed link is used as well when a local
// unsubscribe secret happens to be configured, but it is no longer required.
function unsubscribeHeaders(unsubscribe) {
  const mailto = "unsubscribe@lorenzosdogtrainingteam.com";
  const targets = [unsubscribe ? `<${unsubscribe}>` : "", `<mailto:${mailto}?subject=unsubscribe>`].filter(Boolean).join(", ");
  return { "List-Unsubscribe": targets, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
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
      headers: unsubscribeHeaders(unsubscribe)
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.message || data?.error?.message || "Resend refused this email.");
  return { id: data?.id || "", provider: data };
}

async function previewCampaign(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
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
  const rows = await supabaseFetch(`/rest/v1/leads?select=id,status,claimed_by&id=eq.${encodeURIComponent(leadId)}&limit=1`);
  const lead = rows?.[0];
  if (!lead) throw Object.assign(new Error("This lead is no longer available."), { status: 404 });
  const closedStatuses = new Set([
    "archived", "do_not_contact", "bad_lead", "became_client", "first_session_payment",
    "lost_no_response", "lost_price_concern", "lost_not_ready", "lost_chose_another_provider",
    "lost_client_complaint", "lost_no_trainer_area"
  ]);
  if (operation === "claim_lead" && closedStatuses.has(lead.status)) {
    throw Object.assign(new Error("This lead is closed and cannot be assigned."), { status: 409 });
  }
  if (operation === "claim_lead" && lead.claimed_by) {
    throw Object.assign(new Error("This lead is already assigned to another staff member."), { status: 409 });
  }
  let result;
  if (operation === "claim_lead") {
    result = await supabaseFetch("/rest/v1/rpc/communications_claim_lead", { method: "POST", body: JSON.stringify({ p_lead_id: leadId, p_staff_id: access.user.id }) });
    const response = Array.isArray(result) ? result[0] : result;
    if (!response?.claimed) throw Object.assign(new Error("This lead could not be assigned. Refresh and try again."), { status: 409 });
    return { result: response, message: "Lead assigned to you." };
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

const BLOCKED_CLIENT_STATUSES = new Set(["do_not_contact", "bad_lead", "archived", "inactive_do_not_contact"]);
const EMAIL_SHAPE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
const CAMPAIGN_BATCH_SIZE = 25;

function clientFirstLast(client) {
  const payload = client.raw_payload || {};
  const parts = String(client.client_name || "").trim().split(/\s+/);
  return {
    first_name: clean(payload.first_name || parts[0] || "", 80),
    last_name: clean(payload.last_name || parts.slice(1).join(" ") || "", 80),
    city: clean(client.service_area || payload.city || "", 80)
  };
}

// One place decides who may be contacted, so the count shown to staff and the list
// actually sent are produced by the same rules.
function eligibleRecipients(clients, channel, requireConsent) {
  const seen = new Set();
  const eligible = [];
  const skipped = { blocked: 0, noContact: 0, optedOut: 0, noConsent: 0, duplicate: 0 };
  for (const client of clients) {
    if (client.archived_at) { skipped.blocked += 1; continue; }
    if (BLOCKED_CLIENT_STATUSES.has(String(client.status || "").toLowerCase())) { skipped.blocked += 1; continue; }
    const consent = channel === "email" ? client.email_consent : client.sms_consent;
    if (consent === false) { skipped.optedOut += 1; continue; }
    if (requireConsent && consent !== true) { skipped.noConsent += 1; continue; }
    const address = channel === "email" ? clean(client.email, 254).toLowerCase() : cleanPhone(client.phone);
    if (!address || (channel === "email" && !EMAIL_SHAPE.test(address))) { skipped.noContact += 1; continue; }
    if (seen.has(address)) { skipped.duplicate += 1; continue; }
    seen.add(address);
    eligible.push({ client, address });
  }
  return { eligible, skipped };
}

async function loadSendableClients() {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const page = await supabaseFetch(
      `/rest/v1/clients?select=id,client_name,email,phone,status,service_area,sms_consent,email_consent,archived_at,raw_payload&order=created_at.asc&offset=${offset}&limit=${pageSize}`
    );
    rows.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }
  return rows;
}

async function campaignAudience(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const requireConsent = body.require_consent !== false;
  const chosenIds = Array.isArray(body.client_ids)
    ? new Set(body.client_ids.map(id => clean(id, 80)).filter(Boolean).slice(0, 500))
    : null;
  const allClients = await loadSendableClients();
  const clients = chosenIds ? allClients.filter(client => chosenIds.has(client.id)) : allClients;
  // Both channels are counted in one pass so the office sees the text audience and
  // the email audience side by side rather than one number for "everyone".
  const channels = Array.isArray(body.channels) && body.channels.length
    ? body.channels.filter(value => ["sms", "email"].includes(value))
    : [body.channel === "sms" ? "sms" : "email"];
  const byChannel = {};
  for (const channel of channels) {
    const { eligible, skipped } = eligibleRecipients(clients, channel, requireConsent);
    byChannel[channel] = { eligible: eligible.length, skipped };
  }
  return { requireConsent, totalClients: clients.length, byChannel };
}

async function createCampaign(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const templateId = clean(body.template_id, 80);
  const rows = await supabaseFetch(`/rest/v1/communications_templates?select=*&id=eq.${encodeURIComponent(templateId)}&limit=1`);
  const template = rows?.[0];
  if (!template) throw Object.assign(new Error("Choose a saved template first."), { status: 400 });
  // A template written for both channels is told which version to send.
  const requested = body.channel === "sms" || body.channel === "email" ? body.channel : "";
  const channel = template.channel === "both"
    ? (requested || "email")
    : (template.channel === "email" ? "email" : "sms");
  if (template.channel === "email" && channel === "sms") throw Object.assign(new Error("That template is an email, so it cannot be sent as a text."), { status: 400 });
  if ((template.channel === "sms" || template.channel === "mms") && channel === "email") throw Object.assign(new Error("That template is a text message, so it cannot be sent as an email."), { status: 400 });
  const requireConsent = body.require_consent !== false;
  const ready = await configurationStatus();
  if (channel === "email" && !ready.resendReady) throw Object.assign(new Error("Email is not configured yet. Add the Resend key and from-address in Settings."), { status: 412 });
  if (channel === "sms" && !ready.simpletextingReady) throw Object.assign(new Error("Texting is not configured yet. Add the SimpleTexting key and sending number in Settings."), { status: 412 });

  const chosenIds = Array.isArray(body.client_ids)
    ? new Set(body.client_ids.map(id => clean(id, 80)).filter(Boolean).slice(0, 500))
    : null;
  const allClients = await loadSendableClients();
  const clients = chosenIds ? allClients.filter(client => chosenIds.has(client.id)) : allClients;
  const { eligible, skipped } = eligibleRecipients(clients, channel, requireConsent);
  if (!eligible.length) throw Object.assign(new Error("Nobody in this selection can receive this message yet."), { status: 400 });

  const campaignRows = await supabaseFetch("/rest/v1/communications_campaigns", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: clean(body.name, 160) || `${template.name} — ${new Date().toISOString().slice(0, 10)}`,
      template_id: template.id,
      channel,
      subject: channel === "email" ? template.subject : null,
      body_html: channel === "email" ? template.body_html : null,
      // Email sends carry the email's own plain-text part; text sends carry the
      // short wording written for a phone.
      body_text: channel === "email" && template.channel === "both"
        ? (htmlToText(template.body_html) || template.body_text)
        : template.body_text,
      audience_filter: { require_consent: requireConsent, skipped, source: "clients" },
      status: "draft",
      total_recipients: eligible.length,
      created_by: access.user.id
    })
  });
  const campaign = campaignRows?.[0];

  // Snapshot the audience now so the send cannot drift while it runs.
  for (let index = 0; index < eligible.length; index += 500) {
    await supabaseFetch("/rest/v1/communications_campaign_recipients?on_conflict=campaign_id,client_id", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify(eligible.slice(index, index + 500).map(item => ({
        campaign_id: campaign.id,
        client_id: item.client.id,
        recipient_email: channel === "email" ? item.address : null,
        recipient_phone: channel === "sms" ? item.address : null,
        status: "queued"
      })))
    });
  }
  await audit(access, "communications_campaign_created", "communications_campaign", campaign.id,
    `Campaign "${campaign.name}" queued for ${eligible.length} ${channel} recipient(s).`, null, { skipped });
  return { campaign, eligible: eligible.length, skipped };
}

async function sendCampaignBatch(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const campaignId = clean(body.campaign_id, 80);
  const campaigns = await supabaseFetch(`/rest/v1/communications_campaigns?select=*&id=eq.${encodeURIComponent(campaignId)}&limit=1`);
  const campaign = campaigns?.[0];
  if (!campaign) throw Object.assign(new Error("That campaign no longer exists."), { status: 404 });
  if (campaign.status === "cancelled") throw Object.assign(new Error("This campaign was stopped."), { status: 409 });

  const queued = await supabaseFetch(
    `/rest/v1/communications_campaign_recipients?select=*&campaign_id=eq.${encodeURIComponent(campaignId)}&status=eq.queued&order=created_at.asc&limit=${CAMPAIGN_BATCH_SIZE}`
  );
  if (!queued?.length) {
    await supabaseFetch(`/rest/v1/communications_campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "completed", sent_by: access.user.id })
    });
    return { done: true, campaign_id: campaignId, sent: campaign.sent_recipients, failed: campaign.failed_recipients };
  }

  const clientIds = queued.map(row => row.client_id);
  const clients = await supabaseFetch(
    `/rest/v1/clients?select=id,client_name,email,phone,service_area,raw_payload,sms_consent,email_consent,status,archived_at&id=in.(${clientIds.join(",")})`
  );
  const clientById = new Map((clients || []).map(client => [client.id, client]));

  let sent = 0;
  let failed = 0;
  for (const recipient of queued) {
    const client = clientById.get(recipient.client_id);
    let outcome = { status: "failed", error: "Client record is no longer available." };
    // Re-check consent at the moment of sending: someone may have opted out while
    // the campaign was queued.
    const consent = client ? (campaign.channel === "email" ? client.email_consent : client.sms_consent) : null;
    if (client && (consent === false || BLOCKED_CLIENT_STATUSES.has(String(client.status || "").toLowerCase()) || client.archived_at)) {
      outcome = { status: "skipped", error: "Opted out or blocked before this batch ran." };
    } else if (client) {
      const details = clientFirstLast(client);
      try {
        if (campaign.channel === "email") {
          const unsubscribe = await unsubscribeUrl(recipient.recipient_email);
          const subject = mergeTemplate(campaign.subject || "A note from Lorenzo's Dog Training Team", details, unsubscribe);
          const html = mergeTemplate(campaign.body_html || campaign.body_text, details, unsubscribe);
          const text = mergeTemplate(campaign.body_text, details, unsubscribe);
          const result = await sendEmail(recipient.recipient_email, subject, html, text, unsubscribe);
          outcome = { status: "sent", id: result.id, subject, body: text };
        } else {
          const text = mergeTemplate(campaign.body_text, details, "");
          const result = await sendSms(recipient.recipient_phone, text);
          outcome = { status: "sent", id: result.id, body: text };
        }
      } catch (error) {
        outcome = { status: "failed", error: clean(error.message, 400) };
      }
    }
    if (outcome.status === "sent") sent += 1;
    else if (outcome.status === "failed") failed += 1;
    await supabaseFetch(`/rest/v1/communications_campaign_recipients?id=eq.${encodeURIComponent(recipient.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: outcome.status,
        provider_message_id: outcome.id || null,
        rendered_subject: outcome.subject || null,
        rendered_body: outcome.body || null,
        error_summary: outcome.error || null,
        sent_at: outcome.status === "sent" ? new Date().toISOString() : null
      })
    });
  }

  const totals = {
    sent_recipients: Number(campaign.sent_recipients || 0) + sent,
    failed_recipients: Number(campaign.failed_recipients || 0) + failed,
    next_offset: Number(campaign.next_offset || 0) + queued.length,
    status: "sending",
    sent_by: access.user.id
  };
  await supabaseFetch(`/rest/v1/communications_campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(totals)
  });
  const remaining = Math.max(0, Number(campaign.total_recipients || 0) - totals.next_offset);
  return { done: false, campaign_id: campaignId, batch: queued.length, sent: totals.sent_recipients, failed: totals.failed_recipients, remaining };
}

async function cancelCampaign(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const campaignId = clean(body.campaign_id, 80);
  await supabaseFetch(`/rest/v1/communications_campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "cancelled" })
  });
  await audit(access, "communications_campaign_cancelled", "communications_campaign", campaignId, "Campaign stopped by the office.");
  return { cancelled: true };
}

// The office has signed consent forms on file. This records that fact against the
// client rows, with who did it and what the paperwork was, instead of anyone
// quietly assuming consent at send time.
async function recordConsent(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const channel = body.channel === "sms" ? "sms" : "email";
  const note = clean(body.note, 400);
  const source = clean(body.source, 120) || "Signed client consent form on file";
  if (!note) throw Object.assign(new Error("Describe the consent paperwork before recording it."), { status: 400 });
  const clients = await loadSendableClients();
  const targets = clients.filter(client => {
    if (client.archived_at || BLOCKED_CLIENT_STATUSES.has(String(client.status || "").toLowerCase())) return false;
    const consent = channel === "email" ? client.email_consent : client.sms_consent;
    if (consent !== null && consent !== undefined) return false;
    const address = channel === "email" ? clean(client.email, 254) : cleanPhone(client.phone);
    return Boolean(address);
  });
  const stamp = new Date().toISOString();
  for (let index = 0; index < targets.length; index += 200) {
    const chunk = targets.slice(index, index + 200);
    await supabaseFetch(`/rest/v1/clients?id=in.(${chunk.map(client => client.id).join(",")})`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify(channel === "email"
        ? { email_consent: true, email_consent_at: stamp, consent_source: source, consent_note: note }
        : { sms_consent: true, sms_consent_at: stamp, consent_source: source, consent_note: note })
    });
  }
  await audit(access, "communications_consent_recorded", "clients", channel,
    `${actorName(access)} recorded ${channel} consent for ${targets.length} client(s). Basis: ${note}`);
  return { updated: targets.length, channel };
}

// Staff need to message someone who is not on the imported list yet. Rather than a
// throwaway address, the person becomes a real client record so the send is logged
// against them like everyone else.
async function addRecipient(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const name = clean(body.name, 180);
  const email = clean(body.email, 254).toLowerCase();
  const phone = cleanPhone(body.phone);
  if (!name) throw Object.assign(new Error("Enter the person's name."), { status: 400 });
  if (!email && !phone) throw Object.assign(new Error("Add a mobile number or an email address."), { status: 400 });
  if (email && !EMAIL_SHAPE.test(email)) throw Object.assign(new Error("That email address does not look right."), { status: 400 });

  const filters = [];
  if (email) filters.push(`email.ilike.${email}`);
  if (phone) filters.push(`phone.eq.${phone}`);
  const existing = await supabaseFetch(`/rest/v1/clients?select=id,client_name,email,phone,service_area,raw_payload&or=(${filters.join(",")})&limit=1`);
  if (existing?.length) return { client: existing[0], existed: true };

  const parts = name.split(/\s+/);
  const rows = await supabaseFetch("/rest/v1/clients", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      client_name: name,
      email: email || null,
      phone: phone || null,
      service_area: clean(body.city, 120) || null,
      status: "active",
      // Consent stays unknown; the office records it deliberately, as everywhere else.
      imported_source: "Added by office",
      raw_payload: { first_name: parts[0] || "", last_name: parts.slice(1).join(" "), city: clean(body.city, 120), added_by: actorName(access) }
    })
  });
  const client = rows?.[0];
  await audit(access, "client_added_for_message", "clients", client.id, `${actorName(access)} added ${name} as a message recipient.`);
  return { client, existed: false };
}

// The browser only holds the most recent clients, so anyone older is found here.
async function searchClients(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const term = clean(body.term, 120);
  if (term.length < 2) return { clients: [], term };
  const escaped = term.replace(/[,()*]/g, " ").trim();
  if (!escaped) return { clients: [], term };
  const pattern = `*${escaped}*`;
  const rows = await supabaseFetch(
    `/rest/v1/clients?select=id,client_name,email,phone,service_area,status,sms_consent,email_consent`
    + `&or=(client_name.ilike.${encodeURIComponent(pattern)},email.ilike.${encodeURIComponent(pattern)},phone.ilike.${encodeURIComponent(pattern)})`
    + `&archived_at=is.null&order=client_name.asc&limit=25`
  );
  return { clients: rows || [], term };
}

async function campaignReport(access, body) {
  if (!isAdmin(access)) throw Object.assign(new Error("Admin access required."), { status: 403 });
  const campaignId = clean(body.campaign_id, 80);
  if (!campaignId) {
    const campaigns = await supabaseFetch("/rest/v1/communications_campaigns?select=*&order=created_at.desc&limit=50");
    return { campaigns };
  }
  const [campaigns, recipients] = await Promise.all([
    supabaseFetch(`/rest/v1/communications_campaigns?select=*&id=eq.${encodeURIComponent(campaignId)}&limit=1`),
    supabaseFetch(`/rest/v1/communications_campaign_recipients?select=id,client_id,recipient_email,recipient_phone,status,error_summary,provider_message_id,sent_at,updated_at&campaign_id=eq.${encodeURIComponent(campaignId)}&order=updated_at.desc&limit=500`)
  ]);
  const campaign = campaigns?.[0];
  if (!campaign) throw Object.assign(new Error("That send no longer exists."), { status: 404 });
  const ids = [...new Set((recipients || []).map(row => row.client_id).filter(Boolean))].slice(0, 500);
  const clients = ids.length
    ? await supabaseFetch(`/rest/v1/clients?select=id,client_name&id=in.(${ids.join(",")})`)
    : [];
  const nameById = new Map((clients || []).map(client => [client.id, client.client_name]));
  const counts = (recipients || []).reduce((totals, row) => {
    totals[row.status] = (totals[row.status] || 0) + 1;
    return totals;
  }, {});
  return {
    campaign,
    counts,
    recipients: (recipients || []).map(row => ({ ...row, client_name: nameById.get(row.client_id) || "Client" }))
  };
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
    else if (operation === "campaign_audience") data = await campaignAudience(access, req.body || {});
    else if (operation === "create_campaign") data = await createCampaign(access, req.body || {});
    else if (operation === "send_campaign_batch") data = await sendCampaignBatch(access, req.body || {});
    else if (operation === "cancel_campaign") data = await cancelCampaign(access, req.body || {});
    else if (operation === "record_consent") data = await recordConsent(access, req.body || {});
    else if (operation === "add_recipient") data = await addRecipient(access, req.body || {});
    else if (operation === "search_clients") data = await searchClients(access, req.body || {});
    else if (operation === "campaign_report") data = await campaignReport(access, req.body || {});
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
