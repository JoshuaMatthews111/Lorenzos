const STORE_KEY = "lorenzoBackOfficePrototype.v9";
const SESSION_KEY = "lorenzoBackOfficeSession.v4";
const TEMP_PASSWORD = "doglovers26";
const SITE_EVENT_KEY = "ldttTrainerSiteEvents.v1";
const REAL_TRAINERS = Array.isArray(window.LDTT_TRAINER_ROSTER) ? window.LDTT_TRAINER_ROSTER : [];
const TRAINER_APPLICATION_FORM_EMBED = "https://docs.google.com/forms/d/e/1FAIpQLSdm5gkPQl4LwPVIGZZQbOGYA05le1xMUybMngJIyWKeDmlF5Q/viewform?embedded=true";
const TRAINER_APPLICATION_FORM_LINK = "https://docs.google.com/forms/d/e/1FAIpQLSdm5gkPQl4LwPVIGZZQbOGYA05le1xMUybMngJIyWKeDmlF5Q/viewform";
const TRAINER_APPLICATION_RESPONSE_SHEET = "https://docs.google.com/spreadsheets/d/1RsF2HajyVxctqHhWGxzJ-ZLqGrlO4gwJ3B9URfgezOI/edit?usp=sharing";

const icons = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  lead: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M5 5H3v3a4 4 0 0 0 4 4M19 5h2v3a4 4 0 0 1-4 4"/></svg>`,
  report: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19V5M9 19V9M14 19V3M19 19v-7"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3.05V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.32.1.68 0 1a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/></svg>`,
  media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l3 6 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.9 3 1.1-6.5L2.5 8.9 9 8z"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>`,
  message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
};

const dogImages = [
  "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=120&q=60",
  "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?auto=format&fit=crop&w=120&q=60",
  "https://images.unsplash.com/photo-1561037404-61cd46aa615b?auto=format&fit=crop&w=120&q=60",
  "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=120&q=60"
];

const layoutImages = [
  "/assets/trainer-template-mocks/mock-5.png",
  "/assets/trainer-template-mocks/mock-6.png",
  "/assets/trainer-template-mocks/mock-3.png"
];

const approvedLayouts = [
  {
    id: "mock-5",
    name: "Right Trainer, Right Results",
    headline: "The right trainer. The right results.",
    tag: "A bold consultation-first page with a trainer spotlight, testimonials, and a direct office CTA.",
    preview: layoutImages[0]
  },
  {
    id: "mock-6",
    name: "Serious Training, Serious Results",
    headline: "Serious training. Serious results.",
    tag: "A proof-led page with credibility statistics, service paths, reviews, and a strong conversion funnel.",
    preview: layoutImages[1]
  },
  {
    id: "mock-3",
    name: "Real-Life Results",
    headline: "Professional dog training for real-life results.",
    tag: "A trainer-led page with a direct consultation card, focused programs, and office-managed follow-up.",
    preview: layoutImages[2]
  }
];

const trainerLandingDogs = {
  "mock-5": "/assets/trainer-template-heroes/mock-5-hero-generated.png",
  "mock-6": "/assets/trainer-template-heroes/mock-6-hero-generated.png",
  "mock-3": "/assets/trainer-template-heroes/mock-3-hero-generated.png"
};

const heroImageOptions = [
  { src: "/assets/trainer-bio-photos/daniel-bainbridge.jpg", label: "Trainer In Action" },
  { src: "/assets/trainer-bio-photos/shavon-striggles.jpg", label: "Trainer Portrait" },
  { src: "/assets/emilio-yoyo.jpg", label: "Advanced Training" },
  { src: "/assets/utility-retrieval.png", label: "Utility & Retrieval" },
  { src: "/assets/client-photo.jpg", label: "Owner & Dog" },
  { src: "/assets/ldtt-team-cover.jpg", label: "Lorenzo Team" }
];

const showFormSuccessModal = (message = "Thank you, your form has been submitted. Our team will contact you within 1-3 business days.") => {
  let modal = document.querySelector(".form-success-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "form-success-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Form submitted");
    modal.innerHTML = `<div class="form-success-card">
      <button class="form-success-close" type="button" aria-label="Close confirmation">×</button>
      <span class="form-success-kicker">Request received</span>
      <h2>Thank you.</h2>
      <p></p>
      <button class="primary form-success-ok" type="button">Close</button>
    </div>`;
    document.body.appendChild(modal);
    const close = () => {
      modal.classList.remove("open");
      document.body.classList.remove("form-modal-open");
    };
    modal.querySelector(".form-success-close").addEventListener("click", close);
    modal.querySelector(".form-success-ok").addEventListener("click", close);
    modal.addEventListener("click", event => {
      if (event.target === modal) close();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && modal.classList.contains("open")) close();
    });
  }
  modal.querySelector("p").textContent = message;
  modal.classList.add("open");
  document.body.classList.add("form-modal-open");
  modal.querySelector(".form-success-ok").focus();
};

const leadStatuses = [
  "New Inquiry",
  "Office Contacted",
  "Engaged Lead: No Outcome",
  "Follow Up Call Needed",
  "Evaluation Scheduled",
  "Evaluation Complete",
  "First Session / Payment",
  "Became a Client",
  "Lost / No Response",
  "Lost / Price Concern",
  "Lost / Not Ready",
  "Lost / Chose Another Provider",
  "Bad Lead",
  "Do Not Contact",
  "Archived"
];

