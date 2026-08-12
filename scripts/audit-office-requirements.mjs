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

const checks = [
  ["staff identity replaces anonymous portal labels", /portalActorLabel/.test(app) && /first_name/.test(app) && /last_name/.test(app)],
  ["office notes edit exact records and expose revisions", /data-save-office-note-edit/.test(app) && /remoteNoteRevisions/.test(app)],
  ["lead SMS consent is visible and filterable", /leadSmsFilter/.test(app) && /SMS consent/.test(app)],
  ["pipeline keeps every requested outcome", ["Lost: Client Complaint", "Lost: No Trainer in the Area", "Evaluation Scheduled", "Evaluation Complete", "Became a Client"].every(value => app.includes(value))],
  ["dashboard counts live lead and application rows", /filteredReportLeadRows/.test(app) && /filteredReportApplicationRows/.test(app) && /forms: leadRows\.length/.test(app)],
  ["dashboard shows only requested lead and application fields", /Contact Us Forms/.test(app) && /Paid Ad Submitted Inquiries/.test(app) && /Ebook Requests/.test(app) && /Became a Client/.test(app) && /New Trainer Applications/.test(app) && !/Site Visits\/Clicks/.test(app)],
  ["dashboard lost count matches the Leads lost grouping", /dashboardLostLeadRows/.test(app) && /boardStatus\(lead\.status\) === "Lost"/.test(app)],
  ["dashboard paid and ebook counts use ad landing-page source flags", /dashboardPaidAdSubmittedInquiryRows/.test(app) && /dashboardEbookRequestRows/.test(app) && /isPaidAdLandingPageLead/.test(app) && /isEbookRequestLead/.test(app)],
  ["dashboard contact count excludes paid-ad landing-page leads", /function dashboardContactFormRows[\s\S]*!isPaidAdLandingPageLead/.test(app)],
  ["dashboard ebook count is limited to paid-ad guide requests", /function dashboardEbookRequestRows[\s\S]*isPaidAdLandingPageLead\(lead\) && isEbookRequestLead\(lead\)/.test(app)],
  ["dashboard paid-ad count does not classify by market name alone", !/lead\.market/.test(paidAdLeadHelper) && !/raw\.trainer_market/.test(paidAdLeadHelper)],
  ["dashboard pie includes client, lost, and application buckets", /dashboardBucketRows/.test(app) && /Became a Client/.test(app) && /\["Lost", dashboardLostLeadRows/.test(app) && /New Trainer Applications/.test(app)],
  ["inaccurate ad-market conversion chart is removed from dashboard", !/panel\("Conversions By Ad Market"/.test(app)],
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
  ["approved homepage reviews sort by latest publish time", /publicationPublishedAt/.test(approvedReviews) && /published_at\.desc/.test(approvedReviews)],
  ["approved homepage review loader avoids duplicate cards", /querySelectorAll\('\[data-approved-home-review\]'\)\.forEach/.test(publicScript)],
  ["Karemela rebuild source keeps candid photo", bios["karemela-sefferin"]?.photo === "assets/trainer-bio-photos/karemela-sefferin-candid.jpg"],
  ["Carolina legacy URLs redirect", vercel.redirects?.some(row => row.source === "/carolinadon" && row.destination === "/carolinaperez")],
  ["all trainer landing bios preserve paragraphs", /landing-bio-paragraphs/.test(app) && /profileBioParagraphs\(trainer\.bio\)/.test(app)],
  ["wide admin sections have left and right controls", /horizontalScrollSelectors/.test(app) && /data-scroll-horizontal="left"/.test(app) && /data-scroll-horizontal="right"/.test(app)],
  ["application filter updates sheets and records without hiding the pipeline", /applicationStatusFilterBar/.test(app) && /currentApplicationFilter/.test(app) && /rows = allRows\.filter/.test(app) && /applicationPipelineBoard\(\)/.test(app)],
  ["trainer and client reviews accept uploads or supported video links", /review_video_url/.test(app) && /review_video_url/.test(publicScript) && /normalizeReviewVideoUrl/.test(reviewSubmission)],
  ["trainer publishing exposes a clear live-page action", app.includes("Publish Landing Page") && app.includes("Open Live Landing Page")],
  ["trainer locations normalize full state names", /normalizeTrainerLocation/.test(app) && app.includes("Texas") && app.includes("California")],
  ["clean trainer URLs load root-absolute public assets", ["/trainer-backoffice/styles.css", "/supabase-config.js", "/trainer-roster.js", "/trainer-backoffice/app.js"].every(value => publicTrainerShell.includes(value))],
  ["legacy spaced headshot URLs are normalized", /safeTrainerAssetUrl/.test(app)]
];

for (const [label, passed] of checks) assert.equal(Boolean(passed), true, label);
console.log(JSON.stringify({ ok: true, checks: checks.map(([label]) => label) }, null, 2));
