// ZIP radius check (Joshua 2026-09-16): "make sure the website automatically selects the top trainer that
// Missy picked, only when using their zip code; radius of 50 miles." Prints, for each test ZIP, who is within
// RADIUS_MILES (lib/booking.js, 50) nearest first, which trainer the texts auto-assign (the nearest one WITH
// a Google calendar = a booking_trainers row = "the trainers Missy picked"), and what the booking page shows.
//
//   node scripts/zip-radius-check.mjs            -> markdown to stdout
//   node scripts/zip-radius-check.mjs 44118 ...  -> only those ZIPs
//
// It uses the SAME functions the site uses (nearbyTrainers, settingBySlug, milesBetween, RADIUS_MILES) against
// the trainer list below, which mirrors practice.trainers (active, Base ZIP set) on 2026-09-16. routeZip() itself
// reads the trainers from the database, so this mirror is what lets the check run offline; the "auto-assigned"
// column applies routeZip's rule to the same cards: cards.find(c => c.calendar).
// booking_trainers (the calendar rows) come from the database when the Supabase env is present (SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY, practice schema), otherwise from the mirror below.
// Not deployed (scripts/ is in .vercelignore). Read-only: nothing is written anywhere.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
process.env.LDTT_SANDBOX = "1"; // the practice schema, where booking_trainers lives (lib/sandbox.js)
const B = require("../lib/booking.js");

// Mirrors practice.trainers on 2026-09-16 (slug, name, base_zip, market, state). Office-editable in the portal
// (Base ZIP); re-copy when a trainer moves or is added.
const TRAINERS = [
  ["fred-harris", "Fred Harris", "92101", "San Diego", "California"],
  ["genevieve-twilla", "Genevieve Twilla", "92104", "North Park", "California"],
  ["karemela-sefferin", "Karemela Sefferin", "92101", "San Diego, CA", "California"],
  ["clark-patton", "Clark Patton", "32502", "Pensacola, FL", "Florida"],
  ["daniel-bainbridge", "Daniel Bainbridge", "32536", "Crestview", "Florida"],
  ["michael-king", "Michael King", "32566", "Navarre, FL", "Florida"],
  ["tabatha-shelley", "Tabatha Shelley", "32401", "Panama City", "Florida"],
  ["victoria-bayleigh-morris", "Victoria Morris", "32401", "Panama City", "Florida"],
  ["aryson-whorley", "Aryson Whorley", "30303", "Atlanta", "Georgia"],
  ["chloe-chislom", "Chloe Chisolm", "30303", "Atlanta, GA", "Georgia"],
  ["christopher-almonte", "Christopher Almonte", "30303", "Atlanta", "Georgia"],
  ["robert-wesling", "Robert Wesling", "30303", "Atlanta", "Georgia"],
  ["shantelle-tuck", "Shantelle Tuck", "30303", "Atlanta", "Georgia"],
  ["shavon-striggles", "Shavon Striggles", "30303", "Atlanta", "Georgia"],
  ["jasmine-bland", "Jasmine Bland", "46320", "Hammond", "Indiana"],
  ["bailey-brown", "Bailey Brown", "40330", "Harrodsburg", "Kentucky"],
  ["emilio-marotta", "Emilio Marotta", "02108", "Boston, MA", "Massachusetts"],
  ["dylan-atkinson", "Dylan Atkinson", "48104", "Ann Arbor, MI", "Michigan"],
  ["tristan-gray", "Tristan Gray", "03824", "Durham, NH", "New Hampshire"],
  ["brady-deremer", "Brady DeRemer", "44241", "Streetsboro", "Ohio"],
  ["eric-beck", "Eric Beck", "44113", "Cleveland", "Ohio"],
  ["harley-mcgrew", "Harley McGrew", "44118", "Cleveland Heights, OH", "Ohio"],
  ["john-delbane", "John DelBane", "44113", "Cleveland, OH", "Ohio"],
  ["lorenzo-miller", "Lorenzo Miller", "44128", "Cleveland, OH", "Ohio"],
  ["shannon-paskins", "Shannon Paskins", "43068", "Reynoldsburg, OH", "Ohio"],
  ["carolina-perez", "Carolina Perez", "78205", "San Antonio", "Texas"],
  ["eric-hardaway", "Eric Hardaway", "76102", "Fort Worth, TX", "Texas"],
  ["giovanni-gutierrez", "Giovanni Gutierrez", "78205", "San Antonio", "Texas"],
  ["jacob-perez", "Jacob Perez", "78205", "San Antonio", "Texas"]
].map(([slug, full_name, base_zip, market, state]) => ({ slug, full_name, base_zip, market, state, status: "active", headshot_url: "" }));

// Mirrors practice.site_settings key booking_trainers on 2026-09-16: the 7 active rows with a Google appointment
// schedule id ("the trainers Missy picked"). Only "has a calendar" matters here, so the ids are not copied; the
// placeholder passes normalizeTrainerSetting's shape check and marks the trainer as having a calendar.
const CALENDAR_SLUGS_MIRROR = ["lorenzo-miller", "daniel-bainbridge", "eric-hardaway", "tristan-gray", "robert-wesling", "eric-beck", "shavon-striggles"];
const MIRROR_ID = "mirror-of-practice-site-settings-booking-trainers-2026-09-16";

