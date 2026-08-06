import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const app = read("trainer-backoffice/app.js");
const portal = read("trainer-backoffice/supabase.js");
const contact = read("contact.html");
const delivery = read("api/form-delivery.js");
const applicationData = read("trainer-backoffice/application-data.js");
const vercel = JSON.parse(read("vercel.json"));
const bios = JSON.parse(read("trainer_bios.json"));

const checks = [
  ["staff identity replaces anonymous portal labels", /portalActorLabel/.test(app) && /first_name/.test(app) && /last_name/.test(app)],
  ["office notes edit exact records and expose revisions", /data-save-office-note-edit/.test(app) && /remoteNoteRevisions/.test(app)],
  ["lead SMS consent is visible and filterable", /leadSmsFilter/.test(app) && /SMS consent/.test(app)],
  ["pipeline keeps every requested outcome", ["Lost: Client Complaint", "Lost: No Trainer in the Area", "Evaluation Scheduled", "Evaluation Complete", "Became a Client"].every(value => app.includes(value))],
  ["dashboard uses immutable lifecycle milestones", /lifecycle/.test(app) && /Each record is counted once per confirmed lifecycle milestone/.test(app)],
  ["ad-market conversion table requires attribution", /isAdAttributed/.test(app)],
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
  ["Karemela rebuild source keeps candid photo", bios["karemela-sefferin"]?.photo === "assets/trainer-bio-photos/karemela-sefferin-candid.jpg"],
  ["Carolina legacy URLs redirect", vercel.redirects?.some(row => row.source === "/carolinadon" && row.destination === "/carolinaperez")],
  ["all trainer landing bios preserve paragraphs", /landing-bio-paragraphs/.test(app) && /profileBioParagraphs\(trainer\.bio\)/.test(app)]
];

for (const [label, passed] of checks) assert.equal(Boolean(passed), true, label);
console.log(JSON.stringify({ ok: true, checks: checks.map(([label]) => label) }, null, 2));
