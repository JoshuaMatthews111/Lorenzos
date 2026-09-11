// LDTT revenue pathway: routing, message library and timing (Joshua 2026-09-11).
// Wording is Tim + Angela's (docs/revenue-pathway). The Twilio toll-free number is approved
// for CUSTOMER_CARE only, so only customer-care messages are sendable; marketing ones
// (win-back, reviews, referrals, price nudges, unserved waitlist) are listed as held.
// Templates marked office: true are not in the documents and fill a gap (escalations).
const HOUR = 3600 * 1000;

const PROBLEMS = [
  "Aggression / Reactivity", "Pulling on the leash", "Not listening / obedience", "Puppy behavior",
  "Barking / jumping", "Fear / anxiety", "Off-leash training", "House soiling / potty training",
  "Destructive chewing", "Other"
];

// Cleveland test routing (Joshua: "use trainers based on our ZIP code in Cleveland for now").
const MARKETS = {
  "cleveland-heights": { name: "Cleveland Heights", primary: "Harley McGrew", backup: "Eric Beck", leader: "Lorenzo Miller" },
  cleveland: { name: "Cleveland", primary: "Eric Beck", backup: "John DelBane", leader: "Lorenzo Miller" }
};
const CLEVELAND_HEIGHTS_ZIPS = new Set(["44106", "44112", "44118", "44121"]);

function marketForZip(zip) {
  const z = String(zip || "").trim().slice(0, 5);
  if (!/^\d{5}$/.test(z)) return null;
  if (CLEVELAND_HEIGHTS_ZIPS.has(z)) return "cleveland-heights";
  if (/^44[01]\d\d$/.test(z)) return "cleveland";
  return null;
}

