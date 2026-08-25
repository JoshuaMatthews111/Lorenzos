const { blockedInSandbox } = require("../lib/sandbox");
const crypto = require("node:crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const CONTACT_GOOGLE = "https://docs.google.com/forms/d/e/1FAIpQLSdV1-0yBlRusq9tkjymZKm_BfXfpmMKDDrcyqfP3KbEq-Qd_g/formResponse";
const APPLICATION_GOOGLE = "https://docs.google.com/forms/d/e/1FAIpQLSdm5gkPQl4LwPVIGZZQbOGYA05le1xMUybMngJIyWKeDmlF5Q/formResponse";
const CONTACT_EMAIL = "https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com";
const APPLICATION_EMAIL = "https://formsubmit.co/ajax/recruiting@lorenzosdogtrainingteam.com";

const CONTACT_FIELDS = {
  trainer_name: "entry.732274329", first_name: "entry.2076204969", last_name: "entry.1657690671",
  address_line_1: "entry.1231537394", address_line_2: "entry.1987365575", city: "entry.375426998",
  state: "entry.114802361", zip: "entry.416673611", email: "entry.1949246301", phone: "entry.503719735",
  i_want_to: "entry.270700046", heard_about_us: "entry.1942005538",
  vet_or_previous_client: "entry.1616503040", comments: "entry.1517896175"
};

const APPLICATION_FIELDS = {
  referral_source: "entry.1014703398", first_name: "entry.2122990920", last_name: "entry.1929607028",
  address_line_1: "entry.1645633690", address_line_2: "entry.135249690", city: "entry.1748202742",
  state: "entry.2020991517", zip: "entry.571508260", email: "entry.1253830522", phone: "entry.800594511",
  birthdate: "entry.873028304", legally_eligible: "entry.97737336", drug_test: "entry.1275212285",
  felony: "entry.1958281416", felony_explanation: "entry.815056594", conviction_date: "entry.1143329636",
  release_date: "entry.1439310749", comfortable_dogs: "entry.670957847", dog_bite_history: "entry.1707158396",
  dog_bite_explanation: "entry.2145345523", owns_dogs: "entry.1988135929",
  owned_dogs_description: "entry.1094860147", physical_condition: "entry.227429315", workout: "entry.102480538",
  lift_100: "entry.601987128", run_2_miles: "entry.1532917240", smoke: "entry.713607391",
  team_player: "entry.66684546", reliable_vehicle: "entry.1724490144", drivers_license: "entry.1218423081",
  cleveland_training: "entry.888408530", education_level: "entry.793600705", high_school: "entry.1953995847",
  trade_school: "entry.1490513837", military: "entry.2056174117", college: "entry.1815093587",
  additional_training: "entry.793731999",
  employment_1_company: "entry.1488216150", employment_1_country: "entry.714246596",
  employment_1_address: "entry.395257221", employment_1_city: "entry.964388364",
  employment_1_state: "entry.2100450771", employment_1_zip: "entry.274112135",
  employment_1_status: "entry.1554856963", employment_1_start_date: "entry.820232514",
  employment_1_end_date: "entry.1071602769", employment_1_job_title: "entry.756139358",
  employment_1_salary: "entry.2042956180", employment_1_reason: "entry.1045830789",
  employment_2_company: "entry.1443831840", employment_2_country: "entry.1175062898",
  employment_2_address: "entry.642818623", employment_2_city: "entry.1080427807",
  employment_2_state: "entry.1790378360", employment_2_zip: "entry.1826574956",
  employment_2_status: "entry.1922536714", employment_2_start_date: "entry.575992373",
  employment_2_end_date: "entry.288413258", employment_2_job_title: "entry.1708812599",
  employment_2_salary: "entry.1872315917", employment_2_reason: "entry.667445931",
  employment_3_company: "entry.800567808", employment_3_country: "entry.938860105",
  employment_3_address: "entry.331449172", employment_3_city: "entry.1787546636",
  employment_3_state: "entry.330991090", employment_3_zip: "entry.149620483",
  employment_3_status: "entry.751506828", employment_3_start_date: "entry.531104459",
  employment_3_end_date: "entry.1541940157", employment_3_job_title: "entry.66305101",
  employment_3_salary: "entry.1444857719", employment_3_reason: "entry.1881584314",
  signature: "entry.1320607832"
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function clean(value, max = 10000) {
  return String(value ?? "").trim().slice(0, max);
}

function allowedOrigin(req) {
  const origin = clean(req.headers.origin, 500);
  if (!origin) return true;
  return /^https:\/\/(?:www\.)?lorenzosdogtrainingteam\.com$/i.test(origin)
    || /^https:\/\/[^/]+\.vercel\.app$/i.test(origin)
    || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
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
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.error || text || `Supabase request failed (${response.status})`);
  return data;
}

async function verifyCanonical(submissionId, canonical) {
  const entityType = canonical?.application_id ? "application" : "lead";
  const table = entityType === "application" ? "trainer_applications" : "leads";
  const id = clean(canonical?.application_id || canonical?.lead_id, 120);
  if (!id || !submissionId) return null;
  const rows = await supabaseFetch(
    `/rest/v1/${table}?select=id,source_submission_id&id=eq.${encodeURIComponent(id)}&source_submission_id=eq.${encodeURIComponent(submissionId)}&limit=1`
  );
  return rows?.[0] ? { entityType, id } : null;
}

function appendGoogleValue(params, field, value, otherValue = "") {
  const text = clean(value);
  if (!text) return;
  if (text === "Other") {
    params.append(field, "__other_option__");
    params.append(`${field}.other_option_response`, clean(otherValue) || "Other / website contact form");
    return;
  }
  params.append(field, text);
  const date = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (date) {
    params.append(`${field}_year`, date[1]);
    params.append(`${field}_month`, String(Number(date[2])));
    params.append(`${field}_day`, String(Number(date[3])));
  }
}

function appendSheetLine(value, line) {
  return [clean(value), clean(line)].filter(Boolean).join("\n\n");
}

function entriesForGoogleSheet(formType, entries) {
  const copy = { ...entries };
  const smsOptIn = clean(copy.sms_consent).toLowerCase() === "yes" ? "Yes" : "No";
  const consentLines = [`SMS opt-in: ${smsOptIn}`];
  if (copy.sms_consent_text) consentLines.push(`SMS disclosure: ${clean(copy.sms_consent_text)}`);
  if (copy.phone_required_notice_text) consentLines.push(`Phone notice: ${clean(copy.phone_required_notice_text)}`);
  if (copy.application_certification || copy.application_certification_text) {
    consentLines.push(`Application certification: ${clean(copy.application_certification_text || copy.application_certification)}`);
  }
  if (copy.additional_interest) consentLines.push(`Additional interest: ${clean(copy.additional_interest)}`);
  const consentNote = consentLines.join("\n");
  if (formType === "trainer_application") {
    copy.additional_training = appendSheetLine(copy.additional_training, consentNote);
  } else {
    copy.comments = appendSheetLine(copy.comments, consentNote);
  }
  return copy;
}

async function logAttempt({ submissionId, entityType, entityId, destination, status, requestId, error, payloadHash }) {
  const existing = await supabaseFetch(
    `/rest/v1/form_delivery_attempts?select=attempt_count&submission_id=eq.${encodeURIComponent(submissionId)}&destination=eq.${encodeURIComponent(destination)}&order=attempt_count.desc&limit=1`
  );
  const attemptCount = Number(existing?.[0]?.attempt_count || 0) + 1;
  await supabaseFetch("/rest/v1/form_delivery_attempts", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      submission_id: submissionId,
      entity_type: entityType,
      entity_id: entityId,
      destination,
      status,
      request_id: requestId,
      error_summary: error ? clean(error.message || error, 1000) : null,
      payload_hash: payloadHash,
      attempt_count: attemptCount
    })
  });
}

