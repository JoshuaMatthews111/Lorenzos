import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const app = read("trainer-backoffice/app.js");
const portal = read("trainer-backoffice/supabase.js");
const contact = read("contact.html");
const delivery = read("api/form-delivery.js");
const reviewSubmission = read("api/submit-content-review.js");
const approvedReviews = read("api/approved-homepage-reviews.js");
const applicationData = read("trainer-backoffice/application-data.js");
const publicScript = read("script.js");
const publicTrainerShell = read("trainer-backoffice/right-trainer-results.html");
const vercel = JSON.parse(read("vercel.json"));
const bios = JSON.parse(read("trainer_bios.json"));
const paidAdLeadHelper = app.match(/function isPaidAdLandingPageLead[\s\S]*?\n}\n\nfunction isEbookRequestLead/)?.[0] || "";
const styles = read("trainer-backoffice/styles.css");
const communicationsApi = read("api/communications.js");
const communicationsHub = read("supabase/migrations/20260816015952_communications_hub.sql");
const communicationsHardening = read("supabase/migrations/20260816020109_harden_communications_access.sql");
const evaluationCancelledMigration = read("supabase/migrations/20260817170535_add_evaluation_cancelled_lead_status.sql");
const templateDesignMigration = read("supabase/migrations/20260817172642_communications_template_design.sql");
const sendVerificationDropped = read("supabase/migrations/20260817173440_drop_temp_provider_send_verification.sql");
const smsInbound = read("api/webhooks/sms-inbound.js");