const TEMPLATES = {
  LDTT_Lead_Booking_Link: { to: "customer", kind: "care", text: "Hi {{first_name}}, this is Lorenzo’s Dog Training Team. We received your request for help with {{problem}}.\n\nYou can schedule your complimentary evaluation here:\n{{booking_link}}\n\nIf you have a question first, just reply to this message. Reply STOP to opt out." },
  LDTT_Unanswered_24Hr: { to: "customer", kind: "care", text: "Hi {{first_name}}, just following up about {{dog_name_or_your_dog}}. If {{problem}} is still something you’d like help with, we have evaluation times available.\n\n{{booking_link}}" },
  LDTT_Unanswered_72Hr: { to: "customer", kind: "care", text: "Hi {{first_name}}, I don’t want to keep filling your phone with messages, so this will be our last automatic follow-up for now.\n\nIf you still want help with {{problem}}, your evaluation request is still here:\n{{booking_link}}\n\nYou can also reply whenever you’re ready." },
  LDTT_Booking_Confirmation: { to: "customer", kind: "care", text: "Hi {{first_name}} — you’re confirmed with {{trainer_first_name}} from Lorenzo’s Dog Training Team.\n\n📅 {{appointment_day}}, {{appointment_date}} at {{appointment_time}}\n📍 {{service_address}}\n\nBefore your trainer arrives, please complete these quick questions about {{dog_name_or_your_dog}} so we can make the most of your evaluation:\n{{pre_eval_link}}\n\nWe look forward to meeting you." },
  LDTT_Safety_Review: { to: "customer", kind: "care", text: "Thanks for sharing that information. It helps us prepare appropriately. Your trainer will review what you provided before the evaluation and may contact you with a few additional questions so the visit can be handled safely." },
  LDTT_Trainer_New_Eval: { to: "trainer", kind: "care", text: "🔔 NEW LDTT EVALUATION\n{{first_name}} {{last_name}}\n{{appointment_day}} at {{appointment_time}}\n{{service_address}}\n\nDog: {{dog_name}}\nPrimary concern: {{problem}}\n{{safety_flag_if_any}}\nPlease call the client today to introduce yourself, then mark CONTACTED: {{trainer_portal_link}}" },
  LDTT_Trainer_Contact_Reminder: { to: "trainer", kind: "care", text: "Reminder: {{client_name}} is scheduled for {{appointment_date}} and has not yet been marked Contacted. Please call the client and update the lead here: {{link}}" },
  LDTT_Escalation_Market_Leader: { to: "leader", kind: "care", office: true, text: "Escalation: {{client_name}} is scheduled for {{appointment_date}} with {{trainer_name}} and has not been marked Contacted. Please follow up: {{link}}" },
  LDTT_Escalation_Operations: { to: "operations", kind: "care", office: true, text: "Escalation (Operations): {{client_name}} is scheduled for {{appointment_date}} with {{trainer_name}}. Still not marked Contacted after the trainer and market leader were alerted. {{link}}" },
  LDTT_Customer_24Hr_Reminder: { to: "customer", kind: "care", text: "Hi {{first_name}}, just a reminder that {{trainer_first_name}} from Lorenzo’s Dog Training Team will see you tomorrow at {{appointment_time}} for {{dog_name_or_your_dog}}’s evaluation.\n\nPlease have your dog securely leashed or crated when the trainer arrives and keep other pets in a separate area until your trainer is ready for them.\n\n📍 {{service_address}}\n\nNeed to change the appointment? {{reschedule_link}}\n\nWe’ll see you tomorrow." },
  LDTT_Customer_5Hr_Reminder: { to: "customer", kind: "care", text: "We’re looking forward to seeing you today at {{appointment_time}}.\n\nQuick reminder: please have {{dog_name_or_your_dog}} securely leashed or crated and other pets put away when your trainer arrives.\n\n{{trainer_first_name}} will see you soon.\n— Lorenzo’s Dog Training Team" },
  LDTT_Customer_NoShow: { to: "customer", kind: "care", text: "Hi {{first_name}}, it looks like we missed you for today’s evaluation. We understand that things come up.\n\nIf you’d still like help with {{dog_name_or_your_dog}}, you can choose another time here:\n{{rebook_link}}" },
  LDTT_Customer_NoShow_24Hr: { to: "customer", kind: "care", text: "Just checking in, {{first_name}}. If you still want help with {{problem}}, we’d be glad to get your evaluation rescheduled.\n\n{{rebook_link}}" },
  LDTT_Trainer_NoShow_ServiceRecovery: { to: "customer", kind: "care", text: "{{first_name}}, we owe you an apology. We were unable to complete your scheduled evaluation today, and that is not the experience we want you to have.\n\nWe would like to make this right and get you rescheduled as quickly as possible.\n{{priority_rebook_link}}\n\nYou can also reply here and we will handle it personally." },
  LDTT_Trainer_NoShow_Management: { to: "operations", kind: "care", office: true, text: "Trainer no-show: {{trainer_name}} did not complete {{client_name}}’s evaluation ({{appointment_date}}). The apology text was sent to the client. Please follow up personally." },
  LDTT_Not_Serviceable_Handoff: { to: "operations", kind: "care", office: true, text: "New lead outside the test area: {{client_name}}, ZIP {{zip}}, {{problem}}. No trainer serves this ZIP. Please follow up personally." }
};

const HELD_MARKETING = [
  "LDTT_PostEval_Experience", "LDTT_Positive_Review_Request", "LDTT_Referral_Request", "LDTT_NoSale_Price",
  "LDTT_WinBack_7Day", "LDTT_WinBack_30Day", "LDTT_WinBack_60Day", "LDTT_WinBack_90Day", "LDTT_Unserved_Zip_Waitlist"
];

function render(key, vars) {
  const t = TEMPLATES[key];
  if (!t) throw new Error(`Unknown message ${key}`);
  const v = { ...vars, dog_name_or_your_dog: vars.dog_name ? vars.dog_name : "your dog" };
  return t.text.replace(/\{\{(\w+)\}\}/g, (_, name) => (v[name] == null ? "" : String(v[name]))).replace(/\n{3,}/g, "\n\n").trim();
}