async function acceptedDelivery(submissionId, destination, payloadHash) {
  const rows = await supabaseFetch(
    `/rest/v1/form_delivery_attempts?select=id,request_id&submission_id=eq.${encodeURIComponent(submissionId)}&destination=eq.${encodeURIComponent(destination)}&status=eq.accepted&payload_hash=eq.${encodeURIComponent(payloadHash)}&limit=1`
  );
  return rows?.[0] || null;
}

async function deliverGoogle(endpoint, mapping, entries) {
  const params = new URLSearchParams();
  Object.entries(mapping).forEach(([name, field]) => appendGoogleValue(params, field, entries[name], entries[`${name}_other`]));
  params.append("fvv", "1");
  params.append("pageHistory", "0");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: params,
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`Google Form response Sheet returned ${response.status}`);
}

async function deliverEmail(endpoint, subject, entries) {
  const form = new FormData();
  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
  });
  form.set("_subject", subject);
  form.set("_template", "table");
  form.set("_captcha", "false");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://www.lorenzosdogtrainingteam.com",
      Referer: "https://www.lorenzosdogtrainingteam.com/contact.html",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    },
    body: form
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok || String(data.success).toLowerCase() === "false") throw new Error(data.message || `Email relay returned ${response.status}`);
}

module.exports = async function handler(req, res) {
  // The sandbox reads live records but is never allowed to change them.
  if (blockedInSandbox(res, "Submitting this form")) return;
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured." });
  try {
    if (!allowedOrigin(req)) return res.status(403).json({ ok: false, message: "This form origin is not allowed." });
    if (Number(req.headers["content-length"] || 0) > 250000) return res.status(413).json({ ok: false, message: "Form payload is too large." });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const formType = clean(body.form_type, 40);
    const entries = body.entries && typeof body.entries === "object" ? body.entries : {};
    if (clean(entries.company_website, 200)) return res.status(200).json({ ok: true, canonical: false, spam_filtered: true });
    if (JSON.stringify(entries).length > 220000) return res.status(413).json({ ok: false, message: "Form payload is too large." });
    const submissionId = clean(entries.submission_id, 160);
    const canonical = await verifyCanonical(submissionId, body.canonical);
    if (!canonical) return res.status(409).json({ ok: false, message: "The canonical Supabase form record could not be verified." });

    const requestId = crypto.randomUUID();
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(entries)).digest("hex");
    const clientDelivery = body.client_delivery && typeof body.client_delivery === "object" ? body.client_delivery : null;
    if (clientDelivery) {
      const destination = clean(clientDelivery.destination, 80);
      const status = clean(clientDelivery.status, 40);
      if (destination !== "formsubmit_email" || !["accepted", "failed"].includes(status)) {
        return res.status(400).json({ ok: false, message: "Unsupported client delivery result." });
      }
      await logAttempt({
        submissionId,
        entityType: canonical.entityType,
        entityId: canonical.id,
        destination,
        status,
        requestId,
        error: status === "failed" ? clean(clientDelivery.error, 1000) || "Browser delivery failed" : null,
        payloadHash
      });
      return res.status(200).json({ ok: true, canonical: true, delivery_complete: status === "accepted", request_id: requestId });
    }

    await logAttempt({ submissionId, entityType: canonical.entityType, entityId: canonical.id, destination: "supabase", status: "accepted", requestId, payloadHash });

    const isApplication = formType === "trainer_application";
    const isDiscoveryApplication = isApplication && clean(entries.inquiry_type) === "discovery_call";
    if (isDiscoveryApplication) {
      entries.trainer_name = entries.trainer_name || `Recruiting / ${clean(entries.opportunity_market || entries.market_city) || "Trainer opportunity"}`;
      entries.address_line_1 = entries.address_line_1 || "Trainer opportunity inquiry";
      entries.i_want_to = "Learn more about becoming a dog trainer";
      entries.heard_about_us = "Other";
      entries.heard_about_us_other = clean(entries.referral_source) || "Paid trainer recruiting ad";
      entries.vet_or_previous_client = entries.vet_or_previous_client || "Not applicable";
      entries.comments = [
        clean(entries.additional_training),
        clean(entries.opportunity_market) ? `Opportunity market: ${clean(entries.opportunity_market)}` : "",
        clean(entries.source_page) ? `Source page: ${clean(entries.source_page)}` : ""
      ].filter(Boolean).join("\n\n");
    } else if (isApplication) {
      entries.employment_1_country = entries.employment_1_country || "United States";
      if (entries.employment_2_company) entries.employment_2_country = entries.employment_2_country || "United States";
      if (entries.employment_3_company) entries.employment_3_country = entries.employment_3_country || "United States";
    } else {
      entries.trainer_name = entries.trainer_name || entries.assigned_trainer || "Office / Not sure";
      entries.address_line_1 = entries.address_line_1 || entries.landing_page_type || "Website inquiry";
      entries.city = entries.city || entries.trainer_city || "Not provided";
      entries.state = entries.state || entries.trainer_state || "Not provided";
      const allowedIntents = new Set([
        "Schedule a free phone consultation to receive more information",
        "Schedule an in person evaluation with a trainer in my area",
        "Schedule a virtual evaluation",
        "Schedule a training session with my dog trainer",
        "Learn more about becoming a dog trainer"
      ]);
      if (!allowedIntents.has(clean(entries.i_want_to))) {
        entries.google_sheet_original_intent = clean(entries.i_want_to || entries.service_interest);
        entries.i_want_to = "Schedule a free phone consultation to receive more information";
      }
      const allowedReferrals = new Set([
        "My Veternarian", "My Dog Walker", "My Dog Groomer", "My Pet Store", "My Neighbor",
        "Your Website", "Your Trainer", "A Former Client", "Is a past client", "Referred by a past client", "Google Search", "Facebook or Instagram", "Other"
      ]);
      if (!allowedReferrals.has(clean(entries.heard_about_us))) {
        entries.heard_about_us_other = clean(entries.heard_about_us) || "Website / paid advertising";
        entries.heard_about_us = "Other";
      }
    }

    const deliveries = [
      {
        destination: "google_form_sheet",
        run: () => deliverGoogle(
          isApplication && !isDiscoveryApplication ? APPLICATION_GOOGLE : CONTACT_GOOGLE,
          isApplication && !isDiscoveryApplication ? APPLICATION_FIELDS : CONTACT_FIELDS,
          entriesForGoogleSheet(isApplication && !isDiscoveryApplication ? "trainer_application" : "contact", entries)
        )
      },
      {
        destination: "formsubmit_email",
        run: () => deliverEmail(
          isApplication || canonical.entityType === "application" ? APPLICATION_EMAIL : CONTACT_EMAIL,
          isApplication || canonical.entityType === "application"
            ? "New Lorenzo's Dog Training Team Trainer Application"
            : "New Lorenzo's Dog Training Team Contact Form Submission",
          entries
        )
      }
    ];

    const results = [];
    for (const delivery of deliveries) {
      const accepted = await acceptedDelivery(submissionId, delivery.destination, payloadHash);
      if (accepted) {
        results.push({ destination: delivery.destination, status: "accepted", reused: true });
        continue;
      }
      try {
        await delivery.run();
        await logAttempt({ submissionId, entityType: canonical.entityType, entityId: canonical.id, destination: delivery.destination, status: "accepted", requestId, payloadHash });
        results.push({ destination: delivery.destination, status: "accepted" });
      } catch (error) {
        await logAttempt({ submissionId, entityType: canonical.entityType, entityId: canonical.id, destination: delivery.destination, status: "failed", requestId, error, payloadHash });
        results.push({ destination: delivery.destination, status: "failed" });
      }
    }
    return res.status(200).json({
      ok: true,
      canonical: true,
      delivery_complete: results.every(result => result.status === "accepted"),
      request_id: requestId,
      deliveries: results
    });
  } catch (error) {
    console.error("Form delivery API error", error);
    return res.status(500).json({ ok: false, message: error.message || "Form delivery could not be logged." });
  }
};
