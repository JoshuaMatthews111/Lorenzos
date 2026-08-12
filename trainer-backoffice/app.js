const STORE_KEY = "lorenzoBackOfficePrototype.v9";
const UI_STORE_KEY = "lorenzoBackOfficeUi.v10";
const SESSION_KEY = "lorenzoBackOfficeSession.v4";
const PUBLIC_SITE_ORIGIN = "https://www.lorenzosdogtrainingteam.com";
const TRAINER_TEMP_PASSWORD_NOTICE = "Provided privately by Lorenzo's office";
const TEMP_PASSWORD = ""; // temp passwords are issued by the office privately — never shipped in public code
const DEMO_TEST_PASSWORD = "doglovers26";
const SITE_EVENT_KEY = "ldttTrainerSiteEvents.v1";
const RECOVERABLE_LOCAL_CACHE_KEYS = [
  SITE_EVENT_KEY,
  STORE_KEY,
  "ldttOperationalSnapshot.v1",
  "ldttContactSubmissions.v2",
  "ldttTrainerApplications.v1",
  "ldttTrainerApplicationOverrides.v1"
];
const REAL_TRAINERS = Array.isArray(window.LDTT_TRAINER_ROSTER) ? window.LDTT_TRAINER_ROSTER : [];
const IMPORTED_APPLICATION_FIELDS = Array.isArray(window.LDTT_TRAINER_APPLICATION_FIELDS) ? window.LDTT_TRAINER_APPLICATION_FIELDS : [];
const IMPORTED_APPLICATION_RESPONSES = Array.isArray(window.LDTT_TRAINER_APPLICATION_RESPONSES) ? window.LDTT_TRAINER_APPLICATION_RESPONSES : [];
const TRAINER_APPLICATION_FORM_EMBED = "https://docs.google.com/forms/d/e/1FAIpQLSdm5gkPQl4LwPVIGZZQbOGYA05le1xMUybMngJIyWKeDmlF5Q/viewform?embedded=true";
const TRAINER_APPLICATION_FORM_LINK = "https://docs.google.com/forms/d/e/1FAIpQLSdm5gkPQl4LwPVIGZZQbOGYA05le1xMUybMngJIyWKeDmlF5Q/viewform";
const TRAINER_APPLICATION_RESPONSE_SHEET = "https://docs.google.com/spreadsheets/d/1RsF2HajyVxctqHhWGxzJ-ZLqGrlO4gwJ3B9URfgezOI/edit?usp=sharing";
const TRAINER_APPLICATION_RESPONSE_SHEET_EMBED = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSUZLKmnCY48EIZoHiI5SKNrW7sz3-LuvrvX1CGAP4R71M83Vb-zwn6YDEFpXp67yiTM5jELesML5sw/pubhtml?widget=true&headers=false";

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

const trainerVideoLibrary = {
  "bailey-brown": { src: "/assets/trainer-videos/bailey-brown.mp4", poster: "/assets/trainer-videos/bailey-brown.jpg" },
  "carolina-perez": { src: "/assets/trainer-videos/carolina-perez.mp4", poster: "/assets/trainer-videos/carolina-perez.jpg" },
  "carolina-don": { src: "/assets/trainer-videos/carolina-perez.mp4", poster: "/assets/trainer-videos/carolina-perez.jpg" },
  "clark-patton": { src: "/assets/trainer-videos/clark-patton.mp4", poster: "/assets/trainer-videos/clark-patton.jpg" },
  "daniel-bainbridge": { src: "/assets/trainer-videos/daniel-bainbridge.mp4", poster: "/assets/trainer-videos/daniel-bainbridge.jpg" },
  "eric-beck": { src: "/assets/trainer-videos/eric-beck.mp4", poster: "/assets/trainer-videos/eric-beck.jpg" },
  "eric-hardaway": { src: "/assets/trainer-videos/eric-hardaway.mp4", poster: "/assets/trainer-videos/eric-hardaway.jpg" },
  "harley-mcgrew": { src: "/assets/trainer-videos/harley-mcgrew.mp4", poster: "/assets/trainer-videos/harley-mcgrew.jpg" },
  "karemela-sefferin": { src: "/assets/trainer-videos/karemela-sefferin.mp4", poster: "/assets/trainer-videos/karemela-sefferin.jpg" },
  "karemelasefferin": { src: "/assets/trainer-videos/karemela-sefferin.mp4", poster: "/assets/trainer-videos/karemela-sefferin.jpg" },
  "shavon-striggles": { src: "/assets/trainer-videos/shavon-striggles.mp4", poster: "/assets/trainer-videos/shavon-striggles.jpg" },
  "victoria-bayleigh-morris": { src: "/assets/trainer-videos/victoria-bayleigh-morris.mp4", poster: "/assets/trainer-videos/victoria-bayleigh-morris.jpg" }
};

const OFFICE_ADMIN_EMAILS = new Set([
  "marksprouse@lorenzosdogtrainingteam.com",
  "biancamiller@lorenzosdogtrainingteam.com",
  "bridgettemullins@lorenzosdogtrainingteam.com"
]);

const PORTAL_STAFF_DIRECTORY = [
  { name: "Lorenzo Miller", email: "lorenzo@lorenzosdogtrainingteam.com", permission: "super_admin" },
  { name: "Melissa Zuk", email: "melissazuk@lorenzosdogtrainingteam.com", permission: "super_admin" },
  { name: "Rachel Leggett", email: "rachelleggett@lorenzosdogtrainingteam.com", permission: "super_admin" },
  { name: "Kathleen Saraney", email: "controller@lorenzosdogtrainingteam.com", permission: "super_admin" },
  { name: "Arrison Jackson", email: "arrisoncjackson@gmail.com", permission: "super_admin" },
  { name: "Tim Miller", email: "tmillerk999@gmail.com", permission: "super_admin" },
  { name: "Joshua Matthews", email: "mr.matthews2022@gmail.com", permission: "super_admin" },
  { name: "Marketing Team", email: "marketing@lorenzosdogtrainingteam.com", permission: "super_admin" },
  { name: "Mark Sprouse", email: "marksprouse@lorenzosdogtrainingteam.com", permission: "office_admin" },
  { name: "Bianca Miller", email: "biancamiller@lorenzosdogtrainingteam.com", permission: "office_admin" },
  { name: "Bridgette Mullins", email: "bridgettemullins@lorenzosdogtrainingteam.com", permission: "office_admin" }
];

const DEMO_PORTAL_ACCOUNTS = {
  admin: {
    user_id: "demo-super-admin",
    username: "admin",
    email: "admin",
    display_name: "Demo Super Admin",
    role: "admin",
    permission_level: "super_admin",
    active: true,
    access_status: "active",
    must_change_password: false,
    demo: true
  },
  "office admin": {
    user_id: "demo-office-admin",
    username: "office admin",
    email: "office admin",
    display_name: "Demo Office Admin",
    role: "admin",
    permission_level: "office_admin",
    active: true,
    access_status: "active",
    must_change_password: false,
    demo: true
  },
  trainner: {
    user_id: "demo-trainner",
    username: "trainner",
    email: "trainner",
    display_name: "Demo Trainer",
    role: "trainer",
    permission_level: "trainer",
    active: true,
    access_status: "active",
    must_change_password: false,
    trainer_id: "eric-beck",
    demo: true
  }
};

const heroImageOptions = [
  { src: "/assets/trainer-bio-photos/daniel-bainbridge.jpg", label: "Trainer In Action" },
  { src: "/assets/trainer-bio-photos/shavon-striggles.jpg", label: "Trainer Portrait" },
  { src: "/assets/emilio-yoyo.jpg", label: "Advanced Training" },
  { src: "/assets/utility-retrieval.png", label: "Utility & Retrieval" },
  { src: "/assets/client-photo.jpg", label: "Owner & Dog" },
  { src: "/assets/ldtt-team-cover.jpg", label: "Lorenzo Team" }
];

const showFormSuccessModal = (message = "Thank you, your request was submitted. Lorenzo's office has your details and will follow up with the next step.") => {
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
  "Evaluation Scheduled",
  "Evaluation Complete",
  "Became a Client",
  "Lost / No Response",
  "Lost / Price Concern",
  "Lost / Not Ready",
  "Lost / Chose Another Provider",
  "Lost: Client Complaint",
  "Lost: No Trainer in the Area",
  "Bad Lead",
  "Do Not Contact",
  "Archived"
];

const CONTACT_SMS_DISCLOSURE_TEXT = "By checking this box, I agree to receive recurring promotional and informational text messages from Lorenzo's Dog Training Team about dog training, consultation scheduling, follow-up, and offers. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the Terms of Service and Privacy Policy.";
const CONTACT_PHONE_REQUIRED_NOTICE_TEXT = "Phone is required so Lorenzo's office can call about your request. SMS consent is optional and separate from submitting this form.";
const APPLICATION_CERTIFICATION_TEXT = "I certify that the information provided is true and complete to the best of my knowledge.";
const APPLICATION_SMS_DISCLOSURE_TEXT = "By checking this box, I agree to receive recurring promotional and informational text messages from Lorenzo's Dog Training Team about trainer recruiting, application follow-up, training opportunities, and offers. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the Terms of Service and Privacy Policy.";

const clientStatuses = ["All", "Active", "Past", "Won", "Lost", "Bad Lead", "Do Not Contact", "Archived"];
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
  clientSearch: "",
  applicationFilter: "All",
  applicationViewMode: "sheet",
  reviewSubmissionFilter: "Active",
  reviewSort: "Newest",
  leadDateRange: "60",
  customLeadStart: toDateInputValue(defaultLeadStartDate),
  customLeadEnd: toDateInputValue(defaultLeadEndDate),
  reportDateRange: "30",
  customReportStart: toDateInputValue(new Date(defaultLeadEndDate.getTime() - 29 * 86400000)),
  customReportEnd: toDateInputValue(defaultLeadEndDate),
  leadSearch: "",
  applicationSearch: "",
  leadStatusFilter: "All",
  leadTrainerFilter: "All",
  leadSmsFilter: "All",
  leadOwnerFilter: "All",
  leadViewMode: "board",
  leadDetailSheetOpen: false,
  selectedLeadId: "",
  selectedApplicationId: "",
  selectedClientId: "",
  selectedSubmissionId: "",
  onboardingStep: 1,
  builderTab: "page",
  builderSurface: "trainer",
  builderPage: "home",
  builderMainPage: "/index.html",
  builderPortalView: "dashboard",
  builderDevice: "desktop",
  builderMode: "browse",
  builderSelectedSelector: "",
  siteBuilderEdits: {},
  portalBuilderEdits: {},
  activityLog: [],
  demoPasswords: {},
  demoPortalProfiles: {},
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
      title: "Team Trainer",
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
    { id: "lead-4", owner: "Emily Wilson", dog: "Teddy", breed: "French Bulldog", source: "Facebook", service: "Obedience Training", trainerId: "shavon-striggles", status: "Office Contacted", createdAt: "2026-06-03", next: "Jun 28, 2026 2:00 PM", note: "Office left voicemail. Needs second call.", visits: 5, submitted: true },
    { id: "lead-5", owner: "Chris Brown", dog: "Bailey", breed: "Golden Retriever", source: "Website", service: "Board & Train", trainerId: "emilio-marotta", status: "Engaged Lead: No Outcome", createdAt: "2026-05-25", next: "Jun 29, 2026 6:00 PM", note: "Owner engaged with office, but no outcome selected yet.", visits: 3, submitted: true },
    { id: "lead-6", owner: "Amanda Lee", dog: "Bella", breed: "Husky", source: "Referral", service: "Board & Train", trainerId: "eric-beck", status: "Became a Client", createdAt: "2026-05-12", next: "-", note: "First session/payment confirmed. Training begins 6/26/26.", visits: 3, submitted: true },
    { id: "lead-7", owner: "Robert Johnson", dog: "Duke", breed: "Pit Bull Mix", source: "Google", service: "Behavior Modification", trainerId: "harley-mcgrew", status: "Lost / Chose Another Provider", createdAt: "2026-04-29", next: "-", note: "Chose another trainer closer to home.", visits: 1, submitted: true },
    { id: "lead-8", owner: "Mark Allen", dog: "Rex", breed: "Doberman", source: "Website", service: "Protection Training", trainerId: "john-delbane", status: "Became a Client", createdAt: "2026-04-18", next: "Jun 30, 2026", note: "Client conversion confirmed by office.", visits: 6, submitted: true }
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
let remoteOfficeNotes = [];
let remoteNoteRevisions = [];
let remoteAuditEvents = [];
let remoteLifecycleEvents = [];
let remoteReviewPublications = [];
let remoteDeliveryAttempts = [];
let remoteSheets = { leads: [], applications: [], clients: [] };
let remoteServerRevision = "";
let remoteSyncedAt = "";
let remoteSyncError = "";
let operationalSyncTimer = null;
let operationalRealtimeUnsubscribe = null;
let operationalRealtimeDebounce = null;
let leadFilterRenderTimer = null;
let applicationFilterRenderTimer = null;
let clientFilterRenderTimer = null;
applyUrlState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_STORE_KEY)) || {};
    const merged = { ...structuredClone(defaultState), ...saved };
    ["trainers", "leads", "clients", "submissions", "applications", "stagedInvites"].forEach(key => {
      merged[key] = Array.isArray(saved[key]) ? saved[key] : structuredClone(defaultState[key]);
    });
    merged.activityLog = Array.isArray(saved.activityLog) ? saved.activityLog : [];
    merged.demoPasswords = { ...(saved.demoPasswords || {}) };
    merged.demoPortalProfiles = { ...(saved.demoPortalProfiles || {}) };
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
        const rosterHeadshot = trainer.cardPhoto || trainer.profilePhoto || trainer.publicPhoto || "";
        const rosterLandingPhoto = trainer.photo || trainer.image || rosterHeadshot || "";
        const savedHeadshot = (existing.cardPhoto && existing.cardPhoto !== existing.photo && existing.cardPhoto !== trainer.photo)
          ? existing.cardPhoto
          : rosterHeadshot;
        const savedProfilePhoto = (existing.profilePhoto && existing.profilePhoto !== existing.photo && existing.profilePhoto !== trainer.photo)
          ? existing.profilePhoto
          : savedHeadshot;
        const savedPublicPhoto = (existing.publicPhoto && existing.publicPhoto !== existing.photo && existing.publicPhoto !== trainer.photo)
          ? existing.publicPhoto
          : savedHeadshot;
        const heroLooksLikeHeadshot = existing.heroTrainerPhoto && [savedHeadshot, savedProfilePhoto, savedPublicPhoto, trainer.cardPhoto].filter(Boolean).includes(existing.heroTrainerPhoto);
        const bioLooksLikeHeadshot = existing.landingBioPhoto && [savedHeadshot, savedProfilePhoto, savedPublicPhoto, trainer.cardPhoto].filter(Boolean).includes(existing.landingBioPhoto);
        return {
          ...structuredClone(trainer),
          accessStatus: "accessStatus" in existing ? existing.accessStatus : "Active",
          layout: existing.layout || defaultLayout,
          pageStatus: existing.pageStatus || "Published",
          locked: "locked" in existing ? existing.locked : true,
          ...existing,
          photo: existing.photo || trainer.photo || trainer.image || "",
          image: existing.image || trainer.image || trainer.photo || "",
          cardPhoto: savedHeadshot,
          profilePhoto: savedProfilePhoto,
          publicPhoto: savedPublicPhoto,
          heroTrainerPhoto: (!existing.heroTrainerPhoto || heroLooksLikeHeadshot) ? rosterLandingPhoto : existing.heroTrainerPhoto,
          landingBioPhoto: (!existing.landingBioPhoto || bioLooksLikeHeadshot) ? rosterLandingPhoto : existing.landingBioPhoto,
          bioPhotoPosition: existing.bioPhotoPosition || trainer.bioPhotoPosition || "center center",
          bioPhotoFit: existing.bioPhotoFit || trainer.bioPhotoFit || "contain",
          bioPhotoScale: existing.bioPhotoScale || trainer.bioPhotoScale || 100,
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
    merged.reportDateRange = saved.reportDateRange || defaultState.reportDateRange;
    merged.customReportStart = saved.customReportStart || defaultState.customReportStart;
    merged.customReportEnd = saved.customReportEnd || defaultState.customReportEnd;
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

function isStorageQuotaError(error) {
  return error?.name === "QuotaExceededError" ||
    error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    /quota|exceeded/i.test(error?.message || "");
}

function clearRecoverableLocalCache(exceptKey = "") {
  RECOVERABLE_LOCAL_CACHE_KEYS.forEach(key => {
    if (key === exceptKey) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Cache cleanup should never block login or saving live Supabase data.
    }
  });
}

function safeLocalSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (isStorageQuotaError(error)) {
      clearRecoverableLocalCache(key);
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryError) {
        console.warn(`LDTT local cache could not be saved for ${key}`, retryError);
        return false;
      }
    }
    console.warn(`LDTT local cache could not be saved for ${key}`, error);
    return false;
  }
}

function safeSessionSetItem(key, value) {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`LDTT session cache could not be saved for ${key}`, error);
    return false;
  }
}

function persistStateSnapshot() {
  const uiState = {
    activeView: state.activeView,
    selectedTrainerId: state.selectedTrainerId,
    clientFilter: state.clientFilter,
    clientSearch: state.clientSearch,
    applicationFilter: state.applicationFilter,
    applicationViewMode: state.applicationViewMode,
    reviewSubmissionFilter: state.reviewSubmissionFilter,
    reviewSort: state.reviewSort,
    leadDateRange: state.leadDateRange,
    customLeadStart: state.customLeadStart,
    customLeadEnd: state.customLeadEnd,
    reportDateRange: state.reportDateRange,
    customReportStart: state.customReportStart,
    customReportEnd: state.customReportEnd,
    leadSearch: state.leadSearch,
    applicationSearch: state.applicationSearch,
    leadStatusFilter: state.leadStatusFilter,
    leadTrainerFilter: state.leadTrainerFilter,
    leadSmsFilter: state.leadSmsFilter,
    leadOwnerFilter: state.leadOwnerFilter,
    leadViewMode: state.leadViewMode,
    leadDetailSheetOpen: state.leadDetailSheetOpen,
    builderDevice: state.builderDevice,
    demoPasswords: state.demoPasswords,
    demoPortalProfiles: state.demoPortalProfiles
  };
  return safeLocalSetItem(UI_STORE_KEY, JSON.stringify(uiState));
}

function saveState(message, skipRender = false) {
  persistStateSnapshot();
  if (message) showToast(message);
  if (!skipRender) render();
}

function captureViewportPosition() {
  return { x: window.scrollX || 0, y: window.scrollY || 0 };
}

function restoreViewportPosition(position) {
  if (!position) return;
  requestAnimationFrame(() => window.scrollTo(position.x, position.y));
  window.setTimeout(() => window.scrollTo(position.x, position.y), 75);
}

function focusedPortalInputSnapshot() {
  const active = document.activeElement;
  if (!active || !["INPUT", "TEXTAREA"].includes(active.tagName)) return null;
  const selector = active.dataset?.leadSearch !== undefined
    ? "[data-lead-search]"
    : active.dataset?.applicationSearch !== undefined
      ? "[data-application-search]"
      : active.dataset?.clientSearch !== undefined
        ? "[data-client-search]"
        : "";
  if (!selector) return null;
  return {
    selector,
    start: active.selectionStart,
    end: active.selectionEnd
  };
}

function restorePortalInputFocus(snapshot) {
  if (!snapshot?.selector) return;
  requestAnimationFrame(() => {
    const field = document.querySelector(snapshot.selector);
    if (!field) return;
    field.focus({ preventScroll: true });
    if (typeof field.setSelectionRange === "function") {
      const end = snapshot.end ?? field.value.length;
      field.setSelectionRange(snapshot.start ?? end, end);
    }
  });
}

function scheduleFilteredWorkspaceRender(kind) {
  persistStateSnapshot();
  const snapshot = focusedPortalInputSnapshot();
  const timer = kind === "application"
    ? applicationFilterRenderTimer
    : kind === "client"
      ? clientFilterRenderTimer
      : leadFilterRenderTimer;
  window.clearTimeout(timer);
  const nextTimer = window.setTimeout(() => {
    if (kind === "application") applicationFilterRenderTimer = null;
    else if (kind === "client") clientFilterRenderTimer = null;
    else leadFilterRenderTimer = null;
    render();
    restorePortalInputFocus(snapshot);
  }, 180);
  if (kind === "application") applicationFilterRenderTimer = nextTimer;
  else if (kind === "client") clientFilterRenderTimer = nextTimer;
  else leadFilterRenderTimer = nextTimer;
}

function scheduleLeadFilterRender() {
  scheduleFilteredWorkspaceRender("lead");
}

function scheduleApplicationFilterRender() {
  scheduleFilteredWorkspaceRender("application");
}

function scheduleClientFilterRender() {
  scheduleFilteredWorkspaceRender("client");
}

function saveSession(role, extras = {}) {
  session = { loggedIn: true, role, ...extras };
  state.role = role;
  safeSessionSetItem(SESSION_KEY, JSON.stringify(session));
}

function hasOperationalRows(data = {}) {
  return ["trainers", "pages", "leads", "clients", "applications", "submissions", "events"].some(key => Array.isArray(data[key]) && data[key].length);
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
  "Evaluation Scheduled": "evaluation_scheduled",
  "Evaluation Complete": "evaluation_complete",
  "Became a Client": "became_client",
  "Lost / No Response": "lost_no_response",
  "Lost / Price Concern": "lost_price_concern",
  "Lost / Not Ready": "lost_not_ready",
  "Lost / Chose Another Provider": "lost_chose_another_provider",
  "Lost: Client Complaint": "lost_client_complaint",
  "Lost: No Trainer in the Area": "lost_no_trainer_area",
  "Bad Lead": "bad_lead",
  "Do Not Contact": "do_not_contact",
  "Archived": "archived"
};
const leadStatusFromDb = Object.fromEntries(Object.entries(leadStatusToDb).map(([label, value]) => [value, label]));
leadStatusFromDb.first_session_payment = "Became a Client";
leadStatusFromDb.follow_up_call_needed = "Office Contacted";
const applicationStatusToDb = {
  "New Application": "new_application",
  "Under Review": "reviewing",
  "Discovery Call Inquiry": "discovery_follow_up",
  "Discovery Follow-up": "discovery_follow_up",
  "Interview Scheduled": "reviewing",
  "Moved Forward": "moved_forward",
  "Declined": "not_a_fit",
  "Archived": "archived"
};
const applicationStatusFromDb = {
  new_application: "New Application",
  reviewing: "Under Review",
  discovery_follow_up: "Discovery Call Inquiry",
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
const officeAdminViews = ["dashboard", "trainers", "leads", "applications", "clients", "reports", "settings"];

function objectHas(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

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

function samePhotoUrl(first, second) {
  return String(first || "").trim() === String(second || "").trim();
}

function safeTrainerAssetUrl(value = "") {
  const url = String(value || "").trim();
  const match = url.match(/^(\/?assets\/trainer-headshots\/)([^?#]+)(.*)$/i);
  if (!match) return url;
  const decoded = decodeURIComponent(match[2]);
  const extension = decoded.includes(".") ? decoded.split(".").pop() : "jpg";
  const stem = decoded.replace(/\.[^.]+$/, "");
  const safeStem = stem.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `/assets/trainer-headshots/${safeStem}.${extension}${match[3] || ""}`;
}

function firstNonHeadshotPhoto(values, headshotCandidates) {
  return values.find(value => value && !headshotCandidates.some(candidate => samePhotoUrl(value, candidate))) || "";
}

function remoteTrainerToUi(remoteTrainer, remotePage = null) {
  const existing = state.trainers.find(trainer =>
    trainer.remoteId === remoteTrainer.id ||
    trainer.slug === remoteTrainer.slug ||
    trainer.id === remoteTrainer.slug
  ) || {};
  const rosterTrainer = REAL_TRAINERS.find(trainer =>
    trainer.id === remoteTrainer.slug ||
    trainer.slug === remoteTrainer.slug ||
    trainer.name === remoteTrainer.full_name
  ) || {};
  const content = {
    ...(remotePage?.published_content || {}),
    ...(remotePage?.draft_content || {})
  };
  const styleSettings = remotePage?.style_settings || {};
  const socialLinks = remoteTrainer.social_links || {};
  const rosterHeadshot = safeTrainerAssetUrl(rosterTrainer.cardPhoto || "");
  const rawHeadshotUrl = safeTrainerAssetUrl(remoteTrainer.headshot_url || content.headshot_url || existing.cardPhoto || existing.profilePhoto || existing.publicPhoto || "");
  const headshotCandidates = [
    rawHeadshotUrl,
    safeTrainerAssetUrl(remoteTrainer.headshot_url),
    safeTrainerAssetUrl(content.headshot_url),
    safeTrainerAssetUrl(existing.cardPhoto),
    safeTrainerAssetUrl(existing.profilePhoto),
    safeTrainerAssetUrl(existing.publicPhoto),
    rosterHeadshot
  ].filter(Boolean);
  const landingCandidates = [
    safeTrainerAssetUrl(content.hero_trainer_photo_url),
    safeTrainerAssetUrl(content.landing_bio_photo_url),
    safeTrainerAssetUrl(content.bio_photo_url),
    safeTrainerAssetUrl(existing.photo),
    safeTrainerAssetUrl(existing.image),
    safeTrainerAssetUrl(rosterTrainer.photo),
    safeTrainerAssetUrl(rosterTrainer.image),
    safeTrainerAssetUrl(remotePage?.hero_image_url),
    safeTrainerAssetUrl(remotePage?.approved_photo_urls?.[0])
  ].filter(Boolean);
  const headshotIsLandingPhoto = rawHeadshotUrl && landingCandidates.includes(rawHeadshotUrl);
  const headshotUrl = headshotIsLandingPhoto && rosterHeadshot ? rosterHeadshot : (rawHeadshotUrl || rosterHeadshot || safeTrainerAssetUrl(remotePage?.approved_photo_urls?.[0]) || "");
  const rosterLandingPhoto = firstNonHeadshotPhoto([
    safeTrainerAssetUrl(existing.photo),
    safeTrainerAssetUrl(rosterTrainer.photo),
    safeTrainerAssetUrl(rosterTrainer.image),
    safeTrainerAssetUrl(existing.image),
    safeTrainerAssetUrl(remotePage?.hero_image_url),
    safeTrainerAssetUrl(remotePage?.approved_photo_urls?.[0])
  ], headshotCandidates) || headshotUrl;
  const heroTrainerPhotoUrl = firstNonHeadshotPhoto([
    safeTrainerAssetUrl(content.hero_trainer_photo_url),
    safeTrainerAssetUrl(existing.heroTrainerPhoto)
  ], headshotCandidates) || rosterLandingPhoto;
  const landingBioPhotoUrl = firstNonHeadshotPhoto([
    safeTrainerAssetUrl(content.landing_bio_photo_url),
    safeTrainerAssetUrl(content.bio_photo_url),
    safeTrainerAssetUrl(existing.landingBioPhoto)
  ], headshotCandidates) || rosterLandingPhoto;
  return {
    ...existing,
    remoteId: remoteTrainer.id,
    isOfficeDraft: false,
    pageId: remotePage?.id || existing.pageId || "",
    id: remoteTrainer.id,
    slug: remoteTrainer.slug,
    pageSlug: existing.pageSlug || remotePage?.slug?.replaceAll("-", "") || remoteTrainer.slug.replaceAll("-", ""),
    name: content.trainer_name || remoteTrainer.full_name,
    profileName: remoteTrainer.full_name,
    publicName: remoteTrainer.full_name,
    market: content.market || remoteTrainer.market || "",
    profileMarket: remoteTrainer.market || "",
    publicMarket: remoteTrainer.market || "",
    state: remoteTrainer.state || "",
    profileState: remoteTrainer.state || "",
    publicState: remoteTrainer.state || "",
    serviceArea: content.service_area || remoteTrainer.service_area || "",
    profileServiceArea: remoteTrainer.service_area || "",
    publicServiceArea: remoteTrainer.service_area || "",
    phone: remoteTrainer.phone || "(866) 436-4959",
    profilePhone: remoteTrainer.phone || "",
    publicPhone: remoteTrainer.phone || "",
    email: remoteTrainer.email || "",
    profileEmail: remoteTrainer.email || "",
    publicEmail: remoteTrainer.email || "",
    title: content.title || "Team Trainer",
    profileTitle: content.title || "Team Trainer",
    bio: remotePage?.approved_bio || content.bio || remoteTrainer.bio || "",
    profileBio: remoteTrainer.bio || "",
    publicBio: remoteTrainer.bio || "",
    photo: rosterLandingPhoto,
    cardPhoto: headshotUrl,
    heroTrainerPhoto: heroTrainerPhotoUrl,
    landingBioPhoto: landingBioPhotoUrl,
    profilePhoto: headshotUrl,
    publicPhoto: headshotUrl,
    image: safeTrainerAssetUrl(remotePage?.hero_image_url || content.hero_image_url || existing.image || rosterLandingPhoto || trainerLandingDogs[templateFromDb(remotePage?.template_key)]),
    heroPhotoPosition: content.hero_photo_position || existing.heroPhotoPosition || "center top",
    heroPhotoFit: content.hero_photo_fit || existing.heroPhotoFit || "cover",
    heroPhotoScale: content.hero_photo_scale || existing.heroPhotoScale || 100,
    heroPhotoFrame: content.hero_photo_frame || existing.heroPhotoFrame || "standard",
    bioPhotoPosition: content.bio_photo_position || existing.bioPhotoPosition || "center center",
    bioPhotoFit: content.bio_photo_fit || existing.bioPhotoFit || "cover",
    bioPhotoScale: content.bio_photo_scale || existing.bioPhotoScale || 100,
    bioPhotoFrame: content.bio_photo_frame || existing.bioPhotoFrame || "tight",
    companyLogo: remotePage?.logo_url || "",
    layout: templateFromDb(remotePage?.template_key),
    pageStatus: pageStatusFromDb(remotePage?.page_status),
    locked: Boolean(remotePage?.locked),
    accessStatus: remoteTrainer.access_status === "disabled" ? "Disabled" : "Active",
    specialties: Array.isArray(remoteTrainer.specialties) && remoteTrainer.specialties.length ? remoteTrainer.specialties : (existing.specialties || []),
    profileSpecialtiesText: Array.isArray(remoteTrainer.specialties) ? remoteTrainer.specialties.join("\n") : "",
    publicSpecialtiesText: Array.isArray(remoteTrainer.specialties) ? remoteTrainer.specialties.join("\n") : "",
    credentials: Array.isArray(remoteTrainer.credentials) && remoteTrainer.credentials.length ? remoteTrainer.credentials : (existing.credentials || []),
    profileCredentialsText: Array.isArray(remoteTrainer.credentials) ? remoteTrainer.credentials.join("\n") : "",
    publicCredentialsText: Array.isArray(remoteTrainer.credentials) ? remoteTrainer.credentials.join("\n") : "",
    socials: {
      facebook: remotePage?.social_facebook || socialLinks.facebook || "",
      instagram: remotePage?.social_instagram || socialLinks.instagram || "",
      tiktok: remotePage?.social_tiktok || socialLinks.tiktok || ""
    },
    heroHeadline: remotePage?.headline || existing.heroHeadline || approvedLayouts.find(item => item.id === templateFromDb(remotePage?.template_key))?.headline,
    tagline: remotePage?.subheadline || existing.tagline || "",
    seoTitle: content.seo_title || existing.seoTitle || "",
    seoDescription: content.seo_description || existing.seoDescription || "",
    review1Author: objectHas(content, "review1_author") ? (content.review1_author || "") : (existing.review1Author || "Local Client"),
    review1Copy: objectHas(content, "review1_copy") ? (content.review1_copy || "") : (existing.review1Copy || "Professional, patient, and focused on training that works in everyday life."),
    review2Author: objectHas(content, "review2_author") ? (content.review2_author || "") : (existing.review2Author || "Dog Owner"),
    review2Copy: objectHas(content, "review2_copy") ? (content.review2_copy || "") : (existing.review2Copy || "The office follow-up was clear and the training path was practical."),
	    review3Author: objectHas(content, "review3_author") ? (content.review3_author || "") : (existing.review3Author || "Verified Client"),
	    review3Copy: objectHas(content, "review3_copy") ? (content.review3_copy || "") : (existing.review3Copy || "Better communication, calmer behavior, and real-world results."),
    approvedReviews: Array.isArray(content.approved_reviews) ? content.approved_reviews : (existing.approvedReviews || []),
	    liveEdits: Array.isArray(content.live_edits) ? content.live_edits : (existing.liveEdits || []),
	    mediaLibrary: Array.isArray(content.media_library) ? content.media_library : (existing.mediaLibrary || []),
	    hiddenSections: Array.isArray(content.hidden_sections) ? content.hidden_sections : (existing.hiddenSections || []),
	    styleSettings: {
      fontFamily: styleSettings.font_family || "Inter",
      fontScale: Number(styleSettings.font_scale || 1),
      brandPrimary: styleSettings.brand_primary || "#071f44",
      brandAccent: styleSettings.brand_accent || "#d80f35"
    },
    sectionOrder: remotePage?.section_order || ["hero", "stats", "services", "trainer", "reviews", "consultation"],
    revision: Number(remotePage?.revision || 1),
    publishedRevision: Number(remotePage?.published_revision || 0),
    version: Number(remoteTrainer.version || 1),
    updatedAt: remoteTrainer.updated_at || remoteTrainer.created_at || "",
    pageVersion: Number(remotePage?.revision || 1),
    pageUpdatedAt: remotePage?.updated_at || remotePage?.created_at || ""
  };
}

function remoteLeadToUi(row) {
  const raw = row.raw_payload || {};
  const trainer = state.trainers.find(item => item.remoteId === row.trainer_id || item.slug === row.trainer_slug);
  const clientNote = row.comments || raw.comments || "";
  const derivedMarket = deriveLeadMarket({
    city: row.city,
    state: row.state,
    market: raw.ad_market || raw.trainer_market,
    rawPayload: raw
  });
  const city = cleanLocationValue(row.city) || derivedMarket.city;
  const stateValue = cleanLocationValue(row.state) || derivedMarket.state;
  return {
    id: row.id,
    remoteId: row.id,
    first_name: row.first_name || raw.first_name || "",
    last_name: row.last_name || raw.last_name || "",
    owner: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Website Contact",
    dog: row.dog_name || raw.dog_name || "Pending",
    breed: row.dog_breed || raw.dog_breed || "Pending",
    source: row.lead_source || leadSourceLabel({ rawPayload: raw, city, state: stateValue }),
    service: row.service_interest || raw.i_want_to || "Contact Request",
    i_want_to: row.service_interest || raw.i_want_to || "",
    heard_about_us: raw.heard_about_us || row.lead_source || "",
    vet_or_previous_client: raw.vet_or_previous_client || "",
    trainerId: trainer?.id || row.trainer_slug || "unassigned",
    phone: row.phone || "",
    email: row.email || "",
    address_line_1: row.address_line_1 || raw.address_line_1 || "",
    address_line_2: row.address_line_2 || raw.address_line_2 || "",
    address: [row.address_line_1, row.address_line_2, city, stateValue, row.zip].filter(Boolean).join(", "),
    city,
    state: stateValue,
    zip: row.zip || "",
    market: derivedMarket.market,
    sourcePageSlug: derivedMarket.pageSlug,
    status: leadStatusFromDb[row.status] || normalizeLeadStatus(row.status),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || row.created_at || "",
    version: Number(row.version || 1),
    source_submission_id: row.source_submission_id || raw.submission_id || raw.source_submission_id || "",
    assignedUserId: row.assigned_user_id || "",
    next: raw.follow_up_date || "Office follow-up needed",
    followUpDate: raw.follow_up_date || "",
    clientNote,
    comments: clientNote,
    additional_interest: raw.additional_interest || "",
    note: row.office_notes || "",
    lostReason: row.lost_reason || "",
    doNotContact: row.status === "do_not_contact",
    smsConsent: row.sms_consent === true ? "Yes" : row.sms_consent === false ? "No" : "Unknown",
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
    receivedAt: row.received_at || row.created_at,
    updatedAt: row.updated_at || row.created_at,
    version: Number(row.version || 1),
    source_submission_id: row.source_submission_id || raw.submission_id || raw.source_submission_id || "",
    assignedUserId: row.assigned_user_id || "",
    inquiry_type: row.inquiry_type || raw.inquiry_type || "full_application",
    source_form: row.source_form || raw.source_form || "",
    source_page: row.source_page || raw.source_page || "",
    market: row.market || raw.market || raw.trainer_market || "",
    linked_discovery_id: row.linked_discovery_id || "",
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
    delivery_supabase: "confirmed",
    rawPayload: raw
  };
}

function remoteSubmissionToUi(row) {
  const trainer = state.trainers.find(item => item.remoteId === row.trainer_id);
  const notes = String(row.notes || "");
  const isHomepageReview = /homepage review form|Lorenzo's Dog Training Team homepage/i.test(notes);
  const isWebsiteReview = /^Website review from\s+/i.test(String(row.title || ""));
  const type = isWebsiteReview ? "Review" : ({
    photo: "Photo",
    video: "Training Video",
    review: "Review",
    testimonial: "Testimonial"
  }[row.submission_type] || "Photo");
  const reviewMarker = "\nReview: ";
  const reviewText = notes.includes(reviewMarker)
    ? notes.slice(notes.indexOf(reviewMarker) + reviewMarker.length).trim()
    : (["Review", "Testimonial"].includes(type) ? notes : "");
  const submissionMetadata = notes.includes(reviewMarker) ? notes.slice(0, notes.indexOf(reviewMarker)) : "";
  const reviewerName = String(row.title || "").replace(/^Website review from\s+/i, "").trim() || "Verified Client";
  const reviewerMatch = notes.match(/Reviewer:\s*([^\n<]+?)\s*<([^>]+)>\.?/i);
  const ratingMatch = notes.match(/Star rating:\s*([1-5])/i);
  const locationMatch = notes.match(/Client location:\s*([^\n.]+)\.?/i);
  const permissionMatch = notes.match(/Permission to share:\s*([^\n.]+)\.?/i);
  const attachedMatch = notes.match(/Attached file noted:\s*([^\n(]+?)\s*\(([^)]+)\)\.?/i);
  const videoLinkMatch = notes.match(/Attached video link:\s*(https?:\/\/\S+)/i);
  const sourceLines = submissionMetadata.split("\n").filter(line => {
    const cleanLine = line.trim();
    return cleanLine
      && !/^Review:\s*/i.test(cleanLine)
      && !/^Reviewer:\s*/i.test(cleanLine)
      && !/^Star rating:\s*/i.test(cleanLine)
      && !/^Client location:\s*/i.test(cleanLine)
      && !/^Permission to share:\s*/i.test(cleanLine)
      && !/^Attached file noted:\s*/i.test(cleanLine)
      && !/^Attached video link:\s*/i.test(cleanLine);
  });
  const storedPath = String(row.storage_path || row.file_url || "");
  const pathFileName = storedPath && !storedPath.startsWith("data:")
    ? decodeURIComponent(storedPath.split("?")[0].split("/").pop() || "")
    : "";
  const fileName = attachedMatch?.[1]?.trim() || (videoLinkMatch ? `${videoProviderLabel(storedPath)} video link` : pathFileName);
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const inferredFileType = ["mp4", "mov", "m4v", "webm"].includes(extension)
    ? `video/${extension === "mov" ? "quicktime" : extension}`
    : ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(extension)
      ? `image/${extension === "jpg" ? "jpeg" : extension}`
      : "";
  const officeNote = String(row.office_notes || "");
  const workflowMatch = officeNote.match(/\[\[review_workflow:(unpublished|deleted|archived)\]\]/i);
  const targetsMatch = officeNote.match(/\[\[review_targets:([^\]]*)\]\]/i);
  const parsedTargets = targetsMatch?.[1]
    ? targetsMatch[1].split(",").map(item => item.trim()).filter(Boolean)
    : [];
  const workflowStatus = workflowMatch
    ? workflowMatch[1][0].toUpperCase() + workflowMatch[1].slice(1).toLowerCase()
    : (row.status ? row.status[0].toUpperCase() + row.status.slice(1) : "Pending");
  const fallbackTarget = trainer?.id || (isHomepageReview ? "lorenzos-team" : "");
  const reviewTargets = targetsMatch ? parsedTargets : [fallbackTarget].filter(Boolean);
  const cleanOfficeNote = officeNote
    .replace(/\s*\[\[review_workflow:(?:unpublished|deleted|archived)\]\]\s*/ig, "")
    .replace(/\s*\[\[review_targets:[^\]]*\]\]\s*/ig, "")
    .trim();
  return {
    id: row.id,
    remoteId: row.id,
    trainerId: reviewTargets.find(target => target !== "lorenzos-team") || reviewTargets[0] || "",
    reviewTargets,
    type,
    title: row.title || `${type} submission`,
    status: workflowStatus,
    submittedAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    version: Number(row.version || 1),
    contentUrl: row.file_url || "",
    storagePath: row.storage_path || (/^(data:|blob:|https?:|\/)/i.test(storedPath) ? "" : storedPath),
    reviewerName: reviewerMatch?.[1]?.trim() || reviewerName,
    reviewerEmail: reviewerMatch?.[2]?.trim() || "",
    starRating: ratingMatch?.[1] || "5",
    reviewerLocation: locationMatch?.[1]?.trim() || "",
    permissionToShare: permissionMatch?.[1]?.trim() || "Not reported",
    reviewText,
    submissionComment: sourceLines.join("\n").trim(),
    rawNotes: notes,
    officeNote: cleanOfficeNote,
    note: cleanOfficeNote,
    fileName,
    fileType: attachedMatch?.[2]?.trim() || (videoLinkMatch ? "video/embed" : inferredFileType)
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
    notes: row.notes || "",
    updatedAt: row.updated_at || row.created_at || "",
    version: Number(row.version || 1)
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
  remoteReviewPublications = data.reviewPublications || [];
  state.submissions = (data.submissions || []).map(remoteSubmissionToUi).map(submission => {
    const publications = remoteReviewPublications.filter(item =>
      item.submission_id === submission.remoteId && ["draft", "published"].includes(String(item.status || "").toLowerCase())
    );
    if (!publications.length) return submission;
    return {
      ...submission,
      reviewTargets: reviewTargetsFromPublications(publications),
      status: publications.some(item => String(item.status || "").toLowerCase() === "published") ? "Approved" : submission.status
    };
  });
  state.clients = (data.clients || []).map(client => remoteClientToUi(client, data.dogs || []));
  remoteEvents = data.events || [];
  remotePortalUsers = data.portalUsers || [];
  remoteOfficeNotes = data.officeNotes || [];
  remoteNoteRevisions = data.noteRevisions || [];
  remoteAuditEvents = data.auditEvents || [];
  remoteLifecycleEvents = data.lifecycleEvents || [];
  remoteDeliveryAttempts = data.deliveryAttempts || [];
  remoteSheets = data.sheets || { leads: [], applications: [], clients: [] };
  remoteServerRevision = data.serverRevision || "";
  remoteSyncedAt = data.syncedAt || "";
  remoteReady = true;
  persistStateSnapshot();
}

async function prepareRemoteData(data) {
  if (!window.LDTT_PORTAL?.signedStorageUrl) return data;
  const submissions = await Promise.all((data.submissions || []).map(async row => {
    if (!row.file_url || /^(data:|blob:|https?:|\/)/i.test(row.file_url)) return row;
    try {
      return {
        ...row,
        storage_path: row.file_url,
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
  remoteSyncError = "";
}

async function refreshOperationalData(reason = "background") {
  if (!session.loggedIn || session.demoUsername || document.hidden) return;
  try {
    await reloadRemoteData();
    render();
  } catch (error) {
    remoteSyncError = error.message || "Live data unavailable";
    console.warn(`LDTT ${reason} refresh failed`, error);
    renderTopbar();
  }
}

function startOperationalSync() {
  if (operationalSyncTimer) return;
  window.addEventListener("focus", () => refreshOperationalData("focus"));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshOperationalData("visibility");
  });
  operationalRealtimeUnsubscribe = window.LDTT_PORTAL?.subscribeOperationalChanges?.(() => {
    window.clearTimeout(operationalRealtimeDebounce);
    operationalRealtimeDebounce = window.setTimeout(() => refreshOperationalData("realtime"), 450);
  }) || null;
  operationalSyncTimer = window.setInterval(() => refreshOperationalData("poll"), 30000);
}

async function hydrateSharedOperationalDataForDemo() {
  if (!window.LDTT_PORTAL?.enabled) {
    remoteReady = false;
    return false;
  }
  try {
    const data = await prepareRemoteData(await window.LDTT_PORTAL.loadOperationalData());
    if (!hasOperationalRows(data)) throw new Error("No shared operational rows were returned.");
    mergeRemoteOperationalData(data);
    return true;
  } catch (error) {
    console.warn("LDTT demo portal could not load the shared operational source.", error);
    remoteReady = false;
    return false;
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trainerDisplaySlug(trainer) {
  const current = slugify(trainer?.slug || "");
  const nameSlug = slugify(trainer?.profileName || trainer?.name || "");
  const draftLikeSlugs = new Set(["", "new-trainer", "new-trainer-draft", "newtrainerdraft", "trainer", "draft-trainer", "office-draft"]);
  if (nameSlug && !["new-trainer", "trainer"].includes(nameSlug) && (trainer?.isOfficeDraft || draftLikeSlugs.has(current) || /^office-draft-\d+$/.test(current))) {
    return nameSlug;
  }
  return current || nameSlug || `office-draft-${Date.now()}`;
}

function trainerPublicSlug(trainer) {
  return trainerDisplaySlug(trainer).replaceAll("-", "");
}

function trainerHeadshot(trainer) {
  return trainer?.cardPhoto || trainer?.profilePhoto || trainer?.publicPhoto || "/assets/lorenzo-logo-transparent.png";
}

function trainerLandingPhoto(trainer) {
  const headshots = [trainerHeadshot(trainer), trainer?.cardPhoto, trainer?.profilePhoto, trainer?.publicPhoto].filter(Boolean);
  return firstNonHeadshotPhoto([
    trainer?.landingBioPhoto,
    trainer?.bioPhoto,
    trainer?.heroTrainerPhoto,
    trainer?.photo,
    trainer?.image
  ], headshots) || "/assets/client-photo.jpg";
}

function trainerHeroPhoto(trainer) {
  return trainer?.heroTrainerPhoto || trainerLandingPhoto(trainer);
}

function trainerBioPhoto(trainer) {
  return trainer?.landingBioPhoto || trainer?.bioPhoto || trainerLandingPhoto(trainer);
}

function rosterTrainerFor(trainer) {
  return REAL_TRAINERS.find(item =>
    item.id === trainer?.id ||
    item.slug === trainer?.slug ||
    item.pageSlug === trainer?.pageSlug ||
    item.name === trainer?.name ||
    item.name === trainer?.profileName
  ) || {};
}

function repairPublicPhotoRoles(trainer) {
  if (!trainer) return trainer;
  const rosterTrainer = rosterTrainerFor(trainer);
  const headshot = trainerHeadshot(trainer);
  const cleanBioPhoto = firstNonHeadshotPhoto([
    trainer.landingBioPhoto,
    trainer.bioPhoto,
    rosterTrainer.landingBioPhoto,
    rosterTrainer.bioPhoto,
    rosterTrainer.photo,
    rosterTrainer.image,
    trainer.photo,
    trainer.image
  ], [headshot, trainer.cardPhoto, trainer.profilePhoto, trainer.publicPhoto].filter(Boolean));
  const cleanHeroPhoto = firstNonHeadshotPhoto([
    trainer.heroTrainerPhoto,
    rosterTrainer.heroTrainerPhoto,
    rosterTrainer.photo,
    rosterTrainer.image,
    trainer.photo,
    trainer.image
  ], [headshot, trainer.cardPhoto, trainer.profilePhoto, trainer.publicPhoto].filter(Boolean));
  if (cleanBioPhoto) trainer.landingBioPhoto = cleanBioPhoto;
  if (cleanHeroPhoto) trainer.heroTrainerPhoto = cleanHeroPhoto;
  return trainer;
}

function isDraftTrainer(trainer) {
  return Boolean(trainer?.isOfficeDraft) || ["No Site Started", "Draft"].includes(trainer?.pageStatus) || /^office-draft-\d+$/.test(String(trainer?.slug || ""));
}

function createOfficeTrainerDraft() {
  const id = `office-draft-${Date.now()}`;
  return {
    id,
    slug: id,
    pageSlug: id.replaceAll("-", ""),
    isOfficeDraft: true,
    name: "New Trainer Draft",
    profileName: "",
    publicName: "",
    title: "Team Trainer",
    profileTitle: "Team Trainer",
    username: "",
    temporaryPassword: TEMP_PASSWORD,
    accessStatus: "Active",
    market: "Market Pending",
    profileMarket: "",
    state: "State Pending",
    profileState: "",
    serviceArea: "Service area pending",
    profileServiceArea: "",
    phone: "(866) 436-4959",
    profilePhone: "",
    email: "",
    profileEmail: "",
    tagline: "Obedience. Behavior solutions. Real results.",
    heroHeadline: "Professional dog training for real-life results.",
    bio: "Office needs to approve this trainer bio.",
    profileBio: "",
    seoTitle: "Local Dog Trainer | Lorenzo's Dog Training Team",
    seoDescription: "Professional dog obedience training and behavior modification backed by Lorenzo's Dog Training Team.",
    layout: "mock-5",
    pageStatus: "No Site Started",
    locked: false,
    clicks: 0,
    forms: 0,
    conversions: 0,
    image: trainerLandingDogs["mock-5"],
    photo: "../assets/lorenzo-logo-transparent.png",
    heroTrainerPhoto: "../assets/lorenzo-logo-transparent.png",
    landingBioPhoto: "../assets/lorenzo-logo-transparent.png",
    heroPhotoPosition: "center top",
    bioPhotoPosition: "center top",
    profilePhoto: "",
    cardPhoto: "../assets/lorenzo-logo-transparent.png",
    companyLogo: "../assets/lorenzo-logo-transparent.png",
    specialties: ["Obedience Training", "Behavior Modification"],
    profileSpecialtiesText: "Obedience Training\nBehavior Modification",
    credentials: ["Lorenzo's Certified Dog Trainer", "Powered by Lorenzo's Dog Training Team"],
    profileCredentialsText: "Lorenzo's Certified Dog Trainer\nPowered by Lorenzo's Dog Training Team",
    review1Author: "Client Name",
    review1Copy: "Office-approved client testimonial.",
    review2Author: "Client Name",
    review2Copy: "Office-approved client testimonial.",
    review3Author: "Client Name",
    review3Copy: "Office-approved client testimonial.",
    socials: { facebook: "", instagram: "", tiktok: "" }
  };
}

function refreshDraftTrainerIdentity(trainer, changedKey = "") {
  if (!trainer) return;
  const displayName = String(trainer.profileName || trainer.name || "").trim();
  if (displayName && displayName !== "New Trainer Draft" && displayName !== "New Trainer") {
    trainer.name = displayName;
    if (isDraftTrainer(trainer) || changedKey === "name" || changedKey === "profileName") {
      trainer.slug = trainerDisplaySlug(trainer);
      trainer.pageSlug = trainerPublicSlug(trainer);
    }
  }
}

function trainerDraftContent(trainer) {
  return {
    trainer_name: trainer.name,
    title: trainer.title,
    market: trainer.market,
    service_area: trainer.serviceArea,
    bio: trainer.bio,
    headshot_url: trainerHeadshot(trainer),
    hero_trainer_photo_url: trainerHeroPhoto(trainer),
    landing_bio_photo_url: trainerBioPhoto(trainer),
    hero_image_url: trainer.image,
    hero_photo_position: trainer.heroPhotoPosition || "center top",
    hero_photo_fit: trainer.heroPhotoFit || "cover",
    hero_photo_scale: trainer.heroPhotoScale || 100,
    hero_photo_frame: trainer.heroPhotoFrame || "standard",
    bio_photo_position: trainer.bioPhotoPosition || "center center",
    bio_photo_fit: trainer.bioPhotoFit || "cover",
    bio_photo_scale: trainer.bioPhotoScale || 100,
    bio_photo_frame: trainer.bioPhotoFrame || "tight",
    seo_title: trainer.seoTitle,
    seo_description: trainer.seoDescription,
    review1_author: trainer.review1Author,
    review1_copy: trainer.review1Copy,
	    review2_author: trainer.review2Author,
	    review2_copy: trainer.review2Copy,
	    review3_author: trainer.review3Author,
	    review3_copy: trainer.review3Copy,
	    approved_reviews: Array.isArray(trainer.approvedReviews) ? trainer.approvedReviews : [],
	    live_edits: Array.isArray(trainer.liveEdits) ? trainer.liveEdits : [],
	    media_library: Array.isArray(trainer.mediaLibrary) ? trainer.mediaLibrary : [],
	    hidden_sections: Array.isArray(trainer.hiddenSections) ? trainer.hiddenSections : []
	  };
	}

function trainerPagePayload(trainer) {
  const slug = trainerDisplaySlug(trainer);
  const published = trainer.pageStatus === "Published" && trainer.locked;
  return {
    trainer_id: trainer.remoteId,
    slug,
    template_key: templateToDb(trainer.layout),
    page_status: published ? "published" : "draft",
    locked: published,
    headline: trainer.heroHeadline || approvedLayouts.find(item => item.id === trainer.layout)?.headline || "",
    subheadline: trainer.tagline || "",
    approved_bio: trainer.bio || "",
    approved_photo_urls: [trainerHeroPhoto(trainer), trainerBioPhoto(trainer), trainerHeadshot(trainer)].filter(Boolean),
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
    revision: Number(trainer.revision || 1) + 1,
    public_url: new URL(trainerPageHref(trainer), window.location.origin).href
  };
}

async function persistTrainerRecord(trainer, options = {}) {
  if (!remoteReady || session.role !== "admin") return trainer;
  trainer.title ||= "Team Trainer";
  const normalizedLocation = normalizeTrainerLocation(trainer.profileMarket || trainer.market, trainer.profileState || trainer.state);
  trainer.market = normalizedLocation.market;
  trainer.state = normalizedLocation.state;
  trainer.profileMarket = normalizedLocation.market;
  trainer.profileState = normalizedLocation.state;
  const slug = trainerDisplaySlug(trainer);
  trainer.slug = slug;
  trainer.pageSlug = trainerPublicSlug(trainer);
  if (trainer.profileName) trainer.name = trainer.profileName;
  const trainerPayload = {
    slug,
    full_name: trainer.profileName || trainer.name,
    email: trainer.profileEmail || trainer.email || null,
    phone: trainer.profilePhone || trainer.phone || null,
    market: normalizedLocation.market || null,
    service_area: trainer.profileServiceArea || trainer.serviceArea || null,
    state: normalizedLocation.state || null,
    bio: trainer.profileBio || null,
    headshot_url: trainerHeadshot(trainer) || null,
    status: "active",
    access_status: trainer.accessStatus === "Disabled" ? "disabled" : "active",
    credentials: String(trainer.profileCredentialsText || "").split(/\n|,/).map(value => value.trim()).filter(Boolean),
    specialties: String(trainer.profileSpecialtiesText || "").split(/\n|,/).map(value => value.trim()).filter(Boolean),
    social_links: trainer.socials || {}
  };
  const persistProfile = options.skipProfile !== true && (options.persistProfile !== false || !trainer.remoteId);
  if (trainer.remoteId && persistProfile) {
    const result = await window.LDTT_PORTAL.operationalMutation({
      operation: "update",
      entity_type: "trainer",
      id: trainer.remoteId,
      expected_version: trainer.version,
      expected_updated_at: trainer.updatedAt,
      action: "trainer_profile_updated",
      summary: `${trainer.name} profile saved`,
      changes: trainerPayload
    });
    trainer.version = Number(result.version || trainer.version || 1);
    trainer.updatedAt = result.updated_at || trainer.updatedAt;
  } else if (!trainer.remoteId) {
    const result = await window.LDTT_PORTAL.operationalMutation({
      operation: "create",
      entity_type: "trainer",
      action: "trainer_created",
      summary: `${trainerPayload.full_name || "Trainer"} profile created`,
      changes: trainerPayload
    });
    const savedTrainer = result.record;
    if (!savedTrainer?.id) throw new Error("Trainer record could not be created");
    const previousId = trainer.id;
    trainer.remoteId = savedTrainer.id;
    trainer.id = savedTrainer.id;
    if (state.selectedTrainerId === previousId) state.selectedTrainerId = savedTrainer.id;
    trainer.slug = savedTrainer.slug;
    trainer.pageSlug = trainerPublicSlug(trainer);
  }
  if (!options.profileOnly) {
    const pagePayload = trainerPagePayload(trainer);
    if (trainer.pageId) {
      const result = await window.LDTT_PORTAL.operationalMutation({
        operation: "update",
        entity_type: "trainer_page",
        id: trainer.pageId,
        expected_updated_at: trainer.pageUpdatedAt,
        action: options.publish ? "trainer_page_published" : "trainer_page_draft_saved",
        summary: `${trainer.name} ${options.publish ? "page published" : "page draft saved"}`,
        changes: pagePayload
      });
      trainer.pageUpdatedAt = result.updated_at || trainer.pageUpdatedAt;
    } else {
      const result = await window.LDTT_PORTAL.operationalMutation({
        operation: "create",
        entity_type: "trainer_page",
        action: "trainer_page_created",
        summary: `${trainer.name} page draft created`,
        changes: pagePayload
      });
      trainer.pageId = result.record?.id || trainer.pageId;
    }
    if (options.publish) {
      await window.LDTT_PORTAL.rpc("publish_trainer_page", { target_page_id: trainer.pageId });
    }
  }
  await reloadRemoteData();
  return findTrainer(trainer.remoteId) || trainer;
}

async function ensureTrainerPortalAccount(trainer) {
  if (!remoteReady || session.role !== "admin" || !trainer?.remoteId) return { skipped: true, reason: "Trainer profile is not saved yet." };
  const email = String(trainer.profileEmail || trainer.email || trainer.username || "").trim().toLowerCase();
  if (!email) return { skipped: true, reason: "Add the trainer email before sending portal login instructions." };
  const currentSession = window.LDTT_PORTAL?.readSession?.();
  const response = await fetch("/api/ensure-trainer-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentSession?.access_token || ""}`
    },
    body: JSON.stringify({
      trainer_id: trainer.remoteId,
      email,
      display_name: trainer.profileName || trainer.name || email
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.message || "Trainer portal account could not be activated.");
  }
  trainer.accessStatus = "Active";
  trainer.email = email;
  trainer.username = email;
  trainer.temporaryPassword = TRAINER_TEMP_PASSWORD_NOTICE;
  trainer.portalInviteStatus = result.created ? "New trainer login created" : "Existing trainer login enabled";
  return result;
}

async function publishTrainerPageWorkflow(trainer, publish) {
  const savedTrainer = await persistTrainerRecord(trainer, { publish });
  if (publish) {
    await ensureTrainerPortalAccount(savedTrainer || trainer);
    const published = await window.LDTT_PORTAL.loadPublishedTrainer((savedTrainer || trainer).slug, { includeDraft: false });
    if (!published?.page?.published_content || Number(published.page.published_revision || 0) < 1) {
      throw new Error("The public trainer revision could not be confirmed after publishing.");
    }
    const publicUrl = new URL(trainerPageHref(savedTrainer || trainer), window.location.origin);
    const response = await fetch(publicUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`The published trainer URL returned ${response.status}.`);
    const shell = await response.text();
    if (!shell.includes("/trainer-backoffice/app.js")) throw new Error("The published trainer URL did not load the current trainer-page application shell.");
    const bioResponse = await fetch(new URL(trainerBioHref(savedTrainer || trainer), window.location.origin), { method: "HEAD", cache: "no-store" });
    if (!bioResponse.ok) throw new Error(`The published trainer bio returned ${bioResponse.status}.`);
  }
  return savedTrainer || trainer;
}

async function persistPublicTrainerField(trainer, profileKey) {
  if (!remoteReady || session.role !== "admin" || !trainer?.remoteId) return;
  const fieldMap = {
    profileName: ["full_name", trainer.profileName],
    profileMarket: ["market", trainer.profileMarket || null],
    profileState: ["state", trainer.profileState || null],
    profileServiceArea: ["service_area", trainer.profileServiceArea || null],
    profilePhone: ["phone", trainer.profilePhone || null],
    profileEmail: ["email", trainer.profileEmail || null],
    profileBio: ["bio", trainer.profileBio || null],
    profilePhoto: ["headshot_url", trainerHeadshot(trainer) || null],
    profileSpecialtiesText: ["specialties", String(trainer.profileSpecialtiesText || "").split(/\n|,/).map(value => value.trim()).filter(Boolean)],
    profileCredentialsText: ["credentials", String(trainer.profileCredentialsText || "").split(/\n|,/).map(value => value.trim()).filter(Boolean)]
  };
  const target = fieldMap[profileKey];
  if (!target) throw new Error("This profile field is not connected to the public trainer record");
  await window.LDTT_PORTAL.update("trainers", trainer.remoteId, { [target[0]]: target[1] });
}

async function persistLeadRecord(lead) {
  if (!remoteReady || session.role !== "admin" || !lead?.remoteId) return;
  const result = await window.LDTT_PORTAL.operationalMutation({
    operation: "update",
    entity_type: "lead",
    id: lead.remoteId,
    action: "lead_updated",
    summary: `${lead.owner || "Lead"} saved as ${lead.status || "New Inquiry"}`,
    changes: {
      status: leadStatusToDb[lead.status] || "new_inquiry",
      lost_reason: lead.lostReason || null,
      assigned_user_id: lead.assignedUserId || null,
      office_notes: lead.note || null,
      raw_payload: {
        ...(lead.rawPayload || {}),
        follow_up_date: lead.followUpDate || null
      }
    }
  });
  lead.version = Number(result.version || lead.version || 1);
  lead.updatedAt = result.updated_at || lead.updatedAt;
  return result.record;
}

async function persistLeadWorkflow(lead) {
  await persistLeadRecord(lead);
  // The database conversion trigger creates or updates the related client and
  // dog atomically. Avoid a second browser insert that could race the trigger.
}

function portalUserById(userId) {
  if (!userId) return null;
  if (portalUser?.user_id && String(portalUser.user_id) === String(userId)) return portalUser;
  return remotePortalUsers.find(item => String(item.user_id) === String(userId)) || null;
}

function officeNotesFor(entityType, entityId) {
  if (!entityId) return [];
  return remoteOfficeNotes
    .filter(note => note.entity_type === entityType && note.entity_id === entityId)
    .sort((a, b) => timestampValue(a.created_at) - timestampValue(b.created_at));
}

function latestOfficeNote(entityType, entityId) {
  return officeNotesFor(entityType, entityId).at(-1) || null;
}

function hasSharedRecordId(value) {
  const id = String(value || "").trim();
  return Boolean(id && id !== "undefined" && id !== "null");
}

async function saveEditableOfficeNote(entityType, entityId, noteId, note) {
  if (!remoteReady || session.role !== "admin" || !hasSharedRecordId(entityId) || !noteId || !String(note || "").trim()) return null;
  const existing = officeNotesFor(entityType, entityId).find(item => item.id === noteId);
  if (!existing) throw new Error("That note changed or is no longer available. Reload the record and try again.");
  const result = await window.LDTT_PORTAL.operationalMutation({
    operation: "save_note",
    entity_type: entityType,
    entity_id: entityId,
    note_id: existing.id,
    note: String(note).trim()
  });
  await reloadRemoteData();
  return result.record || null;
}

function officeNoteTimeline(entityType, entityId) {
  const notes = officeNotesFor(entityType, entityId);
  if (!notes.length) return `<p class="panel-copy">No office notes have been added yet.</p>`;
  return `<div class="office-note-timeline">${notes.map(note => {
    const revisions = remoteNoteRevisions
      .filter(revision => revision.office_note_id === note.id)
      .sort((a, b) => timestampValue(b.created_at) - timestampValue(a.created_at));
    return `<article><div class="office-note-heading"><div><strong>${escapeHtml(portalActorLabel(note.created_by))}</strong><time>${escapeHtml(formatDateTime(note.updated_at || note.created_at))}${note.updated_at && note.updated_at !== note.created_at ? " · edited" : ""}</time></div><button class="btn btn-outline btn-small" type="button" data-toggle-note-edit="${escapeHtml(note.id)}">Edit</button></div><p>${escapeHtml(note.note)}</p><div class="office-note-editor" data-note-editor="${escapeHtml(note.id)}" hidden><textarea data-office-note-edit="${escapeHtml(note.id)}">${escapeHtml(note.note)}</textarea><button class="btn btn-red btn-small" type="button" data-save-office-note-edit="${escapeHtml(note.id)}" data-entity-type="${escapeHtml(entityType)}" data-entity-id="${escapeHtml(entityId)}">Save Note Edit</button></div>${revisions.length ? `<details class="office-note-history"><summary>View edit history (${revisions.length})</summary>${revisions.map(revision => `<div><strong>${escapeHtml(portalActorLabel(revision.edited_by))}</strong><time>${escapeHtml(formatDateTime(revision.created_at))}</time><p>${escapeHtml(revision.previous_note || "")}</p></div>`).join("")}</details>` : ""}</article>`;
  }).join("")}</div>`;
}

async function addOfficeNote(entityType, entityId, note) {
  if (!remoteReady || session.role !== "admin" || !hasSharedRecordId(entityId) || !note.trim()) return null;
  const result = await window.LDTT_PORTAL.operationalMutation({
    operation: "save_note",
    entity_type: entityType,
    entity_id: entityId,
    note: note.trim()
  });
  await reloadRemoteData();
  return result.record || null;
}

function officeNoteEntityLabel(entityType, entityId) {
  if (entityType === "lead") {
    const lead = allLeadRows().find(item => String(item.remoteId || "") === String(entityId));
    return lead?.owner ? `lead for ${lead.owner}` : "lead record";
  }
  if (entityType === "application") {
    const application = applicationRows().find(item => String(item.remoteId || "") === String(entityId));
    const name = application ? `${application.first_name || ""} ${application.last_name || ""}`.trim() : "";
    return name ? `application for ${name}` : "application record";
  }
  if (entityType === "client") {
    const client = state.clients.find(item => String(item.remoteId || "") === String(entityId));
    return client?.name ? `client record for ${client.name}` : "client record";
  }
  return `${entityType || "office"} record`;
}

async function persistApplicationRecord(application) {
  if (!remoteReady || session.role !== "admin" || !application?.remoteId) return;
  const result = await window.LDTT_PORTAL.operationalMutation({
    operation: "update",
    entity_type: "application",
    id: application.remoteId,
    action: "application_updated",
    summary: `${applicationDisplayName(application)} saved as ${application.status || "New Application"}`,
    changes: {
      status: applicationStatusToDb[application.status] || "new_application",
      assigned_user_id: application.assignedUserId || null,
      office_notes: application.note || null
    }
  });
  application.version = Number(result.version || application.version || 1);
  application.updatedAt = result.updated_at || application.updatedAt;
  return result.record;
}

async function persistSubmissionRecord(submission) {
  if (!remoteReady || session.role !== "admin" || !submission?.remoteId) return;
  const requestedStatus = String(submission.status || "Pending");
  const statusMap = {
    Pending: "pending",
    Approved: "approved",
    Declined: "declined",
    Archived: "archived",
    Unpublished: "archived",
    Deleted: "archived"
  };
  const cleanNote = String(submission.note || submission.officeNote || "")
    .replace(/\s*\[\[review_workflow:(?:unpublished|deleted|archived)\]\]\s*/ig, "")
    .replace(/\s*\[\[review_targets:[^\]]*\]\]\s*/ig, "")
    .trim();
  const result = await window.LDTT_PORTAL.operationalMutation({
    operation: "update",
    entity_type: "submission",
    id: submission.remoteId,
    action: "submission_updated",
    summary: `${submission.title || "Content submission"} saved as ${requestedStatus}`,
    changes: {
      status: statusMap[requestedStatus] || "pending",
      office_notes: cleanNote || null
    }
  });
  submission.version = Number(result.version || submission.version || 1);
  submission.updatedAt = result.updated_at || submission.updatedAt;
  return result.record;
}

const cityReviewDestinations = [
  ["ann-arbor-mi", "Ann Arbor, MI"],
  ["atlanta-ga", "Atlanta, GA"],
  ["chicago-il", "Chicago, IL"],
  ["cleveland-oh", "Cleveland, OH"],
  ["columbus-oh", "Columbus, OH"],
  ["lexington-ky", "Lexington, KY"],
  ["miramar-beach-fl", "Miramar Beach, FL"],
  ["san-antonio-tx", "San Antonio, TX"],
  ["san-diego-ca", "San Diego, CA"],
  ["tallahassee-fl", "Tallahassee, FL"]
];

function defaultReviewDisplayOptions(submission = {}) {
  return {
    showText: true,
    showMedia: Boolean(submission.contentUrl),
    showAuthor: true,
    showRating: true,
    showLocation: Boolean(submission.reviewerLocation)
  };
}

function reviewTargetsFor(submission = {}, options = {}) {
  const explicitTargets = Array.isArray(submission.reviewTargets);
  const targets = explicitTargets
    ? submission.reviewTargets
    : [submission.trainerId || "lorenzos-team"];
  const cleaned = Array.from(new Set(targets.filter(Boolean).map(target => target || "lorenzos-team")));
  if (!cleaned.length && !options.allowEmpty) return ["lorenzos-team"];
  return cleaned;
}

function setReviewTargets(submission, targets = [], options = {}) {
  if (!submission) return [];
  const cleaned = Array.from(new Set(targets.filter(Boolean)));
  submission.reviewTargets = cleaned.length || options.allowEmpty ? cleaned : ["lorenzos-team"];
  submission.trainerId = submission.reviewTargets.find(target => target !== "lorenzos-team") || submission.reviewTargets[0] || "";
  submission.reviewDisplay = reviewDisplayOptionsFor(submission);
  return submission.reviewTargets;
}

function reviewTargetLabel(target) {
  if (target === "lorenzos-team") return "Homepage / Main Website";
  if (String(target).startsWith("city:")) {
    const slug = String(target).slice(5);
    return `${cityReviewDestinations.find(item => item[0] === slug)?.[1] || slug} opportunity page`;
  }
  return trainerName(target);
}

function reviewPublicationDestinations(submission, options = {}) {
  return reviewTargetsFor(submission, options).map(target => {
    if (target === "lorenzos-team") return { destination_type: "homepage", destination_id: "lorenzos-team" };
    if (String(target).startsWith("city:")) return { destination_type: "city_page", destination_id: String(target).slice(5) };
    return { destination_type: "trainer_page", destination_id: target };
  });
}

function reviewDestinationForTarget(target) {
  if (target === "lorenzos-team") return { destination_type: "homepage", destination_id: "lorenzos-team" };
  if (String(target).startsWith("city:")) return { destination_type: "city_page", destination_id: String(target).slice(5) };
  return { destination_type: "trainer_page", destination_id: target };
}

function reviewPublicationForTarget(submission = {}, target = "") {
  if (!submission?.remoteId || !target) return null;
  const destination = reviewDestinationForTarget(target);
  return (remoteReviewPublications || []).find(item =>
    item.submission_id === submission.remoteId
    && item.destination_type === destination.destination_type
    && item.destination_id === destination.destination_id
    && ["draft", "published"].includes(String(item.status || "").toLowerCase())
  ) || null;
}

function reviewTargetsFromPublications(publications = []) {
  return (publications || [])
    .filter(item => ["draft", "published"].includes(String(item.status || "").toLowerCase()))
    .sort((a, b) => timestampValue(b.published_at || b.updated_at) - timestampValue(a.published_at || a.updated_at))
    .map(item => item.destination_type === "homepage"
      ? "lorenzos-team"
      : item.destination_type === "city_page" ? `city:${item.destination_id}` : item.destination_id);
}

function reviewDestinationStatusLabel(submission = {}, target = "") {
  const publication = reviewPublicationForTarget(submission, target);
  const status = String(publication?.status || "").toLowerCase();
  if (status === "published") return "Published live";
  if (status === "draft") return "Saved for publish";
  return submission.status === "Approved" ? "Publishing pending" : "Selected";
}

function reviewTargetLabels(submission) {
  const targets = reviewTargetsFor(submission, { allowEmpty: true });
  return targets.length ? targets.map(reviewTargetLabel).join(", ") : "No destinations selected";
}

function reviewTargetLabelList(submission) {
  return reviewTargetsFor(submission, { allowEmpty: true }).map(reviewTargetLabel);
}

function pendingReviewTargetSelection(submission = {}) {
  if (!submission?.id || typeof document === "undefined") return "";
  const select = document.querySelector(`[data-review-target-select="${CSS.escape(submission.id)}"]`);
  return select?.value || "";
}

function applyPendingReviewTargetSelection(submission = {}) {
  const target = pendingReviewTargetSelection(submission);
  if (!target) return false;
  const currentTargets = reviewTargetsFor(submission, { allowEmpty: true });
  if (currentTargets.includes(target)) return false;
  setReviewTargets(submission, [...currentTargets, target]);
  return true;
}

function publishedReviewForSubmission(submission) {
  if (!submission?.remoteId) return null;
  for (const trainer of state.trainers || []) {
    const review = (trainer.approvedReviews || []).find(item => item.submission_id === submission.remoteId);
    if (review) return review;
  }
  return null;
}

function reviewDisplayOptionsFor(submission = {}) {
  return {
    ...defaultReviewDisplayOptions(submission),
    ...(publishedReviewForSubmission(submission)?.display || {}),
    ...(submission.reviewDisplay || {})
  };
}

function cleanReviewOfficeNoteText(submission = {}) {
  return String(submission.officeNote || submission.note || "")
    .replace(/\s*\[\[review_workflow:(?:unpublished|deleted|archived)\]\]\s*/ig, "")
    .replace(/\s*\[\[review_targets:[^\]]*\]\]\s*/ig, "")
    .trim();
}

function reviewOfficeNotePayload(submission = {}, workflowStatus = "") {
  const markers = [];
  const workflow = String(workflowStatus || "").trim().toLowerCase();
  if (["unpublished", "deleted", "archived"].includes(workflow)) {
    markers.push(`[[review_workflow:${workflow}]]`);
  }
  const targets = Array.isArray(submission.reviewTargets)
    ? reviewTargetsFor(submission, { allowEmpty: true })
    : reviewTargetsFor(submission);
  if (targets.length || Array.isArray(submission.reviewTargets)) markers.push(`[[review_targets:${targets.join(",")}]]`);
  return [cleanReviewOfficeNoteText(submission), ...markers].filter(Boolean).join("\n");
}

function approvedReviewFromSubmission(submission) {
  return {
    submission_id: submission.remoteId,
    author: submission.reviewerName || "Verified Client",
    rating: submission.starRating || "5",
    copy: submission.reviewText || submission.note || "",
    location: submission.reviewerLocation || "",
    media_url: submission.storagePath || submission.contentUrl || "",
    media_type: submission.fileType || "",
    media_name: submission.fileName || "",
    display: reviewDisplayOptionsFor(submission),
    published_at: new Date().toISOString()
  };
}

function reviewKeyFor(review, index = 0) {
  return String(review?.submission_id || review?.id || `review-${index}`);
}

function submissionForApprovedReview(review = {}) {
  return (state.submissions || []).find(submission =>
    String(submission.remoteId || submission.id || "") === String(review.submission_id || review.id || "")
  );
}

function trainerApprovedReviewManagerMarkup(trainer, options = {}) {
  const reviews = Array.isArray(trainer?.approvedReviews) ? trainer.approvedReviews : [];
  const compactClass = options.compact ? " compact" : "";
  const rows = reviews.map((review, index) => {
    const submission = submissionForApprovedReview(review);
    const key = reviewKeyFor(review, index);
    const copy = String(review.copy || submission?.reviewText || "").trim();
    const title = submission?.title || `${review.author || "Approved client"} review`;
    const destinations = submission ? reviewTargetLabels(submission) : `${trainer.name} landing page`;
    const mediaLabel = review.media_url || submission?.contentUrl ? "Media attached" : "Text only";
    return `<article class="trainer-approved-review-row" data-review-placement="${escapeHtml(key)}">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(review.author || submission?.reviewerName || "Verified Client")}${review.location || submission?.reviewerLocation ? ` · ${escapeHtml(review.location || submission?.reviewerLocation)}` : ""}</span>
        <p>${escapeHtml(copy || "Approved media review from a Lorenzo client.")}</p>
        <small>Saved destinations: ${escapeHtml(destinations)} · ${escapeHtml(mediaLabel)}</small>
      </div>
      <div class="review-placement-actions">
        <button class="btn btn-outline btn-small" type="button" data-trainer-review-move="${escapeHtml(trainer.id)}" data-review-key="${escapeHtml(key)}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Up</button>
        <button class="btn btn-outline btn-small" type="button" data-trainer-review-move="${escapeHtml(trainer.id)}" data-review-key="${escapeHtml(key)}" data-direction="1" ${index === reviews.length - 1 ? "disabled" : ""}>Down</button>
        <button class="btn btn-outline btn-small btn-danger" type="button" data-trainer-review-remove="${escapeHtml(trainer.id)}" data-review-key="${escapeHtml(key)}">Remove From Trainer</button>
      </div>
    </article>`;
  }).join("");
  return `<section class="trainer-approved-review-manager${compactClass}">
    <div class="trainer-approved-review-head">
      <div><span class="step-label">Approved review placements</span><h3>Reviews attached to ${escapeHtml(trainer?.name || "this trainer")}</h3></div>
      <strong>${reviews.length}</strong>
    </div>
    ${rows || `<div class="empty-state compact"><strong>No approved reviews attached yet.</strong><p>When a review is published to this trainer, it will appear here and on the trainer landing-page review section.</p></div>`}
  </section>`;
}

async function saveReviewDestinations(submission, published = false, options = {}) {
  if (!submission?.remoteId || !["Review", "Testimonial"].includes(submission.type)) return null;
  const result = await window.LDTT_PORTAL.operationalMutation({
    operation: "set_review_publications",
    submission_id: submission.remoteId,
    destinations: reviewPublicationDestinations(submission, { allowEmpty: options.allowEmpty }),
    published,
    workflow_status: published ? "approved" : String(submission.status || "pending").toLowerCase(),
    office_note: reviewOfficeNotePayload(submission, published ? "" : submission.status),
    summary: `${submission.title || "Review"} destinations saved: ${reviewTargetLabels(submission)}`
  });
  if (Array.isArray(result.publications)) {
    remoteReviewPublications = [
      ...remoteReviewPublications.filter(item => item.submission_id !== submission.remoteId),
      ...result.publications
    ];
    const savedTargets = reviewTargetsFromPublications(result.publications);
    setReviewTargets(submission, savedTargets, { allowEmpty: true });
  }
  submission.version = Number(result.version || submission.version || 1);
  submission.updatedAt = result.updated_at || submission.updatedAt;
  if (published) submission.status = "Approved";
  return result;
}

async function publishApprovedReview(submission) {
  if (!submission?.remoteId || !["Review", "Testimonial"].includes(submission.type)) {
    if (submission) {
      submission.status = "Approved";
      await persistSubmissionRecord(submission);
    }
    return;
  }
  const targets = reviewTargetsFor(submission, { allowEmpty: true });
  if (!targets.length) {
    await unpublishApprovedReview(submission, "Unpublished");
    return;
  }
  const publishedReview = approvedReviewFromSubmission(submission);
  const trainerTargets = targets.filter(target => target !== "lorenzos-team" && !String(target).startsWith("city:"));
  for (const trainer of state.trainers || []) {
    if (!trainerTargets.includes(trainer.id) && (trainer.approvedReviews || []).some(review => review.submission_id === submission.remoteId)) {
      trainer.approvedReviews = (trainer.approvedReviews || []).filter(review => review.submission_id !== submission.remoteId);
      await persistTrainerRecord(trainer, { publish: true });
    }
  }
  for (const target of trainerTargets) {
    const trainer = state.trainers.find(item => item.id === target);
    if (!trainer?.pageId) throw new Error(`${trainerName(target)} does not have a published landing page yet`);
    trainer.approvedReviews = [
      ...(trainer.approvedReviews || []).filter(review => review.submission_id !== submission.remoteId),
      publishedReview
    ];
  }
  submission.status = "Approved";
  await saveReviewDestinations(submission, true);
  for (const target of trainerTargets) {
    const trainer = state.trainers.find(item => item.id === target);
    if (trainer) await persistTrainerRecord(trainer, { publish: true });
  }
}

async function deletePublishedReview(submission) {
  await unpublishApprovedReview(submission, "Deleted");
}

async function unpublishApprovedReview(submission, status = "Unpublished") {
  if (!submission?.remoteId) return;
  const trainers = (state.trainers || []).filter(trainer =>
    (trainer.approvedReviews || []).some(review => review.submission_id === submission.remoteId)
  );
  for (const trainer of trainers) {
    trainer.approvedReviews = (trainer.approvedReviews || []).filter(review => review.submission_id !== submission.remoteId);
    await persistTrainerRecord(trainer, { publish: true });
  }
  submission.status = status;
  const result = await window.LDTT_PORTAL.operationalMutation({
    operation: "set_review_publications",
    submission_id: submission.remoteId,
    destinations: [],
    published: false,
    workflow_status: status === "Archived" || status === "Deleted" ? "archived" : "pending",
    office_note: reviewOfficeNotePayload(submission, status),
    summary: `${submission.title || "Review"} ${status.toLowerCase()}`
  });
  submission.version = Number(result.version || submission.version || 1);
  submission.updatedAt = result.updated_at || submission.updatedAt;
}

async function persistTrainerAccess(trainer) {
  if (!remoteReady || session.role !== "admin") return;
  await persistTrainerRecord(trainer, { profileOnly: true });
  if (trainer.remoteId) {
    const enabled = trainer.accessStatus !== "Disabled";
    await window.LDTT_PORTAL.updateBy("portal_users", "trainer_id", trainer.remoteId, {
      active: enabled,
      access_status: enabled ? "active" : "disabled",
      disabled_at: enabled ? null : new Date().toISOString(),
      disabled_by: enabled ? null : currentPortalUserId() || null
    });
  }
  await reloadRemoteData();
}

function portalUserHasAccess(user) {
  return Boolean(user?.active !== false && !["disabled", "revoked"].includes(String(user?.access_status || "active").toLowerCase()));
}

function normalizePortalName(value) {
  return String(value || "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function staffForPortalUser(user) {
  const email = String(user?.email || user?.login_email || "").trim().toLowerCase();
  if (email) {
    const emailMatch = PORTAL_STAFF_DIRECTORY.find(staff => staff.email === email);
    if (emailMatch) return emailMatch;
  }
  const displayName = normalizePortalName(user?.display_name);
  if (!displayName) return null;
  return PORTAL_STAFF_DIRECTORY.find(staff => {
    const staffName = normalizePortalName(staff.name);
    return displayName === staffName || displayName.includes(staffName) || staffName.includes(displayName);
  }) || null;
}

function portalUserEmail(user) {
  const trainer = trainerForPortalUser(user);
  const ownUser = window.LDTT_PORTAL?.currentAuthUser?.();
  if (ownUser?.id && ownUser.id === user?.user_id) return String(ownUser.email || "").toLowerCase();
  const staff = staffForPortalUser(user);
  return String(user?.email || user?.login_email || staff?.email || trainer?.profileEmail || trainer?.email || "").trim().toLowerCase();
}

function portalPermissionValue(user) {
  if (user?.role === "trainer") return "trainer";
  if (user?.permission_level) return user.permission_level;
  const staff = staffForPortalUser(user);
  if (staff?.permission) return staff.permission;
  return OFFICE_ADMIN_EMAILS.has(portalUserEmail(user)) ? "office_admin" : "super_admin";
}

function portalPermissionLabel(user) {
  const value = typeof user === "string" ? user : portalPermissionValue(user);
  return {
    super_admin: "Super Admin",
    office_admin: "Office Admin",
    trainer: "Trainer"
  }[value] || "Super Admin";
}

function isSuperAdmin() {
  return session.role === "admin" && !isOfficeAdmin();
}

function permanentDeleteButton(entityType, record) {
  if (!isSuperAdmin() || !record?.remoteId || record.status !== "Archived") return "";
  return `<button class="btn btn-outline btn-danger" type="button" data-permanent-delete="${escapeHtml(entityType)}" data-record-id="${escapeHtml(record.remoteId)}" data-record-label="${escapeHtml(entityType === "application" ? applicationDisplayName(record) : record.owner || record.name || "record")}">Permanently Delete QA / Duplicate</button>`;
}

function trainerForPortalUser(user) {
  if (!user?.trainer_id) return null;
  return state.trainers.find(trainer => trainer.remoteId === user.trainer_id || trainer.id === user.trainer_id) || null;
}

function portalUserAvatarUrl(user) {
  const trainer = trainerForPortalUser(user);
  return user?.profile_photo_url || user?.avatar_url || trainerHeadshot(trainer) || "";
}

function avatarMarkup(user, fallback = "LO") {
  const image = portalUserAvatarUrl(user);
  return image
    ? `<span class="avatar"><img src="${escapeHtml(image)}" alt=""></span>`
    : `<span class="avatar">${escapeHtml(fallback)}</span>`;
}

const GENERIC_PORTAL_NAMES = new Set(["", "portal user", "office admin", "admin", "trainer", "lorenzo's office"]);

function portalRawDisplayName(user) {
  return String(user?.display_name || "").replace(/\([^)]*\)/g, "").trim();
}

function portalDisplayNameIsGeneric(value) {
  return GENERIC_PORTAL_NAMES.has(normalizePortalName(value));
}

function portalNamePartsFromValue(value) {
  const parts = String(value || "").replace(/\([^)]*\)/g, "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

function portalSuggestedNameParts(user) {
  if (user?.first_name || user?.last_name) {
    return { firstName: String(user.first_name || "").trim(), lastName: String(user.last_name || "").trim() };
  }
  const raw = portalRawDisplayName(user);
  const source = !portalDisplayNameIsGeneric(raw)
    ? raw
    : staffForPortalUser(user)?.name || trainerForPortalUser(user)?.profileName || trainerForPortalUser(user)?.name || "";
  return portalNamePartsFromValue(source);
}

function portalProfileNameIsComplete(user) {
  if (String(user?.first_name || "").trim() && String(user?.last_name || "").trim()) return true;
  const raw = portalRawDisplayName(user);
  const source = portalDisplayNameIsGeneric(raw)
    ? staffForPortalUser(user)?.name || trainerForPortalUser(user)?.profileName || trainerForPortalUser(user)?.name || ""
    : raw;
  const { firstName, lastName } = portalNamePartsFromValue(source);
  return Boolean(firstName && lastName);
}

function portalProfileNeedsCompletion() {
  return Boolean(session.loggedIn && portalUser && !portalUser.must_change_password && !portalProfileNameIsComplete(portalUser));
}

function portalDisplayName(user) {
  const trainer = trainerForPortalUser(user);
  const raw = portalRawDisplayName(user);
  const savedName = [user?.first_name, user?.last_name].map(value => String(value || "").trim()).filter(Boolean).join(" ");
  return (savedName && !portalDisplayNameIsGeneric(savedName) ? savedName : "")
    || (!portalDisplayNameIsGeneric(raw) ? raw : "")
    || staffForPortalUser(user)?.name
    || trainer?.profileName
    || trainer?.name
    || portalUserEmail(user)
    || "Staff name required";
}

function portalActorLabel(userOrId) {
  const user = typeof userOrId === "string" ? portalUserById(userOrId) : userOrId;
  if (!user) return "Unknown staff member";
  const name = portalDisplayName(user);
  const email = portalUserEmail(user);
  if (email && normalizePortalName(name) === normalizePortalName(email)) return email;
  return email ? `${name} (${email})` : name;
}

function isDemoPortalUser(user) {
  return Boolean(user?.demo || String(user?.user_id || "").startsWith("demo-"));
}

function demoPortalKeyFor(userOrKey) {
  const key = typeof userOrKey === "string"
    ? userOrKey
    : userOrKey?.username || userOrKey?.email || userOrKey?.user_id || "";
  const normalized = String(key).trim().toLowerCase();
  if (DEMO_PORTAL_ACCOUNTS[normalized]) return normalized;
  return Object.entries(DEMO_PORTAL_ACCOUNTS).find(([, account]) => account.user_id === normalized)?.[0] || "";
}

function demoPortalUser(key) {
  const normalized = demoPortalKeyFor(key);
  const base = DEMO_PORTAL_ACCOUNTS[normalized];
  if (!base) return null;
  const saved = state.demoPortalProfiles?.[normalized] || {};
  return { ...base, ...saved, username: base.username, demo: true };
}

function demoAccountForLogin(username, password) {
  const key = demoPortalKeyFor(username);
  if (!key) return null;
  const expectedPassword = state.demoPasswords?.[key] || DEMO_TEST_PASSWORD;
  return password === expectedPassword ? demoPortalUser(key) : null;
}

function persistDemoPortalUser(user, changes = {}) {
  const key = demoPortalKeyFor(user);
  if (!key) return;
  state.demoPortalProfiles = { ...(state.demoPortalProfiles || {}) };
  state.demoPortalProfiles[key] = { ...(state.demoPortalProfiles[key] || {}), ...changes };
  if (portalUser && demoPortalKeyFor(portalUser) === key) {
    portalUser = demoPortalUser(key);
  }
  persistStateSnapshot();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}

function portalAccessRows() {
  const rows = [];
  const seenUserIds = new Set();
  const seenTrainerIds = new Set();
  const seenEmails = new Set();
  Object.keys(DEMO_PORTAL_ACCOUNTS).forEach(key => {
    const user = demoPortalUser(key);
    if (!user) return;
    rows.push({ ...user, derived: false });
    if (user.user_id) seenUserIds.add(user.user_id);
    if (user.trainer_id) seenTrainerIds.add(user.trainer_id);
    const email = portalUserEmail(user);
    if (email) seenEmails.add(email);
  });
  (remotePortalUsers || []).forEach(user => {
    if (seenUserIds.has(user.user_id)) return;
    rows.push({ ...user, derived: false });
    if (user.user_id) seenUserIds.add(user.user_id);
    if (user.trainer_id) seenTrainerIds.add(user.trainer_id);
    const email = portalUserEmail(user);
    if (email) seenEmails.add(email);
  });
  PORTAL_STAFF_DIRECTORY.forEach(staff => {
    if (seenEmails.has(staff.email)) return;
    if (rows.some(row => staffForPortalUser(row)?.email === staff.email)) return;
    rows.push({
      user_id: `staff-directory-${staff.email}`,
      email: staff.email,
      display_name: staff.name,
      role: "admin",
      permission_level: staff.permission,
      active: false,
      access_status: "not_created",
      derived: true
    });
  });
  state.trainers.forEach(trainer => {
    const trainerKey = trainer.remoteId || trainer.id;
    if (seenTrainerIds.has(trainerKey)) return;
    rows.push({
      user_id: `trainer-record-${trainer.id}`,
      email: trainer.profileEmail || trainer.email || "",
      display_name: trainer.profileName || trainer.name,
      role: "trainer",
      trainer_id: trainerKey,
      permission_level: "trainer",
      active: trainer.accessStatus !== "Disabled",
      access_status: trainer.accessStatus === "Disabled" ? "disabled" : "profile_only",
      derived: true
    });
  });
  const priority = { super_admin: 1, office_admin: 2, trainer: 3 };
  return rows.sort((a, b) => (priority[portalPermissionValue(a)] || 9) - (priority[portalPermissionValue(b)] || 9) || portalDisplayName(a).localeCompare(portalDisplayName(b)));
}

function findPortalAccessUser(userId) {
  return portalAccessRows().find(user => String(user.user_id) === String(userId)) || null;
}

function isDerivedPortalUser(user) {
  const id = String(user?.user_id || "");
  return Boolean(user?.derived || id.startsWith("staff-directory-") || id.startsWith("trainer-record-"));
}

function currentPortalUserId() {
  return window.LDTT_PORTAL?.currentAuthUser?.()?.id || portalUser?.user_id || "";
}

function currentActorLabel() {
  if (!portalUser) return "System";
  return portalActorLabel(portalUser);
}

function portalUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  if (portalUserEmail(portalUser) === normalized) return portalUser;
  return remotePortalUsers.find(user => portalUserEmail(user) === normalized) || null;
}

function currentActorMeta() {
  return {
    actor: currentActorLabel(),
    actorId: currentPortalUserId(),
    actorEmail: portalUserEmail(portalUser),
    actorRole: portalUser ? portalPermissionLabel(portalUser) : "System"
  };
}

function activityActorLabel(row) {
  const user = portalUserById(row?.actorId) || portalUserByEmail(row?.actorEmail);
  if (user) return portalActorLabel(user);
  return row?.actor || "System";
}

function activityBelongsToCurrentActor(row) {
  const actorId = currentPortalUserId();
  const actorEmail = portalUserEmail(portalUser);
  if (actorId && row?.actorId && String(row.actorId) === String(actorId)) return true;
  if (actorEmail && row?.actorEmail && String(row.actorEmail).toLowerCase() === actorEmail) return true;
  return !row?.actorId && !row?.actorEmail && portalDisplayNameIsGeneric(row?.actor);
}

function relabelCurrentActorActivity() {
  const meta = currentActorMeta();
  if (!state.activityLog?.length || !meta.actor || meta.actor === "System") return;
  state.activityLog = state.activityLog.map(row => {
    if (!activityBelongsToCurrentActor(row)) return row;
    const next = {
      ...row,
      actor: meta.actor,
      actorId: row.actorId || meta.actorId,
      actorEmail: row.actorEmail || meta.actorEmail,
      actorRole: row.actorRole || meta.actorRole
    };
    if (portalDisplayNameIsGeneric(row.actor) && row.detail) {
      next.detail = String(row.detail).replace(/\b(?:Portal User|Office Admin|Trainer)\b/g, meta.actor);
    }
    return next;
  });
  persistStateSnapshot();
}

function recordActivity(action, detail = "", type = "Portal") {
  state.activityLog = Array.isArray(state.activityLog) ? state.activityLog : [];
  const meta = currentActorMeta();
  state.activityLog.unshift({
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    actor: meta.actor,
    actorId: meta.actorId,
    actorEmail: meta.actorEmail,
    actorRole: meta.actorRole,
    action,
    detail,
    type
  });
  state.activityLog = state.activityLog.slice(0, 250);
  persistStateSnapshot();
}

function officeNoteActivityRows() {
  return (remoteOfficeNotes || []).map(note => {
    const user = portalUserById(note.created_by);
    const actor = portalActorLabel(note.created_by);
    return {
      id: `office-note-${note.id}`,
      createdAt: note.created_at,
      actor,
      actorId: note.created_by || "",
      actorEmail: user ? portalUserEmail(user) : "",
      actorRole: user ? portalPermissionLabel(user) : "Portal",
      action: "Office note added",
      detail: `${actor} added an office note to ${officeNoteEntityLabel(note.entity_type, note.entity_id)}.`,
      type: "Office Note"
    };
  });
}

function recentActivityRows() {
  const auditRows = (remoteAuditEvents || []).map(row => ({
    id: `audit-${row.id}`,
    createdAt: row.created_at,
    actor: row.actor_name || row.actor_email || "Unknown staff member",
    actorId: row.actor_user_id || "",
    actorEmail: row.actor_email || "",
    actorRole: "Office",
    action: String(row.action || "Updated").replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()),
    detail: row.summary || `${row.entity_type || "Record"} ${row.entity_id || ""}`.trim(),
    type: row.entity_type || "Portal"
  }));
  const localRows = isDemoPortalUser(portalUser)
    ? (state.activityLog || []).filter(row => row.type !== "Office Note")
    : [];
  const byId = new Map();
  [...auditRows, ...(auditRows.length ? [] : officeNoteActivityRows()), ...localRows].forEach(row => {
    const key = row.id || `${row.createdAt}-${row.action}-${row.detail}`;
    if (!byId.has(key)) byId.set(key, row);
  });
  return [...byId.values()]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 120);
}

function recentActivityTable() {
  const rows = recentActivityRows();
  if (!rows.length) {
    return `<div class="empty-state"><strong>No activity logged yet.</strong><p>Profile edits, role changes, password resets, trainer page publishing, and review actions will appear here.</p></div>`;
  }
  return `<div class="table-wrap activity-log-wrap"><table class="data-table activity-log-table"><thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead><tbody>${rows.map(row => `<tr>
    <td><strong>${escapeHtml(formatDateTime(row.createdAt))}</strong><small>${escapeHtml(row.type || "Portal")}</small></td>
    <td>${escapeHtml(activityActorLabel(row))}</td>
    <td><span class="status connected">${escapeHtml(row.actorRole || "System")}</span></td>
    <td><strong>${escapeHtml(row.action || "Updated")}</strong></td>
    <td>${escapeHtml(row.detail || "-")}</td>
  </tr>`).join("")}</tbody></table></div>`;
}

function touchCurrentPortalUser(user, changes = {}) {
  if (user?.user_id && user.user_id === currentPortalUserId()) {
    portalUser = { ...(portalUser || {}), ...user, ...changes };
  }
}

async function persistPortalUserRecord(user, changes) {
  if (isDemoPortalUser(user)) {
    persistDemoPortalUser(user, changes);
    return;
  }
  if (!remoteReady || !user?.user_id) return;
  const privilegedKeys = ["role", "permission_level", "trainer_id", "active", "access_status", "disabled_at", "disabled_by"];
  const isPrivilegedChange = privilegedKeys.some(key => Object.prototype.hasOwnProperty.call(changes, key));
  if (!isPrivilegedChange && user.user_id === currentPortalUserId()) {
    await window.LDTT_PORTAL.updateBy("portal_users", "user_id", user.user_id, changes);
    touchCurrentPortalUser(user, changes);
    return;
  }
  const currentSession = window.LDTT_PORTAL?.readSession?.();
  const action = privilegedKeys.some(key => Object.prototype.hasOwnProperty.call(changes, key))
    ? Object.prototype.hasOwnProperty.call(changes, "permission_level") || Object.prototype.hasOwnProperty.call(changes, "role")
      ? "set-role"
      : changes.access_status === "active" ? "restore" : changes.access_status === "revoked" ? "revoke" : "disable"
    : "set-profile";
  const response = await fetch("/api/manage-portal-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentSession?.access_token || ""}`
    },
    body: JSON.stringify({
      user_id: user.user_id,
      email: portalUserEmail(user),
      display_name: portalDisplayName(user),
      permission_level: portalPermissionValue(user),
      trainer_id: user.trainer_id || null,
      action,
      ...changes
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || "Portal user update failed.");
  if (result.user) Object.assign(user, result.user);
}

async function uploadPortalUserPhoto(user, file) {
  if (!file) return "";
  if (file.size > 10_000_000) throw new Error("Choose an image under 10 MB.");
  const prepared = await compressImageFile(file);
  if (isDemoPortalUser(user) || !remoteReady) return fileToDataUrl(prepared);
  if (!window.LDTT_PORTAL?.upload) throw new Error("Supabase storage is not connected.");
  const extension = prepared.name.includes(".") ? prepared.name.split(".").pop().toLowerCase() : "jpg";
  const identity = String(user?.user_id || portalEmail() || Date.now()).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `portal-users/${identity}/profile-${Date.now()}.${extension}`;
  await window.LDTT_PORTAL.upload("trainer-page-assets", path, prepared);
  return window.LDTT_PORTAL.publicStorageUrl("trainer-page-assets", path);
}

async function resetPortalUserPassword(user, password) {
  if (isDemoPortalUser(user)) {
    const key = demoPortalKeyFor(user);
    state.demoPasswords = { ...(state.demoPasswords || {}), [key]: password };
    persistStateSnapshot();
    return { ok: true, demo: true };
  }
  if (!remoteReady || !window.LDTT_PORTAL?.accessToken) {
    throw new Error("Shared portal connection is required to reset a live account password.");
  }
  const token = await window.LDTT_PORTAL.accessToken();
  const response = await fetch("/api/reset-portal-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ user_id: user.user_id, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || "Password reset failed.");
  }
  return payload;
}

async function persistTrainerSocialRecord(trainer) {
  if (!remoteReady || !trainer?.pageId) return;
  await window.LDTT_PORTAL.operationalMutation({
    operation: "update",
    entity_type: "trainer_page",
    id: trainer.pageId,
    expected_updated_at: trainer.pageUpdatedAt,
    action: "trainer_social_links_updated",
    summary: `${trainer.name} social links saved`,
    changes: {
      social_facebook: trainer.socials?.facebook || null,
      social_instagram: trainer.socials?.instagram || null,
      social_tiktok: trainer.socials?.tiktok || null
    }
  });
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
    const result = await window.LDTT_PORTAL.operationalMutation({
      operation: "update",
      entity_type: "client",
      id: client.remoteId,
      action: "client_updated",
      summary: `${client.name || "Client"} record saved`,
      changes: payload
    });
    saved = result.record;
    client.version = Number(result.version || client.version || 1);
    client.updatedAt = result.updated_at || client.updatedAt;
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
  const viewport = options.preserveScroll ? captureViewportPosition() : null;
  try {
    await action();
    if (options.reload !== false && remoteReady) await reloadRemoteData();
    if (message) {
      if (isDemoPortalUser(portalUser)) recordActivity(message, options.detail || "", options.type || "Save");
      showToast(`${message} - Saved live`);
    }
    if (options.render !== false) render();
    restoreViewportPosition(viewport);
    return true;
  } catch (error) {
    console.error(`LDTT ${message || "save"} failed`, error);
    if (error.conflict) {
      await reloadRemoteData().catch(() => {});
      render();
      restoreViewportPosition(viewport);
      showToast("Live record refreshed to the latest saved version.");
      return false;
    }
    showToast(`Could not save: ${error.message}`);
    return false;
  }
}

async function deleteTrainerDraft(trainer) {
  if (!trainer) return false;
  if (remoteReady && trainer.remoteId) {
    await window.LDTT_PORTAL.operationalMutation({
      operation: "archive",
      entity_type: "trainer",
      id: trainer.remoteId,
      expected_version: trainer.version,
      expected_updated_at: trainer.updatedAt,
      summary: `${trainer.name || "Trainer draft"} archived`
    });
  }
  state.trainers = state.trainers.filter(item => item.id !== trainer.id && item.remoteId !== trainer.remoteId);
  state.selectedTrainerId = state.trainers[0]?.id || "";
  state.activeView = "trainerPages";
  persistStateSnapshot();
  return true;
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

function actionConfirmationList(items = []) {
  const cleaned = (items || []).map(item => String(item || "").trim()).filter(Boolean);
  if (!cleaned.length) return "";
  return `<ul class="action-confirmation-list">${cleaned.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function trainerPublishReadinessItems(trainer) {
  const hasRealPhoto = value => {
    const clean = String(value || "").trim();
    return clean && !/lorenzo-logo-transparent|client-photo/i.test(clean);
  };
  const checks = [
    ["Trainer name", Boolean(String(trainer?.profileName || trainer?.name || "").trim()) && !/new trainer/i.test(String(trainer?.profileName || trainer?.name || ""))],
    ["Trainer email / portal username", Boolean(String(trainer?.profileEmail || trainer?.email || trainer?.username || "").trim())],
    ["City / market", Boolean(String(trainer?.profileMarket || trainer?.market || "").trim())],
    ["State", Boolean(String(trainer?.profileState || trainer?.state || "").trim())],
    ["Service area", Boolean(String(trainer?.profileServiceArea || trainer?.serviceArea || "").trim())],
    ["Approved bio", Boolean(String(trainer?.profileBio || trainer?.bio || "").trim()) && !/office needs to approve/i.test(String(trainer?.profileBio || trainer?.bio || ""))],
    ["Find a Trainer headshot", hasRealPhoto(trainerHeadshot(trainer))],
    ["Bio / candid photo", hasRealPhoto(trainerBioPhoto(trainer))],
    ["Landing page top photo", hasRealPhoto(trainerHeroPhoto(trainer))]
  ];
  return checks.map(([label, ready]) => ({ label, ready }));
}

function trainerPublishMissingItems(trainer) {
  return trainerPublishReadinessItems(trainer)
    .filter(item => !item.ready)
    .map(item => item.label);
}

function trainerPublishChecklistMarkup(trainer) {
  const items = trainerPublishReadinessItems(trainer);
  return `<section class="publish-review publish-checklist">
    <div><span>Before publishing</span><strong>Trainer page readiness</strong><small>These checks protect the live landing page, View Bio page, Find a Trainer card, reviews, and trainer login.</small></div>
    <ul class="health-list">${items.map(item => `<li><span class="check ${item.ready ? "" : "warn"}">${item.ready ? "✓" : "!"}</span>${escapeHtml(item.label)}</li>`).join("")}</ul>
  </section>`;
}

function showActionConfirmation(title, message, options = {}) {
  const dialog = document.createElement("dialog");
  dialog.className = "action-confirmation-dialog";
  dialog.innerHTML = `<button type="button" class="action-confirmation-close" aria-label="Close">×</button><div class="action-confirmation-icon">✓</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${actionConfirmationList(options.items)}${options.meta ? `<small class="action-confirmation-meta">${escapeHtml(options.meta)}</small>` : ""}<button type="button" class="btn btn-red action-confirmation-done">Done</button>`;
  document.body.appendChild(dialog);
  const close = () => { dialog.close(); dialog.remove(); };
  dialog.querySelectorAll(".action-confirmation-close,.action-confirmation-done").forEach(button => button.addEventListener("click", close));
  dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
  dialog.showModal();
}

function showActionProgress(title, message, options = {}) {
  const dialog = document.createElement("dialog");
  dialog.className = "action-confirmation-dialog action-progress-dialog is-pending";
  dialog.setAttribute("aria-live", "polite");
  dialog.innerHTML = `<button type="button" class="action-confirmation-close" aria-label="Close">×</button>
    <div class="action-confirmation-icon action-progress-icon"><span class="action-progress-spinner" aria-hidden="true"></span></div>
    <h2></h2>
    <p></p>
    <div class="action-progress-list"></div>
    <div class="action-progress-bar" aria-hidden="true"><span></span></div>
    <button type="button" class="btn btn-red action-confirmation-done" disabled>Saving...</button>`;
  document.body.appendChild(dialog);
  const iconEl = dialog.querySelector(".action-progress-icon");
  const titleEl = dialog.querySelector("h2");
  const messageEl = dialog.querySelector("p");
  const listEl = dialog.querySelector(".action-progress-list");
  const doneButton = dialog.querySelector(".action-confirmation-done");
  const closeButton = dialog.querySelector(".action-confirmation-close");
  const close = () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };
  closeButton.addEventListener("click", close);
  doneButton.addEventListener("click", close);
  dialog.addEventListener("click", event => {
    if (event.target === dialog && !dialog.classList.contains("is-pending")) close();
  });
  const renderState = (state, nextTitle, nextMessage, nextOptions = {}) => {
    dialog.classList.toggle("is-pending", state === "pending");
    dialog.classList.toggle("is-complete", state === "complete");
    dialog.classList.toggle("is-error", state === "error");
    titleEl.textContent = nextTitle || title;
    messageEl.textContent = nextMessage || message;
    listEl.innerHTML = actionConfirmationList(nextOptions.items || options.items || []);
    if (state === "pending") {
      iconEl.innerHTML = `<span class="action-progress-spinner" aria-hidden="true"></span>`;
      closeButton.disabled = true;
      doneButton.disabled = true;
      doneButton.textContent = "Saving...";
      return;
    }
    closeButton.disabled = false;
    iconEl.textContent = state === "error" ? "!" : "✓";
    doneButton.disabled = false;
    doneButton.textContent = state === "error" ? "Close" : "Done";
  };
  renderState("pending", title, message, options);
  dialog.showModal();
  return {
    done(nextTitle, nextMessage, nextOptions = {}) {
      renderState("complete", nextTitle, nextMessage, nextOptions);
    },
    fail(nextTitle, nextMessage, nextOptions = {}) {
      renderState("error", nextTitle, nextMessage, nextOptions);
    },
    close
  };
}

function icon(name) {
  return `<span class="nav-icon">${icons[name] || icons.dashboard}</span>`;
}

function trainerById(id = state.selectedTrainerId) {
  const trainer = findTrainer(id);
  if (trainer) return trainer;
  if (arguments.length > 0 && id) return null;
  const fallback = state.trainers[0] || null;
  if (fallback) state.selectedTrainerId = fallback.id;
  return fallback;
}

function templatePageFile(layoutId) {
  return layoutId === "mock-6" ? "/trainer-backoffice/serious-training-results.html" : layoutId === "mock-3" ? "/trainer-backoffice/real-life-results.html" : "/trainer-backoffice/right-trainer-results.html";
}

function templatePreviewHref(layoutId) {
  return `${templatePageFile(layoutId)}?trainer=${state.selectedTrainerId || currentTrainerId()}&layout=${layoutId}&preview=1`;
}

function requestedPublicTrainerKey() {
  const params = new URLSearchParams(window.location.search);
  const explicit = document.body.dataset.trainer || params.get("trainer") || "";
  if (explicit) return explicit;
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (!path || path.includes("/") || ["staff", "contact", "find-a-trainer", "trainer-application"].includes(path)) return "";
  return path;
}

function requestedPublicTrainerBioKey() {
  const params = new URLSearchParams(window.location.search);
  const explicit = document.body.dataset.trainer || params.get("trainer") || params.get("bio") || "";
  if (explicit) return explicit.replace(/^trainer-bio-/, "");
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "").replace(/\.html$/, "");
  if (!path.startsWith("trainer-bio-")) return "";
  return path.replace(/^trainer-bio-/, "");
}

function trainerPageHref(trainerOrId) {
  const trainer = typeof trainerOrId === "string" ? trainerById(trainerOrId) : trainerOrId;
  if (!trainer) return "/staff?role=admin&view=trainerPages";
  if (trainer?.pageSlug && trainer.pageStatus === "Published") return `/${trainerPublicSlug(trainer)}`;
  return `${templatePageFile(trainer.layout)}?trainer=${trainer.id}&layout=${trainer.layout}&preview=1`;
}

function trainerBioHref(trainerOrId) {
  const trainer = typeof trainerOrId === "string" ? trainerById(trainerOrId) : trainerOrId;
  return trainer ? `/trainer-bio-${trainerDisplaySlug(trainer)}` : "/find-a-trainer";
}

function trainerPublicUrl(trainer) {
  return `${PUBLIC_SITE_ORIGIN}/${trainerPublicSlug(trainer)}`;
}

function staffPortalUrl() {
  return `${PUBLIC_SITE_ORIGIN}/staff`;
}

function builderPages() {
  return [
    { id: "home", label: "Landing Page" },
    { id: "services", label: "Services Section" },
    { id: "trainer", label: "Trainer Bio" },
    { id: "reviews", label: "Reviews" },
    { id: "contact", label: "Lead Form" }
  ];
}

function builderSurfaces() {
  return [
    { id: "trainer", label: "Trainer Landing Page" },
    { id: "site", label: "Main Website Pages" },
    { id: "portal", label: "Trainer Portal UI" }
  ];
}

function mainWebsitePages() {
  return [
    { id: "/index.html", label: "Home" },
    { id: "/dog-training.html", label: "Dog Training" },
    { id: "/behavior-help.html", label: "Behavior Help" },
    { id: "/specialty-advanced.html", label: "Specialty Training" },
    { id: "/become-a-trainer.html", label: "Become a Trainer" },
    { id: "/find-a-trainer.html", label: "Find a Trainer" },
    { id: "/facility.html", label: "Our Facility" },
    { id: "/about.html", label: "About" },
    { id: "/contact.html", label: "Contact" }
  ];
}

function portalPreviewViews() {
  return [
    { id: "dashboard", label: "Trainer Dashboard" },
    { id: "leads", label: "My Leads" },
    { id: "myPage", label: "My Trainer Page" },
    { id: "performance", label: "Performance" },
    { id: "submitMedia", label: "Submit Photos/Videos" },
    { id: "submitReviews", label: "Submit Reviews" },
    { id: "settings", label: "Settings" }
  ];
}

function currentBuilderKey() {
  if (state.builderSurface === "site") return state.builderMainPage || "/index.html";
  if (state.builderSurface === "portal") return state.builderPortalView || "dashboard";
  return state.builderPage || "home";
}

function activeBuilderEdits() {
  const key = currentBuilderKey();
  if (state.builderSurface === "site") return state.siteBuilderEdits?.[key] || [];
  if (state.builderSurface === "portal") return state.portalBuilderEdits?.[key] || [];
  return trainerById()?.liveEdits || [];
}

function setActiveBuilderEdits(edits) {
  const key = currentBuilderKey();
  if (state.builderSurface === "site") {
    state.siteBuilderEdits = { ...(state.siteBuilderEdits || {}), [key]: edits };
    return;
  }
  if (state.builderSurface === "portal") {
    state.portalBuilderEdits = { ...(state.portalBuilderEdits || {}), [key]: edits };
    return;
  }
  trainerById().liveEdits = edits;
}

function liveEditsForPage(trainer, page = state.builderPage || "home") {
  if (state.builderSurface !== "trainer") return activeBuilderEdits();
  return (trainer?.liveEdits || []).filter(edit => (edit.page || "home") === page || page === "home");
}

function applyLiveEditsToDocument(doc, edits = []) {
  if (!doc || !Array.isArray(edits)) return;
  edits.forEach(edit => {
    if (!edit?.k) return;
    let target;
    try {
      target = doc.querySelector(edit.k);
    } catch {
      target = null;
    }
    if (!target) return;
    if (edit.t === "text") target.textContent = edit.v || "";
    if (edit.t === "html") target.innerHTML = edit.v || "";
    if (edit.t === "img") {
      if (target.matches("[data-trainer-image-role]")) return;
      target.setAttribute("src", edit.v || "");
      target.setAttribute("srcset", "");
    }
    if (edit.t === "video") {
      const videoUrl = String(edit.v || "");
      const isEmbed = /youtube\.com\/embed|player\.vimeo\.com\/video|drive\.google\.com\/file\/d\/[^/]+\/preview|loom\.com\/embed/i.test(videoUrl);
      const createVideoNode = () => {
        if (isEmbed) {
          const frame = doc.createElement("iframe");
          frame.setAttribute("src", videoUrl);
          frame.setAttribute("title", edit.label || "Trainer video");
          frame.setAttribute("loading", "lazy");
          frame.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
          frame.setAttribute("allowfullscreen", "");
          return frame;
        }
        const video = doc.createElement("video");
        video.setAttribute("src", videoUrl);
        video.setAttribute("controls", "");
        video.setAttribute("playsinline", "");
        return video;
      };
      if (target.tagName === "VIDEO" && !isEmbed) {
        target.setAttribute("src", videoUrl);
        target.controls = true;
      } else if (target.tagName === "VIDEO" && isEmbed) {
        target.replaceWith(createVideoNode());
      } else {
        target.innerHTML = "";
        target.appendChild(createVideoNode());
      }
    }
    if (edit.t === "style" && edit.prop) target.style[edit.prop] = edit.v || "";
  });
}

function applySectionBuilderSettings(doc, trainer) {
  if (!doc || !trainer) return;
  const hidden = new Set(trainer.hiddenSections || []);
  const selectors = {
    hero: ".lp5-hero,.lp6-hero,.lp3-hero",
    stats: ".lp-stats,.lp5-trust",
    services: ".lp-services",
    trainerVideo: ".lp-trainer-video",
    trainer: ".lp5-trainer,.lp6-trainer,.lp3-trainer",
    reviewSubmission: ".lp-review-submission",
    reviews: ".lp-reviews",
    process: ".lp-process",
    consultation: ".lp-final,.lp5-final,.lp6-cta,.lp3-contact",
    footer: ".trainer-landing-footer"
  };
  Object.entries(selectors).forEach(([key, selector]) => {
    doc.querySelectorAll(selector).forEach(element => {
      element.hidden = hidden.has(key);
    });
  });
  const page = doc.querySelector(".lp-page");
  if (!page || !Array.isArray(trainer.sectionOrder)) return;
  const safeOrder = [
    "hero",
    "stats",
    "services",
    "trainerVideo",
    "trainer",
    "reviewSubmission",
    "reviews",
    "process",
    "consultation",
    "footer"
  ];
  safeOrder.forEach(key => {
    doc.querySelectorAll(selectors[key]).forEach(element => {
      if (element?.parentElement === page) page.appendChild(element);
    });
  });
}

function selectorForElement(element) {
  if (!element || !element.tagName || element === element.ownerDocument.body) return "body";
  if (element.id) return `#${CSS.escape(element.id)}`;
  const parts = [];
  let current = element;
  while (current && current.nodeType === 1 && current !== current.ownerDocument.body) {
    let part = current.tagName.toLowerCase();
    const className = String(current.className || "").split(/\s+/).filter(Boolean).slice(0, 2).map(name => `.${CSS.escape(name)}`).join("");
    if (className) part += className;
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    current = parent;
    if (parts.length >= 5) break;
  }
  return parts.join(" > ");
}

function upsertLiveEdit(trainer, edit) {
  if (!edit?.k) return;
  const edits = activeBuilderEdits().slice();
  const page = currentBuilderKey();
  const index = edits.findIndex(item => item.k === edit.k && item.t === edit.t && (item.page || "home") === page && (item.prop || "") === (edit.prop || ""));
  const next = {
    page,
    surface: state.builderSurface || "trainer",
    label: edit.label || edit.k,
    updatedAt: new Date().toISOString(),
    ...edit
  };
  if (index >= 0) edits[index] = { ...edits[index], ...next };
  else edits.push(next);
  setActiveBuilderEdits(edits);
  if (state.builderSurface === "trainer") {
    trainer.pageStatus = "Draft";
    trainer.locked = false;
  }
  persistStateSnapshot();
  if (state.builderSurface === "trainer") scheduleRemoteSave(`builder-${trainer.id}`, () => persistTrainerRecord(trainer, { persistProfile: true }), 900);
}

function removeLiveEdit(index) {
  const trainer = trainerById();
  const edits = activeBuilderEdits().slice();
  if (!edits[index]) return;
  edits.splice(index, 1);
  setActiveBuilderEdits(edits);
  if (state.builderSurface === "trainer") {
    trainer.pageStatus = "Draft";
    trainer.locked = false;
  }
  saveState("Builder edit removed");
}

function renderLiveEditList(trainer) {
  const edits = activeBuilderEdits();
  if (!edits.length) return `<p class="builder-empty">No live edits yet. Click text, images, or sections in the preview to customize them.</p>`;
  return `<div class="builder-change-list">${edits.map((edit, index) => `<article><div><strong>${escapeHtml(edit.label || edit.k)}</strong><span>${escapeHtml(edit.t)} · ${escapeHtml(edit.surface || state.builderSurface)} · ${escapeHtml(edit.page || "home")}</span></div><button class="btn btn-outline btn-small" type="button" data-remove-live-edit="${index}">Remove</button></article>`).join("")}</div>`;
}

function isEmbeddableVideoUrl(url) {
  return /youtube\.com\/embed|player\.vimeo\.com\/video|drive\.google\.com\/file\/d\/[^/]+\/preview|loom\.com\/embed/i.test(String(url || ""));
}

function videoProviderLabel(url) {
  const value = String(url || "").toLowerCase();
  if (value.includes("youtube.com")) return "YouTube";
  if (value.includes("vimeo.com")) return "Vimeo";
  if (value.includes("drive.google.com")) return "Google Drive";
  if (value.includes("loom.com")) return "Loom";
  if (value.includes("dropbox.com")) return "Dropbox";
  return "Video";
}

function reviewMediaIsVideo(url = "", fileType = "") {
  return String(fileType || "").startsWith("video/")
    || isEmbeddableVideoUrl(url)
    || /(?:youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|loom\.com|dropbox\.com)/i.test(String(url || ""))
    || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(String(url || ""));
}

function videoPreviewMarkup(url, label = "Trainer video", poster = "") {
  const clean = String(url || "").trim();
  if (!clean) return `<span>No trainer video uploaded yet</span>`;
  if (isEmbeddableVideoUrl(clean)) {
    return `<iframe src="${escapeHtml(clean)}" title="${escapeHtml(label)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  }
  const posterAttr = poster ? ` poster="${escapeHtml(poster)}"` : "";
  return `<video src="${escapeHtml(clean)}" controls preload="metadata" playsinline${posterAttr}></video>`;
}

function renderMediaLibrary(trainer) {
  const media = trainer.mediaLibrary || [];
  return `<div class="builder-media-grid">${media.map(item => {
    const type = item.type || "image";
    const thumb = type === "video"
      ? videoPreviewMarkup(item.url, item.name || "Builder video")
      : `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name || "Builder media")}">`;
    const sizeLabel = item.size ? `${Math.round((item.size || 0) / 1024 / 1024 * 10) / 10} MB` : videoProviderLabel(item.url);
    return `<article><div class="builder-media-thumb">${thumb}</div><strong>${escapeHtml(item.name || "Uploaded media")}</strong><span>${escapeHtml(type)} · ${escapeHtml(sizeLabel)}</span><button class="btn btn-outline btn-small" type="button" data-use-media="${escapeHtml(item.url)}" data-media-kind="${escapeHtml(type)}">Use On Selected Element</button></article>`;
  }).join("") || `<p class="builder-empty">Upload photos, logos, or videos. Large videos will be compressed when the browser supports it, or the editor will ask for an external video URL.</p>`}</div>`;
}

function markBuilderDraftDirty(message = "Builder change saved to draft", detail = "") {
  const trainer = trainerById();
  if (state.builderSurface === "trainer") {
    trainer.pageStatus = "Draft";
    trainer.locked = false;
  }
  persistStateSnapshot();
  if (state.builderSurface === "trainer") scheduleRemoteSave(`builder-${trainer.id}`, () => persistTrainerRecord(trainer), 900);
  if (detail) recordActivity(message, detail, state.builderSurface === "trainer" ? "Trainer Page" : "Page Editor");
  if (message) showToast(message);
}

function mediaKind(file) {
  return file.type.startsWith("video/") ? "video" : "image";
}

const mediaUploadTasks = new Map();

function isMediaUploadActive() {
  return mediaUploadTasks.size > 0;
}

function prettyBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "";
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 1024 * 10) / 10} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function uploadProgressPanel() {
  let panel = document.querySelector("[data-upload-progress-panel]");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.className = "upload-progress-panel";
  panel.setAttribute("data-upload-progress-panel", "");
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = `<div class="upload-progress-head"><strong data-upload-title>Preparing upload</strong><span data-upload-percent>0%</span></div><div class="upload-progress-track"><span data-upload-bar></span></div><p data-upload-stage>Getting media ready...</p><small data-upload-detail></small>`;
  document.body.appendChild(panel);
  return panel;
}

function syncMediaUploadButtons() {
  document.querySelectorAll("[data-editor-save], #saveTrainerProfile, [data-toggle-lock]").forEach(button => {
    button.disabled = isMediaUploadActive();
    button.classList.toggle("is-disabled", isMediaUploadActive());
  });
}

function startMediaUploadTask(file, stage = "Preparing media") {
  const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  mediaUploadTasks.set(id, { file, stage, percent: 1, status: "active" });
  updateMediaUploadTask(id, { stage, percent: 1 });
  syncMediaUploadButtons();
  return id;
}

function updateMediaUploadTask(id, patch = {}) {
  const task = { ...(mediaUploadTasks.get(id) || {}), ...patch };
  mediaUploadTasks.set(id, task);
  const panel = uploadProgressPanel();
  const percent = Math.max(0, Math.min(100, Math.round(Number(task.percent || 0))));
  panel.classList.remove("done", "error");
  panel.querySelector("[data-upload-title]").textContent = task.file?.name || "Media upload";
  panel.querySelector("[data-upload-percent]").textContent = `${percent}%`;
  panel.querySelector("[data-upload-bar]").style.width = `${percent}%`;
  panel.querySelector("[data-upload-stage]").textContent = task.stage || "Working...";
  panel.querySelector("[data-upload-detail]").textContent = task.detail || "";
}

function finishMediaUploadTask(id, status = "done", message = "Media uploaded and saved") {
  const task = mediaUploadTasks.get(id) || {};
  const panel = uploadProgressPanel();
  panel.classList.toggle("done", status === "done");
  panel.classList.toggle("error", status === "error");
  panel.querySelector("[data-upload-percent]").textContent = status === "done" ? "100%" : "";
  panel.querySelector("[data-upload-bar]").style.width = status === "done" ? "100%" : "100%";
  panel.querySelector("[data-upload-stage]").textContent = message;
  panel.querySelector("[data-upload-detail]").textContent = task.file ? `${task.file.name} · ${prettyBytes(task.file.size)}` : "";
  mediaUploadTasks.delete(id);
  syncMediaUploadButtons();
  window.setTimeout(() => {
    if (!isMediaUploadActive() && panel.isConnected) panel.remove();
  }, status === "done" ? 1800 : 5200);
}

async function compressImageFile(file) {
  if (!file.type.startsWith("image/") || file.size < 8 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const maxWidth = 2200;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

function supportedVideoMime() {
  return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(type => window.MediaRecorder?.isTypeSupported?.(type)) || "";
}

async function compressVideoFile(file, onProgress) {
  if (!file.type.startsWith("video/") || file.size < 48 * 1024 * 1024) return file;
  const mimeType = supportedVideoMime();
  if (!mimeType) throw new Error("This browser cannot compress large videos. Upload the video to YouTube, Vimeo, Loom, Dropbox, or Drive and paste the link instead.");
  const video = document.createElement("video");
  let progressTimer = 0;
  let compressionStream = null;
  let sourceStream = null;
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(file);
  try {
    onProgress?.({ percent: 4, stage: "Reading video details..." });
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("Video could not be read for compression"));
    });
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(320, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(180, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    const captureSource = video.captureStream || video.mozCaptureStream;
    if (!captureSource) return file;
    await video.play();
    video.pause();
    video.currentTime = 0;
    sourceStream = captureSource.call(video);
    const audioTracks = sourceStream.getAudioTracks();
    if (!audioTracks.length) return file;
    compressionStream = canvas.captureStream(24);
    audioTracks.forEach(track => compressionStream.addTrack(track));
    const recorder = new MediaRecorder(compressionStream, { mimeType, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
    const chunks = [];
    recorder.ondataavailable = event => {
      if (event.data?.size) chunks.push(event.data);
    };
    const draw = () => {
      if (video.paused || video.ended) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(draw);
    };
    await new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = () => reject(new Error("Video compression failed"));
      recorder.start(1000);
      progressTimer = window.setInterval(() => {
        const duration = Number(video.duration || 0);
        const ratio = duration ? Math.min(1, video.currentTime / duration) : 0;
        onProgress?.({
          percent: 5 + Math.round(ratio * 70),
          stage: "Compressing video...",
          detail: duration ? `${Math.round(video.currentTime)}s of ${Math.round(duration)}s` : "Working in the browser"
        });
      }, 500);
      video.play().then(draw).catch(reject);
      video.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };
    });
    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size || blob.size >= file.size) return file;
    onProgress?.({ percent: 78, stage: "Compression finished", detail: `${prettyBytes(file.size)} to ${prettyBytes(blob.size)}` });
    return new File([blob], file.name.replace(/\.[^.]+$/, ".webm"), { type: "video/webm" });
  } finally {
    if (progressTimer) window.clearInterval(progressTimer);
    compressionStream?.getTracks().forEach(track => track.stop());
    sourceStream?.getTracks().forEach(track => track.stop());
    URL.revokeObjectURL(video.src);
  }
}

function normalizeVideoUrl(value) {
  let url = String(value || "").trim();
  if (!url) return "";
  if (!/^(https?:|\/|data:|blob:)/i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      const id = parsed.searchParams.get("v") || (pathParts[0] === "shorts" ? pathParts[1] : "") || (pathParts[0] === "embed" ? pathParts[1] : "");
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
    if (host === "youtu.be") {
      const id = pathParts[0] || "";
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
    if (host === "vimeo.com") {
      const id = pathParts.find(part => /^\d+$/.test(part));
      if (id) return `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
    }
    if (host === "player.vimeo.com") return parsed.href;
    if (host === "drive.google.com") {
      const dIndex = pathParts.indexOf("d");
      const id = dIndex >= 0 ? pathParts[dIndex + 1] : parsed.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
    }
    if (host === "loom.com" || host.endsWith(".loom.com")) {
      const marker = pathParts.includes("share") ? "share" : "embed";
      const id = pathParts[pathParts.indexOf(marker) + 1] || "";
      if (id) return `https://www.loom.com/embed/${encodeURIComponent(id)}`;
    }
    if (host === "dropbox.com" || host.endsWith(".dropbox.com")) {
      parsed.searchParams.delete("dl");
      parsed.searchParams.set("raw", "1");
      return parsed.href;
    }
    return parsed.href;
  } catch {
    return url;
  }
}

async function uploadBuilderMedia(file, slot = "mediaLibrary") {
  const trainer = trainerById();
  if (!file) return null;
  if (!window.LDTT_PORTAL?.upload) throw new Error("Supabase storage is not connected yet");
  const taskId = startMediaUploadTask(file, file.type.startsWith("video/") && file.size > 48 * 1024 * 1024 ? "Compressing video..." : "Preparing media upload...");
  try {
    showToast(file.type.startsWith("video/") && file.size > 48 * 1024 * 1024 ? "Compressing large video with progress shown below." : "Preparing media upload...");
    const prepared = file.type.startsWith("video/")
      ? await compressVideoFile(file, progress => updateMediaUploadTask(taskId, progress))
      : await compressImageFile(file);
    if (prepared.type.startsWith("video/") && prepared.size > 50 * 1024 * 1024) {
      throw new Error("Video is still over the 50 MB storage limit. Paste a YouTube, Vimeo, Loom, Google Drive, Dropbox, or direct video link instead.");
    }
    if (!window.LDTT_PORTAL.accessToken?.()) {
      throw new Error("Live Supabase sign-in is required to upload media. Demo accounts can test compression but cannot write to storage.");
    }
    const extension = prepared.name.includes(".") ? prepared.name.split(".").pop().toLowerCase() : (prepared.type.startsWith("video/") ? "webm" : "jpg");
    const safeSlot = slot === "selectedMedia" ? "selected" : slot;
    const path = `${trainer.remoteId || slugify(trainer.name)}/${safeSlot}-${Date.now()}.${extension}`;
    const bucket = prepared.type.startsWith("video/") ? "trainer-page-videos" : "trainer-page-assets";
    updateMediaUploadTask(taskId, { stage: "Uploading to trainer media storage...", percent: prepared.type.startsWith("video/") ? 80 : 8, detail: prettyBytes(prepared.size) });
    const uploadResult = await window.LDTT_PORTAL.upload(bucket, path, prepared, {
      onProgress: progress => {
        const base = prepared.type.startsWith("video/") ? 80 : 8;
        const range = prepared.type.startsWith("video/") ? 18 : 90;
        updateMediaUploadTask(taskId, {
          stage: "Uploading to trainer media storage...",
          percent: base + Math.round((progress.percent || 0) / 100 * range),
          detail: `${prettyBytes(progress.loaded)} of ${prettyBytes(progress.total || prepared.size)}`
        });
      }
    });
    const url = uploadResult?.publicUrl || window.LDTT_PORTAL.publicStorageUrl(uploadResult?.bucket || bucket, uploadResult?.path || path);
    trainer.mediaLibrary = Array.isArray(trainer.mediaLibrary) ? trainer.mediaLibrary : [];
    trainer.mediaLibrary.unshift({
      type: mediaKind(prepared),
      url,
      name: prepared.name,
      size: prepared.size,
      uploadedAt: new Date().toISOString()
    });
    finishMediaUploadTask(taskId, "done", "Media uploaded. Saving page draft...");
    return { url, type: mediaKind(prepared) };
  } catch (error) {
    finishMediaUploadTask(taskId, "error", error.message || "Media upload failed");
    throw error;
  }
}

function trainerName(id) {
  if (id === "lorenzos-team") return "Lorenzo's Dog Training Team";
  return findTrainer(id)?.name || "Unassigned";
}

function findTrainer(id) {
  return state.trainers.find(trainer => trainer.id === id || trainer.remoteId === id || trainer.slug === id || trainer.pageSlug === id);
}

function currentTrainerId() {
  if (portalUser?.trainer_id) {
    return state.trainers.find(trainer => trainer.remoteId === portalUser.trainer_id || trainer.id === portalUser.trainer_id)?.id || state.selectedTrainerId;
  }
  return state.selectedTrainerId || state.trainers[0]?.id || "";
}

function trainerLeads(id = currentTrainerId()) {
  const trainer = findTrainer(id);
  return state.leads.filter(lead => {
    const assigned = findTrainer(lead.trainerId);
    return trainer && assigned ? assigned.id === trainer.id : lead.trainerId === id;
  });
}

function conversionStatuses() {
  return ["Became a Client"];
}

function normalizeLeadStatus(status) {
  const map = {
    "Engaged Lead / No Outcome": "Engaged Lead: No Outcome",
    "Follow-Up Needed": "Office Contacted",
    "Follow-Up Scheduled": "Office Contacted",
    "Follow Up Call Needed": "Office Contacted",
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
  if (portalProfileNeedsCompletion()) {
    state.activeView = "settings";
  }
  if (session.role === "admin" && !canAccessAdminView(state.activeView)) {
    state.activeView = "dashboard";
  }
  renderSidebar();
  renderTopbar();
  renderView();
  requestAnimationFrame(enhanceHorizontalScrollers);
  window.setTimeout(() => {
    const frame = document.getElementById("pageEditorPreview");
    if (frame) {
      frame.addEventListener("load", () => injectLiveBuilder(frame), { once: true });
      injectLiveBuilder(frame);
    }
  }, 120);
}

const horizontalScrollSelectors = [
  ".table-wrap",
  ".lead-kanban",
  ".submission-review-list-shell",
  ".application-chart-grid",
  ".trainer-review-carousel"
];

function enhanceHorizontalScrollers() {
  const workspace = document.getElementById("workspaceView");
  if (!workspace) return;
  workspace.querySelectorAll(horizontalScrollSelectors.join(",")).forEach((scroller, index) => {
    if (scroller.dataset.horizontalScrollReady === "true") return;
    scroller.dataset.horizontalScrollReady = "true";
    const id = `horizontal-scroll-${state.activeView}-${index}`;
    scroller.id ||= id;
    const toolbar = document.createElement("div");
    toolbar.className = "horizontal-scroll-toolbar";
    toolbar.setAttribute("aria-label", "Horizontal navigation");
    toolbar.innerHTML = `<span>Scroll left or right</span><button class="horizontal-scroll-button" type="button" data-scroll-horizontal="left" data-scroll-target="${escapeHtml(scroller.id)}" aria-label="Scroll left" title="Scroll left">&larr;</button><button class="horizontal-scroll-button" type="button" data-scroll-horizontal="right" data-scroll-target="${escapeHtml(scroller.id)}" aria-label="Scroll right" title="Scroll right">&rarr;</button>`;
    scroller.before(toolbar);
    const update = () => {
      const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const left = toolbar.querySelector('[data-scroll-horizontal="left"]');
      const right = toolbar.querySelector('[data-scroll-horizontal="right"]');
      if (left) left.disabled = max < 2 || scroller.scrollLeft <= 2;
      if (right) right.disabled = max < 2 || scroller.scrollLeft >= max - 2;
      toolbar.classList.toggle("is-static", max < 2);
    };
    scroller.addEventListener("scroll", update, { passive: true });
    if ("ResizeObserver" in window) {
      new ResizeObserver(update).observe(scroller);
    } else {
      window.addEventListener("resize", update, { passive: true });
    }
    update();
  });
}

async function bootstrapApplication() {
  const publicProfileTarget = document.getElementById("publicTrainerProfile");
  if (publicProfileTarget) {
    publicProfileTarget.innerHTML = `<main class="trainer-page-loading"><img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><h1>Loading trainer bio...</h1><p>Retrieving the office-approved trainer profile.</p></main>`;
    const requested = requestedPublicTrainerBioKey();
    const localTrainer = findTrainer(requested);
    const slug = localTrainer?.slug || requested;
    if (window.LDTT_PORTAL?.enabled && slug) {
      try {
        const pair = await window.LDTT_PORTAL.loadPublishedTrainer(slug, { includeDraft: false });
        const merged = mergePublishedTrainer(pair);
        if (!merged) throw new Error("No published trainer revision was returned.");
        state.selectedTrainerId = merged.id;
        renderPublicTrainerProfile();
      } catch (error) {
        console.warn("LDTT published trainer bio sync failed", error);
        publicProfileTarget.innerHTML = `<main class="trainer-page-loading"><img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><h1>Trainer bio temporarily unavailable</h1><p>The live office-approved profile could not be loaded. Please refresh shortly.</p></main>`;
      }
    } else {
      renderPublicTrainerProfile();
    }
    return;
  }

  const publicTarget = document.getElementById("publicSite");
  if (publicTarget) {
    publicTarget.innerHTML = `<main class="trainer-page-loading"><img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><h1>Loading trainer page...</h1><p>Retrieving the current office-approved page.</p></main>`;
    const requested = requestedPublicTrainerKey();
    const localTrainer = findTrainer(requested);
    const slug = localTrainer?.slug || requested;
    if (window.LDTT_PORTAL?.enabled && slug) {
      try {
        const includeDraft = new URLSearchParams(window.location.search).get("preview") === "1";
        const pair = await window.LDTT_PORTAL.loadPublishedTrainer(slug, { includeDraft });
        const merged = includeDraft && pair?.trainer && pair?.page
          ? remoteTrainerToUi(pair.trainer, pair.page)
          : mergePublishedTrainer(pair);
        if (!merged) throw new Error("No published trainer revision was returned.");
        const existingIndex = state.trainers.findIndex(item => item.slug === merged.slug || item.id === merged.id);
        if (existingIndex >= 0) state.trainers[existingIndex] = merged;
        else state.trainers.push(merged);
        state.selectedTrainerId = merged.id;
        renderPublicSite();
      } catch (error) {
        console.warn("LDTT published trainer page sync failed", error);
        if (localTrainer && document.body.dataset.releaseRevision) {
          state.selectedTrainerId = localTrainer.id;
          renderPublicSite();
        } else {
          publicTarget.innerHTML = `<main class="trainer-page-loading"><img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><h1>Trainer page temporarily unavailable</h1><p>The current published page could not be loaded. Please refresh shortly.</p></main>`;
        }
      }
    } else {
      renderPublicSite();
    }
    return;
  }

  if (!window.LDTT_PORTAL?.enabled) {
    session = loadSession();
    if (session.demoUsername) {
      const demoUser = demoPortalUser(session.demoUsername);
      if (demoUser && portalUserHasAccess(demoUser)) {
        portalUser = demoUser;
        session = { loggedIn: true, role: demoUser.role, demoUsername: session.demoUsername };
        state.role = demoUser.role;
      }
    }
    render();
    return;
  }

  try {
    const savedSession = loadSession();
    if (savedSession.demoUsername) {
      const demoUser = demoPortalUser(savedSession.demoUsername);
      if (demoUser && portalUserHasAccess(demoUser)) {
        portalUser = demoUser;
        session = { loggedIn: true, role: demoUser.role, demoUsername: savedSession.demoUsername };
        state.role = demoUser.role;
        await hydrateSharedOperationalDataForDemo();
        render();
        return;
      }
    }
    portalUser = await window.LDTT_PORTAL.currentPortalUser();
    if (!portalUser) {
      session = { loggedIn: false, role: "" };
      render();
      return;
    }
    if (!portalUserHasAccess(portalUser)) {
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
    startOperationalSync();
  } catch (error) {
    console.error("LDTT portal bootstrap failed", error);
    session = { loggedIn: false, role: "" };
    const status = document.getElementById("loginStatus");
    if (status) status.textContent = "The portal could not load. Please sign in again.";
    render();
  }
}

function adminNav() {
  const newLeadCount = allLeadRows().filter(lead => (lead.status || "New Inquiry") === "New Inquiry").length;
  const items = [
    ["dashboard", "Dashboard", "dashboard"],
    ["trainerPages", "Trainer Pages", "globe"],
    ["pageEditor", "Page Editor", "edit"],
    ["trainers", "Trainers", "users"],
    ["leads", "Leads", "lead", newLeadCount],
    ["applications", "Applications", "message", applicationRows().filter(applicationNeedsAction).length],
    ["clients", "Clients", "users"],
    ["approvals", "Reviews", "star", pendingReviewSubmissions().length],
    ["reports", "Reports", "report"],
    ["adLandingPages", "Ad Landing Pages", "monitor"],
    ["portalAccess", "Portal Access", "shield"],
    ["settings", "Settings", "settings"]
  ];
  return isOfficeAdmin()
    ? items.filter(([view]) => officeAdminViews.includes(view))
    : items;
}

function portalEmail() {
  return String(window.LDTT_PORTAL?.currentAuthUser?.()?.email || "").trim().toLowerCase();
}

function isOfficeAdmin() {
  if (portalUser?.permission_level) return portalUser.permission_level === "office_admin";
  return OFFICE_ADMIN_EMAILS.has(portalEmail());
}

function canAccessAdminView(view) {
  return !isOfficeAdmin() || officeAdminViews.includes(view);
}

function trainerNav() {
  return [
    ["dashboard", "Dashboard", "dashboard"],
    ["leads", "My Leads", "lead", filteredLeadRows(trainerLeads(), { useWorkspaceFilters: false }).filter(l => !["Archived", "Became a Client"].includes(l.status)).length],
    ["myPage", "My Trainer Page", "monitor"],
    ["performance", "Performance", "report"],
    ["submitMedia", "Submit Photos/Videos", "media", trainerMediaSubmissions().filter(s => s.status === "Pending").length],
    ["submitReviews", "Submit Reviews", "star", trainerReviewSubmissions().filter(s => s.status === "Pending").length],
    ["settings", "Settings", "settings"]
  ];
}

function renderSidebar() {
  const isAdmin = session.role === "admin";
  const passwordSetupRequired = Boolean(portalUser?.must_change_password);
  const profileSetupRequired = portalProfileNeedsCompletion();
  const nav = isAdmin
    ? profileSetupRequired ? [["settings", "Complete Profile", "settings"]] : adminNav()
    : passwordSetupRequired
      ? [["settings", "Create Password", "settings"]]
      : profileSetupRequired
        ? [["settings", "Complete Profile", "settings"]]
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
      <p>${isAdmin ? "Office controls trainer pages, reviews, leads, clients, and reporting." : "Your public trainer page is managed by Lorenzo's office. Submit content for approval here."}</p>
      ${isAdmin
        ? `<button class="btn btn-outline btn-full" data-view="${isOfficeAdmin() ? "trainers" : "trainerPages"}">${isOfficeAdmin() ? "View Trainer List" : "Manage Trainer Pages"}</button>`
        : passwordSetupRequired
          ? `<p class="panel-copy">Create your permanent password to unlock the trainer portal.</p>`
          : profileSetupRequired
            ? `<p class="panel-copy">Save your first and last name so activity, edits, and office notes show the right person.</p>`
          : `<button class="btn btn-outline btn-full" data-view="submitMedia">Submit Content</button>`}
    </div>
    <div class="side-user">
      ${avatarMarkup(portalUser, isAdmin ? "LO" : initials(trainerById(currentTrainerId()).name))}
      <div><strong>${escapeHtml(isAdmin ? portalDisplayName(portalUser) : trainerById(currentTrainerId()).name)}</strong><span>${escapeHtml(isAdmin ? portalUserEmail(portalUser) || portalPermissionLabel(portalUser) : "Certified Trainer")}</span></div>
    </div>`;
}

function renderTopbar() {
  const isAdmin = session.role === "admin";
  const passwordSetupRequired = Boolean(portalUser?.must_change_password);
  const profileSetupRequired = portalProfileNeedsCompletion();
  const titles = isAdmin ? {
    dashboard: ["Admin Dashboard", "Network performance, lead outcomes, and conversion reporting."],
    trainerPages: ["Trainer Landing Pages", "Three approved designs, page performance, publishing, and locking."],
    pageEditor: ["Full Site Builder", "Edit trainer pages, main website pages, and trainer portal screens with a real-time preview."],
    trainers: ["Trainer Onboarding", "Collect the trainer's account, media, credentials, reviews, SEO, and approved design."],
    leads: ["Leads", "Office-managed funnel from inquiry to paying client."],
    applications: ["Trainer Applications", "Recruiting submissions from the website application form."],
    clients: ["Client Database", "Central list for active, past, won, lost, bad lead, and do-not-contact records."],
    import: ["Client Import", "Prototype CSV import with preview, duplicate checks, and consent protection."],
    approvals: ["Trainer Reviews", "Read the complete review, inspect attached photos or videos, and publish or reject each submission."],
    reports: ["Conversion Reports", "Conversions use confirmed lifecycle events and never browser-only counters."],
    adLandingPages: ["Ad Landing Pages", "Super Admin tracking for paid-ad market pages, traffic, form submissions, time on page, and conversion."],
    portalAccess: ["Portal Access", "Super Admin controls for staff, office admin, and trainer login access."],
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
    ? ["Secure Your Account", "Enter your name and replace the temporary password before using the portal."]
    : profileSetupRequired
      ? ["Complete Your Portal Profile", "Enter and save your first and last name so reports, site edits, leads, and application notes show the right staff identity."]
    : titles[state.activeView] || titles.dashboard;
  document.getElementById("topbar").innerHTML = `
    <div class="page-title"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(sub)}</p></div>
    <div class="top-actions">
      ${remoteSyncError ? `<span class="status lost" title="${escapeHtml(remoteSyncError)}">Live data unavailable</span>` : remoteReady ? `<span class="status live" title="Revision ${escapeHtml(remoteServerRevision)}">Synced ${escapeHtml(remoteSyncedAt ? formatDateTime(remoteSyncedAt) : "now")}</span>` : ""}
      ${isAdmin
        ? profileSetupRequired ? "" : `${isOfficeAdmin() ? "" : `<button class="btn btn-red add-trainer-primary" id="addTrainer">+ Add New Trainer</button>`}${isOfficeAdmin() ? "" : `<button class="btn btn-outline" data-open-client-import>Import Clients</button>`}`
        : passwordSetupRequired
          ? ""
          : profileSetupRequired
            ? ""
          : `<a class="btn btn-outline" href="${trainerPageHref(currentTrainerId())}" target="_blank" rel="noopener">Open My Page</a><button class="btn btn-red" data-view="submitMedia">Submit Content</button>`}
      <button class="profile-chip">${avatarMarkup(portalUser, isAdmin ? "LO" : initials(trainerById(currentTrainerId()).name))}<span><strong>${escapeHtml(portalDisplayName(portalUser))}</strong><small>${isAdmin ? portalPermissionLabel(portalUser) : "Trainer"}</small></span></button>
    </div>`;
}

function renderView() {
  const target = document.getElementById("workspaceView");
  const screens = session.role === "admin" ? adminScreens : trainerScreens;
  if (portalUser?.must_change_password) {
    state.activeView = "settings";
  }
  if (portalProfileNeedsCompletion()) {
    state.activeView = "settings";
  }
  if (session.role === "admin" && !canAccessAdminView(state.activeView)) state.activeView = "dashboard";
  target.innerHTML = screens[state.activeView]?.() || screens.dashboard();
}

const adminScreens = {
  dashboard() {
    const metrics = getMetrics();
    return `
      ${reportDateControls()}
      <p class="panel-copy report-range-note">Dashboard numbers use the live lead and trainer-application rows for ${escapeHtml(reportRangeLabel())}, so changing the report filter changes these counts. Last live sync: ${escapeHtml(remoteSyncedAt ? formatDateTime(remoteSyncedAt) : "not available")}.</p>
      ${metricGrid([
        ["monitor", "Site Visits/Clicks", metrics.visits, "Traffic only", "", { view: "reports" }],
        ["lead", "Form Submissions", metrics.forms, "Actual lead rows", "", { view: "leads" }],
        ["lead", "Contact Us Forms", metrics.contactForms, "Lead source", "", { view: "leads" }],
        ["lead", "Paid Ad Submitted Inquiries", metrics.paidAdSubmittedInquiries, "Ad landing pages", "", { view: "leads" }],
        ["lead", "Ebook Requests", metrics.ebookRequests, "Guide downloads", "", { view: "leads" }],
        ["trophy", "Became a Client", metrics.clientWon, "Current lead outcome", "up", { view: "clients" }],
        ["settings", "Lost", metrics.lostLeads, "Lead section total", "down", { view: "leads" }],
        ["message", "New Trainer Applications", metrics.newTrainerApplications, "Application rows", "up", { view: "applications" }],
        ["report", "Office Notes", metrics.officeNotes, "Saved note rows", "", { view: "reports" }]
      ])}
      <div class="dashboard-grid">
        ${panel("Dashboard Buckets", "", leadSummary())}
        ${panel("Lead Status Updates", "", leadOutcomeTable(filteredReportLeadRows()))}
      </div>`;
  },
  trainerPages() {
    return `${panel("Three Approved Trainer Landing Page Designs", "", approvedLayoutCards(), "pad")}<br>${panel("Trainer Page Control & Performance", `<button class="btn btn-red" id="addTrainer">Onboard New Trainer</button>`, trainerPageCards())}<br>${panel("Recent Trainer Page Activity", "", trainerSiteActivityTable(), "pad")}`;
  },
  pageEditor() {
    return trainerPageEditor();
  },
  trainers() {
    return isOfficeAdmin()
      ? panel("Trainer Directory (View Only)", "", trainerReadOnlyDirectory(), "pad")
      : `${trainerAdminForm()}<br>${panel("Existing Trainer Profiles", `<button class="btn btn-red" id="addTrainer">+ Add New Trainer</button>`, trainerSelectList(), "pad")}`;
  },
  leads() {
    return `${leadSourceRecordNotice()}${panel("Office Lead Pipeline", leadPanelActions(), leadPipelineTable(true), "pad")}`;
  },
  applications() {
    const apps = applicationRows();
    const needsAction = apps.filter(applicationNeedsAction).length;
    return `${metricGrid([
      ["message", "Applications", apps.length, "Website submissions", ""],
      ["lead", "Needs Action", needsAction, "No office action yet", needsAction ? "down" : "up"],
      ["calendar", "Discovery Call Inquiry", apps.filter(app => app.status === "Discovery Call Inquiry").length, "Recruiting action", "up"],
      ["trophy", "Moved Forward", apps.filter(app => app.status === "Moved Forward").length, "Qualified", "up"]
    ])}${applicationStatusFilterBar()}${panel("Trainer Application Pipeline", `<button class="btn btn-outline" type="button" data-application-mode="sheet">View Sheet</button><button class="btn btn-outline" type="button" data-application-mode="summary">View Data In Charts</button><button class="btn btn-outline" type="button" data-export-applications>Download Sheet</button>`, applicationPipelineBoard(), "pad")}<br>${panel("Application Sheet, Charts & Export", "", trainerApplicationGoogleFormPanel(), "pad")}<br>${panel("Trainer Application Records", "", applicationTable(), "pad")}`;
  },
  clients() {
    const importer = isOfficeAdmin() ? "" : `<details class="client-import-panel" id="clientImportPanel"><summary>Import Existing Clients</summary><div class="import-layout">${panel("1. Upload CSV, Excel, or PDF", `<button class="btn btn-outline" id="loadSampleCsv">Load Sample</button>`, importInput(), "pad")}${panel("2. Preview Before Import", `<button class="btn btn-red" id="previewImport">Preview Import</button>`, importPreview(), "pad")}</div></details>`;
    return `${clientFilterBar()}${panel("Won / Paid Lead Queue", `<button class="btn btn-outline" data-view="leads">Open Lead Pipeline</button>`, convertedLeadQueue(), "pad")}<br>${panel("Central Client Database", `<button class="btn btn-outline" data-export-operational="clients">Download Client Sheet</button>${isOfficeAdmin() ? "" : `<button class="btn btn-red" data-open-client-import>Import Clients</button>`}`, clientTable(), "pad")}${importer}`;
  },
  import() {
    return `<div class="import-layout">${panel("1. Paste CSV / Spreadsheet Data", `<button class="btn btn-outline" id="loadSampleCsv">Load Sample</button>`, importInput(), "pad")}${panel("2. Preview Before Import", `<button class="btn btn-red" id="previewImport">Preview Import</button>`, importPreview(), "pad")}</div>`;
  },
  approvals() {
    return panel("Trainer Review Inbox", "", submissionsTable(true, "review"), "pad");
  },
  reports() {
    const metrics = getMetrics();
    return `
      ${reportDateControls()}
      <p class="panel-copy report-range-note">Reports are filtered to ${escapeHtml(reportRangeLabel())}. Each record is counted once per confirmed lifecycle milestone.</p>
      ${metricGrid([
        ["monitor", "Visits", metrics.visits, "Not conversion", ""],
        ["lead", "Inquiries", metrics.forms, "Not conversion", ""],
        ["calendar", "Evaluation Complete", metrics.evalCompleted, "Funnel", "up"],
        ["trophy", "True Conversions", metrics.trueConversions, "Became a Client", "up"]
      ])}
      <div class="reports-stack">${panel("State Activity Map", "", regionClickReport(), "pad")}</div>
      <div class="dashboard-grid reports-grid">${panel("Clicks By Trainer", "", trainerClickReport(), "pad")}${panel("Conversion By Trainer", "", trainerPerformanceTable(), "pad")}</div>
      <div class="reports-stack">${panel("Lost Reasons", "", lostReasonsTable(), "pad")}</div>
      ${panel("Recent Activity Log", `${isSuperAdmin() ? `<button class="btn btn-outline" type="button" data-clear-activity-log>Clear Local Log</button>` : ""}`, recentActivityTable(), "pad")}
      ${panel("Reporting Rule", "", `<p class="panel-copy">Conversions are counted only from the immutable <strong>Became a Client</strong> lifecycle event. Clicks and form submissions stay visible as traffic and inquiry metrics, but they do not inflate conversion reporting.</p>`, "pad")}`;
  },
  adLandingPages() {
    if (!isSuperAdmin()) return panel("Ad Landing Pages", "", `<p class="panel-copy">This section is available only to Super Admin accounts.</p>`, "pad");
    return `
      ${reportDateControls()}
      <p class="panel-copy report-range-note">Paid-ad landing performance is filtered to ${escapeHtml(reportRangeLabel())}. Form conversion here means a submitted lead form from the market page. Paying-client conversion still lives in the main reports.</p>
      ${adLandingPageSummary()}
      ${panel("Market Page Performance", "", adLandingPageTable(), "pad")}
      ${panel("Top Markets By Lead Volume", "", adLandingRegionBars(), "pad")}`;
  },
  portalAccess() {
    return portalAccessScreen();
  },
    settings() {
    return panel("Settings", "", `${portalUser?.must_change_password ? `${passwordSetupForm()}<hr>` : ""}${portalProfileForm()}<hr><p class="panel-copy"><strong>Supabase connected.</strong> Leads, applications, clients, approvals, trainer access, profiles, reporting, and trainer-page publishing are shared across authorized office devices. Google Sheets and FormSubmit remain separate delivery backups for website forms.</p>${savedPortalShortcutHelp()}${liveDataReferenceLinks()}<br><button class="btn btn-red" id="logoutBtn">Log Out</button>`, "pad");
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
    const leads = filteredLeadRows(trainerLeads(trainer.id), { useWorkspaceFilters: false });
    const trueConversions = leads.filter(l => conversionStatuses().includes(l.status)).length;
    return `${metricGrid([
      ["lead", "Leads In Range", leads.length, leadRangeLabel(), ""],
      ["calendar", "Evaluation Complete", leads.filter(l => l.status === "Evaluation Complete").length, "Office status", "up"],
      ["trophy", "Won / Paid", trueConversions, "True conversion", "up"],
      ["monitor", "Page Forms", realTrainerStats(trainer, { allTime: true }).forms, "Canonical total", ""]
    ])}${panel("Lead Performance By Date Range", "", leadPipelineTable(false), "pad")}${panel("Performance Notes", "", `<p class="panel-copy">These numbers are read-only for trainers. Lorenzo's office owns lead statuses and conversion rules, while this tab lets the trainer review lead activity by last 7 days, last 30 days, last 60 days, or a custom date range.</p>`, "pad")}`;
  },
  submitMedia() {
    return `<div class="dashboard-grid">${panel("Submit Photos / Videos", `<button class="btn btn-red" id="submitDemoContent" data-submit-kind="media">Submit For Approval</button>`, submissionForm("media"), "pad")}${panel("My Photo / Video Status", "", submissionsTable(false, "media"), "pad")}</div>`;
  },
  submitReviews() {
    return `<div class="dashboard-grid">${panel("Submit Review / Testimonial", `<button class="btn btn-red" id="submitDemoContent" data-submit-kind="review">Submit For Approval</button>`, submissionForm("review"), "pad")}${panel("My Review Status", "", submissionsTable(false, "review"), "pad")}</div>`;
  },
  settings() {
    const trainer = trainerById(currentTrainerId());
    return panel("Trainer Settings", "", `${portalUser?.must_change_password ? `${passwordSetupForm()}<hr>` : ""}${portalProfileForm()}<hr><p class="panel-copy">Your profile and public page are managed by Lorenzo's office. Trainers can update only social media links shown in the locked landing-page footer.</p>${trainerSocialSettingsForm(trainer)}${savedPortalShortcutHelp()}<br><button class="btn btn-red" id="logoutBtn">Log Out</button>`, "pad");
  }
};

function savedPortalShortcutHelp() {
  return `<section class="saved-portal-help"><h3>Using a saved Staff Portal shortcut?</h3><ol><li>Open <a href="https://www.lorenzosdogtrainingteam.com/staff" target="_blank" rel="noopener">www.lorenzosdogtrainingteam.com/staff</a>.</li><li>Sign out and sign in once so the shortcut uses the current live session.</li><li>If an old shortcut opens any other address, remove it before saving the live Staff Portal again.</li><li>On iPhone: remove the old Home Screen icon, open the live address in Safari, then use Share and Add to Home Screen.</li><li>On Mac: remove the old dock or browser shortcut, open the live address, then add it again.</li><li>Confirm the top of the portal says <strong>Synced</strong>. If it says <strong>Live data unavailable</strong>, reload before making edits.</li></ol></section>`;
}

function liveDataReferenceLinks() {
  const projectUrl = "https://supabase.com/dashboard/project/ptnzaeprvkgjgtupmcty";
  const tables = [
    ["Leads", "leads"],
    ["Applications / Recruiting", "trainer_applications"],
    ["Clients", "clients"],
    ["Office Notes", "office_notes"],
    ["Form Delivery Audit", "form_delivery_attempts"]
  ];
  return `<section class="source-record-note live-data-links">
    <span class="status live">Live Supabase backup links</span>
    <p>Use these as a direct backup view if the portal or Google Sheet is being checked. Supabase sign-in is required.</p>
    <div class="live-data-link-row"><a class="btn btn-outline btn-small" href="${projectUrl}/editor" target="_blank" rel="noopener">Open Table Editor</a>${tables.map(([label, table]) => `<a class="btn btn-outline btn-small" href="${projectUrl}/editor?schema=public&table=${encodeURIComponent(table)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`).join("")}</div>
  </section>`;
}

function portalAccessScreen() {
  if (!isSuperAdmin()) return panel("Portal Access", "", `<p class="panel-copy">This section is available only to Super Admin accounts.</p>`, "pad");
  const rows = portalAccessRows();
  const activeRows = rows.filter(portalUserHasAccess);
  const disabledRows = rows.filter(user => !portalUserHasAccess(user));
  const superAdmins = rows.filter(user => portalPermissionValue(user) === "super_admin");
  return `${metricGrid([
    ["shield", "Super Admins", superAdmins.length, "Full access", ""],
    ["users", "Office Admins", rows.filter(user => portalPermissionValue(user) === "office_admin").length, "Office operations", ""],
    ["lead", "Trainer Accounts", rows.filter(user => portalPermissionValue(user) === "trainer").length, "Trainer portal", ""],
    ["settings", "Disabled / Pending", disabledRows.length, "No login access", disabledRows.length ? "down" : "up"]
  ])}${panel("Staff Access", `<button class="btn btn-outline" type="button" data-view="settings">My Profile</button>`, portalAccessTable(rows), "pad")}<br>${panel("Permission Rules", "", `<div class="portal-permission-grid"><article><strong>Super Admin</strong><p>Full access to settings, users, trainers, reports, system management, disabling accounts, and permission changes.</p></article><article><strong>Office Admin</strong><p>Day-to-day office operations: trainers, leads, appointments, communications, reports, reviews, applications, and clients.</p></article><article><strong>Trainer</strong><p>Only their own dashboard, assigned leads, schedule/profile basics, training records, and communications with assigned leads.</p></article></div><p class="panel-copy">Disable or revoke access instead of deleting. Records, lead history, notes, reviews, and reporting stay intact.</p>`, "pad")}`;
}

function portalAccessTable(rows) {
  return `<div class="table-wrap portal-access-wrap"><table class="data-table portal-access-table"><thead><tr><th>Person</th><th>Permission</th><th>Status</th><th>Login</th><th>Profile Photo</th><th>Password</th><th>Actions</th></tr></thead><tbody>${rows.map(user => {
    const userId = escapeHtml(user.user_id || "");
    const email = portalUserEmail(user);
    const isDerived = Boolean(user.derived);
    const permission = portalPermissionValue(user);
    const active = portalUserHasAccess(user);
    const initialsValue = initials(portalDisplayName(user));
    return `<tr>
      <td>
        <div class="row-person portal-person">
          ${avatarMarkup(user, initialsValue)}
          <div>
            <input class="inline-name-input" data-portal-display-name="${userId}" value="${escapeHtml(portalDisplayName(user))}" ${isDerived ? "disabled" : ""}>
            <small>${escapeHtml(email || user.user_id || "Email not stored yet")}</small>
            ${isDerived ? `<small class="muted-note">Directory / trainer record only. Create or publish the account to enable live edits.</small>` : ""}
            ${portalUserDetailDisclosure(user)}
          </div>
        </div>
      </td>
      <td>
        <select class="select-pill" data-portal-role="${userId}">
          <option value="super_admin" ${permission === "super_admin" ? "selected" : ""}>Super Admin</option>
          <option value="office_admin" ${permission === "office_admin" ? "selected" : ""}>Office Admin</option>
          <option value="trainer" ${permission === "trainer" ? "selected" : ""}>Trainer</option>
        </select>
      </td>
      <td><span class="status ${active ? "won" : "lost"}">${active ? "Active" : statusText(user)}</span></td>
      <td>${portalLoginStatusMarkup(user)}</td>
      <td><label class="mini-upload">Upload Photo<input type="file" accept="image/*" data-portal-photo-upload="${userId}" ${isDerived ? "disabled" : ""}></label></td>
      <td><div class="portal-password-cell"><strong>${escapeHtml(portalPasswordStatus(user))}</strong><small>Current passwords are protected by Supabase and cannot be viewed.</small><button class="btn btn-outline btn-small" type="button" data-portal-access-action="reset-password" data-portal-user="${userId}" ${isDerived ? "disabled" : ""}>Reset Password</button></div></td>
      <td><div class="row-actions">
        ${active
          ? `<button class="btn btn-outline btn-small" type="button" data-portal-access-action="disable" data-portal-user="${userId}">Disable</button><button class="btn btn-outline btn-small danger" type="button" data-portal-access-action="revoke" data-portal-user="${userId}">Revoke</button>`
          : `<button class="btn btn-red btn-small" type="button" data-portal-access-action="restore" data-portal-user="${userId}">Restore</button>`}
      </div></td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">No portal users loaded yet.</td></tr>`}</tbody></table></div>`;
}

function portalPasswordStatus(user) {
  if (isDerivedPortalUser(user)) return "No live login";
  if (user?.must_change_password) return "Temporary password pending";
  return "Protected";
}

function portalAuthDate(user, key) {
  const value = user?.[key] || "";
  return value ? formatDateTime(value) : "Not recorded";
}

function portalLoginStatusMarkup(user) {
  if (isDerivedPortalUser(user)) {
    return `<div class="portal-login-status"><span class="status lost">No login account</span><small>Create/publish access first</small></div>`;
  }
  const lastSignIn = user?.auth_last_sign_in_at || user?.last_sign_in_at || "";
  const loggedIn = Boolean(user?.auth_has_logged_in || lastSignIn);
  return `<div class="portal-login-status"><span class="status ${loggedIn ? "won" : "lost"}">${loggedIn ? "Logged in" : "No login yet"}</span><small>${escapeHtml(lastSignIn ? formatDateTime(lastSignIn) : "Last sign-in not recorded")}</small></div>`;
}

function portalUserDetailDisclosure(user) {
  const rows = [
    ["Email", portalUserEmail(user) || "Not stored"],
    ["Permission", portalPermissionLabel(user)],
    ["Linked trainer", trainerForPortalUser(user)?.name || "Not linked"],
    ["Login account", isDerivedPortalUser(user) ? "Not created yet" : "Live Supabase account"],
    ["Has logged in", user?.auth_has_logged_in || user?.auth_last_sign_in_at ? "Yes" : "No / not recorded"],
    ["Last sign-in", portalAuthDate(user, "auth_last_sign_in_at")],
    ["Account created", portalAuthDate(user, "auth_created_at")],
    ["Email confirmed", portalAuthDate(user, "auth_confirmed_at")],
    ["Portal updated", user?.updated_at ? formatDateTime(user.updated_at) : "Not recorded"],
    ["Password", portalPasswordStatus(user)]
  ];
  return `<details class="portal-user-details"><summary>More details</summary><div class="portal-detail-grid">${rows.map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("")}</div></details>`;
}

function statusText(user) {
  const value = String(user?.access_status || "").replaceAll("_", " ");
  if (value === "not created") return "Pending Account";
  if (value === "profile only") return "Profile Only";
  if (value) return value.replace(/\b\w/g, letter => letter.toUpperCase());
  return user?.active === false ? "Disabled" : "Active";
}

function portalProfileForm() {
  const displayName = portalDisplayName(portalUser);
  const { firstName, lastName } = portalSuggestedNameParts(portalUser);
  const email = portalUserEmail(portalUser);
  const needsCompletion = portalProfileNeedsCompletion();
  return `<form id="portalProfileForm" class="portal-profile-form"><div class="portal-profile-card">
    <div class="portal-profile-photo">${avatarMarkup(portalUser, initials(displayName))}</div>
    <div>
      <h3>My Portal Profile</h3>
      <p class="panel-copy">This name and photo identify staff or trainers inside the portal. It does not change public trainer page content unless the office updates the trainer profile separately.</p>
      ${needsCompletion ? `<div class="source-record-note"><span class="status pending">Profile required</span><p>Enter and save your first and last name so Recent Activity, site edits, lead notes, and application notes show the actual staff member.</p></div>` : ""}
      ${email ? `<p class="panel-copy"><strong>Email:</strong> ${escapeHtml(email)}</p>` : ""}
      <div class="form-grid-two">
        <label>First Name<input required name="firstName" value="${escapeHtml(firstName)}" autocomplete="given-name"></label>
        <label>Last Name<input required name="lastName" value="${escapeHtml(lastName)}" autocomplete="family-name"></label>
        <label>Profile Photo<input name="profilePhoto" type="file" accept="image/*"></label>
      </div>
      <button class="btn btn-outline" type="submit">Save Profile</button>
      <span id="portalProfileStatus" class="inline-status" role="status" aria-live="polite"></span>
    </div>
  </div></form>`;
}

function trainerSocialSettingsForm(trainer) {
  const socials = trainer?.socials || {};
  return `<section class="trainer-social-settings"><h3>Landing Page Social Links</h3><p class="panel-copy">Add full profile URLs. Empty links stay as inactive placeholders.</p><div class="form-grid">
    <label>Facebook<input data-trainer-social-link="facebook" type="url" placeholder="https://facebook.com/yourprofile" value="${escapeHtml(socials.facebook || "")}"></label>
    <label>Instagram<input data-trainer-social-link="instagram" type="url" placeholder="https://instagram.com/yourprofile" value="${escapeHtml(socials.instagram || "")}"></label>
    <label>TikTok<input data-trainer-social-link="tiktok" type="url" placeholder="https://tiktok.com/@yourprofile" value="${escapeHtml(socials.tiktok || "")}"></label>
  </div><div class="social-settings-preview">${trainerSocialMarkup(trainer)}</div></section>`;
}

function passwordSetupForm() {
  const [firstName = "", ...rest] = String(portalUser?.display_name || "").replace(/\([^)]*\)/g, "").trim().split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ");
  return `<form id="changePasswordForm" class="password-change-form"><h3>Create your permanent password</h3><p class="panel-copy">Your temporary password worked. Confirm your name and choose a permanent password before continuing.</p><div class="form-grid-two"><label>First Name<input required name="firstName" autocomplete="given-name" value="${escapeHtml(firstName || "")}"></label><label>Last Name<input required name="lastName" autocomplete="family-name" value="${escapeHtml(lastName || "")}"></label></div><label>New Password<input required minlength="10" name="password" type="password" autocomplete="new-password"></label><label>Confirm Password<input required minlength="10" name="confirmation" type="password" autocomplete="new-password"></label><button class="btn btn-red" type="submit">Save Permanent Password</button><div id="passwordStatus" role="status" aria-live="polite"></div></form>`;
}

function metricGrid(items) {
  return `<div class="metrics-grid ${items.length === 4 ? "trainer-metrics" : ""}">${items.map(([iconName, label, value, change, tone, action]) => {
    const body = `<div class="metric-top">${icon(iconName)} ${escapeHtml(label)}</div><strong>${escapeHtml(value)}</strong><span class="${escapeHtml(tone || "")}">${escapeHtml(change)}</span>`;
    return action?.view
      ? `<button class="metric-card metric-button" type="button" data-view="${escapeHtml(action.view)}">${body}</button>`
      : `<article class="metric-card">${body}</article>`;
  }).join("")}</div>`;
}

function panel(title, action, body, extra = "") {
  return `<section class="panel ${extra}"><div class="panel-head"><h2>${title}</h2><div class="row-actions">${action || ""}</div></div>${extra === "pad" ? body : `<div>${body}</div>`}</section>`;
}

function parseRecordDate(value) {
  if (!value) return null;
  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateRangeWindow(kind = "report") {
  const range = kind === "lead" ? state.leadDateRange : state.reportDateRange;
  const customStart = kind === "lead" ? state.customLeadStart : state.customReportStart;
  const customEnd = kind === "lead" ? state.customLeadEnd : state.customReportEnd;
  const end = range === "custom" ? new Date(`${customEnd}T23:59:59`) : new Date();
  const days = Number(range || (kind === "lead" ? 60 : 30));
  const start = range === "custom"
    ? new Date(`${customStart}T00:00:00`)
    : new Date(end.getTime() - (days - 1) * 86400000);
  return { start, end };
}

function isWithinWindow(value, kind = "report") {
  const date = parseRecordDate(value);
  if (!date) return false;
  const { start, end } = dateRangeWindow(kind);
  return date >= start && date <= end;
}

function filteredReportLeadRows() {
  return realLeadRows().filter(lead => isWithinWindow(lead.createdAt, "report"));
}

function filteredReportApplicationRows() {
  return applicationRows().filter(app => isWithinWindow(app.receivedAt || app.createdAt, "report"));
}

function filteredReportOfficeNoteRows() {
  return (remoteOfficeNotes || []).filter(note => isWithinWindow(note.updated_at || note.created_at, "report"));
}

function filteredReportEventRows() {
  return siteEventRows().filter(event => isWithinWindow(event.timestamp || event.created_at, "report"));
}

function leadSubmissionBucket(lead = {}) {
  const raw = lead.rawPayload || lead.raw_payload || {};
  const text = [
    raw.lead_type,
    raw.lead_magnet,
    raw.service_interest,
    raw.i_want_to,
    lead.service,
    lead.source,
    raw.heard_about_us
  ].map(value => String(value || "").toLowerCase()).join(" ");
  if (/pdf|ebook|e-book|free guide|blueprint|download/.test(text)) return "Ebook requests";
  if (isPaidAdLandingPageLead(lead)) return "Paid Ad Submitted Inquiries";
  return "Contact Us forms";
}

function isPaidAdLandingPageLead(lead = {}) {
  const raw = lead.rawPayload || lead.raw_payload || {};
  const values = [
    raw.source_page,
    lead.sourcePageSlug,
    raw.page_path,
    raw.page_url,
    raw.landing_url,
    raw.landing_page,
    raw.page
  ].map(value => String(value || "").toLowerCase());
  if (raw.landing_page_type === "Paid ads market page" || raw.ad_market) return true;
  return adLandingPageConfigs()
    .filter(page => page.slug.startsWith("dog-training-"))
    .some(page => values.some(value => value.includes(page.slug.toLowerCase())));
}

function isEbookRequestLead(lead = {}) {
  const raw = lead.rawPayload || lead.raw_payload || {};
  const text = [
    raw.lead_type,
    raw.lead_magnet,
    raw.service_interest,
    raw.i_want_to,
    lead.service,
    raw.comments,
    lead.comments
  ].map(value => String(value || "").toLowerCase()).join(" ");
  return /pdf|ebook|e-book|free guide|blueprint|download/.test(text);
}

function formSubmissionBucketRows() {
  const rows = filteredReportLeadRows().filter(lead => lead.submitted !== false);
  const buckets = new Map([
    ["Contact Us forms", 0],
    ["Paid Ad Submitted Inquiries", 0],
    ["Ebook requests", 0]
  ]);
  rows.forEach(lead => buckets.set(leadSubmissionBucket(lead), (buckets.get(leadSubmissionBucket(lead)) || 0) + 1));
  return Array.from(buckets.entries());
}

function dashboardLostLeadRows(leadRows = filteredReportLeadRows()) {
  return leadRows.filter(lead => boardStatus(lead.status) === "Lost");
}

function dashboardSubmittedLeadRows() {
  return filteredReportLeadRows().filter(lead => lead.submitted !== false);
}

function dashboardPaidAdSubmittedInquiryRows(leadRows = dashboardSubmittedLeadRows()) {
  return leadRows.filter(isPaidAdLandingPageLead);
}

function dashboardEbookRequestRows(leadRows = dashboardSubmittedLeadRows()) {
  return leadRows.filter(lead => isPaidAdLandingPageLead(lead) && isEbookRequestLead(lead));
}

function dashboardContactFormRows(leadRows = dashboardSubmittedLeadRows()) {
  return leadRows.filter(lead => !isPaidAdLandingPageLead(lead));
}

function dashboardBucketRows() {
  const leadRows = dashboardSubmittedLeadRows();
  const appRows = filteredReportApplicationRows();
  const buckets = new Map([
    ["Contact Us forms", dashboardContactFormRows(leadRows).length],
    ["Paid Ad Submitted Inquiries", dashboardPaidAdSubmittedInquiryRows(leadRows).length],
    ["Ebook requests", dashboardEbookRequestRows(leadRows).length],
    ["Became a Client", leadRows.filter(lead => lead.status === "Became a Client").length],
    ["Lost", dashboardLostLeadRows(leadRows).length],
    ["New Trainer Applications", appRows.length]
  ]);
  return Array.from(buckets.entries());
}

function reportLifecycleRows() {
  return (remoteLifecycleEvents || []).filter(event =>
    event.event_type !== "qa_release_check"
    && event.raw_payload?.qa !== true
    && !/^qa[_-]/i.test(String(event.event_key || ""))
    && !/(?:localhost|127\.0\.0\.1|\.vercel\.app)(?::\d+)?(?:\/|$)/i.test(String(event.raw_payload?.page_url || ""))
  );
}

function getMetrics() {
  const lifecycle = reportLifecycleRows().filter(event => isWithinWindow(event.occurred_at || event.created_at, "report"));
  const count = type => new Set(lifecycle
    .filter(event => event.event_type === type)
    .map(event => `${event.entity_type || "event"}:${event.entity_id || event.event_key || event.id}`)).size;
  const leadRows = dashboardSubmittedLeadRows();
  const appRows = filteredReportApplicationRows();
  const bucketCounts = Object.fromEntries(dashboardBucketRows());
  return {
    visits: count("site_visit") + count("cta_click"),
    forms: leadRows.length,
    contactForms: bucketCounts["Contact Us forms"] || 0,
    paidAdSubmittedInquiries: bucketCounts["Paid Ad Submitted Inquiries"] || 0,
    ebookRequests: bucketCounts["Ebook requests"] || 0,
    evalScheduled: leadRows.filter(lead => lead.status === "Evaluation Scheduled").length,
    evalCompleted: leadRows.filter(lead => lead.status === "Evaluation Complete").length,
    clientWon: leadRows.filter(lead => lead.status === "Became a Client").length,
    trueConversions: leadRows.filter(lead => lead.status === "Became a Client").length,
    lostNoResponse: leadRows.filter(lead => lead.status === "Lost / No Response").length,
    lostLeads: dashboardLostLeadRows(leadRows).length,
    newTrainerApplications: appRows.length,
    officeNotes: filteredReportOfficeNoteRows().length
  };
}

function allLeadRows() {
  return remoteReady ? state.leads : [...contactSubmissionRows(), ...state.leads];
}

function realLeadRows() {
  return remoteReady ? state.leads : contactSubmissionRows();
}

function siteEventRows() {
  const rows = remoteReady ? remoteEvents : storedRows(SITE_EVENT_KEY);
  return rows.filter(event =>
    event.raw_payload?.qa !== true
    && !/^qa[_-]/i.test(String(event.event_type || ""))
    && !/(?:localhost|127\.0\.0\.1|\.vercel\.app)(?::\d+)?(?:\/|$)/i.test(String(event.raw_payload?.page_url || ""))
  ).map(event => ({
    ...event,
    trainer_id: event.trainer_id || trainerIdFromSlug(event.trainer_slug) || trainerIdFromName(event.assigned_trainer),
    event_type: event.event_type || "trainer_page_view",
    trainer_city: event.trainer_city || cityFromMarket(event.trainer_market),
    trainer_state: event.trainer_state || stateFromMarket(event.trainer_market),
    timestamp: event.timestamp || event.created_at || new Date().toISOString(),
    page_url: event.page_url || event.raw_payload?.page_url || "",
    time_on_page_seconds: Number(event.time_on_page_seconds || event.raw_payload?.time_on_page_seconds || 0)
  }));
}

function realTrainerStats(trainer, options = {}) {
  const eventsBase = options.allTime ? siteEventRows() : filteredReportEventRows();
  const leadsBase = options.allTime ? realLeadRows() : filteredReportLeadRows();
  const events = eventsBase.filter(event => sameTrainerEvent(event, trainer));
  const leads = leadsBase.filter(lead => lead.trainerId === trainer.id || lead.trainerId === trainer.slug || lead.trainerId === trainer.pageSlug);
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

const US_STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia"
};
const US_STATE_ABBREVIATIONS = Object.fromEntries(Object.entries(US_STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code]));
const STATE_TILE_LAYOUT = [
  ["AK", "", "", "", "", "", "", "", "", "", "ME"],
  ["", "", "", "", "", "", "", "", "VT", "NH", ""],
  ["WA", "ID", "MT", "ND", "MN", "IL", "WI", "MI", "NY", "MA", "RI"],
  ["OR", "NV", "WY", "SD", "IA", "IN", "OH", "PA", "NJ", "CT", ""],
  ["CA", "UT", "CO", "NE", "MO", "KY", "WV", "VA", "MD", "DE", ""],
  ["", "AZ", "NM", "KS", "AR", "TN", "NC", "SC", "", "", ""],
  ["HI", "", "", "OK", "LA", "MS", "AL", "GA", "", "", ""],
  ["", "", "", "TX", "", "", "", "FL", "", "", ""]
];

function fullStateName(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";
  const abbreviation = clean.toUpperCase();
  if (US_STATE_NAMES[abbreviation]) return US_STATE_NAMES[abbreviation];
  return Object.values(US_STATE_NAMES).find(name => name.toLowerCase() === clean.toLowerCase()) || clean;
}

function stateCodeFromValue(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";
  const upper = clean.toUpperCase();
  if (US_STATE_NAMES[upper]) return upper;
  return US_STATE_ABBREVIATIONS[clean.toLowerCase()] || "";
}

function stateCodeFromEvent(event = {}) {
  const raw = event.raw_payload || {};
  return stateCodeFromValue(
    event.trainer_state
    || raw.trainer_state
    || raw.market_state
    || raw.state
    || stateFromMarket(event.trainer_market || raw.trainer_market || raw.ad_market || raw.market)
  );
}

function stateCodeFromLead(lead = {}) {
  const raw = lead.rawPayload || lead.raw_payload || {};
  const derived = deriveLeadMarket({
    city: lead.city || cityFromAddress(lead.address),
    state: lead.state || stateFromAddress(lead.address),
    market: lead.market,
    rawPayload: raw
  });
  return stateCodeFromValue(derived.state || raw.market_state || stateFromMarket(raw.ad_market || raw.trainer_market || raw.market));
}

function normalizeTrainerLocation(market = "", state = "") {
  const cleanMarket = String(market || "").trim();
  const parts = cleanMarket.split(",").map(part => part.trim()).filter(Boolean);
  const marketState = parts.length > 1 ? parts.at(-1) : "";
  const normalizedState = fullStateName(state || marketState);
  let city = parts.length > 1 ? parts.slice(0, -1).join(", ") : cleanMarket;
  if (normalizedState && city) {
    const suffixes = [normalizedState, ...Object.entries(US_STATE_NAMES).filter(([, name]) => name === normalizedState).map(([code]) => code)];
    suffixes.forEach(suffix => {
      city = city.replace(new RegExp(`(?:,|\\s)\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "").trim();
    });
  }
  return { market: city || cleanMarket, state: normalizedState };
}

function stateFromMarket(market = "") {
  const parts = String(market).split(",");
  return parts.length > 1 ? parts[1].trim() : "";
}

function cleanLocationValue(value = "") {
  const text = String(value || "").trim();
  return /^(office to collect|office routed|pending|address pending|not captured|unknown|—)$/i.test(text) ? "" : text;
}

function splitMarket(market = "") {
  const text = String(market || "").trim();
  if (!text) return { city: "", state: "", market: "" };
  const parts = text.split(",").map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) return { city: text, state: "", market: text };
  return { city: parts.slice(0, -1).join(", "), state: parts[parts.length - 1], market: text };
}

function adPageFromLeadPayload(raw = {}) {
  const values = [
    raw.source_page,
    raw.page_url,
    raw.landing_page,
    raw.page_path
  ].map(value => String(value || "").toLowerCase());
  return adLandingPageConfigs().find(page => values.some(value => value.includes(page.slug)))
    || (raw.landing_page_type === "Paid ads market page"
      ? adLandingPageConfigs().find(page => String(raw.ad_market || "").toLowerCase() === page.market.toLowerCase())
      : null)
    || null;
}

function deriveLeadMarket(fields = {}) {
  const raw = fields.rawPayload || fields.raw || {};
  const page = adPageFromLeadPayload(raw);
  const explicitMarket = cleanLocationValue(raw.ad_market || raw.trainer_market || raw.market || fields.market);
  const explicit = splitMarket(explicitMarket);
  const city = cleanLocationValue(fields.city || raw.city || explicit.city || page?.label);
  const stateValue = cleanLocationValue(fields.state || raw.state || explicit.state || stateFromMarket(page?.market || ""));
  const market = explicit.market || (city && stateValue ? `${city}, ${stateValue}` : page?.market || "");
  return {
    city,
    state: stateValue,
    market,
    pageLabel: page?.label || "",
    pageSlug: page?.slug || ""
  };
}

function leadMarketLabel(lead = {}) {
  const derived = deriveLeadMarket({
    city: lead.city,
    state: lead.state,
    market: lead.market,
    rawPayload: lead.rawPayload || {}
  });
  return derived.market || [derived.city, derived.state].filter(Boolean).join(", ") || "Market pending";
}

function leadSourceLabel(lead = {}) {
  const raw = lead.rawPayload || {};
  const derived = deriveLeadMarket({ city: lead.city, state: lead.state, rawPayload: raw });
  if (derived.pageLabel) return `${derived.pageLabel} ad page`;
  return lead.source || "Website";
}

function isUnengagedLead(lead = {}) {
  return normalizeLeadStatus(lead.status) === "New Inquiry" && !lead.doNotContact;
}

function unengagedLeadRows() {
  return realLeadRows().filter(isUnengagedLead);
}

function trainerPerformanceTable() {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Trainer</th><th>Page Status</th><th>Clicks</th><th>Forms</th><th>True Conversions</th><th>Rate</th></tr></thead><tbody>${state.trainers.map(trainer => {
    const stats = realTrainerStats(trainer);
    const rate = stats.forms ? `${Math.round((stats.conversions / stats.forms) * 1000) / 10}%` : "0%";
    return `<tr><td><div class="row-person"><span class="avatar">${initials(trainer.name)}</span><div><strong>${escapeHtml(trainer.name)}</strong><small>${escapeHtml(trainer.market)}</small></div></div></td><td>${pageStatusBadge(trainer)}</td><td><strong>${stats.clicks}</strong></td><td><strong>${stats.forms}</strong></td><td><strong>${stats.conversions}</strong></td><td>${rate}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function regionClickReport() {
  const rows = stateActivityRows();
  const activeRows = rows.filter(row => row.total > 0).sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
  const max = Math.max(1, ...rows.map(row => row.total));
  const rowByCode = new Map(rows.map(row => [row.code, row]));
  const tiles = STATE_TILE_LAYOUT.map(row => `<div class="us-state-tile-row">${row.map(code => {
    if (!code) return `<span class="us-state-tile-spacer" aria-hidden="true"></span>`;
    const state = rowByCode.get(code) || { code, name: US_STATE_NAMES[code], clicks: 0, leads: 0, total: 0 };
    const intensity = state.total ? Math.min(.92, .12 + (state.total / max) * .74) : 0;
    return `<span class="us-state-tile ${state.total ? "active" : ""}" style="--state-fill:rgba(216,13,54,${intensity.toFixed(2)})" title="${escapeHtml(`${state.name}: ${state.total} total (${state.clicks} page events, ${state.leads} leads)`)}"><strong>${code}</strong><b>${state.total}</b></span>`;
  }).join("")}</div>`).join("");
  return `<div class="region-map-report">
    <div class="us-state-map-card" role="img" aria-label="United States activity map with visible counts by state">
      <div class="state-map-heading">
        <div><span>50-state report</span><h3>Activity by State</h3></div>
        <strong>${activeRows.reduce((sum, row) => sum + row.total, 0)}</strong>
      </div>
      <div class="us-state-tile-map">${tiles}</div>
      <p class="panel-copy">Each state number is page events plus submitted lead rows with that state attached for ${escapeHtml(reportRangeLabel())}.</p>
    </div>
    <div class="region-bars">${activeRows.map(row => `<article class="region-row"><div><strong>${escapeHtml(row.name)} (${escapeHtml(row.code)})</strong><span>${escapeHtml(`${row.clicks} page events · ${row.leads} submitted leads`)}</span></div><div class="region-meter"><span style="width:${Math.max(8, Math.round((row.total / max) * 100))}%"></span></div><b>${row.total}</b></article>`).join("") || `<p class="panel-copy">No state-level activity matches the current report filters yet.</p>`}</div>
  </div>`;
}

function stateActivityRows() {
  const rows = new Map(Object.entries(US_STATE_NAMES)
    .filter(([code]) => code !== "DC")
    .map(([code, name]) => [code, { code, name, clicks: 0, leads: 0, total: 0 }]));
  const ensure = code => {
    if (!code || code === "DC") return null;
    if (!rows.has(code)) rows.set(code, { code, name: US_STATE_NAMES[code] || code, clicks: 0, leads: 0, total: 0 });
    return rows.get(code);
  };
  filteredReportEventRows().forEach(event => {
    const row = ensure(stateCodeFromEvent(event));
    if (!row) return;
    row.clicks += 1;
    row.total += 1;
  });
  filteredReportLeadRows().forEach(lead => {
    const row = ensure(stateCodeFromLead(lead));
    if (!row) return;
    row.leads += 1;
    row.total += 1;
  });
  return [...rows.values()];
}

function trainerClickReport() {
  const rows = state.trainers.map(trainer => ({ trainer, stats: realTrainerStats(trainer) })).sort((a, b) => b.stats.clicks - a.stats.clicks);
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Trainer</th><th>City / State</th><th>Page Clicks</th><th>Forms</th><th>Last Click</th></tr></thead><tbody>${rows.map(({ trainer, stats }) => {
    const last = filteredReportEventRows().filter(event => sameTrainerEvent(event, trainer)).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return `<tr><td><strong>${escapeHtml(trainer.name)}</strong><small>${escapeHtml(trainer.pageSlug || trainer.slug || trainer.id)}</small></td><td>${escapeHtml(trainerCity(trainer))}, ${escapeHtml(trainer.state || stateFromMarket(trainer.market) || "—")}</td><td><strong>${stats.clicks}</strong></td><td>${stats.forms}</td><td>${last ? escapeHtml(new Date(last.timestamp).toLocaleString()) : "—"}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function regionClickRows() {
  const rows = new Map();
  filteredReportEventRows().filter(event => event.event_type === "trainer_page_view").forEach(event => {
    const trainer = findTrainer(event.trainer_id) || findTrainer(event.trainer_slug);
    const city = event.trainer_city || trainerCity(trainer) || "Unknown";
    const regionState = event.trainer_state || trainer?.state || stateFromMarket(trainer?.market) || "Unknown";
    const key = `${city}|${regionState}`;
    const row = rows.get(key) || { city, state: regionState, clicks: 0, trainerNames: new Set() };
    row.clicks += 1;
    if (event.assigned_trainer || trainer?.name) row.trainerNames.add(event.assigned_trainer || trainer.name);
    rows.set(key, row);
  });
  filteredReportLeadRows().forEach(lead => {
    const derived = deriveLeadMarket({ city: lead.city || cityFromAddress(lead.address), state: lead.state || stateFromAddress(lead.address), market: lead.market, rawPayload: lead.rawPayload || {} });
    const city = derived.city || cityFromAddress(lead.address);
    const regionState = derived.state || stateFromAddress(lead.address);
    if (!city && !regionState) return;
    const key = `${city || "Unknown"}|${regionState || "Unknown"}`;
    const row = rows.get(key) || { city: city || "Unknown", state: regionState || "Unknown", clicks: 0, trainerNames: new Set() };
    row.trainerNames.add(trainerName(lead.trainerId));
    rows.set(key, row);
  });
  return [...rows.values()].map(row => ({ ...row, trainerNames: [...row.trainerNames] })).sort((a, b) => b.clicks - a.clicks);
}

function adLandingPageConfigs() {
  return [
    { slug: "get-started", label: "Get Started", market: "Nationwide", trainers: "Office to assign", href: "../get-started.html" },
    { slug: "dog-training-cleveland-oh", label: "Cleveland / Akron", market: "Cleveland / Akron, OH", trainers: "Harley McGrew, Brady DeRemer", href: "../dog-training-cleveland-oh.html" },
    { slug: "dog-training-columbus-oh", label: "Columbus / Reynoldsburg", market: "Columbus / Reynoldsburg, OH", trainers: "Shannon Paskins", href: "../dog-training-columbus-oh.html" },
    { slug: "dog-training-chicago-il", label: "Chicago", market: "Chicago, IL", trainers: "Jasmine Bland", href: "../dog-training-chicago-il.html" },
    { slug: "dog-training-atlanta-ga", label: "Atlanta", market: "Atlanta, GA", trainers: "Aryson Whorley, Christopher Almonte, Chloe Chisolm", href: "../dog-training-atlanta-ga.html" },
    { slug: "dog-training-san-diego-ca", label: "San Diego", market: "San Diego, CA", trainers: "Genevieve Twilla, Karemela Sefferin, Fred Harris", href: "../dog-training-san-diego-ca.html" },
    { slug: "dog-training-san-antonio-tx", label: "San Antonio", market: "San Antonio, TX", trainers: "Giovanni Gutierrez, Carolina Perez", href: "../dog-training-san-antonio-tx.html" },
    { slug: "dog-training-lexington-ky", label: "Lexington / Harrodsburg", market: "Lexington / Harrodsburg, KY", trainers: "Bailey Brown", href: "../dog-training-lexington-ky.html" },
    { slug: "dog-training-tallahassee-fl", label: "Tallahassee", market: "Tallahassee, FL", trainers: "Victoria Morris", href: "../dog-training-tallahassee-fl.html" },
    { slug: "dog-training-miramar-beach-fl", label: "Miramar Beach", market: "Miramar Beach, FL", trainers: "Tabatha Shelley", href: "../dog-training-miramar-beach-fl.html" },
    { slug: "dog-training-ann-arbor-mi", label: "Ann Arbor", market: "Ann Arbor, MI", trainers: "Dylan Atkinson", href: "../dog-training-ann-arbor-mi.html" }
  ];
}

function valueMatchesPage(value, slug) {
  return String(value || "").toLowerCase().includes(slug.toLowerCase());
}

function adLandingPageStats(page) {
  const events = filteredReportEventRows().filter(event => {
    return valueMatchesPage(event.page_path, page.slug)
      || valueMatchesPage(event.page_url, page.slug)
      || valueMatchesPage(event.raw_payload?.page_url, page.slug)
      || (event.raw_payload?.landing_page_type === "Paid ads market page"
        && event.raw_payload?.ad_market === page.market);
  });
  const leads = filteredReportLeadRows().filter(lead => {
    const raw = lead.rawPayload || {};
    return raw.source_page === page.slug
      || valueMatchesPage(raw.page_url, page.slug)
      || valueMatchesPage(raw.source_page, page.slug)
      || valueMatchesPage(raw.page_path, page.slug)
      || (raw.landing_page_type === "Paid ads market page" && page.market === raw.ad_market);
  });
  const visits = events.filter(event => event.event_type === "market_page_view").length;
  const formEvents = events.filter(event => event.event_type === "market_form_submit").length;
  const timeEvents = events.filter(event => event.event_type === "market_page_time" && event.time_on_page_seconds);
  const visitors = new Set(events.map(event => event.visitor_id).filter(Boolean)).size;
  const avgTime = timeEvents.length
    ? Math.round(timeEvents.reduce((sum, event) => sum + Number(event.time_on_page_seconds || 0), 0) / timeEvents.length)
    : 0;
  const forms = Math.max(leads.length, formEvents);
  const paidClients = leads.filter(lead => conversionStatuses().includes(lead.status)).length;
  return {
    visits,
    visitors,
    forms,
    paidClients,
    avgTime,
    rate: visits ? Math.round((forms / visits) * 1000) / 10 : 0,
    lastActivity: events.concat(leads.map(lead => ({ timestamp: lead.createdAt }))).sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0))[0]
  };
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!value) return "Tracking";
  const mins = Math.floor(value / 60);
  const secs = value % 60;
  return mins ? `${mins}m ${String(secs).padStart(2, "0")}s` : `${secs}s`;
}

function adLandingPageSummary() {
  const rows = adLandingPageConfigs().map(page => adLandingPageStats(page));
  const visits = rows.reduce((sum, row) => sum + row.visits, 0);
  const forms = rows.reduce((sum, row) => sum + row.forms, 0);
  const clients = rows.reduce((sum, row) => sum + row.paidClients, 0);
  const avgTimeRows = rows.filter(row => row.avgTime);
  const avgTime = avgTimeRows.length ? Math.round(avgTimeRows.reduce((sum, row) => sum + row.avgTime, 0) / avgTimeRows.length) : 0;
  return `${metricGrid([
    ["monitor", "Tracked Ad Page Visits", visits, "Exact ad-page traffic", ""],
    ["lead", "Ad Leads Submitted", forms, "Short forms", "up"],
    ["trophy", "Paid Clients", clients, "Became a Client", "up"],
    ["calendar", "Avg. Time On Page", formatDuration(avgTime), "Tracked on exit", ""]
  ])}<div class="source-record-note"><span class="status live">First-party tracking</span><p>Visits shown here are page loads recorded directly on Lorenzo's paid-ad landing pages. Google Ads click totals remain a separate advertising-platform metric until a Google Ads or GA4 reporting connection is added.</p></div>`;
}

function adLandingPageTable() {
  const rows = adLandingPageConfigs().map(page => ({ page, stats: adLandingPageStats(page) }));
  return `<div class="table-wrap ad-page-table-wrap"><table class="data-table ad-page-table"><thead><tr><th>Market Page</th><th>Assigned Market</th><th>Ad Trainers</th><th>Visits / Clicks</th><th>Leads</th><th>Time</th><th>Form Conversion</th><th>Last Activity</th><th>Open</th></tr></thead><tbody>${rows.map(({ page, stats }) => `<tr><td><strong>${escapeHtml(page.label)}</strong><small>/${escapeHtml(page.slug)}</small></td><td>${escapeHtml(page.market)}</td><td>${escapeHtml(page.trainers)}</td><td><strong>${stats.visits}</strong><small>${stats.visitors} unique</small></td><td><strong>${stats.forms}</strong></td><td>${escapeHtml(formatDuration(stats.avgTime))}</td><td><div class="ad-conversion-cell"><span class="status ${stats.rate ? "won" : "draft"}">${stats.rate}%</span><div class="region-meter"><span style="width:${Math.max(3, Math.min(100, stats.rate))}%"></span></div></div></td><td>${stats.lastActivity ? escapeHtml(new Date(stats.lastActivity.timestamp || stats.lastActivity.createdAt).toLocaleString()) : "—"}</td><td><a class="btn btn-outline btn-small" href="${escapeHtml(page.href)}" target="_blank" rel="noopener">Open</a></td></tr>`).join("")}</tbody></table></div>`;
}

function adLandingRegionBars() {
  const rows = adLandingPageConfigs()
    .map(page => ({ page, stats: adLandingPageStats(page) }))
    .sort((a, b) => b.stats.forms - a.stats.forms || b.stats.visits - a.stats.visits);
  const max = Math.max(1, ...rows.map(row => row.stats.forms));
  return `<div class="ad-market-bars">${rows.map(({ page, stats }) => `<article class="region-row ad-market-row"><div><strong>${escapeHtml(page.market)}</strong><span>${escapeHtml(page.trainers)}</span></div><div class="region-meter"><span style="width:${stats.forms ? Math.max(8, Math.round((stats.forms / max) * 100)) : 0}%"></span></div><b>${stats.forms} leads</b><small>${stats.visits} visits / clicks · ${stats.rate}% form rate</small></article>`).join("")}</div>`;
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
  const totalCount = realLeadRows().length;
  const visibleCount = filteredLeadRows(realLeadRows()).length;
  const filterNote = visibleCount === totalCount
    ? `${totalCount} lead${totalCount === 1 ? "" : "s"} ${totalCount === 1 ? "is" : "are"} currently available to authorized office users.`
    : `${totalCount} total lead${totalCount === 1 ? "" : "s"} are available. Current filters show ${visibleCount}.`;
  return `<div class="source-record-note lead-source-note">
    <span class="status live">Contact Lead Feed Active</span>
    <p>Contact forms continue to log to the connected Google Sheet and office email while Supabase keeps the shared office lead record. ${filterNote}</p>
  </div><br>`;
}

function leadPanelActions() {
  const rows = allLeadRows();
  const currentCount = filteredLeadRows(rows).length;
  const allStatusCount = leadFilterCount(rows, { leadStatusFilter: "All" });
  return `<button class="btn btn-outline" data-filter-leads="all">All Statuses (${allStatusCount})</button><button class="btn btn-outline" data-export-operational="leads">Download Lead Sheet (${currentCount})</button>`;
}

const LEAD_RANGE_OPTIONS = [["7", "Last 7 Days"], ["30", "Last 30 Days"], ["60", "Last 60 Days"]];
const LEAD_SMS_FILTER_OPTIONS = ["Yes", "No", "Unknown"];

function leadDateRangeWindow(overrides = {}) {
  const range = overrides.leadDateRange ?? state.leadDateRange;
  const customStart = overrides.customLeadStart ?? state.customLeadStart;
  const customEnd = overrides.customLeadEnd ?? state.customLeadEnd;
  const end = range === "custom" ? new Date(`${customEnd}T23:59:59`) : new Date();
  const days = Number(range || 60);
  const start = range === "custom"
    ? new Date(`${customStart}T00:00:00`)
    : new Date(end.getTime() - (days - 1) * 86400000);
  return { start, end };
}

function flattenSearchValues(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(flattenSearchValues);
  if (typeof value === "object") return Object.values(value).flatMap(flattenSearchValues);
  return [String(value)];
}

function normalizedSearchText(values) {
  return flattenSearchValues(values)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedSearchTerms(query) {
  return normalizedSearchText(query).split(/\s+/).filter(Boolean);
}

function normalizedSearchDigits(values) {
  return flattenSearchValues(values).join(" ").replace(/\D/g, "");
}

function recordMatchesSearch(values, query) {
  const terms = normalizedSearchTerms(query);
  if (!terms.length) return true;
  const haystack = normalizedSearchText(values);
  const haystackDigits = normalizedSearchDigits(values);
  return terms.every(term => {
    const termDigits = term.replace(/\D/g, "");
    return haystack.includes(term) || Boolean(termDigits && haystackDigits.includes(termDigits));
  });
}

function leadSearchValues(lead = {}) {
  return [
    lead.owner,
    lead.first_name,
    lead.last_name,
    lead.dog,
    lead.breed,
    lead.phone,
    lead.email,
    lead.address,
    lead.address_line_1,
    lead.address_line_2,
    lead.city,
    lead.state,
    lead.zip,
    lead.source,
    lead.service,
    lead.i_want_to,
    lead.heard_about_us,
    lead.vet_or_previous_client,
    lead.additional_interest,
    lead.comments,
    lead.clientNote,
    lead.note,
    lead.status,
    lead.lostReason,
    leadMarketLabel(lead),
    trainerName(lead.trainerId),
    portalUserById(lead.assignedUserId) ? portalActorLabel(lead.assignedUserId) : "",
    lead.rawPayload
  ];
}

function leadSearchHaystack(lead = {}) {
  return normalizedSearchText(leadSearchValues(lead));
}

function leadMatchesTrainerFilter(lead, trainerFilter) {
  if (trainerFilter === "All") return true;
  const selectedTrainer = findTrainer(trainerFilter);
  const leadTrainer = findTrainer(lead.trainerId);
  return Boolean(selectedTrainer && leadTrainer && selectedTrainer.id === leadTrainer.id);
}

function leadMatchesFilters(lead, options = {}) {
  const ignore = new Set(Array.isArray(options.ignore) ? options.ignore : []);
  const overrides = options.overrides || {};
  const useWorkspaceFilters = options.useWorkspaceFilters !== false;
  if (!ignore.has("date")) {
    const created = parseRecordDate(lead.createdAt);
    const { start, end } = leadDateRangeWindow(overrides);
    if (!created || created < start || created > end) return false;
  }
  if (!useWorkspaceFilters) return true;
  const search = overrides.leadSearch ?? state.leadSearch;
  const trainerFilter = overrides.leadTrainerFilter ?? state.leadTrainerFilter;
  const statusFilter = overrides.leadStatusFilter ?? state.leadStatusFilter;
  const smsFilter = overrides.leadSmsFilter ?? state.leadSmsFilter;
  const ownerFilter = overrides.leadOwnerFilter ?? state.leadOwnerFilter ?? "All";
  return (ignore.has("search") || recordMatchesSearch(leadSearchValues(lead), search))
    && (ignore.has("trainer") || leadMatchesTrainerFilter(lead, trainerFilter))
    && (ignore.has("status") || statusFilter === "All" || lead.status === statusFilter)
    && (ignore.has("sms") || smsFilter === "All" || lead.smsConsent === smsFilter)
    && (ignore.has("owner") || ownerFilter === "All"
      || (ownerFilter === "Me" && String(lead.assignedUserId || "") === String(currentPortalUserId()))
      || (ownerFilter === "Unassigned" && !lead.assignedUserId)
      || String(lead.assignedUserId || "") === String(ownerFilter));
}

function filteredLeadRows(rows, options = {}) {
  return [...rows]
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
    .filter(lead => leadMatchesFilters(lead, options));
}

function leadFilterCount(rows, overrides = {}, options = {}) {
  return filteredLeadRows(rows, {
    ...options,
    overrides: { ...(options.overrides || {}), ...overrides }
  }).length;
}

function leadOptionLabel(label, count) {
  return `${label} (${count})`;
}

function activeLeadFilterLabels(admin = true) {
  const labels = [];
  if (admin && state.leadTrainerFilter !== "All") labels.push(`Trainer: ${trainerName(state.leadTrainerFilter)}`);
  if (admin && state.leadStatusFilter !== "All") labels.push(`Status: ${state.leadStatusFilter}`);
  if (admin && state.leadSmsFilter !== "All") labels.push(`SMS: ${state.leadSmsFilter}`);
  if (admin && state.leadOwnerFilter !== "All") labels.push(`Owner: ${state.leadOwnerFilter === "Me" ? "Assigned to me" : state.leadOwnerFilter === "Unassigned" ? "Unassigned" : portalActorLabel(state.leadOwnerFilter)}`);
  if (admin && state.leadSearch) labels.push(`Search: "${state.leadSearch}"`);
  return labels;
}

function leadResultCountText(rows, baseRows, admin = true) {
  const dateTotal = filteredLeadRows(baseRows, {
    useWorkspaceFilters: false,
    overrides: {
      leadDateRange: state.leadDateRange,
      customLeadStart: state.customLeadStart,
      customLeadEnd: state.customLeadEnd
    }
  }).length;
  const filters = activeLeadFilterLabels(admin);
  const noun = rows.length === 1 ? "lead" : "leads";
  if (!filters.length) return `Showing ${rows.length} ${noun} from ${leadRangeLabel()}.`;
  return `Showing ${rows.length} of ${dateTotal} ${dateTotal === 1 ? "lead" : "leads"} from ${leadRangeLabel()}. Active filters: ${filters.join("; ")}.`;
}

function leadDateControls(baseRows = allLeadRows(), options = {}) {
  return `<div class="lead-date-controls">
    <span>Lead date:</span>
    ${LEAD_RANGE_OPTIONS.map(([value, label]) => `<button class="btn ${state.leadDateRange === value ? "btn-red" : "btn-outline"}" data-lead-range="${value}">${escapeHtml(leadOptionLabel(label, leadFilterCount(baseRows, { leadDateRange: value }, options)))}</button>`).join("")}
    <button class="btn ${state.leadDateRange === "custom" ? "btn-red" : "btn-outline"}" data-lead-range="custom">${escapeHtml(leadOptionLabel("Custom", leadFilterCount(baseRows, { leadDateRange: "custom" }, options)))}</button>
    <input class="select-pill" type="date" name="lead-custom-start" value="${escapeHtml(state.customLeadStart)}">
    <input class="select-pill" type="date" name="lead-custom-end" value="${escapeHtml(state.customLeadEnd)}">
  </div>`;
}

function reportDateControls() {
  return `<div class="lead-date-controls report-date-controls">
    <span>Report date:</span>
    ${[["30", "Last 30 Days"], ["60", "Last 60 Days"], ["90", "Last 90 Days"]].map(([value, label]) => `<button class="btn ${state.reportDateRange === value ? "btn-red" : "btn-outline"}" data-report-range="${value}">${label}</button>`).join("")}
    <button class="btn ${state.reportDateRange === "custom" ? "btn-red" : "btn-outline"}" data-report-range="custom">Custom</button>
    <input class="select-pill" type="date" name="report-custom-start" value="${escapeHtml(state.customReportStart)}">
    <input class="select-pill" type="date" name="report-custom-end" value="${escapeHtml(state.customReportEnd)}">
  </div>`;
}

function reportRangeLabel() {
  if (state.reportDateRange === "custom") return `${state.customReportStart} to ${state.customReportEnd}`;
  return `last ${state.reportDateRange} days`;
}

function leadRangeLabel() {
  if (state.leadDateRange === "custom") return `${state.customLeadStart} to ${state.customLeadEnd}`;
  return `last ${state.leadDateRange} days`;
}

function leadOutcomeTable(sourceRows = realLeadRows()) {
  const rows = sourceRows;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Client / Dog</th><th>Trainer</th><th>Service</th><th>Status</th><th>Latest Office Note</th><th>Action</th></tr></thead><tbody>${rows.map(lead => {
    const latest = latestOfficeNote("lead", lead.remoteId);
    const noteText = latest?.note || lead.note || "";
    const noteMeta = latest ? `${portalActorLabel(latest.created_by)} · ${formatDateTime(latest.updated_at || latest.created_at)}` : lead.note ? "Saved on lead record" : "";
    return `<tr><td><strong>${escapeHtml(lead.owner)}</strong><small>${escapeHtml(lead.dog)} (${escapeHtml(lead.breed)})</small></td><td>${escapeHtml(trainerName(lead.trainerId))}</td><td>${escapeHtml(lead.service)}</td><td>${statusSelect(lead)}</td><td>${escapeHtml(noteText || "No note yet")}<small>${escapeHtml(noteMeta)}</small></td><td><button class="btn btn-red" data-open-lead="${lead.id}">Open / Add Note</button></td></tr>`;
  }).join("") || `<tr><td colspan="6">No website lead submissions match the current filters.</td></tr>`}</tbody></table></div><p class="panel-copy">Website contact submissions are shared with authorized office users through Supabase.</p>`;
}

const LEAD_EXACT_SHEET_FIELDS = [
  { key: "first_name", label: "First Name *" },
  { key: "last_name", label: "Last Name *" },
  { key: "address_line_1", label: "Address Line 1 *" },
  { key: "address_line_2", label: "Address Line 2 (optional)" },
  { key: "city", label: "City *" },
  { key: "state", label: "State *" },
  { key: "zip", label: "ZIP Code *" },
  { key: "email", label: "Email Address *" },
  { key: "phone", label: "Phone (required for callback) *" },
  { key: "i_want_to", label: "I want to... *" },
  { key: "heard_about_us", label: "How did you hear about us? *" },
  { key: "vet_or_previous_client", label: "Vet Name or Previous Client Name (optional)" },
  { key: "how_can_we_help", label: "How can we help?" },
  { key: "comments", label: "Comments *" },
  { key: "additional_interest", label: "I'm also interested in (optional)" },
  { key: "investor_network", label: "Investor network" },
  { key: "donor_or_project_support", label: "Donor or project support" },
  { key: "specialty_dog_training", label: "Specialty dog training" },
  { key: "sms_consent_agreement", label: "SMS consent checkbox/agreement text" },
  { key: "phone_required_notice_text", label: "Phone required notice text" }
];

const LEAD_FIELD_ALIASES = {
  first_name: ["First Name", "firstName"],
  last_name: ["Last Name", "lastName"],
  address_line_1: ["Address Line 1", "address1", "street_address"],
  address_line_2: ["Address Line 2", "address2", "apt_suite"],
  zip: ["zip_code", "postal_code", "ZIP Code", "Zip Code"],
  email: ["email_address", "Email Address"],
  phone: ["phone_number", "Phone", "Phone Number"],
  i_want_to: ["service_interest", "I want to...", "intent"],
  heard_about_us: ["How did you hear about us?", "referral_source", "lead_source"],
  vet_or_previous_client: ["Vet Name or Previous Client Name", "previous_client_name", "vet_name"],
  how_can_we_help: ["How can we help?", "service_interest", "comments"],
  comments: ["Comments", "message", "client_note"],
  additional_interest: ["I'm also interested in (optional)", "additional_interests", "other_interest"],
  investor_network: ["investor_network", "Investor network"],
  donor_or_project_support: ["donor_or_project_support", "Donor or project support"],
  specialty_dog_training: ["specialty_dog_training", "Specialty dog training"],
  sms_consent_agreement: ["sms_consent", "sms_consent_text", "sms_opt_in", "SMS consent"],
  phone_required_notice_text: ["phone_required_notice_text"]
};

const LEAD_VERIFIED_DELIVERY_FIELDS = [
  { key: "delivery_supabase_verified", label: "Delivery Supabase", destination: "supabase" },
  { key: "delivery_google_verified", label: "Delivery Google", destination: "google_form_sheet" },
  { key: "delivery_email_verified", label: "Delivery Email", destination: "formsubmit_email" }
];

const LEAD_INTERNAL_RAW_FIELD_KEYS = new Set([
  "delivery_local",
  "Delivery Local",
  "deliveryLocal",
  "delivery_google",
  "Delivery Google",
  "deliveryGoogle",
  "delivery_email",
  "Delivery Email",
  "deliveryEmail",
  "delivery_supabase",
  "Delivery Supabase",
  "deliverySupabase",
  "delivery_complete",
  "deliveryComplete",
  "request_id",
  "requestId",
  "payload_hash"
]);

function leadRawPayload(lead) {
  return lead?.rawPayload || lead?.raw_payload || {};
}

function leadNameParts(lead = {}) {
  const first = lead.first_name || leadRawPayload(lead).first_name || "";
  const last = lead.last_name || leadRawPayload(lead).last_name || "";
  if (first || last) return { first, last };
  const parts = String(lead.owner || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

function leadRawValue(lead, key) {
  const raw = leadRawPayload(lead);
  const aliases = [key, ...(LEAD_FIELD_ALIASES[key] || [])];
  for (const alias of aliases) {
    if (lead?.[alias] != null && lead?.[alias] !== "") return lead[alias];
    if (raw?.[alias] != null && raw?.[alias] !== "") return raw[alias];
  }
  return "";
}

function leadValueText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function leadDeliveryMatchTokens(lead = {}) {
  const raw = leadRawPayload(lead);
  return {
    entityIds: new Set([lead.remoteId, lead.id, raw.entity_id].map(value => String(value || "").trim()).filter(Boolean)),
    submissionIds: new Set([
      lead.source_submission_id,
      raw.source_submission_id,
      raw.submission_id,
      raw.sourceSubmissionId
    ].map(value => String(value || "").trim()).filter(Boolean))
  };
}

function deliveryAttemptsForLead(lead, destination = "") {
  const tokens = leadDeliveryMatchTokens(lead);
  return (remoteDeliveryAttempts || [])
    .filter(attempt => {
      if (destination && attempt.destination !== destination) return false;
      const entityId = String(attempt.entity_id || "").trim();
      const submissionId = String(attempt.submission_id || "").trim();
      return (entityId && tokens.entityIds.has(entityId)) || (submissionId && tokens.submissionIds.has(submissionId));
    })
    .sort((a, b) => timestampValue(b.created_at || b.updated_at) - timestampValue(a.created_at || a.updated_at));
}

function leadDeliveryStatusText(lead, destination) {
  if (destination === "supabase" && lead.remoteId && remoteReady) {
    const accepted = deliveryAttemptsForLead(lead, "supabase").find(attempt => attempt.status === "accepted");
    const when = accepted ? `\nAudit accepted ${formatDateTime(accepted.created_at || accepted.updated_at)}` : "";
    return `Confirmed by canonical Supabase lead record${when}`;
  }
  const attempts = deliveryAttemptsForLead(lead, destination);
  const accepted = attempts.find(attempt => attempt.status === "accepted");
  if (accepted) return `Accepted\n${formatDateTime(accepted.created_at || accepted.updated_at)}${accepted.request_id ? `\nRequest ${accepted.request_id}` : ""}`;
  const latest = attempts[0];
  if (!latest) return "Not recorded in delivery audit";
  const status = leadRawFieldLabel(latest.status || "pending");
  return `${status}\n${formatDateTime(latest.created_at || latest.updated_at)}${latest.error_summary ? `\n${latest.error_summary}` : ""}`;
}

function leadInterestList(lead = {}) {
  const raw = leadRawPayload(lead);
  const combined = leadValueText(lead.additional_interest || raw.additional_interest || raw.additional_interests || "");
  return combined.split(/,|;|\n/).map(value => value.trim()).filter(Boolean);
}

function leadHasInterest(lead, label, fieldKey) {
  const raw = leadRawPayload(lead);
  const direct = raw[fieldKey] ?? lead?.[fieldKey];
  if (/^(true|yes|1)$/i.test(String(direct || ""))) return true;
  return leadInterestList(lead).some(value => value.toLowerCase() === label.toLowerCase());
}

function leadSubmittedFieldValue(lead, key, label) {
  const raw = leadRawPayload(lead);
  const names = leadNameParts(lead);
  const verifiedDelivery = LEAD_VERIFIED_DELIVERY_FIELDS.find(field => field.key === key);
  if (verifiedDelivery) return leadDeliveryStatusText(lead, verifiedDelivery.destination);
  if (key === "first_name") return names.first;
  if (key === "last_name") return names.last;
  if (key === "phone") return formatPhoneNumber(leadRawValue(lead, key)) || "";
  if (key === "how_can_we_help") return leadRawValue(lead, key) || leadRawValue(lead, "comments") || "";
  if (key === "investor_network") return leadHasInterest(lead, "Investor network", key) ? "Yes" : "No";
  if (key === "donor_or_project_support") return leadHasInterest(lead, "Donor or project support", key) ? "Yes" : "No";
  if (key === "specialty_dog_training") return leadHasInterest(lead, "Specialty dog training", key) ? "Yes" : "No";
  if (key === "sms_consent_agreement") {
    const rawConsent = String(raw.sms_consent ?? lead.smsConsent ?? "").toLowerCase();
    const status = rawConsent === "yes" || lead.smsConsent === "Yes" || rawConsent === "true"
      ? "Checked / Yes"
      : rawConsent === "no" || lead.smsConsent === "No" || rawConsent === "false"
        ? "Not checked / No"
        : "Unknown / not recorded";
    return `${status}\n${raw.sms_consent_text || raw.sms_consent_agreement || CONTACT_SMS_DISCLOSURE_TEXT}`;
  }
  if (key === "phone_required_notice_text") return raw.phone_required_notice_text || CONTACT_PHONE_REQUIRED_NOTICE_TEXT;
  const value = leadRawValue(lead, key);
  if (value !== "") return leadValueText(value);
  if (raw[label] != null && raw[label] !== "") return leadValueText(raw[label]);
  return "";
}

function leadRawFieldLabel(key) {
  return String(key || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function leadSheetFields(rows = []) {
  const fields = LEAD_EXACT_SHEET_FIELDS.map(field => ({ ...field }));
  const seen = new Set();
  fields.forEach(field => {
    seen.add(field.key);
    seen.add(field.label);
    (LEAD_FIELD_ALIASES[field.key] || []).forEach(alias => seen.add(alias));
  });
  LEAD_INTERNAL_RAW_FIELD_KEYS.forEach(key => seen.add(key));
  LEAD_VERIFIED_DELIVERY_FIELDS.forEach(field => {
    fields.push({ ...field });
    seen.add(field.key);
    seen.add(field.label);
  });
  rows.forEach(lead => {
    Object.keys(leadRawPayload(lead)).forEach(key => {
      if (!key || seen.has(key)) return;
      fields.push({ key, label: leadRawFieldLabel(key) });
      seen.add(key);
    });
  });
  return fields;
}

function leadAssignedToCurrentUser(lead) {
  const userId = currentPortalUserId();
  return Boolean(userId) && String(lead?.assignedUserId || "") === String(userId);
}

function assignedLeadRowsForCurrentUser(baseRows = allLeadRows()) {
  return filteredLeadRows(baseRows, {
    useWorkspaceFilters: false,
    overrides: {
      leadDateRange: state.leadDateRange,
      customLeadStart: state.customLeadStart,
      customLeadEnd: state.customLeadEnd
    }
  }).filter(lead => leadAssignedToCurrentUser(lead) && !["Archived", "Became a Client"].includes(lead.status));
}

function leadAssignedHighlightClass(lead) {
  return state.leadOwnerFilter === "Me" && leadAssignedToCurrentUser(lead) ? " lead-assigned-highlight" : "";
}

function leadSheetView(rows) {
  const fields = leadSheetFields(rows);
  return `<div class="application-sheet-actions lead-sheet-actions"><span class="status live">Detailed Lead Sheet</span><p>Submitted lead-form fields are shown first. Delivery columns are computed from the server audit log, followed by any extra raw submission fields captured with the record. Click any row to open the lead record and notes.</p></div><div class="table-wrap application-sheet-table-wrap lead-sheet-table-wrap"><table class="data-table application-sheet-table lead-sheet-table"><thead><tr>${fields.map(field => `<th>${escapeHtml(field.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(lead => `<tr class="${leadAssignedHighlightClass(lead).trim()}" data-open-lead="${escapeHtml(lead.id)}">${fields.map(field => `<td>${escapeHtml(leadSubmittedFieldValue(lead, field.key, field.label) || "—")}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${fields.length}">No lead submissions match the current filters.</td></tr>`}</tbody></table></div>`;
}

function leadPipelineTable(admin) {
  const baseRows = admin ? allLeadRows() : trainerLeads();
  const filterOptions = { useWorkspaceFilters: admin };
  const rows = filteredLeadRows(baseRows, filterOptions);
  const table = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Received</th><th>Owner / Dog</th><th>Contact</th><th>SMS</th><th>Source / Market</th><th>Service</th><th>${admin ? "Trainer" : "Office Outcome"}</th><th>Status</th><th>Notes From Client</th></tr></thead><tbody>${rows.map((lead, index) => `<tr class="${leadAssignedHighlightClass(lead).trim()}" data-open-lead="${lead.id}"><td>${formatDateTime(lead.createdAt)}</td><td><div class="row-person"><span class="dog-avatar"><img src="${dogImages[index % dogImages.length]}" alt=""></span><div><strong>${escapeHtml(lead.owner)}</strong><small>${escapeHtml(lead.dog)} · ${escapeHtml(lead.breed)}</small></div></div></td><td><strong>${escapeHtml(formatPhoneNumber(lead.phone) || "—")}</strong><small>${escapeHtml(lead.email || "—")}</small><small>${escapeHtml(lead.address || "Address pending")}</small></td><td>${consentBadge(lead.smsConsent)}</td><td><strong>${escapeHtml(lead.source)}</strong><small>${escapeHtml(leadMarketLabel(lead))}</small></td><td>${escapeHtml(lead.service)}</td><td>${admin ? escapeHtml(trainerName(lead.trainerId)) : escapeHtml(lead.next)}</td><td>${admin ? statusSelect(lead) : `<span class="status ${statusClass(lead.status)}">${escapeHtml(lead.status)}</span>`}</td><td>${escapeHtml(lead.clientNote || "—")}</td></tr>`).join("") || `<tr><td colspan="9">No leads found for this date range.</td></tr>`}</tbody></table></div>`;
  const detailedSheet = leadSheetView(rows);
  return `${leadDateControls(baseRows, filterOptions)}${assignedLeadNotice(baseRows)}${leadWorkspaceControls(admin, baseRows)}<p class="panel-copy lead-result-count">${escapeHtml(leadResultCountText(rows, baseRows, admin))}</p>${admin && state.leadViewMode === "board" ? leadKanban(rows) : admin ? detailedSheet : table}${admin && state.leadViewMode === "board" ? `<details class="secondary-table" data-lead-sheet-details ${state.leadDetailSheetOpen ? "open" : ""}><summary>Open detailed lead sheet view</summary>${detailedSheet}</details>` : ""}${leadDetailPanel()}`;
}

function assignedLeadNotice(baseRows = allLeadRows()) {
  if (session.role !== "admin") return "";
  const assigned = assignedLeadRowsForCurrentUser(baseRows);
  if (!assigned.length) return "";
  const sample = assigned.slice(0, 3).map(lead => lead.owner || "Unnamed lead").join(", ");
  const active = state.leadOwnerFilter === "Me";
  return `<div class="assignment-alert ${active ? "active" : ""}"><div><strong>${assigned.length} lead${assigned.length === 1 ? "" : "s"} assigned to you</strong><p>${escapeHtml(sample)}${assigned.length > 3 ? "..." : ""}</p></div><button class="btn btn-outline btn-small" type="button" data-lead-owner-quick="toggle">${active ? "Show All Leads" : `My Assigned Leads (${assigned.length})`}</button></div>`;
}

function leadWorkspaceControls(admin, baseRows = allLeadRows()) {
  if (!admin) return "";
  const trainerOptions = [`<option value="All">${escapeHtml(leadOptionLabel("All trainers", leadFilterCount(baseRows, { leadTrainerFilter: "All" })))}</option>`]
    .concat(state.trainers.map(t => `<option value="${t.id}" ${state.leadTrainerFilter === t.id ? "selected" : ""}>${escapeHtml(leadOptionLabel(t.name, leadFilterCount(baseRows, { leadTrainerFilter: t.id })))}</option>`));
  const statusOptions = [`<option value="All">${escapeHtml(leadOptionLabel("All statuses", leadFilterCount(baseRows, { leadStatusFilter: "All" })))}</option>`]
    .concat(leadStatuses.map(status => `<option value="${escapeHtml(status)}" ${state.leadStatusFilter === status ? "selected" : ""}>${escapeHtml(leadOptionLabel(status, leadFilterCount(baseRows, { leadStatusFilter: status })))}</option>`));
  const smsOptions = [`<option value="All">${escapeHtml(leadOptionLabel("All SMS choices", leadFilterCount(baseRows, { leadSmsFilter: "All" })))}</option>`]
    .concat(LEAD_SMS_FILTER_OPTIONS.map(value => `<option value="${value}" ${state.leadSmsFilter === value ? "selected" : ""}>${escapeHtml(leadOptionLabel(value, leadFilterCount(baseRows, { leadSmsFilter: value })))}</option>`));
  const ownerOptions = [
    `<option value="All">${escapeHtml(leadOptionLabel("All owners", leadFilterCount(baseRows, { leadOwnerFilter: "All" })))}</option>`,
    `<option value="Me" ${state.leadOwnerFilter === "Me" ? "selected" : ""}>${escapeHtml(leadOptionLabel("Assigned to me", leadFilterCount(baseRows, { leadOwnerFilter: "Me" })))}</option>`,
    `<option value="Unassigned" ${state.leadOwnerFilter === "Unassigned" ? "selected" : ""}>${escapeHtml(leadOptionLabel("Unassigned", leadFilterCount(baseRows, { leadOwnerFilter: "Unassigned" })))}</option>`
  ].concat((remotePortalUsers || [])
    .filter(user => user.active !== false && user.role === "admin")
    .map(user => `<option value="${escapeHtml(user.user_id)}" ${state.leadOwnerFilter === user.user_id ? "selected" : ""}>${escapeHtml(leadOptionLabel(portalDisplayName(user), leadFilterCount(baseRows, { leadOwnerFilter: user.user_id })))}</option>`));
  const myAssignedCount = assignedLeadRowsForCurrentUser(baseRows).length;
  const myAssignedActive = state.leadOwnerFilter === "Me";
  return `<div class="lead-workspace-controls"><button class="btn ${myAssignedActive ? "btn-red" : "btn-outline"} lead-owner-toggle" type="button" data-lead-owner-quick="toggle">My Assigned Leads <span>${myAssignedCount}</span></button><input class="select-pill lead-search" data-lead-search value="${escapeHtml(state.leadSearch)}" placeholder="Search name, phone, email, dog, city..."><select class="select-pill" data-lead-filter="trainer">${trainerOptions.join("")}</select><select class="select-pill" data-lead-filter="status">${statusOptions.join("")}</select><select class="select-pill" data-lead-filter="sms">${smsOptions.join("")}</select><select class="select-pill" data-lead-filter="owner">${ownerOptions.join("")}</select><div class="view-switch"><button class="btn ${state.leadViewMode === "board" ? "btn-red" : "btn-outline"}" data-lead-view="board">Pipeline</button><button class="btn ${state.leadViewMode === "table" ? "btn-red" : "btn-outline"}" data-lead-view="table">Table</button></div></div>`;
}

const boardColumns = ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome", "Evaluation Scheduled", "Evaluation Complete", "Became a Client", "Lost"];
function boardStatus(status) { return /^(Lost|Bad Lead|Do Not Contact|Archived)/.test(status) ? "Lost" : status; }
function leadKanban(rows) {
  return `<div class="lead-kanban">${boardColumns.map(column => { const cards = rows.filter(l => boardStatus(l.status) === column); return `<section class="kanban-column" data-drop-status="${column}"><header><strong>${column}</strong><span>${cards.length}</span></header><div class="kanban-cards">${cards.map(lead => `<article class="lead-card${leadAssignedHighlightClass(lead)}" draggable="true" data-lead-card="${lead.id}" data-open-lead="${lead.id}"><div class="lead-card-top"><strong>${escapeHtml(lead.owner)}</strong><span>${formatDateTime(lead.createdAt)}</span></div><p>${escapeHtml(lead.dog || "Dog pending")} · ${escapeHtml(lead.service || "Service pending")}</p><small>${escapeHtml(leadMarketLabel(lead))} · ${escapeHtml(formatPhoneNumber(lead.phone) || lead.email || "Contact pending")} · SMS ${escapeHtml(lead.smsConsent)}</small></article>`).join("") || `<p class="empty-column">Drop leads here</p>`}</div></section>`; }).join("")}</div>`;
}

function officeAssigneeSelect(entityType, recordId, selectedUserId = "") {
  const options = (remotePortalUsers || [])
    .filter(user => user.active !== false && user.role === "admin")
    .map(user => `<option value="${escapeHtml(user.user_id)}" ${user.user_id === selectedUserId ? "selected" : ""}>${escapeHtml(portalDisplayName(user))} · ${escapeHtml(user.email || "email pending")}</option>`)
    .join("");
  return `<select class="select-pill" data-office-assignee="${escapeHtml(entityType)}" data-record-id="${escapeHtml(recordId)}"><option value="">Unassigned</option>${options}</select>`;
}

function leadDetailPanel() {
  const lead = allLeadRows().find(l => l.id === state.selectedLeadId);
  if (!lead) return "";
  return `<aside class="lead-detail-panel"><button class="detail-close" type="button" data-close-lead aria-label="Close">×</button><span class="portal-tag">Full Lead Record</span><h2>${escapeHtml(lead.owner)}</h2><p>${escapeHtml(lead.dog || "Dog pending")} · ${escapeHtml(lead.service || "Service pending")}</p><div class="lead-contact-grid"><div><span>Phone</span><strong>${escapeHtml(formatPhoneNumber(lead.phone) || "—")}</strong></div><div><span>Email</span><strong>${escapeHtml(lead.email || "—")}</strong></div><div><span>SMS consent</span><strong>${escapeHtml(lead.smsConsent)}</strong></div><div class="wide"><span>Address</span><strong>${escapeHtml(lead.address || "Address pending")}</strong></div><div><span>Received</span><strong>${escapeHtml(formatDateTime(lead.createdAt))}</strong></div><div><span>Lead market / area</span><strong>${escapeHtml(leadMarketLabel(lead))}</strong></div><div><span>Source trainer</span><strong>${escapeHtml(trainerName(lead.trainerId))}</strong></div><div><span>Source</span><strong>${escapeHtml(lead.source || "Website")}</strong></div><div><span>Campaign</span><strong>${escapeHtml(lead.utm_campaign || "Not captured")}</strong></div><div><span>UTM source</span><strong>${escapeHtml(lead.utm_source || "Not captured")}</strong></div></div><label>Status${statusSelect(lead)}</label><label>Assigned office owner${officeAssigneeSelect("lead", lead.id, lead.assignedUserId)}</label><label>Follow-up date<input class="select-pill" type="date" data-lead-followup="${lead.id}" value="${escapeHtml(lead.followUpDate || "")}"></label><label>Lost reason<select class="select-pill" data-lead-lost-reason="${lead.id}"><option value="">Select reason</option>${["No response","Price concern","Chose another provider","Not ready","Client complaint","No trainer in the area","Location issue","Schedule conflict","Not a fit","Other"].map(r => `<option ${lead.lostReason === r ? "selected" : ""}>${r}</option>`).join("")}</select></label><section class="detail-note-block"><span>Notes From Client For Office</span><p>${escapeHtml(lead.clientNote || "No client note supplied.")}</p></section><section class="detail-note-block"><span>Office Notes</span>${officeNoteTimeline("lead", lead.remoteId)}<textarea data-new-office-note="${lead.remoteId}" placeholder="Add office note. This records your account and timestamp."></textarea><button class="btn btn-red btn-small" type="button" data-add-office-note="lead" data-entity-id="${lead.remoteId}">Add Office Note</button></section><label class="check-row"><input type="checkbox" data-lead-dnc="${lead.id}" ${lead.doNotContact ? "checked" : ""}> Do not contact</label><div class="row-actions"><button class="btn btn-outline" type="button" data-archive-lead="${lead.id}">Archive lead</button>${permanentDeleteButton("lead", lead)}</div></aside><div class="lead-detail-scrim" data-close-lead></div>`;
}

function statusSelect(lead) {
  return `<select class="select-pill" data-lead-status="${lead.id}">${leadStatuses.map(status => `<option ${lead.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select>`;
}

function leadStatusCounts(rows) {
  return ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome", "Evaluation Scheduled", "Evaluation Complete", "Became a Client"].map(status => [status, rows.filter(lead => lead.status === status).length]);
}

function leadSummary() {
  const labels = dashboardBucketRows();
  const total = labels.reduce((sum, [, value]) => sum + value, 0);
  const colors = ["#246bfe", "#f59e0b", "#64748b", "#0c9b58", "#d80f35", "#8b5cf6"];
  let cursor = 0;
  const segments = labels.map(([, value], index) => {
    const start = total ? (cursor / total) * 100 : 0;
    cursor += value;
    const end = total ? (cursor / total) * 100 : 0;
    return `${colors[index]} ${start}% ${end}%`;
  }).join(", ");
  return `<div class="donut-panel"><div class="donut" style="background:conic-gradient(${segments || "#e5edf7 0 100%"})"><div class="donut-total"><strong>${total}</strong><span>Dashboard Count</span></div></div><div class="legend">${labels.map(([name, value], index) => `<div class="legend-row"><span class="dot" style="background:${colors[index]}"></span><span>${escapeHtml(name)}</span><strong>${value}</strong></div>`).join("")}</div></div>`;
}

function marketConversionTable() {
  const events = reportLifecycleRows().filter(event => isWithinWindow(event.occurred_at || event.created_at, "report"));
  const isAdAttributed = event => Boolean(
    event.utm_source || event.utm_medium || event.utm_campaign
    || /(?:^|\/)(?:ad-|dog-training-[a-z]+-)/i.test(String(event.source_page || event.raw_payload?.source_page || ""))
  );
  const inquiryEvents = events.filter(event => event.event_type === "form_received" && isAdAttributed(event));
  const inquiryByEntity = new Map(inquiryEvents.map(event => [`${event.entity_type}:${event.entity_id}`, event]));
  const markets = new Map();
  adLandingPageConfigs()
    .filter(page => page.slug.startsWith("dog-training-"))
    .forEach(page => {
      markets.set(page.market, { forms: new Set(), clients: new Set(), page });
    });
  inquiryEvents.forEach(event => {
    const market = String(event.market || event.raw_payload?.ad_market || "Unattributed").trim() || "Unattributed";
    if (!markets.has(market)) markets.set(market, { forms: new Set(), clients: new Set() });
    const row = markets.get(market);
    row.forms.add(`${event.entity_type}:${event.entity_id}`);
  });
  events.filter(event => event.event_type === "became_client").forEach(event => {
    const key = `${event.entity_type}:${event.entity_id}`;
    const inquiry = inquiryByEntity.get(key);
    if (!inquiry) return;
    const market = String(inquiry.market || inquiry.raw_payload?.ad_market || "Unattributed").trim() || "Unattributed";
    markets.get(market)?.clients.add(key);
  });
  const rows = [...markets.entries()].sort((a, b) => b[1].forms.size - a[1].forms.size || a[0].localeCompare(b[0]));
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Ad Market</th><th>Inquiries</th><th>Became Client</th><th>Conversion</th><th>Page</th></tr></thead><tbody>${rows.map(([market, value]) => `<tr><td><strong>${escapeHtml(market)}</strong></td><td>${value.forms.size}</td><td>${value.clients.size}</td><td>${value.forms.size ? Math.round((value.clients.size / value.forms.size) * 1000) / 10 : 0}%</td><td>${value.page ? `<a href="${escapeHtml(value.page.href)}" target="_blank" rel="noopener">${escapeHtml(value.page.label)}</a>` : "Lifecycle event"}</td></tr>`).join("") || `<tr><td colspan="5">No ad-attributed inquiries in this date range.</td></tr>`}</tbody></table></div>`;
}

function approvedLayoutCards() {
  return `<div class="layout-card-grid approved-template-grid">${approvedLayouts.map((layout, index) => `<article class="layout-card approved-template-card ${trainerById().layout === layout.id ? "selected" : ""}"><div class="approved-template-image"><img src="${layout.preview}" alt="${escapeHtml(layout.name)} approved trainer landing page"><span>Approved Design ${index + 1}</span></div><div class="approved-template-copy"><h3>${escapeHtml(layout.name)}</h3><p>${escapeHtml(layout.tag)}</p><div class="template-points"><span>Trainer identity</span><span>Lead form</span><span>Reviews</span><span>Lorenzo credentials</span><span>Mobile responsive</span><span>Office-controlled</span></div><div class="row-actions"><a class="btn btn-outline" href="${templatePreviewHref(layout.id)}" target="_blank" rel="noopener">Open Full Design</a><button class="btn btn-red" data-assign-layout="${layout.id}">Use This Design</button></div></div></article>`).join("")}</div>`;
}

function trainerPageCards() {
  return `<div class="trainer-card-grid">${state.trainers.map(trainer => {
    const stats = realTrainerStats(trainer);
    const canDelete = isDraftTrainer(trainer) && !trainer.locked;
    return `<article class="network-card"><div class="trainer-page-thumbnail"><img src="${escapeHtml(trainerHeadshot(trainer))}" alt="${escapeHtml(trainer.name || "Trainer Draft")} headshot"><div><span>${escapeHtml(layoutName(trainer.layout))}</span><strong>${escapeHtml(trainer.name || "Trainer Draft")}</strong><small>${escapeHtml(trainer.market)}</small></div></div><div class="network-card-head"><div><h3>${escapeHtml(trainer.name || "Trainer Draft")}</h3><p>${escapeHtml(trainer.serviceArea)}</p><span class="status ${trainer.accessStatus === "Disabled" ? "lost" : "won"}">${escapeHtml(trainer.accessStatus || "Active")} Portal Access</span></div>${pageStatusBadge(trainer)}</div><div class="readiness-stats"><div><strong>${stats.clicks}</strong><span>Tracked Page Clicks</span></div><div><strong>${stats.forms}</strong><span>Lead Forms</span></div><div><strong>${stats.conversions}</strong><span>Paying Clients</span></div></div><p class="network-note">${trainer.pageStatus === "No Site Started" ? "Trainer enrolled. Office setup has not started." : trainer.locked ? "Published and locked by the office." : "Office draft in progress. Not public yet."}</p><div class="row-actions"><button class="btn btn-outline" data-select-trainer="${trainer.id}" data-view="trainers">Edit Trainer & Landing Page</button><a class="btn btn-outline" href="${trainerPageHref(trainer)}" target="_blank" rel="noopener">${trainer.pageStatus === "Published" ? "View Published Page" : "Preview Draft"}</a><button class="btn ${trainer.locked ? "btn-outline" : "btn-red"}" data-toggle-lock="${trainer.id}">${trainer.locked ? "Return To Draft" : "Publish Landing Page"}</button><button class="btn btn-outline" data-toggle-access="${trainer.id}">${trainer.accessStatus === "Disabled" ? "Restore Trainer Access" : "Disable Trainer Access"}</button>${canDelete ? `<button class="btn btn-outline btn-danger" data-delete-trainer="${trainer.id}">Delete Draft</button>` : ""}</div></article>`;
  }).join("")}</div>`;
}

function trainerSiteActivityTable() {
  const events = siteEventRows().slice().sort((a, b) => String(b.created_at || b.timestamp).localeCompare(String(a.created_at || a.timestamp))).slice(0, 20);
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Time</th><th>Trainer</th><th>Location</th><th>Activity</th><th>Source</th><th>Campaign</th><th>Page</th></tr></thead><tbody>${events.map(event => `<tr><td>${escapeHtml(new Date(event.timestamp).toLocaleString())}</td><td><strong>${escapeHtml(event.assigned_trainer || trainerName(event.trainer_id))}</strong></td><td>${escapeHtml([event.trainer_city || event.trainer_market, event.trainer_state].filter(Boolean).join(" · ") || "—")}</td><td><span class="status ${event.event_type === "trainer_form_submitted" ? "won" : "new"}">${event.event_type === "trainer_form_submitted" ? "Lead Form" : "Page Visit"}</span></td><td>${escapeHtml(event.utm_source || event.referrer || "Direct")}</td><td>${escapeHtml(event.utm_campaign || "—")}</td><td>${escapeHtml(event.page_path || "—")}</td></tr>`).join("") || `<tr><td colspan="7">Open a trainer landing page to record the first attributed visit.</td></tr>`}</tbody></table></div>`;
}

function photoFrameValue(value, fallback = "center top") {
  const allowed = ["center top", "center center", "center bottom", "left center", "right center"];
  if (/^\d{1,3}%\s+\d{1,3}%$/.test(String(value || "").trim())) return String(value).trim();
  return allowed.includes(value) ? value : fallback;
}

function photoFitValue(value, fallback = "cover") {
  return value === "contain" ? "contain" : fallback;
}

function photoScaleValue(value) {
  const numeric = Number(value || 100);
  if (!Number.isFinite(numeric)) return 100;
  return Math.min(150, Math.max(80, numeric));
}

function photoFramePresetValue(value, fallback = "standard") {
  const allowed = new Set(["standard", "portrait", "square", "wide", "tight"]);
  return allowed.has(value) ? value : fallback;
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function trainerPhotoStyle(trainer, { positionKey = "", fitKey = "", scaleKey = "", frameKey = "", fallbackPosition = "center top", fallbackFit = "cover", fallbackFrame = "standard" } = {}) {
  const position = photoFrameValue(positionKey ? trainer[positionKey] : "", fallbackPosition);
  const frame = photoFramePresetValue(frameKey ? trainer[frameKey] : "", fallbackFrame);
  let fit = photoFitValue(fitKey ? trainer[fitKey] : "", fallbackFit);
  let scale = photoScaleValue(scaleKey ? trainer[scaleKey] : 100);
  if (["portrait", "tight"].includes(frame) && fit === "contain") fit = "cover";
  if (frame === "tight") scale = Math.max(scale, 115);
  return `object-position:${escapeHtml(position)};object-fit:${fit};transform:scale(${scale / 100});`;
}

function imageFrameControls(trainer, options, mode = "admin") {
  if (!options.positionKey && !options.fitKey && !options.scaleKey && !options.frameKey) return "";
  const attr = mode === "editor" ? "data-editor-field" : "name";
  const name = key => mode === "editor" ? key : `admin-trainer-${key}`;
  const positions = [
    ["center top", "Top"],
    ["center center", "Center"],
    ["center bottom", "Bottom"],
    ["left center", "Left"],
    ["right center", "Right"]
  ];
  const frames = [
    ["standard", "Standard"],
    ["portrait", "Portrait crop"],
    ["square", "Square"],
    ["wide", "Wide"],
    ["tight", "Tight crop"]
  ];
  const selectedPosition = photoFrameValue(trainer[options.positionKey], options.fallbackPosition || "center top");
  const hasCustomPosition = options.positionKey && !positions.some(([valueOption]) => valueOption === selectedPosition);
  const selectedFrame = photoFramePresetValue(trainer[options.frameKey], options.fallbackFrame || "standard");
  return `<div class="media-frame-controls">
    ${options.frameKey ? `<label><span>Frame style</span><select ${attr}="${escapeHtml(name(options.frameKey))}">${frames.map(([valueOption, label]) => `<option value="${valueOption}" ${valueOption === selectedFrame ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : ""}
    ${options.positionKey ? `<label><span>Photo frame position</span><select ${attr}="${escapeHtml(name(options.positionKey))}">${hasCustomPosition ? `<option value="${escapeHtml(selectedPosition)}" selected>Custom drag position</option>` : ""}${positions.map(([valueOption, label]) => `<option value="${valueOption}" ${valueOption === selectedPosition ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : ""}
    ${options.fitKey ? `<label><span>Photo fit</span><select ${attr}="${escapeHtml(name(options.fitKey))}"><option value="cover" ${photoFitValue(trainer[options.fitKey], options.fallbackFit || "cover") === "cover" ? "selected" : ""}>Fill frame</option><option value="contain" ${photoFitValue(trainer[options.fitKey], options.fallbackFit || "cover") === "contain" ? "selected" : ""}>Show full photo</option></select></label>` : ""}
    ${options.scaleKey ? `<label><span>Photo scale <strong>${photoScaleValue(trainer[options.scaleKey])}%</strong></span><input type="range" min="80" max="150" step="5" ${attr}="${escapeHtml(name(options.scaleKey))}" value="${photoScaleValue(trainer[options.scaleKey])}"></label>` : ""}
    ${options.positionKey ? `<small class="photo-drag-help">Tip: drag directly on the preview image to fine-tune the crop.</small>` : ""}
  </div>`;
}

function trainerImageUploadCard(trainer, options) {
  const value = options.key === "profilePhoto" ? trainerHeadshot(trainer) : (trainer[options.key] || options.fallback || "/assets/lorenzo-logo-transparent.png");
  const frameClass = options.frameKey ? ` photo-frame-${photoFramePresetValue(trainer[options.frameKey], options.fallbackFrame || "standard")}` : "";
  const imageStyle = trainerPhotoStyle(trainer, {
    positionKey: options.positionKey,
    fitKey: options.fitKey,
    scaleKey: options.scaleKey,
    frameKey: options.frameKey,
    fallbackPosition: options.fallbackPosition || "center top",
    fallbackFit: options.fallbackFit || (options.contain ? "contain" : "cover"),
    fallbackFrame: options.fallbackFrame || "standard"
  });
  const frameAttrs = options.positionKey ? ` data-photo-frame-preview data-photo-position-key="${escapeHtml(options.positionKey)}"` : "";
  return `<section class="trainer-image-upload-card">
    <div class="trainer-image-upload-heading"><span>${escapeHtml(options.eyebrow)}</span><h3>${escapeHtml(options.title)}</h3><p>${escapeHtml(options.description)}</p></div>
    <div class="wizard-media-preview ${options.contain ? "contain" : ""}${frameClass}"${frameAttrs}><img src="${escapeHtml(value)}" style="${imageStyle}" alt="${escapeHtml(options.title)} preview"></div>
    ${imageFrameControls(trainer, options, "admin")}
    <label class="upload-drop"><strong>${escapeHtml(options.button)}</strong><small>JPG, PNG, WebP, or GIF · up to 10 MB</small><input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" data-trainer-upload="${escapeHtml(options.key)}"></label>
  </section>`;
}

function trainerVideoUploadCard(trainer) {
  const fallbackVideo = trainerVideoFor(trainer);
  const value = trainer.trainerVideoUrl || fallbackVideo?.src || "";
  const poster = trainer.trainerVideoUrl ? "" : fallbackVideo?.poster || "";
  return `<section class="trainer-image-upload-card trainer-video-upload-card">
    <div class="trainer-image-upload-heading"><span>Landing Page Video</span><h3>Trainer Introduction Video</h3><p>Shown below the three training paths on this trainer's landing page.</p></div>
    <div class="wizard-media-preview video-preview">${value ? videoPreviewMarkup(value, `${trainer.name || "Trainer"} introduction video`, poster) : `<div><strong>No trainer video uploaded yet</strong><span>MP4/WebM upload or YouTube, Vimeo, Loom, Google Drive, Dropbox link</span></div>`}</div>
    <label class="upload-drop"><strong>Upload Trainer Video</strong><small>MP4/WebM video · large files supported</small><input type="file" accept="video/mp4,video/webm,video/*" data-trainer-upload="trainerVideoUrl"></label>
    <label class="video-link-field"><span>Or paste a video link</span><input data-main-trainer-video-url value="${escapeHtml(trainer.trainerVideoUrl || "")}" placeholder="YouTube, Vimeo, Loom, Google Drive, Dropbox, or direct MP4/WebM"></label>
    <button class="btn btn-outline btn-small" type="button" data-apply-main-video-url>Save Video Link</button>
  </section>`;
}

function trainerAdminForm() {
  const t = trainerById();
  if (!t) return panel("Trainer Setup", "", "<p>Select a trainer from the Trainer Network to begin.</p>", "pad");
  const frontHeadshot = trainerHeadshot(t);
  const landingPhoto = trainerLandingPhoto(t);
  if (!t.profilePhoto || t.profilePhoto === t.photo) t.profilePhoto = frontHeadshot;
  if (!t.cardPhoto || t.cardPhoto === t.photo) t.cardPhoto = frontHeadshot;
  if (!t.publicPhoto || t.publicPhoto === t.photo) t.publicPhoto = frontHeadshot;
  if (!t.heroTrainerPhoto) t.heroTrainerPhoto = landingPhoto;
  if (!t.landingBioPhoto) t.landingBioPhoto = landingPhoto;
  t.profilePhotoPosition ||= "center top";
  t.profilePhotoFit ||= "contain";
  t.profilePhotoScale ||= 100;
  t.profilePhotoFrame ||= "portrait";
  t.heroPhotoPosition ||= "center top";
  t.heroPhotoFit ||= "cover";
  t.heroPhotoScale ||= 100;
  t.heroPhotoFrame ||= "standard";
  t.bioPhotoPosition ||= "center center";
  t.bioPhotoFit ||= "cover";
  t.bioPhotoScale ||= 100;
  t.bioPhotoFrame ||= "tight";
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
  if (step === 1) content = `<div class="form-grid">${textField("name", "Trainer Name")}${textField("title", "Professional Title", { placeholder: "Team Trainer" })}${textField("email", "Email / Username", { type: "email", help: "This email identifies the trainer's portal account." })}${textField("temporaryPassword", "Temporary Password", { help: "Use the office-issued temporary password for first login. The trainer must replace it immediately." })}${textField("phone", "Public Phone")}${textField("market", "City / Market")}${textField("state", "State / Region")}</div>`;
  if (step === 2) content = `<div class="wizard-template-choice">${approvedLayouts.map(layout => `<label class="wizard-template-option ${t.layout === layout.id ? "selected" : ""}"><input type="radio" name="admin-trainer-layout" value="${layout.id}" ${t.layout === layout.id ? "checked" : ""}><img src="${layout.preview}" alt="${escapeHtml(layout.name)}"><span><strong>${escapeHtml(layout.name)}</strong><small>${escapeHtml(layout.tag)}</small></span></label>`).join("")}</div><div class="brand-lock-note">The office chooses one approved design. Lorenzo's colors, affiliation, office phone number, and required conversion sections stay locked.</div>`;
  if (step === 3) content = `<div class="form-grid">${textField("serviceArea", "Service Area", { wide: true, placeholder: "Cleveland, Garfield Heights, Akron, and surrounding areas" })}${textField("bio", "Office-Approved Trainer Bio", { wide: true, area: true, placeholder: "Tell the trainer's story, approach, and experience." })}${textField("tagline", "Page Tagline", { wide: true })}${textField("heroHeadline", "Hero Headline", { wide: true })}${textField("seoTitle", "SEO Page Title", { wide: true, help: "Use trainer name, dog training service, and city/state." })}${textField("seoDescription", "SEO Description", { wide: true, area: true, help: "Describe obedience training, behavior modification, service area, and Lorenzo affiliation in 150-160 characters." })}</div>`;
  if (step === 4) content = `<div class="wizard-media-purpose"><div><span class="step-label">Photos: each one has one job</span><h3>Pick the right photo for each place</h3><p><strong>Headshot</strong> shows only on Find a Trainer cards. <strong>Bio Photo</strong> shows when someone clicks View Bio and in the landing-page bio section. Save & Publish sends the Bio Photo to the front end.</p></div></div><div class="wizard-upload-grid image-role-grid">${trainerImageUploadCard(t, { key: "profilePhoto", frameKey: "profilePhotoFrame", positionKey: "profilePhotoPosition", fitKey: "profilePhotoFit", scaleKey: "profilePhotoScale", fallbackFit: "contain", fallbackFrame: "portrait", eyebrow: "Find a Trainer only", title: "Headshot", description: "Used only on trainer cards. It does not control the View Bio photo.", button: "Upload Headshot", contain: true })}${trainerImageUploadCard(t, { key: "heroTrainerPhoto", frameKey: "heroPhotoFrame", positionKey: "heroPhotoPosition", fitKey: "heroPhotoFit", scaleKey: "heroPhotoScale", eyebrow: "Landing page top", title: "Top Landing Photo", description: "The first trainer image on the landing page.", button: "Upload Top Landing Photo" })}${trainerImageUploadCard(t, { key: "landingBioPhoto", frameKey: "bioPhotoFrame", positionKey: "bioPhotoPosition", fitKey: "bioPhotoFit", scaleKey: "bioPhotoScale", fallbackFit: "cover", fallbackFrame: "tight", eyebrow: "View Bio + landing bio", title: "Bio Photo", description: "Used when visitors click View Bio and beside the bio on the landing page.", button: "Upload Bio Photo" })}${trainerImageUploadCard(t, { key: "image", eyebrow: "Page background", title: "Hero Background", description: "The wide background behind the headline and consultation form.", button: "Upload Background Photo" })}${trainerImageUploadCard(t, { key: "companyLogo", eyebrow: "Optional", title: "Company Logo", description: "Leave the Lorenzo logo or upload an approved local logo.", button: "Upload Company Logo", contain: true })}${trainerVideoUploadCard(t)}</div><section class="hero-library"><div><span class="step-label">Background only</span><h3>Choose a page background</h3><p>This changes only the wide background. It never replaces the headshot or Bio Photo.</p></div><div class="hero-option-grid">${heroImageOptions.map(option => `<button type="button" class="hero-option ${t.image === option.src ? "selected" : ""}" data-hero-image="${escapeHtml(option.src)}"><img src="${escapeHtml(option.src)}" alt="${escapeHtml(option.label)}"><span>${escapeHtml(option.label)}</span></button>`).join("")}</div></section><div class="brand-lock-note">Lorenzo branding and office routing stay protected on every design.</div>`;
  if (step === 4) content = content.replace(
    "</div></div><div class=\"wizard-upload-grid image-role-grid\">",
    `</div><div class="form-grid bio-photo-url-row">${textField("landingBioPhoto", "Bio Photo URL (View Bio + Landing Bio)", { wide: true, help: "Paste the approved candid photo URL here if upload is blocked. Save & Publish sends this exact photo to the View Bio page." })}</div></div><div class="wizard-upload-grid image-role-grid">`
  );
  if (step === 5) content = `<div class="form-grid">${textField("specialtiesText", "Services / Specialties", { wide: true, area: true, placeholder: "Obedience Training\nBehavior Modification\nPuppy Training", help: "Enter one approved service per line." })}${textField("credentialsText", "Credentials / Trust Points", { wide: true, area: true, placeholder: "Lorenzo's Certified Dog Trainer\nLDTT training system\nOngoing education", help: "Enter one approved credential per line." })}</div><div class="credential-preview"><img src="../assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><div><strong>Powered by Lorenzo's Dog Training Team</strong><span>Serious Training. Serious Results.</span></div></div>`;
  if (step === 6) content = `${trainerApprovedReviewManagerMarkup(t)}<div class="review-editor-grid">${[1,2,3].map(n => `<section><h3>Testimonial ${n}</h3>${textField(`review${n}Author`, "Client Name")}${textField(`review${n}Copy`, "Approved Review", { area: true })}</section>`).join("")}</div><div class="form-grid social-editor">${[["facebook","Facebook"],["instagram","Instagram"],["tiktok","TikTok"]].map(([key,label]) => `<div class="field"><label>${label}<input name="admin-trainer-social-${key}" value="${escapeHtml(t.socials?.[key] || "")}" placeholder="Profile URL"></label><small class="field-help">Leave blank to show an inactive placeholder.</small></div>`).join("")}</div>`;
  if (step === 7) {
    const publicUrl = trainerPublicUrl(t);
    content = `<section class="publish-review publish-review-clear"><div><span>Landing-page status</span><strong>${escapeHtml(t.name)} · ${escapeHtml(layoutName(t.layout))}</strong><small>${escapeHtml(t.pageStatus)} ${t.locked ? "· Office locked" : "· Editable draft"}</small></div><div>${pageStatusBadge(t)}</div></section>${trainerPublishChecklistMarkup(t)}<section class="publish-url-card"><span>Final public address</span><strong>${escapeHtml(publicUrl)}</strong><p>Publishing uses this trainer-specific URL. It will not inherit another trainer’s name, photo, city, state, or page record.</p></section><div class="publish-action-grid"><a class="btn btn-outline" href="${trainerPageHref(t)}" target="_blank" rel="noopener">Preview Draft Landing Page</a>${t.pageStatus === "Published" ? `<a class="btn btn-outline" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">View Published Landing Page</a>` : ""}<button class="btn btn-red" data-toggle-lock="${t.id}">${t.locked ? "Return Page To Draft" : "Publish Landing Page"}</button></div>${t.pageStatus === "Published" ? trainerInviteCard(t) : ""}`;
  }
  const finalActions = t.locked
    ? `<button class="btn btn-outline" id="saveTrainerProfile">Save Draft Copy</button><a class="btn btn-red" href="${escapeHtml(trainerPublicUrl(t))}" target="_blank" rel="noopener">Open Live Landing Page</a>`
    : `<button class="btn btn-outline" id="saveTrainerProfile">Save Draft</button><button class="btn btn-red" data-toggle-lock="${escapeHtml(t.id)}">Publish Landing Page</button>`;
  return `<div class="trainer-onboarding"><aside class="onboarding-rail"><p class="portal-tag">Office Setup</p><h2>${escapeHtml(t.name)}</h2><p>Imported trainer details are already loaded. Complete, review, and publish the office-controlled page.</p>${steps.map(([number, title, sub]) => `<button class="onboarding-step ${step === number ? "active" : ""} ${step > number ? "complete" : ""}" data-onboarding-step="${number}"><span>${step > number ? "✓" : number}</span><div><strong>${title}</strong><small>${sub}</small></div></button>`).join("")}</aside><section class="onboarding-workspace"><div class="onboarding-heading"><div><span>Step ${step} of 7</span><h2>${steps[step - 1][1]}</h2><p>${steps[step - 1][2]}. Changes save to this office-controlled trainer profile.</p></div><a class="btn btn-outline" href="${trainerPageHref(t)}" target="_blank" rel="noopener">Preview Landing Page</a></div>${content}<footer class="onboarding-footer"><button class="btn btn-outline" data-onboarding-step="${Math.max(1, step - 1)}" ${step === 1 ? "disabled" : ""}>Back</button><span>Saved to the shared office database</span>${step < 7 ? `<button class="btn btn-red" data-onboarding-step="${step + 1}">Save & Continue</button>` : `<div class="onboarding-final-actions">${finalActions}</div>`}</footer></section></div>${trainerProfileEditor(t)}`;
}

function pageEditorPreviewDocument(trainer) {
  const edits = JSON.stringify(trainer.liveEdits || []).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><link rel="stylesheet" href="/trainer-backoffice/styles.css"><style>html,body{margin:0;background:#fff}.office-lead-form{pointer-events:none}</style></head><body>${publicSiteMarkup(trainer)}<script>window.__LDTT_LIVE_EDITS__=${edits};(${applyLiveEditsToDocument.toString()})(document, window.__LDTT_LIVE_EDITS__);<\/script></body></html>`;
}

function portalEditorPreviewDocument() {
  const previousView = state.activeView;
  const previousRole = session.role;
  const view = state.builderPortalView || "dashboard";
  session.role = "trainer";
  const content = trainerScreens[view]?.() || trainerScreens.dashboard();
  session.role = previousRole;
  state.activeView = previousView;
  const edits = JSON.stringify(activeBuilderEdits()).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><link rel="stylesheet" href="/trainer-backoffice/styles.css"><style>body{margin:0;background:#eef4fb}.portal-preview-shell{display:grid;grid-template-columns:260px 1fr;min-height:100vh}.portal-preview-sidebar{background:#062247;color:#fff;padding:22px}.portal-preview-sidebar img{width:170px;background:#fff;border-radius:14px;padding:10px}.portal-preview-sidebar button{display:block;width:100%;margin:10px 0;padding:12px;border:0;border-radius:10px;text-align:left;font-weight:800}.portal-preview-main{padding:24px}.portal-preview-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.portal-preview-top h1{margin:0;color:#082754}</style></head><body><div class="portal-preview-shell"><aside class="portal-preview-sidebar"><img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><p>Trainer Portal Preview</p>${portalPreviewViews().map(item => `<button>${escapeHtml(item.label)}</button>`).join("")}</aside><main class="portal-preview-main"><div class="portal-preview-top"><h1>${escapeHtml(portalPreviewViews().find(item => item.id === view)?.label || "Trainer Portal")}</h1><strong>${escapeHtml(trainerById(currentTrainerId()).name)}</strong></div>${content}</main></div><script>window.__LDTT_LIVE_EDITS__=${edits};(${applyLiveEditsToDocument.toString()})(document, window.__LDTT_LIVE_EDITS__);<\/script></body></html>`;
}

function builderPreviewConfig(trainer) {
  if (state.builderSurface === "site") {
    const src = `${state.builderMainPage || "/index.html"}${(state.builderMainPage || "").includes("?") ? "&" : "?"}builderPreview=1`;
    return { kind: "src", value: src, label: mainWebsitePages().find(page => page.id === state.builderMainPage)?.label || "Main Website" };
  }
  if (state.builderSurface === "portal") {
    return { kind: "srcdoc", value: portalEditorPreviewDocument(), label: portalPreviewViews().find(page => page.id === state.builderPortalView)?.label || "Trainer Portal" };
  }
  return { kind: "srcdoc", value: pageEditorPreviewDocument(trainer), label: builderPages().find(page => page.id === state.builderPage)?.label || "Trainer Landing Page" };
}

function trainerPageEditor() {
  const trainer = trainerById();
  if (!trainer) return panel("Page Editor", "", "<p>No trainer profile is available.</p>", "pad");
  const style = trainer.styleSettings || {};
  const field = (label, name, value, options = {}) => `<label class="${options.wide ? "wide" : ""}"><span>${escapeHtml(label)}</span>${options.area
    ? `<textarea data-editor-field="${name}">${escapeHtml(value || "")}</textarea>`
    : `<input ${options.type ? `type="${options.type}"` : ""} data-editor-field="${name}" value="${escapeHtml(value || "")}">`}</label>`;
  const editorImageCard = (key, title, description, frameOptions = {}) => {
    const imageValue = key === "profilePhoto" ? trainerHeadshot(trainer) : (trainer[key] || "/assets/lorenzo-logo-transparent.png");
    const frameClass = frameOptions.frameKey ? ` photo-frame-${photoFramePresetValue(trainer[frameOptions.frameKey], frameOptions.fallbackFrame || "standard")}` : "";
    const imageStyle = trainerPhotoStyle(trainer, {
      positionKey: frameOptions.positionKey,
      fitKey: frameOptions.fitKey,
      scaleKey: frameOptions.scaleKey,
      frameKey: frameOptions.frameKey,
      fallbackPosition: frameOptions.fallbackPosition || "center top",
      fallbackFit: frameOptions.fallbackFit || "cover",
      fallbackFrame: frameOptions.fallbackFrame || "standard"
    });
    const frameAttrs = frameOptions.positionKey ? ` data-photo-frame-preview data-photo-position-key="${escapeHtml(frameOptions.positionKey)}"` : "";
    return `<article class="editor-image-card">
    <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>
    <div class="editor-image-preview${frameClass}"${frameAttrs}><img src="${escapeHtml(imageValue)}" style="${imageStyle}" alt="${escapeHtml(title)} preview"></div>
    ${imageFrameControls(trainer, frameOptions, "editor")}
    <label class="editor-upload"><span>Upload ${escapeHtml(title)}</span><input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" data-editor-upload="${escapeHtml(key)}"></label>
  </article>`;
  };
  const editorVideoCard = () => `<article class="editor-image-card editor-video-card">
    <div><strong>Trainer Video</strong><span>Shown below the three training paths on the landing page</span></div>
    <div class="editor-video-preview">${videoPreviewMarkup(trainer.trainerVideoUrl || trainerVideoFor(trainer)?.src, `${trainer.name || "Trainer"} introduction video`, trainer.trainerVideoUrl ? "" : trainerVideoFor(trainer)?.poster || "")}</div>
    <label class="editor-upload"><span>Upload Trainer Video</span><input type="file" accept="video/mp4,video/webm,video/*" data-editor-upload="trainerVideoUrl"></label>
    <label class="video-link-field"><span>Or paste a video link</span><input data-main-trainer-video-url value="${escapeHtml(trainer.trainerVideoUrl || "")}" placeholder="YouTube, Vimeo, Loom, Google Drive, Dropbox, or direct MP4/WebM"></label>
    <button class="btn btn-outline btn-small" type="button" data-apply-main-video-url>Save Video Link</button>
  </article>`;
  const preview = builderPreviewConfig(trainer);
  const activeTab = state.builderTab || "page";
  const tabs = [["page", "Page"], ["sections", "Sections"], ["media", "Media"], ["style", "Style"], ["history", "History"]];
  const selectedLabel = state.builderSelectedSelector ? `Selected: ${state.builderSelectedSelector}` : "Switch to Edit Overlay, then click an editable area in the preview.";
  const sectionOrder = trainer.sectionOrder || ["hero", "stats", "services", "trainer", "reviews", "consultation"];
  const hiddenSections = trainer.hiddenSections || [];
  const sectionControls = state.builderSurface !== "trainer"
    ? `<div class="editor-control-section"><h3>Section Flow</h3><p class="builder-help">Section reordering is protected for main website and portal screens. Use Edit Overlay to select text, images, buttons, and cards directly in the preview.</p></div>`
    : `<div class="editor-control-section"><h3>Section Flow</h3><p class="builder-help">Reorder or hide approved sections. Header, form routing, and Lorenzo trust elements stay protected.</p><div class="builder-section-list">${sectionOrder.map((section, index) => `<article><strong>${escapeHtml(section)}</strong><label><input type="checkbox" data-section-visible="${escapeHtml(section)}" ${hiddenSections.includes(section) ? "" : "checked"}> Visible</label><div><button class="btn btn-outline btn-small" type="button" data-section-move="${escapeHtml(section)}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Up</button><button class="btn btn-outline btn-small" type="button" data-section-move="${escapeHtml(section)}" data-direction="1" ${index === sectionOrder.length - 1 ? "disabled" : ""}>Down</button></div></article>`).join("")}</div></div>`;
  const trainerPageControls = `<div class="editor-control-section"><h3>Page Content</h3><label><span>Trainer</span><select data-editor-trainer>${state.trainers.map(item => `<option value="${item.id}" ${item.id === trainer.id ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.market)}</option>`).join("")}</select></label><label><span>Approved Design</span><select data-editor-field="layout">${approvedLayouts.map(item => `<option value="${item.id}" ${item.id === trainer.layout ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>${field("Hero Headline", "heroHeadline", trainer.heroHeadline, { area: true })}${field("Subheadline", "tagline", trainer.tagline, { area: true })}${field("Trainer Bio", "bio", trainer.bio, { area: true })}</div>`;
  const workspacePageControls = `<div class="editor-control-section"><h3>${state.builderSurface === "site" ? "Main Website Page" : "Trainer Portal Screen"}</h3><p class="builder-help">Browse normally with Edit Overlay off. Turn Edit Overlay on, click an area in the preview, then use Selected Element tools to change copy, images, colors, or spacing.</p><p class="builder-selection">${escapeHtml(selectedLabel)}</p></div>`;
  const selectedElementControls = `<div class="editor-control-section"><h3>Selected Element</h3><p class="builder-selection">${escapeHtml(selectedLabel)}</p><label class="editor-upload"><span>Replace selected image/video</span><input type="file" accept="image/*,video/*" data-editor-upload="selectedMedia"></label><label><span>Paste external video URL</span><input data-builder-embed-url placeholder="YouTube, Vimeo, Loom, Google Drive, Dropbox, or direct video URL"></label><button class="btn btn-outline" type="button" data-apply-embed-video>Use Video URL On Selected Element</button></div>`;
  const controls = {
    page: `${state.builderSurface === "trainer" ? trainerPageControls : workspacePageControls}${selectedElementControls}`,
    sections: sectionControls,
    media: `<div class="editor-control-section"><h3>Media Library</h3><p class="builder-help">Upload photos, logos, or long-form videos. Large images are compressed before upload. Large videos use browser compression where supported, or an external video URL when needed.</p><label class="editor-upload media-drop"><span>Upload Photo / Logo / Video</span><input type="file" accept="image/*,video/*" data-editor-upload="mediaLibrary"></label>${renderMediaLibrary(trainer)}</div><div class="editor-control-section"><h3>Core Images & Video</h3><p class="builder-help">Simple rule: Headshot is for Find a Trainer cards. Bio Photo is for View Bio and the landing-page bio section.</p><div class="editor-image-grid">${editorImageCard("profilePhoto", "Headshot (cards only)", "Find a Trainer cards only", { frameKey: "profilePhotoFrame", positionKey: "profilePhotoPosition", fitKey: "profilePhotoFit", scaleKey: "profilePhotoScale", fallbackFit: "contain", fallbackFrame: "portrait" }) }${editorImageCard("heroTrainerPhoto", "Top Landing Photo", "First trainer photo on the landing page", { frameKey: "heroPhotoFrame", positionKey: "heroPhotoPosition", fitKey: "heroPhotoFit", scaleKey: "heroPhotoScale" }) }${editorImageCard("landingBioPhoto", "Bio Photo (View Bio)", "View Bio page and landing-page bio section", { frameKey: "bioPhotoFrame", positionKey: "bioPhotoPosition", fitKey: "bioPhotoFit", scaleKey: "bioPhotoScale", fallbackFit: "cover", fallbackFrame: "tight" }) }${editorImageCard("image", "Hero Background", "Wide background behind the hero") }${editorImageCard("companyLogo", "Company Logo", "Optional approved local logo") }${editorVideoCard()}</div></div>`,
    style: `<div class="editor-control-section"><h3>Typography & Color</h3><label><span>Font</span><select data-editor-style="fontFamily">${["Inter","Arial","Georgia","Trebuchet MS","Impact"].map(font => `<option ${font === (style.fontFamily || "Inter") ? "selected" : ""}>${font}</option>`).join("")}</select></label><label><span>Type Scale</span><input type="range" min="0.85" max="1.25" step="0.01" data-editor-style="fontScale" value="${Number(style.fontScale || 1)}"></label><label><span>Primary Color</span><input type="color" data-editor-style="brandPrimary" value="${escapeHtml(style.brandPrimary || "#071f44")}"></label><label><span>Accent Color</span><input type="color" data-editor-style="brandAccent" value="${escapeHtml(style.brandAccent || "#d80f35")}"></label></div><div class="editor-control-section"><h3>Approved Reviews</h3>${trainerApprovedReviewManagerMarkup(trainer, { compact: true })}${field("Review 1 Client", "review1Author", trainer.review1Author)}${field("Review 1", "review1Copy", trainer.review1Copy, { area: true })}${field("Review 2 Client", "review2Author", trainer.review2Author)}${field("Review 2", "review2Copy", trainer.review2Copy, { area: true })}${field("Review 3 Client", "review3Author", trainer.review3Author)}${field("Review 3", "review3Copy", trainer.review3Copy, { area: true })}</div>`,
    history: `<div class="editor-control-section"><h3>Live Edits</h3>${renderLiveEditList(trainer)}<button class="btn btn-outline" type="button" data-reset-live-edits>Reset All Live Edits</button></div>`
  };
  const pagePicker = state.builderSurface === "site"
    ? `<label><span>Website Page</span><select data-builder-main-page>${mainWebsitePages().map(page => `<option value="${page.id}" ${page.id === state.builderMainPage ? "selected" : ""}>${page.label}</option>`).join("")}</select></label>`
    : state.builderSurface === "portal"
      ? `<label><span>Portal Screen</span><select data-builder-portal-view>${portalPreviewViews().map(page => `<option value="${page.id}" ${page.id === state.builderPortalView ? "selected" : ""}>${page.label}</option>`).join("")}</select></label>`
      : `<label><span>Page Area</span><select data-builder-page>${builderPages().map(page => `<option value="${page.id}" ${page.id === state.builderPage ? "selected" : ""}>${page.label}</option>`).join("")}</select></label>`;
  return `<section class="page-editor-shell pro-builder fullscreen-builder">
    <header class="page-editor-topbar">
      <div><p class="portal-tag">Full-Screen Site Builder</p><h2>${escapeHtml(builderSurfaces().find(item => item.id === state.builderSurface)?.label || "Site Builder")}</h2><p>Use Browse to click around like a visitor. Turn Edit Overlay on only when the office wants to select and edit content.</p></div>
      <div class="row-actions"><button class="btn btn-outline" data-view="trainerPages">Back To Trainer Network</button><button class="btn btn-outline" data-editor-save="draft">Save Draft</button>${state.builderSurface === "trainer" ? `<button class="btn btn-red" data-editor-save="publish">Publish & Lock Trainer Page</button>` : `<button class="btn btn-red" data-editor-save="draft">Save Workspace Changes</button>`}</div>
    </header>
    <nav class="builder-toolbar">
      <label><span>Edit Target</span><select data-builder-surface>${builderSurfaces().map(surface => `<option value="${surface.id}" ${surface.id === state.builderSurface ? "selected" : ""}>${surface.label}</option>`).join("")}</select></label>
      ${pagePicker}
      <div class="builder-mode-group"><button class="${state.builderMode === "edit" ? "active" : ""}" type="button" data-builder-mode="edit">Edit Overlay</button><button class="${state.builderMode === "browse" ? "active" : ""}" type="button" data-builder-mode="browse">Browse</button></div>
      <div class="builder-mode-group"><button class="${state.builderDevice !== "mobile" ? "active" : ""}" type="button" data-builder-device="desktop">Desktop</button><button class="${state.builderDevice === "mobile" ? "active" : ""}" type="button" data-builder-device="mobile">Mobile</button></div>
      <span class="builder-save-state">${state.builderMode === "edit" ? "Editing Enabled" : "Browse Mode"} · ${escapeHtml(preview.label)}</span>
    </nav>
    <div class="page-editor-grid">
      <aside class="page-editor-controls">
        <div class="builder-tabs">${tabs.map(([id, label]) => `<button type="button" class="${activeTab === id ? "active" : ""}" data-builder-tab="${id}">${label}</button>`).join("")}</div>
        ${controls[activeTab] || controls.page}
      </aside>
      <main class="page-editor-canvas ${state.builderDevice === "mobile" ? "mobile-device" : ""}">
        <div class="page-editor-device-bar"><span>${state.builderMode === "edit" ? "Live Overlay Editor" : "Browse Preview"} · ${escapeHtml(preview.label)}</span><strong>${state.builderSurface === "trainer" ? `${escapeHtml(trainer.pageStatus)}${trainer.locked ? " · Locked" : ""}` : "Workspace Draft"}</strong></div>
        <iframe id="pageEditorPreview" title="${escapeHtml(preview.label)} live preview" ${preview.kind === "src" ? `src="${escapeHtml(preview.value)}"` : `srcdoc="${escapeHtml(preview.value)}"`}></iframe>
      </main>
    </div>
  </section>`;
}

function refreshPageEditorPreview() {
  const frame = document.getElementById("pageEditorPreview");
  if (frame) {
    const preview = builderPreviewConfig(trainerById());
    if (preview.kind === "src") {
      frame.removeAttribute("srcdoc");
      frame.src = preview.value;
    } else {
      frame.removeAttribute("src");
      frame.srcdoc = preview.value;
    }
    frame.addEventListener("load", () => injectLiveBuilder(frame), { once: true });
  }
}

function injectLiveBuilder(frame) {
  if (!frame || state.activeView !== "pageEditor") return;
  const doc = frame.contentDocument;
  if (!doc) return;
  applyLiveEditsToDocument(doc, activeBuilderEdits());
  if (state.builderSurface === "trainer") applySectionBuilderSettings(doc, trainerById());
  if (state.builderMode !== "edit") return;
  if (!doc.getElementById("ldtt-builder-style")) {
    const style = doc.createElement("style");
    style.id = "ldtt-builder-style";
    style.textContent = `
      [data-ldtt-editable-hover]{outline:2px solid #0b6bff!important;outline-offset:4px!important;cursor:pointer!important}
      [data-ldtt-selected]{outline:3px solid #d80f35!important;outline-offset:5px!important}
      [contenteditable="true"]{box-shadow:0 0 0 4px rgba(216,15,53,.18)!important;border-radius:6px!important}
    `;
    doc.head.appendChild(style);
  }
  const candidates = doc.querySelectorAll("h1,h2,h3,h4,p,li,span,strong,a,button,img,video,section,article,.card,.panel,.metric-card,.nav-btn,.btn,.lp-service-grid article,.landing-service-card,.lp-final,.lp5-final,.lp6-cta,.lp3-contact,.landing-reviews,.lp-process,.lp-services");
  candidates.forEach(element => {
    if (element.closest("form") || element.closest(".office-lead-form")) return;
    element.addEventListener("mouseenter", () => element.setAttribute("data-ldtt-editable-hover", "true"));
    element.addEventListener("mouseleave", () => element.removeAttribute("data-ldtt-editable-hover"));
    element.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      doc.querySelectorAll("[data-ldtt-selected]").forEach(item => item.removeAttribute("data-ldtt-selected"));
      element.setAttribute("data-ldtt-selected", "true");
      const selector = selectorForElement(element);
      state.builderSelectedSelector = selector;
      persistStateSnapshot();
      const label = element.textContent?.trim()?.slice(0, 64) || element.alt || element.tagName.toLowerCase();
      const isText = !["IMG", "VIDEO"].includes(element.tagName) && element.children.length < 2;
      if (isText) {
        element.setAttribute("contenteditable", "true");
        element.focus();
        const range = doc.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        const selection = doc.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const saveText = () => {
          element.removeAttribute("contenteditable");
          upsertLiveEdit(trainerById(), { t: "text", k: selector, v: element.textContent, label });
          showToast("Text saved to builder draft");
        };
        element.addEventListener("blur", saveText, { once: true });
      } else {
        showToast("Element selected. Use the media, style, or history controls to edit it.");
      }
    });
  });
}

function profileFieldPairs() {
  return [
    { profile: "profileName", public: "publicName", landing: "name", label: "Trainer Name" },
    { profile: "profileTitle", landing: "title", label: "Professional Title" },
    { profile: "profileMarket", public: "publicMarket", landing: "market", label: "City / Market" },
    { profile: "profileState", public: "publicState", landing: "state", label: "State" },
    { profile: "profileServiceArea", public: "publicServiceArea", landing: "serviceArea", label: "Service Area", area: true },
    { profile: "profilePhone", public: "publicPhone", landing: "phone", label: "Public Phone" },
    { profile: "profileEmail", public: "publicEmail", landing: "email", label: "Public Email" },
    { profile: "profileBio", public: "publicBio", landing: "bio", label: "Trainer Bio", area: true },
    { profile: "profilePhoto", public: "publicPhoto", landing: null, label: "Find a Trainer / Card Headshot", upload: true },
    { profile: "profileSpecialtiesText", public: "publicSpecialtiesText", landing: "specialties", label: "Specialties", area: true, list: true },
    { profile: "profileCredentialsText", public: "publicCredentialsText", landing: "credentials", label: "Credentials", area: true, list: true }
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
  const profileValue = pair.profile === "profilePhoto" ? trainerHeadshot(trainer) : fieldValue(trainer, pair.profile);
  const publicValue = pair.public ? fieldValue(trainer, pair.public) : profileValue;
  const landingValue = pair.landing ? fieldValue(trainer, pair.landing) : profileValue;
  const publicMatches = normalizedSyncValue(profileValue) === normalizedSyncValue(publicValue);
  const landingMatches = normalizedSyncValue(profileValue) === normalizedSyncValue(landingValue);
  const control = pair.upload
    ? `<div class="profile-photo-upload"><img src="${escapeHtml(profileValue || "/assets/lorenzo-logo-transparent.png")}" alt="${escapeHtml(pair.label)} preview"><label class="upload-drop"><strong>Upload headshot file</strong><small>JPG, PNG, WebP, or GIF</small><input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" data-trainer-upload="${pair.profile}"></label></div>`
    : pair.area
    ? `<textarea data-profile-field="${pair.profile}" placeholder="${escapeHtml(pair.label)}">${escapeHtml(profileValue)}</textarea>`
    : `<input data-profile-field="${pair.profile}" value="${escapeHtml(profileValue)}" placeholder="${escapeHtml(pair.label)}">`;
  return `<article class="profile-sync-row ${publicMatches && landingMatches ? "matches" : "mismatch"}">
    <label><span>${escapeHtml(pair.label)}</span>${control}</label>
    ${pair.public ? `<div class="sync-meta"><span class="sync-state ${publicMatches ? "match" : "mismatch"}">${publicMatches ? "✓ Matches public profile" : "Needs public profile update"}</span><button class="btn btn-outline btn-small" type="button" data-sync-public-field="${pair.profile}">Update frontend</button></div>` : ""}
    ${pair.landing ? `<div class="sync-meta"><span class="sync-state ${landingMatches ? "match" : "mismatch"}">${landingMatches ? "✓ Matches landing page" : "Needs landing page update"}</span><button class="btn btn-outline btn-small" type="button" data-sync-profile-field="${pair.profile}" data-landing-field="${pair.landing}" data-sync-list="${pair.list ? "true" : "false"}">Update landing page</button></div>` : ""}
  </article>`;
}

function trainerProfileEditor(trainer) {
  return `<section class="profile-editor-panel">
    <div class="profile-editor-head"><div><p class="portal-tag">Profile Editor</p><h2>Trainer profile source of truth</h2><p>Edit once, then use the separate checkmarked controls to update the public trainer directory/profile or the trainer's landing page field.</p></div><div class="row-actions"><a class="btn btn-outline" href="${trainerBioHref(trainer)}" target="_blank" rel="noopener">View Public Profile</a><a class="btn btn-outline" href="${trainerPageHref(trainer)}" target="_blank" rel="noopener">View Landing Page</a></div></div>
    <div class="profile-sync-grid">${profileFieldPairs().map(pair => syncRow(trainer, pair)).join("")}</div>
  </section>`;
}

function trainerSelectList() {
  const groups = [...new Set(state.trainers.map(trainer => trainer.state || "Office Added"))];
  return `<div class="trainer-roster-summary"><strong>${state.trainers.length} trainers available</strong><span>Select any frontend trainer to populate the office setup wizard with their real bio, location, and photos.</span></div>${groups.map(stateName => `<section class="trainer-state-group"><h3>${escapeHtml(stateName)}</h3><div class="trainer-select-list">${state.trainers.filter(trainer => (trainer.state || "Office Added") === stateName).map(trainer => `<button class="trainer-select ${state.selectedTrainerId === trainer.id ? "active" : ""}" data-select-trainer="${trainer.id}"><img src="${escapeHtml(trainerHeadshot(trainer))}" alt=""><span><strong>${escapeHtml(trainer.name || "Trainer Draft")}</strong><small>${escapeHtml(trainer.market)} · ${trainer.pageStatus}${trainer.locked ? " · Locked" : ""}</small></span></button>`).join("")}</div></section>`).join("")}`;
}

function trainerReadOnlyDirectory() {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Trainer</th><th>Market</th><th>Service Area</th><th>Page Status</th><th>Access</th><th>Quick View</th></tr></thead><tbody>${state.trainers.map(trainer => `<tr><td><strong>${escapeHtml(trainer.name)}</strong><small>${escapeHtml(trainer.email || "No email listed")}</small></td><td>${escapeHtml(trainer.market || "—")}</td><td>${escapeHtml(trainer.serviceArea || "—")}</td><td>${pageStatusBadge(trainer)}</td><td><span class="status ${trainer.accessStatus === "Disabled" ? "lost" : "live"}">${escapeHtml(trainer.accessStatus || "Active")}</span></td><td><a class="btn btn-outline btn-small" href="${trainerPageHref(trainer)}" target="_blank" rel="noopener">Open Landing Page</a></td></tr>`).join("")}</tbody></table></div><p class="panel-copy">Office Admin access is view-only here. Super Admins control trainer profiles, landing pages, publishing, reviews, and page-editor changes.</p>`;
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
  return `<div class="lock-notice">${icon("shield")}<div><strong>Office-controlled and locked</strong><p>Lorenzo's office manages the bio, photos, reviews, layout, publishing, and page lock. Trainers submit content for approval.</p></div></div><ul class="health-list"><li><span class="check">✓</span> Brand-uniform Lorenzo page</li><li><span class="check">✓</span> Three approved template routes only</li><li><span class="check">✓</span> Safer office consultation CTA</li><li><span class="check">✓</span> No trainer publish controls or DNS access</li></ul>${trainerInviteCard(trainer)}`;
}

function trainerInviteText(trainer) {
  const staffUrl = staffPortalUrl();
  const landingUrl = trainerPublicUrl(trainer);
  const username = trainer.profileEmail || trainer.email || trainer.username || "trainer email address";
  const trainerNameValue = trainer.profileName || trainer.name || "Trainer";
  return `Congratulations ${trainerNameValue},

Your Lorenzo's Dog Training Team trainer portal and landing page are ready.

Trainer portal: ${staffUrl}
Username: ${username}
Temporary password: ${TRAINER_TEMP_PASSWORD_NOTICE}

Your landing page: ${landingUrl}

When you log in for the first time, please create your permanent password. Inside the portal you can review assigned leads, view your locked trainer page, submit media/reviews for approval, and add Facebook, Instagram, or TikTok links in Settings.

Your public landing page is managed by Lorenzo's office and powered by Lorenzo's Dog Training Team.

Thank you,
Lorenzo's Dog Training Team`;
}

function trainerInviteCard(trainer) {
  const inviteId = `trainerInvite-${escapeHtml(trainer.id || "trainer")}`;
  const hasEmail = Boolean(String(trainer.profileEmail || trainer.email || trainer.username || "").trim());
  return `<section class="trainer-invite-card">
    <div><span>Trainer invite message</span><h3>Ready-to-copy portal instructions</h3><p>Appears after publishing and can be sent by email or text. The page URL always uses the trainer first/last name after the domain.</p></div>
    ${hasEmail ? "" : `<p class="form-inline-warning">Add the trainer email before sending this login message.</p>`}
    <textarea id="${inviteId}" readonly>${escapeHtml(trainerInviteText(trainer))}</textarea>
    <button class="btn btn-outline" type="button" data-copy-invite="${inviteId}">Copy Invite Message</button>
  </section>`;
}

function showTrainerInviteDialog(trainer) {
  if (!trainer) return;
  const inviteId = `trainerInviteModal-${Date.now()}`;
  const publishItems = [
    `Landing page: ${trainerPublicUrl(trainer)}`,
    `View Bio page: ${PUBLIC_SITE_ORIGIN}${trainerBioHref(trainer)}`,
    "Find a Trainer: live directory sync will include this published trainer",
    "Reviews: approved destinations remain attached to this trainer page",
    "Trainer portal access: created or enabled from the trainer email"
  ];
  const dialog = document.createElement("dialog");
  dialog.className = "action-confirmation-dialog trainer-invite-dialog";
  dialog.innerHTML = `<button type="button" class="action-confirmation-close" aria-label="Close">×</button>
    <div class="action-confirmation-icon">✓</div>
    <h2>Trainer page published.</h2>
    <p>${escapeHtml(trainer.name || "This trainer")} is ready with a locked landing page and portal access.</p>
    ${actionConfirmationList(publishItems)}
    <textarea id="${inviteId}" readonly>${escapeHtml(trainerInviteText(trainer))}</textarea>
    <div class="row-actions">
      <button type="button" class="btn btn-red" data-copy-invite="${inviteId}">Copy Trainer Message</button>
      <a class="btn btn-outline" href="${escapeHtml(trainerPublicUrl(trainer))}" target="_blank" rel="noopener">Open Landing Page</a>
      <a class="btn btn-outline" href="${escapeHtml(trainerBioHref(trainer))}" target="_blank" rel="noopener">Open View Bio</a>
    </div>
    <button type="button" class="btn btn-outline action-confirmation-done">Close</button>`;
  document.body.appendChild(dialog);
  const close = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector(".action-confirmation-close").addEventListener("click", close);
  dialog.querySelector(".action-confirmation-done").addEventListener("click", close);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
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

function pendingReviewSubmissions() {
  return state.submissions.filter(sub => sub.status === "Pending" && ["Review", "Testimonial"].includes(sub.type));
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

function applicationOverrides() {
  try {
    return JSON.parse(localStorage.getItem("ldttTrainerApplicationOverrides.v1") || "{}") || {};
  } catch {
    return {};
  }
}

function saveApplicationOverride(id, changes) {
  const overrides = applicationOverrides();
  overrides[id] = { ...(overrides[id] || {}), ...changes, updatedAt: new Date().toISOString() };
  localStorage.setItem("ldttTrainerApplicationOverrides.v1", JSON.stringify(overrides));
  return overrides[id];
}

function applicationRows() {
  if (remoteReady) return [...state.applications].sort((a, b) => timestampValue(b.receivedAt || b.createdAt) - timestampValue(a.receivedAt || a.createdAt));
  const overrides = applicationOverrides();
  const imported = IMPORTED_APPLICATION_RESPONSES.map(row => ({
    ...row,
    id: row.id || row.source_submission_id || `imported-app-${slugify([row.first_name, row.last_name, row.email].filter(Boolean).join("-"))}`,
    createdAt: row.createdAt || row.timestamp || "",
    status: row.status || "New Application",
    note: row.note || row.office_note || "",
    ...(overrides[row.id || row.source_submission_id] || {})
  }));
  const dedupe = rows => {
    const map = new Map();
    rows.forEach(row => {
      const key = row.source_submission_id || row.id || `${String(row.email || "").toLowerCase()}|${row.createdAt || ""}|${row.phone || ""}`;
      if (!map.has(key)) map.set(key, row);
      else map.set(key, { ...map.get(key), ...row, rawPayload: row.rawPayload || map.get(key).rawPayload });
    });
    return Array.from(map.values()).sort((a, b) => timestampValue(b.receivedAt || b.createdAt) - timestampValue(a.receivedAt || a.createdAt));
  };
  const stored = storedRows("ldttTrainerApplications.v1").map((row, index) => ({
    ...row,
    id: `stored-app-${index}`,
    createdAt: row.timestamp || row.createdAt || "",
    receivedAt: row.timestamp || row.createdAt || "",
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    email: row.email || "",
    phone: row.phone || "",
    city: row.city || "",
    state: row.state || "",
    referral_source: row.referral_source || "",
    status: row.status || "New Application",
    delivery_local: row.delivery_local || "saved",
    delivery_google: row.delivery_google || "not_recorded",
    delivery_email: row.delivery_email || "not_recorded",
    delivery_supabase: row.delivery_supabase || "not_connected",
    note: row.office_note || row.note || row.dog_description || row.additional_training || row.owned_dogs_description || "Submitted from the website trainer application."
  }));
  return dedupe([...imported, ...stored, ...state.applications]);
}

function updateApplicationRecord(id, changes) {
  const application = state.applications.find(item => item.id === id);
  if (application) {
    Object.assign(application, changes);
    return application;
  }
  const importedApplication = IMPORTED_APPLICATION_RESPONSES.find(item => item.id === id || item.source_submission_id === id);
  if (importedApplication) {
    return { ...importedApplication, ...saveApplicationOverride(id, changes) };
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

function applicationSearchValues(app = {}) {
  return [
    applicationDisplayName(app),
    app.first_name,
    app.last_name,
    app.email,
    app.phone,
    app.address_line_1,
    app.address_line_2,
    app.city,
    app.state,
    app.zip,
    app.market,
    app.source_form,
    app.source_page,
    app.referral_source,
    app.status,
    app.note,
    app.assignedUserId ? portalActorLabel(app.assignedUserId) : "",
    applicationInquiryTypeLabel(app),
    applicationRawPayload(app)
  ];
}

function applicationSearchHaystack(app = {}) {
  return normalizedSearchText(applicationSearchValues(app));
}

function filteredApplicationRows(options = {}) {
  const activeFilter = options.filter ?? currentApplicationFilter();
  const search = options.search ?? state.applicationSearch ?? "";
  return applicationRows()
    .filter(app => activeFilter === "All" || (app.status || "New Application") === activeFilter)
    .filter(app => recordMatchesSearch(applicationSearchValues(app), search))
    .sort((a, b) => timestampValue(b.receivedAt || b.createdAt) - timestampValue(a.receivedAt || a.createdAt));
}

function trainerApplicationGoogleFormPanel() {
  const mode = state.applicationViewMode || "sheet";
  const activeFilter = currentApplicationFilter();
  const allRows = applicationRows();
  const search = state.applicationSearch || "";
  const rows = allRows.filter(app => activeFilter === "All" || (app.status || "New Application") === activeFilter)
    .filter(app => recordMatchesSearch(applicationSearchValues(app), search))
    .sort((a, b) => timestampValue(b.receivedAt || b.createdAt) - timestampValue(a.receivedAt || a.createdAt));
  const body = mode === "sheet" ? applicationSheetView(rows) : mode === "individual" ? applicationIndividualView(rows) : applicationSummaryCharts(rows);
  const modes = [
    ["sheet", "View Sheet"],
    ["summary", "View Data In Charts"],
    ["individual", "Individual Records"]
  ];
  return `<div class="application-response-center">
    <div class="source-record-note">
      <span class="status live">Internal Response Sheet + Recruiting Inbox + Supabase</span>
      <p>Trainer applications now work from the internal response sheet below so the office can review, sort, chart, open, and note each application without relying on the public Google Form response iframe.</p>
      <div class="application-mode-tabs">
        ${modes.map(([item, label]) => `<button type="button" class="btn application-mode-tab ${mode === item ? "btn-red active" : "btn-outline"}" data-application-mode="${item}" aria-pressed="${mode === item ? "true" : "false"}">${label}</button>`).join("")}
        <button class="btn btn-outline" type="button" data-export-applications>Download Sheet CSV</button>
        <a class="btn btn-outline" href="../trainer-application.html" target="_blank" rel="noopener">Preview Website Application</a>
      </div>
      <p class="panel-copy"><strong>${rows.length} of ${allRows.length} applications shown (${escapeHtml(activeFilter)}${state.applicationSearch ? `, search: "${escapeHtml(state.applicationSearch)}"` : ""}).</strong> The exact form fields, including signature, are preserved in the internal sheet and each full application record.</p>
    </div>
    ${body}
  </div>`;
}

const APPLICATION_STATUS_OPTIONS = ["All", "New Application", "Under Review", "Discovery Call Inquiry", "Interview Scheduled", "Moved Forward", "Declined", "Archived"];
function currentApplicationFilter() {
  if (state.applicationFilter === "Discovery Follow-up") state.applicationFilter = "Discovery Call Inquiry";
  if (!APPLICATION_STATUS_OPTIONS.includes(state.applicationFilter)) state.applicationFilter = "All";
  return state.applicationFilter || "All";
}

function applicationStatusFilterBar() {
  const activeFilter = currentApplicationFilter();
  return `<section class="application-top-filter" aria-label="Application sheet filter">
    <div>
      <span class="filter-label">Application sheet filter</span>
      <p>This filter changes the sheet/table below. The pipeline always shows every application so cards never look missing.</p>
    </div>
    <div class="filter-bar application-filter-bar" role="group" aria-label="Filter application sheet by status">${APPLICATION_STATUS_OPTIONS.map(status => `<button type="button" class="btn application-filter-chip ${activeFilter === status ? "btn-red active" : "btn-outline"}" data-application-filter="${escapeHtml(status)}" aria-pressed="${activeFilter === status ? "true" : "false"}">${escapeHtml(status)}</button>`).join("")}</div>
    <input class="select-pill application-search" data-application-search value="${escapeHtml(state.applicationSearch || "")}" placeholder="Search applications by name, phone, email, city, source, answer...">
  </section>`;
}

const APPLICATION_FIELD_ALIASES = {
  createdAt: ["received_at", "created_at", "Timestamp"],
  referral_source: ["heard_about_us", "How did you hear about Lorenzo's Dog Training Team? *", "How were you referred to this opportunity?"],
  birthdate: ["date_of_birth", "Date of Birth", "Birthdate"],
  legally_eligible: ["work_eligibility", "eligible_to_work"],
  drug_test: ["willing_drug_test"],
  felony: ["felony_conviction"],
  date_of_conviction: ["conviction_date"],
  date_of_release: ["release_date"],
  comfortable_dogs: ["comfortable_working_dogs"],
  dog_bite_history: ["bitten_by_dog"],
  owns_dogs: ["owned_dogs"],
  owned_dogs_description: ["dog_experience", "describe_dog_experience"],
  workout: ["physically_active"],
  lift_100: ["lift_control_100"],
  run_2_miles: ["run_walk_two_miles"],
  team_player: ["comfortable_system_team"],
  reliable_vehicle: ["reliable_transportation"],
  trade_technical_school: ["trade_school"],
  college_university: ["college"],
  company: ["employment_1_company"],
  company_address: ["employment_1_address"],
  address_line_1_2: ["employment_1_address"],
  city_2: ["employment_1_city"],
  state_2: ["employment_1_state"],
  zip_code_2: ["employment_1_zip"],
  are_you_still_employed: ["employment_1_status"],
  start_date: ["employment_1_start_date"],
  end_date: ["employment_1_end_date"],
  ending_job_title: ["employment_1_job_title"],
  salary_earnings: ["employment_1_salary"],
  reason_for_leaving: ["employment_1_reason"],
  company_2: ["employment_2_company"],
  company_address_2: ["employment_2_address"],
  address_line_1_3: ["employment_2_address"],
  city_3: ["employment_2_city"],
  state_3: ["employment_2_state"],
  zip_code_3: ["employment_2_zip"],
  are_you_still_employed_2: ["employment_2_status"],
  start_date_2: ["employment_2_start_date"],
  end_date_2: ["employment_2_end_date"],
  ending_job_title_2: ["employment_2_job_title"],
  salary_earnings_2: ["employment_2_salary"],
  reason_for_leaving_2: ["employment_2_reason"],
  company_3: ["employment_3_company"],
  company_address_3: ["employment_3_address"],
  address_line_1_4: ["employment_3_address"],
  city_4: ["employment_3_city"],
  state_4: ["employment_3_state"],
  zip_code_4: ["employment_3_zip"],
  are_you_still_employed_3: ["employment_3_status"],
  start_date_3: ["employment_3_start_date"],
  end_date_3: ["employment_3_end_date"],
  ending_job_title_3: ["employment_3_job_title"],
  salary_earnings_3: ["employment_3_salary"],
  reason_for_leaving_3: ["employment_3_reason"],
  sms_consent_text: ["sms_agreement_text", "sms_disclosure", "sms_opt_in_text"],
  application_certification: ["application_certification_text", "certification", "certification_text", "certify_true_complete"]
};

const APPLICATION_INTERNAL_RAW_FIELD_KEYS = new Set([
  ...LEAD_INTERNAL_RAW_FIELD_KEYS,
  "delivery_complete",
  "deliveryComplete",
  "entry_id",
  "entryId",
  "form_endpoint",
  "google_form_endpoint"
]);

function applicationBaseFields() {
  const fields = [
    { key: "createdAt", label: "Timestamp" },
    { key: "referral_source", label: "How did you hear about Lorenzo's Dog Training Team? *" },
    { key: "first_name", label: "First Name *" },
    { key: "last_name", label: "Last Name *" },
    { key: "address_line_1", label: "Address Line 1 *" },
    { key: "address_line_2", label: "Address Line 2 (optional)" },
    { key: "city", label: "City *" },
    { key: "state", label: "State *" },
    { key: "zip", label: "ZIP Code *" },
    { key: "email", label: "Email Address *" },
    { key: "phone", label: "Phone *" },
    { key: "birthdate", label: "Date of Birth" },
    { key: "legally_eligible", label: "Are you legally eligible to work in the United States? *" },
    { key: "drug_test", label: "Are you willing to submit to a drug test? *" },
    { key: "felony", label: "Have you ever been convicted of a felony? *" },
    { key: "felony_explanation", label: "If yes, please explain" },
    { key: "date_of_conviction", label: "Conviction Date" },
    { key: "date_of_release", label: "Release Date" },
    { key: "comfortable_dogs", label: "Are you comfortable working around dogs of different sizes, breeds, and temperaments? *" },
    { key: "dog_bite_history", label: "Have you ever been bitten by a dog? *" },
    { key: "dog_bite_explanation", label: "If yes, please explain" },
    { key: "owns_dogs", label: "Do you currently own, or have you previously owned, dogs? *" },
    { key: "owned_dogs_description", label: "Describe your dog experience" },
    { key: "physical_condition", label: "How would you describe your physical condition? *" },
    { key: "workout", label: "Do you work out or stay physically active? *" },
    { key: "lift_100", label: "Can you lift or control up to 100 pounds when needed? *" },
    { key: "run_2_miles", label: "Could you run or walk two miles if the work required it? *" },
    { key: "smoke", label: "Do you smoke? *" },
    { key: "team_player", label: "Are you comfortable working inside a system and being part of a team? *" },
    { key: "reliable_vehicle", label: "Do you have reliable transportation? *" },
    { key: "drivers_license", label: "Do you have a valid driver's license? *" },
    { key: "cleveland_training", label: "Are you willing and able to travel for required training in Cleveland, Ohio if accepted? *" },
    { key: "education_level", label: "Highest education level completed" },
    { key: "high_school", label: "High School" },
    { key: "trade_technical_school", label: "Trade School" },
    { key: "military", label: "Military Service" },
    { key: "college_university", label: "College" },
    { key: "additional_training", label: "Additional training, certifications, or experience" },
    { key: "company", label: "Employment History 1 - Company *" },
    { key: "ending_job_title", label: "Employment History 1 - Ending Job Title *" },
    { key: "company_address", label: "Employment History 1 - Company Address *" },
    { key: "city_2", label: "Employment History 1 - City *" },
    { key: "state_2", label: "Employment History 1 - State *" },
    { key: "zip_code_2", label: "Employment History 1 - ZIP Code *" },
    { key: "are_you_still_employed", label: "Employment History 1 - Are you still employed? *" },
    { key: "start_date", label: "Employment History 1 - Start Date *" },
    { key: "end_date", label: "Employment History 1 - End Date *" },
    { key: "salary_earnings", label: "Employment History 1 - Salary Earnings (USD / year) *" },
    { key: "reason_for_leaving", label: "Employment History 1 - Reason for leaving" },
    { key: "company_2", label: "Employment History 2 - Company" },
    { key: "ending_job_title_2", label: "Employment History 2 - Ending Job Title" },
    { key: "company_address_2", label: "Employment History 2 - Company Address" },
    { key: "city_3", label: "Employment History 2 - City" },
    { key: "state_3", label: "Employment History 2 - State" },
    { key: "zip_code_3", label: "Employment History 2 - ZIP Code" },
    { key: "are_you_still_employed_2", label: "Employment History 2 - Are you still employed?" },
    { key: "start_date_2", label: "Employment History 2 - Start Date" },
    { key: "end_date_2", label: "Employment History 2 - End Date" },
    { key: "salary_earnings_2", label: "Employment History 2 - Salary Earnings (USD / year)" },
    { key: "reason_for_leaving_2", label: "Employment History 2 - Reason for leaving" },
    { key: "company_3", label: "Employment History 3 - Company" },
    { key: "ending_job_title_3", label: "Employment History 3 - Ending Job Title" },
    { key: "company_address_3", label: "Employment History 3 - Company Address" },
    { key: "city_4", label: "Employment History 3 - City" },
    { key: "state_4", label: "Employment History 3 - State" },
    { key: "zip_code_4", label: "Employment History 3 - ZIP Code" },
    { key: "are_you_still_employed_3", label: "Employment History 3 - Are you still employed?" },
    { key: "start_date_3", label: "Employment History 3 - Start Date" },
    { key: "end_date_3", label: "Employment History 3 - End Date" },
    { key: "salary_earnings_3", label: "Employment History 3 - Salary Earnings (USD / year)" },
    { key: "reason_for_leaving_3", label: "Employment History 3 - Reason for leaving" },
    { key: "sms_consent", label: "SMS consent checkbox/agreement accepted" },
    { key: "sms_consent_text", label: "SMS consent checkbox/agreement text" },
    { key: "signature", label: "Electronic Signature *" },
    { key: "application_certification", label: "*I certify that the information provided is true and complete to the best of my knowledge." }
  ];
  const existing = new Set(fields.map(field => field.key));
  IMPORTED_APPLICATION_FIELDS.forEach(field => {
    if (!field?.key || existing.has(field.key)) return;
    fields.push(field);
    existing.add(field.key);
  });
  return fields;
}

function applicationExportFields(rows = applicationRows()) {
  const fields = applicationBaseFields().map(field => ({ ...field }));
  const seen = new Set();
  fields.forEach(field => {
    seen.add(field.key);
    seen.add(field.label);
    (APPLICATION_FIELD_ALIASES[field.key] || []).forEach(alias => seen.add(alias));
  });
  rows.forEach(app => {
    Object.keys(applicationRawPayload(app)).forEach(label => {
      if (!label || seen.has(label) || APPLICATION_INTERNAL_RAW_FIELD_KEYS.has(label)) return;
      fields.push({ key: label, label });
      seen.add(label);
    });
  });
  return fields;
}

function applicationRawPayload(app) {
  return app?.rawPayload || app?.raw_payload || {};
}

function applicationFieldValue(app, key, label) {
  const keys = [key, label, ...(APPLICATION_FIELD_ALIASES[key] || [])];
  const raw = applicationRawPayload(app);
  if (key === "sms_consent") {
    const consent = String(app.sms_consent ?? raw.sms_consent ?? "").toLowerCase();
    if (consent === "yes" || consent === "true") return "Checked / Yes";
    if (consent === "no" || consent === "false") return "Not checked / No";
    return "";
  }
  if (key === "sms_consent_text") {
    return raw.sms_consent_text || app.sms_consent_text || APPLICATION_SMS_DISCLOSURE_TEXT;
  }
  if (key === "application_certification") {
    const accepted = String(app.application_certification ?? raw.application_certification ?? "").toLowerCase();
    const text = raw.application_certification_text || app.application_certification_text || APPLICATION_CERTIFICATION_TEXT;
    if (accepted === "yes" || accepted === "true") return `Checked / Yes\n${text}`;
    return text;
  }
  for (const item of keys) {
    if (app[item] != null && app[item] !== "") return String(app[item]);
  }
  if (app[key] != null && app[key] !== "") return String(app[key]);
  for (const item of keys) {
    if (raw[item] != null && raw[item] !== "") return String(raw[item]);
  }
  if (raw[label] != null && raw[label] !== "") return String(raw[label]);
  return "";
}

function applicationSummaryCharts(rows) {
  const chartFields = applicationExportFields(rows);
  return `<section class="application-chart-dashboard"><div class="application-chart-heading"><div><span>Response Summary</span><h3>Application data charts</h3><p>Charts are loaded only on request. Each chart is built from the same exact application fields used in the internal response sheet and CSV export.</p></div><strong>${rows.length} responses</strong></div><div class="application-chart-grid">${chartFields.map(field => applicationChartCard(rows, field)).join("")}</div></section>`;
}

function applicationChartCard(rows, field) {
  const counts = new Map();
  rows.forEach(row => {
    const value = applicationFieldValue(row, field.key, field.label).trim() || "No response";
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = rows.length || 1;
  const isPie = entries.length <= 5 && entries.every(([value]) => value.length < 45);
  const colors = ["#315eea", "#d80f35", "#15a463", "#f59e0b", "#7c3aed", "#0ea5e9", "#64748b", "#111827"];
  if (isPie) {
    let current = 0;
    const gradient = entries.map(([_, count], index) => {
      const start = current;
      current += (count / total) * 100;
      return `${colors[index % colors.length]} ${start}% ${current}%`;
    }).join(", ");
    return `<article class="application-chart-card"><div><h3>${escapeHtml(field.label)}</h3><span>${rows.length} responses</span></div><div class="mini-pie" style="background: conic-gradient(${gradient || "#e5edf7 0 100%"})"></div><ul>${entries.map(([value, count], index) => `<li><i style="background:${colors[index % colors.length]}"></i><span>${escapeHtml(value)}</span><strong>${count}</strong></li>`).join("")}</ul></article>`;
  }
  return `<article class="application-chart-card wide"><div><h3>${escapeHtml(field.label)}</h3><span>${rows.length} responses</span></div><div class="mini-bars">${entries.map(([value, count]) => `<div><span>${escapeHtml(value)}</span><b style="width:${Math.max(8, (count / total) * 100)}%">${count}</b></div>`).join("")}</div></article>`;
}

function applicationSheetView(rows) {
  const fields = applicationExportFields(rows);
  return `<div class="application-sheet-actions"><span class="status live">Detailed Application Sheet</span><p>Every trainer application field is shown in the approved order. Blank answers stay visible as blank columns so the office can see exactly what was and was not submitted.</p></div><div class="table-wrap application-sheet-table-wrap"><table class="data-table application-sheet-table"><thead><tr>${fields.map(field => `<th>${escapeHtml(field.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr data-open-application="${escapeHtml(row.id)}">${fields.map(field => `<td>${escapeHtml(applicationFieldValue(row, field.key, field.label) || "—")}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${fields.length}">No trainer application responses have been loaded yet.</td></tr>`}</tbody></table></div>`;
}

function applicationIndividualView(rows) {
  return `<div class="application-individual-list">${rows.map(row => `<article class="application-individual-card"><header><div><span class="portal-tag">Application</span><h3>${escapeHtml(`${row.first_name || ""} ${row.last_name || ""}`.trim() || "Applicant")}</h3><p>${escapeHtml([row.city, row.state, row.zip].filter(Boolean).join(", ") || "Location pending")}</p></div><button class="btn btn-outline btn-small" type="button" data-open-application="${escapeHtml(row.id)}">Open Full Record</button></header>${applicationDetailGrid(row)}</article>`).join("") || `<p>No individual applications found.</p>`}</div>${applicationDetailPanel()}`;
}

function contactSubmissionRows() {
  return storedRows("ldttContactSubmissions.v2").map((row, index) => {
    const derivedMarket = deriveLeadMarket({ city: row.city, state: row.state, market: row.ad_market || row.trainer_market, rawPayload: row });
    const city = cleanLocationValue(row.city) || derivedMarket.city;
    const stateValue = cleanLocationValue(row.state) || derivedMarket.state;
    return {
      id: `contact-${index}`,
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      owner: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Website Contact",
      dog: "Pending",
      breed: "Pending",
      source: leadSourceLabel({ source: row.heard_about_us || "Website Contact Form", rawPayload: row, city, state: stateValue }),
      service: row.i_want_to || "Contact Request",
      i_want_to: row.i_want_to || "",
      heard_about_us: row.heard_about_us || "",
      vet_or_previous_client: row.vet_or_previous_client || "",
      trainerId: row.trainer_slug || "unassigned",
      phone: row.phone || "",
      email: row.email || "",
      address_line_1: row.address_line_1 || "",
      address_line_2: row.address_line_2 || "",
      address: [row.address_line_1, row.address_line_2, city, stateValue, row.zip].filter(Boolean).join(", "),
      city,
      state: stateValue,
      zip: row.zip || "",
      market: derivedMarket.market,
      sourcePageSlug: derivedMarket.pageSlug,
      status: row.status || "New Inquiry",
      createdAt: row.timestamp || row.createdAt || new Date().toISOString(),
      next: "Office follow-up needed",
      clientNote: row.comments || "",
      comments: row.comments || "",
      additional_interest: row.additional_interest || "",
      note: row.office_note || "",
      followUpDate: row.follow_up_date || "",
      lostReason: row.lost_reason || "",
      doNotContact: Boolean(row.do_not_contact),
      utm_source: row.utm_source || "",
      utm_campaign: row.utm_campaign || "",
      rawPayload: row,
      delivery_local: row.delivery_local || "saved",
      delivery_google: row.delivery_google || "not_recorded",
      delivery_email: row.delivery_email || "not_recorded",
      delivery_supabase: row.delivery_supabase || "not_connected",
      visits: 1,
      submitted: true
    };
  });
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
  const activeFilter = currentApplicationFilter();
  const rows = filteredApplicationRows({ filter: activeFilter });
  return `<div class="application-sheet-actions"><span class="status live">${escapeHtml(activeFilter)} view</span><p>Review the applicant, change recruiting status, and leave office notes. Use the filter at the top of this Applications page to change which records show here.</p></div>
  <div class="table-wrap"><table class="data-table application-data-table"><thead><tr><th>Applicant</th><th>Received</th><th>Location</th><th>Contact</th><th>Source</th><th>Status</th><th>Latest Office Note</th><th>Full Application</th></tr></thead><tbody>${rows.map(app => {
    const latest = latestOfficeNote("application", app.remoteId);
    return `<tr data-open-application="${escapeHtml(app.id)}"><td><strong>${escapeHtml(`${app.first_name || ""} ${app.last_name || ""}`.trim() || "Applicant")}</strong><small>${escapeHtml(applicationInquiryTypeLabel(app))}</small></td><td>${escapeHtml(formatApplicationDate(app.receivedAt || app.createdAt))}</td><td>${escapeHtml([app.city, app.state, app.zip].filter(Boolean).join(", ") || "—")}<small>${escapeHtml(app.market || app.address_line_1 || "")}</small></td><td>${escapeHtml(app.phone || "—")}<small>${escapeHtml(app.email || "—")}</small></td><td>${escapeHtml(app.source_form || app.referral_source || "Website")}<small>${escapeHtml(app.source_page || "")}</small></td><td>${applicationStatusSelect(app)}</td><td>${escapeHtml(latest?.note || app.note || "No note yet")}<small>${latest ? escapeHtml(`${portalActorLabel(latest.created_by)} · ${formatDateTime(latest.updated_at || latest.created_at)}`) : ""}</small></td><td><button class="btn btn-outline btn-small" type="button" data-open-application="${escapeHtml(app.id)}">Open Record</button></td></tr>`;
  }).join("") || `<tr><td colspan="8">No trainer applications found yet.</td></tr>`}</tbody></table></div>${applicationDetailPanel()}`;
}

function applicationStatusSelect(app) {
  return `<select class="select-pill" data-application-status="${escapeHtml(app.id)}">${["New Application","Under Review","Discovery Call Inquiry","Interview Scheduled","Moved Forward","Declined","Archived"].map(status => `<option ${status === (app.status || "New Application") ? "selected" : ""}>${status}</option>`).join("")}</select>`;
}

function applicationNeedsAction(app) {
  return (app.status || "New Application") === "New Application";
}

function applicationInquiryTypeLabel(app = {}) {
  if (app.inquiry_type === "full_application") return "Full Application";
  if (app.inquiry_type === "discovery_call") return "Discovery Call Inquiry";
  return "Contact-form interest";
}

function applicationDisplayName(app) {
  return `${app?.first_name || ""} ${app?.last_name || ""}`.trim() || app?.email || "Applicant";
}

function applicationPipelineBoard() {
  const columns = ["New Application", "Under Review", "Discovery Call Inquiry", "Interview Scheduled", "Moved Forward", "Declined", "Archived"];
  const rows = applicationRows()
    .sort((a, b) => timestampValue(b.receivedAt || b.createdAt) - timestampValue(a.receivedAt || a.createdAt));
  return `<div class="application-sheet-actions"><span class="status ${rows.some(applicationNeedsAction) ? "pending" : "live"}">${rows.filter(applicationNeedsAction).length} need action</span><p>Drag applications through the recruiting flow. Once a card is moved out of New Application, the notification count clears because the office has taken action.</p></div>
    <div class="lead-kanban application-kanban">${columns.map(column => {
      const columnRows = rows.filter(app => (app.status || "New Application") === column);
      return `<section class="kanban-column application-column" data-drop-application-status="${escapeHtml(column)}"><header><strong>${escapeHtml(column)}</strong><span>${columnRows.length}</span></header><div class="kanban-cards">${columnRows.map(app => applicationPipelineCard(app)).join("") || `<div class="empty-column">Drop applications here</div>`}</div></section>`;
    }).join("")}</div>${applicationDetailPanel()}`;
}

function applicationPipelineCard(app) {
  const name = applicationDisplayName(app);
  return `<article class="lead-card application-card" draggable="true" data-application-card="${escapeHtml(app.id)}" data-open-application="${escapeHtml(app.id)}">
    <div class="lead-card-top"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(formatApplicationDate(app.receivedAt || app.createdAt))}</span></div>
    <p>${escapeHtml([app.city, app.state, app.zip].filter(Boolean).join(", ") || "Location pending")}</p>
    <small>${escapeHtml(app.email || "No email")} · ${escapeHtml(app.phone || "No phone")}</small>
    <div class="delivery-badges"><span>${escapeHtml(applicationInquiryTypeLabel(app))}</span><span>${escapeHtml(app.referral_source || "Referral pending")}</span></div>
  </article>`;
}

function exportApplicationsCsv() {
  const applicationRecords = applicationRows();
  const fields = [
    ...applicationExportFields(applicationRecords),
    { key: "status", label: "Recruiting Status" },
    { key: "note", label: "Office Notes" }
  ];
  const escapeCsv = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = applicationRecords.map(app => fields.map(field => escapeCsv(applicationFieldValue(app, field.key, field.label))).join(","));
  const csv = [fields.map(field => escapeCsv(field.label)).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ldtt-trainer-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportOperationalSheet(kind) {
  if (kind === "leads") {
    exportLeadsCsv();
    return;
  }
  const canonicalRows = Array.isArray(remoteSheets?.[kind]) ? remoteSheets[kind] : [];
  const rows = canonicalRows.length
    ? canonicalRows
    : kind === "leads" ? allLeadRows() : state.clients;
  if (!rows.length) {
    showToast(`No ${kind} are available to export.`);
    return;
  }
  const flattenedRows = rows.map(row => {
    const raw = row?.raw_payload && typeof row.raw_payload === "object" && !Array.isArray(row.raw_payload) ? row.raw_payload : {};
    return { ...raw, ...row };
  });
  const fields = Array.from(flattenedRows.reduce((keys, row) => {
    Object.keys(row || {}).forEach(key => keys.add(key));
    return keys;
  }, new Set()));
  const escapeCsv = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const displayValue = (key, value) => /(?:received_at|created_at|updated_at)$/i.test(key) && value ? formatDateTime(value) : typeof value === "object" && value !== null ? JSON.stringify(value) : value;
  const csv = [
    fields.map(field => escapeCsv(field.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()))).join(","),
    ...flattenedRows.map(row => fields.map(field => escapeCsv(displayValue(field, row[field]))).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ldtt-${kind}-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportLeadsCsv() {
  const leadRecords = filteredLeadRows(allLeadRows());
  if (!leadRecords.length) {
    showToast("No leads match the current filters.");
    return;
  }
  const fields = leadSheetFields(leadRecords);
  const escapeCsv = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = leadRecords.map(lead => fields.map(field => escapeCsv(leadSubmittedFieldValue(lead, field.key, field.label))).join(","));
  const csv = [fields.map(field => escapeCsv(field.label)).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ldtt-leads-detailed-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applicationDetailGrid(app) {
  const fields = applicationExportFields([app]);
  const exactFields = fields.map(field => [field.label, applicationFieldValue(app, field.key, field.label)]);
  const extraFields = Object.entries(applicationRawPayload(app))
    .filter(([label]) => !fields.some(field => field.label === label || field.key === label))
    .map(([label, value]) => [label, value]);
  const workflowFields = [
    ["Recruiting Status", app.status || "New Application"],
    ["Assigned Owner", app.assignedUserId ? portalActorLabel(app.assignedUserId) : "Unassigned"],
    ["Office Notes", app.note || ""]
  ];
  return `<section class="application-complete-record"><header><div><span>Complete Response Record</span><h3>All application fields</h3></div><strong>${fields.length + extraFields.length} fields</strong></header><div class="application-detail-grid application-detail-grid-complete">${[...exactFields, ...extraFields].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div></section><section class="application-workflow-record"><header><div><span>Office Workflow</span><h3>Recruiting status and notes</h3></div></header><div class="application-detail-grid">${workflowFields.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div></section>`;
}

function applicationDetailPanel() {
  const app = applicationRows().find(item => item.id === state.selectedApplicationId);
  if (!app) return "";
  return `<aside class="lead-detail-panel"><button class="detail-close" type="button" data-close-application aria-label="Close">×</button><span class="portal-tag">Application Detail</span><h2>${escapeHtml(`${app.first_name || ""} ${app.last_name || ""}`.trim() || "Applicant")}</h2><p>${escapeHtml([app.city, app.state].filter(Boolean).join(", ") || "Location pending")}</p><div class="lead-contact-grid"><div><span>Email</span><strong>${escapeHtml(app.email || "—")}</strong></div><div><span>Phone</span><strong>${escapeHtml(formatPhoneNumber(app.phone) || "—")}</strong></div><div class="wide"><span>Address</span><strong>${escapeHtml([app.address_line_1, app.address_line_2, app.city, app.state, app.zip].filter(Boolean).join(", ") || "—")}</strong></div><div><span>Source</span><strong>${escapeHtml(app.source_form || app.referral_source || "Website")}</strong></div><div><span>Status</span><strong>${escapeHtml(app.status || "New Application")}</strong></div><div><span>Received</span><strong>${escapeHtml(formatApplicationDate(app.receivedAt || app.createdAt))}</strong></div></div><label>Status${applicationStatusSelect(app)}</label><label>Assigned recruiting owner${officeAssigneeSelect("application", app.id, app.assignedUserId)}</label><section class="detail-note-block"><span>Recruiting Notes</span>${officeNoteTimeline("application", app.remoteId)}<textarea data-new-office-note="${escapeHtml(app.remoteId || "")}" placeholder="Add recruiting note. Your name and exact time are recorded."></textarea><button class="btn btn-red btn-small" type="button" data-add-office-note="application" data-entity-id="${escapeHtml(app.remoteId || "")}">Add Recruiting Note</button></section>${applicationDetailGrid(app)}<div class="row-actions"><button class="btn btn-outline" type="button" data-archive-application="${escapeHtml(app.id)}">Archive application</button>${permanentDeleteButton("application", app)}</div></aside><div class="lead-detail-scrim" data-close-application></div>`;
}

function formatApplicationDate(value) {
  return value ? formatDateTime(value) : "Not reported";
}

function submissionForm(kind = "media") {
  const options = kind === "review" ? ["Review", "Testimonial"] : ["Photo", "Training Video"];
  const placeholder = kind === "review" ? "Example: Google review screenshot" : "Example: Loose leash training video";
  const contentField = kind === "review"
    ? `<div class="field wide"><label>Review or Testimonial Text<textarea name="submission-review-text" placeholder="Paste the complete client review or testimonial here."></textarea></label></div><div class="field wide"><label>Optional Review Photo or Video<input type="file" name="submission-file" accept="image/*,video/*"></label></div><div class="field wide"><label>Or paste a review video link<input name="submission-video-url" type="url" placeholder="YouTube, Vimeo, Loom, Google Drive, Dropbox, or direct MP4/WebM"></label><p class="panel-copy">Add written feedback, an image/video upload, a supported video link, or a combination for office approval.</p></div>`
    : `<div class="field wide"><label>Upload Photo or Video<input type="file" name="submission-file" accept="image/*,video/*" required></label><p class="panel-copy">Images and short videos are stored privately for office review before approval.</p></div>`;
  return `<div class="form-grid"><div class="field"><label>Submission Type<select name="submission-type">${options.map(option => `<option>${option}</option>`).join("")}</select></label></div><div class="field"><label>Title<input name="submission-title" placeholder="${placeholder}" required></label></div>${contentField}<div class="field wide"><label>Notes For The Office<textarea name="submission-note" placeholder="Tell the office where this should be used and confirm client permission when applicable."></textarea></label></div></div>`;
}

function submissionsTable(admin, kind = "all") {
  const sourceRows = admin ? state.submissions : trainerSubmissions();
  let rows = kind === "media" ? sourceRows.filter(sub => ["Photo", "Training Video", "Video"].includes(sub.type)) : kind === "review" ? sourceRows.filter(sub => ["Review", "Testimonial"].includes(sub.type)) : sourceRows;
  const tabs = ["Active", "Pending", "Approved", "Rejected", "Unpublished", "Archived", "Deleted"];
  const reviewFilter = state.reviewSubmissionFilter || "Active";
  if (admin && kind === "review") {
    rows = rows.filter(sub => {
      const status = sub.status || "Pending";
      if (reviewFilter === "Active") return !["Archived", "Deleted"].includes(status);
      if (reviewFilter === "Rejected") return status === "Declined";
      return status === reviewFilter;
    });
  }
  const toolbar = admin && kind === "review"
    ? `<div class="review-inbox-tabs">${tabs.map(tab => `<button type="button" class="${reviewFilter === tab ? "active" : ""}" data-review-submission-filter="${escapeHtml(tab)}">${escapeHtml(tab)} <span>${sourceRows.filter(sub => ["Review", "Testimonial"].includes(sub.type)).filter(sub => tab === "Active" ? !["Archived", "Deleted"].includes(sub.status) : (tab === "Rejected" ? sub.status === "Declined" : sub.status === tab)).length}</span></button>`).join("")}</div>
      <div class="review-list-toolbar"><div><strong>Review submissions</strong><span>Open a row for full details, or use quick actions without leaving the list.</span></div><label>Sort<select data-review-sort><option ${state.reviewSort === "Newest" ? "selected" : ""}>Newest</option><option ${state.reviewSort === "Oldest" ? "selected" : ""}>Oldest</option><option ${state.reviewSort === "Status" ? "selected" : ""}>Status</option><option ${state.reviewSort === "Source" ? "selected" : ""}>Source</option><option ${state.reviewSort === "Rating" ? "selected" : ""}>Rating</option></select></label></div>`
    : "";
  if (!rows.length) return `${toolbar}<div class="empty-state"><strong>No submissions found.</strong><p>Trainer photos, videos, and reviews will appear here as soon as they are submitted.</p></div>${admin ? submissionDetailPanel() : ""}`;
  if (admin && kind === "review") return `${toolbar}${submissionReviewList(sortReviewRows(rows))}${submissionDetailPanel()}`;
  return `${toolbar}<div class="submission-review-grid">${rows.map(sub => submissionReviewCard(sub, admin)).join("")}</div>${admin ? submissionDetailPanel() : ""}`;
}

function sortReviewRows(rows) {
  const sort = state.reviewSort || "Newest";
  return [...rows].sort((a, b) => {
    if (sort === "Oldest") return new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0);
    if (sort === "Status") return String(a.status || "").localeCompare(String(b.status || ""));
    if (sort === "Source") {
      const aSource = reviewTargetLabels(a);
      const bSource = reviewTargetLabels(b);
      return aSource.localeCompare(bSource);
    }
    if (sort === "Rating") return Number(b.starRating || 0) - Number(a.starRating || 0);
    return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
  });
}

function reviewActionButtons(submission, compact = false) {
  const id = escapeHtml(submission.id);
  const size = compact ? " btn-small" : "";
  const button = (label, action, classes = "btn-outline") => `<button class="btn ${classes}${size}" data-${action}="${id}">${label}</button>`;
  if (submission.status === "Approved") {
    return button("Publish", "publish-review", "btn-green")
      + button("Unpublish", "unpublish-review")
      + button("Archive", "archive-review")
      + button("Delete", "delete-review", "btn-outline btn-danger");
  }
  if (submission.status === "Unpublished") {
    return button("Publish", "publish-review", "btn-green")
      + button("Archive", "archive-review")
      + button("Delete", "delete-review", "btn-outline btn-danger");
  }
  if (["Archived", "Deleted"].includes(submission.status)) {
    return button("Restore", "restore-review")
      + (submission.status === "Archived" ? button("Delete", "delete-review", "btn-outline btn-danger") : "");
  }
  return button("Approve", "approve-submission", "btn-green")
    + button("Reject", "decline-submission")
    + button("Archive", "archive-review")
    + button("Delete", "delete-review", "btn-outline btn-danger");
}

function submissionReviewList(rows) {
  return `<div class="submission-review-list-shell"><table class="submission-review-list"><thead><tr><th>Review</th><th>Source</th><th>Status</th><th>Office Note</th><th>Quick Actions</th></tr></thead><tbody>${rows.map(sub => {
    const isVideo = ["Training Video", "Video"].includes(sub.type) || reviewMediaIsVideo(sub.contentUrl, sub.fileType);
    const sourceLabel = ["Review", "Testimonial"].includes(sub.type) ? reviewTargetLabels(sub) : (sub.trainerId === "lorenzos-team" ? "Homepage / Main Website" : trainerName(sub.trainerId));
    const rating = Math.max(1, Math.min(5, Number(sub.starRating || 5)));
    const thumbnail = sub.contentUrl
      ? isVideo
        ? `<button class="review-list-thumb video" type="button" data-open-submission-media="${escapeHtml(sub.id)}"><span>▶</span></button>`
        : `<button class="review-list-thumb" type="button" data-open-submission-media="${escapeHtml(sub.id)}"><img src="${escapeHtml(sub.contentUrl)}" alt="${escapeHtml(sub.title)}"></button>`
      : `<button class="review-list-thumb empty" type="button" data-open-submission-detail="${escapeHtml(sub.id)}">${icon("star")}</button>`;
    const reviewer = sub.reviewerName || "Reviewer not named";
    const excerpt = sub.reviewText || sub.submissionComment || "No written review text was included.";
    const actionButtons = reviewActionButtons(sub, true);
    return `<tr>
      <td class="review-list-main"><div>${thumbnail}<div><strong>${escapeHtml(sub.title || "Review submission")}</strong><span class="submission-rating">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span><p>${escapeHtml(excerpt)}</p><small>${escapeHtml(reviewer)}${sub.reviewerLocation ? ` · ${escapeHtml(sub.reviewerLocation)}` : ""}</small></div></div></td>
      <td><strong>${escapeHtml(sourceLabel)}</strong><small>${escapeHtml(sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "Date pending")}</small></td>
      <td><span class="status ${submissionStatusClass(sub.status)}">${escapeHtml(sub.status || "Pending")}</span></td>
      <td><textarea class="review-list-note" data-submission-note="${escapeHtml(sub.id)}" placeholder="Office note...">${escapeHtml(sub.officeNote || sub.note || "")}</textarea></td>
      <td><div class="review-list-actions">${actionButtons}<button class="btn btn-outline btn-small" type="button" data-open-submission-detail="${escapeHtml(sub.id)}">Open</button></div></td>
    </tr>`;
  }).join("")}</tbody></table></div>`;
}

function submissionReviewCard(sub, admin) {
  const isVideo = ["Training Video", "Video"].includes(sub.type) || reviewMediaIsVideo(sub.contentUrl, sub.fileType);
  const sourceLabel = ["Review", "Testimonial"].includes(sub.type) ? reviewTargetLabels(sub) : (sub.trainerId === "lorenzos-team" ? "Homepage / Main Website" : trainerName(sub.trainerId));
  const rating = Math.max(1, Math.min(5, Number(sub.starRating || 5)));
  let preview = `<div class="submission-placeholder"><span>${icon(sub.type === "Photo" ? "media" : "star")}</span><strong>No file attached</strong></div>`;
  if (sub.contentUrl && isVideo) preview = `<div class="submission-media review-video-preview">${videoPreviewMarkup(sub.contentUrl, sub.title || "Review video")}</div>`;
  else if (sub.contentUrl) preview = `<button class="submission-image-button" type="button" data-open-submission-media="${escapeHtml(sub.id)}" aria-label="Open ${escapeHtml(sub.title)}"><img class="submission-media" src="${escapeHtml(sub.contentUrl)}" alt="${escapeHtml(sub.title)}"></button>`;
  const writtenContent = sub.reviewText
    ? `<div class="submission-content-block"><span>Written review</span><blockquote class="submission-review-copy">“${escapeHtml(sub.reviewText)}”</blockquote></div>`
    : `<div class="submission-content-block missing"><span>Written review</span><p>No written review was included.</p></div>`;
  const reviewerDetails = [
    sub.reviewerName ? `<span><b>Reviewer</b>${escapeHtml(sub.reviewerName)}</span>` : "",
    sub.reviewerEmail ? `<span><b>Email</b>${escapeHtml(sub.reviewerEmail)}</span>` : "",
    sub.reviewerLocation ? `<span><b>Location</b>${escapeHtml(sub.reviewerLocation)}</span>` : "",
    sub.permissionToShare ? `<span><b>Permission</b>${escapeHtml(sub.permissionToShare)}</span>` : ""
  ].filter(Boolean).join("");
  const displayControls = admin && ["Review", "Testimonial"].includes(sub.type)
    ? reviewAssignmentControlsMarkup(sub) + reviewDisplayControlsMarkup(sub)
    : "";
  const actionButtons = reviewActionButtons(sub);
  return `<article class="submission-review-card">
    <div class="submission-preview">${preview}</div>
    <div class="submission-review-body">
      <div class="submission-review-meta"><span class="submission-type">${escapeHtml(sub.type)}</span><span class="status ${submissionStatusClass(sub.status)}">${escapeHtml(sub.status)}</span></div>
      <h3>${escapeHtml(sub.title)}</h3>
      <p class="submission-trainer">Source: <strong>${escapeHtml(sourceLabel)}</strong>${sub.submittedAt ? ` · ${escapeHtml(new Date(sub.submittedAt).toLocaleDateString())}` : ""}</p>
      <div class="submission-rating" aria-label="${rating} star review">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
      ${reviewerDetails ? `<div class="submission-reviewer-details">${reviewerDetails}</div>` : ""}
      ${writtenContent}
      ${sub.submissionComment ? `<div class="submission-content-block"><span>Submission details</span><p>${escapeHtml(sub.submissionComment)}</p></div>` : ""}
      ${displayControls}
      <div class="submission-office-note"><span>${admin ? "Office comments" : "Trainer note"}</span>${admin ? `<textarea data-submission-note="${escapeHtml(sub.id)}" placeholder="Add the office decision, follow-up, or publishing note...">${escapeHtml(sub.officeNote || sub.note || "")}</textarea>` : `<p>${escapeHtml(sub.submissionComment || sub.note || "No note supplied.")}</p>`}</div>
      ${sub.fileName ? `<p class="submission-file-name">File: ${escapeHtml(sub.fileName)}</p>` : ""}
      ${admin ? `<div class="submission-actions">${actionButtons}<button class="btn btn-outline" type="button" data-open-submission-detail="${escapeHtml(sub.id)}">View full submission</button></div>` : ""}
    </div>
  </article>`;
}

function reviewDisplayControlsMarkup(submission) {
  const options = reviewDisplayOptionsFor(submission);
  const hasMedia = Boolean(submission.contentUrl);
  const hasLocation = Boolean(submission.reviewerLocation);
  const controls = [
    ["showText", "Review text", true],
    ["showMedia", "Photo / video", hasMedia],
    ["showAuthor", "Reviewer name", true],
    ["showRating", "Star rating", true],
    ["showLocation", "Client location", hasLocation]
  ];
  return `<section class="review-display-controls"><span>Show on landing page</span><div>${controls.map(([key, label, enabled]) => `<label class="${enabled ? "" : "disabled"}"><input type="checkbox" data-review-display="${escapeHtml(submission.id)}" data-review-display-key="${key}" ${options[key] ? "checked" : ""} ${enabled ? "" : "disabled"}>${escapeHtml(label)}</label>`).join("")}</div></section>`;
}

function reviewAssignmentControlsMarkup(submission) {
  if (!["Review", "Testimonial"].includes(submission?.type)) return "";
  const targets = reviewTargetsFor(submission, { allowEmpty: true });
  const selectedTargets = new Set(targets);
  const savedDestinations = targets.map(target => `<li><strong>${escapeHtml(reviewTargetLabel(target))}</strong><span>${escapeHtml(reviewDestinationStatusLabel(submission, target))}</span></li>`).join("");
  const trainerOptions = (state.trainers || [])
    .filter(trainer => trainer?.id && trainer.name)
    .map(trainer => {
      const location = [trainer.city, trainer.state].filter(Boolean).join(", ") || trainer.market || "Trainer page";
      return `<option value="${escapeHtml(trainer.id)}" ${selectedTargets.has(trainer.id) ? "disabled" : ""}>${escapeHtml(trainer.name)} · ${escapeHtml(location)}</option>`;
    }).join("");
  const cityOptions = cityReviewDestinations
    .map(([slug, label]) => {
      const target = `city:${slug}`;
      return `<option value="city:${escapeHtml(slug)}" ${selectedTargets.has(target) ? "disabled" : ""}>${escapeHtml(label)} opportunity page</option>`;
    })
    .join("");
  return `<section class="review-assignment-controls">
    <span>Publish destinations</span>
    <div class="review-destination-ledger">
      <strong>Where this review is saved</strong>
      <ul>${savedDestinations || `<li><strong>No destinations selected</strong><span>Choose below</span></li>`}</ul>
    </div>
    <div class="review-target-chip-row">
      ${targets.map(target => `<button class="review-target-chip" type="button" data-remove-review-target="${escapeHtml(submission.id)}" data-review-target="${escapeHtml(target)}">${escapeHtml(reviewTargetLabel(target))}<b>×</b></button>`).join("")}
    </div>
    <label>
      <span>Add review to another place</span>
      <select data-review-target-select="${escapeHtml(submission.id)}">
        <option value="">Choose destination</option>
        <option value="lorenzos-team" ${selectedTargets.has("lorenzos-team") ? "disabled" : ""}>Homepage / Main Website</option>
        ${trainerOptions}
        ${cityOptions}
      </select>
    </label>
    <button class="btn btn-outline btn-small" type="button" data-add-review-target="${escapeHtml(submission.id)}">+ Add Destination Now</button>
    <small>Publish also saves the destination currently selected in this dropdown, then pushes the review to every saved place.</small>
  </section>`;
}

function submissionDetailPanel() {
  const submission = state.submissions.find(item => item.id === state.selectedSubmissionId);
  if (!submission) return "";
  const isVideo = reviewMediaIsVideo(submission.contentUrl, submission.fileType);
  const sourceLabel = ["Review", "Testimonial"].includes(submission.type) ? reviewTargetLabels(submission) : (submission.trainerId === "lorenzos-team" ? "Homepage / Main Website" : trainerName(submission.trainerId));
  const rating = Math.max(1, Math.min(5, Number(submission.starRating || 5)));
  const media = submission.contentUrl
    ? isVideo
      ? `<div class="submission-detail-media review-video-preview">${videoPreviewMarkup(submission.contentUrl, submission.title || "Review video")}</div>`
      : `<button class="submission-image-button submission-detail-image" type="button" data-open-submission-media="${escapeHtml(submission.id)}"><img src="${escapeHtml(submission.contentUrl)}" alt="${escapeHtml(submission.title)}"></button>`
    : `<div class="submission-placeholder submission-detail-placeholder"><strong>No photo or video attached</strong></div>`;
  const actions = reviewActionButtons(submission);
  return `<aside class="lead-detail-panel submission-detail-panel"><button class="detail-close" data-close-submission aria-label="Close">×</button><span class="portal-tag">Review Submission</span><h2>${escapeHtml(submission.title)}</h2><p>${escapeHtml(submission.type)} source: ${escapeHtml(sourceLabel)}</p><div class="submission-rating detail-rating" aria-label="${rating} star review">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>${media}<div class="lead-contact-grid"><div><span>Reviewer</span><strong>${escapeHtml(submission.reviewerName || "—")}</strong></div><div><span>Reviewer email</span><strong>${escapeHtml(submission.reviewerEmail || "—")}</strong></div><div><span>Client location</span><strong>${escapeHtml(submission.reviewerLocation || "Not provided")}</strong></div><div><span>Status</span><strong>${escapeHtml(submission.status)}</strong></div><div><span>Source</span><strong>${escapeHtml(sourceLabel)}</strong></div><div><span>Permission to share</span><strong>${escapeHtml(submission.permissionToShare || "Not reported")}</strong></div><div class="wide"><span>Submitted</span><strong>${escapeHtml(submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "—")}</strong></div></div><section class="submission-detail-copy"><span>Actual written review</span><blockquote>${escapeHtml(submission.reviewText || "No written review was included.")}</blockquote></section>${submission.submissionComment ? `<section class="submission-detail-copy"><span>Submission details</span><p>${escapeHtml(submission.submissionComment)}</p></section>` : ""}${reviewAssignmentControlsMarkup(submission)}${reviewDisplayControlsMarkup(submission)}<label>Office comments<textarea data-submission-note="${escapeHtml(submission.id)}" placeholder="Add the office decision, follow-up, or publishing note...">${escapeHtml(submission.officeNote || submission.note || "")}</textarea></label><div class="row-actions">${actions}</div></aside><div class="lead-detail-scrim" data-close-submission></div>`;
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
  const isVideo = ["Training Video", "Video"].includes(submission.type) || reviewMediaIsVideo(submission.contentUrl, submission.fileType);
  const dialog = document.createElement("dialog");
  dialog.className = "submission-media-dialog";
  dialog.innerHTML = `<button type="button" class="submission-dialog-close" aria-label="Close preview">×</button><div class="submission-dialog-content">${isVideo ? videoPreviewMarkup(submission.contentUrl, submission.title || "Review video") : `<img src="${escapeHtml(submission.contentUrl)}" alt="${escapeHtml(submission.title)}">`}<h3>${escapeHtml(submission.title)}</h3><p>${escapeHtml(trainerName(submission.trainerId))}</p></div>`;
  document.body.appendChild(dialog);
  const close = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector(".submission-dialog-close").addEventListener("click", close);
  dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
  dialog.showModal();
}

function openPublicReviewMedia(trigger) {
  const mediaUrl = trigger?.dataset.mediaUrl || "";
  if (!mediaUrl) return;
  const title = trigger.dataset.mediaTitle || "Approved review";
  const dialog = document.createElement("dialog");
  dialog.className = "submission-media-dialog";
  dialog.innerHTML = `<button type="button" class="submission-dialog-close" aria-label="Close preview">×</button><div class="submission-dialog-content"><img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(title)}"><h3>${escapeHtml(title)}</h3><p>Approved Lorenzo's Dog Training Team review media</p></div>`;
  document.body.appendChild(dialog);
  const close = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector(".submission-dialog-close").addEventListener("click", close);
  dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
  dialog.showModal();
}

function clientSearchValues(client = {}) {
  return [
    client.name,
    client.phone,
    client.email,
    client.dog,
    client.breed,
    trainerName(client.trainerId),
    client.status,
    client.source,
    client.importedSource,
    client.smsConsent,
    client.emailConsent,
    client.dateStarted,
    client.lastContacted,
    client.notes,
    client.leadId,
    officeNotesFor("client", client.remoteId).map(note => note.note)
  ];
}

function filteredClientRows(options = {}) {
  const status = options.status ?? state.clientFilter;
  const search = options.search ?? state.clientSearch ?? "";
  return state.clients
    .filter(client => status === "All" || client.status === status)
    .filter(client => recordMatchesSearch(clientSearchValues(client), search));
}

function clientFilterBar() {
  const rows = filteredClientRows();
  const searchNote = state.clientSearch ? ` matching "${escapeHtml(state.clientSearch)}"` : "";
  return `<section class="client-filter-shell">
    <div class="filter-bar">${clientStatuses.map(status => `<button class="btn ${state.clientFilter === status ? "btn-red" : "btn-outline"}" data-client-filter="${escapeHtml(status)}">${escapeHtml(status)}</button>`).join("")}</div>
    <input class="select-pill client-search" data-client-search value="${escapeHtml(state.clientSearch || "")}" placeholder="Search clients by name, dog, phone, email, trainer, notes...">
    <p class="panel-copy lead-result-count"><strong>${rows.length} of ${state.clients.length} client records shown${searchNote}.</strong></p>
  </section>`;
}

function convertedLeadQueue() {
  const rows = allLeadRows().filter(lead => conversionStatuses().includes(lead.status));
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Paid / Won Lead</th><th>Trainer</th><th>Status</th><th>Contact</th><th>Client Record</th><th>Action</th></tr></thead><tbody>${rows.map(lead => {
    const client = findClientForLead(lead);
    return `<tr><td><strong>${escapeHtml(lead.owner)}</strong><small>${escapeHtml(lead.dog)} · ${escapeHtml(lead.service)}</small></td><td>${escapeHtml(trainerName(lead.trainerId))}</td><td><span class="status won">${escapeHtml(lead.status)}</span></td><td>${escapeHtml(lead.phone || "—")}<small>${escapeHtml(lead.email || "—")}</small></td><td>${client ? `<span class="status live">In Client Database</span><small>${escapeHtml(client.status)}</small>` : `<span class="status draft">Needs client record</span>`}</td><td><button class="btn ${client ? "btn-outline" : "btn-red"}" data-convert-lead="${escapeHtml(lead.id)}">${client ? "Update Client" : "Add To Clients"}</button></td></tr>`;
  }).join("") || `<tr><td colspan="6">No converted clients yet. When a lead moves to Became a Client, it appears here.</td></tr>`}</tbody></table></div><p class="panel-copy">This queue connects the office lead outcome to the Client Database. Conversion means a confirmed client event, not a click or form submit.</p>`;
}

function clientTable() {
  const rows = filteredClientRows();
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Client</th><th>Dog</th><th>Trainer</th><th>Status</th><th>Consent</th><th>Imported Source</th><th>Campaign Eligibility</th><th>Notes</th></tr></thead><tbody>${rows.map(client => `<tr data-open-client="${escapeHtml(client.id)}"><td><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.phone)} · ${escapeHtml(client.email)}</small></td><td>${escapeHtml(client.dog)}<small>${escapeHtml(client.breed)}</small></td><td>${escapeHtml(trainerName(client.trainerId))}</td><td><span class="status ${clientStatusClass(client.status)}">${escapeHtml(client.status)}</span></td><td>SMS: ${consentBadge(client.smsConsent)}<br>Email: ${consentBadge(client.emailConsent)}</td><td>${escapeHtml(client.importedSource)}</td><td>${campaignEligibility(client)}</td><td>${escapeHtml(client.notes)}</td></tr>`).join("") || `<tr><td colspan="8">No client records match this filter yet.</td></tr>`}</tbody></table></div>${clientDetailPanel()}`;
}

function clientStatusSelect(client) {
  return `<select class="select-pill" data-client-status="${escapeHtml(client.id)}">${clientStatuses.filter(status => status !== "All").map(status => `<option ${client.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select>`;
}

function consentSelect(clientId, type, current) {
  return `<select class="select-pill" data-client-consent="${escapeHtml(clientId)}" data-consent-type="${escapeHtml(type)}">${["Yes", "No", "Unknown"].map(option => `<option ${current === option ? "selected" : ""}>${option}</option>`).join("")}</select>`;
}

function clientDetailPanel() {
  const client = state.clients.find(item => item.id === state.selectedClientId);
  if (!client) return "";
  return `<aside class="lead-detail-panel"><button class="detail-close" type="button" data-close-client aria-label="Close">×</button><span class="portal-tag">Client Record</span><h2>${escapeHtml(client.name)}</h2><p>${escapeHtml(client.dog || "Dog pending")} · ${escapeHtml(client.breed || "Breed pending")}</p><div class="lead-contact-grid"><div><span>Phone</span><strong>${escapeHtml(formatPhoneNumber(client.phone) || "—")}</strong></div><div><span>Email</span><strong>${escapeHtml(client.email || "—")}</strong></div><div><span>Trainer</span><strong>${escapeHtml(trainerName(client.trainerId))}</strong></div><div><span>Imported Source</span><strong>${escapeHtml(client.importedSource || "Manual")}</strong></div></div><label>Status${clientStatusSelect(client)}</label><label>Date started<input class="select-pill" type="date" data-client-date-started="${escapeHtml(client.id)}" value="${escapeHtml(client.dateStarted || "")}"></label><label>Last contacted<input class="select-pill" type="date" data-client-last-contacted="${escapeHtml(client.id)}" value="${escapeHtml(client.lastContacted || "")}"></label><label>SMS consent${consentSelect(client.id, "sms", client.smsConsent || "Unknown")}</label><label>Email consent${consentSelect(client.id, "email", client.emailConsent || "Unknown")}</label><label>Client record summary<textarea data-client-note="${escapeHtml(client.id)}">${escapeHtml(client.notes || "")}</textarea></label><section class="detail-note-block"><span>Office Notes</span>${officeNoteTimeline("client", client.remoteId)}<textarea data-new-office-note="${escapeHtml(client.remoteId || "")}" placeholder="Add office note. This records your account and timestamp."></textarea><button class="btn btn-red btn-small" type="button" data-add-office-note="client" data-entity-id="${escapeHtml(client.remoteId || "")}">Add Office Note</button></section><div class="row-actions"><button class="btn btn-red" type="button" data-save-client="${escapeHtml(client.id)}">Save Client Record</button><button class="btn btn-outline" type="button" data-archive-client="${escapeHtml(client.id)}">Archive Client</button>${permanentDeleteButton("client", client)}</div></aside><div class="lead-detail-scrim" data-close-client></div>`;
}

function importInput() {
  return `<p class="panel-copy">Upload CSV, XLS, XLSX, or a text-based PDF. Review every row before import. Expected fields can include Client Name, Phone, Email, Dog Name, Dog Breed, Trainer Assigned, Status, SMS Consent, Email Consent, Source, and Notes.</p><br><label class="client-import-file">Choose client file<input type="file" id="clientImportFile" accept=".csv,.xls,.xlsx,.pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"></label><div class="import-file-status" id="importFileStatus" role="status" aria-live="polite">Or paste CSV below.</div><textarea class="csv-input" id="csvInput">${escapeHtml(state.importDraft)}</textarea><br><br><label class="field">Imported Source<select id="importSource"><option>Spreadsheet</option><option>Alpha</option><option>QuickBooks</option><option>Manual</option></select></label>`;
}

function importPreview() {
  if (!state.importedPreview.length) {
    return `<div class="empty-state"><strong>No preview yet.</strong><p>Paste data, then click Preview Import. Nothing is imported until admin confirms.</p></div>`;
  }
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Action</th><th>Client</th><th>Dog</th><th>Status</th><th>Consent</th><th>Warnings</th></tr></thead><tbody>${state.importedPreview.map((row, index) => `<tr><td><select class="select-pill" data-import-action="${index}"><option ${row.action === "Create" ? "selected" : ""}>Create</option><option ${row.action === "Update" ? "selected" : ""}>Update</option><option ${row.action === "Skip" ? "selected" : ""}>Skip</option><option ${row.action === "Merge" ? "selected" : ""}>Merge</option></select></td><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.phone)} · ${escapeHtml(row.email)}</small></td><td>${escapeHtml(row.dog)}<small>${escapeHtml(row.breed)}</small></td><td><span class="status ${clientStatusClass(row.status)}">${escapeHtml(row.status)}</span></td><td>SMS: ${consentBadge(row.smsConsent)}<br>Email: ${consentBadge(row.emailConsent)}</td><td>${row.warnings.map(w => `<span class="warning-pill">${escapeHtml(w)}</span>`).join(" ") || "—"}</td></tr>`).join("")}</tbody></table></div><br><button class="btn btn-red" id="confirmImport">Confirm Import</button>`;
}

async function importFileToCsv(file) {
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  if (extension === "csv") return file.text();
  if (["xls", "xlsx"].includes(extension)) {
    if (!window.XLSX) throw new Error("The Excel reader is still loading. Try the file again in a moment.");
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return window.XLSX.utils.sheet_to_csv(sheet);
  }
  if (extension === "pdf") {
    if (!window.pdfjsLib) throw new Error("The PDF reader is still loading. Try the file again in a moment.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const documentTask = window.pdfjsLib.getDocument({ data: await file.arrayBuffer() });
    const pdf = await documentTask.promise;
    const lines = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const grouped = new Map();
      content.items.forEach(item => {
        const y = Math.round(item.transform?.[5] || 0);
        const cells = grouped.get(y) || [];
        cells.push({ x: item.transform?.[4] || 0, text: item.str });
        grouped.set(y, cells);
      });
      [...grouped.entries()].sort((a, b) => b[0] - a[0]).forEach(([, cells]) => {
        lines.push(cells.sort((a, b) => a.x - b.x).map(cell => cell.text.trim()).filter(Boolean).join(","));
      });
    }
    return lines.join("\n");
  }
  throw new Error("Choose a CSV, XLS, XLSX, or PDF file.");
}

function parseCsv(text) {
  const source = String(text || "").trim();
  if (!source) return [];
  let records = [];
  if (window.XLSX) {
    const workbook = window.XLSX.read(source, { type: "string" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    records = window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  } else {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index <= source.length; index += 1) {
      const character = source[index] || "\n";
      if (character === '"' && quoted && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = !quoted;
      else if (character === "," && !quoted) {
        row.push(value);
        value = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(value);
        if (row.some(cell => String(cell).trim())) rows.push(row);
        row = [];
        value = "";
      } else value += character;
    }
    if (rows.length < 2) return [];
    const headers = rows[0].map(header => String(header).trim());
    records = rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
  }
  return records.map(record => {
    const normalizedRecord = Object.fromEntries(Object.entries(record).map(([key, value]) => [String(key).trim().toLowerCase(), String(value ?? "").trim()]));
    const get = (...keys) => keys.map(key => normalizedRecord[String(key).toLowerCase()]).find(value => value !== undefined && value !== "") || "";
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
      serviceArea: get("service area", "location"),
      zip: get("zip code", "zip", "postal code"),
      status,
      smsConsent,
      emailConsent,
      importedSource: get("source", "imported source") || document.getElementById("importSource")?.value || "Spreadsheet",
      notes: get("notes", "note"),
      dateStarted: get("date started", "start date"),
      lastContacted: get("last contacted", "last contact"),
      warnings,
      action: duplicate ? "Merge" : "Create"
    };
  }).filter(row => row.name || row.phone || row.email);
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
    serviceArea: row.serviceArea || "",
    zip: row.zip || "",
    importedSource: row.importedSource,
    smsConsent: row.smsConsent,
    emailConsent: row.emailConsent,
    dateStarted: row.dateStarted || "",
    lastContacted: row.lastContacted || "",
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
    importedSource: "Lead Conversion",
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
  const approvedReviews = (trainer.approvedReviews || []).map((review, index) => ({
    id: review.submission_id || `approved-${index}`,
    author: review.author || "Verified Client",
    rating: review.rating || "5",
    copy: review.copy || "",
    location: review.location || "",
    mediaUrl: review.media_url || "",
    mediaType: review.media_type || "",
    mediaName: review.media_name || "",
    display: {
      showText: review.display?.showText !== false,
      showMedia: review.display?.showMedia !== false,
      showAuthor: review.display?.showAuthor !== false,
      showRating: review.display?.showRating !== false,
      showLocation: Boolean(review.display?.showLocation)
    }
  })).filter(review => review.copy || review.mediaUrl);
  if (!approvedReviews.length) return "";
  return `<div class="trainer-review-carousel" aria-label="Approved trainer reviews">${approvedReviews.map(review => trainerReviewCardMarkup(review)).join("")}</div>`;
}

function publicSubmissionMediaUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(data:|blob:|https?:|\/)/i.test(url)) return url;
  const config = window.LDTT_SUPABASE || {};
  const base = String(config.projectUrl || "https://ptnzaeprvkgjgtupmcty.supabase.co").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/trainer-submissions/${url.split("/").map(encodeURIComponent).join("/")}`;
}

function trainerReviewCardMarkup(review) {
  const mediaUrl = publicSubmissionMediaUrl(review.mediaUrl);
  const showMedia = review.display.showMedia && mediaUrl;
  const showText = review.display.showText && review.copy;
  const showAuthor = review.display.showAuthor && review.author;
  const showRating = review.display.showRating !== false;
  const showLocation = review.display.showLocation && review.location;
  const isVideo = reviewMediaIsVideo(review.mediaUrl, review.mediaType);
  const rating = Math.max(1, Math.min(5, Number(review.rating || 5)));
  const media = showMedia
    ? `<div class="trainer-review-media">${isVideo ? videoPreviewMarkup(mediaUrl, `${review.author || "Client"} review video`) : `<button type="button" data-open-public-review-media="${escapeHtml(review.id)}" data-media-url="${escapeHtml(mediaUrl)}" data-media-title="${escapeHtml(review.author || "Approved review")}"><img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(review.mediaName || `${review.author || "Client"} review photo`)}"></button>`}</div>`
    : "";
  return `<article class="trainer-review-card ${showMedia ? "has-media" : ""}">
    ${media}
    <div class="trainer-review-content">
      ${showRating ? `<div class="review-stars" aria-label="${rating} star review">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>` : ""}
      ${showText ? `<p>${escapeHtml(review.copy)}</p>` : `<p class="media-only-review">Approved ${isVideo ? "video" : "photo"} review from a Lorenzo client.</p>`}
      <footer>${showAuthor ? `<strong>${escapeHtml(review.author)}</strong>` : ""}${showLocation ? `<span>${escapeHtml(review.location)}</span>` : ""}</footer>
    </div>
  </article>`;
}

function trainerBioSpotlight(trainer) {
  const specialties = (trainer.specialties || ["Obedience Training", "Behavior Modification", "Puppy Training"]).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const credentials = (trainer.credentials || ["Powered by Lorenzo's proven system"]).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section class="trainer-spotlight" id="trainer"><div class="trainer-spotlight-photo"><img src="${trainer.photo || trainer.image || layoutImages[0]}" alt="${escapeHtml(trainer.name)}"></div><div class="trainer-spotlight-copy"><p class="step-label">Meet your local trainer</p><h2>${escapeHtml(trainer.name)}</h2><p class="trainer-market">${escapeHtml(trainer.market)}</p><p class="panel-copy">${escapeHtml(trainer.bio)}</p><ul class="trainer-bullet-list">${credentials}</ul></div><aside class="trainer-specialties"><h3>Specialties</h3><ul>${specialties}</ul></aside></section>`;
}

function trainerCredibilityBar() {
  return `<section class="credibility-strip"><article><strong>40+</strong><span>Years Of Experience</span></article><article><strong>100,000+</strong><span>Dogs Trained Of All Breeds</span></article><article><strong>50+</strong><span>Professional Trainers Nationwide</span></article><article><strong>100%</strong><span>Commitment To You And Your Dog</span></article></section>`;
}

const heardAboutUsOptions = [
  ["", "Select one"],
  ["My Veternarian", "My Veterinarian"],
  ["My Dog Walker", "My Dog Walker"],
  ["My Dog Groomer", "My Dog Groomer"],
  ["My Pet Store", "My Pet Store"],
  ["My Neighbor", "My Neighbor"],
  ["Your Website", "Your Website"],
  ["Your Trainer", "Your Trainer"],
  ["Is a past client", "Is a past client"],
  ["Referred by a past client", "Referred by a past client"],
  ["Google Search", "Google Search"],
  ["Facebook or Instagram", "Facebook or Instagram"],
  ["Other", "Other"]
];

function heardAboutUsSelect(selected = "") {
  return `<select required name="heard_about_us">${heardAboutUsOptions.map(([value, label]) => `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
}

function officeLeadFormMarkup(trainer, compact = false) {
  return `<form class="landing-form-card office-lead-form ${compact ? "compact" : ""}" id="contact" data-trainer-id="${escapeHtml(trainer.id)}">
    <h3>Book your free consultation</h3>
    <p>Tell Lorenzo's office about your dog. Lorenzo's office will review your request and follow up with the next step.</p>
    <input type="hidden" name="trainer_name" value="${escapeHtml(trainer.name)}">
    <input type="hidden" name="assigned_trainer" value="${escapeHtml(trainer.name)}">
    <input type="hidden" name="trainer_slug" value="${escapeHtml(trainer.slug || trainer.id)}">
    <input type="hidden" name="trainer_market" value="${escapeHtml(trainer.market)}">
    <input type="hidden" name="trainer_city" value="${escapeHtml(trainerCity(trainer))}">
    <input type="hidden" name="trainer_state" value="${escapeHtml(trainer.state || "")}">
    <input type="hidden" name="vet_or_previous_client" value="${escapeHtml(trainer.name)}">
    <input type="hidden" name="source_page" value="${escapeHtml(trainer.pageSlug || trainer.slug || trainer.id)}">
    <div class="landing-form-grid">
      <label class="wide trainer-locked-field">Trainer Name<input value="${escapeHtml(trainer.name)}" readonly disabled aria-disabled="true"></label>
      <label>First Name<input required name="first_name" autocomplete="given-name" placeholder="First name"></label>
      <label>Last Name<input required name="last_name" autocomplete="family-name" placeholder="Last name"></label>
      <label>Email Address<input required type="email" name="email" autocomplete="email" placeholder="Email address"></label>
      <label>Phone <small>(required for callback)</small><input required name="phone" autocomplete="tel" placeholder="Phone number"></label>
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
      <details class="landing-more-fields wide"><summary>Required address and referral details</summary><div class="landing-more-grid"><label>Address Line 1 *<input required name="address_line_1" autocomplete="address-line1" placeholder="Address Line 1"></label><label>Address Line 2 <small>(optional)</small><input name="address_line_2" autocomplete="address-line2" placeholder="Address Line 2"></label><label>City *<input required name="city" autocomplete="address-level2" placeholder="City"></label><label>State *<input required name="state" autocomplete="address-level1" placeholder="State"></label><label>ZIP Code *<input required name="zip" autocomplete="postal-code" placeholder="ZIP Code"></label><label class="wide">How did you hear about us? *${heardAboutUsSelect()}</label></div></details>
      <label class="landing-consent wide"><input type="checkbox" name="sms_consent" value="yes"><span>By checking this box, I agree to receive recurring promotional and informational text messages from Lorenzo's Dog Training Team about dog training, consultation scheduling, follow-up, and offers. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the <a href="/terms.html">Terms of Service</a> and <a href="/privacy-policy.html">Privacy Policy</a>.</span></label>
      <div class="landing-form-status wide" role="status" aria-live="polite"></div>
      <button class="btn btn-red wide" type="submit">Book My Free Consultation</button>
    </div>
    <div class="form-privacy">Your information is sent securely to Lorenzo's production office. Phone is required so the office can call about your request. SMS consent is optional and separate.</div>
  </form>`;
}

function trainerVideoFor(trainer) {
  const candidates = [
    trainer.trainerVideoUrl,
    trainer.videoUrl,
    trainerVideoLibrary[trainer.slug || ""],
    trainerVideoLibrary[trainer.pageSlug || ""],
    trainerVideoLibrary[trainer.id || ""]
  ].filter(Boolean);
  const video = candidates[0];
  if (!video) return null;
  if (typeof video === "string") return { src: video, poster: "" };
  return video;
}

function trainerVideoSectionMarkup(trainer) {
  const video = trainerVideoFor(trainer);
  if (!video?.src) return "";
  const posterAttr = video.poster ? ` poster="${escapeHtml(video.poster)}"` : "";
  const location = trainerLocationLabel(trainer);
  return `<section class="lp-trainer-video" id="trainer-video">
    <div class="lp-heading">
      <span>Trainer introduction</span>
      <h2>About ${escapeHtml(trainer.name)}, Lorenzo's Certified Dog Trainer${location ? ` in ${escapeHtml(location)}` : ""}.</h2>
      <p>Hear directly from ${escapeHtml(trainer.name)} about their experience with Lorenzo's Dog Training Team, the training process, owner leadership, and what families can expect when they start.</p>
    </div>
    <div class="lp-video-shell">
      ${isEmbeddableVideoUrl(video.src)
        ? `<iframe src="${escapeHtml(video.src)}" title="${escapeHtml(trainer.name)} trainer introduction video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
        : `<video controls preload="metadata"${posterAttr} playsinline><source src="${escapeHtml(video.src)}" type="video/mp4"></video>`}
    </div>
  </section>`;
}

function commonFooterFunnel(trainer) {
  return `<section class="landing-bottom-cta"><div><h2>Ready to transform your dog?</h2><p>Start with a professional evaluation and an office-guided training path.</p></div><div class="row-actions"><a class="btn btn-red" href="#contact">Book My Free Consultation</a></div></section>${landingFooter(trainer)}`;
}

function landingHeader(trainer) {
  const logo = trainer.companyLogo || "/assets/lorenzo-logo-white.png";
  const hasReviews = Boolean(trainerReviewsMarkup(trainer));
  return `<header class="landing-nav"><a class="landing-brand" href="#top"><img src="${escapeHtml(logo)}" alt="${escapeHtml(trainer.name)} dog training"><div><strong>${escapeHtml(trainer.name)}</strong><span>Powered by Lorenzo's Dog Training Team</span></div></a><nav><a href="#services">Services</a><a href="#trainer">Trainer</a>${hasReviews ? `<a href="#reviews">Results</a>` : ""}<a class="landing-review-nav" href="#submit-review">Leave Review</a><a href="#contact">Contact</a></nav></header>`;
}

function trainerCity(trainer) {
  return String(trainer.market || "").split(",")[0].trim();
}

function trainerLocationLabel(trainer) {
  const location = normalizeTrainerLocation(trainer.market, trainer.state);
  return [location.market, location.state].filter(Boolean).join(", ");
}

function landingFooter(trainer) {
  const trainerSlug = trainer.slug || trainer.id || "";
  const homeHref = `index.html?trainer_source=${encodeURIComponent(trainerSlug)}&trainer_name=${encodeURIComponent(trainer.name)}&source_page=trainer_landing_footer`;
  return `<footer class="trainer-landing-footer"><div class="footer-brand"><img src="/assets/lorenzo-logo-white.png" alt="Lorenzo's Dog Training Team"><p>Serious training for dogs of any age, size, breed, and temperament.</p><a class="trainer-footer-home-link" href="${homeHref}">Visit Lorenzo's Dog Training Team home</a></div><div><strong>${escapeHtml(trainer.name)}</strong><span>${escapeHtml(trainerLocationLabel(trainer))}</span><span>${escapeHtml(trainer.serviceArea)}</span></div><div><strong>Training Services</strong><span>Dog Obedience Training</span><span>Behavior Modification</span><span>Specialty Training</span></div><div><strong>Connect</strong>${trainerSocialMarkup(trainer)}<a href="#contact">Request consultation</a><a class="trainer-footer-review-link" href="#submit-review">Leave Review</a></div></footer>`;
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
  const bioPhotoStyle = publicContainedTrainerPhotoStyle(trainer, "bioPhotoPosition", "center center");
  return `<section class="landing-trainer-section ${variant}" id="trainer"><div class="landing-trainer-photo"><img src="${escapeHtml(trainerBioPhoto(trainer))}" style="${bioPhotoStyle}" alt="${escapeHtml(trainer.name)}, dog trainer in ${escapeHtml(trainer.market)}"></div><div class="landing-trainer-copy"><span>Meet your local trainer</span><h2>${escapeHtml(trainer.name)}</h2><h3>${escapeHtml(trainer.title || "Team Trainer")}</h3><div class="landing-bio-paragraphs">${profileBioParagraphs(trainer.bio)}</div><ul class="landing-facts">${facts}</ul></div><aside class="landing-trainer-side"><h3>${escapeHtml(trainer.name)} specializes in:</h3><ul>${specialties}</ul><div class="powered-badge"><img src="../assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><span>Certified and powered by Lorenzo's Dog Training Team</span></div></aside></section>`;
}

function proofSectionMarkup(trainer, heading = "What our clients say") {
  const reviews = trainerReviewsMarkup(trainer);
  if (!reviews) return "";
  return `<section class="landing-reviews" id="reviews"><div class="landing-section-heading"><h2>${heading}</h2><p>Real feedback about owner leadership, calmer behavior, and training that holds up in daily life.</p></div>${reviews}</section>`;
}

function processSectionMarkup() {
  return `<section class="landing-process"><div class="landing-section-heading"><h2>How it works</h2></div><div class="landing-how-it-works"><div><strong>1</strong><span>Request your free consultation</span><small>Tell the office about your dog and goals.</small></div><div><strong>2</strong><span>Complete an evaluation</span><small>We assess the dog, owner, home, and priorities.</small></div><div><strong>3</strong><span>Follow a tailored plan</span><small>Your trainer teaches the dog and owner together.</small></div><div><strong>4</strong><span>Build lasting results</span><small>Practice leadership, rules, and boundaries in real life.</small></div></div></section>`;
}

function publicReviewFormMarkup(trainer) {
  return `<details class="lp-submit-review" id="submit-review">
    <summary><span>Submit a Review</span><small>Share text, photos, or videos for office approval.</small></summary>
    <form class="public-review-form" data-trainer-id="${escapeHtml(trainer.id)}" enctype="multipart/form-data">
      <input type="hidden" name="trainer_name" value="${escapeHtml(trainer.name)}">
      <input type="hidden" name="trainer_slug" value="${escapeHtml(trainer.slug || trainer.id)}">
      <input type="hidden" name="trainer_market" value="${escapeHtml(trainer.market)}">
      <input type="hidden" name="trainer_city" value="${escapeHtml(trainerCity(trainer))}">
      <input type="hidden" name="trainer_state" value="${escapeHtml(trainer.state || "")}">
      <input type="hidden" name="source_page" value="${escapeHtml(trainer.pageSlug || trainer.slug || trainer.id)} review submission">
      <div class="public-review-grid">
        <label>Your Name *<input required name="reviewer_name" autocomplete="name" placeholder="Your name"></label>
        <label>Email *<input required type="email" name="reviewer_email" autocomplete="email" placeholder="Email address"></label>
        <label>Star Rating *<select required name="star_rating"><option value="">Select rating</option><option value="5">5 Stars</option><option value="4">4 Stars</option><option value="3">3 Stars</option><option value="2">2 Stars</option><option value="1">1 Star</option></select></label>
        <label class="wide">Location <small>(optional)</small><input name="client_location" autocomplete="address-level2" placeholder="City, State"></label>
        <label class="wide">Review or testimonial *<textarea required name="review_text" placeholder="Tell us about your experience and the results you saw."></textarea></label>
        <label class="wide">Upload photo or video <input type="file" name="review_file" accept="image/*,video/*"></label>
        <label class="wide">Or paste a review video link <input type="url" name="review_video_url" placeholder="YouTube, Vimeo, Loom, Google Drive, Dropbox, or direct MP4/WebM"></label>
        <label class="public-review-consent wide"><input required type="checkbox" name="permission_to_share" value="yes"><span>I confirm Lorenzo's Dog Training Team may review and use this content after office approval.</span></label>
        <div class="public-review-status wide" role="status" aria-live="polite"></div>
        <button class="btn btn-red wide" type="submit">Submit For Office Approval</button>
      </div>
    </form>
  </details>`;
}

function publicContainedTrainerPhotoStyle(trainer, positionKey = "bioPhotoPosition", fallbackPosition = "center center") {
  const position = photoFrameValue(trainer?.[positionKey], fallbackPosition);
  return `object-position:${escapeHtml(position)};object-fit:contain;transform:none;background:#061f46;`;
}

function publicSiteMarkup(trainer) {
  const params = new URLSearchParams(window.location.search);
  const forcedLayout = document.body.dataset.layout || params.get("layout");
  const layout = approvedLayouts.find(l => l.id === (forcedLayout || trainer.layout)) || approvedLayouts[0];
  const heroImage = escapeHtml(trainer.image || trainerLandingDogs[layout.id] || "/assets/client-photo.jpg");
  const heroTrainerPhoto = escapeHtml(trainerHeroPhoto(trainer));
  const bioTrainerPhoto = escapeHtml(trainerBioPhoto(trainer));
  const heroPhotoPosition = photoFrameValue(trainer.heroPhotoPosition, "center top");
  const heroPhotoStyle = `object-position:${escapeHtml(heroPhotoPosition)};object-fit:contain;transform:none;background:#071f46;`;
  const bioPhotoStyle = publicContainedTrainerPhotoStyle(trainer, "bioPhotoPosition", "center center");
  const styleSettings = trainer.styleSettings || {};
  const styleAttr = `--lp-font:${escapeHtml(styleSettings.fontFamily || "Inter")};--lp-scale:${Number(styleSettings.fontScale || 1)};--lp-primary:${escapeHtml(styleSettings.brandPrimary || "#071f44")};--lp-accent:${escapeHtml(styleSettings.brandAccent || "#d80f35")}`;
  const editedHeadline = String(trainer.heroHeadline || "").trim();
  const customHeading = fallback => editedHeadline && editedHeadline !== layout.headline
    ? escapeHtml(editedHeadline).replace(/\.\s+/g, ".<br>")
    : fallback;
  const formCard = officeLeadFormMarkup(trainer, true);
  const market = escapeHtml(trainer.market);
  const serviceArea = escapeHtml(trainer.serviceArea);
  const trainerHeroCard = `<div class="lp-hero-trainer-card"><img src="${heroTrainerPhoto}" style="${heroPhotoStyle}" data-trainer-image-role="heroTrainerPhoto" alt="${escapeHtml(trainer.name)}"><div><strong>${escapeHtml(trainer.name)}</strong><span>${escapeHtml(trainerLocationLabel(trainer))}</span></div></div>`;
  const credentials = (trainer.credentials || []).slice(0, 4).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const specialties = (trainer.specialties || []).slice(0, 6).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const brandBadge = `<div class="ldtt-affiliation"><img src="../assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><div><strong>Lorenzo's Certified Dog Trainer</strong><span>Powered by Lorenzo's Dog Training Team</span></div></div>`;
  const stats = `<section class="lp-stats"><article><strong>40+</strong><span>Years of experience</span></article><article><strong>100,000+</strong><span>Dogs trained of all breeds</span></article><article><strong>50+</strong><span>Professional trainers nationwide</span></article><article><strong>100%</strong><span>Commitment to you and your dog</span></article></section>`;
  const services = `<section class="lp-services" id="services"><div class="lp-heading"><span>Training for real life</span><h2>Three solutions. One goal: a better dog.</h2><p>Professional dog training in ${market} for dogs of any age, size, breed, and temperament.</p></div><div class="lp-service-grid"><article><b>01</b><h3>Dog Obedience</h3><p>Build dependable heel, sit, stay, come, down, and real-world control.</p><ul><li>Puppy foundations</li><li>On-leash obedience</li><li>Advanced off-leash training</li></ul></article><article><b>02</b><h3>Behavior Modification</h3><p>Structured help for aggression, reactivity, barking, pulling, jumping, and house-soiling.</p><ul><li>Aggression and reactivity</li><li>Anxiety and fear</li><li>Leadership and boundaries</li></ul></article><article><b>03</b><h3>Specialty Training</h3><p>Purpose-driven programs for service tasks, protection, scent work, utility, and retrieval.</p><ul><li>Service and assistance dogs</li><li>Protection training</li><li>Scent, utility, and retrieval</li></ul></article></div></section>`;
  const trainerVideo = trainerVideoSectionMarkup(trainer);
  const approvedReviewMarkup = trainerReviewsMarkup(trainer);
  const reviews = approvedReviewMarkup
    ? `<section class="lp-reviews" id="reviews"><div class="lp-heading"><span>Real people. Real results.</span><h2>What local clients say</h2></div>${approvedReviewMarkup}</section>`
    : "";
  const reviewSubmission = `<section class="lp-review-submission">${publicReviewFormMarkup(trainer)}</section>`;
  const process = `<section class="lp-process"><div class="lp-heading"><span>A clear path forward</span><h2>How training begins</h2></div><div class="lp-process-grid"><article><b>1</b><h3>Request a consultation</h3><p>Tell Lorenzo's office about your dog, household, and goals.</p></article><article><b>2</b><h3>Complete an evaluation</h3><p>Your trainer assesses temperament, timing, handling, and priorities.</p></article><article><b>3</b><h3>Follow your plan</h3><p>The dog and owner learn together through technique and consistency.</p></article><article><b>4</b><h3>Build lasting results</h3><p>Use leadership, rules, and boundaries in everyday life.</p></article></div></section>`;
  const footer = `<section class="lp-final"><div><span>Start with Lorenzo's office</span><h2>Ready for a better life with your dog?</h2><p>Request your consultation today. Lorenzo's office will review your request and follow up with the next step.</p></div><a class="lp-button" href="#contact">Book My Free Consultation</a></section>${landingFooter(trainer)}`;

  if (layout.id === "mock-6") {
    return `<div class="landing-template landing-template-6 lp-page" id="top" style="${styleAttr}">${landingHeader(trainer)}<section class="lp6-hero" style="--hero-art:url('${heroImage}')"><div class="lp6-copy"><span>${escapeHtml(trainer.name)} · ${escapeHtml(trainerLocationLabel(trainer))}</span><h1>${customHeading("Serious training.<br><em>Serious results.</em>")}</h1><p>${escapeHtml(trainer.tagline || `Professional dog training for families in ${trainerLocationLabel(trainer)}. Lorenzo's proven system builds obedience, modifies behavior, and creates dependable control in real life.`)}</p><ul class="lp6-proof-points"><li>Proven methods</li><li>Trusted results</li><li>Lifetime impact</li></ul></div>${trainerHeroCard}<div class="lp6-form">${formCard}</div></section>${stats}${services}${trainerVideo}<section class="lp6-trainer" id="trainer"><div class="lp6-trainer-image"><img src="${bioTrainerPhoto}" style="${bioPhotoStyle}" data-trainer-image-role="landingBioPhoto" alt="${escapeHtml(trainer.name)} with a trained dog"></div><div class="lp6-trainer-copy"><span>Meet your local trainer</span><h2>${escapeHtml(trainer.name)}</h2><h3>${escapeHtml(trainer.title)}</h3><div class="landing-bio-paragraphs">${profileBioParagraphs(trainer.bio)}</div>${brandBadge}</div><aside><h3>${escapeHtml(trainer.name)}'s specialties</h3><ul>${specialties}</ul><h3>Credentials</h3><ul>${credentials}</ul></aside></section>${reviewSubmission}${reviews}<section class="lp6-cta"><div><span>Professional training in ${market}</span><h2>Ready to transform your dog?</h2><ul><li>Professional evaluation</li><li>Tailored training recommendations</li><li>Office-guided next steps</li></ul></div>${officeLeadFormMarkup(trainer, true)}</section>${footer}</div>`;
  }

  if (layout.id === "mock-3") {
    return `<div class="landing-template landing-template-3 lp-page" id="top" style="${styleAttr}">${landingHeader(trainer)}<section class="lp3-hero" style="--hero-art:url('${heroImage}')"><div class="lp3-copy"><span>★★★★★ &nbsp; ${escapeHtml(trainer.name)} · ${escapeHtml(trainerLocationLabel(trainer))}</span><h1>${customHeading("Serious training.<br>Serious <em>results.</em>")}</h1><p>${escapeHtml(trainer.tagline || `Trusted dog obedience training and behavior modification for families in ${trainerLocationLabel(trainer)} and throughout ${trainer.serviceArea}.`)}</p><ul><li>Proven methods that work</li><li>Balanced training for real-life results</li><li>Backed by Lorenzo's nationwide team</li></ul></div>${trainerHeroCard}<div class="lp3-form">${formCard}</div></section>${stats}${services}${trainerVideo}<section class="lp3-trainer" id="trainer"><div class="lp3-photo"><img src="${bioTrainerPhoto}" style="${bioPhotoStyle}" data-trainer-image-role="landingBioPhoto" alt="${escapeHtml(trainer.name)}, certified Lorenzo trainer"></div><div class="lp3-bio"><span>Meet your trainer</span><h2>${escapeHtml(trainer.name)}</h2><h3>${escapeHtml(trainerLocationLabel(trainer))}</h3><h3>${escapeHtml(trainer.title)}</h3><div class="landing-bio-paragraphs">${profileBioParagraphs(trainer.bio)}</div><div class="lp3-trust"><ul>${credentials}</ul><ul>${specialties}</ul></div>${brandBadge}</div></section>${reviewSubmission}${reviews}${process}<section class="lp3-contact"><div><span>Let's build a better future</span><h2>For you and your dog.</h2><p>Serving ${serviceArea} with professional, office-supported dog training.</p></div>${officeLeadFormMarkup(trainer, true)}<aside><strong>Office follow-up</strong><span>Submit the form and Lorenzo's team will review your request and follow up with the next step.</span></aside></section>${landingFooter(trainer)}</div>`;
  }

  return `<div class="landing-template landing-template-5 lp-page" id="top" style="${styleAttr}">${landingHeader(trainer)}<section class="lp5-hero" style="--hero-art:url('${heroImage}')"><div class="lp5-copy"><span>${escapeHtml(trainer.name)} · ${escapeHtml(trainerLocationLabel(trainer))}</span><h1>${customHeading("The right trainer.<br><em>The right results.</em>")}</h1><h2>Obedience. Behavior solutions. Real results.</h2><p>${escapeHtml(trainer.tagline || `Personalized dog training in ${trainerLocationLabel(trainer)}, backed by Lorenzo's proven system and an office team that manages every lead and next step.`)}</p><div class="lp5-proof"><span>Proven methods that work</span><span>Personalized training plans</span><span>Results you can see and feel</span></div></div>${trainerHeroCard}<div class="lp5-form">${formCard}</div></section><section class="lp5-trust"><div class="lp-heading"><span>Why choose Lorenzo's?</span><h2>Experience, accountability, and a proven system.</h2></div>${stats}</section>${services}${trainerVideo}<section class="lp5-trainer" id="trainer"><div class="lp5-bio"><span>Meet your local trainer</span><h2>${escapeHtml(trainer.name)}</h2><h3>${escapeHtml(trainerLocationLabel(trainer))}</h3><h3>${escapeHtml(trainer.title)}</h3><div class="landing-bio-paragraphs">${profileBioParagraphs(trainer.bio)}</div><ul>${credentials}</ul>${brandBadge}</div><div class="lp5-photo"><img src="${bioTrainerPhoto}" style="${bioPhotoStyle}" data-trainer-image-role="landingBioPhoto" alt="${escapeHtml(trainer.name)} with a trained dog"></div><aside><h3>${escapeHtml(trainer.name)} specializes in</h3><ul>${specialties}</ul></aside></section>${reviewSubmission}${reviews}${process}<section class="lp5-final"><div><span>Ready to transform your dog?</span><h2>Start with a professional consultation.</h2><p>Office-guided scheduling. Local trainer expertise. Lorenzo-backed results.</p></div><a class="lp-button" href="#contact">Book My Free Consultation</a></section>${landingFooter(trainer)}</div>`;
}

function profileBioParagraphs(text) {
  const clean = String(text || "").trim();
  if (!clean) return "<p>Full trainer bio is pending office approval.</p>";
  const paragraphs = clean.includes("\n")
    ? clean.split(/\n+/)
    : clean.split(/(?<=\.)\s+(?=[A-Z])/).reduce((groups, sentence, index) => {
      const groupIndex = Math.floor(index / 3);
      groups[groupIndex] = [groups[groupIndex], sentence].filter(Boolean).join(" ");
      return groups;
    }, []);
  return paragraphs
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => `<p>${escapeHtml(part)}</p>`)
    .join("");
}

function publicTrainerProfileMarkup(trainer) {
  const name = escapeHtml(trainer.name || "Lorenzo Trainer");
  const location = escapeHtml(trainerLocationLabel(trainer) || trainer.market || "");
  const stateLabel = escapeHtml(trainer.state || stateFromMarket(trainer.market) || "Lorenzo Trainer");
  const summary = escapeHtml(trainer.summary || trainer.tagline || `${trainer.name || "This trainer"} provides office-supported dog training through Lorenzo's Dog Training Team.`);
  const photo = escapeHtml(trainerBioPhoto(trainer));
  const scheduleUrl = `${trainerPageHref(trainer)}#contact`;
  return `<section class="trainer-profile-hero" data-trainer-profile-slug="${escapeHtml(trainer.slug || trainer.id || "")}">
    <div class="container trainer-profile-grid">
      <figure class="trainer-profile-photo"><img src="${photo}" data-trainer-image-role="profileBioPhoto" alt="${name} trainer bio photo"></figure>
      <article class="trainer-profile-copy">
        <span class="tag">${stateLabel}</span>
        <h1>${name}</h1>
        <p class="trainer-profile-location">${location}</p>
        <p class="trainer-profile-summary">${summary}</p>
        <div class="trainer-profile-actions">
          <a class="btn btn-red" href="${escapeHtml(scheduleUrl)}">Schedule This Trainer</a>
          <a class="btn btn-outline" href="/find-a-trainer">Back to Trainer Directory</a>
        </div>
      </article>
    </div>
  </section>
  <section class="section trainer-profile-body">
    <div class="container trainer-profile-article">
      <span class="eyebrow">Trainer Bio</span>
      <h2>About <span data-trainer-profile-name>${name}</span></h2>
      <div data-trainer-profile-bio>${profileBioParagraphs(trainer.profileBio || trainer.publicBio || trainer.bio)}</div>
    </div>
  </section>
  <section class="section soft">
    <div class="container">
      <div class="cta-band">
        <div><h2>Ready to start training with <span data-trainer-profile-name>${name}</span>?</h2><p>Send your request directly to Lorenzo's office with ${name} already assigned as the source trainer.</p></div>
        <a class="btn btn-red" href="${escapeHtml(scheduleUrl)}">Schedule This Trainer</a>
      </div>
    </div>
  </section>`;
}

function renderPublicSite() {
  const params = new URLSearchParams(window.location.search);
  const trainer = repairPublicPhotoRoles(trainerById(requestedPublicTrainerKey() || params.get("trainer") || state.selectedTrainerId));
  if (!trainer) {
    document.getElementById("publicSite").innerHTML = `<main class="trainer-page-loading"><img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><h1>Loading trainer page…</h1><p>Retrieving the office-approved trainer profile.</p></main>`;
    return;
  }
  document.title = trainer.seoTitle || `${trainer.name} Dog Training in ${trainer.market} | Lorenzo's Dog Training Team`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = trainer.seoDescription || `Professional dog obedience training and behavior modification with ${trainer.name} in ${trainer.market}, backed by Lorenzo's Dog Training Team.`;
  document.getElementById("publicSite").innerHTML = publicSiteMarkup(trainer);
  applyLiveEditsToDocument(document, trainer.liveEdits || []);
  applySectionBuilderSettings(document, trainer);
  recordTrainerPageView(trainer);
}

function renderPublicTrainerProfile() {
  const params = new URLSearchParams(window.location.search);
  const trainer = repairPublicPhotoRoles(trainerById(requestedPublicTrainerBioKey() || params.get("trainer") || state.selectedTrainerId));
  if (!trainer) {
    document.getElementById("publicTrainerProfile").innerHTML = `<main class="trainer-page-loading"><img src="/assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"><h1>Loading trainer bio...</h1><p>Retrieving the office-approved trainer profile.</p></main>`;
    return;
  }
  document.title = `${trainer.name} | Lorenzo's Dog Training Team`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = `${trainer.name} trainer bio, service area, and scheduling page through Lorenzo's Dog Training Team.`;
  document.getElementById("publicTrainerProfile").innerHTML = publicTrainerProfileMarkup(trainer);
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

function isReleaseQaHost() {
  return /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) || /\.vercel\.app$/i.test(window.location.hostname);
}

function trainerAttribution(trainer, eventType) {
  const params = new URLSearchParams(window.location.search);
  return {
    event_id: `${isReleaseQaHost() ? "qa-release-" : ""}${globalThis.crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
    event_type: eventType,
    qa: isReleaseQaHost(),
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

function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value || "").trim();
  if (!text || /^(undefined|null)$/i.test(text) || /^https?:\/\//i.test(text)) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00` : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timestampValue(value) {
  return parseTimestamp(value)?.getTime() || 0;
}

function formatDateTime(value) {
  const date = parseTimestamp(value);
  if (!date) return value ? String(value) : "—";
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function formatPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return String(value || "");
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formEntries(form) {
  const data = new FormData(form);
  const result = {};
  data.forEach((value, key) => {
    if (key in result) {
      result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
      return;
    }
    result[key] = value;
  });
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value]));
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

async function submitPublicReviewToBackend(entries) {
  const response = await fetch("/api/submit-content-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries)
  });
  const text = await response.text();
  let result = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { message: text };
  }
  if (!response.ok || result.ok === false) {
    throw new Error(result.message || `Review backend failed (${response.status})`);
  }
  return result;
}

async function submitPublicReview(entries) {
  try {
    return await submitPublicReviewToBackend(entries);
  } catch (backendError) {
    console.warn("LDTT public review API failed; trying Supabase Edge Function fallback", backendError);
    return submitToSupabase("submit-content-review", entries);
  }
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
    comments: [entries.comments || "", entries.additional_interest ? `Additional interest: ${entries.additional_interest}.` : ""].filter(Boolean).join("\n\n")
  };
  Object.entries(mapping).forEach(([field, entry]) => {
    if (sheetEntries[field]) payload.append(entry, sheetEntries[field]);
  });
  payload.append("fvv", "1");
  payload.append("pageHistory", "0");
  return fetch(endpoint, { method: "POST", mode: "no-cors", body: payload });
}

async function recordClientFormDelivery(entries, canonical, status, error = "") {
  const response = await fetch("/api/form-delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      form_type: "contact",
      entries,
      canonical,
      client_delivery: {
        destination: "formsubmit_email",
        status,
        error
      }
    })
  });
  if (!response.ok) throw new Error("Browser delivery result could not be logged.");
}

document.addEventListener("toggle", event => {
  const details = event.target?.matches?.("[data-lead-sheet-details]") ? event.target : null;
  if (!details) return;
  state.leadDetailSheetOpen = Boolean(details.open);
  persistStateSnapshot();
}, true);

document.addEventListener("click", async event => {
  const horizontalScroll = event.target.closest("[data-scroll-horizontal]");
  if (horizontalScroll) {
    const scroller = document.getElementById(horizontalScroll.dataset.scrollTarget || "");
    if (scroller) {
      const amount = Math.max(320, scroller.clientWidth * .75);
      scroller.scrollBy({ left: horizontalScroll.dataset.scrollHorizontal === "left" ? -amount : amount, behavior: "smooth" });
    }
    return;
  }
  const loginModeButton = event.target.closest("[data-login-mode]");
  if (loginModeButton) {
    const mode = loginModeButton.dataset.loginMode || "admin";
    const card = loginModeButton.closest(".login-card") || document;
    const toggle = loginModeButton.closest(".portal-mode-toggle");
    if (toggle) toggle.dataset.activeMode = mode;
    card.querySelectorAll("[data-login-mode]").forEach(button => button.classList.toggle("active", button === loginModeButton));
    const title = card.querySelector("h1");
    const helper = card.querySelector("#loginModeHelp");
    const username = card.querySelector('input[name="username"]');
    if (title) title.textContent = mode === "trainer" ? "Trainer Login" : "Admin Login";
    if (helper) helper.textContent = mode === "trainer"
      ? "Trainers sign in with their assigned trainer email and temporary or permanent password."
      : "Office staff sign in with their assigned admin email and password.";
    if (username) username.placeholder = mode === "trainer" ? "Trainer email" : "Admin email";
    return;
  }
  if (session.role === "admin" && isOfficeAdmin() && event.target.closest("#addTrainer,[data-open-client-import],[data-publish-trainer],[data-delete-trainer]")) {
    showToast("This action requires Super Admin access.");
    return;
  }
  const publicReviewMedia = event.target.closest("[data-open-public-review-media]");
  if (publicReviewMedia) {
    openPublicReviewMedia(publicReviewMedia);
    return;
  }
  const copyInvite = event.target.closest("[data-copy-invite]");
  if (copyInvite) {
    const field = document.getElementById(copyInvite.dataset.copyInvite);
    const text = field?.value || "";
    try {
      await navigator.clipboard.writeText(text);
      showToast("Trainer invite message copied.");
    } catch {
      field?.focus();
      field?.select();
      showToast("Invite message selected. Copy it from the text box.");
    }
    return;
  }
  const leadView = event.target.closest("[data-lead-view]");
  if (leadView) { state.leadViewMode = leadView.dataset.leadView; saveState(); return; }
  const leadOwnerQuick = event.target.closest("[data-lead-owner-quick]");
  if (leadOwnerQuick) {
    const quickValue = leadOwnerQuick.dataset.leadOwnerQuick || "All";
    state.leadOwnerFilter = quickValue === "toggle"
      ? (state.leadOwnerFilter === "Me" ? "All" : "Me")
      : quickValue;
    saveState(state.leadOwnerFilter === "Me" ? "Showing leads assigned to you" : "Showing all lead owners");
    return;
  }
  const kanbanScroll = event.target.closest("[data-scroll-kanban]");
  if (kanbanScroll) {
    const board = kanbanScroll.closest(".panel")?.querySelector(".lead-kanban") || document.querySelector(".lead-kanban");
    if (board) {
      const direction = kanbanScroll.dataset.scrollKanban;
      if (direction === "start" || direction === "end") board.scrollTo({ left: direction === "start" ? 0 : board.scrollWidth, behavior: "smooth" });
      else board.scrollBy({ left: direction === "left" ? -Math.max(320, board.clientWidth * .75) : Math.max(320, board.clientWidth * .75), behavior: "smooth" });
    }
    return;
  }
  const toggleNoteEdit = event.target.closest("[data-toggle-note-edit]");
  if (toggleNoteEdit) {
    const editor = document.querySelector(`[data-note-editor="${CSS.escape(toggleNoteEdit.dataset.toggleNoteEdit)}"]`);
    if (editor) editor.hidden = !editor.hidden;
    return;
  }
  const saveNoteEdit = event.target.closest("[data-save-office-note-edit]");
  if (saveNoteEdit) {
    const noteId = saveNoteEdit.dataset.saveOfficeNoteEdit;
    const editor = document.querySelector(`[data-office-note-edit="${CSS.escape(noteId)}"]`);
    const note = editor?.value?.trim() || "";
    if (!note) { showToast("A note cannot be empty."); return; }
    runRemoteMutation("Office note edit saved with history", () => saveEditableOfficeNote(saveNoteEdit.dataset.entityType, saveNoteEdit.dataset.entityId, noteId, note), {
      type: "Office Note",
      detail: `${currentActorLabel()} edited an office note; the prior version was preserved.`
    });
    return;
  }
  const permanentDelete = event.target.closest("[data-permanent-delete]");
  if (permanentDelete) {
    const label = permanentDelete.dataset.recordLabel || "this record";
    const confirmation = window.prompt(`Permanent deletion is only for archived QA, duplicate, or draft records. Type PERMANENTLY DELETE to remove ${label}.`);
    if (confirmation !== "PERMANENTLY DELETE") { showToast("Permanent deletion cancelled."); return; }
    const deleted = await runRemoteMutation("Archived QA or duplicate record permanently deleted", () => window.LDTT_PORTAL.operationalMutation({
      operation: "permanent_delete",
      entity_type: permanentDelete.dataset.permanentDelete,
      id: permanentDelete.dataset.recordId,
      confirmation,
      summary: `${label} permanently deleted after Super Admin confirmation`
    }), { type: "Security", detail: `${label} permanently deleted by ${currentActorLabel()}.` });
    if (deleted) {
      state.selectedLeadId = "";
      state.selectedApplicationId = "";
      state.selectedClientId = "";
    }
    return;
  }
  const openLead = event.target.closest("[data-open-lead]");
  if (openLead && !event.target.closest("select,input,textarea,button")) { state.selectedLeadId = openLead.dataset.openLead; saveState(); return; }
  if (event.target.closest("[data-close-lead]")) { state.selectedLeadId = ""; saveState(); return; }
  const archiveLead = event.target.closest("[data-archive-lead]");
  if (archiveLead) {
    const lead = updateLeadRecord(archiveLead.dataset.archiveLead, { status: "Archived" });
    state.selectedLeadId = "";
    if (remoteReady) runRemoteMutation("Lead archived; record preserved", () => window.LDTT_PORTAL.operationalMutation({
      operation: "archive",
      entity_type: "lead",
      id: lead.remoteId,
      expected_version: lead.version,
      expected_updated_at: lead.updatedAt,
      summary: `${lead.owner || "Lead"} archived`
    }), {
      type: "Lead",
      detail: `${lead?.owner || "Lead"} was archived by ${currentActorLabel()}.`
    });
    else saveState("Lead archived; record preserved");
    return;
  }
  const saveLead = event.target.closest("[data-save-lead]");
  if (saveLead) {
    const lead = allLeadRows().find(item => item.id === saveLead.dataset.saveLead);
    if (remoteReady) runRemoteMutation("Lead status and office notes saved", () => persistLeadWorkflow(lead), {
      type: "Lead",
      detail: `${lead?.owner || "Lead"} saved with status ${lead?.status || "unknown"} and office notes by ${currentActorLabel()}.`
    });
    else saveState("Lead status and office notes saved");
    return;
  }
  const addNote = event.target.closest("[data-add-office-note]");
  if (addNote) {
    const entityType = addNote.dataset.addOfficeNote;
    const entityId = addNote.dataset.entityId;
    const viewport = captureViewportPosition();
    if (!remoteReady || !hasSharedRecordId(entityId)) {
      showToast("Office notes require the shared Supabase record to be loaded first.");
      return;
    }
    const textarea = document.querySelector(`[data-new-office-note="${CSS.escape(entityId)}"]`);
    const note = textarea?.value || "";
    if (!note.trim()) {
      showToast("Add a note before saving.");
      return;
    }
    addNote.setAttribute("disabled", "disabled");
    try {
      await addOfficeNote(entityType, entityId, note);
      if (entityType === "application") {
        const application = state.applications.find(item => String(item.remoteId || "") === String(entityId));
        if (application) application.note = officeNotesFor("application", entityId).map(item => item.note).filter(Boolean).join("\n\n") || note.trim();
      }
      recordActivity("Office note added", `${currentActorLabel()} added an office note to ${officeNoteEntityLabel(entityType, entityId)}.`, "Office Note");
      showToast("Office note saved with timestamp and user.");
      render();
      restoreViewportPosition(viewport);
    } catch (error) {
      console.error("Office note save failed", error);
      showToast(`Office note could not be saved: ${error.message}`);
      addNote.removeAttribute("disabled");
      restoreViewportPosition(viewport);
    }
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
    if (portalUser?.must_change_password && view.dataset.view !== "settings") {
      state.activeView = "settings";
      saveState("Create your permanent password before using the portal");
      return;
    }
    if (portalProfileNeedsCompletion() && view.dataset.view !== "settings") {
      state.activeView = "settings";
      saveState("Complete your portal profile before using the portal");
      return;
    }
    if (session.role === "admin" && !canAccessAdminView(view.dataset.view)) {
      showToast("This section requires Super Admin access.");
      return;
    }
    state.activeView = view.dataset.view;
    persistStateSnapshot();
    render();
    if (remoteReady) {
      try {
        await reloadRemoteData();
        render();
      } catch (error) {
        console.error("LDTT shared portal refresh failed", error);
        showToast("Showing the most recently loaded data. Refresh to try again.");
      }
    }
    return;
  }
  if (event.target.closest("[data-open-client-import]")) {
    if (isOfficeAdmin()) {
      showToast("Client import requires Super Admin access.");
      return;
    }
    state.activeView = "clients";
    saveState();
    window.setTimeout(() => {
      const panel = document.getElementById("clientImportPanel");
      if (panel) {
        panel.open = true;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
    return;
  }
  if (event.target.closest("[data-clear-activity-log]")) {
    if (!isSuperAdmin()) {
      showToast("Only Super Admins can clear the local activity log.");
      return;
    }
    if (!window.confirm("Clear the local activity log on this device?")) return;
    state.activityLog = [];
    saveState("Activity log cleared");
    return;
  }
  const portalAccessAction = event.target.closest("[data-portal-access-action]");
  if (portalAccessAction) {
    if (!isSuperAdmin()) {
      showToast("Only Super Admins can change portal access.");
      return;
    }
    const user = findPortalAccessUser(portalAccessAction.dataset.portalUser);
    if (!user) {
      showToast("Portal user record could not be found.");
      return;
    }
    const action = portalAccessAction.dataset.portalAccessAction;
    if (action === "reset-password") {
      const password = window.prompt(`Enter a new permanent password for ${portalDisplayName(user)}:`, DEMO_TEST_PASSWORD);
      if (!password) return;
      if (password.length < 8) {
        showToast("Password must be at least 8 characters.");
        return;
      }
      try {
        await resetPortalUserPassword(user, password);
        recordActivity("Portal password reset", `${portalDisplayName(user)} password was reset by ${currentActorLabel()}.`, "Security");
        saveState("Portal password reset");
      } catch (error) {
        showToast(`Password could not be reset: ${error.message}`);
      }
      return;
    }
    const payload = action === "restore"
      ? { active: true, access_status: "active", disabled_at: null, disabled_by: null }
      : action === "revoke"
        ? { active: false, access_status: "revoked", disabled_at: new Date().toISOString(), disabled_by: currentPortalUserId() || null }
        : { active: false, access_status: "disabled", disabled_at: new Date().toISOString(), disabled_by: currentPortalUserId() || null };
    Object.assign(user, payload);
    if (user.role === "trainer" && user.trainer_id) {
      const trainer = trainerForPortalUser(user);
      if (trainer) trainer.accessStatus = payload.active ? "Active" : "Disabled";
    }
    await runRemoteMutation(action === "restore" ? "Portal access restored" : action === "revoke" ? "Portal access revoked" : "Portal access disabled", async () => {
      await persistPortalUserRecord(user, payload);
      if (user.role === "trainer" && user.trainer_id) {
        const trainer = trainerForPortalUser(user);
        if (trainer) await persistTrainerAccess(trainer);
      }
    }, { type: "Security", detail: `${portalDisplayName(user)} set to ${payload.access_status}.` });
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
    const missingItems = publish ? trainerPublishMissingItems(trainer) : [];
    if (missingItems.length) {
      showActionConfirmation(
        "Trainer setup needs a few items",
        "Finish these before publishing so the landing page, View Bio page, Find a Trainer card, reviews, and trainer login all connect cleanly.",
        { items: missingItems }
      );
      return;
    }
    trainer.locked = publish;
    trainer.pageStatus = publish ? "Published" : "Draft";
    if (remoteReady) {
      const ok = await runRemoteMutation(
        publish ? "Trainer page published and locked" : "Trainer page returned to office draft",
        () => publishTrainerPageWorkflow(trainer, publish),
        {
          type: "Trainer Page",
          detail: `${trainer.name} ${publish ? "was published and locked" : "was returned to draft"} by ${currentActorLabel()}.`
        }
      );
      if (ok && publish) showTrainerInviteDialog(findTrainer(trainer.remoteId || trainer.id) || trainer);
    } else {
      saveState(publish ? "Trainer page published and locked" : "Trainer page returned to office draft");
      if (publish) showTrainerInviteDialog(trainer);
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
        {
          reload: false,
          type: "Security",
          detail: `${trainer.name} portal access set to ${trainer.accessStatus}.`
        }
      );
    } else {
      saveState(trainer.accessStatus === "Disabled" ? "Trainer portal access disabled; records preserved" : "Trainer portal access restored");
    }
    return;
  }
  const deleteTrainer = event.target.closest("[data-delete-trainer]");
  if (deleteTrainer) {
    const trainer = trainerById(deleteTrainer.dataset.deleteTrainer);
    if (!trainer || !isDraftTrainer(trainer) || trainer.locked) {
      showToast("Only unlocked office drafts can be deleted.");
      return;
    }
    if (!window.confirm(`Delete the draft for ${trainer.name || "this trainer"}? This preserves other trainer records and leads.`)) return;
    if (remoteReady) {
      runRemoteMutation("Trainer draft deleted", () => deleteTrainerDraft(trainer), {
        type: "Trainer Page",
        detail: `${trainer.name || "Trainer draft"} was deleted before publishing.`
      });
    } else {
      deleteTrainerDraft(trainer);
      saveState("Trainer draft deleted");
    }
    return;
  }
  const assignLayout = event.target.closest("[data-assign-layout]");
  if (assignLayout) {
    const trainer = trainerById();
    trainer.layout = assignLayout.dataset.assignLayout;
    trainer.pageStatus = "Draft";
    trainer.locked = false;
    if (remoteReady) runRemoteMutation("Approved layout assigned and draft saved", () => persistTrainerRecord(trainer), {
      type: "Trainer Page",
      detail: `${trainer.name} layout changed to ${layoutName(trainer.layout)}.`
    });
    else saveState("Approved layout assigned by office");
    return;
  }
  const heroImage = event.target.closest("[data-hero-image]");
  if (heroImage) {
    const trainer = trainerById();
    trainer.image = heroImage.dataset.heroImage;
    if (remoteReady) runRemoteMutation("Approved hero image selected", () => persistTrainerRecord(trainer), {
      type: "Trainer Page",
      detail: `${trainer.name} landing-page hero background was changed.`
    });
    else saveState("Approved hero image selected");
    return;
  }
  const syncProfileField = event.target.closest("[data-sync-profile-field]");
  if (syncProfileField) {
    const trainer = trainerById();
    const keepPublished = trainer.pageStatus === "Published" || trainer.locked;
    const profileKey = syncProfileField.dataset.syncProfileField;
    const landingKey = syncProfileField.dataset.landingField;
    const value = fieldValue(trainer, profileKey);
    trainer[landingKey] = syncProfileField.dataset.syncList === "true"
      ? value.split(/\n|,/).map(item => item.trim()).filter(Boolean)
      : value;
    if (landingKey === "email") trainer.username = value;
    trainer.pageStatus = trainer.pageStatus === "No Site Started" ? "Draft" : trainer.pageStatus;
    if (remoteReady) runRemoteMutation(
      `${landingKey.replace(/([A-Z])/g, " $1")} synced to landing page`,
      () => persistTrainerRecord(trainer, keepPublished ? { publish: true } : {}),
      {
        type: "Trainer Profile",
        detail: `${trainer.name} ${landingKey} was synced from profile editor to landing page.`
      }
    );
    else saveState(`${landingKey.replace(/([A-Z])/g, " $1")} synced to landing page`);
    return;
  }
  const syncPublicField = event.target.closest("[data-sync-public-field]");
  if (syncPublicField) {
    const trainer = trainerById();
    const profileKey = syncPublicField.dataset.syncPublicField;
    if (profileKey === "profilePhoto") {
      const headshot = trainerHeadshot(trainer);
      trainer.profilePhoto = headshot;
      trainer.publicPhoto = headshot;
      trainer.cardPhoto = headshot;
    }
    if (remoteReady) runRemoteMutation("Public trainer profile field updated", () => persistPublicTrainerField(trainer, profileKey), {
      type: "Trainer Profile",
      detail: `${trainer.name} ${profileKey.replace(/^profile/, "") || "profile field"} was synced to the public trainer bio/card.`
    });
    else saveState("Public trainer profile updated");
    return;
  }
  const onboardingStep = event.target.closest("[data-onboarding-step]");
  if (onboardingStep && !onboardingStep.disabled) {
    state.onboardingStep = Number(onboardingStep.dataset.onboardingStep);
    if (remoteReady && session.role === "admin") {
      const trainer = trainerById();
      runRemoteMutation("Trainer setup progress and draft saved", () => persistTrainerRecord(trainer), {
        type: "Trainer Page",
        detail: `${trainer.name} setup moved to step ${state.onboardingStep}.`
      });
    } else {
      saveState("Trainer setup progress saved");
    }
    return;
  }
  const clientFilter = event.target.closest("[data-client-filter]");
  if (clientFilter) {
    state.clientFilter = clientFilter.dataset.clientFilter;
    state.selectedClientId = "";
    saveState();
    return;
  }
  const applicationFilter = event.target.closest("[data-application-filter]");
  if (applicationFilter) {
    state.applicationFilter = applicationFilter.dataset.applicationFilter;
    state.selectedApplicationId = "";
    saveState();
    return;
  }
  const applicationMode = event.target.closest("[data-application-mode]");
  if (applicationMode) {
    state.applicationViewMode = applicationMode.dataset.applicationMode;
    state.selectedApplicationId = "";
    saveState();
    requestAnimationFrame(() => {
      document.querySelector(".application-response-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }
  const reviewSubmissionFilter = event.target.closest("[data-review-submission-filter]");
  if (reviewSubmissionFilter) {
    state.reviewSubmissionFilter = reviewSubmissionFilter.dataset.reviewSubmissionFilter;
    state.selectedSubmissionId = "";
    saveState();
    return;
  }
  const resetLeadStatus = event.target.closest("[data-filter-leads='all']");
  if (resetLeadStatus) {
    state.leadStatusFilter = "All";
    saveState(`Showing ${filteredLeadRows(allLeadRows()).length} leads across all statuses`);
    return;
  }
  const convertLead = event.target.closest("[data-convert-lead]");
  if (convertLead) {
    const lead = allLeadRows().find(item => item.id === convertLead.dataset.convertLead);
    const client = upsertClientFromLead(lead);
    state.clientFilter = "Active";
    state.selectedClientId = client?.id || "";
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
  const reportRange = event.target.closest("[data-report-range]");
  if (reportRange) {
    state.reportDateRange = reportRange.dataset.reportRange;
    saveState(`Showing reports for ${reportRangeLabel()}`);
    return;
  }
  const approve = event.target.closest("[data-approve-submission]");
  if (approve) {
    const sub = state.submissions.find(s => s.id === approve.dataset.approveSubmission);
    if (sub && ["Review", "Testimonial"].includes(sub.type)) applyPendingReviewTargetSelection(sub);
    approve.disabled = true;
    const isReviewSubmission = ["Review", "Testimonial"].includes(sub?.type);
    const progress = remoteReady && isReviewSubmission
      ? showActionProgress("Publishing review", "Saving the approved review to the selected live destinations.", { items: reviewTargetLabelList(sub) })
      : null;
    if (remoteReady) {
      const saved = await runRemoteMutation("Submission approved", () => publishApprovedReview(sub), {
        type: "Review",
        detail: `${sub?.title || "Submission"} approved for ${reviewTargetLabels(sub)}.`,
        preserveScroll: true
      });
      if (saved && progress) {
        progress.done("Review published", "The approved review is live on these destinations.", { items: reviewTargetLabelList(sub) });
      } else if (!saved && progress) {
        progress.fail("Review not saved", "The live save did not complete. Please retry before leaving this screen.", { items: reviewTargetLabelList(sub) });
        approve.disabled = false;
      }
      if (!saved) approve.disabled = false;
    } else if (sub) {
      sub.status = "Approved";
      saveState("Submission approved");
    }
    return;
  }
  const publishReview = event.target.closest("[data-publish-review]");
  if (publishReview) {
    const sub = state.submissions.find(s => s.id === publishReview.dataset.publishReview);
    if (sub) applyPendingReviewTargetSelection(sub);
    publishReview.disabled = true;
    const progress = remoteReady
      ? showActionProgress("Publishing review", "Saving review placements to the live site.", { items: reviewTargetLabelList(sub) })
      : null;
    if (remoteReady) {
      const saved = await runRemoteMutation("Review landing page refreshed", () => publishApprovedReview(sub), {
        type: "Review",
        detail: `${sub?.title || "Review"} published/refreshed on ${reviewTargetLabels(sub)}.`,
        preserveScroll: true
      });
      if (saved && progress) {
        progress.done("Review published", "The review is live on these destinations.", { items: reviewTargetLabelList(sub) });
      } else if (!saved && progress) {
        progress.fail("Review not saved", "The live save did not complete. Please retry before leaving this screen.", { items: reviewTargetLabelList(sub) });
        publishReview.disabled = false;
      }
      else publishReview.disabled = false;
    } else if (sub) {
      sub.status = "Approved";
      saveState("Review published");
    }
    return;
  }
  const deleteReview = event.target.closest("[data-delete-review]");
  if (deleteReview) {
    const sub = state.submissions.find(s => s.id === deleteReview.dataset.deleteReview);
    if (!sub || !window.confirm(`Move this review from ${sub.reviewerName || "the reviewer"} to Deleted?`)) return;
    deleteReview.disabled = true;
    if (remoteReady) {
      const saved = await runRemoteMutation("Published review deleted", () => deletePublishedReview(sub), {
        type: "Review",
        detail: `${sub?.title || "Review"} deleted from public display and moved to Deleted.`
      });
      if (saved) showActionConfirmation("Review deleted", "The review was removed from public display and moved to the Deleted tab.");
      else deleteReview.disabled = false;
    } else {
      sub.status = "Deleted";
      saveState("Review moved to Deleted");
    }
    return;
  }
  const unpublishReview = event.target.closest("[data-unpublish-review]");
  if (unpublishReview) {
    const sub = state.submissions.find(s => s.id === unpublishReview.dataset.unpublishReview);
    unpublishReview.disabled = true;
    const selectedDestinations = reviewTargetLabelList(sub);
    const progress = remoteReady
      ? showActionProgress("Unpublishing review", "Removing this review from public display.", { items: selectedDestinations })
      : null;
    if (remoteReady) {
      const saved = await runRemoteMutation("Review unpublished", () => unpublishApprovedReview(sub, "Unpublished"), {
        type: "Review",
        detail: `${sub?.title || "Review"} unpublished from ${reviewTargetLabels(sub)}.`,
        preserveScroll: true
      });
      if (saved && progress) {
        progress.done("Review unpublished", "The review was removed from public display. These selected destinations were kept for the next publish.", { items: selectedDestinations });
      } else if (!saved && progress) {
        progress.fail("Review still published", "The live save did not complete. Please retry before leaving this screen.", { items: selectedDestinations });
      }
      else unpublishReview.disabled = false;
    } else if (sub) {
      sub.status = "Unpublished";
      saveState("Review unpublished");
    }
    return;
  }
  const archiveReview = event.target.closest("[data-archive-review]");
  if (archiveReview) {
    const sub = state.submissions.find(s => s.id === archiveReview.dataset.archiveReview);
    archiveReview.disabled = true;
    if (remoteReady) {
      const saved = await runRemoteMutation("Review archived", () => unpublishApprovedReview(sub, "Archived"), {
        type: "Review",
        detail: `${sub?.title || "Review"} archived from active review lists.`
      });
      if (saved) showActionConfirmation("Review archived", "The review was removed from active review lists and moved to Archive.");
      else archiveReview.disabled = false;
    } else if (sub) {
      sub.status = "Archived";
      saveState("Review archived");
    }
    return;
  }
  const restoreReview = event.target.closest("[data-restore-review]");
  if (restoreReview) {
    const sub = state.submissions.find(s => s.id === restoreReview.dataset.restoreReview);
    if (sub) sub.status = "Pending";
    restoreReview.disabled = true;
    if (remoteReady) {
      const saved = await runRemoteMutation("Review restored to pending", () => persistSubmissionRecord(sub), {
        type: "Review",
        detail: `${sub?.title || "Review"} restored to pending review.`
      });
      if (!saved) restoreReview.disabled = false;
    }
    else saveState("Review restored to pending");
    return;
  }
  const addReviewTarget = event.target.closest("[data-add-review-target]");
  if (addReviewTarget) {
    const sub = state.submissions.find(s => s.id === addReviewTarget.dataset.addReviewTarget);
    if (!sub) return;
    const target = pendingReviewTargetSelection(sub);
    if (!target) return;
    const previousTargets = reviewTargetsFor(sub, { allowEmpty: true });
    if (previousTargets.includes(target)) {
      showToast("That destination is already selected for this review.");
      return;
    }
    addReviewTarget.disabled = true;
    setReviewTargets(sub, [...previousTargets, target]);
    if (remoteReady) {
      const saved = await runRemoteMutation(
        "Review assignment saved",
        () => sub.status === "Approved" ? publishApprovedReview(sub) : saveReviewDestinations(sub, false),
        { preserveScroll: true }
      );
      if (saved) showActionConfirmation("Review destination added", sub.status === "Approved" ? `This review is now live on: ${reviewTargetLabels(sub)}.` : `This review can now publish to: ${reviewTargetLabels(sub)}.`);
      else {
        setReviewTargets(sub, previousTargets, { allowEmpty: true });
        addReviewTarget.disabled = false;
      }
    } else {
      saveState("Review assignment saved");
    }
    return;
  }
  const removeReviewTarget = event.target.closest("[data-remove-review-target]");
  if (removeReviewTarget) {
    const sub = state.submissions.find(s => s.id === removeReviewTarget.dataset.removeReviewTarget);
    if (!sub) return;
    const target = removeReviewTarget.dataset.reviewTarget;
    const previousTargets = reviewTargetsFor(sub, { allowEmpty: true });
    const nextTargets = previousTargets.filter(item => item !== target);
    removeReviewTarget.disabled = true;
    setReviewTargets(sub, nextTargets, { allowEmpty: true });
    if (remoteReady) {
      const saved = await runRemoteMutation(
        "Review destination removed",
        () => sub.status === "Approved"
          ? (nextTargets.length ? publishApprovedReview(sub) : unpublishApprovedReview(sub, "Unpublished"))
          : saveReviewDestinations(sub, false, { allowEmpty: true }),
        { preserveScroll: true }
      );
      if (saved) showActionConfirmation("Review destination removed", `Current destinations: ${reviewTargetLabels(sub)}.`);
      else {
        setReviewTargets(sub, previousTargets, { allowEmpty: true });
        removeReviewTarget.disabled = false;
      }
    } else {
      saveState("Review destination removed");
    }
    return;
  }
  const trainerReviewMove = event.target.closest("[data-trainer-review-move]");
  if (trainerReviewMove) {
    const trainer = findTrainer(trainerReviewMove.dataset.trainerReviewMove);
    const reviews = Array.isArray(trainer?.approvedReviews) ? trainer.approvedReviews : [];
    const index = reviews.findIndex((review, reviewIndex) => reviewKeyFor(review, reviewIndex) === trainerReviewMove.dataset.reviewKey);
    const direction = Number(trainerReviewMove.dataset.direction || 0);
    const nextIndex = index + direction;
    if (!trainer || index < 0 || nextIndex < 0 || nextIndex >= reviews.length) return;
    const reordered = [...reviews];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    trainer.approvedReviews = reordered;
    if (remoteReady) {
      await runRemoteMutation("Trainer review order saved", () => persistTrainerRecord(trainer, {
        skipProfile: true,
        publish: trainer.pageStatus === "Published" && trainer.locked
      }), {
        type: "Review",
        detail: `${trainer.name} review placement order was updated by ${currentActorLabel()}.`
      });
    } else {
      saveState("Trainer review order saved");
    }
    return;
  }
  const trainerReviewRemove = event.target.closest("[data-trainer-review-remove]");
  if (trainerReviewRemove) {
    const trainer = findTrainer(trainerReviewRemove.dataset.trainerReviewRemove);
    const reviews = Array.isArray(trainer?.approvedReviews) ? trainer.approvedReviews : [];
    const index = reviews.findIndex((review, reviewIndex) => reviewKeyFor(review, reviewIndex) === trainerReviewRemove.dataset.reviewKey);
    if (!trainer || index < 0) return;
    const review = reviews[index];
    const sub = submissionForApprovedReview(review);
    if (sub) {
      const nextTargets = reviewTargetsFor(sub, { allowEmpty: true }).filter(target => target !== trainer.id);
      setReviewTargets(sub, nextTargets, { allowEmpty: true });
      if (remoteReady) {
        const saved = await runRemoteMutation("Trainer review placement removed", () =>
          nextTargets.length ? publishApprovedReview(sub) : unpublishApprovedReview(sub, "Unpublished"), {
            type: "Review",
            detail: `${sub.title || "Review"} was removed from ${trainer.name}'s landing page.`
          });
        if (saved) showActionConfirmation("Review placement removed", nextTargets.length ? `Still saved to: ${reviewTargetLabels(sub)}.` : "The review is no longer published anywhere.");
      } else {
        trainer.approvedReviews = reviews.filter((_, reviewIndex) => reviewIndex !== index);
        saveState("Trainer review placement removed");
      }
      return;
    }
    trainer.approvedReviews = reviews.filter((_, reviewIndex) => reviewIndex !== index);
    if (remoteReady) {
      await runRemoteMutation("Trainer review placement removed", () => persistTrainerRecord(trainer, {
        skipProfile: true,
        publish: trainer.pageStatus === "Published" && trainer.locked
      }), {
        type: "Review",
        detail: `Manual review placement removed from ${trainer.name}.`
      });
    } else {
      saveState("Trainer review placement removed");
    }
    return;
  }
  const openSubmission = event.target.closest("[data-open-submission-media]");
  if (openSubmission) {
    openSubmissionMedia(state.submissions.find(item => item.id === openSubmission.dataset.openSubmissionMedia));
    return;
  }
  const openSubmissionDetail = event.target.closest("[data-open-submission-detail]");
  if (openSubmissionDetail) {
    state.selectedSubmissionId = openSubmissionDetail.dataset.openSubmissionDetail;
    saveState();
    return;
  }
  if (event.target.closest("[data-close-submission]")) {
    state.selectedSubmissionId = "";
    saveState();
    return;
  }
  if (event.target.closest("[data-export-applications]")) {
    exportApplicationsCsv();
    showToast("Trainer applications CSV downloaded for Google Sheet backfill");
    return;
  }
  const operationalExport = event.target.closest("[data-export-operational]");
  if (operationalExport) {
    exportOperationalSheet(operationalExport.dataset.exportOperational);
    showToast(`${operationalExport.dataset.exportOperational} CSV downloaded`);
    return;
  }
  const decline = event.target.closest("[data-decline-submission]");
  if (decline) {
    const sub = state.submissions.find(s => s.id === decline.dataset.declineSubmission);
    if (sub) sub.status = "Declined";
    decline.disabled = true;
    if (remoteReady) {
      const saved = await runRemoteMutation("Submission declined", () => persistSubmissionRecord(sub), {
        type: "Review",
        detail: `${sub?.title || "Submission"} declined by ${currentActorLabel()}.`
      });
      if (!saved) decline.disabled = false;
    }
    else saveState("Submission declined");
    return;
  }
  const openApplication = event.target.closest("[data-open-application]");
  if (openApplication) {
    state.selectedApplicationId = openApplication.dataset.openApplication;
    saveState();
    return;
  }
  if (event.target.closest("[data-close-application]")) {
    state.selectedApplicationId = "";
    saveState();
    return;
  }
  const archiveApplication = event.target.closest("[data-archive-application]");
  if (archiveApplication) {
    const application = applicationRows().find(item => item.id === archiveApplication.dataset.archiveApplication);
    state.selectedApplicationId = "";
    if (application && remoteReady) runRemoteMutation("Application archived; history preserved", () => window.LDTT_PORTAL.operationalMutation({
      operation: "archive",
      entity_type: "application",
      id: application.remoteId,
      expected_version: application.version,
      expected_updated_at: application.updatedAt,
      summary: `${applicationDisplayName(application)} archived`
    }), { type: "Application", detail: `${applicationDisplayName(application)} archived by ${currentActorLabel()}.` });
    else saveState("Application archived; history preserved");
    return;
  }
  const openClient = event.target.closest("[data-open-client]");
  if (openClient) {
    state.selectedClientId = openClient.dataset.openClient;
    saveState();
    return;
  }
  if (event.target.closest("[data-close-client]")) {
    state.selectedClientId = "";
    saveState();
    return;
  }
  const saveClient = event.target.closest("[data-save-client]");
  if (saveClient) {
    const client = state.clients.find(item => item.id === saveClient.dataset.saveClient);
    if (remoteReady) runRemoteMutation("Client record saved", () => persistClientRecord(client), {
      type: "Client",
      detail: `${client?.name || "Client"} record was saved by ${currentActorLabel()}.`
    });
    else saveState("Client record saved");
    return;
  }
  const archiveClient = event.target.closest("[data-archive-client]");
  if (archiveClient) {
    const client = state.clients.find(item => item.id === archiveClient.dataset.archiveClient);
    state.selectedClientId = "";
    if (client && remoteReady) runRemoteMutation("Client archived; history preserved", () => window.LDTT_PORTAL.operationalMutation({
      operation: "archive",
      entity_type: "client",
      id: client.remoteId,
      expected_version: client.version,
      expected_updated_at: client.updatedAt,
      summary: `${client.name || "Client"} archived`
    }), { type: "Client", detail: `${client.name || "Client"} archived by ${currentActorLabel()}.` });
    else saveState("Client archived; history preserved");
    return;
  }
  if (event.target.id === "submitDemoContent") {
    const type = document.querySelector('[name="submission-type"]')?.value || "Photo";
    const title = document.querySelector('[name="submission-title"]')?.value.trim();
    const note = document.querySelector('[name="submission-note"]')?.value || "Submitted by trainer for office approval.";
    const reviewText = document.querySelector('[name="submission-review-text"]')?.value.trim() || "";
    const file = document.querySelector('[name="submission-file"]')?.files?.[0];
    const reviewVideoUrl = normalizeVideoUrl(document.querySelector('[name="submission-video-url"]')?.value || "");
    if (!title) {
      showToast("Add a title before submitting");
      return;
    }
    if (!["Review", "Testimonial"].includes(type) && !file) {
      showToast("Choose a photo or video to submit");
      return;
    }
    if (["Review", "Testimonial"].includes(type) && !reviewText && !file && !reviewVideoUrl) {
      showToast("Add review text, a photo/video, or a supported video link");
      return;
    }
    if (file && file.size > 25 * 1024 * 1024) {
      showToast("Please choose a review file smaller than 25 MB or paste a video link");
      return;
    }
    const finalizeSubmission = async contentUrl => {
      const submission = { id: `sub-${Date.now()}`, trainerId: currentTrainerId(), type, title, note, reviewText, contentUrl: contentUrl || reviewVideoUrl || "", fileName: file?.name || (reviewVideoUrl ? `${videoProviderLabel(reviewVideoUrl)} video link` : ""), fileType: file?.type || (reviewVideoUrl ? "video/embed" : ""), submittedAt: new Date().toISOString(), status: "Pending" };
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
            file_url: storedPath || reviewVideoUrl || null,
            notes: ["Review", "Testimonial"].includes(type)
              ? [`Trainer portal review submission for ${trainer.name}.`, note ? `Submitted note: ${note}.` : "", reviewVideoUrl && !file ? `Attached video link: ${reviewVideoUrl} (video/embed).` : "", `Review: ${reviewText}`].filter(Boolean).join("\n")
              : note || null,
            status: "pending"
          });
        }, {
          type: "Submission",
          detail: `${trainer?.name || "Trainer"} submitted ${type.toLowerCase()} content titled "${title}" for office review.`
        });
      } else {
        saveState("Content submitted for admin review");
      }
    };
    if (file) {
      readSubmissionFile(file).then(finalizeSubmission).catch(() => showToast("The selected file could not be read"));
    } else {
      finalizeSubmission(reviewVideoUrl);
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
      await runRemoteMutation(`${importedClients.length} client records imported`, async () => {
        const source = document.getElementById("importSource")?.value || importedClients[0]?.importedSource || "Spreadsheet";
        const batch = (await window.LDTT_PORTAL.insert("client_import_batches", {
          imported_source: source.toLowerCase(),
          file_name: document.getElementById("clientImportFile")?.files?.[0]?.name || "pasted-client-data.csv",
          row_count: rowsToImport.length,
          status: "preview"
        }))?.[0];
        for (const client of importedClients) await persistClientRecord(client);
        if (batch?.id) {
          const auditRows = rowsToImport.map(row => ({
            batch_id: batch.id,
            raw_payload: row,
            action: String(row.action || "Create").toLowerCase(),
            warnings: row.warnings || [],
            imported_client_id: importedClients.find(client => sameContact(client, row))?.remoteId || null
          }));
          if (auditRows.length) await window.LDTT_PORTAL.insert("client_import_rows", auditRows);
          await window.LDTT_PORTAL.update("client_import_batches", batch.id, { status: "imported" });
        }
      }, {
        type: "Import",
        detail: `${importedClients.length} client records imported from ${document.getElementById("importSource")?.value || "Spreadsheet"} by ${currentActorLabel()}.`
      });
    } else {
      saveState("Clients imported into the office client database");
    }
    return;
  }
  if (event.target.id === "addTrainer") {
    const trainer = createOfficeTrainerDraft();
    state.trainers.unshift(trainer);
    state.selectedTrainerId = trainer.id;
    state.activeView = "trainers";
    state.onboardingStep = 1;
    if (remoteReady) runRemoteMutation("Trainer created as office draft", () => persistTrainerRecord(trainer), {
      type: "Trainer Page",
      detail: `${trainer.name} was created as an office-controlled draft.`
    });
    else saveState("Trainer created as office draft");
    return;
  }
  if (event.target.id === "saveTrainerProfile") {
    if (isMediaUploadActive()) {
      showToast("Wait for the video upload to finish before saving.");
      return;
    }
    if (remoteReady) {
      const trainer = trainerById();
      runRemoteMutation("Trainer profile and page draft saved by office", () => persistTrainerRecord(trainer), {
        type: "Trainer Profile",
        detail: `${trainer?.name || "Trainer"} profile and landing-page draft saved by ${currentActorLabel()}.`
      });
    }
    else saveState("Trainer profile saved by office");
    return;
  }
  const editorSave = event.target.closest("[data-editor-save]");
  if (editorSave) {
    if (isMediaUploadActive()) {
      showToast("Wait for the video upload to finish before saving or publishing.");
      return;
    }
    if (state.builderSurface !== "trainer") {
      persistStateSnapshot();
      showToast("Builder workspace changes saved");
      return;
    }
    const publish = editorSave.dataset.editorSave === "publish";
    const trainer = trainerById();
    trainer.pageStatus = publish ? "Published" : "Draft";
    trainer.locked = publish;
    const ok = await runRemoteMutation(publish ? "Trainer page published and locked" : "Trainer page draft saved", () => publishTrainerPageWorkflow(trainer, publish), {
      type: "Trainer Page",
      detail: `${trainer.name} landing page ${publish ? "published and locked" : "saved as draft"} from the page editor.`
    });
    if (ok && publish) showTrainerInviteDialog(findTrainer(trainer.remoteId || trainer.id) || trainer);
    return;
  }
  const builderTab = event.target.closest("[data-builder-tab]");
  if (builderTab) {
    state.builderTab = builderTab.dataset.builderTab;
    saveState();
    return;
  }
  const builderMode = event.target.closest("[data-builder-mode]");
  if (builderMode) {
    state.builderMode = builderMode.dataset.builderMode;
    saveState();
    return;
  }
  const builderDevice = event.target.closest("[data-builder-device]");
  if (builderDevice) {
    state.builderDevice = builderDevice.dataset.builderDevice;
    saveState();
    return;
  }
  const removeEdit = event.target.closest("[data-remove-live-edit]");
  if (removeEdit) {
    removeLiveEdit(Number(removeEdit.dataset.removeLiveEdit));
    return;
  }
  if (event.target.closest("[data-reset-live-edits]")) {
    const trainer = trainerById();
    setActiveBuilderEdits([]);
    if (state.builderSurface === "trainer") {
      trainer.pageStatus = "Draft";
      trainer.locked = false;
    }
    recordActivity("All live builder edits reset", `${currentActorLabel()} cleared custom builder edits for ${trainer?.name || "the selected page"}.`, "Page Editor");
    saveState("All live builder edits reset");
    return;
  }
  const moveSection = event.target.closest("[data-section-move]");
  if (moveSection) {
    const trainer = trainerById();
    trainer.sectionOrder = trainer.sectionOrder || ["hero", "stats", "services", "trainer", "reviews", "consultation"];
    const index = trainer.sectionOrder.indexOf(moveSection.dataset.sectionMove);
    const nextIndex = index + Number(moveSection.dataset.direction);
    if (index >= 0 && nextIndex >= 0 && nextIndex < trainer.sectionOrder.length) {
      const [section] = trainer.sectionOrder.splice(index, 1);
      trainer.sectionOrder.splice(nextIndex, 0, section);
      markBuilderDraftDirty("Section order saved to draft", `${trainer.name} section "${section}" was moved in the landing-page builder.`);
      render();
    }
    return;
  }
  const useMedia = event.target.closest("[data-use-media]");
  if (useMedia) {
    const trainer = trainerById();
    if (!state.builderSelectedSelector) {
      showToast("Select an image, video, or section in the preview first.");
      return;
    }
    const type = useMedia.dataset.mediaKind === "video" ? "video" : "img";
    upsertLiveEdit(trainer, { t: type, k: state.builderSelectedSelector, v: useMedia.dataset.useMedia, label: "Selected media replacement" });
    refreshPageEditorPreview();
    recordActivity("Media applied to selected element", `${trainer.name} media was applied to ${state.builderSelectedSelector}.`, "Page Editor");
    showToast("Media applied to selected element");
    return;
  }
  if (event.target.closest("[data-apply-embed-video]")) {
    const trainer = trainerById();
    const field = document.querySelector("[data-builder-embed-url]");
    const url = normalizeVideoUrl(field?.value);
    if (!url) {
      showToast("Paste a video URL first.");
      return;
    }
    if (!state.builderSelectedSelector) {
      trainer.trainerVideoUrl = url;
      trainer.mediaLibrary = Array.isArray(trainer.mediaLibrary) ? trainer.mediaLibrary : [];
      trainer.mediaLibrary.unshift({ type: "video", url, name: `${videoProviderLabel(url)} trainer video`, size: 0, uploadedAt: new Date().toISOString() });
      refreshPageEditorPreview();
      markBuilderDraftDirty("Trainer video link saved", `${trainer.name} trainer video was set from ${videoProviderLabel(url)}.`);
      field.value = "";
      render();
      return;
    }
    upsertLiveEdit(trainer, { t: "video", k: state.builderSelectedSelector, v: url, label: "External video embed" });
    trainer.mediaLibrary = Array.isArray(trainer.mediaLibrary) ? trainer.mediaLibrary : [];
    trainer.mediaLibrary.unshift({ type: "video", url, name: `${videoProviderLabel(url)} external video`, size: 0, uploadedAt: new Date().toISOString() });
    refreshPageEditorPreview();
    recordActivity("Video added to builder draft", `${trainer.name} external video was attached to ${state.builderSelectedSelector}.`, "Page Editor");
    showToast("Video added to builder draft");
    return;
  }
  if (event.target.closest("[data-apply-main-video-url]")) {
    const trainer = trainerById();
    const source = event.target.closest(".trainer-video-upload-card, .editor-video-card") || document;
    const field = source.querySelector("[data-main-trainer-video-url]");
    const url = normalizeVideoUrl(field?.value);
    if (!url) {
      showToast("Paste a video URL first.");
      return;
    }
    trainer.trainerVideoUrl = url;
    trainer.mediaLibrary = Array.isArray(trainer.mediaLibrary) ? trainer.mediaLibrary : [];
    trainer.mediaLibrary.unshift({ type: "video", url, name: `${videoProviderLabel(url)} trainer video`, size: 0, uploadedAt: new Date().toISOString() });
    refreshPageEditorPreview();
    if (remoteReady) {
      await runRemoteMutation("Trainer video link saved", () => persistTrainerRecord(trainer, { persistProfile: true }), {
        type: "Trainer Video",
        detail: `${trainer.name} trainer video was set from ${videoProviderLabel(url)} by ${currentActorLabel()}.`
      });
    } else {
      saveState("Trainer video link saved");
    }
    render();
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
    persistStateSnapshot();
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
    persistStateSnapshot();
    return;
  }
  if (field.dataset.builderEmbedUrl !== undefined) {
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
    if (key === "name") trainer.profileName = field.value;
    if (key === "email") trainer.profileEmail = field.value;
    if (key === "phone") trainer.profilePhone = field.value;
    if (key === "market") trainer.profileMarket = field.value;
    if (key === "state") trainer.profileState = field.value;
    if (key === "serviceArea") trainer.profileServiceArea = field.value;
    if (key === "specialtiesText") trainer.specialties = field.value.split(/\n|,/).map(value => value.trim()).filter(Boolean);
    if (key === "credentialsText") trainer.credentials = field.value.split(/\n|,/).map(value => value.trim()).filter(Boolean);
    refreshDraftTrainerIdentity(trainer, key);
    saveState(null, true);
  }
  if (field.dataset.profileField) {
    const trainer = trainerById();
    trainer[field.dataset.profileField] = field.value;
    refreshDraftTrainerIdentity(trainer, field.dataset.profileField);
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
  if (field.dataset.trainerSocialLink) {
    const trainer = trainerById(currentTrainerId());
    if (trainer) {
      trainer.socials = { ...(trainer.socials || {}), [field.dataset.trainerSocialLink]: field.value.trim() };
      scheduleRemoteSave(`trainer-socials-${trainer.id}`, () => persistTrainerSocialRecord(trainer));
      saveState(null, true);
    }
  }
  if (field.dataset.submissionNote) {
    const submission = state.submissions.find(item => item.id === field.dataset.submissionNote);
    if (submission) {
      submission.note = field.value;
      scheduleRemoteSave(`submission-${submission.id}`, () => persistSubmissionRecord(submission));
      saveState(null, true);
    }
  }
  if (field.dataset.clientNote) {
    const client = state.clients.find(item => item.id === field.dataset.clientNote);
    if (client) {
      client.notes = field.value;
      scheduleRemoteSave(`client-${client.id}`, () => persistClientRecord(client));
      saveState(null, true);
    }
  }
  if (field.dataset.leadSearch !== undefined) { state.leadSearch = field.value; scheduleLeadFilterRender(); }
  if (field.dataset.applicationSearch !== undefined) { state.applicationSearch = field.value; scheduleApplicationFilterRender(); }
  if (field.dataset.clientSearch !== undefined) { state.clientSearch = field.value; scheduleClientFilterRender(); }
  if (field.id === "csvInput") {
    state.importDraft = field.value;
    saveState(null, true);
  }
  if (field.name === "lead-custom-start") {
    state.customLeadStart = field.value;
    state.leadDateRange = "custom";
    scheduleLeadFilterRender();
  }
  if (field.name === "lead-custom-end") {
    state.customLeadEnd = field.value;
    state.leadDateRange = "custom";
    scheduleLeadFilterRender();
  }
  if (field.name === "report-custom-start") {
    state.customReportStart = field.value;
    state.reportDateRange = "custom";
    saveState(null);
  }
  if (field.name === "report-custom-end") {
    state.customReportEnd = field.value;
    state.reportDateRange = "custom";
    saveState(null);
  }
});

document.addEventListener("change", async event => {
  if (event.target.id === "clientImportFile" && event.target.files?.[0]) {
    const file = event.target.files[0];
    const status = document.getElementById("importFileStatus");
    if (status) status.textContent = `Reading ${file.name}...`;
    try {
      state.importDraft = await importFileToCsv(file);
      state.importedPreview = parseCsv(state.importDraft);
      if (status) status.textContent = `${file.name} loaded. Review ${state.importedPreview.length} detected rows before confirming.`;
      saveState(`${state.importedPreview.length} client rows ready for review`);
    } catch (error) {
      if (status) status.textContent = `Could not read ${file.name}: ${error.message}`;
      showToast(`Client file could not be read: ${error.message}`);
    }
    return;
  }
  const reviewSort = event.target.closest("[data-review-sort]");
  if (reviewSort) {
    state.reviewSort = reviewSort.value;
    saveState();
    return;
  }
  const portalRoleField = event.target.closest("[data-portal-role]");
  if (portalRoleField) {
    if (!isSuperAdmin()) {
      showToast("Only Super Admins can change portal permissions.");
      render();
      return;
    }
    const user = findPortalAccessUser(portalRoleField.dataset.portalRole);
    if (!user) {
      showToast("Portal user record could not be found.");
      render();
      return;
    }
    const nextPermission = portalRoleField.value;
    if (nextPermission === "trainer" && !user.trainer_id) {
      showToast("Trainer access needs a linked trainer profile first.");
      render();
      return;
    }
    const payload = nextPermission === "trainer"
      ? { role: "trainer", permission_level: "trainer" }
      : { role: "admin", trainer_id: null, permission_level: nextPermission };
    Object.assign(user, payload);
    touchCurrentPortalUser(user, payload);
    await runRemoteMutation("Portal permission updated", () => persistPortalUserRecord(user, payload), {
      type: "Security",
      detail: `${portalDisplayName(user)} changed to ${portalPermissionLabel(nextPermission)}.`
    });
    return;
  }
  const portalNameField = event.target.closest("[data-portal-display-name]");
  if (portalNameField) {
    if (!isSuperAdmin()) {
      showToast("Only Super Admins can edit other portal profiles.");
      render();
      return;
    }
    const user = findPortalAccessUser(portalNameField.dataset.portalDisplayName);
    if (!user || isDerivedPortalUser(user)) {
      showToast("Create the live portal account before editing the profile.");
      render();
      return;
    }
    const displayName = portalNameField.value.trim() || portalDisplayName(user);
    const payload = { display_name: displayName };
    Object.assign(user, payload);
    touchCurrentPortalUser(user, payload);
    await runRemoteMutation("Portal profile name updated", () => persistPortalUserRecord(user, payload), {
      type: "Profile",
      detail: `${portalDisplayName(user)} profile name saved.`
    });
    return;
  }
  const portalPhotoUpload = event.target.closest("[data-portal-photo-upload]");
  if (portalPhotoUpload?.files?.[0]) {
    if (!isSuperAdmin()) {
      showToast("Only Super Admins can edit other portal profile photos.");
      portalPhotoUpload.value = "";
      return;
    }
    const user = findPortalAccessUser(portalPhotoUpload.dataset.portalPhotoUpload);
    if (!user || isDerivedPortalUser(user)) {
      showToast("Create the live portal account before uploading a profile photo.");
      portalPhotoUpload.value = "";
      return;
    }
    const file = portalPhotoUpload.files[0];
    try {
      const url = await uploadPortalUserPhoto(user, file);
      const payload = { profile_photo_url: url };
      Object.assign(user, payload);
      touchCurrentPortalUser(user, payload);
      await runRemoteMutation("Portal profile photo updated", () => persistPortalUserRecord(user, payload), {
        type: "Profile",
        detail: `${portalDisplayName(user)} profile photo saved.`
      });
    } catch (error) {
      showToast(`Profile photo could not be uploaded: ${error.message}`);
    } finally {
      portalPhotoUpload.value = "";
    }
    return;
  }
  if (event.target.dataset.editorTrainer !== undefined) {
    state.selectedTrainerId = event.target.value;
    saveState();
    return;
  }
  if (event.target.dataset.builderPage !== undefined) {
    state.builderPage = event.target.value;
    state.builderSelectedSelector = "";
    saveState();
    return;
  }
  if (event.target.dataset.builderMainPage !== undefined) {
    state.builderMainPage = event.target.value;
    state.builderSelectedSelector = "";
    saveState();
    return;
  }
  if (event.target.dataset.builderPortalView !== undefined) {
    state.builderPortalView = event.target.value;
    state.builderSelectedSelector = "";
    saveState();
    return;
  }
  if (event.target.dataset.builderSurface !== undefined) {
    state.builderSurface = event.target.value;
    state.builderSelectedSelector = "";
    state.builderMode = "browse";
    saveState();
    return;
  }
  const sectionVisible = event.target.closest("[data-section-visible]");
  if (sectionVisible) {
    const trainer = trainerById();
    trainer.hiddenSections = Array.isArray(trainer.hiddenSections) ? trainer.hiddenSections : [];
    const section = sectionVisible.dataset.sectionVisible;
    trainer.hiddenSections = sectionVisible.checked
      ? trainer.hiddenSections.filter(item => item !== section)
      : Array.from(new Set([...trainer.hiddenSections, section]));
    markBuilderDraftDirty("Section visibility saved to draft", `${trainer.name} section "${section}" was ${sectionVisible.checked ? "shown" : "hidden"} in the page editor.`);
    render();
    return;
  }
  if (event.target.dataset.editorField !== undefined) {
    const trainer = trainerById();
    if (!trainer) return;
    trainer[event.target.dataset.editorField] = event.target.value;
    trainer.pageStatus = "Draft";
    trainer.locked = false;
    persistStateSnapshot();
    refreshPageEditorPreview();
    scheduleRemoteSave(`builder-${trainer.id}`, () => persistTrainerRecord(trainer), 900);
    recordActivity("Page editor field changed", `${trainer.name} field "${event.target.dataset.editorField}" was updated in the page editor.`, "Page Editor");
    return;
  }
  if (event.target.dataset.editorStyle !== undefined) {
    const trainer = trainerById();
    if (!trainer) return;
    trainer.styleSettings = { ...(trainer.styleSettings || {}), [event.target.dataset.editorStyle]: event.target.value };
    trainer.pageStatus = "Draft";
    trainer.locked = false;
    persistStateSnapshot();
    refreshPageEditorPreview();
    scheduleRemoteSave(`builder-${trainer.id}`, () => persistTrainerRecord(trainer), 900);
    recordActivity("Page style changed", `${trainer.name} style "${event.target.dataset.editorStyle}" was updated in the page editor.`, "Page Editor");
    return;
  }
  const editorUpload = event.target.closest("[data-editor-upload]");
  if (editorUpload?.files?.[0]) {
    const file = editorUpload.files[0];
    const trainer = trainerById();
    try {
      const slot = editorUpload.dataset.editorUpload;
      const uploaded = await uploadBuilderMedia(file, slot);
      if (!uploaded) return;
      if (slot === "selectedMedia") {
        if (!state.builderSelectedSelector) {
          showToast("Media uploaded. Select a preview element to place it.");
        } else {
          upsertLiveEdit(trainer, { t: uploaded.type === "video" ? "video" : "img", k: state.builderSelectedSelector, v: uploaded.url, label: "Selected media replacement" });
        }
      } else if (slot !== "mediaLibrary") {
        trainer[slot] = uploaded.url;
        if (slot === "profilePhoto") {
          trainer.publicPhoto = uploaded.url;
          trainer.cardPhoto = uploaded.url;
        }
      }
      trainer.pageStatus = "Draft";
      trainer.locked = false;
      refreshPageEditorPreview();
      markBuilderDraftDirty("Media uploaded and builder draft saved", `${trainer?.name || "Trainer"} uploaded ${file.name} to ${slot}.`);
    } catch (error) {
      showToast(`Media upload failed: ${error.message}`);
    }
    editorUpload.value = "";
    return;
  }
  if (event.target.dataset.leadSearch !== undefined) { state.leadSearch = event.target.value; persistStateSnapshot(); return; }
  if (event.target.dataset.applicationSearch !== undefined) { state.applicationSearch = event.target.value; persistStateSnapshot(); return; }
  if (event.target.dataset.clientSearch !== undefined) { state.clientSearch = event.target.value; persistStateSnapshot(); return; }
  const upload = event.target.closest("[data-trainer-upload]");
  if (upload && upload.files?.[0]) {
    const file = upload.files[0];
    const isTrainerVideoUpload = upload.dataset.trainerUpload === "trainerVideoUrl" || file.type.startsWith("video/");
    if (!isTrainerVideoUpload && file.size > 10_000_000) {
      showToast("Choose an image under 10 MB");
      upload.value = "";
      return;
    }
    const trainer = trainerById();
    if (remoteReady) {
      try {
        const uploaded = isTrainerVideoUpload
          ? await uploadBuilderMedia(file, upload.dataset.trainerUpload)
          : null;
        if (uploaded) {
          trainer[upload.dataset.trainerUpload] = uploaded.url;
        } else {
          const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
          const path = `${trainer.remoteId || slugify(trainer.name)}/${upload.dataset.trainerUpload}-${Date.now()}.${extension}`;
          await window.LDTT_PORTAL.upload("trainer-page-assets", path, file);
          trainer[upload.dataset.trainerUpload] = window.LDTT_PORTAL.publicStorageUrl("trainer-page-assets", path);
        }
        if (upload.dataset.trainerUpload === "profilePhoto") {
          trainer.publicPhoto = trainer.profilePhoto;
          trainer.cardPhoto = trainer.profilePhoto;
        }
        await runRemoteMutation("Image uploaded and trainer page draft saved", () => persistTrainerRecord(trainer, { persistProfile: upload.dataset.trainerUpload === "profilePhoto" }), {
          type: "Trainer Photo",
          detail: `${trainer.name} ${upload.dataset.trainerUpload} was replaced with ${file.name}.`
        });
      } catch (error) {
        showToast(`${isTrainerVideoUpload ? "Video" : "Image"} upload failed: ${error.message}`);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        trainer[upload.dataset.trainerUpload] = reader.result;
        if (upload.dataset.trainerUpload === "profilePhoto") {
          trainer.publicPhoto = trainer.profilePhoto;
          trainer.cardPhoto = trainer.profilePhoto;
        }
        recordActivity("Image uploaded to trainer setup preview", `${trainer.name} ${upload.dataset.trainerUpload} was replaced locally with ${file.name}.`, "Trainer Photo");
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
    recordActivity("Trainer social link updated", `${trainer.name} ${key} link was updated.`, "Trainer Profile");
    saveState("Trainer social status updated");
    return;
  }
  const statusField = event.target.closest("[data-lead-status]");
  if (statusField) {
    const lead = updateLeadRecord(statusField.dataset.leadStatus, { status: statusField.value });
    if (remoteReady) runRemoteMutation(
      conversionStatuses().includes(lead?.status) ? "Lead converted and client record saved" : "Lead status updated",
      () => persistLeadWorkflow(lead),
      {
        type: "Lead",
        detail: `${lead?.owner || "Lead"} moved to ${lead?.status || statusField.value}${lead?.trainer ? ` for ${lead.trainer}` : ""}.`
      }
    );
    else saveState("Lead status updated");
    return;
  }
  const officeAssignee = event.target.closest("[data-office-assignee]");
  if (officeAssignee) {
    const entityType = officeAssignee.dataset.officeAssignee;
    const recordId = officeAssignee.dataset.recordId;
    const entityLabel = entityType === "lead" ? "Lead" : "Application";
    const assigneeLabel = officeAssignee.value ? portalActorLabel(officeAssignee.value) : "Unassigned";
    const record = entityType === "lead"
      ? updateLeadRecord(recordId, { assignedUserId: officeAssignee.value })
      : updateApplicationRecord(recordId, { assignedUserId: officeAssignee.value });
    const recordLabel = entityType === "lead"
      ? record?.owner || "Selected lead"
      : applicationDisplayName(record) || "Selected application";
    const save = entityType === "lead" ? persistLeadRecord : persistApplicationRecord;
    if (remoteReady) {
      officeAssignee.disabled = true;
      const assignmentItems = [
        recordLabel,
        officeAssignee.value ? `Assigned to ${assigneeLabel}` : "Unassigned"
      ];
      const progress = showActionProgress("Saving assignment", `Updating this ${entityLabel.toLowerCase()} owner in the live portal.`, { items: assignmentItems });
      const saved = await runRemoteMutation("Office owner saved", () => save(record), {
        type: entityLabel,
        detail: officeAssignee.value
          ? `${recordLabel} assigned to ${assigneeLabel} by ${currentActorLabel()}.`
          : `${recordLabel} unassigned by ${currentActorLabel()}.`
      });
      if (saved) {
        progress.done(
          officeAssignee.value ? `${entityLabel} assigned` : `${entityLabel} unassigned`,
          officeAssignee.value ? `${recordLabel} is now assigned to ${assigneeLabel}.` : `${recordLabel} is now unassigned.`,
          { items: assignmentItems }
        );
      } else {
        progress.fail("Assignment not saved", "The live save did not complete. Please retry before leaving this screen.", { items: assignmentItems });
        officeAssignee.disabled = false;
      }
    } else {
      saveState("Office owner updated");
      showActionConfirmation(
        officeAssignee.value ? `${entityLabel} assigned` : `${entityLabel} unassigned`,
        officeAssignee.value ? `${recordLabel} is now assigned to ${assigneeLabel}.` : `${recordLabel} is now unassigned.`
      );
    }
    return;
  }
  const leadFilter = event.target.closest("[data-lead-filter]");
  if (leadFilter) {
    const filterKey = leadFilter.dataset.leadFilter === "trainer"
      ? "leadTrainerFilter"
      : leadFilter.dataset.leadFilter === "sms"
        ? "leadSmsFilter"
        : leadFilter.dataset.leadFilter === "owner"
          ? "leadOwnerFilter"
          : "leadStatusFilter";
    state[filterKey] = leadFilter.value;
    saveState();
    return;
  }
  const followup = event.target.closest("[data-lead-followup]");
  if (followup) {
    const lead = updateLeadRecord(followup.dataset.leadFollowup, { followUpDate: followup.value });
    if (remoteReady) runRemoteMutation("Follow-up date saved", () => persistLeadRecord(lead), {
      type: "Lead",
      detail: `${lead?.owner || "Lead"} follow-up date set to ${followup.value || "not set"}.`
    });
    else saveState("Follow-up date saved");
    return;
  }
  const lostReason = event.target.closest("[data-lead-lost-reason]");
  if (lostReason) {
    const lead = updateLeadRecord(lostReason.dataset.leadLostReason, { lostReason: lostReason.value });
    if (remoteReady) runRemoteMutation("Lost reason saved", () => persistLeadRecord(lead), {
      type: "Lead",
      detail: `${lead?.owner || "Lead"} lost reason updated to "${lostReason.value || "none"}".`
    });
    else saveState("Lost reason saved");
    return;
  }
  const dnc = event.target.closest("[data-lead-dnc]");
  if (dnc) {
    const lead = updateLeadRecord(dnc.dataset.leadDnc, { doNotContact: dnc.checked, status: dnc.checked ? "Do Not Contact" : "Office Contacted" });
    if (remoteReady) runRemoteMutation("Contact protection updated", () => persistLeadRecord(lead), {
      type: "Lead",
      detail: `${lead?.owner || "Lead"} contact protection ${dnc.checked ? "enabled" : "removed"}.`
    });
    else saveState("Contact protection updated");
    return;
  }
  const applicationStatus = event.target.closest("[data-application-status]");
  if (applicationStatus) {
    const application = updateApplicationRecord(applicationStatus.dataset.applicationStatus, { status: applicationStatus.value });
    if (remoteReady) runRemoteMutation("Trainer application status updated", () => persistApplicationRecord(application), {
      type: "Application",
      detail: `${applicationDisplayName(application)} moved to ${application?.status || applicationStatus.value}.`
    });
    else saveState("Trainer application status updated");
    return;
  }
  const submissionNote = event.target.closest("[data-submission-note]");
  if (submissionNote) {
    const submission = state.submissions.find(item => item.id === submissionNote.dataset.submissionNote);
    if (submission) submission.note = submissionNote.value;
    if (remoteReady && submission?.remoteId) runRemoteMutation("Submission note saved", () => persistSubmissionRecord(submission), {
      render: false,
      type: "Review",
      detail: `${submission?.title || "Submission"} office note updated.`
    });
    else saveState(remoteReady ? "Submission note needs a shared record before it can save live" : "Submission note saved locally", true);
    return;
  }
  const reviewDisplay = event.target.closest("[data-review-display]");
  if (reviewDisplay) {
    const submission = state.submissions.find(item => item.id === reviewDisplay.dataset.reviewDisplay);
    if (submission) {
      submission.reviewDisplay = {
        ...reviewDisplayOptionsFor(submission),
        [reviewDisplay.dataset.reviewDisplayKey]: reviewDisplay.checked
      };
      recordActivity("Review display choice saved", `${submission.title || "Review"} display option "${reviewDisplay.dataset.reviewDisplayKey}" set to ${reviewDisplay.checked ? "show" : "hide"}.`, "Review");
      if (remoteReady && submission.status === "Approved") {
        await runRemoteMutation("Review display choice saved", () => publishApprovedReview(submission), {
          type: "Review",
          detail: `${submission.title || "Review"} display options republished to ${reviewTargetLabels(submission)}.`,
          preserveScroll: true
        });
      } else {
        saveState("Review display choice saved", true);
      }
    }
    return;
  }
  const clientStatus = event.target.closest("[data-client-status]");
  if (clientStatus) {
    const client = state.clients.find(item => item.id === clientStatus.dataset.clientStatus);
    if (client) client.status = clientStatus.value;
    recordActivity("Client status updated", `${client?.name || "Client"} status changed to ${clientStatus.value}.`, "Client");
    saveState("Client status updated");
    return;
  }
  const clientConsent = event.target.closest("[data-client-consent]");
  if (clientConsent) {
    const client = state.clients.find(item => item.id === clientConsent.dataset.clientConsent);
    const key = clientConsent.dataset.consentType === "sms" ? "smsConsent" : "emailConsent";
    if (client) client[key] = clientConsent.value;
    recordActivity("Client consent updated", `${client?.name || "Client"} ${key} changed to ${clientConsent.value}.`, "Client");
    saveState("Client consent updated");
    return;
  }
  const clientDateStarted = event.target.closest("[data-client-date-started]");
  if (clientDateStarted) {
    const client = state.clients.find(item => item.id === clientDateStarted.dataset.clientDateStarted);
    if (client) client.dateStarted = clientDateStarted.value;
    recordActivity("Client start date updated", `${client?.name || "Client"} start date set to ${clientDateStarted.value || "blank"}.`, "Client");
    saveState("Client start date updated");
    return;
  }
  const clientLastContacted = event.target.closest("[data-client-last-contacted]");
  if (clientLastContacted) {
    const client = state.clients.find(item => item.id === clientLastContacted.dataset.clientLastContacted);
    if (client) client.lastContacted = clientLastContacted.value;
    recordActivity("Client last-contacted date updated", `${client?.name || "Client"} last-contacted date set to ${clientLastContacted.value || "blank"}.`, "Client");
    saveState("Client last-contacted date updated");
    return;
  }
  const clientNote = event.target.closest("[data-client-note]");
  if (clientNote) {
    const client = state.clients.find(item => item.id === clientNote.dataset.clientNote);
    if (client) client.notes = clientNote.value;
    if (remoteReady && client?.remoteId) runRemoteMutation("Client note saved", () => persistClientRecord(client), {
      render: false,
      type: "Client",
      detail: `${client?.name || "Client"} note updated by ${currentActorLabel()}.`
    });
    else saveState(remoteReady ? "Client note needs a shared record before it can save live" : "Client note saved locally", true);
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
  if (event.target.name === "report-custom-start" || event.target.name === "report-custom-end") {
    state.reportDateRange = "custom";
    saveState("Custom report date range applied");
    return;
  }
  if (event.target.name?.startsWith("admin-trainer-")) {
    const trainer = trainerById();
    const key = event.target.name.replace("admin-trainer-", "");
    trainer[key] = key === "locked" ? event.target.value === "true" : event.target.value;
    if (key === "layout") trainer.pageStatus = trainer.pageStatus === "No Site Started" ? "Draft" : trainer.pageStatus;
    if (key === "name") trainer.profileName = event.target.value;
    if (key === "email") trainer.profileEmail = event.target.value;
    if (key === "phone") trainer.profilePhone = event.target.value;
    if (key === "market") trainer.profileMarket = event.target.value;
    if (key === "state") trainer.profileState = event.target.value;
    if (key === "serviceArea") trainer.profileServiceArea = event.target.value;
    refreshDraftTrainerIdentity(trainer, key);
    recordActivity("Trainer profile field updated", `${trainer.name} field "${key}" updated in office profile setup.`, "Trainer Profile");
    saveState("Trainer profile field updated");
  }
  if (event.target.dataset.profileField) {
    const trainer = trainerById();
    trainer[event.target.dataset.profileField] = event.target.value;
    refreshDraftTrainerIdentity(trainer, event.target.dataset.profileField);
    recordActivity("Trainer profile source field saved", `${trainer.name} source field "${event.target.dataset.profileField}" updated.`, "Trainer Profile");
    saveState("Trainer profile source field saved");
    return;
  }
});

let activePhotoFrameDrag = null;

function updatePhotoFrameFromPointer(frame, event) {
  const key = frame?.dataset?.photoPositionKey;
  const trainer = trainerById();
  if (!frame || !key || !trainer) return "";
  const rect = frame.getBoundingClientRect();
  if (!rect.width || !rect.height) return "";
  const x = clampNumber(Math.round(((event.clientX - rect.left) / rect.width) * 100), 0, 100);
  const y = clampNumber(Math.round(((event.clientY - rect.top) / rect.height) * 100), 0, 100);
  const position = `${x}% ${y}%`;
  trainer[key] = position;
  const img = frame.querySelector("img");
  if (img) img.style.objectPosition = position;
  return position;
}

document.addEventListener("pointerdown", event => {
  const frame = event.target.closest("[data-photo-frame-preview]");
  if (!frame || event.target.closest("input, select, textarea, button, a")) return;
  activePhotoFrameDrag = frame;
  frame.classList.add("is-dragging");
  frame.setPointerCapture?.(event.pointerId);
  updatePhotoFrameFromPointer(frame, event);
});

document.addEventListener("pointermove", event => {
  if (!activePhotoFrameDrag) return;
  updatePhotoFrameFromPointer(activePhotoFrameDrag, event);
});

document.addEventListener("pointerup", event => {
  if (!activePhotoFrameDrag) return;
  const frame = activePhotoFrameDrag;
  const position = updatePhotoFrameFromPointer(frame, event);
  frame.classList.remove("is-dragging");
  activePhotoFrameDrag = null;
  const trainer = trainerById();
  if (!trainer || !position) return;
  const select = document.querySelector(`select[data-editor-field="${CSS.escape(frame.dataset.photoPositionKey)}"], select[name="admin-trainer-${CSS.escape(frame.dataset.photoPositionKey)}"]`);
  if (select && !Array.from(select.options).some(option => option.value === position)) {
    select.insertAdjacentHTML("afterbegin", `<option value="${escapeHtml(position)}" selected>Custom drag position</option>`);
    select.value = position;
  }
  trainer.pageStatus = "Draft";
  trainer.locked = false;
  if (state.activeView === "pageEditor") {
    refreshPageEditorPreview();
    markBuilderDraftDirty("Photo frame position saved to draft");
  } else {
    saveState("Photo frame position updated");
  }
});

document.addEventListener("pointercancel", () => {
  if (!activePhotoFrameDrag) return;
  activePhotoFrameDrag.classList.remove("is-dragging");
  activePhotoFrameDrag = null;
});

let draggedLeadId = "";
let draggedApplicationId = "";
document.addEventListener("dragstart", event => {
  const leadCard = event.target.closest("[data-lead-card]");
  if (leadCard) {
    draggedLeadId = leadCard.dataset.leadCard;
    event.dataTransfer.effectAllowed = "move";
    return;
  }
  const applicationCard = event.target.closest("[data-application-card]");
  if (applicationCard) {
    draggedApplicationId = applicationCard.dataset.applicationCard;
    event.dataTransfer.effectAllowed = "move";
  }
});
document.addEventListener("dragover", event => { if (event.target.closest("[data-drop-status],[data-drop-application-status]")) event.preventDefault(); });
document.addEventListener("drop", event => {
  const applicationColumn = event.target.closest("[data-drop-application-status]");
  if (applicationColumn && draggedApplicationId) {
    event.preventDefault();
    const application = updateApplicationRecord(draggedApplicationId, { status: applicationColumn.dataset.dropApplicationStatus });
    draggedApplicationId = "";
  if (remoteReady) runRemoteMutation("Application moved to " + applicationColumn.dataset.dropApplicationStatus, () => persistApplicationRecord(application), {
    type: "Application",
    detail: `${applicationDisplayName(application)} was dragged to ${applicationColumn.dataset.dropApplicationStatus}.`
  });
    else saveState("Application moved to " + applicationColumn.dataset.dropApplicationStatus);
    return;
  }
  const column = event.target.closest("[data-drop-status]");
  if (!column || !draggedLeadId) return;
  event.preventDefault();
  const lead = updateLeadRecord(draggedLeadId, { status: column.dataset.dropStatus === "Lost" ? "Lost / No Response" : column.dataset.dropStatus });
  draggedLeadId = "";
  if (remoteReady) runRemoteMutation("Lead moved to " + column.dataset.dropStatus, () => persistLeadWorkflow(lead), {
    type: "Lead",
    detail: `${lead?.owner || "Lead"} was dragged to ${lead?.status || column.dataset.dropStatus}${lead?.trainer ? ` for ${lead.trainer}` : ""}.`
  });
  else saveState("Lead moved to " + column.dataset.dropStatus);
});

document.addEventListener("submit", async event => {
  event.preventDefault();
  if (event.target.classList.contains("office-lead-form")) {
    if (event.target.dataset.submitting === "true" || !event.target.reportValidity()) return;
    const submitButton = event.target.querySelector('button[type="submit"]');
    const formStatus = event.target.querySelector(".landing-form-status");
    const setLandingStatus = (message, type = "success") => {
      if (!formStatus) return;
      formStatus.className = `landing-form-status ${type}`;
      formStatus.textContent = message;
    };
    event.target.dataset.submitting = "true";
    submitButton?.setAttribute("disabled", "disabled");
    const trainerId = event.target.dataset.trainerId || currentTrainerId();
    const trainer = trainerById(trainerId);
    const entries = {
      ...formEntries(event.target),
      ...trainerAttribution(trainer, "trainer_form_submitted"),
      submission_id: `${isReleaseQaHost() ? "qa-release-" : "trainer-"}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      source_page: `trainer landing page: ${trainerName(trainerId)}`
    };
    if (entries.additional_interest) {
      entries.comments = [entries.comments, `Additional interest: ${entries.additional_interest}.`].filter(Boolean).join("\n\n");
    }
    setLandingStatus("Submitting securely...", "pending");
    try {
      const canonical = await submitToSupabase("submit-contact", entries);
      if (canonical?.skipped || (!canonical?.lead_id && !canonical?.application_id)) {
        throw new Error("The live office record could not be confirmed. Please try again.");
      }
      const relayResponse = await fetch("/api/form-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_type: "contact", entries, canonical })
      });
      const relay = await relayResponse.json().catch(() => ({}));
      if (!relayResponse.ok || relay.ok === false) throw new Error(relay.message || "The office backup delivery could not be logged.");
      if (relay.deliveries?.some(delivery => delivery.destination === "formsubmit_email" && delivery.status === "failed")) {
        try {
          await submitLandingEmail(entries, trainer);
          await recordClientFormDelivery(entries, canonical, "accepted");
        } catch (emailError) {
          await recordClientFormDelivery(entries, canonical, "failed", emailError.message || String(emailError)).catch(() => {});
        }
      }
      event.target.reset();
      setLandingStatus("Thank you. Your consultation request was submitted. Lorenzo's office has the details and will follow up with the next step.");
      showFormSuccessModal();
    } catch (error) {
      console.warn("LDTT canonical trainer-page submission failed", error);
      setLandingStatus(error.message || "We could not submit the form. Your information is still on this screen; please try again.", "error");
    } finally {
      delete event.target.dataset.submitting;
      submitButton?.removeAttribute("disabled");
    }
    return;
  }
  if (event.target.classList.contains("public-review-form")) {
    if (event.target.dataset.submitting === "true") return;
    if (!event.target.reportValidity()) return;
    const submitButton = event.target.querySelector('button[type="submit"]');
    const formStatus = event.target.querySelector(".public-review-status");
    const setReviewStatus = (message, type = "success") => {
      if (!formStatus) return;
      formStatus.className = `public-review-status ${type}`;
      formStatus.textContent = message;
    };
    const trainerId = event.target.dataset.trainerId || currentTrainerId();
    const trainer = trainerById(trainerId);
    const trainerLabel = trainerName(trainerId);
    const trainerSlug = trainer?.slug || trainer?.id || trainerId;
    const trainerMarket = trainer?.market || "Nationwide";
    const entries = formEntries(event.target);
    const file = event.target.querySelector('input[name="review_file"]')?.files?.[0] || null;
    const reviewVideoUrl = normalizeVideoUrl(entries.review_video_url || "");
    if (reviewVideoUrl) entries.review_video_url = reviewVideoUrl;
    if (file && file.size > 25 * 1024 * 1024) {
      setReviewStatus("Please upload a file under 25 MB for this review form. Larger training videos can be uploaded inside the portal media tools.", "error");
      return;
    }
    event.target.dataset.submitting = "true";
    submitButton?.setAttribute("disabled", "disabled");
    setReviewStatus("Submitting your review to Lorenzo's office...");
    try {
      const fileDataUrl = file ? await readSubmissionFile(file) : "";
      const localPreviewUrl = file && file.size <= 1024 * 1024 ? fileDataUrl : "";
      const submissionId = `public-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const submission = {
        id: submissionId,
        trainerId,
        reviewTargets: [trainerId || "lorenzos-team"],
        type: "Review",
        title: `Website review from ${entries.reviewer_name || "Client"}`,
        note: `Submitted from ${trainerLabel}'s public review form. Email: ${entries.reviewer_email || "not supplied"}. Star rating: ${entries.star_rating || "5"}. Permission to share: ${entries.permission_to_share || "no"}.`,
        starRating: entries.star_rating || "5",
        reviewText: entries.review_text || "",
        reviewerName: entries.reviewer_name || "",
        reviewerEmail: entries.reviewer_email || "",
        reviewerLocation: entries.client_location || "",
        contentUrl: localPreviewUrl || reviewVideoUrl,
        fileName: file?.name || (reviewVideoUrl ? `${videoProviderLabel(reviewVideoUrl)} video link` : ""),
        fileType: file?.type || (reviewVideoUrl ? "video/embed" : ""),
        submittedAt: new Date().toISOString(),
        status: "Pending",
        delivery_supabase: window.LDTT_SUPABASE?.enabled ? "pending" : "not_connected"
      };
      const payload = {
        ...entries,
        submission_id: submissionId,
        trainer_id: trainer?.remoteId || "",
        trainer_name: trainerLabel,
        trainer_slug: trainerSlug,
        trainer_market: trainerMarket,
        trainer_city: trainer ? trainerCity(trainer) : "",
        trainer_state: trainer?.state || "",
        page_url: window.location.href,
        source_page: `${trainerLabel} public review form`,
        timestamp: new Date().toISOString(),
        file: file ? {
          name: file.name,
          type: file.type,
          size: file.size,
          data_url: fileDataUrl
        } : null
      };
      const result = await submitPublicReview(payload);
      submission.delivery_supabase = result?.skipped ? "not_connected" : "confirmed";
      submission.remoteId = result?.submission_id || submission.remoteId;
      if (result?.file_url) submission.contentUrl = result.file_url;
      state.submissions.unshift(submission);
      saveState("Review submitted for admin approval", true);
      event.target.reset();
      setReviewStatus("Thank you. Your review is now pending office approval.");
      showFormSuccessModal("Thank you. Your review was submitted for Lorenzo's office to review before it is posted.");
    } catch (error) {
      console.warn("LDTT public review submission failed", error);
      setReviewStatus("We could not send that review to the office queue. Please try again or submit without an attachment.", "error");
    } finally {
      window.setTimeout(() => {
        delete event.target.dataset.submitting;
        submitButton?.removeAttribute("disabled");
      }, 4000);
    }
    return;
  }
  if (event.target.id === "portalProfileForm") {
    const status = document.getElementById("portalProfileStatus");
    const submitButton = event.target.querySelector('button[type="submit"]');
    const firstName = event.target.elements.firstName?.value.trim() || "";
    const lastName = event.target.elements.lastName?.value.trim() || "";
    const displayName = [firstName, lastName].filter(Boolean).join(" ");
    const file = event.target.elements.profilePhoto?.files?.[0] || null;
    if (!firstName || !lastName) {
      if (status) status.textContent = "Enter both first and last name before continuing.";
      showToast("Enter both first and last name before continuing.");
      return;
    }
    if ((!remoteReady || !portalUser?.user_id) && !isDemoPortalUser(portalUser)) {
      if (status) status.textContent = "Connect to the shared portal before saving profile changes.";
      return;
    }
    try {
      submitButton?.setAttribute("disabled", "disabled");
      if (status) status.textContent = "Saving portal profile...";
      const payload = { first_name: firstName, last_name: lastName, display_name: displayName };
      if (file) payload.profile_photo_url = await uploadPortalUserPhoto(portalUser, file);
      if (isDemoPortalUser(portalUser)) {
        Object.assign(portalUser, payload);
        await persistPortalUserRecord(portalUser, payload);
      } else {
        const result = await window.LDTT_PORTAL.operationalMutation({
          operation: "update",
          entity_type: "portal_user",
          id: portalUser.user_id,
          expected_updated_at: portalUser.updated_at || null,
          action: "portal_profile_saved",
          summary: `${displayName} updated their portal profile`,
          changes: payload
        });
        Object.assign(portalUser, result.record || payload);
      }
      if (remoteReady && !isDemoPortalUser(portalUser)) await reloadRemoteData();
      relabelCurrentActorActivity();
      if (status) status.textContent = "Profile saved.";
      if (isDemoPortalUser(portalUser)) recordActivity("Portal profile saved", `${currentActorLabel()} updated their portal profile.`, "Profile");
      showToast("Portal profile saved");
      render();
    } catch (error) {
      if (status) status.textContent = `Profile could not be saved: ${error.message}`;
      showToast(`Profile could not be saved: ${error.message}`);
    } finally {
      submitButton?.removeAttribute("disabled");
    }
    return;
  }
  if (event.target.id === "changePasswordForm") {
    const firstName = event.target.elements.firstName?.value.trim() || "";
    const lastName = event.target.elements.lastName?.value.trim() || "";
    const password = event.target.elements.password.value;
    const confirmation = event.target.elements.confirmation.value;
    const status = document.getElementById("passwordStatus");
    if (!firstName || !lastName) {
      status.textContent = "Please enter your first and last name.";
      return;
    }
    if (password !== confirmation) {
      status.textContent = "Passwords do not match.";
      return;
    }
    try {
      status.textContent = "Saving your permanent password...";
      await window.LDTT_PORTAL.changePassword(password, { firstName, lastName });
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
      const demoUser = demoAccountForLogin(username, password);
      if (demoUser) {
        portalUser = demoUser;
        saveSession(demoUser.role, { demoUsername: demoPortalKeyFor(demoUser) });
        state.activeView = "dashboard";
        state.leadDateRange = "60";
        state.customLeadStart = toDateInputValue(defaultLeadStartDate);
        state.customLeadEnd = toDateInputValue(defaultLeadEndDate);
        if (demoUser.trainer_id) state.selectedTrainerId = currentTrainerId();
        await hydrateSharedOperationalDataForDemo();
        recordActivity("Portal sign-in", `${portalDisplayName(demoUser)} signed in with a demo test account.`, "Security");
        status.textContent = "";
        render();
        return;
      }
      await window.LDTT_PORTAL.signIn(username, password, { remember: event.target.elements.remember?.checked === true });
      portalUser = await window.LDTT_PORTAL.currentPortalUser();
      if (!portalUserHasAccess(portalUser)) {
        await window.LDTT_PORTAL.signOut();
        throw new Error("This portal account is disabled. Contact Lorenzo's office.");
      }
      saveSession(portalUser.role);
      state.activeView = "dashboard";
      state.leadDateRange = "60";
      state.customLeadStart = toDateInputValue(defaultLeadStartDate);
      state.customLeadEnd = toDateInputValue(defaultLeadEndDate);
      const data = await prepareRemoteData(await window.LDTT_PORTAL.loadOperationalData());
      mergeRemoteOperationalData(data);
      if (portalUser.trainer_id) {
        state.selectedTrainerId = currentTrainerId();
      }
      recordActivity("Portal sign-in", `${portalDisplayName(portalUser)} signed in.`, "Security");
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