// "fast" demo speed: one hour of the plan takes one minute.
const scale = speed => (speed === "real" ? HOUR : 60 * 1000);

function nyParts(date) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23", weekday: "long", month: "long", day: "numeric" });
  return Object.fromEntries(f.formatToParts(date).map(p => [p.type, p.value]));
}

// Real speed only: scheduled customer messages wait from 9 PM until 8 AM Eastern.
function quietShift(date, speed, to) {
  if (speed !== "real" || to !== "customer") return date;
  let d = new Date(date);
  for (let i = 0; i < 24; i += 1) {
    const hour = Number(nyParts(d).hour);
    if (hour >= 8 && hour < 21) return d;
    d = new Date(d.getTime() + 30 * 60 * 1000);
  }
  return d;
}

function appointmentFor(now, speed) {
  if (speed !== "real") return new Date(now.getTime() + 48 * 60 * 1000); // 48 "hours" = 48 minutes
  let d = new Date(now.getTime() + 2 * 24 * HOUR);
  d = new Date(d.getTime() - (Number(nyParts(d).hour) - 10) * HOUR);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

function formatAppointment(date) {
  const p = nyParts(date);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(date);
  return { appointment_day: p.weekday, appointment_date: `${p.month} ${p.day}`, appointment_time: `${time} ET` };
}

function planOnStart(speed) {
  const s = scale(speed);
  return [
    { key: "LDTT_Lead_Booking_Link", after: 0 },
    { key: "LDTT_Unanswered_24Hr", after: 24 * s },
    { key: "LDTT_Unanswered_72Hr", after: 72 * s }
  ];
}

function planOnBook(speed, safety) {
  const s = scale(speed);
  return [
    { key: "LDTT_Booking_Confirmation", after: 0 },
    ...(safety ? [{ key: "LDTT_Safety_Review", after: 0 }] : []),
    { key: "LDTT_Trainer_New_Eval", after: 0 },
    { key: "LDTT_Trainer_Contact_Reminder", after: 2 * s },
    { key: "LDTT_Escalation_Market_Leader", after: 4 * s },
    { key: "LDTT_Escalation_Operations", after: 8 * s },
    { key: "LDTT_Customer_24Hr_Reminder", before: 24 * s },
    { key: "LDTT_Customer_5Hr_Reminder", before: 5 * s }
  ];
}

const CONTACT_CHASE = ["LDTT_Trainer_Contact_Reminder", "LDTT_Escalation_Market_Leader", "LDTT_Escalation_Operations"];
const CANCEL_ON = {
  book: ["LDTT_Unanswered_24Hr", "LDTT_Unanswered_72Hr"],
  contacted: CONTACT_CHASE,
  customer_no_show: [...CONTACT_CHASE, "LDTT_Customer_24Hr_Reminder", "LDTT_Customer_5Hr_Reminder"],
  trainer_no_show: [...CONTACT_CHASE, "LDTT_Customer_24Hr_Reminder", "LDTT_Customer_5Hr_Reminder"],
  won: "ALL",
  stop: "ALL"
};

const STATE_AFTER = {
  start: "BOOKING OFFERED", book: "TRAINER CONTACT REQUIRED", contacted: "TRAINER CONTACTED",
  customer_no_show: "NO-SHOW — REBOOK", trainer_no_show: "NO-SHOW — REBOOK", won: "WON — PAYMENT COMPLETE", stop: "DO NOT CONTACT"
};

const digits = phone => String(phone || "").replace(/\D/g, "");
const e164 = phone => { const d = digits(phone); return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : ""; };
const samePhone = (a, b) => { const x = digits(a).slice(-10), y = digits(b).slice(-10); return x.length === 10 && x === y; };

module.exports = { PROBLEMS, MARKETS, TEMPLATES, HELD_MARKETING, marketForZip, render, planOnStart, planOnBook, CANCEL_ON, STATE_AFTER, quietShift, appointmentFor, formatAppointment, scale, e164, samePhone, digits };