const clientStatuses = ["All", "Active", "Past", "Won", "Lost", "Bad Lead", "Do Not Contact"];
const defaultLeadEndDate = new Date();
const defaultLeadStartDate = new Date(defaultLeadEndDate.getTime() - 59 * 86400000);
const toDateInputValue = date => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const defaultState = {
  role: "",
  activeView: "dashboard",
  selectedTrainerId: "eric-beck",
  clientFilter: "Active",
  leadDateRange: "60",
  customLeadStart: toDateInputValue(defaultLeadStartDate),
  customLeadEnd: toDateInputValue(defaultLeadEndDate),
  leadSearch: "",
  leadStatusFilter: "All",
  leadTrainerFilter: "All",
  leadViewMode: "board",
  selectedLeadId: "",
  onboardingStep: 1,
  inviteDraft: { name: "", email: "", phone: "", market: "" },
  stagedInvites: [],
  importDraft: "Client Name,Phone,Email,Dog Name,Dog Breed,Trainer Assigned,Status,SMS Consent,Email Consent,Source,Notes\nMaria Thompson,(216) 555-1188,maria@example.com,Cooper,Border Collie,Eric Beck,Active,Yes,Yes,Alpha,Needs review request\nDerek Hall,(330) 555-7712,derek@example.com,Zeus,German Shepherd,Stephanie Palmer,Do Not Contact,No,No,QuickBooks,Asked not to be contacted\nSarah Johnson,(216) 555-0100,sarah@example.com,Max,Goldendoodle,Eric Beck,Won,Yes,Yes,Spreadsheet,Imported from old client list",
  trainers: [
    {
      id: "eric-beck",
      name: "Eric Beck",
      market: "Cleveland, OH",
      serviceArea: "Cleveland, Garfield Heights, Akron, and Northeast Ohio",
      phone: "(866) 436-4959",
      email: "eric@lorenzosdogtrainingteam.com",
      username: "eric@lorenzosdogtrainingteam.com",
      temporaryPassword: TEMP_PASSWORD,
      title: "Lorenzo's Certified Dog Trainer",
      tagline: "Obedience. Behavior solutions. Real results.",
      heroHeadline: "The right trainer. The right results.",
      bio: "Eric helps families build reliable obedience, calmer behavior, and better owner leadership using Lorenzo's proven training system.",
      layout: "mock-5",
      pageStatus: "Published",
      locked: true,
      clicks: 1248,
      forms: 67,
      conversions: 9,
      image: "../assets/trainer-bio-photos/eric-beck.jpg",
      photo: "../assets/trainer-bio-photos/eric-beck.jpg",
      specialties: ["Behavior Modification", "Obedience Training", "Puppy Training", "Real-World Leadership"],
      credentials: ["Lorenzo's Certified Dog Trainer", "Office-approved lead handling", "Nationwide Lorenzo system"],
      companyLogo: "",
      seoTitle: "Dog Trainer in Cleveland, OH | Eric Beck | Lorenzo's Dog Training Team",
      seoDescription: "Work with Eric Beck for dog obedience training and behavior modification in Cleveland, Ohio, backed by Lorenzo's Dog Training Team.",
      review1Author: "Jessica R.",
      review1Copy: "Eric helped us create calmer behavior, better control, and confidence we can use in everyday life.",
      review2Author: "Michael T.",
      review2Copy: "The office matched us with Eric and the training process was clear, professional, and focused on real results.",
      review3Author: "Sarah L.",
      review3Copy: "Eric taught us how to lead consistently and helped our dog become easier to manage at home and in public.",
      socials: { facebook: "on-file", instagram: "on-file", tiktok: "" }
    },
    { id: "stephanie-palmer", name: "Stephanie Palmer", market: "Akron, OH", serviceArea: "Akron, Canton, and surrounding communities", phone: "(866) 436-4959", email: "stephanie@lorenzosdogtrainingteam.com", bio: "Stephanie works with owners to create structure, consistency, and real-world obedience at home and in public.", layout: "mock-6", pageStatus: "Published", locked: true, clicks: 982, forms: 44, conversions: 6, image: "../assets/facility-exterior-main.jpg", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80", specialties: ["Family Obedience", "Behavior Modification", "Leash Skills", "Follow-Through Coaching"], credentials: ["Office-approved page", "Google review collection", "Trainer funnel active"], socials: { facebook: "on-file", instagram: "", tiktok: "" } },
    { id: "robert-stephan", name: "Robert Stephan", market: "Mentor, OH", serviceArea: "Mentor, Lake County, and Northeast Ohio", phone: "(866) 436-4959", email: "robert@lorenzosdogtrainingteam.com", bio: "Robert supports behavior modification and obedience plans built around timing, technique, and owner follow-through.", layout: "mock-3", pageStatus: "Published", locked: true, clicks: 736, forms: 31, conversions: 4, image: "../assets/facility-campus-clean-overview.png", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80", specialties: ["Advanced Obedience", "Behavior Rehab", "Owner Structure", "Consultation Handoff"], credentials: ["Office-approved bio", "Lead form active", "Results reporting enabled"], socials: { facebook: "", instagram: "on-file", tiktok: "" } },
    { id: "jenn-studer", name: "Jenn Studer", market: "Medina, OH", serviceArea: "Medina and surrounding communities", phone: "(866) 436-4959", email: "jenn@lorenzosdogtrainingteam.com", bio: "Jenn's trainer page is being prepared by the office team.", layout: "mock-6", pageStatus: "Draft", locked: false, clicks: 184, forms: 7, conversions: 1, image: "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1400&q=80", photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=900&q=80", specialties: ["Puppy Foundations", "Calmer Household Behavior", "Owner Coaching"], credentials: ["Draft page in review", "Awaiting final office content"], socials: { facebook: "", instagram: "", tiktok: "" } },
    { id: "ariel-kapela", name: "Ariel Kapela", market: "Parma, OH", serviceArea: "Parma, Cleveland west side, and nearby communities", phone: "(866) 436-4959", email: "ariel@lorenzosdogtrainingteam.com", bio: "Ariel focuses on clear owner communication and reliable behavior in daily life.", layout: "mock-5", pageStatus: "Published", locked: true, clicks: 523, forms: 22, conversions: 3, image: "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=1400&q=80", photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80", specialties: ["Behavior Help", "Consultation Follow-Up", "Obedience Plans"], credentials: ["Published by office", "Reviews approved", "Mobile-ready"], socials: { facebook: "on-file", instagram: "on-file", tiktok: "on-file" } },
    { id: "mike-davis", name: "Mike Davis", market: "Youngstown, OH", serviceArea: "Youngstown and surrounding areas", phone: "(866) 436-4959", email: "mike@lorenzosdogtrainingteam.com", bio: "Mike is enrolled. The office has not started this trainer page yet.", layout: "mock-3", pageStatus: "No Site Started", locked: false, clicks: 0, forms: 0, conversions: 0, image: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1400&q=80", photo: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=900&q=80", specialties: ["Pending office setup"], credentials: ["Trainer enrolled", "No public page yet"], socials: { facebook: "", instagram: "", tiktok: "" } }
  ],
  leads: [
    { id: "lead-1", owner: "Sarah Johnson", dog: "Max", breed: "Goldendoodle", source: "Website", service: "Obedience Training", trainerId: "eric-beck", status: "Evaluation Scheduled", createdAt: "2026-06-23", next: "Jun 25, 2026 10:00 AM", note: "Office scheduled phone consultation for Friday at 2:00 PM.", visits: 4, submitted: true },
    { id: "lead-2", owner: "Mike Davis", dog: "Rocky", breed: "German Shepherd", source: "Google", service: "Behavior Modification", trainerId: "eric-beck", status: "Office Contacted", createdAt: "2026-06-18", next: "Jun 26, 2026 3:30 PM", note: "Follow-up call needed. Owner asked about reactivity around other dogs.", visits: 2, submitted: true },
    { id: "lead-3", owner: "Jessica Miller", dog: "Luna", breed: "Labrador Retriever", source: "Referral", service: "Puppy Training", trainerId: "daniel-bainbridge", status: "Evaluation Complete", createdAt: "2026-06-10", next: "Jun 27, 2026 11:00 AM", note: "Evaluation complete. Program options sent by office.", visits: 1, submitted: true },
    { id: "lead-4", owner: "Emily Wilson", dog: "Teddy", breed: "French Bulldog", source: "Facebook", service: "Obedience Training", trainerId: "shavon-striggles", status: "Follow Up Call Needed", createdAt: "2026-06-03", next: "Jun 28, 2026 2:00 PM", note: "Office left voicemail. Needs second call.", visits: 5, submitted: true },
    { id: "lead-5", owner: "Chris Brown", dog: "Bailey", breed: "Golden Retriever", source: "Website", service: "Board & Train", trainerId: "emilio-marotta", status: "Engaged Lead: No Outcome", createdAt: "2026-05-25", next: "Jun 29, 2026 6:00 PM", note: "Owner engaged with office, but no outcome selected yet.", visits: 3, submitted: true },
    { id: "lead-6", owner: "Amanda Lee", dog: "Bella", breed: "Husky", source: "Referral", service: "Board & Train", trainerId: "eric-beck", status: "Became a Client", createdAt: "2026-05-12", next: "-", note: "First session/payment confirmed. Training begins 6/26/26.", visits: 3, submitted: true },
    { id: "lead-7", owner: "Robert Johnson", dog: "Duke", breed: "Pit Bull Mix", source: "Google", service: "Behavior Modification", trainerId: "harley-mcgrew", status: "Lost / Chose Another Provider", createdAt: "2026-04-29", next: "-", note: "Chose another trainer closer to home.", visits: 1, submitted: true },
    { id: "lead-8", owner: "Mark Allen", dog: "Rex", breed: "Doberman", source: "Website", service: "Protection Training", trainerId: "john-delbane", status: "First Session / Payment", createdAt: "2026-04-18", next: "Jun 30, 2026", note: "Payment confirmed by office; trainer handoff pending.", visits: 6, submitted: true }
  ],
  clients: [
    { id: "client-1", name: "Amanda Lee", phone: "(216) 555-0198", email: "amanda@example.com", dog: "Bella", breed: "Husky", trainerId: "eric-beck", status: "Won", source: "Referral", importedSource: "Manual", smsConsent: "Yes", emailConsent: "Yes", dateStarted: "2025-05-26", lastContacted: "2025-05-20", notes: "Active board and train client." },
    { id: "client-2", name: "Rebecca Rottman", phone: "(440) 555-0222", email: "rebecca@example.com", dog: "Maverick", breed: "Labrador", trainerId: "shavon-striggles", status: "Past", source: "Google", importedSource: "Alpha", smsConsent: "Yes", emailConsent: "Yes", dateStarted: "2024-08-12", lastContacted: "2025-05-10", notes: "Great candidate for review request." },
    { id: "client-3", name: "Derek Hall", phone: "(330) 555-7712", email: "derek@example.com", dog: "Zeus", breed: "German Shepherd", trainerId: "daniel-bainbridge", status: "Do Not Contact", source: "QuickBooks", importedSource: "QuickBooks", smsConsent: "No", emailConsent: "No", dateStarted: "2023-11-02", lastContacted: "2024-01-15", notes: "Opted out. Block from campaigns." },
    { id: "client-4", name: "Lindsey Grant", phone: "(216) 555-3355", email: "lindsey@example.com", dog: "Milo", breed: "Corgi", trainerId: "harley-mcgrew", status: "Bad Lead", source: "Spreadsheet", importedSource: "Spreadsheet", smsConsent: "Unknown", emailConsent: "Unknown", dateStarted: "", lastContacted: "2025-04-03", notes: "Not a fit. Exclude by default." }
  ],
  submissions: [
    { id: "sub-1", trainerId: "eric-beck", type: "Review", title: "Google review from Becca Lynn", status: "Pending", submittedAt: "2026-07-15T14:30:00Z", reviewText: "Lorenzo's Dog Training Team gave us clearer communication, better control, and a calmer dog at home. Our trainer explained every step and helped us stay consistent.", note: "Trainer submitted this recent behavior modification client review for the results section." },
    { id: "sub-2", trainerId: "daniel-bainbridge", type: "Photo", title: "Loose leash training photo", status: "Approved", submittedAt: "2026-07-14T17:10:00Z", contentUrl: "../assets/trainer-bio-photos/daniel-bainbridge.jpg", fileName: "daniel-loose-leash-training.jpg", note: "Approved for trainer page gallery." },
    { id: "sub-3", trainerId: "shavon-striggles", type: "Review", title: "Client testimonial about reactivity", status: "Declined", submittedAt: "2026-07-13T12:45:00Z", reviewText: "Shavon helped us understand our dog's reactivity and gave our family a practical plan we could follow every day.", note: "Need client permission confirmation before publishing." }
  ],
  applications: [
    { id: "app-demo-1", createdAt: "2026-06-24", first_name: "Karemela", last_name: "Sefferin", email: "karemela@example.com", phone: "(619) 555-0191", city: "San Diego", state: "CA", referral_source: "Lorenzo trainer referral", status: "New Application", note: "Demo application record. Future Supabase table will store real application submissions." }
  ],
  importedPreview: []
};

let state = loadState();
let session = { loggedIn: false, role: "" };
let portalUser = null;
let remoteReady = false;
let remoteEvents = [];
let remotePortalUsers = [];
applyUrlState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    const merged = { ...structuredClone(defaultState), ...saved };
    ["trainers", "leads", "clients", "submissions", "applications", "stagedInvites"].forEach(key => {
      merged[key] = Array.isArray(saved[key]) ? saved[key] : structuredClone(defaultState[key]);
    });
    const defaultSubmissions = new Map(defaultState.submissions.map(submission => [submission.id, submission]));
    merged.submissions = merged.submissions.map(submission => ({
      ...(defaultSubmissions.get(submission.id) || {}),
      ...submission
    }));
    if (REAL_TRAINERS.length) {
      const savedTrainers = new Map((Array.isArray(saved.trainers) ? saved.trainers : []).map(trainer => [trainer.id, trainer]));
      const rosterIds = new Set(REAL_TRAINERS.map(trainer => trainer.id));
      const officeCreated = (Array.isArray(saved.trainers) ? saved.trainers : []).filter(trainer => !rosterIds.has(trainer.id) && trainer.id.startsWith("trainer-"));
      merged.trainers = REAL_TRAINERS.map((trainer, index) => {
        const existing = savedTrainers.get(trainer.id) || {};
        const templateRotation = ["mock-5", "mock-6", "mock-3"];
        const defaultLayout = templateRotation[index % templateRotation.length];
        return {
          ...structuredClone(trainer),
          accessStatus: "accessStatus" in existing ? existing.accessStatus : "Active",
          layout: existing.layout || defaultLayout,
          pageStatus: existing.pageStatus || "Published",
          locked: "locked" in existing ? existing.locked : true,
          ...existing,
          socials: { ...(trainer.socials || {}), ...(existing.socials || {}) },
          specialties: existing.specialties || trainer.specialties,
          credentials: existing.credentials || trainer.credentials
        };
      }).concat(officeCreated);
    }
    if (!merged.trainers.some(trainer => trainer.id === merged.selectedTrainerId)) merged.selectedTrainerId = "eric-beck";
    merged.leadDateRange = saved.leadDateRange || defaultState.leadDateRange;
    merged.customLeadStart = saved.customLeadStart || defaultState.customLeadStart;
    merged.customLeadEnd = saved.customLeadEnd || defaultState.customLeadEnd;
    merged.onboardingStep = Number(saved.onboardingStep || defaultState.onboardingStep);
    merged.leads = merged.leads.map((lead, index) => ({
      ...lead,
      createdAt: lead.createdAt || defaultState.leads[index % defaultState.leads.length].createdAt,
      status: normalizeLeadStatus(lead.status)
    }));
    merged.inviteDraft = { ...defaultState.inviteDraft, ...(saved.inviteDraft || {}) };
    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || { loggedIn: false, role: "" };
  } catch {
    return { loggedIn: false, role: "" };
  }
}

function saveState(message, skipRender = false) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  if (message) showToast(message);
  if (!skipRender) render();
}

function saveSession(role) {
  session = { loggedIn: true, role };
  state.role = role;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const trainerId = params.get("trainer");
  if (view) state.activeView = view;
  if (trainerId && state.trainers.some(t => t.id === trainerId)) state.selectedTrainerId = trainerId;
}

const leadStatusToDb = {
  "Site Visit": "site_visit",
  "New Inquiry": "new_inquiry",
  "Office Contacted": "office_contacted",
  "Engaged Lead: No Outcome": "engaged_no_outcome",
  "Follow Up Call Needed": "follow_up_call_needed",
  "Evaluation Scheduled": "evaluation_scheduled",
  "Evaluation Complete": "evaluation_complete",
  "First Session / Payment": "first_session_payment",
  "Became a Client": "became_client",
  "Lost / No Response": "lost_no_response",
  "Lost / Price Concern": "lost_price_concern",
  "Lost / Not Ready": "lost_not_ready",
  "Lost / Chose Another Provider": "lost_chose_another_provider",
  "Bad Lead": "bad_lead",
  "Do Not Contact": "do_not_contact",
  "Archived": "archived"
};
const leadStatusFromDb = Object.fromEntries(Object.entries(leadStatusToDb).map(([label, value]) => [value, label]));
const applicationStatusToDb = {
  "New Application": "new_application",
  "Under Review": "reviewing",
  "Discovery Follow-Up": "discovery_follow_up",
  "Interview Scheduled": "reviewing",
  "Moved Forward": "moved_forward",
  "Declined": "not_a_fit",
  "Archived": "archived"
};
const applicationStatusFromDb = {
  new_application: "New Application",
  reviewing: "Under Review",
  discovery_follow_up: "Discovery Follow-Up",
  moved_forward: "Moved Forward",
  not_a_fit: "Declined",
  archived: "Archived"
};
const clientStatusToDb = {
  Active: "active",
  Past: "past",
  Won: "won",
  Lost: "lost",
  "Bad Lead": "bad_lead",
  "Do Not Contact": "do_not_contact",
  Archived: "archived"
};
const clientStatusFromDb = Object.fromEntries(Object.entries(clientStatusToDb).map(([label, value]) => [value, label]));

function templateFromDb(value) {
  return String(value || "mock_5").replaceAll("_", "-");
}

function templateToDb(value) {
  return String(value || "mock-5").replaceAll("-", "_");
}

function pageStatusFromDb(value) {
  return {
    published: "Published",
    draft: "Draft",
    no_site_started: "No Site Started",
    archived: "Archived"
  }[value] || "Draft";
}

function remoteTrainerToUi(remoteTrainer, remotePage = null) {
  const existing = state.trainers.find(trainer =>
    trainer.remoteId === remoteTrainer.id ||
    trainer.slug === remoteTrainer.slug ||
    trainer.id === remoteTrainer.slug
  ) || {};
  const content = {
    ...(remotePage?.published_content || {}),
    ...(remotePage?.draft_content || {})
  };
  const styleSettings = remotePage?.style_settings || {};
  const socialLinks = remoteTrainer.social_links || {};
  return {
    ...existing,
    remoteId: remoteTrainer.id,
    pageId: remotePage?.id || existing.pageId || "",
    id: existing.id || remoteTrainer.slug,
    slug: remoteTrainer.slug,
    pageSlug: existing.pageSlug || remotePage?.slug?.replaceAll("-", "") || remoteTrainer.slug.replaceAll("-", ""),
    name: content.trainer_name || remoteTrainer.full_name,
    profileName: remoteTrainer.full_name,
    market: content.market || remoteTrainer.market || "",
    profileMarket: remoteTrainer.market || "",
    state: remoteTrainer.state || "",
    profileState: remoteTrainer.state || "",
    serviceArea: content.service_area || remoteTrainer.service_area || "",
    profileServiceArea: remoteTrainer.service_area || "",
    phone: remoteTrainer.phone || "(866) 436-4959",
    profilePhone: remoteTrainer.phone || "",
    email: remoteTrainer.email || "",
    profileEmail: remoteTrainer.email || "",
    title: content.title || "Lorenzo's Certified Dog Trainer",
    profileTitle: content.title || "Lorenzo's Certified Dog Trainer",
    bio: remotePage?.approved_bio || content.bio || remoteTrainer.bio || "",
    profileBio: remoteTrainer.bio || "",
    photo: content.headshot_url || remotePage?.approved_photo_urls?.[0] || remoteTrainer.headshot_url || existing.photo || "",
    profilePhoto: remoteTrainer.headshot_url || "",
    image: remotePage?.hero_image_url || content.hero_image_url || existing.image || trainerLandingDogs[templateFromDb(remotePage?.template_key)],
    companyLogo: remotePage?.logo_url || "",
    layout: templateFromDb(remotePage?.template_key),
    pageStatus: pageStatusFromDb(remotePage?.page_status),
    locked: Boolean(remotePage?.locked),
    accessStatus: remoteTrainer.access_status === "disabled" ? "Disabled" : "Active",
    specialties: Array.isArray(remoteTrainer.specialties) && remoteTrainer.specialties.length ? remoteTrainer.specialties : (existing.specialties || []),
    credentials: Array.isArray(remoteTrainer.credentials) && remoteTrainer.credentials.length ? remoteTrainer.credentials : (existing.credentials || []),
    socials: {
      facebook: remotePage?.social_facebook || socialLinks.facebook || "",
      instagram: remotePage?.social_instagram || socialLinks.instagram || "",
      tiktok: remotePage?.social_tiktok || socialLinks.tiktok || ""
    },
    heroHeadline: remotePage?.headline || existing.heroHeadline || approvedLayouts.find(item => item.id === templateFromDb(remotePage?.template_key))?.headline,
    tagline: remotePage?.subheadline || existing.tagline || "",
    seoTitle: content.seo_title || existing.seoTitle || "",
    seoDescription: content.seo_description || existing.seoDescription || "",
    review1Author: content.review1_author || existing.review1Author || "Local Client",
    review1Copy: content.review1_copy || existing.review1Copy || "Professional, patient, and focused on training that works in everyday life.",
    review2Author: content.review2_author || existing.review2Author || "Dog Owner",
    review2Copy: content.review2_copy || existing.review2Copy || "The office follow-up was clear and the training path was practical.",
    review3Author: content.review3_author || existing.review3Author || "Verified Client",
    review3Copy: content.review3_copy || existing.review3Copy || "Better communication, calmer behavior, and real-world results.",
    styleSettings: {
      fontFamily: styleSettings.font_family || "Inter",
      fontScale: Number(styleSettings.font_scale || 1),
      brandPrimary: styleSettings.brand_primary || "#071f44",
      brandAccent: styleSettings.brand_accent || "#d80f35"
    },
    sectionOrder: remotePage?.section_order || ["hero", "stats", "services", "trainer", "reviews", "consultation"],
    revision: Number(remotePage?.revision || 1),
    publishedRevision: Number(remotePage?.published_revision || 0)
  };
}

function remoteLeadToUi(row) {
  const raw = row.raw_payload || {};
  const trainer = state.trainers.find(item => item.remoteId === row.trainer_id || item.slug === row.trainer_slug);
  return {
    id: row.id,
    remoteId: row.id,
    owner: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Website Contact",
    dog: row.dog_name || raw.dog_name || "Pending",
    breed: row.dog_breed || raw.dog_breed || "Pending",
    source: row.lead_source || "Website",
    service: row.service_interest || "Contact Request",
    trainerId: trainer?.id || row.trainer_slug || "unassigned",
    phone: row.phone || "",
    email: row.email || "",
    address: [row.address_line_1, row.address_line_2, row.city, row.state, row.zip].filter(Boolean).join(", "),
    city: row.city || "",
    state: row.state || "",
    zip: row.zip || "",
    status: leadStatusFromDb[row.status] || normalizeLeadStatus(row.status),
    createdAt: String(row.created_at || "").slice(0, 10),
    next: raw.follow_up_date || "Office follow-up needed",
    followUpDate: raw.follow_up_date || "",
    note: row.office_notes || row.comments || "",
    lostReason: row.lost_reason || "",
    doNotContact: row.status === "do_not_contact",
    utm_source: raw.utm_source || "",
    utm_campaign: raw.utm_campaign || "",
    delivery_local: "saved",
    delivery_google: raw.delivery_google || "attempted",
    delivery_email: raw.delivery_email || "attempted",
    delivery_supabase: "confirmed",
    rawPayload: raw,
    visits: 1,
    submitted: row.status !== "site_visit"
  };
}

function remoteApplicationToUi(row) {
  const raw = row.raw_payload || {};
  return {
    ...raw,
    id: row.id,
    remoteId: row.id,
    createdAt: row.created_at,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    referral_source: row.referral_source,
    status: applicationStatusFromDb[row.status] || "New Application",
    note: row.office_notes || "",
    delivery_google: raw.delivery_google || "attempted",
    delivery_email: raw.delivery_email || "attempted",
    delivery_supabase: "confirmed"
  };
}

function remoteSubmissionToUi(row) {
  const trainer = state.trainers.find(item => item.remoteId === row.trainer_id);
  const type = {
    photo: "Photo",
    video: "Training Video",
    review: "Review",
    testimonial: "Testimonial"
  }[row.submission_type] || "Photo";
  return {
    id: row.id,
    remoteId: row.id,
    trainerId: trainer?.id || "",
    type,
    title: row.title || `${type} submission`,
    status: row.status ? row.status[0].toUpperCase() + row.status.slice(1) : "Pending",
    submittedAt: row.created_at,
    contentUrl: row.file_url || "",
    reviewText: ["Review", "Testimonial"].includes(type) ? row.notes || "" : "",
    note: row.office_notes || row.notes || ""
  };
}

function remoteClientToUi(row, dogs) {
  const dog = dogs.find(item => item.client_id === row.id) || {};
  const trainer = state.trainers.find(item => item.remoteId === row.trainer_id);
  return {
    id: row.id,
    remoteId: row.id,
    leadId: row.lead_id || "",
    name: row.client_name,
    phone: row.phone || "",
    email: row.email || "",
    dog: dog.name || "",
    breed: dog.breed || "",
    trainerId: trainer?.id || "",
    status: clientStatusFromDb[row.status] || "Active",
    source: row.lead_source || "",
    importedSource: row.imported_source || "Website",
    smsConsent: row.sms_consent === true ? "Yes" : row.sms_consent === false ? "No" : "Unknown",
    emailConsent: row.email_consent === true ? "Yes" : row.email_consent === false ? "No" : "Unknown",
    dateStarted: row.date_started || "",
    lastContacted: row.last_contacted || "",
    notes: row.notes || ""
  };
}

function mergeRemoteOperationalData(data) {
  const pagesByTrainer = new Map((data.pages || []).map(page => [page.trainer_id, page]));
  state.trainers = (data.trainers || []).map(trainer => remoteTrainerToUi(trainer, pagesByTrainer.get(trainer.id)));
  if (!state.trainers.some(trainer => trainer.id === state.selectedTrainerId)) {
    state.selectedTrainerId = state.trainers[0]?.id || "";
  }
  state.leads = (data.leads || []).map(remoteLeadToUi);
  state.applications = (data.applications || []).map(remoteApplicationToUi);
  state.submissions = (data.submissions || []).map(remoteSubmissionToUi);
  state.clients = (data.clients || []).map(client => remoteClientToUi(client, data.dogs || []));
  remoteEvents = data.events || [];
  remotePortalUsers = data.portalUsers || [];
  remoteReady = true;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

async function prepareRemoteData(data) {
  if (!window.LDTT_PORTAL?.signedStorageUrl) return data;
  const submissions = await Promise.all((data.submissions || []).map(async row => {
    if (!row.file_url || /^(data:|blob:|https?:|\/)/i.test(row.file_url)) return row;
    try {
      return {
        ...row,
        file_url: await window.LDTT_PORTAL.signedStorageUrl("trainer-submissions", row.file_url)
      };
    } catch (error) {
      console.warn("LDTT submission preview URL could not be created", error);
      return row;
    }
  }));
  return { ...data, submissions };
}

async function reloadRemoteData() {
  if (!window.LDTT_PORTAL?.enabled || !session.loggedIn) return;
  const data = await prepareRemoteData(await window.LDTT_PORTAL.loadOperationalData());
  mergeRemoteOperationalData(data);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trainerDraftContent(trainer) {
  return {
    trainer_name: trainer.name,
    title: trainer.title,
    market: trainer.market,
    service_area: trainer.serviceArea,
    bio: trainer.bio,
    headshot_url: trainer.photo,
    hero_image_url: trainer.image,
    seo_title: trainer.seoTitle,
    seo_description: trainer.seoDescription,
    review1_author: trainer.review1Author,
    review1_copy: trainer.review1Copy,
    review2_author: trainer.review2Author,
    review2_copy: trainer.review2Copy,
    review3_author: trainer.review3Author,
    review3_copy: trainer.review3Copy
  };
}

function trainerPagePayload(trainer) {
  return {
    trainer_id: trainer.remoteId,
    slug: trainer.slug || slugify(trainer.name),
    template_key: templateToDb(trainer.layout),
    page_status: "draft",
    locked: false,
    headline: trainer.heroHeadline || approvedLayouts.find(item => item.id === trainer.layout)?.headline || "",
    subheadline: trainer.tagline || "",
    approved_bio: trainer.bio || "",
    approved_photo_urls: [trainer.photo].filter(Boolean),
    social_facebook: trainer.socials?.facebook || null,
    social_instagram: trainer.socials?.instagram || null,
    social_tiktok: trainer.socials?.tiktok || null,
    logo_url: trainer.companyLogo || null,
    hero_image_url: trainer.image || trainerLandingDogs[trainer.layout] || null,
    draft_content: trainerDraftContent(trainer),
    style_settings: {
      font_family: trainer.styleSettings?.fontFamily || "Inter",
      font_scale: Number(trainer.styleSettings?.fontScale || 1),
      brand_primary: trainer.styleSettings?.brandPrimary || "#071f44",
      brand_accent: trainer.styleSettings?.brandAccent || "#d80f35"
    },
    section_order: trainer.sectionOrder || ["hero", "stats", "services", "trainer", "reviews", "consultation"],
    revision: Number(trainer.revision || 1) + 1
  };
}

async function persistTrainerRecord(trainer, options = {}) {
  if (!remoteReady || session.role !== "admin") return trainer;
  const trainerPayload = {
    slug: trainer.slug || slugify(trainer.name),
    full_name: trainer.name,
    email: trainer.email || null,
    phone: trainer.phone || null,
    market: trainer.market || null,
    service_area: trainer.serviceArea || null,
    state: trainer.state || stateFromMarket(trainer.market) || null,
    bio: trainer.bio || null,
    headshot_url: trainer.photo || null,
    status: "active",
    access_status: trainer.accessStatus === "Disabled" ? "disabled" : "active",
    credentials: trainer.credentials || [],
    specialties: trainer.specialties || [],
    social_links: trainer.socials || {}
  };
  if (trainer.remoteId) {
    await window.LDTT_PORTAL.update("trainers", trainer.remoteId, trainerPayload);
  } else {
    const inserted = await window.LDTT_PORTAL.insert("trainers", trainerPayload, { onConflict: "slug" });
    const savedTrainer = inserted?.[0];
    if (!savedTrainer?.id) throw new Error("Trainer record could not be created");
    trainer.remoteId = savedTrainer.id;
    trainer.slug = savedTrainer.slug;
  }
  if (!options.profileOnly) {
    const pagePayload = trainerPagePayload(trainer);
    if (trainer.pageId) {
      await window.LDTT_PORTAL.update("trainer_pages", trainer.pageId, pagePayload);
    } else {
      const insertedPages = await window.LDTT_PORTAL.insert("trainer_pages", pagePayload, { onConflict: "trainer_id" });
      trainer.pageId = insertedPages?.[0]?.id || trainer.pageId;
    }
    if (options.publish) {
      await window.LDTT_PORTAL.rpc("publish_trainer_page", { target_page_id: trainer.pageId });
    }
  }
  await reloadRemoteData();
  return findTrainer(trainer.remoteId) || trainer;
}

async function persistLeadRecord(lead) {
  if (!remoteReady || session.role !== "admin" || !lead?.remoteId) return;
  await window.LDTT_PORTAL.update("leads", lead.remoteId, {
    status: leadStatusToDb[lead.status] || "new_inquiry",
    lost_reason: lead.lostReason || null,
    office_notes: lead.note || null,
    raw_payload: {
      ...(lead.rawPayload || {}),
      follow_up_date: lead.followUpDate || null
    }
  });
}

async function persistLeadWorkflow(lead) {
  await persistLeadRecord(lead);
  // The database conversion trigger creates or updates the related client and
  // dog atomically. Avoid a second browser insert that could race the trigger.
}

async function persistApplicationRecord(application) {
  if (!remoteReady || session.role !== "admin" || !application?.remoteId) return;
  await window.LDTT_PORTAL.update("trainer_applications", application.remoteId, {
    status: applicationStatusToDb[application.status] || "new_application",
    office_notes: application.note || null
  });
}

async function persistSubmissionRecord(submission) {
  if (!remoteReady || session.role !== "admin" || !submission?.remoteId) return;
  await window.LDTT_PORTAL.update("content_submissions", submission.remoteId, {
    status: String(submission.status || "Pending").toLowerCase(),
    office_notes: submission.note || null
  });
}

async function persistTrainerAccess(trainer) {
  if (!remoteReady || session.role !== "admin") return;
  await persistTrainerRecord(trainer, { profileOnly: true });
  if (trainer.remoteId) {
    await window.LDTT_PORTAL.updateBy("portal_users", "trainer_id", trainer.remoteId, {
      active: trainer.accessStatus !== "Disabled"
    });
  }
  await reloadRemoteData();
}

function consentToBoolean(value) {
  if (String(value).toLowerCase() === "yes") return true;
  if (String(value).toLowerCase() === "no") return false;
  return null;
}

async function persistClientRecord(client) {
  if (!remoteReady || session.role !== "admin") return client;
  const trainer = findTrainer(client.trainerId);
  const payload = {
    lead_id: client.leadId || null,
    trainer_id: trainer?.remoteId || null,
    client_name: client.name,
    phone: client.phone || null,
    email: client.email || null,
    service_area: client.serviceArea || null,
    zip: client.zip || null,
    lead_source: client.source || null,
    status: clientStatusToDb[client.status] || "active",
    sms_consent: consentToBoolean(client.smsConsent),
    email_consent: consentToBoolean(client.emailConsent),
    imported_source: client.importedSource || "Manual",
    date_started: client.dateStarted || null,
    last_contacted: client.lastContacted || null,
    notes: client.notes || null
  };
  let saved;
  if (client.remoteId) {
    saved = (await window.LDTT_PORTAL.update("clients", client.remoteId, payload))?.[0];
  } else {
    saved = (await window.LDTT_PORTAL.insert("clients", payload))?.[0];
    client.remoteId = saved?.id || client.remoteId;
  }
  if (client.remoteId && (client.dog || client.breed)) {
    const existingDogs = await window.LDTT_PORTAL.select(
      "dogs",
      `select=id&client_id=eq.${encodeURIComponent(client.remoteId)}&limit=1`
    );
    const dogPayload = {
      client_id: client.remoteId,
      name: client.dog || null,
      breed: client.breed || null,
      notes: "Maintained with the client record"
    };
    if (existingDogs?.[0]?.id) {
      await window.LDTT_PORTAL.update("dogs", existingDogs[0].id, dogPayload);
    } else {
      await window.LDTT_PORTAL.insert("dogs", dogPayload);
    }
  }
  return saved || client;
}

async function runRemoteMutation(message, action, options = {}) {
  try {
    await action();
    if (options.reload !== false) await reloadRemoteData();
    if (message) showToast(message);
    if (options.render !== false) render();
  } catch (error) {
    console.error(`LDTT ${message || "save"} failed`, error);
    showToast(`Could not save: ${error.message}`);
  }
}

const remoteSaveTimers = new Map();
function scheduleRemoteSave(key, action, delay = 650) {
  if (!remoteReady) return;
  window.clearTimeout(remoteSaveTimers.get(key));
  remoteSaveTimers.set(key, window.setTimeout(() => {
    remoteSaveTimers.delete(key);
    runRemoteMutation("", action, { reload: false, render: false });
  }, delay));
}

function mergePublishedTrainer(pair) {
  if (!pair?.trainer || !pair.page) return null;
  const publishedOnly = {
    ...pair.page,
    draft_content: {},
    approved_bio: pair.page.published_content?.bio || pair.page.approved_bio
  };
  const merged = remoteTrainerToUi(pair.trainer, publishedOnly);
  const index = state.trainers.findIndex(item => item.slug === merged.slug || item.id === merged.id);
  if (index >= 0) state.trainers[index] = merged;
  else state.trainers.push(merged);
  return merged;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function icon(name) {
  return `<span class="nav-icon">${icons[name] || icons.dashboard}</span>`;
}

function trainerById(id = state.selectedTrainerId) {
  return state.trainers.find(trainer => trainer.id === id) || state.trainers[0];
}

function templatePageFile(layoutId) {
  return layoutId === "mock-6" ? "/trainer-backoffice/serious-training-results.html" : layoutId === "mock-3" ? "/trainer-backoffice/real-life-results.html" : "/trainer-backoffice/right-trainer-results.html";
}

function templatePreviewHref(layoutId) {
  return `${templatePageFile(layoutId)}?trainer=${state.selectedTrainerId || currentTrainerId()}&layout=${layoutId}`;
}

function trainerPageHref(trainerOrId) {
  const trainer = typeof trainerOrId === "string" ? trainerById(trainerOrId) : trainerOrId;
  if (trainer?.pageSlug && trainer.pageStatus === "Published") return `/${trainer.pageSlug}`;
  return `${templatePageFile(trainer.layout)}?trainer=${trainer.id}&layout=${trainer.layout}`;
}

function trainerName(id) {
  return findTrainer(id)?.name || "Unassigned";
}

function findTrainer(id) {
  return state.trainers.find(trainer => trainer.id === id || trainer.remoteId === id || trainer.slug === id || trainer.pageSlug === id);
}

function currentTrainerId() {
  if (portalUser?.trainer_id) {
    return state.trainers.find(trainer => trainer.remoteId === portalUser.trainer_id)?.id || state.selectedTrainerId;
  }
  return state.selectedTrainerId || state.trainers[0]?.id || "";
}

function trainerLeads(id = currentTrainerId()) {
  return state.leads.filter(lead => lead.trainerId === id);
}

function conversionStatuses() {
  return ["Became a Client", "First Session / Payment"];
}

function normalizeLeadStatus(status) {
  const map = {
    "Engaged Lead / No Outcome": "Engaged Lead: No Outcome",
    "Follow-Up Needed": "Follow Up Call Needed",
    "Follow-Up Scheduled": "Follow Up Call Needed",
    "Evaluation Completed": "Evaluation Complete",
    "Evaluation Booked": "Evaluation Scheduled",
    "Client Won": "Became a Client"
  };
  return map[status] || status || "New Inquiry";
}

function render() {
  if (document.getElementById("publicSite")) {
    renderPublicSite();
    return;
  }
  document.body.classList.toggle("is-logged-in", session.loggedIn);
  document.body.classList.toggle("is-logged-out", !session.loggedIn);
  if (!session.loggedIn) return;
  if (session.role === "trainer" && portalUser?.must_change_password) {
    state.activeView = "settings";
  }
  renderSidebar();
  renderTopbar();
  renderView();
}

async function bootstrapApplication() {
  const publicTarget = document.getElementById("publicSite");
  if (publicTarget) {
    renderPublicSite();
    const requested = document.body.dataset.trainer || new URLSearchParams(window.location.search).get("trainer") || "";
    const localTrainer = findTrainer(requested);
    const slug = localTrainer?.slug || requested;
    if (window.LDTT_PORTAL?.enabled && slug) {
      try {
        const pair = await window.LDTT_PORTAL.loadPublishedTrainer(slug);
        const merged = mergePublishedTrainer(pair);
        if (merged) {
          state.selectedTrainerId = merged.id;
          renderPublicSite();
        }
      } catch (error) {
        console.warn("LDTT published trainer page sync failed; using the local published fallback.", error);
      }
    }
    return;
  }

  if (!window.LDTT_PORTAL?.enabled) {
    session = loadSession();
    render();
    return;
  }

  try {
    portalUser = await window.LDTT_PORTAL.currentPortalUser();
    if (!portalUser) {
      session = { loggedIn: false, role: "" };
      render();
      return;
    }
    if (!portalUser.active) {
      await window.LDTT_PORTAL.signOut();
      portalUser = null;
      session = { loggedIn: false, role: "" };
      const status = document.getElementById("loginStatus");
      if (status) status.textContent = "This portal account has been disabled. Contact Lorenzo's office.";
      render();
      return;
    }
    session = { loggedIn: true, role: portalUser.role };
    state.role = portalUser.role;
    const data = await prepareRemoteData(await window.LDTT_PORTAL.loadOperationalData());
    mergeRemoteOperationalData(data);
    if (portalUser.trainer_id) {
      state.selectedTrainerId = state.trainers.find(trainer => trainer.remoteId === portalUser.trainer_id)?.id || state.selectedTrainerId;
    }
    render();
  } catch (error) {
    console.error("LDTT portal bootstrap failed", error);
    session = { loggedIn: false, role: "" };
    const status = document.getElementById("loginStatus");
    if (status) status.textContent = "The portal could not load. Please sign in again.";
    render();
  }
}

function adminNav() {
  return [
    ["dashboard", "Dashboard", "dashboard"],
    ["trainerPages", "Trainer Pages", "globe"],
    ["pageEditor", "Page Editor", "edit"],
    ["trainers", "Trainers", "users"],
    ["leads", "Leads", "lead"],
    ["applications", "Applications", "message", applicationRows().length],
    ["clients", "Clients", "users"],
    ["import", "Client Import", "media"],
    ["approvals", "Approvals", "star", pendingSubmissions().length],
    ["reports", "Reports", "report"],
    ["settings", "Settings", "settings"]
  ];
}

function trainerNav() {
  return [
    ["dashboard", "Dashboard", "dashboard"],
    ["leads", "My Leads", "lead", trainerLeads().filter(l => !["Archived", "Became a Client"].includes(l.status)).length],
    ["myPage", "My Trainer Page", "monitor"],
    ["performance", "Performance", "report"],
    ["submitMedia", "Submit Photos/Videos", "media", trainerMediaSubmissions().filter(s => s.status === "Pending").length],
    ["submitReviews", "Submit Reviews", "star", trainerReviewSubmissions().filter(s => s.status === "Pending").length],
    ["settings", "Settings", "settings"]
  ];
}

function renderSidebar() {
  const isAdmin = session.role === "admin";
  const passwordSetupRequired = !isAdmin && Boolean(portalUser?.must_change_password);
  const nav = isAdmin
    ? adminNav()
    : passwordSetupRequired
      ? [["settings", "Create Password", "settings"]]
      : trainerNav();
  document.getElementById("sidebar").innerHTML = `
    <a class="brand-card" href="../index.html"><img src="../assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"></a>
    <div><p class="portal-tag">${isAdmin ? "Admin Portal" : "Trainer Portal"}</p></div>
    <nav class="side-nav" aria-label="${isAdmin ? "Admin" : "Trainer"} navigation">
      ${nav.map(([view, label, iconName, count]) => `
        <button class="nav-btn ${state.activeView === view ? "active" : ""}" data-view="${view}">
          ${icon(iconName)}<span>${label}</span>${count ? `<span class="nav-count">${count}</span>` : ""}
        </button>`).join("")}
    </nav>
    <div class="side-spacer"></div>
    <div class="side-help">
      <strong>${isAdmin ? "Office-Controlled Network" : "Locked Page Access"}</strong>
      <p>${isAdmin ? "Office controls trainer pages, approvals, leads, clients, and reporting." : "Your public trainer page is managed by Lorenzo's office. Submit content for approval here."}</p>
      ${isAdmin
        ? `<button class="btn btn-outline btn-full" data-view="trainerPages">Manage Trainer Pages</button>`
        : passwordSetupRequired
          ? `<p class="panel-copy">Create your permanent password to unlock the trainer portal.</p>`
          : `<button class="btn btn-outline btn-full" data-view="submitMedia">Submit Content</button>`}
    </div>
    <div class="side-user">
      <span class="avatar">${isAdmin ? "LO" : "EB"}</span>
      <div><strong>${isAdmin ? "Lorenzo's Office" : trainerById(currentTrainerId()).name}</strong><span>${isAdmin ? "Administrator" : "Certified Trainer"}</span></div>
    </div>`;
}

function renderTopbar() {
  const isAdmin = session.role === "admin";
  const passwordSetupRequired = !isAdmin && Boolean(portalUser?.must_change_password);
  const titles = isAdmin ? {
    dashboard: ["Admin Dashboard", "Network performance, lead outcomes, and conversion reporting."],
    trainerPages: ["Trainer Landing Pages", "Three approved designs, page performance, publishing, and locking."],
    pageEditor: ["Live Trainer Page Editor", "Edit office-approved page content and branding with a real-time preview."],
    trainers: ["Trainer Onboarding", "Collect the trainer's account, media, credentials, reviews, SEO, and approved design."],
    leads: ["Leads", "Office-managed funnel from inquiry to paying client."],
    applications: ["Trainer Applications", "Recruiting submissions from the website application form."],
    clients: ["Client Database", "Central list for active, past, won, lost, bad lead, and do-not-contact records."],
    import: ["Client Import", "Prototype CSV import with preview, duplicate checks, and consent protection."],
    approvals: ["Media & Review Approvals", "Approve or decline trainer-submitted content before it appears publicly."],
    reports: ["Conversion Reports", "Conversions count only first session/payment or became a client."],
    settings: ["Settings", "Portal access, database status, and account controls."]
  } : {
    dashboard: ["Dashboard", "Assigned leads, office notes, locked page access, and pending submissions."],
    leads: ["My Leads", "See office notes and outcomes for leads assigned to you."],
    myPage: ["My Trainer Page", "This page is controlled, published, and locked by Lorenzo's office."],
    performance: ["Performance", "Basic lead and conversion numbers from office-managed tracking."],
    submitMedia: ["Submit Photos/Videos", "Send training photos and videos to the office for approval."],
    submitReviews: ["Submit Reviews", "Send reviews and testimonials to the office for approval."],
    settings: ["Settings", "Trainer portal access and account security."]
  };
  const [title, sub] = passwordSetupRequired
    ? ["Secure Your Account", "Replace the temporary password before using the trainer portal."]
    : titles[state.activeView] || titles.dashboard;
  document.getElementById("topbar").innerHTML = `
    <div class="page-title"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(sub)}</p></div>
    <div class="top-actions">
      ${isAdmin
        ? `<button class="btn btn-red add-trainer-primary" id="addTrainer">+ Add New Trainer</button><button class="btn btn-outline">Filters</button><button class="btn btn-outline" data-view="import">Import Clients</button>`
        : passwordSetupRequired
          ? ""
          : `<a class="btn btn-outline" href="${trainerPageHref(currentTrainerId())}" target="_blank" rel="noopener">Open My Page</a><button class="btn btn-red" data-view="submitMedia">Submit Content</button>`}
      <span class="bell">${icon("message")}</span>
      <button class="profile-chip"><span class="avatar">${isAdmin ? "LO" : "EB"}</span><span><strong>${isAdmin ? "Admin" : trainerById(currentTrainerId()).name}</strong><small>${isAdmin ? "Office" : "Trainer"}</small></span></button>
    </div>`;
}

function renderView() {
  const target = document.getElementById("workspaceView");
  const screens = session.role === "admin" ? adminScreens : trainerScreens;
  if (session.role === "trainer" && portalUser?.must_change_password) {
    state.activeView = "settings";
  }
  target.innerHTML = screens[state.activeView]?.() || screens.dashboard();
}

const adminScreens = {
  dashboard() {
    const metrics = getMetrics();
    return `
      ${metricGrid([
        ["monitor", "Site Visits / Clicks", metrics.visits, "Traffic only", ""],
        ["lead", "Form Submissions", metrics.forms, "Inquiries only", ""],
        ["calendar", "Evaluation Scheduled", metrics.evalScheduled, "Mid-funnel", "up"],
        ["calendar", "Evaluation Complete", metrics.evalCompleted, "Decision point", "up"],
        ["calendar", "Follow Up Call Needed", metrics.followUpNeeded, "Office action", "down"],
        ["lead", "Engaged Lead: No Outcome", metrics.engagedNoOutcome, "Needs decision", ""],
        ["trophy", "First Session / Payment", metrics.firstPayment, "Conversion event", "up"],
        ["trophy", "Became a Client", metrics.clientWon, "Conversion event", "up"],
        ["settings", "Lost / No Response", metrics.lostNoResponse, "Needs review", "down"]
      ])}
      <div class="dashboard-grid">
        ${panel("Trainer-Specific Conversion", `<button class="btn btn-outline" data-view="reports">View Reports</button>`, trainerPerformanceTable())}
        ${panel("Office Funnel", "", leadSummary())}
      </div>
      <div class="bottom-grid">
        ${panel("Lead Status Updates", "", leadOutcomeTable())}
        ${panel("Client Import Protection", `<button class="btn btn-red" data-view="import">Open Import</button>`, protectionSummary(), "pad")}
      </div>`;
  },
  trainerPages() {
    return `${panel("Three Approved Trainer Landing Page Designs", "", approvedLayoutCards(), "pad")}<br>${panel("Trainer Page Control & Performance", `<button class="btn btn-red" id="addTrainer">Onboard New Trainer</button>`, trainerPageCards())}<br>${panel("Recent Trainer Page Activity", "", trainerSiteActivityTable(), "pad")}`;
  },
  pageEditor() {
    return trainerPageEditor();
  },
  trainers() {
    return `${trainerAdminForm()}<br>${panel("Existing Trainer Profiles", `<button class="btn btn-red" id="addTrainer">+ Add New Trainer</button>`, trainerSelectList(), "pad")}`;
  },
  leads() {
    return `${leadSourceRecordNotice()}${panel("Office Lead Pipeline", `<button class="btn btn-outline" data-filter-leads="all">All Statuses</button><button class="btn btn-outline">Date Filter</button>`, leadPipelineTable(true), "pad")}`;
  },
  applications() {
    return `${metricGrid([
      ["message", "Applications", applicationRows().length, "Website submissions", ""],
      ["lead", "New", applicationRows().filter(app => app.status === "New Application").length, "Needs review", ""],
      ["calendar", "Discovery Follow-Up", applicationRows().filter(app => app.status === "Discovery Follow-Up").length, "Recruiting action", "up"],
      ["trophy", "Moved Forward", applicationRows().filter(app => app.status === "Moved Forward").length, "Qualified", "up"]
    ])}${panel("Trainer Application Response Sheet", `<a class="btn btn-red" href="${TRAINER_APPLICATION_RESPONSE_SHEET}" target="_blank" rel="noopener">Open Response Sheet</a>`, trainerApplicationGoogleFormPanel(), "pad")}<br>${panel("Trainer Application Inbox", "", applicationTable(), "pad")}`;
  },
  clients() {
    return `${clientFilterBar()}${panel("Won / Paid Lead Queue", `<button class="btn btn-outline" data-view="leads">Open Lead Pipeline</button>`, convertedLeadQueue(), "pad")}<br>${panel("Central Client Database", `<button class="btn btn-red" data-view="import">Import Clients</button>`, clientTable(), "pad")}`;
  },
  import() {
    return `<div class="import-layout">${panel("1. Paste CSV / Spreadsheet Data", `<button class="btn btn-outline" id="loadSampleCsv">Load Sample</button>`, importInput(), "pad")}${panel("2. Preview Before Import", `<button class="btn btn-red" id="previewImport">Preview Import</button>`, importPreview(), "pad")}</div>`;
  },
  approvals() {
    return panel("Pending Trainer Submissions", "", submissionsTable(true), "pad");
  },
  reports() {
    const metrics = getMetrics();
    return `
      ${metricGrid([
        ["monitor", "Visits", metrics.visits, "Not conversion", ""],
        ["lead", "Inquiries", metrics.forms, "Not conversion", ""],
        ["calendar", "Evaluation Complete", metrics.evalCompleted, "Funnel", "up"],
        ["trophy", "True Conversions", metrics.trueConversions, "Won/payment only", "up"]
      ])}
      <div class="dashboard-grid">${panel("Clicks By Region", "", regionClickReport(), "pad")}${panel("Clicks By Trainer", "", trainerClickReport(), "pad")}</div>
      <div class="dashboard-grid">${panel("Conversion By Trainer", "", trainerPerformanceTable())}${panel("Lost Reasons", "", lostReasonsTable())}</div>
      ${panel("Reporting Rule", "", `<p class="panel-copy">Conversions are counted only when a lead reaches <strong>First Session / Payment</strong> or <strong>Became a Client</strong>. Clicks and form submissions stay visible as traffic and inquiry metrics, but they do not inflate conversion reporting.</p>`, "pad")}`;
  },
  settings() {
    return panel("Settings", "", `<p class="panel-copy"><strong>Supabase connected.</strong> Leads, applications, clients, approvals, trainer access, profiles, reporting, and trainer-page publishing are shared across authorized office devices. Google Sheets and FormSubmit remain separate delivery backups for website forms.</p><br><button class="btn btn-red" id="logoutBtn">Log Out</button>`, "pad");
  }
};

const trainerScreens = {
  dashboard() {
    const trainer = trainerById(currentTrainerId());
    const leads = trainerLeads(trainer.id);
    const won = leads.filter(l => conversionStatuses().includes(l.status)).length;
    return `
      ${metricGrid([
        ["lead", "Assigned Leads", leads.length, "Office-managed", ""],
        ["calendar", "Evaluations Scheduled", leads.filter(l => l.status === "Evaluation Scheduled").length, "From office", "up"],
        ["trophy", "Became Client / Paid", won, "True conversion", "up"],
        ["media", "Pending Submissions", trainerSubmissions().filter(s => s.status === "Pending").length, "Awaiting approval", ""]
      ])}
      <div class="dashboard-grid">
        ${panel("My Locked Trainer Page", `<a class="btn btn-outline" href="${trainerPageHref(trainer)}" target="_blank" rel="noopener">View Page</a>`, lockedPageCard(trainer), "pad")}
        ${panel("Assigned Leads & Office Notes", `<button class="btn btn-outline" data-view="leads">View All</button>`, leadPipelineTable(false), "pad")}
      </div>
      <div class="dashboard-grid">
        ${panel("What Trainers Can Do", "", trainerAllowedList(), "pad")}
        ${panel("Submit Content For Approval", `<button class="btn btn-red" data-view="submitMedia">Submit Media</button><button class="btn btn-outline" data-view="submitReviews">Submit Reviews</button>`, `<p class="panel-copy">Photos, videos, reviews, screenshots, and testimonials go to Lorenzo's office before anything appears publicly.</p>`, "pad")}
      </div>`;
  },
  myPage() {
    const trainer = trainerById(currentTrainerId());
    return `<div class="dashboard-grid">${panel("My Locked Trainer Landing Page", `<a class="btn btn-red" href="${trainerPageHref(trainer)}" target="_blank" rel="noopener">Open Full Page</a>`, lockedPageCard(trainer), "pad")}${panel("Locked Page Details", "", lockedPageDetails(trainer), "pad")}</div>`;
  },
  leads() {
    return panel("Assigned Leads", "", leadPipelineTable(false), "pad");
  },
  performance() {
    const trainer = trainerById(currentTrainerId());
    const leads = filteredLeadRows(trainerLeads(trainer.id));
    const trueConversions = leads.filter(l => conversionStatuses().includes(l.status)).length;
    return `${metricGrid([
      ["lead", "Leads In Range", leads.length, leadRangeLabel(), ""],
      ["calendar", "Evaluation Complete", leads.filter(l => l.status === "Evaluation Complete").length, "Office status", "up"],
      ["trophy", "Won / Paid", trueConversions, "True conversion", "up"],
      ["monitor", "Page Forms", trainer.forms, "Read-only total", ""]
    ])}${panel("Lead Performance By Date Range", "", leadPipelineTable(false), "pad")}${panel("Performance Notes", "", `<p class="panel-copy">These numbers are read-only for trainers. Lorenzo's office owns lead statuses and conversion rules, while this tab lets the trainer review lead activity by last 7 days, last 30 days, last 60 days, or a custom date range.</p>`, "pad")}`;
  },
  submitMedia() {
    return `<div class="dashboard-grid">${panel("Submit Photos / Videos", `<button class="btn btn-red" id="submitDemoContent" data-submit-kind="media">Submit For Approval</button>`, submissionForm("media"), "pad")}${panel("My Photo / Video Status", "", submissionsTable(false, "media"), "pad")}</div>`;
  },
  submitReviews() {
    return `<div class="dashboard-grid">${panel("Submit Review / Testimonial", `<button class="btn btn-red" id="submitDemoContent" data-submit-kind="review">Submit For Approval</button>`, submissionForm("review"), "pad")}${panel("My Review Status", "", submissionsTable(false, "review"), "pad")}</div>`;
  },
  settings() {
    return panel("Trainer Settings", "", `${portalUser?.must_change_password ? `<form id="changePasswordForm" class="password-change-form"><h3>Create your permanent password</h3><p class="panel-copy">Your temporary password worked. Choose a permanent password before continuing.</p><label>New Password<input required minlength="10" name="password" type="password" autocomplete="new-password"></label><label>Confirm Password<input required minlength="10" name="confirmation" type="password" autocomplete="new-password"></label><button class="btn btn-red" type="submit">Save Permanent Password</button><div id="passwordStatus" role="status" aria-live="polite"></div></form><hr>` : ""}<p class="panel-copy">Your profile and public page are managed by Lorenzo's office. Contact the office for changes to bio, market, phone, page layout, or published content.</p><br><button class="btn btn-red" id="logoutBtn">Log Out</button>`, "pad");
  }
};

function metricGrid(items) {
  return `<div class="metrics-grid ${items.length === 4 ? "trainer-metrics" : ""}">${items.map(([iconName, label, value, change, tone]) => `
    <article class="metric-card"><div class="metric-top">${icon(iconName)} ${label}</div><strong>${value}</strong><span class="${tone}">${change}</span></article>
  `).join("")}</div>`;
}

function panel(title, action, body, extra = "") {
  return `<section class="panel ${extra}"><div class="panel-head"><h2>${title}</h2><div class="row-actions">${action || ""}</div></div>${extra === "pad" ? body : `<div>${body}</div>`}</section>`;
}

function getMetrics() {
  const leadRows = realLeadRows();
  const events = siteEventRows();
  const visits = events.filter(event => event.event_type === "trainer_page_view").length;
  const forms = leadRows.filter(l => l.submitted).length;
  const evalScheduled = leadRows.filter(l => l.status === "Evaluation Scheduled").length;
  const evalCompleted = leadRows.filter(l => l.status === "Evaluation Complete").length;
  const followUpNeeded = leadRows.filter(l => l.status === "Follow Up Call Needed").length;
  const engagedNoOutcome = leadRows.filter(l => l.status === "Engaged Lead: No Outcome").length;
  const firstPayment = leadRows.filter(l => l.status === "First Session / Payment").length;
  const clientWon = leadRows.filter(l => l.status === "Became a Client").length;
  return { visits, forms, evalScheduled, evalCompleted, followUpNeeded, engagedNoOutcome, firstPayment, clientWon, trueConversions: firstPayment + clientWon, lostNoResponse: leadRows.filter(l => l.status === "Lost / No Response").length };
}

function allLeadRows() {
  return remoteReady ? state.leads : [...contactSubmissionRows(), ...state.leads];
}

function realLeadRows() {
  return remoteReady ? state.leads : contactSubmissionRows();
}

function siteEventRows() {
  const rows = remoteReady ? remoteEvents : storedRows(SITE_EVENT_KEY);
  return rows.map(event => ({
    ...event,
    trainer_id: event.trainer_id || trainerIdFromSlug(event.trainer_slug) || trainerIdFromName(event.assigned_trainer),
    event_type: event.event_type || "trainer_page_view",
    trainer_city: event.trainer_city || cityFromMarket(event.trainer_market),
    trainer_state: event.trainer_state || stateFromMarket(event.trainer_market),
    timestamp: event.timestamp || event.created_at || new Date().toISOString()
  }));
}

function realTrainerStats(trainer) {
  const events = siteEventRows().filter(event => sameTrainerEvent(event, trainer));
  const leads = realLeadRows().filter(lead => lead.trainerId === trainer.id || lead.trainerId === trainer.slug || lead.trainerId === trainer.pageSlug);
  const clicks = events.filter(event => event.event_type === "trainer_page_view").length;
  const forms = leads.filter(lead => lead.submitted).length;
  const conversions = leads.filter(lead => conversionStatuses().includes(lead.status)).length;
  return { clicks, forms, conversions, leads };
}

function sameTrainerEvent(event, trainer) {
  return event.trainer_id === trainer.id
    || event.trainer_slug === trainer.slug
    || event.trainer_slug === trainer.pageSlug
    || event.assigned_trainer === trainer.name;
}

function trainerIdFromSlug(slug) {
  if (!slug) return "";
  return state.trainers.find(trainer => trainer.slug === slug || trainer.pageSlug === slug || trainer.id === slug)?.id || "";
}

function cityFromMarket(market = "") {
  return String(market).split(",")[0].trim();
}

function stateFromMarket(market = "") {
  const parts = String(market).split(",");
  return parts.length > 1 ? parts[1].trim() : "";
}

function trainerPerformanceTable() {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Trainer</th><th>Page Status</th><th>Clicks</th><th>Forms</th><th>True Conversions</th><th>Rate</th></tr></thead><tbody>${state.trainers.map(trainer => {
    const stats = realTrainerStats(trainer);
    const rate = stats.forms ? `${Math.round((stats.conversions / stats.forms) * 1000) / 10}%` : "0%";
    return `<tr><td><div class="row-person"><span class="avatar">${initials(trainer.name)}</span><div><strong>${escapeHtml(trainer.name)}</strong><small>${escapeHtml(trainer.market)}</small></div></div></td><td>${pageStatusBadge(trainer)}</td><td><strong>${stats.clicks}</strong></td><td><strong>${stats.forms}</strong></td><td><strong>${stats.conversions}</strong></td><td>${rate}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function regionClickReport() {
  const rows = regionClickRows();
  const max = Math.max(1, ...rows.map(row => row.clicks));
  return `<div class="region-map-report">
    <div class="map-card">
      <span class="map-pin pin-1"></span><span class="map-pin pin-2"></span><span class="map-pin pin-3"></span>
      <h3>Trainer Page Click Heat Map</h3>
      <p>Shows the city/state attached to each trainer landing page click. Visitor IP geolocation will become exact after Supabase analytics is connected.</p>
    </div>
    <div class="region-bars">${rows.map((row, index) => `<article class="region-row"><div><strong>${escapeHtml(row.city || "Unknown City")}, ${escapeHtml(row.state || "Unknown State")}</strong><span>${escapeHtml(row.trainerNames.join(", ") || "Unassigned trainer")}</span></div><div class="region-meter"><span style="width:${Math.max(8, Math.round((row.clicks / max) * 100))}%"></span></div><b>${row.clicks}</b></article>`).join("") || `<p class="panel-copy">No trainer page clicks recorded yet. Open a trainer landing page to record the first region event.</p>`}</div>
  </div>`;
}

function trainerClickReport() {
  const rows = state.trainers.map(trainer => ({ trainer, stats: realTrainerStats(trainer) })).sort((a, b) => b.stats.clicks - a.stats.clicks);
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Trainer</th><th>City / State</th><th>Page Clicks</th><th>Forms</th><th>Last Click</th></tr></thead><tbody>${rows.map(({ trainer, stats }) => {
    const last = siteEventRows().filter(event => sameTrainerEvent(event, trainer)).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return `<tr><td><strong>${escapeHtml(trainer.name)}</strong><small>${escapeHtml(trainer.pageSlug || trainer.slug || trainer.id)}</small></td><td>${escapeHtml(trainerCity(trainer))}, ${escapeHtml(trainer.state || stateFromMarket(trainer.market) || "—")}</td><td><strong>${stats.clicks}</strong></td><td>${stats.forms}</td><td>${last ? escapeHtml(new Date(last.timestamp).toLocaleString()) : "—"}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function regionClickRows() {
  const rows = new Map();
  siteEventRows().filter(event => event.event_type === "trainer_page_view").forEach(event => {
    const trainer = findTrainer(event.trainer_id) || findTrainer(event.trainer_slug);
    const city = event.trainer_city || trainerCity(trainer) || "Unknown";
    const regionState = event.trainer_state || trainer?.state || stateFromMarket(trainer?.market) || "Unknown";
    const key = `${city}|${regionState}`;
    const row = rows.get(key) || { city, state: regionState, clicks: 0, trainerNames: new Set() };
    row.clicks += 1;
    if (event.assigned_trainer || trainer?.name) row.trainerNames.add(event.assigned_trainer || trainer.name);
    rows.set(key, row);
  });
  realLeadRows().forEach(lead => {
    const city = cityFromAddress(lead.address);
    const regionState = stateFromAddress(lead.address);
    if (!city && !regionState) return;
    const key = `${city || "Unknown"}|${regionState || "Unknown"}`;
    const row = rows.get(key) || { city: city || "Unknown", state: regionState || "Unknown", clicks: 0, trainerNames: new Set() };
    row.trainerNames.add(trainerName(lead.trainerId));
    rows.set(key, row);
  });
  return [...rows.values()].map(row => ({ ...row, trainerNames: [...row.trainerNames] })).sort((a, b) => b.clicks - a.clicks);
}

function cityFromAddress(address = "") {
  const parts = String(address).split(",").map(part => part.trim()).filter(Boolean);
  return parts.length >= 3 ? parts[parts.length - 3] : "";
}

function stateFromAddress(address = "") {
  const parts = String(address).split(",").map(part => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : "";
}

function leadSourceRecordNotice() {
  const contactCount = realLeadRows().length;
  return `<div class="source-record-note lead-source-note">
    <span class="status live">Contact Lead Feed Active</span>
    <p>Contact forms continue to log to the connected Google Sheet and office email while Supabase keeps the shared office lead record. ${contactCount} lead${contactCount === 1 ? "" : "s"} ${contactCount === 1 ? "is" : "are"} currently available to authorized office users.</p>
  </div><br>`;
}

function leadDateControls() {
  return `<div class="lead-date-controls">
    <span>Lead date:</span>
    ${[["7", "Last 7 Days"], ["30", "Last 30 Days"], ["60", "Last 60 Days"]].map(([value, label]) => `<button class="btn ${state.leadDateRange === value ? "btn-red" : "btn-outline"}" data-lead-range="${value}">${label}</button>`).join("")}
    <button class="btn ${state.leadDateRange === "custom" ? "btn-red" : "btn-outline"}" data-lead-range="custom">Custom</button>
    <input class="select-pill" type="date" name="lead-custom-start" value="${escapeHtml(state.customLeadStart)}">
    <input class="select-pill" type="date" name="lead-custom-end" value="${escapeHtml(state.customLeadEnd)}">
  </div>`;
}

function filteredLeadRows(rows) {
  const sorted = [...rows].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const end = state.leadDateRange === "custom" ? new Date(`${state.customLeadEnd}T23:59:59`) : new Date();
  const start = state.leadDateRange === "custom"
    ? new Date(`${state.customLeadStart}T00:00:00`)
    : new Date(end.getTime() - (Number(state.leadDateRange || 60) - 1) * 86400000);
  return sorted.filter(lead => {
    const rawCreated = String(lead.createdAt || "");
    const created = /^\d{4}-\d{2}-\d{2}$/.test(rawCreated)
      ? new Date(`${rawCreated}T00:00:00`)
      : new Date(rawCreated);
    const haystack = [lead.owner, lead.dog, lead.phone, lead.email, lead.address, lead.source, lead.service, trainerName(lead.trainerId)].join(" ").toLowerCase();
    return created >= start && created <= end
      && (!state.leadSearch || haystack.includes(state.leadSearch.toLowerCase()))
      && (state.leadStatusFilter === "All" || lead.status === state.leadStatusFilter)
      && (state.leadTrainerFilter === "All" || lead.trainerId === state.leadTrainerFilter);
  });
}

function leadRangeLabel() {
  if (state.leadDateRange === "custom") return `${state.customLeadStart} to ${state.customLeadEnd}`;
  return `last ${state.leadDateRange} days`;
}

function leadOutcomeTable() {
  const rows = realLeadRows();
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Client / Dog</th><th>Trainer</th><th>Service</th><th>Status</th><th>Office Note</th><th>Action</th></tr></thead><tbody>${rows.map(lead => `
    <tr><td><strong>${escapeHtml(lead.owner)}</strong><small>${escapeHtml(lead.dog)} (${escapeHtml(lead.breed)})</small></td><td>${escapeHtml(trainerName(lead.trainerId))}</td><td>${escapeHtml(lead.service)}</td><td>${statusSelect(lead)}</td><td><input class="select-pill note-input" data-lead-note="${lead.id}" value="${escapeHtml(lead.note)}"></td><td><button class="btn btn-red" data-save-lead="${lead.id}">Update</button></td></tr>`).join("") || `<tr><td colspan="6">No website lead submissions match the current filters.</td></tr>`}</tbody></table></div><p class="panel-copy">Website contact submissions are shared with authorized office users through Supabase.</p>`;
}

function leadPipelineTable(admin) {
  const baseRows = admin ? allLeadRows() : trainerLeads();
  const rows = filteredLeadRows(baseRows);
  const table = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Lead Date</th><th>Owner / Dog</th><th>Contact</th><th>Source</th><th>Service</th><th>${admin ? "Trainer" : "Office Outcome"}</th><th>Status</th><th>Office Notes</th></tr></thead><tbody>${rows.map((lead, index) => `<tr data-open-lead="${lead.id}"><td>${formatDate(lead.createdAt)}</td><td><div class="row-person"><span class="dog-avatar"><img src="${dogImages[index % dogImages.length]}" alt=""></span><div><strong>${escapeHtml(lead.owner)}</strong><small>${escapeHtml(lead.dog)} · ${escapeHtml(lead.breed)}</small></div></div></td><td><strong>${escapeHtml(lead.phone || "—")}</strong><small>${escapeHtml(lead.email || "—")}</small><small>${escapeHtml(lead.address || "Address pending")}</small></td><td>${escapeHtml(lead.source)}</td><td>${escapeHtml(lead.service)}</td><td>${admin ? escapeHtml(trainerName(lead.trainerId)) : escapeHtml(lead.next)}</td><td>${admin ? statusSelect(lead) : `<span class="status ${statusClass(lead.status)}">${escapeHtml(lead.status)}</span>`}</td><td>${escapeHtml(lead.note || "—")}</td></tr>`).join("") || `<tr><td colspan="8">No leads found for this date range.</td></tr>`}</tbody></table></div>`;
  return `${leadDateControls()}${leadWorkspaceControls(admin)}<p class="panel-copy lead-result-count">Showing ${rows.length} lead${rows.length === 1 ? "" : "s"} from ${escapeHtml(leadRangeLabel())}.</p>${admin && state.leadViewMode === "board" ? leadKanban(rows) : table}${admin && state.leadViewMode === "board" ? `<details class="secondary-table"><summary>Open detailed table view</summary>${table}</details>` : ""}${leadDetailPanel()}`;
}

function leadWorkspaceControls(admin) {
  if (!admin) return "";
  return `<div class="lead-workspace-controls"><input class="select-pill lead-search" data-lead-search value="${escapeHtml(state.leadSearch)}" placeholder="Search name, phone, email, dog, city..."><select class="select-pill" data-lead-filter="trainer"><option value="All">All trainers</option>${state.trainers.map(t => `<option value="${t.id}" ${state.leadTrainerFilter === t.id ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("")}</select><select class="select-pill" data-lead-filter="status"><option>All</option>${leadStatuses.map(s => `<option ${state.leadStatusFilter === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select><div class="view-switch"><button class="btn ${state.leadViewMode === "board" ? "btn-red" : "btn-outline"}" data-lead-view="board">Pipeline</button><button class="btn ${state.leadViewMode === "table" ? "btn-red" : "btn-outline"}" data-lead-view="table">Table</button></div></div>`;
}

const boardColumns = ["New Inquiry", "Office Contacted", "Evaluation Scheduled", "Evaluation Complete", "First Session / Payment", "Became a Client", "Lost"];
function boardStatus(status) { return /^(Lost|Bad Lead|Do Not Contact|Archived)/.test(status) ? "Lost" : status; }
function deliveryBadges(lead) {
  const badge = (label, value) => `<span class="${value === "saved" || value === "confirmed" ? "delivery-ok" : value === "failed" ? "delivery-failed" : "delivery-pending"}">${label}: ${escapeHtml(String(value || "unknown").replaceAll("_", " "))}</span>`;
  return `<div class="delivery-badges">${badge("Local", lead.delivery_local || "saved")}${badge("Sheet", lead.delivery_google || "not recorded")}${badge("Email", lead.delivery_email || "not recorded")}${badge("Supabase", lead.delivery_supabase || "not connected")}</div>`;
}
function leadKanban(rows) {
  return `<div class="lead-kanban">${boardColumns.map(column => { const cards = rows.filter(l => boardStatus(l.status) === column); return `<section class="kanban-column" data-drop-status="${column}"><header><strong>${column}</strong><span>${cards.length}</span></header><div class="kanban-cards">${cards.map(lead => `<article class="lead-card" draggable="true" data-lead-card="${lead.id}" data-open-lead="${lead.id}"><div class="lead-card-top"><strong>${escapeHtml(lead.owner)}</strong><span>${formatDate(lead.createdAt)}</span></div><p>${escapeHtml(lead.dog || "Dog pending")} · ${escapeHtml(lead.service || "Service pending")}</p><small>${escapeHtml(trainerName(lead.trainerId))} · ${escapeHtml(lead.phone || lead.email || "Contact pending")}</small>${deliveryBadges(lead)}</article>`).join("") || `<p class="empty-column">Drop leads here</p>`}</div></section>`; }).join("")}</div>`;
}

function leadDetailPanel() {
  const lead = allLeadRows().find(l => l.id === state.selectedLeadId);
  if (!lead) return "";
  return `<aside class="lead-detail-panel"><button class="detail-close" data-close-lead aria-label="Close">×</button><span class="portal-tag">Full Lead Record</span><h2>${escapeHtml(lead.owner)}</h2><p>${escapeHtml(lead.dog || "Dog pending")} · ${escapeHtml(lead.service || "Service pending")}</p><div class="lead-contact-grid"><div><span>Phone</span><strong>${escapeHtml(lead.phone || "—")}</strong></div><div><span>Email</span><strong>${escapeHtml(lead.email || "—")}</strong></div><div class="wide"><span>Address</span><strong>${escapeHtml(lead.address || "Address pending")}</strong></div><div><span>Source trainer</span><strong>${escapeHtml(trainerName(lead.trainerId))}</strong></div><div><span>Source</span><strong>${escapeHtml(lead.source || "Website")}</strong></div><div><span>Campaign</span><strong>${escapeHtml(lead.utm_campaign || "Not captured")}</strong></div><div><span>UTM source</span><strong>${escapeHtml(lead.utm_source || "Not captured")}</strong></div></div>${deliveryBadges(lead)}<label>Status${statusSelect(lead)}</label><label>Follow-up date<input class="select-pill" type="date" data-lead-followup="${lead.id}" value="${escapeHtml(lead.followUpDate || "")}"></label><label>Lost reason<select class="select-pill" data-lead-lost-reason="${lead.id}"><option value="">Select reason</option>${["No response","Price concern","Chose another provider","Not ready","Location issue","Schedule conflict","Not a fit","Other"].map(r => `<option ${lead.lostReason === r ? "selected" : ""}>${r}</option>`).join("")}</select></label><label>Office notes<textarea data-lead-detail-note="${lead.id}">${escapeHtml(lead.note || "")}</textarea></label><label class="check-row"><input type="checkbox" data-lead-dnc="${lead.id}" ${lead.doNotContact ? "checked" : ""}> Do not contact</label><button class="btn btn-outline" data-archive-lead="${lead.id}">Archive lead</button></aside><div class="lead-detail-scrim" data-close-lead></div>`;
}

function statusSelect(lead) {
  return `<select class="select-pill" data-lead-status="${lead.id}">${leadStatuses.map(status => `<option ${lead.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select>`;
}

function leadStatusCounts(rows) {
  return ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome", "Follow Up Call Needed", "Evaluation Scheduled", "Evaluation Complete", "Became a Client"].map(status => [status, rows.filter(lead => lead.status === status).length]);
}

function leadSummary() {
  const labels = leadStatusCounts(realLeadRows());
  const total = labels.reduce((sum, [, value]) => sum + value, 0);
  return `<div class="donut-panel"><div class="donut"><div class="donut-total"><strong>${total}</strong><span>Total Leads</span></div></div><div class="legend">${labels.map(([name, value], index) => `<div class="legend-row"><span class="dot" style="background:${["#246bfe", "#69b6ff", "#7759d8", "#ff9f1a", "#20a566", "#0b7e49", "#d20f32"][index]}"></span><span>${escapeHtml(name)}</span><strong>${value}</strong></div>`).join("")}</div></div>`;
}

function protectionSummary() {
  return `<div class="protection-list">
    <div><strong>${state.clients.filter(c => c.status === "Do Not Contact").length}</strong><span>Do-not-contact records blocked</span></div>
    <div><strong>${state.clients.filter(c => c.status === "Bad Lead").length}</strong><span>Bad leads excluded by default</span></div>
    <div><strong>${state.clients.filter(c => c.smsConsent === "Unknown" || c.emailConsent === "Unknown").length}</strong><span>Unknown consent requires review</span></div>
  </div>`;
}

function approvedLayoutCards() {
  return `<div class="layout-card-grid approved-template-grid">${approvedLayouts.map((layout, index) => `<article class="layout-card approved-template-card ${trainerById().layout === layout.id ? "selected" : ""}"><div class="approved-template-image"><img src="${layout.preview}" alt="${escapeHtml(layout.name)} approved trainer landing page"><span>Approved Design ${index + 1}</span></div><div class="approved-template-copy"><h3>${escapeHtml(layout.name)}</h3><p>${escapeHtml(layout.tag)}</p><div class="template-points"><span>Trainer identity</span><span>Lead form</span><span>Reviews</span><span>Lorenzo credentials</span><span>Mobile responsive</span><span>Office-controlled</span></div><div class="row-actions"><a class="btn btn-outline" href="${templatePreviewHref(layout.id)}" target="_blank" rel="noopener">Open Full Design</a><button class="btn btn-red" data-assign-layout="${layout.id}">Use This Design</button></div></div></article>`).join("")}</div>`;
}

function trainerPageCards() {
  return `<div class="trainer-card-grid">${state.trainers.map(trainer => {
    const stats = realTrainerStats(trainer);
    return `<article class="network-card"><div class="trainer-page-thumbnail"><img src="${escapeHtml(trainer.image || trainer.photo || layoutImages[0])}" alt="${escapeHtml(trainer.name)} landing page hero"><div><span>${escapeHtml(layoutName(trainer.layout))}</span><strong>${escapeHtml(trainer.name)}</strong><small>${escapeHtml(trainer.market)}</small></div></div><div class="network-card-head"><div><h3>${escapeHtml(trainer.name)}</h3><p>${escapeHtml(trainer.serviceArea)}</p><span class="status ${trainer.accessStatus === "Disabled" ? "lost" : "won"}">${escapeHtml(trainer.accessStatus || "Active")} Portal Access</span></div>${pageStatusBadge(trainer)}</div><div class="readiness-stats"><div><strong>${stats.clicks}</strong><span>Tracked Page Clicks</span></div><div><strong>${stats.forms}</strong><span>Lead Forms</span></div><div><strong>${stats.conversions}</strong><span>Paying Clients</span></div></div><p class="network-note">${trainer.pageStatus === "No Site Started" ? "Trainer enrolled. Office setup has not started." : trainer.locked ? "Published and locked by the office." : "Office draft in progress. Not public yet."}</p><div class="row-actions"><button class="btn btn-outline" data-select-trainer="${trainer.id}" data-view="trainers">Open Setup</button><a class="btn btn-outline" href="${trainerPageHref(trainer)}" target="_blank" rel="noopener">View Live Page</a><button class="btn ${trainer.locked ? "btn-outline" : "btn-red"}" data-toggle-lock="${trainer.id}">${trainer.locked ? "Return To Draft" : "Publish & Lock"}</button><button class="btn btn-outline" data-toggle-access="${trainer.id}">${trainer.accessStatus === "Disabled" ? "Restore Trainer Access" : "Disable Trainer Access"}</button></div></article>`;
  }).join("")}</div>`;
}

function trainerSiteActivityTable() {
  const events = siteEventRows().slice().sort((a, b) => String(b.created_at || b.timestamp).localeCompare(String(a.created_at || a.timestamp))).slice(0, 20);
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Time</th><th>Trainer</th><th>Location</th><th>Activity</th><th>Source</th><th>Campaign</th><th>Page</th></tr></thead><tbody>${events.map(event => `<tr><td>${escapeHtml(new Date(event.timestamp).toLocaleString())}</td><td><strong>${escapeHtml(event.assigned_trainer || trainerName(event.trainer_id))}</strong></td><td>${escapeHtml([event.trainer_city || event.trainer_market, event.trainer_state].filter(Boolean).join(" · ") || "—")}</td><td><span class="status ${event.event_type === "trainer_form_submitted" ? "won" : "new"}">${event.event_type === "trainer_form_submitted" ? "Lead Form" : "Page Visit"}</span></td><td>${escapeHtml(event.utm_source || event.referrer || "Direct")}</td><td>${escapeHtml(event.utm_campaign || "—")}</td><td>${escapeHtml(event.page_path || "—")}</td></tr>`).join("") || `<tr><td colspan="7">Open a trainer landing page to record the first attributed visit.</td></tr>`}</tbody></table></div>`;
}

function trainerAdminForm() {
  const t = trainerById();
  if (t.specialtiesText == null) t.specialtiesText = (t.specialties || []).join("\n");
  if (t.credentialsText == null) t.credentialsText = (t.credentials || []).join("\n");
  profileFieldPairs().forEach(pair => {
    if (t[pair.profile] == null) t[pair.profile] = Array.isArray(t[pair.landing]) ? t[pair.landing].join("\n") : (t[pair.landing] || "");
  });
  const step = Math.min(7, Math.max(1, Number(state.onboardingStep || 1)));
  const steps = [
    [1, "Account & Identity", "Login and basic trainer details"],
    [2, "Choose Approved Theme", "Select the starting page design"],
    [3, "Story & Local SEO", "Bio, market, and search copy"],
    [4, "Photos & Branding", "Trainer, hero, and logo media"],
    [5, "Services & Credentials", "Approved expertise and trust"],
    [6, "Reviews & Social", "Testimonials and social profiles"],
    [7, "Preview & Publish", "Review, publish, and lock the page"]
  ];
  const mediaPreview = (src, fallback, alt) => `<div class="wizard-media-preview"><img src="${escapeHtml(src || fallback)}" alt="${escapeHtml(alt)}"></div>`;
  const textField = (key, label, opts = {}) => `<div class="field ${opts.wide ? "wide" : ""}"><label>${label}${opts.area ? `<textarea name="admin-trainer-${key}" placeholder="${escapeHtml(opts.placeholder || "")}">${escapeHtml(t[key] || "")}</textarea>` : `<input ${opts.type ? `type="${opts.type}"` : ""} name="admin-trainer-${key}" value="${escapeHtml(t[key] || "")}" placeholder="${escapeHtml(opts.placeholder || "")}">`}</label>${opts.help ? `<small class="field-help">${escapeHtml(opts.help)}</small>` : ""}</div>`;
  let content = "";
  if (step === 1) content = `<div class="form-grid">${textField("name", "Trainer Name")}${textField("title", "Professional Title", { placeholder: "Lorenzo's Certified Dog Trainer" })}${textField("email", "Email / Username", { type: "email", help: "This email identifies the trainer's portal account." })}${textField("temporaryPassword", "Temporary Password", { help: "Use the office-issued temporary password for first login. The trainer must replace it immediately." })}${textField("phone", "Public Phone")}${textField("market", "City / Market")}${textField("state", "State / Region")}</div>`;
  if (step === 2) content = `<div class="wizard-template-choice">${approvedLayouts.map(layout => `<label class="wizard-template-option ${t.layout === layout.id ? "selected" : ""}"><input type="radio" name="admin-trainer-layout" value="${layout.id}" ${t.layout === layout.id ? "checked" : ""}><img src="${layout.preview}" alt="${escapeHtml(layout.name)}"><span><strong>${escapeHtml(layout.name)}</strong><small>${escapeHtml(layout.tag)}</small></span></label>`).join("")}</div><div class="brand-lock-note">The office chooses one approved design. Lorenzo's colors, affiliation, office phone number, and required conversion sections stay locked.</div>`;
  if (step === 3) content = `<div class="form-grid">${textField("serviceArea", "Service Area", { wide: true, placeholder: "Cleveland, Garfield Heights, Akron, and surrounding areas" })}${textField("bio", "Office-Approved Trainer Bio", { wide: true, area: true, placeholder: "Tell the trainer's story, approach, and experience." })}${textField("tagline", "Page Tagline", { wide: true })}${textField("heroHeadline", "Hero Headline", { wide: true })}${textField("seoTitle", "SEO Page Title", { wide: true, help: "Use trainer name, dog training service, and city/state." })}${textField("seoDescription", "SEO Description", { wide: true, area: true, help: "Describe obedience training, behavior modification, service area, and Lorenzo affiliation in 150-160 characters." })}</div>`;
  if (step === 4) content = `<div class="wizard-upload-grid"><section><h3>Trainer Photo</h3>${mediaPreview(t.photo, "/assets/trainer-bio-photos/eric-beck.jpg", `${t.name} trainer photo`)}${textField("photo", "Photo URL", { wide: true })}<label class="upload-drop">Upload trainer photo<input type="file" accept="image/*" data-trainer-upload="photo"></label></section><section><h3>Hero / Training Photo</h3>${mediaPreview(t.image, "/assets/trainer-bio-photos/eric-beck.jpg", `${t.name} hero photo`)}${textField("image", "Hero Image URL", { wide: true })}<label class="upload-drop">Upload hero image<input type="file" accept="image/*" data-trainer-upload="image"></label></section><section><h3>Optional Company Logo</h3>${mediaPreview(t.companyLogo, "/assets/lorenzo-logo-transparent.png", "Company logo preview")}${textField("companyLogo", "Logo URL", { wide: true })}<label class="upload-drop">Upload company logo<input type="file" accept="image/*" data-trainer-upload="companyLogo"></label></section></div><section class="hero-library"><div><span class="step-label">Office Media Library</span><h3>Choose a professional hero image</h3><p>Use an approved training, trainer, owner, or team image. The office can replace it later without rebuilding the page.</p></div><div class="hero-option-grid">${heroImageOptions.map(option => `<button type="button" class="hero-option ${t.image === option.src ? "selected" : ""}" data-hero-image="${escapeHtml(option.src)}"><img src="${escapeHtml(option.src)}" alt="${escapeHtml(option.label)}"><span>${escapeHtml(option.label)}</span></button>`).join("")}</div></section><div class="brand-lock-note">Lorenzo's badge, colors, typography, office phone number, and “Powered by Lorenzo's Dog Training Team” affiliation remain locked on every design.</div>`;
  if (step === 5) content = `<div class="form-grid">${textField("specialtiesText", "Services / Specialties", { wide: true, area: true, placeholder: "Obedience Training\nBehavior Modification\nPuppy Training", help: "Enter one approved service per line." })}${textField("credentialsText", "Credentials / Trust Points", { wide: true, area: true, placeholder: "Lorenzo's Certified Dog Trainer\nLDTT training system\nOngoing education", help: "Enter one approved credential per line." })}</div><div class="credential-preview"><img src="../assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><div><strong>Powered by Lorenzo's Dog Training Team</strong><span>Serious Training. Serious Results.</span></div></div>`;
  if (step === 6) content = `<div class="review-editor-grid">${[1,2,3].map(n => `<section><h3>Testimonial ${n}</h3>${textField(`review${n}Author`, "Client Name")}${textField(`review${n}Copy`, "Approved Review", { area: true })}</section>`).join("")}</div><div class="form-grid social-editor">${[["facebook","Facebook"],["instagram","Instagram"],["tiktok","TikTok"]].map(([key,label]) => `<div class="field"><label>${label}<input name="admin-trainer-social-${key}" value="${escapeHtml(t.socials?.[key] || "")}" placeholder="Profile URL"></label><small class="field-help">Leave blank to show an inactive placeholder.</small></div>`).join("")}</div>`;
  if (step === 7) content = `<div class="publish-review"><div><span>Public page</span><strong>${escapeHtml(t.name)} · ${escapeHtml(layoutName(t.layout))}</strong><small>${escapeHtml(t.seoTitle || `${t.name} Dog Training in ${t.market}`)}</small></div><div>${pageStatusBadge(t)}</div></div><div class="row-actions"><a class="btn btn-outline" href="${trainerPageHref(t)}" target="_blank" rel="noopener">Preview Full Page</a><button class="btn btn-red" data-toggle-lock="${t.id}">${t.locked ? "Return To Draft" : "Publish & Lock Page"}</button></div>`;
  return `<div class="trainer-onboarding"><aside class="onboarding-rail"><p class="portal-tag">Office Setup</p><h2>${escapeHtml(t.name)}</h2><p>Imported trainer details are already loaded. Complete, review, and publish the office-controlled page.</p>${steps.map(([number, title, sub]) => `<button class="onboarding-step ${step === number ? "active" : ""} ${step > number ? "complete" : ""}" data-onboarding-step="${number}"><span>${step > number ? "✓" : number}</span><div><strong>${title}</strong><small>${sub}</small></div></button>`).join("")}</aside><section class="onboarding-workspace"><div class="onboarding-heading"><div><span>Step ${step} of 7</span><h2>${steps[step - 1][1]}</h2><p>${steps[step - 1][2]}. Changes save to this office-controlled trainer profile.</p></div><a class="btn btn-outline" href="${trainerPageHref(t)}" target="_blank" rel="noopener">Open Live Preview</a></div>${content}<footer class="onboarding-footer"><button class="btn btn-outline" data-onboarding-step="${Math.max(1, step - 1)}" ${step === 1 ? "disabled" : ""}>Back</button><span>Saved to the shared office database</span>${step < 7 ? `<button class="btn btn-red" data-onboarding-step="${step + 1}">Save & Continue</button>` : `<button class="btn btn-outline" id="saveTrainerProfile">Save Draft</button>`}</footer></section></div>${trainerProfileEditor(t)}`;
}

function pageEditorPreviewDocument(trainer) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><link rel="stylesheet" href="/trainer-backoffice/styles.css"><style>html,body{margin:0;background:#fff}.office-lead-form{pointer-events:none}</style></head><body>${publicSiteMarkup(trainer)}</body></html>`;
}

function trainerPageEditor() {
  const trainer = trainerById();
  if (!trainer) return panel("Page Editor", "", "<p>No trainer profile is available.</p>", "pad");
  const style = trainer.styleSettings || {};
  const field = (label, name, value, options = {}) => `<label class="${options.wide ? "wide" : ""}"><span>${escapeHtml(label)}</span>${options.area
    ? `<textarea data-editor-field="${name}">${escapeHtml(value || "")}</textarea>`
    : `<input ${options.type ? `type="${options.type}"` : ""} data-editor-field="${name}" value="${escapeHtml(value || "")}">`}</label>`;
  const srcdoc = escapeHtml(pageEditorPreviewDocument(trainer));
  return `<section class="page-editor-shell">
    <header class="page-editor-topbar">
      <div><p class="portal-tag">Office-Controlled Builder</p><h2>${escapeHtml(trainer.name)} Trainer Page</h2><p>Click into the controls, change approved content, and see the same renderer used by the live page.</p></div>
      <div class="row-actions"><button class="btn btn-outline" data-editor-save="draft">Save Draft</button><button class="btn btn-red" data-editor-save="publish">Publish & Lock</button></div>
    </header>
    <div class="page-editor-grid">
      <aside class="page-editor-controls">
        <label><span>Trainer</span><select data-editor-trainer>${state.trainers.map(item => `<option value="${item.id}" ${item.id === trainer.id ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.market)}</option>`).join("")}</select></label>
        <label><span>Approved Design</span><select data-editor-field="layout">${approvedLayouts.map(item => `<option value="${item.id}" ${item.id === trainer.layout ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
        ${field("Hero Headline", "heroHeadline", trainer.heroHeadline, { area: true })}
        ${field("Subheadline", "tagline", trainer.tagline, { area: true })}
        ${field("Trainer Bio", "bio", trainer.bio, { area: true })}
        ${field("Trainer Photo URL", "photo", trainer.photo)}
        <label class="editor-upload"><span>Upload Trainer Photo</span><input type="file" accept="image/*" data-editor-upload="photo"></label>
        ${field("Hero Image URL", "image", trainer.image)}
        <label class="editor-upload"><span>Upload Hero Image</span><input type="file" accept="image/*" data-editor-upload="image"></label>
        ${field("Logo URL", "companyLogo", trainer.companyLogo)}
        <label class="editor-upload"><span>Upload Logo</span><input type="file" accept="image/*" data-editor-upload="companyLogo"></label>
        <div class="editor-control-section"><h3>Typography & Color</h3>
          <label><span>Font</span><select data-editor-style="fontFamily">${["Inter","Arial","Georgia","Trebuchet MS"].map(font => `<option ${font === (style.fontFamily || "Inter") ? "selected" : ""}>${font}</option>`).join("")}</select></label>
          <label><span>Type Scale</span><input type="range" min="0.9" max="1.15" step="0.01" data-editor-style="fontScale" value="${Number(style.fontScale || 1)}"></label>
          <label><span>Primary Color</span><input type="color" data-editor-style="brandPrimary" value="${escapeHtml(style.brandPrimary || "#071f44")}"></label>
          <label><span>Accent Color</span><input type="color" data-editor-style="brandAccent" value="${escapeHtml(style.brandAccent || "#d80f35")}"></label>
        </div>
        <div class="editor-control-section"><h3>Approved Reviews</h3>
          ${field("Review 1 Client", "review1Author", trainer.review1Author)}
          ${field("Review 1", "review1Copy", trainer.review1Copy, { area: true })}
          ${field("Review 2 Client", "review2Author", trainer.review2Author)}
          ${field("Review 2", "review2Copy", trainer.review2Copy, { area: true })}
          ${field("Review 3 Client", "review3Author", trainer.review3Author)}
          ${field("Review 3", "review3Copy", trainer.review3Copy, { area: true })}
        </div>
      </aside>
      <main class="page-editor-canvas">
        <div class="page-editor-device-bar"><span>Live Desktop Preview</span><strong>${escapeHtml(trainer.pageStatus)}${trainer.locked ? " · Locked" : ""}</strong></div>
        <iframe id="pageEditorPreview" title="${escapeHtml(trainer.name)} live trainer page preview" srcdoc="${srcdoc}"></iframe>
      </main>
    </div>
  </section>`;
}

function refreshPageEditorPreview() {
  const frame = document.getElementById("pageEditorPreview");
  if (frame) frame.srcdoc = pageEditorPreviewDocument(trainerById());
}

function profileFieldPairs() {
  return [
    { profile: "profileName", landing: "name", label: "Trainer Name" },
    { profile: "profileTitle", landing: "title", label: "Professional Title" },
    { profile: "profileMarket", landing: "market", label: "City / Market" },
    { profile: "profileState", landing: "state", label: "State" },
    { profile: "profileServiceArea", landing: "serviceArea", label: "Service Area", area: true },
    { profile: "profilePhone", landing: "phone", label: "Public Phone" },
    { profile: "profileEmail", landing: "email", label: "Public Email" },
    { profile: "profileBio", landing: "bio", label: "Trainer Bio", area: true },
    { profile: "profilePhoto", landing: "photo", label: "Trainer Photo URL" },
    { profile: "profileSpecialtiesText", landing: "specialties", label: "Specialties", area: true, list: true },
    { profile: "profileCredentialsText", landing: "credentials", label: "Credentials", area: true, list: true }
  ];
}

function fieldValue(trainer, key) {
  const value = trainer[key];
  return Array.isArray(value) ? value.join("\n") : (value || "");
}

function normalizedSyncValue(value) {
  return String(value || "").replace(/\r/g, "").split("\n").map(line => line.trim()).filter(Boolean).join("\n");
}

function syncRow(trainer, pair) {
  const profileValue = fieldValue(trainer, pair.profile);
  const landingValue = fieldValue(trainer, pair.landing);
  const matches = normalizedSyncValue(profileValue) === normalizedSyncValue(landingValue);
  const control = pair.area
    ? `<textarea data-profile-field="${pair.profile}" placeholder="${escapeHtml(pair.label)}">${escapeHtml(profileValue)}</textarea>`
    : `<input data-profile-field="${pair.profile}" value="${escapeHtml(profileValue)}" placeholder="${escapeHtml(pair.label)}">`;
  return `<article class="profile-sync-row ${matches ? "matches" : "mismatch"}">
    <label><span>${escapeHtml(pair.label)}</span>${control}</label>
    <div class="sync-meta"><span class="sync-state ${matches ? "match" : "mismatch"}">${matches ? "Matches landing page" : "Does not match landing page"}</span><button class="btn btn-outline btn-small" type="button" data-sync-profile-field="${pair.profile}" data-landing-field="${pair.landing}" data-sync-list="${pair.list ? "true" : "false"}">Update landing page</button></div>
  </article>`;
}

function trainerProfileEditor(trainer) {
  return `<section class="profile-editor-panel">
    <div class="profile-editor-head"><div><p class="portal-tag">Profile Editor</p><h2>Trainer profile source of truth</h2><p>These fields manage the trainer profile. Use the small sync button under an individual field only when that exact field should update the public landing page.</p></div><a class="btn btn-outline" href="${trainerPageHref(trainer)}" target="_blank" rel="noopener">View Landing Page</a></div>
    <div class="profile-sync-grid">${profileFieldPairs().map(pair => syncRow(trainer, pair)).join("")}</div>
  </section>`;
}

function trainerSelectList() {
  const groups = [...new Set(state.trainers.map(trainer => trainer.state || "Office Added"))];
  return `<div class="trainer-roster-summary"><strong>${state.trainers.length} trainers available</strong><span>Select any frontend trainer to populate the office setup wizard with their real bio, location, and photos.</span></div>${groups.map(stateName => `<section class="trainer-state-group"><h3>${escapeHtml(stateName)}</h3><div class="trainer-select-list">${state.trainers.filter(trainer => (trainer.state || "Office Added") === stateName).map(trainer => `<button class="trainer-select ${state.selectedTrainerId === trainer.id ? "active" : ""}" data-select-trainer="${trainer.id}"><img src="${escapeHtml(trainer.cardPhoto || trainer.photo)}" alt=""><span><strong>${escapeHtml(trainer.name)}</strong><small>${escapeHtml(trainer.market)} · ${trainer.pageStatus}${trainer.locked ? " · Locked" : ""}</small></span></button>`).join("")}</div></section>`).join("")}`;
}

function pageStatusBadge(trainer) {
  const cls = trainer.pageStatus === "Published" ? "live" : trainer.pageStatus === "Draft" ? "draft" : "enrolled";
  const label = trainer.pageStatus === "No Site Started" ? "Trainer Enrolled · No Site Started" : `${trainer.pageStatus}${trainer.locked ? " · Locked" : ""}`;
  return `<span class="status ${cls}">${escapeHtml(label)}</span>`;
}

function layoutName(id) {
  return approvedLayouts.find(layout => layout.id === id)?.name || approvedLayouts[0].name;
}

function lockedPageCard(trainer) {
  return `<div class="locked-card"><div class="site-thumb network-thumb template-thumb" style="background-image:url('${approvedLayouts.find(layout => layout.id === trainer.layout)?.preview || layoutImages[0]}')"><span>Approved Landing Page</span><strong>${escapeHtml(layoutName(trainer.layout))}</strong></div><div><h3>${escapeHtml(layoutName(trainer.layout))}</h3><p class="panel-copy">${escapeHtml(trainer.bio)}</p><p>${pageStatusBadge(trainer)}</p></div></div>`;
}

function lockedPageDetails(trainer) {
  return `<div class="lock-notice">${icon("shield")}<div><strong>Office-controlled and locked</strong><p>Lorenzo's office manages the bio, photos, reviews, layout, publishing, and page lock. Trainers submit content for approval.</p></div></div><ul class="health-list"><li><span class="check">✓</span> Brand-uniform Lorenzo page</li><li><span class="check">✓</span> Three approved template routes only</li><li><span class="check">✓</span> Safer office consultation CTA</li><li><span class="check">✓</span> No trainer publish controls or DNS access</li></ul>`;
}

function trainerAllowedList() {
  return `<div class="permission-grid"><div><h3>Trainer can</h3><ul><li>View locked page</li><li>See assigned leads</li><li>Read office notes and outcomes</li><li>See basic performance numbers</li><li>Submit photos/reviews for approval</li></ul></div><div><h3>Trainer cannot</h3><ul><li>Edit website pages</li><li>Pick random themes</li><li>Publish pages</li><li>Manage DNS/domains</li><li>Control calendar builder</li><li>Mass message imported clients</li></ul></div></div>`;
}

function trainerSubmissions(id = currentTrainerId()) {
  return state.submissions.filter(sub => sub.trainerId === id);
}

function pendingSubmissions() {
  return state.submissions.filter(sub => sub.status === "Pending");
}

function trainerMediaSubmissions(id = currentTrainerId()) {
  return trainerSubmissions(id).filter(sub => ["Photo", "Training Video", "Video"].includes(sub.type));
}

function trainerReviewSubmissions(id = currentTrainerId()) {
  return trainerSubmissions(id).filter(sub => ["Review", "Testimonial"].includes(sub.type));
}

function storedRows(key) {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function applicationRows() {
  if (remoteReady) return state.applications;
  const stored = storedRows("ldttTrainerApplications.v1").map((row, index) => ({
    ...row,
    id: `stored-app-${index}`,
    createdAt: row.timestamp || row.page_url || "",
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    email: row.email || "",
    phone: row.phone || "",
    city: row.city || "",
    state: row.state || "",
    referral_source: row.referral_source || "",
    status: row.status || "New Application",
    note: row.office_note || row.note || row.dog_description || row.additional_training || row.owned_dogs_description || "Submitted from the website trainer application."
  }));
  return [...stored, ...state.applications];
}

function updateApplicationRecord(id, changes) {
  const application = state.applications.find(item => item.id === id);
  if (application) {
    Object.assign(application, changes);
    return application;
  }
  if (!id.startsWith("stored-app-")) return null;
  const index = Number(id.replace("stored-app-", ""));
  const storedApplications = storedRows("ldttTrainerApplications.v1");
  const storedApplication = storedApplications[index];
  if (!storedApplication) return null;
  Object.entries(changes).forEach(([key, value]) => {
    storedApplication[key === "note" ? "office_note" : key] = value;
  });
  localStorage.setItem("ldttTrainerApplications.v1", JSON.stringify(storedApplications));
  return storedApplication;
}

function trainerApplicationGoogleFormPanel() {
  return `<div class="application-intake-panel">
    <div class="source-record-note">
      <span class="status live">Google Sheet + Recruiting Email + Supabase</span>
      <p>The office can work from the shared inbox below. Website applications continue to email recruiting@lorenzosdogtrainingteam.com and log to the connected Google Sheet, while Supabase provides the shared recruiting status and office-note record.</p>
      <div class="action-row"><a class="btn btn-red" href="${TRAINER_APPLICATION_RESPONSE_SHEET}" target="_blank" rel="noopener">Open Google Response Sheet</a><a class="btn btn-outline" href="../trainer-application.html" target="_blank" rel="noopener">Preview Website Application</a></div>
    </div>
  </div>`;
}

function contactSubmissionRows() {
  return storedRows("ldttContactSubmissions.v2").map((row, index) => ({
    id: `contact-${index}`,
    owner: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Website Contact",
    dog: "Pending",
    breed: "Pending",
    source: row.heard_about_us || "Website Contact Form",
    service: row.i_want_to || "Contact Request",
    trainerId: row.trainer_slug || "unassigned",
    phone: row.phone || "",
    email: row.email || "",
    address: [row.address_line_1, row.address_line_2, row.city, row.state, row.zip].filter(Boolean).join(", "),
    status: row.status || "New Inquiry",
    createdAt: (row.timestamp || new Date().toISOString()).slice(0, 10),
    next: "Office follow-up needed",
    note: row.office_note || row.comments || "Stored from the main contact form.",
    followUpDate: row.follow_up_date || "",
    lostReason: row.lost_reason || "",
    doNotContact: Boolean(row.do_not_contact),
    utm_source: row.utm_source || "",
    utm_campaign: row.utm_campaign || "",
    delivery_local: row.delivery_local || "saved",
    delivery_google: row.delivery_google || "not_recorded",
    delivery_email: row.delivery_email || "not_recorded",
    delivery_supabase: row.delivery_supabase || "not_connected",
    visits: 1,
    submitted: true
  }));
}

function updateLeadRecord(id, changes) {
  const seeded = state.leads.find(lead => lead.id === id);
  if (seeded) {
    Object.assign(seeded, changes);
    maybeCreateClientFromLead(seeded, changes);
    return seeded;
  }
  if (!id.startsWith("contact-")) return null;
  const index = Number(id.replace("contact-", ""));
  const rows = storedRows("ldttContactSubmissions.v2");
  if (!rows[index]) return null;
  const mapped = {
    status: "status", note: "office_note", followUpDate: "follow_up_date",
    lostReason: "lost_reason", doNotContact: "do_not_contact"
  };
  Object.entries(changes).forEach(([key, value]) => { rows[index][mapped[key] || key] = value; });
  localStorage.setItem("ldttContactSubmissions.v2", JSON.stringify(rows));
  const updated = contactSubmissionRows().find(lead => lead.id === id);
  maybeCreateClientFromLead(updated, changes);
  return updated;
}

function applicationTable() {
  const rows = applicationRows();
  return `<div class="application-sheet-actions"><span class="status live">Shared application response inbox</span><p>Review the applicant, change recruiting status, and leave office notes. These workflow updates save to Supabase without changing the Google Sheet or recruiting-email delivery.</p></div><div class="table-wrap"><table class="data-table application-data-table"><thead><tr><th>Applicant</th><th>Location</th><th>Contact</th><th>Eligibility</th><th>Experience</th><th>Status</th><th>Office Notes / Action Taken</th><th>Delivery</th><th>Full Application</th></tr></thead><tbody>${rows.map(app => `<tr><td><strong>${escapeHtml(`${app.first_name || ""} ${app.last_name || ""}`.trim() || "Applicant")}</strong><small>${escapeHtml(formatApplicationDate(app.createdAt))}</small></td><td>${escapeHtml([app.city, app.state, app.zip].filter(Boolean).join(", ") || "—")}<small>${escapeHtml(app.address_line_1 || "")}</small></td><td>${escapeHtml(app.phone || "—")}<small>${escapeHtml(app.email || "—")}</small></td><td><small>Work eligible: ${escapeHtml(app.legally_eligible || "—")}</small><small>Drug test: ${escapeHtml(app.drug_test || "—")}</small><small>Travel to Cleveland: ${escapeHtml(app.cleveland_training || "—")}</small></td><td><small>Dog comfort: ${escapeHtml(app.comfortable_dogs || "—")}</small><small>Owns dogs: ${escapeHtml(app.owns_dogs || "—")}</small><small>Referral: ${escapeHtml(app.referral_source || "—")}</small></td><td><select class="select-pill" data-application-status="${escapeHtml(app.id)}">${["New Application","Under Review","Discovery Follow-Up","Interview Scheduled","Moved Forward","Declined","Archived"].map(status => `<option ${status === (app.status || "New Application") ? "selected" : ""}>${status}</option>`).join("")}</select></td><td><textarea class="application-note-input" data-application-note="${escapeHtml(app.id)}" placeholder="Office notes, calls made, interview result, next step...">${escapeHtml(app.note || "")}</textarea></td><td><small>Sheet: ${escapeHtml(app.delivery_google || "attempted")}</small><small>Email: ${escapeHtml(app.delivery_email || "attempted")}</small><small>Supabase: ${escapeHtml(app.delivery_supabase || "confirmed")}</small></td><td><details><summary>Open full record</summary>${applicationDetailGrid(app)}</details></td></tr>`).join("") || `<tr><td colspan="9">No trainer applications found yet.</td></tr>`}</tbody></table></div>`;
}

function applicationDetailGrid(app) {
  const fields = [
    ["Applicant", `${app.first_name || ""} ${app.last_name || ""}`.trim()],
    ["Email", app.email],
    ["Phone", app.phone],
    ["Address", [app.address_line_1, app.address_line_2, app.city, app.state, app.zip].filter(Boolean).join(", ")],
    ["Referral Source", app.referral_source],
    ["Date of Birth", app.birthdate],
    ["Legally Eligible", app.legally_eligible],
    ["Drug Test", app.drug_test],
    ["Felony", app.felony],
    ["Felony Explanation", app.felony_explanation],
    ["Comfortable With Dogs", app.comfortable_dogs],
    ["Dog Bite History", app.dog_bite_history],
    ["Owns Dogs", app.owns_dogs],
    ["Dog Experience", app.owned_dogs_description],
    ["Physical Condition", app.physical_condition],
    ["Works Out", app.workout],
    ["Lift / Control 100 lbs", app.lift_100],
    ["Run / Walk Two Miles", app.run_2_miles],
    ["Smokes", app.smoke],
    ["Team Player", app.team_player],
    ["Reliable Transportation", app.reliable_vehicle],
    ["Driver's License", app.drivers_license],
    ["Cleveland Training", app.cleveland_training],
    ["Education", app.education_level],
    ["Additional Training", app.additional_training],
    ["Employment 1", [app.employment_1_company, app.employment_1_job_title, app.employment_1_status].filter(Boolean).join(" · ")],
    ["Employment 2", [app.employment_2_company, app.employment_2_job_title, app.employment_2_status].filter(Boolean).join(" · ")],
    ["Employment 3", [app.employment_3_company, app.employment_3_job_title, app.employment_3_status].filter(Boolean).join(" · ")],
    ["Signature", app.signature]
  ];
  return `<div class="application-detail-grid">${fields.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div>`;
}

function formatApplicationDate(value) {
  if (!value) return state.remoteReady ? "Not reported" : "Browser fallback record";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value.slice(0, 10));
  return "Submitted from this browser";
}

function submissionForm(kind = "media") {
  const options = kind === "review" ? ["Review", "Testimonial"] : ["Photo", "Training Video"];
  const placeholder = kind === "review" ? "Example: Google review screenshot" : "Example: Loose leash training video";
  const contentField = kind === "review"
    ? `<div class="field wide"><label>Review or Testimonial Text<textarea name="submission-review-text" placeholder="Paste the complete client review or testimonial here."></textarea></label></div><div class="field wide"><label>Optional Review Screenshot<input type="file" name="submission-file" accept="image/*"></label><p class="panel-copy">Add the written review, a screenshot, or both so the office can verify and approve it.</p></div>`
    : `<div class="field wide"><label>Upload Photo or Video<input type="file" name="submission-file" accept="image/*,video/*" required></label><p class="panel-copy">Images and short videos are stored privately for office review before approval.</p></div>`;
  return `<div class="form-grid"><div class="field"><label>Submission Type<select name="submission-type">${options.map(option => `<option>${option}</option>`).join("")}</select></label></div><div class="field"><label>Title<input name="submission-title" placeholder="${placeholder}" required></label></div>${contentField}<div class="field wide"><label>Notes For The Office<textarea name="submission-note" placeholder="Tell the office where this should be used and confirm client permission when applicable."></textarea></label></div></div>`;
}

function submissionsTable(admin, kind = "all") {
  const sourceRows = admin ? state.submissions : trainerSubmissions();
  const rows = kind === "media" ? sourceRows.filter(sub => ["Photo", "Training Video", "Video"].includes(sub.type)) : kind === "review" ? sourceRows.filter(sub => ["Review", "Testimonial"].includes(sub.type)) : sourceRows;
  if (!rows.length) return `<div class="empty-state"><strong>No submissions found.</strong><p>Trainer photos, videos, and reviews will appear here as soon as they are submitted.</p></div>`;
  return `<div class="submission-review-grid">${rows.map(sub => submissionReviewCard(sub, admin)).join("")}</div>`;
}

function submissionReviewCard(sub, admin) {
  const isVideo = ["Training Video", "Video"].includes(sub.type) || String(sub.fileType || "").startsWith("video/");
  let preview = `<div class="submission-placeholder"><span>${icon(sub.type === "Photo" ? "media" : "star")}</span><strong>No file attached</strong></div>`;
  if (sub.contentUrl && isVideo) preview = `<video class="submission-media" controls preload="metadata"><source src="${escapeHtml(sub.contentUrl)}" type="${escapeHtml(sub.fileType || "video/mp4")}">Your browser cannot preview this video.</video>`;
  else if (sub.contentUrl) preview = `<button class="submission-image-button" type="button" data-open-submission-media="${escapeHtml(sub.id)}" aria-label="Open ${escapeHtml(sub.title)}"><img class="submission-media" src="${escapeHtml(sub.contentUrl)}" alt="${escapeHtml(sub.title)}"></button>`;
  const writtenContent = sub.reviewText ? `<blockquote class="submission-review-copy">“${escapeHtml(sub.reviewText)}”</blockquote>` : "";
  return `<article class="submission-review-card">
    <div class="submission-preview">${preview}</div>
    <div class="submission-review-body">
      <div class="submission-review-meta"><span class="submission-type">${escapeHtml(sub.type)}</span><span class="status ${submissionStatusClass(sub.status)}">${escapeHtml(sub.status)}</span></div>
      <h3>${escapeHtml(sub.title)}</h3>
      <p class="submission-trainer">Submitted by <strong>${escapeHtml(trainerName(sub.trainerId))}</strong>${sub.submittedAt ? ` · ${escapeHtml(new Date(sub.submittedAt).toLocaleDateString())}` : ""}</p>
      ${writtenContent}
      <div class="submission-office-note"><span>Trainer note</span><p>${escapeHtml(sub.note || "No note supplied.")}</p></div>
      ${sub.fileName ? `<p class="submission-file-name">File: ${escapeHtml(sub.fileName)}</p>` : ""}
      ${admin ? `<div class="submission-actions"><button class="btn btn-green" data-approve-submission="${escapeHtml(sub.id)}">Approve</button><button class="btn btn-outline" data-decline-submission="${escapeHtml(sub.id)}">Decline</button></div>` : ""}
    </div>
  </article>`;
}

function readSubmissionFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

function openSubmissionMedia(submission) {
  if (!submission?.contentUrl) return;
  const isVideo = ["Training Video", "Video"].includes(submission.type) || String(submission.fileType || "").startsWith("video/");
  const dialog = document.createElement("dialog");
  dialog.className = "submission-media-dialog";
  dialog.innerHTML = `<button type="button" class="submission-dialog-close" aria-label="Close preview">×</button><div class="submission-dialog-content">${isVideo ? `<video controls autoplay src="${escapeHtml(submission.contentUrl)}"></video>` : `<img src="${escapeHtml(submission.contentUrl)}" alt="${escapeHtml(submission.title)}">`}<h3>${escapeHtml(submission.title)}</h3><p>${escapeHtml(trainerName(submission.trainerId))}</p></div>`;
  document.body.appendChild(dialog);
  const close = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector(".submission-dialog-close").addEventListener("click", close);
  dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
  dialog.showModal();
}

function clientFilterBar() {
  return `<div class="filter-bar">${clientStatuses.map(status => `<button class="btn ${state.clientFilter === status ? "btn-red" : "btn-outline"}" data-client-filter="${status}">${status}</button>`).join("")}</div>`;
}

function convertedLeadQueue() {
  const rows = allLeadRows().filter(lead => conversionStatuses().includes(lead.status));
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Paid / Won Lead</th><th>Trainer</th><th>Status</th><th>Contact</th><th>Client Record</th><th>Action</th></tr></thead><tbody>${rows.map(lead => {
    const client = findClientForLead(lead);
    return `<tr><td><strong>${escapeHtml(lead.owner)}</strong><small>${escapeHtml(lead.dog)} · ${escapeHtml(lead.service)}</small></td><td>${escapeHtml(trainerName(lead.trainerId))}</td><td><span class="status won">${escapeHtml(lead.status)}</span></td><td>${escapeHtml(lead.phone || "—")}<small>${escapeHtml(lead.email || "—")}</small></td><td>${client ? `<span class="status live">In Client Database</span><small>${escapeHtml(client.status)}</small>` : `<span class="status draft">Needs client record</span>`}</td><td><button class="btn ${client ? "btn-outline" : "btn-red"}" data-convert-lead="${escapeHtml(lead.id)}">${client ? "Update Client" : "Add To Clients"}</button></td></tr>`;
  }).join("") || `<tr><td colspan="6">No paid or won leads yet. When a lead moves to First Session / Payment or Became a Client, it appears here.</td></tr>`}</tbody></table></div><p class="panel-copy">This queue connects the office lead outcome to the Client Database. Conversion still means a real client/payment event, not a click or form submit.</p>`;
}

function clientTable() {
  const rows = state.clients.filter(c => state.clientFilter === "All" || c.status === state.clientFilter);
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Client</th><th>Dog</th><th>Trainer</th><th>Status</th><th>Consent</th><th>Imported Source</th><th>Campaign Eligibility</th><th>Notes</th></tr></thead><tbody>${rows.map(client => `<tr><td><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.phone)} · ${escapeHtml(client.email)}</small></td><td>${escapeHtml(client.dog)}<small>${escapeHtml(client.breed)}</small></td><td>${escapeHtml(trainerName(client.trainerId))}</td><td><span class="status ${clientStatusClass(client.status)}">${escapeHtml(client.status)}</span></td><td>SMS: ${consentBadge(client.smsConsent)}<br>Email: ${consentBadge(client.emailConsent)}</td><td>${escapeHtml(client.importedSource)}</td><td>${campaignEligibility(client)}</td><td>${escapeHtml(client.notes)}</td></tr>`).join("")}</tbody></table></div>`;
}

function importInput() {
  return `<p class="panel-copy">Paste CSV with headers. Expected fields can include Client Name, Phone, Email, Dog Name, Dog Breed, Trainer Assigned, Status, SMS Consent, Email Consent, Source, Notes.</p><br><textarea class="csv-input" id="csvInput">${escapeHtml(state.importDraft)}</textarea><br><br><label class="field">Imported Source<select id="importSource"><option>Spreadsheet</option><option>Alpha</option><option>QuickBooks</option><option>Manual</option></select></label>`;
}

function importPreview() {
  if (!state.importedPreview.length) {
    return `<div class="empty-state"><strong>No preview yet.</strong><p>Paste data, then click Preview Import. Nothing is imported until admin confirms.</p></div>`;
  }
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Action</th><th>Client</th><th>Dog</th><th>Status</th><th>Consent</th><th>Warnings</th></tr></thead><tbody>${state.importedPreview.map((row, index) => `<tr><td><select class="select-pill" data-import-action="${index}"><option ${row.action === "Create" ? "selected" : ""}>Create</option><option ${row.action === "Update" ? "selected" : ""}>Update</option><option ${row.action === "Skip" ? "selected" : ""}>Skip</option><option ${row.action === "Merge" ? "selected" : ""}>Merge</option></select></td><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.phone)} · ${escapeHtml(row.email)}</small></td><td>${escapeHtml(row.dog)}<small>${escapeHtml(row.breed)}</small></td><td><span class="status ${clientStatusClass(row.status)}">${escapeHtml(row.status)}</span></td><td>SMS: ${consentBadge(row.smsConsent)}<br>Email: ${consentBadge(row.emailConsent)}</td><td>${row.warnings.map(w => `<span class="warning-pill">${escapeHtml(w)}</span>`).join(" ") || "—"}</td></tr>`).join("")}</tbody></table></div><br><button class="btn btn-red" id="confirmImport">Confirm Import</button>`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const get = (...keys) => {
      const found = keys.map(k => headers.indexOf(k)).find(i => i >= 0);
      return found >= 0 ? values[found] || "" : "";
    };
    const name = get("client name", "name");
    const phone = get("phone", "phone number");
    const email = get("email", "email address");
    const status = normalizeClientStatus(get("status"));
    const warnings = [];
    const duplicate = state.clients.find(c => sameContact(c, { phone, email }));
    if (duplicate) warnings.push("Possible duplicate");
    if (status === "Do Not Contact") warnings.push("DNC blocked from campaigns");
    if (status === "Bad Lead") warnings.push("Bad lead excluded by default");
    const smsConsent = normalizeConsent(get("sms consent", "sms"));
    const emailConsent = normalizeConsent(get("email consent", "email permission"));
    if (smsConsent === "Unknown" || emailConsent === "Unknown") warnings.push("Unknown consent needs review");
    return {
      name,
      phone,
      email,
      dog: get("dog name", "dog"),
      breed: get("dog breed", "breed"),
      trainerId: trainerIdFromName(get("trainer assigned", "trainer")),
      status,
      smsConsent,
      emailConsent,
      importedSource: get("source", "imported source") || document.getElementById("importSource")?.value || "Spreadsheet",
      notes: get("notes", "note"),
      warnings,
      action: duplicate ? "Merge" : "Create"
    };
  });
}

function trainerIdFromName(name) {
  if (!name) return currentTrainerId();
  const found = state.trainers.find(t => t.name.toLowerCase() === name.toLowerCase());
  return found?.id || currentTrainerId();
}

function normalizeClientStatus(value) {
  const lower = String(value || "Active").toLowerCase();
  if (lower.includes("do not") || lower.includes("dnc")) return "Do Not Contact";
  if (lower.includes("bad")) return "Bad Lead";
  if (lower.includes("past")) return "Past";
  if (lower.includes("lost")) return "Lost";
  if (lower.includes("won") || lower.includes("client")) return "Won";
  return "Active";
}

function normalizeConsent(value) {
  const lower = String(value || "").toLowerCase();
  if (["yes", "y", "true", "approved", "opt-in", "opt in"].includes(lower)) return "Yes";
  if (["no", "n", "false", "opt-out", "opt out"].includes(lower)) return "No";
  return "Unknown";
}

function sameContact(a, b) {
  const cleanPhone = value => String(value || "").replace(/\D/g, "");
  return (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) || (cleanPhone(a.phone) && cleanPhone(a.phone) === cleanPhone(b.phone));
}

function campaignEligibility(client) {
  if (client.status === "Do Not Contact") return `<span class="status lost">Blocked: DNC</span>`;
  if (client.status === "Bad Lead") return `<span class="status lost">Excluded: Bad lead</span>`;
  if (client.smsConsent !== "Yes" && client.emailConsent !== "Yes") return `<span class="status draft">Review consent</span>`;
  return `<span class="status live">Eligible after admin review</span>`;
}

function consentBadge(value) {
  const cls = value === "Yes" ? "live" : value === "No" ? "lost" : "draft";
  return `<span class="status ${cls}">${escapeHtml(value)}</span>`;
}

function approvedClientRecord(row) {
  return {
    id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: row.name,
    phone: row.phone,
    email: row.email,
    dog: row.dog,
    breed: row.breed,
    trainerId: row.trainerId,
    status: row.status,
    source: row.importedSource,
    importedSource: row.importedSource,
    smsConsent: row.smsConsent,
    emailConsent: row.emailConsent,
    dateStarted: "",
    lastContacted: "",
    notes: row.notes
  };
}

function findClientForLead(lead) {
  if (!lead) return null;
  return state.clients.find(client => sameContact(client, { phone: lead.phone, email: lead.email }));
}

function clientRecordFromLead(lead) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    leadId: lead.remoteId || null,
    name: lead.owner || "Website Client",
    phone: lead.phone || "",
    email: lead.email || "",
    dog: lead.dog && lead.dog !== "Pending" ? lead.dog : "Pending",
    breed: lead.breed && lead.breed !== "Pending" ? lead.breed : "Pending",
    trainerId: lead.trainerId || currentTrainerId(),
    serviceArea: [lead.city, lead.state].filter(Boolean).join(", "),
    zip: lead.zip || "",
    status: "Active",
    source: lead.source || "Lead Conversion",
    importedSource: lead.status === "First Session / Payment" ? "First Payment Conversion" : "Lead Won Conversion",
    smsConsent: lead.doNotContact ? "No" : "Unknown",
    emailConsent: lead.doNotContact ? "No" : "Unknown",
    dateStarted: today,
    lastContacted: today,
    notes: `Created from lead after office marked: ${lead.status}. ${lead.note || ""}`.trim()
  };
}

function upsertClientFromLead(lead) {
  if (!lead) return null;
  const record = clientRecordFromLead(lead);
  const existing = findClientForLead(lead);
  if (existing) {
    Object.assign(existing, {
      ...record,
      id: existing.id,
      notes: `${existing.notes || ""}\nUpdated from lead status: ${lead.status}. ${lead.note || ""}`.trim()
    });
    return existing;
  }
  state.clients.unshift(record);
  return record;
}

function maybeCreateClientFromLead(lead, changes = {}) {
  if (!lead) return null;
  const status = changes.status || lead.status;
  if (!conversionStatuses().includes(status)) return null;
  return upsertClientFromLead({ ...lead, status });
}

function lostReasonsTable() {
  const lost = realLeadRows().filter(l => l.status.startsWith("Lost") || l.status === "Bad Lead" || l.status === "Do Not Contact");
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Lead</th><th>Status</th><th>Trainer</th><th>Office Note</th></tr></thead><tbody>${lost.map(lead => `<tr><td>${escapeHtml(lead.owner)}<small>${escapeHtml(lead.dog)}</small></td><td><span class="status lost">${escapeHtml(lead.status)}</span></td><td>${escapeHtml(trainerName(lead.trainerId))}</td><td>${escapeHtml(lead.note || "—")}</td></tr>`).join("") || `<tr><td colspan="4">No lost leads match the current filters.</td></tr>`}</tbody></table></div>`;
}

function socialIconSvg(label) {
  const paths = {
    Facebook: '<path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11 10.13 11.9v-8.4H7.08v-3.5h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.88v2.27h3.33l-.53 3.5h-2.8v8.4C19.61 23.07 24 18.09 24 12.07Z"/>',
    Instagram: '<path d="M7.2 2h9.6A5.2 5.2 0 0 1 22 7.2v9.6a5.2 5.2 0 0 1-5.2 5.2H7.2A5.2 5.2 0 0 1 2 16.8V7.2A5.2 5.2 0 0 1 7.2 2Zm0 1.8a3.4 3.4 0 0 0-3.4 3.4v9.6a3.4 3.4 0 0 0 3.4 3.4h9.6a3.4 3.4 0 0 0 3.4-3.4V7.2a3.4 3.4 0 0 0-3.4-3.4H7.2Zm10.1 1.35a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 6.85A5.15 5.15 0 1 1 6.85 12 5.15 5.15 0 0 1 12 6.85Zm0 1.8A3.35 3.35 0 1 0 15.35 12 3.35 3.35 0 0 0 12 8.65Z"/>',
    TikTok: '<path d="M15.7 2c.35 2.08 1.5 3.33 3.55 3.78v3.6a8.12 8.12 0 0 1-3.5-1.02v6.73a6.92 6.92 0 1 1-5.98-6.86v3.69a3.31 3.31 0 1 0 2.35 3.17V2h3.58Z"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[label] || ""}</svg>`;
}

function trainerSocialMarkup(trainer) {
  const socials = trainer.socials || {};
  const items = [["Facebook", socials.facebook], ["Instagram", socials.instagram], ["TikTok", socials.tiktok]];
  return `<div class="social-state-row">${items.map(([label, value]) => {
    const active = Boolean(value);
    const body = `<span class="social-chip ${active ? "active" : "inactive"}" title="${active ? `${label} connected` : `${label} not connected yet`}"><span class="social-mark ${label.toLowerCase()}">${socialIconSvg(label)}</span>${label}</span>`;
    return active && /^https?:/.test(value) ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener">${body}</a>` : body;
  }).join("")}</div>`;
}

function trainerReviewsMarkup(trainer) {
  const reviews = [1, 2, 3].map((number, index) => ({
    author: trainer[`review${number}Author`] || ["Jessica R.", "Michael T.", "Sarah L."][index],
    copy: trainer[`review${number}Copy`] || `${trainer.name} was professional, patient, and explained the training process clearly.`
  }));
  return `<div class="trainer-review-grid">${reviews.map(review => `<article class="trainer-review-card"><div class="review-stars">★★★★★</div><p>${escapeHtml(review.copy)}</p><strong>${escapeHtml(review.author)}</strong></article>`).join("")}</div>`;
}

function trainerBioSpotlight(trainer) {
  const specialties = (trainer.specialties || ["Obedience Training", "Behavior Modification", "Puppy Training"]).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const credentials = (trainer.credentials || ["Powered by Lorenzo's proven system"]).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section class="trainer-spotlight" id="trainer"><div class="trainer-spotlight-photo"><img src="${trainer.photo || trainer.image || layoutImages[0]}" alt="${escapeHtml(trainer.name)}"></div><div class="trainer-spotlight-copy"><p class="step-label">Meet your local trainer</p><h2>${escapeHtml(trainer.name)}</h2><p class="trainer-market">${escapeHtml(trainer.market)}</p><p class="panel-copy">${escapeHtml(trainer.bio)}</p><ul class="trainer-bullet-list">${credentials}</ul></div><aside class="trainer-specialties"><h3>Specialties</h3><ul>${specialties}</ul></aside></section>`;
}

function trainerCredibilityBar() {
  return `<section class="credibility-strip"><article><strong>40+</strong><span>Years Of Experience</span></article><article><strong>100,000+</strong><span>Dogs Trained Of All Breeds</span></article><article><strong>50+</strong><span>Professional Trainers Nationwide</span></article><article><strong>100%</strong><span>Commitment To You And Your Dog</span></article></section>`;
}

function officeLeadFormMarkup(trainer, compact = false) {
  return `<form class="landing-form-card office-lead-form ${compact ? "compact" : ""}" id="contact" data-trainer-id="${escapeHtml(trainer.id)}">
    <h3>Book your free consultation</h3>
    <p>Tell Lorenzo's office about your dog. A team member will contact you within 1-3 business days.</p>
    <input type="hidden" name="trainer_name" value="${escapeHtml(trainer.name)}">
    <input type="hidden" name="assigned_trainer" value="${escapeHtml(trainer.name)}">
    <input type="hidden" name="trainer_slug" value="${escapeHtml(trainer.slug || trainer.id)}">
    <input type="hidden" name="trainer_market" value="${escapeHtml(trainer.market)}">
    <input type="hidden" name="trainer_city" value="${escapeHtml(trainerCity(trainer))}">
    <input type="hidden" name="trainer_state" value="${escapeHtml(trainer.state || "")}">
    <input type="hidden" name="heard_about_us" value="Your Trainer">
    <input type="hidden" name="vet_or_previous_client" value="${escapeHtml(trainer.name)}">
    <input type="hidden" name="source_page" value="${escapeHtml(trainer.pageSlug || trainer.slug || trainer.id)}">
    <div class="landing-form-grid">
      <label class="wide trainer-locked-field">Trainer Name<input value="${escapeHtml(trainer.name)}" readonly disabled aria-disabled="true"></label>
      <label>First Name<input required name="first_name" autocomplete="given-name" placeholder="First name"></label>
      <label>Last Name<input required name="last_name" autocomplete="family-name" placeholder="Last name"></label>
      <label>Email Address<input required type="email" name="email" autocomplete="email" placeholder="Email address"></label>
      <label>Phone<input required name="phone" autocomplete="tel" placeholder="Phone number"></label>
      <label class="wide">What can we help you with?
        <select required name="i_want_to">
          <option value="">Select one</option>
          <option>Schedule a free phone consultation to receive more information</option>
          <option>Schedule an in person evaluation with a trainer in my area</option>
          <option>Schedule a virtual evaluation</option>
          <option>Schedule a training session with my dog trainer</option>
          <option>Learn more about becoming a dog trainer</option>
        </select>
      </label>
      <label class="wide">Your dog and goals *<textarea required name="comments" placeholder="Tell us about your dog, behavior concerns, and training goals."></textarea></label>
      <details class="landing-more-fields wide"><summary>Required address and referral details</summary><div class="landing-more-grid"><label>Address Line 1 *<input required name="address_line_1" autocomplete="address-line1" placeholder="Address Line 1"></label><label>Address Line 2 <small>(optional)</small><input name="address_line_2" autocomplete="address-line2" placeholder="Address Line 2"></label><label>City *<input required name="city" autocomplete="address-level2" placeholder="City"></label><label>State *<input required name="state" autocomplete="address-level1" placeholder="State"></label><label>ZIP Code *<input required name="zip" autocomplete="postal-code" placeholder="ZIP Code"></label><label class="wide trainer-locked-field">How did you hear about us?<input value="Your Trainer" readonly disabled aria-disabled="true"></label></div></details>
      <label class="landing-consent wide"><input required type="checkbox" name="sms_consent" value="yes"><span>I agree to receive recurring messages from Lorenzo's Dog Training Team. Reply STOP to opt out.</span></label>
      <div class="landing-form-status wide" role="status" aria-live="polite"></div>
      <button class="btn btn-red wide" type="submit">Book My Free Consultation</button>
    </div>
    <div class="form-privacy">Your information is sent securely to Lorenzo's production office.</div>
  </form>`;
}

function commonFooterFunnel(trainer) {
  return `<section class="landing-bottom-cta"><div><h2>Ready to transform your dog?</h2><p>Start with a professional evaluation and an office-guided training path.</p></div><div class="row-actions"><a class="btn btn-red" href="#contact">Book My Free Consultation</a></div></section>${landingFooter(trainer)}`;
}

function landingHeader(trainer) {
  const logo = trainer.companyLogo || "/assets/lorenzo-logo-white.png";
  return `<header class="landing-nav"><a class="landing-brand" href="#top"><img src="${escapeHtml(logo)}" alt="${escapeHtml(trainer.name)} dog training"><div><strong>${escapeHtml(trainer.name)}</strong><span>Powered by Lorenzo's Dog Training Team</span></div></a><nav><a href="#services">Services</a><a href="#trainer">Trainer</a><a href="#reviews">Results</a><a href="#contact">Contact</a></nav></header>`;
}

function trainerCity(trainer) {
  return String(trainer.market || "").split(",")[0].trim();
}

function trainerLocationLabel(trainer) {
  return [trainer.market, trainer.state].filter(Boolean).join(" · ");
}

function landingFooter(trainer) {
  return `<footer class="trainer-landing-footer"><div class="footer-brand"><img src="/assets/lorenzo-logo-white.png" alt="Lorenzo's Dog Training Team"><p>Serious training for dogs of any age, size, breed, and temperament.</p></div><div><strong>${escapeHtml(trainer.name)}</strong><span>${escapeHtml(trainer.market)}</span><span>${escapeHtml(trainer.serviceArea)}</span></div><div><strong>Training Services</strong><span>Dog Obedience Training</span><span>Behavior Modification</span><span>Specialty Training</span></div><div><strong>Connect</strong>${trainerSocialMarkup(trainer)}<a href="#contact">Request consultation</a></div></footer>`;
}

function serviceCardsMarkup(layoutId) {
  const services = [
    ["Dog Obedience Training", "Heel, sit, stay, come, down, and dependable real-world control.", ["Puppy foundations", "On-leash obedience", "Advanced off-leash training"]],
    ["Behavior Modification", "Structured help for aggression, reactivity, barking, jumping, pulling, and house-soiling.", ["Aggression and reactivity", "Anxiety and fear", "Owner leadership and boundaries"]],
    ["Specialty Training", "Advanced programs for service tasks, protection, scent work, utility, and retrieval.", ["Service and assistance dogs", "Protection training", "Scent, utility, and retrieval"]]
  ];
  return `<div class="landing-service-grid">${services.map(([title, desc, points], index) => `<article class="landing-service-card service-${index + 1}"><span class="service-number">0${index + 1}</span><h3>${title}</h3><p>${desc}</p><ul>${points.map(point => `<li>${point}</li>`).join("")}</ul><a href="#contact">Start with an evaluation</a></article>`).join("")}</div>`;
}

function trainerSectionMarkup(trainer, variant = "split") {
  const facts = (trainer.credentials || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const specialties = (trainer.specialties || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section class="landing-trainer-section ${variant}" id="trainer"><div class="landing-trainer-photo"><img src="${escapeHtml(trainer.photo || trainer.image)}" alt="${escapeHtml(trainer.name)}, dog trainer in ${escapeHtml(trainer.market)}"></div><div class="landing-trainer-copy"><span>Meet your local trainer</span><h2>${escapeHtml(trainer.name)}</h2><h3>${escapeHtml(trainer.title || "Lorenzo's Certified Dog Trainer")}</h3><p>${escapeHtml(trainer.bio)}</p><ul class="landing-facts">${facts}</ul></div><aside class="landing-trainer-side"><h3>${escapeHtml(trainer.name)} specializes in:</h3><ul>${specialties}</ul><div class="powered-badge"><img src="../assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><span>Certified and powered by Lorenzo's Dog Training Team</span></div></aside></section>`;
}

function proofSectionMarkup(trainer, heading = "What our clients say") {
  return `<section class="landing-reviews" id="reviews"><div class="landing-section-heading"><h2>${heading}</h2><p>Real feedback about owner leadership, calmer behavior, and training that holds up in daily life.</p></div>${trainerReviewsMarkup(trainer)}</section>`;
}

function processSectionMarkup() {
  return `<section class="landing-process"><div class="landing-section-heading"><h2>How it works</h2></div><div class="landing-how-it-works"><div><strong>1</strong><span>Request your free consultation</span><small>Tell the office about your dog and goals.</small></div><div><strong>2</strong><span>Complete an evaluation</span><small>We assess the dog, owner, home, and priorities.</small></div><div><strong>3</strong><span>Follow a tailored plan</span><small>Your trainer teaches the dog and owner together.</small></div><div><strong>4</strong><span>Build lasting results</span><small>Practice leadership, rules, and boundaries in real life.</small></div></div></section>`;
}

function publicSiteMarkup(trainer) {
  const params = new URLSearchParams(window.location.search);
  const forcedLayout = document.body.dataset.layout || params.get("layout");
  const layout = approvedLayouts.find(l => l.id === (forcedLayout || trainer.layout)) || approvedLayouts[0];
  const heroImage = escapeHtml(trainerLandingDogs[layout.id] || "/assets/client-photo.jpg");
  const trainerPhoto = escapeHtml(trainer.photo || trainer.image || "../assets/trainer-bio-photos/eric-beck.jpg");
  const styleSettings = trainer.styleSettings || {};
  const styleAttr = `--lp-font:${escapeHtml(styleSettings.fontFamily || "Inter")};--lp-scale:${Number(styleSettings.fontScale || 1)};--lp-primary:${escapeHtml(styleSettings.brandPrimary || "#071f44")};--lp-accent:${escapeHtml(styleSettings.brandAccent || "#d80f35")}`;
  const editedHeadline = String(trainer.heroHeadline || "").trim();
  const customHeading = fallback => editedHeadline && editedHeadline !== layout.headline
    ? escapeHtml(editedHeadline).replace(/\.\s+/g, ".<br>")
    : fallback;
  const formCard = officeLeadFormMarkup(trainer, true);
  const market = escapeHtml(trainer.market);
  const serviceArea = escapeHtml(trainer.serviceArea);
  const trainerHeroCard = `<div class="lp-hero-trainer-card"><img src="${trainerPhoto}" alt="${escapeHtml(trainer.name)}"><div><strong>${escapeHtml(trainer.name)}</strong><span>${escapeHtml(trainerLocationLabel(trainer))}</span></div></div>`;
  const credentials = (trainer.credentials || []).slice(0, 4).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const specialties = (trainer.specialties || []).slice(0, 6).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const brandBadge = `<div class="ldtt-affiliation"><img src="../assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><div><strong>Lorenzo's Certified Dog Trainer</strong><span>Powered by Lorenzo's Dog Training Team</span></div></div>`;
  const stats = `<section class="lp-stats"><article><strong>40+</strong><span>Years of experience</span></article><article><strong>100,000+</strong><span>Dogs trained of all breeds</span></article><article><strong>50+</strong><span>Professional trainers nationwide</span></article><article><strong>100%</strong><span>Commitment to you and your dog</span></article></section>`;
  const services = `<section class="lp-services" id="services"><div class="lp-heading"><span>Training for real life</span><h2>Three solutions. One goal: a better dog.</h2><p>Professional dog training in ${market} for dogs of any age, size, breed, and temperament.</p></div><div class="lp-service-grid"><article><b>01</b><h3>Dog Obedience</h3><p>Build dependable heel, sit, stay, come, down, and real-world control.</p><ul><li>Puppy foundations</li><li>On-leash obedience</li><li>Advanced off-leash training</li></ul></article><article><b>02</b><h3>Behavior Modification</h3><p>Structured help for aggression, reactivity, barking, pulling, jumping, and house-soiling.</p><ul><li>Aggression and reactivity</li><li>Anxiety and fear</li><li>Leadership and boundaries</li></ul></article><article><b>03</b><h3>Specialty Training</h3><p>Purpose-driven programs for service tasks, protection, scent work, utility, and retrieval.</p><ul><li>Service and assistance dogs</li><li>Protection training</li><li>Scent, utility, and retrieval</li></ul></article></div></section>`;
  const reviews = `<section class="lp-reviews" id="reviews"><div class="lp-heading"><span>Real people. Real results.</span><h2>What local clients say</h2></div>${trainerReviewsMarkup(trainer)}</section>`;
  const process = `<section class="lp-process"><div class="lp-heading"><span>A clear path forward</span><h2>How training begins</h2></div><div class="lp-process-grid"><article><b>1</b><h3>Request a consultation</h3><p>Tell Lorenzo's office about your dog, household, and goals.</p></article><article><b>2</b><h3>Complete an evaluation</h3><p>Your trainer assesses temperament, timing, handling, and priorities.</p></article><article><b>3</b><h3>Follow your plan</h3><p>The dog and owner learn together through technique and consistency.</p></article><article><b>4</b><h3>Build lasting results</h3><p>Use leadership, rules, and boundaries in everyday life.</p></article></div></section>`;
  const footer = `<section class="lp-final"><div><span>Start with Lorenzo's office</span><h2>Ready for a better life with your dog?</h2><p>Request your consultation today. The office will contact you within 1-3 business days.</p></div><a class="lp-button" href="#contact">Book My Free Consultation</a></section>${landingFooter(trainer)}`;

  if (layout.id === "mock-6") {
    return `<div class="landing-template landing-template-6 lp-page" id="top" style="${styleAttr}">${landingHeader(trainer)}<section class="lp6-hero" style="--hero-art:url('${heroImage}')"><div class="lp6-copy"><span>${escapeHtml(trainer.name)} · ${escapeHtml(trainerLocationLabel(trainer))}</span><h1>${customHeading("Serious training.<br><em>Serious results.</em>")}</h1><p>${escapeHtml(trainer.tagline || `Professional dog training for families in ${trainerLocationLabel(trainer)}. Lorenzo's proven system builds obedience, modifies behavior, and creates dependable control in real life.`)}</p><ul class="lp6-proof-points"><li>Proven methods</li><li>Trusted results</li><li>Lifetime impact</li></ul></div>${trainerHeroCard}<div class="lp6-form">${formCard}</div></section>${stats}${services}<section class="lp6-trainer" id="trainer"><div class="lp6-trainer-image"><img src="${trainerPhoto}" alt="${escapeHtml(trainer.name)} with a trained dog"></div><div class="lp6-trainer-copy"><span>Meet your local trainer</span><h2>${escapeHtml(trainer.name)}</h2><h3>${escapeHtml(trainer.title)}</h3><p>${escapeHtml(trainer.bio)}</p>${brandBadge}</div><aside><h3>${escapeHtml(trainer.name)}'s specialties</h3><ul>${specialties}</ul><h3>Credentials</h3><ul>${credentials}</ul></aside></section>${reviews}<section class="lp6-cta"><div><span>Professional training in ${market}</span><h2>Ready to transform your dog?</h2><ul><li>Professional evaluation</li><li>Tailored training recommendations</li><li>Office-guided next steps</li></ul></div>${officeLeadFormMarkup(trainer, true)}</section>${footer}</div>`;
  }

  if (layout.id === "mock-3") {
    return `<div class="landing-template landing-template-3 lp-page" id="top" style="${styleAttr}">${landingHeader(trainer)}<section class="lp3-hero" style="--hero-art:url('${heroImage}')"><div class="lp3-copy"><span>★★★★★ &nbsp; ${escapeHtml(trainer.name)} · ${escapeHtml(trainerLocationLabel(trainer))}</span><h1>${customHeading("Serious training.<br>Serious <em>results.</em>")}</h1><p>${escapeHtml(trainer.tagline || `Trusted dog obedience training and behavior modification for families in ${trainerLocationLabel(trainer)} and throughout ${trainer.serviceArea}.`)}</p><ul><li>Proven methods that work</li><li>Balanced training for real-life results</li><li>Backed by Lorenzo's nationwide team</li></ul></div>${trainerHeroCard}<div class="lp3-form">${formCard}</div></section>${stats}${services}<section class="lp3-trainer" id="trainer"><div class="lp3-photo"><img src="${trainerPhoto}" alt="${escapeHtml(trainer.name)}, certified Lorenzo trainer"></div><div class="lp3-bio"><span>Meet your trainer</span><h2>${escapeHtml(trainer.name)}</h2><h3>${escapeHtml(trainerLocationLabel(trainer))}</h3><h3>${escapeHtml(trainer.title)}</h3><p>${escapeHtml(trainer.bio)}</p><div class="lp3-trust"><ul>${credentials}</ul><ul>${specialties}</ul></div>${brandBadge}</div></section>${reviews}${process}<section class="lp3-contact"><div><span>Let's build a better future</span><h2>For you and your dog.</h2><p>Serving ${serviceArea} with professional, office-supported dog training.</p></div>${officeLeadFormMarkup(trainer, true)}<aside><strong>Office follow-up</strong><span>Submit the form and Lorenzo's team will respond within 1-3 business days.</span></aside></section>${landingFooter(trainer)}</div>`;
  }

  return `<div class="landing-template landing-template-5 lp-page" id="top" style="${styleAttr}">${landingHeader(trainer)}<section class="lp5-hero" style="--hero-art:url('${heroImage}')"><div class="lp5-copy"><span>${escapeHtml(trainer.name)} · ${escapeHtml(trainerLocationLabel(trainer))}</span><h1>${customHeading("The right trainer.<br><em>The right results.</em>")}</h1><h2>Obedience. Behavior solutions. Real results.</h2><p>${escapeHtml(trainer.tagline || `Personalized dog training in ${trainerLocationLabel(trainer)}, backed by Lorenzo's proven system and an office team that manages every lead and next step.`)}</p><div class="lp5-proof"><span>Proven methods that work</span><span>Personalized training plans</span><span>Results you can see and feel</span></div></div>${trainerHeroCard}<div class="lp5-form">${formCard}</div></section><section class="lp5-trust"><div class="lp-heading"><span>Why choose Lorenzo's?</span><h2>Experience, accountability, and a proven system.</h2></div>${stats}</section><section class="lp5-trainer" id="trainer"><div class="lp5-bio"><span>Meet your local trainer</span><h2>${escapeHtml(trainer.name)}</h2><h3>${escapeHtml(trainerLocationLabel(trainer))}</h3><h3>${escapeHtml(trainer.title)}</h3><p>${escapeHtml(trainer.bio)}</p><ul>${credentials}</ul>${brandBadge}</div><div class="lp5-photo"><img src="${trainerPhoto}" alt="${escapeHtml(trainer.name)} with a trained dog"></div><aside><h3>${escapeHtml(trainer.name)} specializes in</h3><ul>${specialties}</ul></aside></section>${services}${reviews}${process}<section class="lp5-final"><div><span>Ready to transform your dog?</span><h2>Start with a professional consultation.</h2><p>Office-guided scheduling. Local trainer expertise. Lorenzo-backed results.</p></div><a class="lp-button" href="#contact">Book My Free Consultation</a></section>${landingFooter(trainer)}</div>`;
}

function renderPublicSite() {
  const params = new URLSearchParams(window.location.search);
  const trainer = trainerById(document.body.dataset.trainer || params.get("trainer") || state.selectedTrainerId);
  document.title = trainer.seoTitle || `${trainer.name} Dog Training in ${trainer.market} | Lorenzo's Dog Training Team`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = trainer.seoDescription || `Professional dog obedience training and behavior modification with ${trainer.name} in ${trainer.market}, backed by Lorenzo's Dog Training Team.`;
  document.getElementById("publicSite").innerHTML = publicSiteMarkup(trainer);
  recordTrainerPageView(trainer);
}

function getVisitorId() {
  let visitorId = localStorage.getItem("ldttAnonymousVisitorId");
  if (!visitorId) {
    visitorId = globalThis.crypto?.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem("ldttAnonymousVisitorId", visitorId);
  }
  return visitorId;
}

function trainerAttribution(trainer, eventType) {
  const params = new URLSearchParams(window.location.search);
  return {
    event_type: eventType,
    trainer_slug: trainer.slug || trainer.id,
    assigned_trainer: trainer.name,
    trainer_market: trainer.market,
    trainer_city: trainerCity(trainer),
    trainer_state: trainer.state || "",
    visitor_id: getVisitorId(),
    session_id: sessionStorage.getItem("ldttLandingSession") || getVisitorId(),
    page_path: window.location.pathname,
    page_url: window.location.href,
    referrer: document.referrer,
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    user_agent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };
}

function recordTrainerPageView(trainer) {
  const sessionKey = `ldtt-viewed-${trainer.id}-${window.location.pathname}`;
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, "1");
  if (!sessionStorage.getItem("ldttLandingSession")) sessionStorage.setItem("ldttLandingSession", globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`);
  const event = trainerAttribution(trainer, "trainer_page_view");
  const events = storedRows(SITE_EVENT_KEY);
  events.push(event);
  localStorage.setItem(SITE_EVENT_KEY, JSON.stringify(events));
  trainer.clicks = Number(trainer.clicks || 0) + 1;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  submitToSupabase("track-site-event", event).catch(error => console.warn("LDTT trainer page tracking failed", error));
}

function statusClass(status) {
  if (conversionStatuses().includes(status)) return "won";
  if (status.startsWith("Lost") || status === "Bad Lead" || status === "Do Not Contact") return "lost";
  if (status === "Engaged Lead: No Outcome") return "offered";
  if (status.includes("Follow")) return "follow";
  if (status.includes("Evaluation")) return "booked";
  if (status === "New Inquiry") return "new";
  return "connected";
}

function clientStatusClass(status) {
  if (["Active", "Won"].includes(status)) return "won";
  if (["Bad Lead", "Do Not Contact", "Lost"].includes(status)) return "lost";
  if (status === "Past") return "connected";
  return "draft";
}

function submissionStatusClass(status) {
  if (status === "Approved") return "won";
  if (status === "Declined") return "lost";
  return "draft";
}

function initials(name) {
  return String(name).split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formEntries(form) {
  const data = new FormData(form);
  const result = {};
  data.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function submitToSupabase(functionName, entries) {
  const config = window.LDTT_SUPABASE;
  if (!config?.enabled || !config.functionsBaseUrl) return { skipped: true };
  const response = await fetch(`${config.functionsBaseUrl.replace(/\/$/, "")}/${functionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${functionName} failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function submitLandingEmail(entries, trainer) {
  const payload = new FormData();
  Object.entries(entries).forEach(([key, value]) => payload.append(key, value));
  payload.append("_subject", `Trainer landing page lead: ${trainer.name} · ${trainer.market} · ${trainer.state || ""}`.replace(/ · $/, ""));
  payload.append("_template", "table");
  payload.append("_captcha", "false");
  const response = await fetch("https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: payload
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false || result.success === "false") throw new Error(result.message || "Office email relay failed");
  return result;
}

async function submitLandingGoogleSheet(entries, trainer) {
  const endpoint = "https://docs.google.com/forms/d/e/1FAIpQLSdV1-0yBlRusq9tkjymZKm_BfXfpmMKDDrcyqfP3KbEq-Qd_g/formResponse";
  const payload = new FormData();
  const mapping = {
    trainer_name: "entry.732274329",
    first_name: "entry.2076204969",
    last_name: "entry.1657690671",
    address_line_1: "entry.1231537394",
    address_line_2: "entry.1987365575",
    city: "entry.375426998",
    state: "entry.114802361",
    zip: "entry.416673611",
    email: "entry.1949246301",
    phone: "entry.503719735",
    i_want_to: "entry.270700046",
    heard_about_us: "entry.1942005538",
    vet_or_previous_client: "entry.1616503040",
    comments: "entry.1517896175"
  };
  const sheetEntries = {
    ...entries,
    trainer_name: entries.trainer_name || entries.assigned_trainer || trainer.name,
    comments: entries.comments || ""
  };
  Object.entries(mapping).forEach(([field, entry]) => {
    if (sheetEntries[field]) payload.append(entry, sheetEntries[field]);
  });
  payload.append("fvv", "1");
  payload.append("pageHistory", "0");
  return fetch(endpoint, { method: "POST", mode: "no-cors", body: payload });
}

document.addEventListener("click", async event => {
  const leadView = event.target.closest("[data-lead-view]");
  if (leadView) { state.leadViewMode = leadView.dataset.leadView; saveState(); return; }
  const openLead = event.target.closest("[data-open-lead]");
  if (openLead && !event.target.closest("select,input,textarea,button")) { state.selectedLeadId = openLead.dataset.openLead; saveState(); return; }
  if (event.target.closest("[data-close-lead]")) { state.selectedLeadId = ""; saveState(); return; }
  const archiveLead = event.target.closest("[data-archive-lead]");
  if (archiveLead) {
    const lead = updateLeadRecord(archiveLead.dataset.archiveLead, { status: "Archived" });
    state.selectedLeadId = "";
    if (remoteReady) runRemoteMutation("Lead archived; record preserved", () => persistLeadRecord(lead));
    else saveState("Lead archived; record preserved");
    return;
  }
  const saveLead = event.target.closest("[data-save-lead]");
  if (saveLead) {
    const lead = allLeadRows().find(item => item.id === saveLead.dataset.saveLead);
    if (remoteReady) runRemoteMutation("Lead status and office notes saved", () => persistLeadWorkflow(lead));
    else saveState("Lead status and office notes saved");
    return;
  }
  const trainerSelect = event.target.closest("[data-select-trainer]");
  if (trainerSelect) {
    state.selectedTrainerId = trainerSelect.dataset.selectTrainer;
    state.onboardingStep = 1;
    if (!trainerSelect.dataset.view) {
      saveState("Trainer profile loaded into office setup");
      return;
    }
  }
  const view = event.target.closest("[data-view]");
  if (view) {
    if (session.role === "trainer" && portalUser?.must_change_password && view.dataset.view !== "settings") {
      state.activeView = "settings";
      saveState("Create your permanent password before using the trainer portal");
      return;
    }
    state.activeView = view.dataset.view;
    if (remoteReady) {
      try {
        await reloadRemoteData();
      } catch (error) {
        console.error("LDTT shared portal refresh failed", error);
        showToast("Showing the most recently loaded data. Refresh to try again.");
      }
    }
    saveState();
    return;
  }
  const previewTrainer = event.target.closest("[data-preview-trainer]");
  if (previewTrainer) {
    window.open(trainerPageHref(previewTrainer.dataset.previewTrainer), "_blank", "noopener");
    return;
  }
  const toggleLock = event.target.closest("[data-toggle-lock]");
  if (toggleLock) {
    const trainer = trainerById(toggleLock.dataset.toggleLock);
    const publish = !trainer.locked;
    trainer.locked = publish;
    trainer.pageStatus = publish ? "Published" : "Draft";
    if (remoteReady) {
      runRemoteMutation(
        publish ? "Trainer page published and locked" : "Trainer page returned to office draft",
        () => persistTrainerRecord(trainer, { publish })
      );
    } else {
      saveState(publish ? "Trainer page published and locked" : "Trainer page returned to office draft");
    }
    return;
  }
  const toggleAccess = event.target.closest("[data-toggle-access]");
  if (toggleAccess) {
    const trainer = trainerById(toggleAccess.dataset.toggleAccess);
    trainer.accessStatus = trainer.accessStatus === "Disabled" ? "Active" : "Disabled";
    if (remoteReady) {
      runRemoteMutation(
        trainer.accessStatus === "Disabled" ? "Trainer portal access disabled; records preserved" : "Trainer portal access restored",
        () => persistTrainerAccess(trainer),
        { reload: false }
      );
    } else {
      saveState(trainer.accessStatus === "Disabled" ? "Trainer portal access disabled; records preserved" : "Trainer portal access restored");
    }
    return;
  }
  const assignLayout = event.target.closest("[data-assign-layout]");
  if (assignLayout) {
    const trainer = trainerById();
    trainer.layout = assignLayout.dataset.assignLayout;
    trainer.pageStatus = "Draft";
    trainer.locked = false;
    if (remoteReady) runRemoteMutation("Approved layout assigned and draft saved", () => persistTrainerRecord(trainer));
    else saveState("Approved layout assigned by office");
    return;
  }
  const heroImage = event.target.closest("[data-hero-image]");
  if (heroImage) {
    const trainer = trainerById();
    trainer.image = heroImage.dataset.heroImage;
    if (remoteReady) runRemoteMutation("Approved hero image selected", () => persistTrainerRecord(trainer));
    else saveState("Approved hero image selected");
    return;
  }
  const syncProfileField = event.target.closest("[data-sync-profile-field]");
  if (syncProfileField) {
    const trainer = trainerById();
    const profileKey = syncProfileField.dataset.syncProfileField;
    const landingKey = syncProfileField.dataset.landingField;
    const value = fieldValue(trainer, profileKey);
    trainer[landingKey] = syncProfileField.dataset.syncList === "true"
      ? value.split(/\n|,/).map(item => item.trim()).filter(Boolean)
      : value;
    if (landingKey === "email") trainer.username = value;
    trainer.pageStatus = trainer.pageStatus === "No Site Started" ? "Draft" : trainer.pageStatus;
    if (remoteReady) runRemoteMutation(`${landingKey.replace(/([A-Z])/g, " $1")} synced to landing page`, () => persistTrainerRecord(trainer));
    else saveState(`${landingKey.replace(/([A-Z])/g, " $1")} synced to landing page`);
    return;
  }
  const onboardingStep = event.target.closest("[data-onboarding-step]");
  if (onboardingStep && !onboardingStep.disabled) {
    state.onboardingStep = Number(onboardingStep.dataset.onboardingStep);
    if (remoteReady && session.role === "admin") {
      runRemoteMutation("Trainer setup progress and draft saved", () => persistTrainerRecord(trainerById()));
    } else {
      saveState("Trainer setup progress saved");
    }
    return;
  }
  const clientFilter = event.target.closest("[data-client-filter]");
  if (clientFilter) {
    state.clientFilter = clientFilter.dataset.clientFilter;
    saveState();
    return;
  }
  const convertLead = event.target.closest("[data-convert-lead]");
  if (convertLead) {
    const lead = allLeadRows().find(item => item.id === convertLead.dataset.convertLead);
    const client = upsertClientFromLead(lead);
    state.clientFilter = "Active";
    if (remoteReady) runRemoteMutation("Client record created or updated from paid/won lead", () => persistClientRecord(client));
    else saveState("Client record created or updated from paid/won lead");
    return;
  }
  const leadRange = event.target.closest("[data-lead-range]");
  if (leadRange) {
    state.leadDateRange = leadRange.dataset.leadRange;
    saveState(`Showing leads for ${leadRangeLabel()}`);
    return;
  }
  const approve = event.target.closest("[data-approve-submission]");
  if (approve) {
    const sub = state.submissions.find(s => s.id === approve.dataset.approveSubmission);
    if (sub) sub.status = "Approved";
    if (remoteReady) runRemoteMutation("Submission approved", () => persistSubmissionRecord(sub));
    else saveState("Submission approved");
    return;
  }
  const openSubmission = event.target.closest("[data-open-submission-media]");
  if (openSubmission) {
    openSubmissionMedia(state.submissions.find(item => item.id === openSubmission.dataset.openSubmissionMedia));
    return;
  }
  const decline = event.target.closest("[data-decline-submission]");
  if (decline) {
    const sub = state.submissions.find(s => s.id === decline.dataset.declineSubmission);
    if (sub) sub.status = "Declined";
    if (remoteReady) runRemoteMutation("Submission declined", () => persistSubmissionRecord(sub));
    else saveState("Submission declined");
    return;
  }
  if (event.target.id === "submitDemoContent") {
    const type = document.querySelector('[name="submission-type"]')?.value || "Photo";
    const title = document.querySelector('[name="submission-title"]')?.value.trim();
    const note = document.querySelector('[name="submission-note"]')?.value || "Submitted by trainer for office approval.";
    const reviewText = document.querySelector('[name="submission-review-text"]')?.value.trim() || "";
    const file = document.querySelector('[name="submission-file"]')?.files?.[0];
    if (!title) {
      showToast("Add a title before submitting");
      return;
    }
    if (!["Review", "Testimonial"].includes(type) && !file) {
      showToast("Choose a photo or video to submit");
      return;
    }
    if (["Review", "Testimonial"].includes(type) && !reviewText && !file) {
      showToast("Add the review text or a review screenshot");
      return;
    }
    if (file && file.size > 2 * 1024 * 1024) {
      showToast("Please choose a file smaller than 2 MB");
      return;
    }
    const finalizeSubmission = async contentUrl => {
      const submission = { id: `sub-${Date.now()}`, trainerId: currentTrainerId(), type, title, note, reviewText, contentUrl: contentUrl || "", fileName: file?.name || "", fileType: file?.type || "", submittedAt: new Date().toISOString(), status: "Pending" };
      state.submissions.unshift(submission);
      if (remoteReady) {
        const trainer = trainerById(currentTrainerId());
        let storedPath = "";
        if (file) {
          storedPath = `${trainer.remoteId}/${Date.now()}-${slugify(file.name)}`;
          await window.LDTT_PORTAL.upload("trainer-submissions", storedPath, file);
        }
        await runRemoteMutation("Content submitted for admin review", async () => {
          await window.LDTT_PORTAL.insert("content_submissions", {
            trainer_id: trainer.remoteId,
            submission_type: type === "Training Video" ? "video" : type.toLowerCase(),
            title,
            file_url: storedPath || null,
            notes: reviewText || note || null,
            status: "pending"
          });
        });
      } else {
        saveState("Content submitted for admin review");
      }
    };
    if (file) {
      readSubmissionFile(file).then(finalizeSubmission).catch(() => showToast("The selected file could not be read"));
    } else {
      finalizeSubmission("");
    }
    return;
  }
  if (event.target.id === "previewImport") {
    state.importDraft = document.getElementById("csvInput")?.value || state.importDraft;
    state.importedPreview = parseCsv(state.importDraft);
    saveState("Import preview ready");
    return;
  }
  if (event.target.id === "loadSampleCsv") {
    saveState("Sample CSV loaded");
    return;
  }
  if (event.target.id === "confirmImport") {
    const rowsToImport = state.importedPreview.filter(row => row.action !== "Skip");
    const importedClients = [];
    rowsToImport.forEach(row => {
      const duplicate = state.clients.find(c => sameContact(c, row));
      if (duplicate && ["Update", "Merge"].includes(row.action)) {
        Object.assign(duplicate, approvedClientRecord(row), { id: duplicate.id });
        importedClients.push(duplicate);
      }
      if (!duplicate && row.action === "Create") {
        const created = approvedClientRecord(row);
        state.clients.unshift(created);
        importedClients.push(created);
      }
    });
    state.importedPreview = [];
    state.clientFilter = "Active";
    if (remoteReady) {
      runRemoteMutation(`${importedClients.length} client records imported`, async () => {
        for (const client of importedClients) await persistClientRecord(client);
      });
    } else {
      saveState("Clients imported into the office client database");
    }
    return;
  }
  if (event.target.id === "addTrainer") {
    const id = `trainer-${Date.now()}`;
    state.trainers.unshift({ id, name: "New Trainer", title: "Lorenzo's Certified Dog Trainer", username: "trainer@lorenzosdogtrainingteam.com", temporaryPassword: TEMP_PASSWORD, accessStatus: "Active", market: "Market Pending", state: "State Pending", serviceArea: "Service area pending", phone: "(866) 436-4959", email: "trainer@lorenzosdogtrainingteam.com", tagline: "Obedience. Behavior solutions. Real results.", heroHeadline: "Professional dog training for real-life results.", bio: "Office needs to approve this trainer bio.", seoTitle: "Local Dog Trainer | Lorenzo's Dog Training Team", seoDescription: "Professional dog obedience training and behavior modification backed by Lorenzo's Dog Training Team.", layout: "mock-5", pageStatus: "No Site Started", locked: false, clicks: 0, forms: 0, conversions: 0, image: "../assets/trainer-bio-photos/eric-beck.jpg", photo: "../assets/trainer-headshots/Eric Beck TC 2 360_x_360.jpg", companyLogo: "", specialties: ["Obedience Training", "Behavior Modification"], credentials: ["Lorenzo's Certified Dog Trainer", "Powered by Lorenzo's Dog Training Team"], review1Author: "Client Name", review1Copy: "Office-approved client testimonial.", review2Author: "Client Name", review2Copy: "Office-approved client testimonial.", review3Author: "Client Name", review3Copy: "Office-approved client testimonial.", socials: { facebook: "", instagram: "", tiktok: "" } });
    state.selectedTrainerId = id;
    state.activeView = "trainers";
    state.onboardingStep = 1;
    saveState("Trainer created as office draft");
    return;
  }
  if (event.target.id === "saveTrainerProfile") {
    if (remoteReady) runRemoteMutation("Trainer profile and page draft saved by office", () => persistTrainerRecord(trainerById()));
    else saveState("Trainer profile saved by office");
    return;
  }
  const editorSave = event.target.closest("[data-editor-save]");
  if (editorSave) {
    const publish = editorSave.dataset.editorSave === "publish";
    const trainer = trainerById();
    trainer.pageStatus = publish ? "Published" : "Draft";
    trainer.locked = publish;
    runRemoteMutation(publish ? "Trainer page published and locked" : "Trainer page draft saved", () => persistTrainerRecord(trainer, { publish }));
    return;
  }
  if (event.target.id === "resetDemo") {
    localStorage.removeItem(STORE_KEY);
    state = loadState();
    saveState("Demo data reset");
    return;
  }
  if (event.target.id === "logoutBtn") {
    if (window.LDTT_PORTAL?.enabled) await window.LDTT_PORTAL.signOut();
    portalUser = null;
    remoteReady = false;
    session = { loggedIn: false, role: "" };
    sessionStorage.removeItem(SESSION_KEY);
    render();
  }
});

document.addEventListener("input", event => {
  const field = event.target;
  if (field.dataset.editorField) {
    const trainer = trainerById();
    trainer[field.dataset.editorField] = field.value;
    trainer.pageStatus = "Draft";
    trainer.locked = false;
    refreshPageEditorPreview();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return;
  }
  if (field.dataset.editorStyle) {
    const trainer = trainerById();
    trainer.styleSettings = {
      ...(trainer.styleSettings || {}),
      [field.dataset.editorStyle]: field.dataset.editorStyle === "fontScale" ? Number(field.value) : field.value
    };
    trainer.pageStatus = "Draft";
    trainer.locked = false;
    refreshPageEditorPreview();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return;
  }
  if (field.name?.startsWith("admin-trainer-social-")) {
    const trainer = trainerById();
    const key = field.name.replace("admin-trainer-social-", "");
    trainer.socials = { ...(trainer.socials || {}), [key]: field.value };
    saveState(null, true);
  }
  if (field.name?.startsWith("admin-trainer-")) {
    const trainer = trainerById();
    const key = field.name.replace("admin-trainer-", "");
    trainer[key] = key === "locked" ? field.value === "true" : field.value;
    if (key === "email") trainer.username = field.value;
    if (key === "specialtiesText") trainer.specialties = field.value.split(/\n|,/).map(value => value.trim()).filter(Boolean);
    if (key === "credentialsText") trainer.credentials = field.value.split(/\n|,/).map(value => value.trim()).filter(Boolean);
    saveState(null, true);
  }
  if (field.dataset.profileField) {
    trainerById()[field.dataset.profileField] = field.value;
    saveState(null, true);
  }
  if (field.dataset.leadNote) {
    const lead = updateLeadRecord(field.dataset.leadNote, { note: field.value });
    scheduleRemoteSave(`lead-${lead?.id}`, () => persistLeadRecord(lead));
    saveState(null, true);
  }
  if (field.dataset.leadDetailNote) {
    const lead = updateLeadRecord(field.dataset.leadDetailNote, { note: field.value });
    scheduleRemoteSave(`lead-${lead?.id}`, () => persistLeadRecord(lead));
    saveState(null, true);
  }
  if (field.dataset.applicationNote) {
    const application = updateApplicationRecord(field.dataset.applicationNote, { note: field.value });
    scheduleRemoteSave(`application-${application?.id}`, () => persistApplicationRecord(application));
    saveState(null, true);
  }
  if (field.dataset.leadSearch !== undefined) { state.leadSearch = field.value; saveState(null, true); }
  if (field.id === "csvInput") {
    state.importDraft = field.value;
    saveState(null, true);
  }
  if (field.name === "lead-custom-start") {
    state.customLeadStart = field.value;
    state.leadDateRange = "custom";
    saveState(null, true);
  }
  if (field.name === "lead-custom-end") {
    state.customLeadEnd = field.value;
    state.leadDateRange = "custom";
    saveState(null, true);
  }
});

document.addEventListener("change", async event => {
  if (event.target.dataset.editorTrainer !== undefined) {
    state.selectedTrainerId = event.target.value;
    saveState();
    return;
  }
  if (event.target.dataset.editorField || event.target.dataset.editorStyle) {
    refreshPageEditorPreview();
    return;
  }
  const editorUpload = event.target.closest("[data-editor-upload]");
  if (editorUpload?.files?.[0]) {
    const file = editorUpload.files[0];
    if (file.size > 10 * 1024 * 1024) {
      showToast("Choose an image smaller than 10 MB");
      editorUpload.value = "";
      return;
    }
    const trainer = trainerById();
    try {
      const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
      const path = `${trainer.remoteId || slugify(trainer.name)}/${editorUpload.dataset.editorUpload}-${Date.now()}.${extension}`;
      await window.LDTT_PORTAL.upload("trainer-page-assets", path, file);
      trainer[editorUpload.dataset.editorUpload] = window.LDTT_PORTAL.publicStorageUrl("trainer-page-assets", path);
      trainer.pageStatus = "Draft";
      trainer.locked = false;
      refreshPageEditorPreview();
      showToast("Image uploaded. Save the draft when ready.");
    } catch (error) {
      showToast(`Image upload failed: ${error.message}`);
    }
    return;
  }
  if (event.target.dataset.leadSearch !== undefined) { state.leadSearch = event.target.value; saveState(); return; }
  const upload = event.target.closest("[data-trainer-upload]");
  if (upload && upload.files?.[0]) {
    const file = upload.files[0];
    if (file.size > 10_000_000) {
      showToast("Choose an image under 10 MB");
      upload.value = "";
      return;
    }
    const trainer = trainerById();
    if (remoteReady) {
      try {
        const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
        const path = `${trainer.remoteId || slugify(trainer.name)}/${upload.dataset.trainerUpload}-${Date.now()}.${extension}`;
        await window.LDTT_PORTAL.upload("trainer-page-assets", path, file);
        trainer[upload.dataset.trainerUpload] = window.LDTT_PORTAL.publicStorageUrl("trainer-page-assets", path);
        await runRemoteMutation("Image uploaded and trainer page draft saved", () => persistTrainerRecord(trainer));
      } catch (error) {
        showToast(`Image upload failed: ${error.message}`);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        trainer[upload.dataset.trainerUpload] = reader.result;
        saveState("Image uploaded to trainer setup preview");
      };
      reader.readAsDataURL(file);
    }
    return;
  }
  if (event.target.name?.startsWith("admin-trainer-social-")) {
    const trainer = trainerById();
    const key = event.target.name.replace("admin-trainer-social-", "");
    trainer.socials = { ...(trainer.socials || {}), [key]: event.target.value };
    saveState("Trainer social status updated");
    return;
  }
  const statusField = event.target.closest("[data-lead-status]");
  if (statusField) {
    const lead = updateLeadRecord(statusField.dataset.leadStatus, { status: statusField.value });
    if (remoteReady) runRemoteMutation(
      conversionStatuses().includes(lead?.status) ? "Lead converted and client record saved" : "Lead status updated",
      () => persistLeadWorkflow(lead)
    );
    else saveState("Lead status updated");
    return;
  }
  const leadFilter = event.target.closest("[data-lead-filter]");
  if (leadFilter) { state[leadFilter.dataset.leadFilter === "trainer" ? "leadTrainerFilter" : "leadStatusFilter"] = leadFilter.value; saveState(); return; }
  const followup = event.target.closest("[data-lead-followup]");
  if (followup) {
    const lead = updateLeadRecord(followup.dataset.leadFollowup, { followUpDate: followup.value });
    if (remoteReady) runRemoteMutation("Follow-up date saved", () => persistLeadRecord(lead));
    else saveState("Follow-up date saved");
    return;
  }
  const lostReason = event.target.closest("[data-lead-lost-reason]");
  if (lostReason) {
    const lead = updateLeadRecord(lostReason.dataset.leadLostReason, { lostReason: lostReason.value });
    if (remoteReady) runRemoteMutation("Lost reason saved", () => persistLeadRecord(lead));
    else saveState("Lost reason saved");
    return;
  }
  const dnc = event.target.closest("[data-lead-dnc]");
  if (dnc) {
    const lead = updateLeadRecord(dnc.dataset.leadDnc, { doNotContact: dnc.checked, status: dnc.checked ? "Do Not Contact" : "Office Contacted" });
    if (remoteReady) runRemoteMutation("Contact protection updated", () => persistLeadRecord(lead));
    else saveState("Contact protection updated");
    return;
  }
  const applicationStatus = event.target.closest("[data-application-status]");
  if (applicationStatus) {
    const application = updateApplicationRecord(applicationStatus.dataset.applicationStatus, { status: applicationStatus.value });
    if (remoteReady) runRemoteMutation("Trainer application status updated", () => persistApplicationRecord(application));
    else saveState("Trainer application status updated");
    return;
  }
  const actionField = event.target.closest("[data-import-action]");
  if (actionField) {
    const row = state.importedPreview[Number(actionField.dataset.importAction)];
    if (row) row.action = actionField.value;
    saveState(null, true);
  }
  if (event.target.name === "lead-custom-start" || event.target.name === "lead-custom-end") {
    state.leadDateRange = "custom";
    saveState("Custom lead date range applied");
    return;
  }
  if (event.target.name?.startsWith("admin-trainer-")) {
    const trainer = trainerById();
    const key = event.target.name.replace("admin-trainer-", "");
    trainer[key] = key === "locked" ? event.target.value === "true" : event.target.value;
    if (key === "layout") trainer.pageStatus = trainer.pageStatus === "No Site Started" ? "Draft" : trainer.pageStatus;
    saveState("Trainer profile field updated");
  }
  if (event.target.dataset.profileField) {
    trainerById()[event.target.dataset.profileField] = event.target.value;
    saveState("Trainer profile source field saved");
    return;
  }
});

let draggedLeadId = "";
document.addEventListener("dragstart", event => { const card = event.target.closest("[data-lead-card]"); if (card) { draggedLeadId = card.dataset.leadCard; event.dataTransfer.effectAllowed = "move"; } });
document.addEventListener("dragover", event => { if (event.target.closest("[data-drop-status]")) event.preventDefault(); });
document.addEventListener("drop", event => {
  const column = event.target.closest("[data-drop-status]");
  if (!column || !draggedLeadId) return;
  event.preventDefault();
  const lead = updateLeadRecord(draggedLeadId, { status: column.dataset.dropStatus === "Lost" ? "Lost / No Response" : column.dataset.dropStatus });
  draggedLeadId = "";
  if (remoteReady) runRemoteMutation("Lead moved to " + column.dataset.dropStatus, () => persistLeadWorkflow(lead));
  else saveState("Lead moved to " + column.dataset.dropStatus);
});

document.addEventListener("submit", async event => {
  event.preventDefault();
  if (event.target.classList.contains("office-lead-form")) {
    if (event.target.dataset.submitting === "true") return;
    if (!event.target.reportValidity()) return;
    const submitButton = event.target.querySelector('button[type="submit"]');
    const formStatus = event.target.querySelector(".landing-form-status");
    const setLandingStatus = (message, type = "success") => {
      if (!formStatus) return;
      formStatus.className = `landing-form-status ${type}`;
      formStatus.textContent = message;
    };
    event.target.dataset.submitting = "true";
    submitButton?.setAttribute("disabled", "disabled");
    const entries = formEntries(event.target);
    const trainerId = event.target.dataset.trainerId || currentTrainerId();
    const trainer = trainerById(trainerId);
    const owner = `${entries.first_name || ""} ${entries.last_name || ""}`.trim() || "Website Contact";
    const newLead = {
      id: `lead-${Date.now()}`,
      owner,
      dog: "Pending",
      breed: "Pending",
      source: entries.heard_about_us || "Trainer Landing Page",
      service: entries.i_want_to || "Contact Request",
      trainerId,
      phone: entries.phone || "",
      email: entries.email || "",
      address: [entries.address_line_1, entries.address_line_2, entries.city, entries.state, entries.zip].filter(Boolean).join(", "),
      status: "New Inquiry",
      createdAt: new Date().toISOString().slice(0, 10),
      next: "Office follow-up needed",
      note: entries.comments || "Trainer landing page consultation request. Production office should follow up.",
      visits: 1,
      submitted: true
    };
    state.leads.unshift(newLead);
    trainer.forms = Number(trainer.forms || 0) + 1;
    const stored = storedRows("ldttContactSubmissions.v2");
    const attribution = trainerAttribution(trainer, "trainer_form_submitted");
    const storedPayload = { ...entries, ...attribution, submission_id: `trainer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, delivery_local: "saved", delivery_google: "pending", delivery_email: "pending", delivery_supabase: window.LDTT_SUPABASE?.enabled ? "pending" : "not_connected", timestamp: new Date().toISOString(), source_page: `trainer landing page: ${trainerName(trainerId)}` };
    const events = storedRows(SITE_EVENT_KEY);
    events.push(attribution);
    localStorage.setItem(SITE_EVENT_KEY, JSON.stringify(events));
    stored.push(storedPayload);
    localStorage.setItem("ldttContactSubmissions.v2", JSON.stringify(stored));
    event.target.reset();
    setLandingStatus("Thank you. Your consultation request was submitted. Lorenzo's office will contact you within 1-3 business days.");
    saveState("Consultation request saved to admin lead inbox", true);
    showFormSuccessModal();

    Promise.allSettled([
      submitToSupabase("submit-contact", storedPayload),
      submitLandingEmail(storedPayload, trainer),
      submitLandingGoogleSheet(storedPayload, trainer)
    ]).then(results => {
      const deliveryKeys = ["delivery_supabase", "delivery_email", "delivery_google"];
      const storedRowsNow = storedRows("ldttContactSubmissions.v2");
      const storedRow = storedRowsNow.find(row => row.submission_id === storedPayload.submission_id);
      results.forEach((result, index) => {
        if (storedRow) storedRow[deliveryKeys[index]] = result.status === "fulfilled" ? (index === 2 ? "attempted" : (result.value?.skipped ? "not_connected" : "confirmed")) : "failed";
        if (result.status === "rejected") {
          const destinations = ["Supabase", "FormSubmit", "Google Sheet"];
          console.warn(`LDTT trainer-page ${destinations[index]} delivery failed`, result.reason);
        }
      });
      if (storedRow) { storedRow.delivery_updated_at = new Date().toISOString(); localStorage.setItem("ldttContactSubmissions.v2", JSON.stringify(storedRowsNow)); }
    }).finally(() => {
      window.setTimeout(() => {
        delete event.target.dataset.submitting;
        submitButton?.removeAttribute("disabled");
      }, 4000);
    });

    window.setTimeout(() => {
      if (event.target.dataset.submitting === "true") {
        delete event.target.dataset.submitting;
        submitButton?.removeAttribute("disabled");
      }
    }, 10000);
    return;
  }
  if (event.target.id === "changePasswordForm") {
    const password = event.target.elements.password.value;
    const confirmation = event.target.elements.confirmation.value;
    const status = document.getElementById("passwordStatus");
    if (password !== confirmation) {
      status.textContent = "Passwords do not match.";
      return;
    }
    try {
      status.textContent = "Saving your permanent password...";
      await window.LDTT_PORTAL.changePassword(password);
      portalUser = await window.LDTT_PORTAL.currentPortalUser();
      status.textContent = "Permanent password saved.";
      render();
    } catch (error) {
      status.textContent = `Password could not be changed: ${error.message}`;
    }
    return;
  }
  if (event.target.id === "loginForm") {
    const username = event.target.elements.username.value.trim().toLowerCase();
    const password = event.target.elements.password.value;
    const status = document.getElementById("loginStatus");
    const button = event.target.querySelector('button[type="submit"]');
    try {
      button.disabled = true;
      status.textContent = "Signing in...";
      await window.LDTT_PORTAL.signIn(username, password);
      portalUser = await window.LDTT_PORTAL.currentPortalUser();
      if (!portalUser?.active) {
        await window.LDTT_PORTAL.signOut();
        throw new Error("This portal account is disabled. Contact Lorenzo's office.");
      }
      session = { loggedIn: true, role: portalUser.role };
      state.role = portalUser.role;
      state.activeView = "dashboard";
      state.leadDateRange = "60";
      state.customLeadStart = toDateInputValue(defaultLeadStartDate);
      state.customLeadEnd = toDateInputValue(defaultLeadEndDate);
      const data = await prepareRemoteData(await window.LDTT_PORTAL.loadOperationalData());
      mergeRemoteOperationalData(data);
      if (portalUser.trainer_id) {
        state.selectedTrainerId = state.trainers.find(trainer => trainer.remoteId === portalUser.trainer_id)?.id || state.selectedTrainerId;
      }
      status.textContent = "";
      render();
    } catch (error) {
      status.textContent = `Sign in failed: ${error.message}`;
      try {
        await window.LDTT_PORTAL?.signOut?.();
      } catch {
        // Preserve the useful sign-in error even if session cleanup is unavailable.
      }
    } finally {
      button.disabled = false;
    }
    return;
  }
});

document.addEventListener("invalid", event => {
  const control = event.target;
  if (!(control instanceof HTMLElement)) return;
  const details = control.closest("details");
  if (details) details.open = true;
  control.classList.add("field-invalid");
  control.closest("label,fieldset,details")?.classList.add("field-invalid-wrap");
  window.setTimeout(() => control.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
}, true);

document.addEventListener("input", event => {
  const control = event.target;
  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) return;
  if (control.checkValidity()) {
    control.classList.remove("field-invalid");
    control.closest("label,fieldset,details")?.classList.remove("field-invalid-wrap");
  }
});

bootstrapApplication();