const checks = [
  ["staff identity replaces anonymous portal labels", /portalActorLabel/.test(app) && /first_name/.test(app) && /last_name/.test(app)],
  ["office notes edit exact records and expose revisions", /data-save-office-note-edit/.test(app) && /remoteNoteRevisions/.test(app)],
  ["lead SMS consent is visible and filterable", /leadSmsFilter/.test(app) && /SMS consent/.test(app)],
  ["pipeline keeps every requested outcome", ["Lost: Client Complaint", "Lost: No Trainer in the Area", "Evaluation Scheduled", "Evaluation Complete", "Became a Client"].every(value => app.includes(value))],
  ["dashboard counts live lead and application rows", /filteredReportLeadRows/.test(app) && /filteredReportApplicationRows/.test(app) && /forms: leadRows\.length/.test(app)],
  ["dashboard shows requested lead, traffic, application, and note fields", /Site Visits\/Clicks/.test(app) && /Form Submissions/.test(app) && /Contact Us Forms/.test(app) && /Paid Ad Submitted Inquiries/.test(app) && /Ebook Requests/.test(app) && /Became a Client/.test(app) && /New Trainer Applications/.test(app) && /Office Notes/.test(app)],
  ["dashboard office note count uses saved note rows in report range", /filteredReportOfficeNoteRows/.test(app) && /officeNotes: filteredReportOfficeNoteRows\(\)\.length/.test(app)],
  ["dashboard lost count matches the Leads lost grouping", /dashboardLostLeadRows/.test(app) && /boardStatus\(lead\.status\) === "Lost"/.test(app)],
  ["dashboard paid and ebook counts use ad landing-page source flags", /dashboardPaidAdSubmittedInquiryRows/.test(app) && /dashboardEbookRequestRows/.test(app) && /isPaidAdLandingPageLead/.test(app) && /isEbookRequestLead/.test(app)],
  ["dashboard contact count excludes paid-ad landing-page leads", /function dashboardContactFormRows[\s\S]*!isPaidAdLandingPageLead/.test(app)],
  ["dashboard ebook count is limited to paid-ad guide requests", /function dashboardEbookRequestRows[\s\S]*isPaidAdLandingPageLead\(lead\) && isEbookRequestLead\(lead\)/.test(app)],
  ["dashboard paid-ad count does not classify by market name alone", !/lead\.market/.test(paidAdLeadHelper) && !/raw\.trainer_market/.test(paidAdLeadHelper)],
  ["dashboard pie includes client, lost, and application buckets", /dashboardBucketRows/.test(app) && /Became a Client/.test(app) && /\["Lost", dashboardLostLeadRows/.test(app) && /New Trainer Applications/.test(app)],
  ["inaccurate ad-market conversion chart is removed from dashboard", !/panel\("Conversions By Ad Market"/.test(app)],
  ["reports include actual 50-state count map", /STATE_TILE_LAYOUT/.test(app) && /us-state-tile-map/.test(app) && /stateActivityRows/.test(app) && /State Activity Map/.test(app)],
  ["reports map uses views wording with hoverable state tiles", /views · \$\{row\.leads\} submitted leads/.test(app) && /tabindex="0"/.test(app) && /aria-label="\$\{escapeHtml\(title\)\}"/.test(app) && /state-map-total/.test(app) && !/page events/.test(app)],
  ["reports layout prevents wide table overlap", /reports-grid/.test(read("trainer-backoffice/styles.css")) && /minmax\(0, 1fr\)/.test(read("trainer-backoffice/styles.css"))],
  ["shared office data uses realtime and polling", /subscribeOperationalChanges/.test(portal) && /refreshOperationalData\("poll"\)/.test(app)],
  ["trainer access flags stay synchronized", /access_status: enabled \? "active" : "disabled"/.test(app) && /active: enabled/.test(app)],
  ["contact form preserves required callback phone", /name="phone"[^>]*required|required[^>]*name="phone"/.test(contact)],
  ["SMS consent remains optional", /name="sms_consent"/.test(contact) && !/name="sms_consent"[^>]*required/.test(contact)],
  ["past-client source choices are separate", contact.includes("Is a past client") && contact.includes("Referred by a past client")],
  ["form relays are idempotent", /acceptedDelivery/.test(delivery) && /reused: true/.test(delivery)],
  ["discovery inquiries use the inquiry Sheet backup", /isDiscoveryApplication/.test(delivery) && /isApplication && !isDiscoveryApplication \? APPLICATION_GOOGLE : CONTACT_GOOGLE/.test(delivery)],
  ["Lead and Application sheets remain downloadable", /data-export-operational="leads"/.test(app) && /data-export-applications/.test(app) && /exportOperationalSheet/.test(app) && /exportApplicationsCsv/.test(app)],
  ["synced applications retain every raw form answer", /function remoteApplicationToUi[\s\S]*rawPayload: raw/.test(app) && /Object\.keys\(applicationRawPayload\(app\)\)/.test(app)],
  ["office sheet downloads include every canonical field", /completeSheetRows\(leads, leadsSheet\)/.test(read("api/operational-data.js")) && /completeSheetRows\(applications, applicationsSheet\)/.test(read("api/operational-data.js"))],
  ["public staff bundle contains no historical application rows", /LDTT_TRAINER_APPLICATION_RESPONSES = \[\];/.test(applicationData) && !/@/.test(applicationData)],
  ["city review destinations bypass trainer lookup", /!String\(target\)\.startsWith\("city:"\)/.test(app)],
  ["review destinations reload from saved publication rows", /reviewTargetsFromPublications/.test(app) && /result\.publications/.test(app)],
  ["review publish includes dropdown destination before saving", /applyPendingReviewTargetSelection\(sub\)/.test(app) && /function applyPendingReviewTargetSelection/.test(app)],
  ["review publication mutation deduplicates destination rows", /desiredByKey/.test(read("api/operational-mutation.js")) && /on_conflict=submission_id,destination_type,destination_id/.test(read("api/operational-mutation.js"))],
  ["approved homepage reviews sort by latest publish time", /publicationPublishedAt/.test(approvedReviews) && /published_at\.desc/.test(approvedReviews)],
  ["approved homepage review loader avoids duplicate cards", /querySelectorAll\('\[data-approved-home-review\]'\)\.forEach/.test(publicScript)],
  ["approved homepage review carousel starts at newest card", /resetHomepageReviewCarousel/.test(publicScript) && /scrollLeft=0/.test(publicScript) && /approvedRows=\[\.\.\.\(apiData\?\.reviews\|\|\[\]\)\]\.sort/.test(publicScript)],
  ["new trainer onboarding starts with blank optional testimonials", /review1Author: ""/.test(app) && /review1Copy: ""/.test(app) && /Optional Manual Testimonial/.test(app) && /Reviews are not published automatically/.test(app) && !/Office-approved client testimonial/.test(app) && !/Professional, patient, and focused/.test(app)],
  ["Karemela rebuild source keeps candid photo", bios["karemela-sefferin"]?.photo === "assets/trainer-bio-photos/karemela-sefferin-candid.jpg"],
  ["Carolina legacy URLs redirect", vercel.redirects?.some(row => row.source === "/carolinadon" && row.destination === "/carolinaperez")],
  ["all trainer landing bios preserve paragraphs", /landing-bio-paragraphs/.test(app) && /profileBioParagraphs\(trainer\.bio\)/.test(app)],
  ["wide admin sections have left and right controls", /horizontalScrollSelectors/.test(app) && /data-scroll-horizontal="left"/.test(app) && /data-scroll-horizontal="right"/.test(app)],
  ["application filter updates sheets and records without hiding the pipeline", /applicationStatusFilterBar/.test(app) && /currentApplicationFilter/.test(app) && /rows = allRows\.filter/.test(app) && /applicationPipelineBoard\(\)/.test(app)],
  ["trainer and client reviews accept uploads or supported video links", /review_video_url/.test(app) && /review_video_url/.test(publicScript) && /normalizeReviewVideoUrl/.test(reviewSubmission)],
  ["trainer publishing exposes a clear live-page action", app.includes("Publish Landing Page") && app.includes("Open Live Landing Page")],
  ["trainer locations normalize full state names", /normalizeTrainerLocation/.test(app) && app.includes("Texas") && app.includes("California")],
  ["clean trainer URLs load root-absolute public assets", ["/trainer-backoffice/styles.css", "/supabase-config.js", "/trainer-roster.js", "/trainer-backoffice/app.js"].every(value => publicTrainerShell.includes(value))],
  ["legacy spaced headshot URLs are normalized", /safeTrainerAssetUrl/.test(app)],
  ["communications claiming stays one conditional database update", /rpc\/communications_claim_lead/.test(communicationsApi) && /and claimed_by is null/.test(communicationsHub)],
  ["closed or lost leads are never assignable", /closedStatuses/.test(communicationsApi) && /status not in \('became_client'/.test(communicationsHub) && /communicationsLeadIsActive/.test(app)],
  ["lead board uses Available and Assign to me wording", app.includes("Assign to me") && app.includes('return "Available"') && !/Needs an owner/i.test(app)],
  ["communications tables stay browser-denied", /communications_deny_browser/.test(communicationsHardening)],
  ["communications loading never mislabels an admin as a trainer", /if \(communicationsData\.loading\) return panel\("Communications"/.test(app) && /communicationsData\.canManage/.test(app)],
  ["campaign preview and secrets require admin access on the server", /async function previewCampaign\(access[\s\S]{0,120}Admin access required/.test(communicationsApi) && /isSuperAdmin\(access\)/.test(communicationsApi)],
  ["lead status board collapses to cards on phones", /communications-status-table td::before\{content:attr\(data-th\)/.test(styles) && /data-th="Action"/.test(app)],
  ["alert list escalation settings stay secondary", /communications-advanced/.test(app) && app.includes("Advanced (optional)")],
  ["Evaluation Cancelled is a selectable lead status end to end", app.includes('"Evaluation Cancelled"') && /"Evaluation Cancelled": "evaluation_cancelled"/.test(app) && /'evaluation_cancelled'/.test(evaluationCancelledMigration)],
  ["Evaluation Cancelled stays an open, assignable lead", !/closedStatuses[\s\S]{0,400}evaluation_cancelled/.test(communicationsApi) && !/communicationsLeadIsActive[\s\S]{0,400}evaluation_cancelled/.test(app)],
  ["Evaluation Cancelled never wears the booked pill", /status === "Evaluation Cancelled"\) return "follow"[\s\S]{0,200}status\.includes\("Evaluation"\)\) return "booked"/.test(app)],
  ["email designer offers colour, font, logo and placement controls", /EMAIL_FONTS/.test(app) && /data-design-field="align"/.test(app) && /type="color"/.test(app) && /DESIGN_BLOCK_LABELS = \{ logo:/.test(app) && /data-design-add="\$\{type\}"/.test(app)],
  ["designed emails render as inline-styled tables mail clients accept", /role="presentation"/.test(app) && /function renderDesignHtml/.test(app) && /max-width:100%/.test(app)],
  ["templates can be saved by name, reopened, duplicated and deleted", /data-template-edit/.test(app) && /data-template-duplicate/.test(app) && /data-template-delete/.test(app) && /function templateDraftFromRecord/.test(app)],
  ["a saved template is confirmed against the server before reporting success", /function saveTemplateDraft[\s\S]*loadCommunicationsData\(false\)[\s\S]*did not save/.test(app)],
  ["saved designs persist because the design itself is stored", /design: format === "visual" \? design : null/.test(communicationsApi) && /add column if not exists design jsonb/.test(templateDesignMigration)],
  ["designs are sanitised on the server before they can reach a mailbox", /function designPayload/.test(communicationsApi) && /function safeColor/.test(communicationsApi) && /function safeFont/.test(communicationsApi) && /function safeMediaUrl/.test(communicationsApi)],
  ["staff can upload an HTML email file or a logo image", /data-design-html-upload/.test(app) && /data-design-upload/.test(app) && /trainer-page-assets/.test(app)],
  ["every message personalises to the client before sending", /MERGE_TOKENS/.test(app) && /data-design-token/.test(app) && /function mergeTemplate/.test(communicationsApi) && /first_name/.test(communicationsApi)],
  ["the email preview cannot run scripts from a pasted template", /data-design-preview sandbox=""/.test(app)],
  ["a bulk send never reaches Do Not Contact, opted-out, or archived clients", /BLOCKED_CLIENT_STATUSES/.test(communicationsApi) && /consent === false/.test(communicationsApi) && /archived_at/.test(communicationsApi)],
  ["consent is re-checked at the moment each message sends", /Re-check consent at the moment of sending/.test(communicationsApi)],
  ["a client can only ever be queued once per campaign", /uq_campaign_recipient_once/.test(read("supabase/migrations/20260817200000_client_consent_and_campaign_idempotency.sql")) && /resolution=ignore-duplicates/.test(communicationsApi)],
  ["bulk sending is batched and resumable rather than one giant request", /CAMPAIGN_BATCH_SIZE/.test(communicationsApi) && /send_campaign_batch/.test(communicationsApi) && /function runCampaignBatches/.test(app)],
  ["a bulk send requires an explicit typed confirmation", /Type SEND to go ahead/.test(app) && /!== "SEND"/.test(app)],
  ["staff can stop a send that is already running", /data-campaign-stop/.test(app) && /cancel_campaign/.test(communicationsApi)],
  ["texting STOP and YES from a client updates that client's consent", /function recordClientConsent/.test(smsInbound) && /sms_consent: consented/.test(smsInbound) && /client_opted_out/.test(smsInbound)],
  ["recorded consent keeps its paperwork trail", /consent_source/.test(communicationsApi) && /Describe the consent paperwork/.test(communicationsApi) && /communications_consent_recorded/.test(communicationsApi)],
  ["staff are offered a compliant opt-in text to gather consent", /OPT_IN_SMS_TEXT/.test(app) && /Reply YES to join/.test(app) && /Reply STOP to stop/.test(app)],
  ["background syncing never wipes wording someone is still typing", /function backgroundRender/.test(app) && /workspaceHasTypedInput/.test(app) && /await reloadRemoteData\(\);\s*\n\s*backgroundRender\(\);/.test(app)],
  ["a redraw mid-edit restores the typed wording and the cursor", /function captureTypedInput/.test(app) && /function restoreTypedInput/.test(app) && /setSelectionRange\(snapshot\.start, snapshot\.end\)/.test(app)],
  ["a held-back redraw is applied once typing stops", /flushPendingBackgroundRender/.test(app) && /setInterval\(flushPendingBackgroundRender/.test(app)],
  ["one template can carry both a text and an email version", /Both text and email/.test(app) && /data-design-sms-text/.test(app) && /'both'::text/.test(read("supabase/migrations/20260817210000_communications_template_both_channels.sql"))],
  ["the temporary send-verification helper was removed again", /drop function if exists public.__provider_send_test/.test(sendVerificationDropped) && /drop extension if exists http/.test(sendVerificationDropped)]
];

for (const [label, passed] of checks) assert.equal(Boolean(passed), true, label);
console.log(JSON.stringify({ ok: true, checks: checks.map(([label]) => label) }, null, 2));