// Joshua's test ZIPs (2026-09-16).
const TEST_ZIPS = [
  ["44118", "Cleveland Heights, OH"], ["44241", "Streetsboro, OH"], ["44052", "Lorain, OH (edge)"], ["43068", "Reynoldsburg, OH"],
  ["43215", "Columbus, OH"], ["30303", "Atlanta, GA"], ["30052", "Loganville, GA"], ["32502", "Pensacola, FL"], ["32536", "Crestview, FL"],
  ["32401", "Panama City, FL"], ["32504", "Pensacola, FL"], ["32301", "Tallahassee, FL"], ["92101", "San Diego, CA"], ["92105", "San Diego, CA"],
  ["78205", "San Antonio, TX"], ["78245", "San Antonio, TX"], ["76102", "Fort Worth, TX"], ["46320", "Hammond, IN"], ["60618", "Chicago, IL"],
  ["40330", "Harrodsburg, KY"], ["40502", "Lexington, KY"], ["02108", "Boston, MA"], ["48104", "Ann Arbor, MI"], ["03824", "Durham, NH"],
  ["10001", "New York, NY (expected: nobody)"]
];

async function loadCalendarSettings() {
  const hasEnv = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY));
  if (hasEnv) {
    try {
      const rows = await B.sbOrThrow("/rest/v1/site_settings?key=eq.booking_trainers&select=value");
      const list = rows?.[0]?.value?.trainers;
      if (Array.isArray(list) && list.length) return { settings: B.mergeSettings(list), source: "practice.site_settings booking_trainers (database, practice schema)" };
    } catch (error) {
      console.error(`booking_trainers not read from the database (${String(error?.message || error)}); using the 2026-09-16 mirror.`);
    }
  }
  return { settings: B.mergeSettings(CALENDAR_SLUGS_MIRROR.map(slug => ({ slug, schedule_id: MIRROR_ID, active: true }))), source: "2026-09-16 mirror of booking_trainers (no Supabase env in this shell)" };
}

const mi = card => (card.miles_exact < 1 ? "<1" : String(card.miles_exact)) + " mi";
const cell = text => String(text).replace(/\|/g, "\\|");

function expectedDisplay(cards, calendar) {
  if (!cards.length) return "Office follow-up: \"The office will match you with a trainer\" + callback form. Texts carry NO booking link.";
  const rest = cards.filter(c => c.slug !== calendar?.slug);
  const requestPart = rest.length ? `; "Request this trainer" (Office schedules) for ${rest.map(c => c.first_name).join(", ")}` : "";
  if (calendar) return `${cards.length} picture card${cards.length === 1 ? "" : "s"} nearest first; calendar for ${calendar.name}${requestPart}. Text link: /book/${calendar.slug}?lead=…`;
  return `${cards.length} picture card${cards.length === 1 ? "" : "s"} nearest first; no calendar trainer in range, so the client picks: every card is "Request this trainer". Text link: /book/${cards[0].slug}?lead=… (nearest), nobody assigned until the client picks.`;
}

async function main() {
  const only = process.argv.slice(2).map(z => String(z).replace(/\D/g, "").slice(0, 5)).filter(z => z.length === 5);
  const { settings, source } = await loadCalendarSettings();
  const calendarSlugs = settings.filter(s => s.active && s.schedule_id).map(s => s.slug).sort();
  const rows = (only.length ? only.map(z => TEST_ZIPS.find(t => t[0] === z) || [z, ""]) : TEST_ZIPS).map(([zip, city]) => {
    if (!B.centroid(zip)) return { zip, city, cards: [], unknown: true };
    const cards = B.nearbyTrainers(zip, TRAINERS, settings); // radius = RADIUS_MILES
    const calendar = cards.find(c => c.calendar) || null; // routeZip's rule: nearest WITH a calendar is assigned
    return { zip, city, cards, calendar };
  });

  const out = [];
  out.push(`# ZIP radius check: ${B.RADIUS_MILES} miles (Joshua 2026-09-16)`);
  out.push("");
  out.push(`Generated ${new Date().toISOString()} by scripts/zip-radius-check.mjs against lib/booking.js (RADIUS_MILES = ${B.RADIUS_MILES}).`);
  out.push(`Distances: Census ZCTA centroid to centroid, great-circle (lib/zip-distance.js). Trainer Base ZIPs: practice.trainers mirror of 2026-09-16 (${TRAINERS.length} active trainers).`);
  out.push(`Calendar trainers (auto-assign candidates) from: ${source}: ${calendarSlugs.join(", ")}.`);
  out.push("");
  out.push("Rule (lib/booking.js routeZip / nearbyTrainers): every active trainer whose Base ZIP is within the radius is a picture card, nearest first. The nearest card WITH a Google calendar is auto-assigned (the text's booking link goes to that trainer). Cards without a calendar show \"Request this trainer\" and the office schedules. No card in range = office follow-up, no link.");
  out.push("");
  out.push("| ZIP | City | Trainers within " + B.RADIUS_MILES + " mi (nearest first) | Auto-assigned (calendar) | Expected display on /book |");
  out.push("|---|---|---|---|---|");
  for (const r of rows) {
    if (r.unknown) { out.push(`| ${r.zip} | ${cell(r.city)} | (unknown ZIP: no Census centroid) | none | \"We could not find that ZIP\" message; nothing listed |`); continue; }
    const list = r.cards.length ? r.cards.map(c => `${c.name} (${mi(c)}${c.calendar ? ", calendar" : ""})`).join("; ") : "nobody";
    out.push(`| ${r.zip} | ${cell(r.city)} | ${cell(list)} | ${r.calendar ? cell(`${r.calendar.name} (${mi(r.calendar)})`) : "none"} | ${cell(expectedDisplay(r.cards, r.calendar))} |`);
  }
  out.push("");
  out.push("Distances are straight-line between ZIP centroids, not driving miles.");
  process.stdout.write(out.join("\n") + "\n");
}

main().catch(error => { console.error(error); process.exit(1); });
