const STORE_KEY = "lorenzoBackOfficePrototype.v2";
const SESSION_KEY = "lorenzoBackOfficeSession.v2";
const TEMP_PASSWORD = "doglovers26";

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
  "../assets/ldtt-team-cover.jpg",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=1100&q=80",
  "https://images.unsplash.com/photo-1560743173-567a3b5658b1?auto=format&fit=crop&w=1100&q=80"
];

const approvedLayouts = [
  { id: "classic", name: "Lorenzo Classic", headline: "Professional dog training backed by Lorenzo's proven system.", tag: "Best for obedience and family training" },
  { id: "proof", name: "Results & Reviews", headline: "Real results for real homes.", tag: "Best for proof and conversion" },
  { id: "specialty", name: "Advanced Service Profile", headline: "Advanced training with office-guided support.", tag: "Best for specialty and service work" }
];

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

const clientStatuses = ["Active", "Past", "Won", "Lost", "Bad Lead", "Do Not Contact"];

const defaultState = {
  role: "",
  activeView: "dashboard",
  selectedTrainerId: "eric-beck",
  clientFilter: "Active",
  leadDateRange: "60",
  customLeadStart: "2026-06-01",
  customLeadEnd: "2026-06-24",
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
      bio: "Eric helps families build reliable obedience, calmer behavior, and better owner leadership using Lorenzo's proven training system.",
      layout: "classic",
      pageStatus: "Published",
      locked: true,
      clicks: 1248,
      forms: 67,
      conversions: 9,
      image: "../assets/ldtt-team-cover.jpg"
    },
    { id: "stephanie-palmer", name: "Stephanie Palmer", market: "Akron, OH", serviceArea: "Akron, Canton, and surrounding communities", phone: "(866) 436-4959", email: "stephanie@lorenzosdogtrainingteam.com", bio: "Stephanie works with owners to create structure, consistency, and real-world obedience at home and in public.", layout: "proof", pageStatus: "Published", locked: true, clicks: 982, forms: 44, conversions: 6, image: layoutImages[1] },
    { id: "robert-stephan", name: "Robert Stephan", market: "Mentor, OH", serviceArea: "Mentor, Lake County, and Northeast Ohio", phone: "(866) 436-4959", email: "robert@lorenzosdogtrainingteam.com", bio: "Robert supports behavior modification and obedience plans built around timing, technique, and owner follow-through.", layout: "classic", pageStatus: "Published", locked: true, clicks: 736, forms: 31, conversions: 4, image: layoutImages[2] },
    { id: "jenn-studer", name: "Jenn Studer", market: "Medina, OH", serviceArea: "Medina and surrounding communities", phone: "(866) 436-4959", email: "jenn@lorenzosdogtrainingteam.com", bio: "Jenn's trainer page is being prepared by the office team.", layout: "proof", pageStatus: "Draft", locked: false, clicks: 184, forms: 7, conversions: 1, image: layoutImages[1] },
    { id: "ariel-kapela", name: "Ariel Kapela", market: "Parma, OH", serviceArea: "Parma, Cleveland west side, and nearby communities", phone: "(866) 436-4959", email: "ariel@lorenzosdogtrainingteam.com", bio: "Ariel focuses on clear owner communication and reliable behavior in daily life.", layout: "classic", pageStatus: "Published", locked: true, clicks: 523, forms: 22, conversions: 3, image: layoutImages[0] },
    { id: "mike-davis", name: "Mike Davis", market: "Youngstown, OH", serviceArea: "Youngstown and surrounding areas", phone: "(866) 436-4959", email: "mike@lorenzosdogtrainingteam.com", bio: "Mike is enrolled. The office has not started this trainer page yet.", layout: "specialty", pageStatus: "No Site Started", locked: false, clicks: 0, forms: 0, conversions: 0, image: layoutImages[2] }
  ],
  leads: [
    { id: "lead-1", owner: "Sarah Johnson", dog: "Max", breed: "Goldendoodle", source: "Website", service: "Obedience Training", trainerId: "eric-beck", status: "Evaluation Scheduled", createdAt: "2026-06-23", next: "Jun 25, 2026 10:00 AM", note: "Office scheduled phone consultation for Friday at 2:00 PM.", visits: 4, submitted: true },
    { id: "lead-2", owner: "Mike Davis", dog: "Rocky", breed: "German Shepherd", source: "Google", service: "Behavior Modification", trainerId: "eric-beck", status: "Office Contacted", createdAt: "2026-06-18", next: "Jun 26, 2026 3:30 PM", note: "Follow-up call needed. Owner asked about reactivity around other dogs.", visits: 2, submitted: true },
    { id: "lead-3", owner: "Jessica Miller", dog: "Luna", breed: "Labrador Retriever", source: "Referral", service: "Puppy Training", trainerId: "stephanie-palmer", status: "Evaluation Complete", createdAt: "2026-06-10", next: "Jun 27, 2026 11:00 AM", note: "Evaluation complete. Program options sent by office.", visits: 1, submitted: true },
    { id: "lead-4", owner: "Emily Wilson", dog: "Teddy", breed: "French Bulldog", source: "Facebook", service: "Obedience Training", trainerId: "robert-stephan", status: "Follow Up Call Needed", createdAt: "2026-06-03", next: "Jun 28, 2026 2:00 PM", note: "Office left voicemail. Needs second call.", visits: 5, submitted: true },
    { id: "lead-5", owner: "Chris Brown", dog: "Bailey", breed: "Golden Retriever", source: "Website", service: "Board & Train", trainerId: "jenn-studer", status: "Engaged Lead: No Outcome", createdAt: "2026-05-25", next: "Jun 29, 2026 6:00 PM", note: "Owner engaged with office, but no outcome selected yet.", visits: 3, submitted: true },
    { id: "lead-6", owner: "Amanda Lee", dog: "Bella", breed: "Husky", source: "Referral", service: "Board & Train", trainerId: "eric-beck", status: "Became a Client", createdAt: "2026-05-12", next: "-", note: "First session/payment confirmed. Training begins 6/26/26.", visits: 3, submitted: true },
    { id: "lead-7", owner: "Robert Johnson", dog: "Duke", breed: "Pit Bull Mix", source: "Google", service: "Behavior Modification", trainerId: "ariel-kapela", status: "Lost / Chose Another Provider", createdAt: "2026-04-29", next: "-", note: "Chose another trainer closer to home.", visits: 1, submitted: true },
    { id: "lead-8", owner: "Mark Allen", dog: "Rex", breed: "Doberman", source: "Website", service: "Protection Training", trainerId: "mike-davis", status: "First Session / Payment", createdAt: "2026-04-18", next: "Jun 30, 2026", note: "Payment confirmed by office; trainer handoff pending.", visits: 6, submitted: true }
  ],
  clients: [
    { id: "client-1", name: "Amanda Lee", phone: "(216) 555-0198", email: "amanda@example.com", dog: "Bella", breed: "Husky", trainerId: "eric-beck", status: "Won", source: "Referral", importedSource: "Manual", smsConsent: "Yes", emailConsent: "Yes", dateStarted: "2025-05-26", lastContacted: "2025-05-20", notes: "Active board and train client." },
    { id: "client-2", name: "Rebecca Rottman", phone: "(440) 555-0222", email: "rebecca@example.com", dog: "Maverick", breed: "Labrador", trainerId: "robert-stephan", status: "Past", source: "Google", importedSource: "Alpha", smsConsent: "Yes", emailConsent: "Yes", dateStarted: "2024-08-12", lastContacted: "2025-05-10", notes: "Great candidate for review request." },
    { id: "client-3", name: "Derek Hall", phone: "(330) 555-7712", email: "derek@example.com", dog: "Zeus", breed: "German Shepherd", trainerId: "stephanie-palmer", status: "Do Not Contact", source: "QuickBooks", importedSource: "QuickBooks", smsConsent: "No", emailConsent: "No", dateStarted: "2023-11-02", lastContacted: "2024-01-15", notes: "Opted out. Block from campaigns." },
    { id: "client-4", name: "Lindsey Grant", phone: "(216) 555-3355", email: "lindsey@example.com", dog: "Milo", breed: "Corgi", trainerId: "ariel-kapela", status: "Bad Lead", source: "Spreadsheet", importedSource: "Spreadsheet", smsConsent: "Unknown", emailConsent: "Unknown", dateStarted: "", lastContacted: "2025-04-03", notes: "Not a fit. Exclude by default." }
  ],
  submissions: [
    { id: "sub-1", trainerId: "eric-beck", type: "Review", title: "Google review screenshot from Becca Lynn", status: "Pending", note: "Trainer uploaded proof from recent behavior modification client." },
    { id: "sub-2", trainerId: "stephanie-palmer", type: "Photo", title: "Loose leash training photo", status: "Approved", note: "Approved for trainer page gallery." },
    { id: "sub-3", trainerId: "robert-stephan", type: "Review", title: "Client testimonial about reactivity", status: "Declined", note: "Need clearer screenshot before publishing." }
  ],
  importedPreview: []
};

let state = loadState();
let session = loadSession();
applyUrlState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    const merged = { ...structuredClone(defaultState), ...saved };
    ["trainers", "leads", "clients", "submissions", "stagedInvites"].forEach(key => {
      merged[key] = Array.isArray(saved[key]) ? saved[key] : structuredClone(defaultState[key]);
    });
    merged.leadDateRange = saved.leadDateRange || defaultState.leadDateRange;
    merged.customLeadStart = saved.customLeadStart || defaultState.customLeadStart;
    merged.customLeadEnd = saved.customLeadEnd || defaultState.customLeadEnd;
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
  const role = params.get("role");
  const view = params.get("view");
  const trainerId = params.get("trainer");
  if (role === "admin" || (role === "trainer" && params.get("temp") === TEMP_PASSWORD)) saveSession(role);
  if (view) state.activeView = view;
  if (trainerId && state.trainers.some(t => t.id === trainerId)) state.selectedTrainerId = trainerId;
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

function trainerName(id) {
  return trainerById(id)?.name || "Unassigned";
}

function currentTrainerId() {
  return "eric-beck";
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
  renderSidebar();
  renderTopbar();
  renderView();
}

function adminNav() {
  return [
    ["dashboard", "Dashboard", "dashboard"],
    ["trainerPages", "Trainer Pages", "globe"],
    ["trainers", "Trainers", "users"],
    ["leads", "Leads", "lead"],
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
  const nav = isAdmin ? adminNav() : trainerNav();
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
      ${isAdmin ? `<button class="btn btn-outline btn-full" data-view="trainerPages">Manage Trainer Pages</button>` : `<button class="btn btn-outline btn-full" data-view="submitMedia">Submit Content</button>`}
    </div>
    <div class="side-user">
      <span class="avatar">${isAdmin ? "LO" : "EB"}</span>
      <div><strong>${isAdmin ? "Lorenzo's Office" : trainerById(currentTrainerId()).name}</strong><span>${isAdmin ? "Administrator" : "Certified Trainer"}</span></div>
    </div>`;
}

function renderTopbar() {
  const isAdmin = session.role === "admin";
  const titles = isAdmin ? {
    dashboard: ["Admin Dashboard", "Network performance, lead outcomes, and conversion reporting."],
    trainerPages: ["Trainer Pages", "Office-controlled trainer landing pages, publishing, and locking."],
    trainers: ["Trainers", "Create and edit trainer profiles used by approved pages."],
    leads: ["Leads", "Office-managed funnel from inquiry to paying client."],
    clients: ["Client Database", "Central list for active, past, won, lost, bad lead, and do-not-contact records."],
    import: ["Client Import", "Prototype CSV import with preview, duplicate checks, and consent protection."],
    approvals: ["Media & Review Approvals", "Approve or decline trainer-submitted content before it appears publicly."],
    reports: ["Conversion Reports", "Conversions count only first session/payment or became a client."],
    settings: ["Settings", "Demo controls and localStorage status."]
  } : {
    dashboard: ["Dashboard", "Assigned leads, office notes, locked page access, and pending submissions."],
    leads: ["My Leads", "See office notes and outcomes for leads assigned to you."],
    myPage: ["My Trainer Page", "This page is controlled, published, and locked by Lorenzo's office."],
    performance: ["Performance", "Basic lead and conversion numbers from office-managed tracking."],
    submitMedia: ["Submit Photos/Videos", "Send training photos and videos to the office for approval."],
    submitReviews: ["Submit Reviews", "Send reviews and testimonials to the office for approval."],
    settings: ["Settings", "Trainer portal access and demo state."]
  };
  const [title, sub] = titles[state.activeView] || titles.dashboard;
  document.getElementById("topbar").innerHTML = `
    <div class="page-title"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(sub)}</p></div>
    <div class="top-actions">
      ${isAdmin ? `<button class="btn btn-outline">Demo: localStorage</button><button class="btn btn-outline">Filters</button><button class="btn btn-red" data-view="import">Import Clients</button>` : `<a class="btn btn-outline" href="site.html?trainer=${currentTrainerId()}" target="_blank" rel="noopener">Open My Page</a><button class="btn btn-red" data-view="submitMedia">Submit Content</button>`}
      <span class="bell">${icon("message")}</span>
      <button class="profile-chip"><span class="avatar">${isAdmin ? "LO" : "EB"}</span><span><strong>${isAdmin ? "Admin" : trainerById(currentTrainerId()).name}</strong><small>${isAdmin ? "Office" : "Trainer"}</small></span></button>
    </div>`;
}

function renderView() {
  const target = document.getElementById("workspaceView");
  const screens = session.role === "admin" ? adminScreens : trainerScreens;
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
    return `${panel("Approved Lorenzo-Branded Layouts", "", approvedLayoutCards(), "pad")}<br>${panel("Trainer Page Control", `<button class="btn btn-red" id="addTrainer">Create Trainer</button>`, trainerPageCards())}`;
  },
  trainers() {
    return `<div class="admin-network-grid">${panel("Edit Selected Trainer", "", trainerAdminForm(), "pad")}${panel("Trainer Directory", "", trainerSelectList(), "pad")}</div>`;
  },
  leads() {
    return panel("Office Lead Pipeline", `<button class="btn btn-outline" data-filter-leads="all">All Statuses</button><button class="btn btn-outline">Date Filter</button>`, leadPipelineTable(true), "pad");
  },
  clients() {
    return `${clientFilterBar()}${panel("Central Client Database", `<button class="btn btn-red" data-view="import">Import Clients</button>`, clientTable(), "pad")}`;
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
      <div class="dashboard-grid">${panel("Conversion By Trainer", "", trainerPerformanceTable())}${panel("Lost Reasons", "", lostReasonsTable())}</div>
      ${panel("Reporting Rule", "", `<p class="panel-copy">Conversions are counted only when a lead reaches <strong>First Session / Payment</strong> or <strong>Became a Client</strong>. Clicks and form submissions stay visible as traffic and inquiry metrics, but they do not inflate conversion reporting.</p>`, "pad")}`;
  },
  settings() {
    return panel("Settings", "", `<p class="panel-copy">This is a static/localStorage prototype. Supabase, real auth, email/SMS sending, campaign automation, and real database persistence are intentionally not connected yet.</p><br><button class="btn btn-outline" id="resetDemo">Reset Demo Data</button> <button class="btn btn-red" id="logoutBtn">Log Out</button>`, "pad");
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
        ${panel("My Locked Trainer Page", `<a class="btn btn-outline" href="site.html?trainer=${trainer.id}" target="_blank" rel="noopener">View Page</a>`, lockedPageCard(trainer), "pad")}
        ${panel("Assigned Leads & Office Notes", `<button class="btn btn-outline" data-view="leads">View All</button>`, leadPipelineTable(false), "pad")}
      </div>
      <div class="dashboard-grid">
        ${panel("What Trainers Can Do", "", trainerAllowedList(), "pad")}
        ${panel("Submit Content For Approval", `<button class="btn btn-red" data-view="submitMedia">Submit Media</button><button class="btn btn-outline" data-view="submitReviews">Submit Reviews</button>`, `<p class="panel-copy">Photos, videos, reviews, screenshots, and testimonials go to Lorenzo's office before anything appears publicly.</p>`, "pad")}
      </div>`;
  },
  myPage() {
    const trainer = trainerById(currentTrainerId());
    return `<div class="dashboard-grid"><section class="site-canvas locked-public-preview">${publicSiteMarkup(trainer)}</section>${panel("Locked Page Details", "", lockedPageDetails(trainer), "pad")}</div>`;
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
    return panel("Trainer Settings", "", `<p class="panel-copy">Your profile and public page are managed by Lorenzo's office. Contact the office for changes to bio, market, phone, page layout, or published content.</p><br><button class="btn btn-red" id="logoutBtn">Log Out</button>`, "pad");
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
  const visits = state.leads.reduce((sum, lead) => sum + Number(lead.visits || 0), 0) + state.trainers.reduce((sum, t) => sum + Number(t.clicks || 0), 0);
  const forms = state.leads.filter(l => l.submitted).length + state.trainers.reduce((sum, t) => sum + Number(t.forms || 0), 0);
  const evalScheduled = state.leads.filter(l => l.status === "Evaluation Scheduled").length;
  const evalCompleted = state.leads.filter(l => l.status === "Evaluation Complete").length;
  const followUpNeeded = state.leads.filter(l => l.status === "Follow Up Call Needed").length;
  const engagedNoOutcome = state.leads.filter(l => l.status === "Engaged Lead: No Outcome").length;
  const firstPayment = state.leads.filter(l => l.status === "First Session / Payment").length;
  const clientWon = state.leads.filter(l => l.status === "Became a Client").length;
  return { visits, forms, evalScheduled, evalCompleted, followUpNeeded, engagedNoOutcome, firstPayment, clientWon, trueConversions: firstPayment + clientWon, lostNoResponse: state.leads.filter(l => l.status === "Lost / No Response").length };
}

function trainerPerformanceTable() {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Trainer</th><th>Page Status</th><th>Clicks</th><th>Forms</th><th>True Conversions</th><th>Rate</th></tr></thead><tbody>${state.trainers.map(trainer => {
    const trainerLeadConversions = state.leads.filter(l => l.trainerId === trainer.id && conversionStatuses().includes(l.status)).length;
    const conversions = Math.max(trainer.conversions || 0, trainerLeadConversions);
    const rate = trainer.forms ? `${Math.round((conversions / trainer.forms) * 1000) / 10}%` : "0%";
    return `<tr><td><div class="row-person"><span class="avatar">${initials(trainer.name)}</span><div><strong>${escapeHtml(trainer.name)}</strong><small>${escapeHtml(trainer.market)}</small></div></div></td><td>${pageStatusBadge(trainer)}</td><td><strong>${trainer.clicks}</strong></td><td><strong>${trainer.forms}</strong></td><td><strong>${conversions}</strong></td><td>${rate}</td></tr>`;
  }).join("")}</tbody></table></div>`;
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
  const end = state.leadDateRange === "custom" ? new Date(`${state.customLeadEnd}T23:59:59`) : new Date("2026-06-24T23:59:59");
  const start = state.leadDateRange === "custom"
    ? new Date(`${state.customLeadStart}T00:00:00`)
    : new Date(end.getTime() - (Number(state.leadDateRange || 60) - 1) * 86400000);
  return sorted.filter(lead => {
    const created = new Date(`${lead.createdAt}T12:00:00`);
    return created >= start && created <= end;
  });
}

function leadRangeLabel() {
  if (state.leadDateRange === "custom") return `${state.customLeadStart} to ${state.customLeadEnd}`;
  return `last ${state.leadDateRange} days`;
}

function leadOutcomeTable() {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Client / Dog</th><th>Trainer</th><th>Service</th><th>Status</th><th>Office Note</th><th>Action</th></tr></thead><tbody>${state.leads.map(lead => `
    <tr><td><strong>${escapeHtml(lead.owner)}</strong><small>${escapeHtml(lead.dog)} (${escapeHtml(lead.breed)})</small></td><td>${escapeHtml(trainerName(lead.trainerId))}</td><td>${escapeHtml(lead.service)}</td><td>${statusSelect(lead)}</td><td><input class="select-pill note-input" data-lead-note="${lead.id}" value="${escapeHtml(lead.note)}"></td><td><button class="btn btn-red" data-save-lead="${lead.id}">Update</button></td></tr>`).join("")}</tbody></table></div>`;
}

function leadPipelineTable(admin) {
  const baseRows = admin ? state.leads : trainerLeads();
  const rows = filteredLeadRows(baseRows);
  return `${leadDateControls()}<p class="panel-copy" style="margin-bottom:12px">Showing ${rows.length} lead${rows.length === 1 ? "" : "s"} from ${escapeHtml(leadRangeLabel())}, sorted newest first.</p><div class="pipeline-tabs funnel-tabs">${leadStatusCounts(rows).map(([label, count]) => `<article><span>${escapeHtml(label)}</span><strong>${count}</strong></article>`).join("")}</div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Lead Date</th><th>Owner / Dog</th><th>Source</th><th>Service</th><th>${admin ? "Trainer" : "Office Outcome"}</th><th>Status</th><th>Office Notes</th></tr></thead><tbody>${rows.map((lead, index) => `<tr><td>${formatDate(lead.createdAt)}</td><td><div class="row-person"><span class="dog-avatar"><img src="${dogImages[index % dogImages.length]}" alt=""></span><div><strong>${escapeHtml(lead.owner)}</strong><small>${escapeHtml(lead.dog)} · ${escapeHtml(lead.breed)}</small></div></div></td><td>${escapeHtml(lead.source)}</td><td>${escapeHtml(lead.service)}</td><td>${admin ? escapeHtml(trainerName(lead.trainerId)) : escapeHtml(lead.next)}</td><td>${admin ? statusSelect(lead) : `<span class="status ${statusClass(lead.status)}">${escapeHtml(lead.status)}</span>`}</td><td>${escapeHtml(lead.note || "—")}</td></tr>`).join("") || `<tr><td colspan="7">No leads found for this date range.</td></tr>`}</tbody></table></div>`;
}

function statusSelect(lead) {
  return `<select class="select-pill" data-lead-status="${lead.id}">${leadStatuses.map(status => `<option ${lead.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select>`;
}

function leadStatusCounts(rows) {
  return ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome", "Follow Up Call Needed", "Evaluation Scheduled", "Evaluation Complete", "Became a Client"].map(status => [status, rows.filter(lead => lead.status === status).length]);
}

function leadSummary() {
  const labels = leadStatusCounts(state.leads);
  return `<div class="donut-panel"><div class="donut"></div><div class="legend">${labels.map(([name, value], index) => `<div class="legend-row"><span class="dot" style="background:${["#246bfe", "#69b6ff", "#7759d8", "#ff9f1a", "#20a566", "#0b7e49", "#d20f32"][index]}"></span><span>${escapeHtml(name)}</span><strong>${value}</strong></div>`).join("")}</div></div>`;
}

function protectionSummary() {
  return `<div class="protection-list">
    <div><strong>${state.clients.filter(c => c.status === "Do Not Contact").length}</strong><span>Do-not-contact records blocked</span></div>
    <div><strong>${state.clients.filter(c => c.status === "Bad Lead").length}</strong><span>Bad leads excluded by default</span></div>
    <div><strong>${state.clients.filter(c => c.smsConsent === "Unknown" || c.emailConsent === "Unknown").length}</strong><span>Unknown consent requires review</span></div>
  </div>`;
}

function approvedLayoutCards() {
  return `<div class="layout-card-grid">${approvedLayouts.map((layout, index) => `<article class="layout-card"><div class="site-thumb network-thumb" style="background-image:linear-gradient(90deg, rgba(3,24,51,.88), rgba(3,24,51,.2)), url('${layoutImages[index]}')"><span>Approved Layout</span><strong>${escapeHtml(layout.headline)}</strong></div><h3>${escapeHtml(layout.name)}</h3><p>${escapeHtml(layout.tag)}</p><button class="btn btn-outline" data-assign-layout="${layout.id}">Apply To Selected Trainer</button></article>`).join("")}</div>`;
}

function trainerPageCards() {
  return `<div class="trainer-card-grid">${state.trainers.map(trainer => `<article class="network-card"><div class="site-thumb network-thumb" style="background-image:linear-gradient(90deg, rgba(3,24,51,.88), rgba(3,24,51,.18)), url('${trainer.image || layoutImages[0]}')"><span>${escapeHtml(layoutName(trainer.layout))}</span><strong>${escapeHtml(trainer.name)} · ${escapeHtml(trainer.market)}</strong></div><div class="network-card-head"><div><h3>${escapeHtml(trainer.name)}</h3><p>${escapeHtml(trainer.serviceArea)}</p></div>${pageStatusBadge(trainer)}</div><div class="readiness-stats"><div><strong>${trainer.clicks}</strong><span>Clicks</span></div><div><strong>${trainer.forms}</strong><span>Forms</span></div><div><strong>${trainer.conversions}</strong><span>Won/Paid</span></div></div><p class="network-note">${trainer.locked ? "Locked by office. Trainer can view only." : "Office draft. Not locked yet."}</p><div class="row-actions"><button class="btn btn-outline" data-select-trainer="${trainer.id}" data-view="trainers">Edit</button><button class="btn btn-outline" data-preview-trainer="${trainer.id}">View Page</button><button class="btn ${trainer.locked ? "btn-outline" : "btn-red"}" data-toggle-lock="${trainer.id}">${trainer.locked ? "Unlock" : "Publish & Lock"}</button></div></article>`).join("")}</div>`;
}

function trainerAdminForm() {
  const t = trainerById();
  return `<div class="form-grid">
    ${[["name", "Trainer Name"], ["market", "Market"], ["phone", "Phone"], ["email", "Email"], ["serviceArea", "Service Area"]].map(([key, label]) => `<div class="field ${key === "serviceArea" ? "wide" : ""}"><label>${label}<input name="admin-trainer-${key}" value="${escapeHtml(t[key])}"></label></div>`).join("")}
    <div class="field wide"><label>Approved Bio<textarea name="admin-trainer-bio">${escapeHtml(t.bio)}</textarea></label></div>
    <div class="field"><label>Approved Layout<select name="admin-trainer-layout">${approvedLayouts.map(layout => `<option value="${layout.id}" ${t.layout === layout.id ? "selected" : ""}>${escapeHtml(layout.name)}</option>`).join("")}</select></label></div>
    <div class="field"><label>Page Status<select name="admin-trainer-pageStatus"><option ${t.pageStatus === "No Site Started" ? "selected" : ""}>No Site Started</option><option ${t.pageStatus === "Draft" ? "selected" : ""}>Draft</option><option ${t.pageStatus === "Published" ? "selected" : ""}>Published</option></select></label></div>
    <div class="field"><label>Locked<select name="admin-trainer-locked"><option value="true" ${t.locked ? "selected" : ""}>Locked</option><option value="false" ${!t.locked ? "selected" : ""}>Unlocked Draft</option></select></label></div>
  </div><br><button class="btn btn-red" id="saveTrainerProfile">Save Trainer Profile</button>`;
}

function trainerSelectList() {
  return `<div class="trainer-select-list">${state.trainers.map(trainer => `<button class="trainer-select ${state.selectedTrainerId === trainer.id ? "active" : ""}" data-select-trainer="${trainer.id}"><strong>${escapeHtml(trainer.name)}</strong><span>${escapeHtml(trainer.market)} · ${trainer.pageStatus}${trainer.locked ? " · Locked" : ""}</span></button>`).join("")}</div>`;
}

function pageStatusBadge(trainer) {
  const cls = trainer.pageStatus === "Published" ? "live" : trainer.pageStatus === "Draft" ? "draft" : "enrolled";
  return `<span class="status ${cls}">${escapeHtml(trainer.pageStatus)}${trainer.locked ? " · Locked" : ""}</span>`;
}

function layoutName(id) {
  return approvedLayouts.find(layout => layout.id === id)?.name || approvedLayouts[0].name;
}

function lockedPageCard(trainer) {
  return `<div class="locked-card"><div class="site-thumb network-thumb" style="background-image:linear-gradient(90deg, rgba(3,24,51,.88), rgba(3,24,51,.18)), url('${trainer.image || layoutImages[0]}')"><span>Powered by Lorenzo's Dog Training</span><strong>${escapeHtml(trainer.name)} · ${escapeHtml(trainer.market)}</strong></div><div><h3>${escapeHtml(layoutName(trainer.layout))}</h3><p class="panel-copy">${escapeHtml(trainer.bio)}</p><p>${pageStatusBadge(trainer)}</p></div></div>`;
}

function lockedPageDetails(trainer) {
  return `<div class="lock-notice">${icon("shield")}<div><strong>Office-controlled and locked</strong><p>Lorenzo's office manages the bio, photos, reviews, layout, publishing, and page lock. Trainers submit content for approval.</p></div></div><ul class="health-list"><li><span class="check">✓</span> Brand-uniform Lorenzo page</li><li><span class="check">✓</span> Safer office consultation CTA</li><li><span class="check">✓</span> No trainer publish controls</li><li><span class="check">✓</span> No DNS or website builder access</li></ul>`;
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

function submissionForm(kind = "media") {
  const options = kind === "review" ? ["Review", "Testimonial"] : ["Photo", "Training Video"];
  const placeholder = kind === "review" ? "Example: Google review screenshot" : "Example: Loose leash training video";
  return `<div class="form-grid"><div class="field"><label>Submission Type<select name="submission-type">${options.map(option => `<option>${option}</option>`).join("")}</select></label></div><div class="field"><label>Title<input name="submission-title" placeholder="${placeholder}"></label></div><div class="field wide"><label>Notes<textarea name="submission-note" placeholder="Tell the office where this should be used."></textarea></label></div><div class="field wide"><label>Upload File<input type="file" disabled></label><p class="panel-copy">Demo only: click submit to create a pending localStorage submission.</p></div></div>`;
}

function submissionsTable(admin, kind = "all") {
  const sourceRows = admin ? state.submissions : trainerSubmissions();
  const rows = kind === "media" ? sourceRows.filter(sub => ["Photo", "Training Video", "Video"].includes(sub.type)) : kind === "review" ? sourceRows.filter(sub => ["Review", "Testimonial"].includes(sub.type)) : sourceRows;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Trainer</th><th>Type</th><th>Title</th><th>Status</th><th>Note</th>${admin ? "<th>Action</th>" : ""}</tr></thead><tbody>${rows.map(sub => `<tr><td>${escapeHtml(trainerName(sub.trainerId))}</td><td>${escapeHtml(sub.type)}</td><td><strong>${escapeHtml(sub.title)}</strong></td><td><span class="status ${submissionStatusClass(sub.status)}">${escapeHtml(sub.status)}</span></td><td>${escapeHtml(sub.note)}</td>${admin ? `<td><button class="btn btn-green" data-approve-submission="${sub.id}">Approve</button> <button class="btn btn-outline" data-decline-submission="${sub.id}">Decline</button></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

function clientFilterBar() {
  return `<div class="filter-bar">${clientStatuses.map(status => `<button class="btn ${state.clientFilter === status ? "btn-red" : "btn-outline"}" data-client-filter="${status}">${status}</button>`).join("")}</div>`;
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

function lostReasonsTable() {
  const lost = state.leads.filter(l => l.status.startsWith("Lost") || l.status === "Bad Lead" || l.status === "Do Not Contact");
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Lead</th><th>Status</th><th>Trainer</th><th>Office Note</th></tr></thead><tbody>${lost.map(lead => `<tr><td>${escapeHtml(lead.owner)}<small>${escapeHtml(lead.dog)}</small></td><td><span class="status lost">${escapeHtml(lead.status)}</span></td><td>${escapeHtml(trainerName(lead.trainerId))}</td><td>${escapeHtml(lead.note || "—")}</td></tr>`).join("") || `<tr><td colspan="4">No lost leads in current demo state.</td></tr>`}</tbody></table></div>`;
}

function publicSiteMarkup(trainer) {
  const layout = approvedLayouts.find(l => l.id === trainer.layout) || approvedLayouts[0];
  return `<div class="public-site-wrap">
    <header class="site-header-preview"><div class="site-company-lockup"><img class="site-company-logo" src="../assets/lorenzo-logo-transparent.png" alt=""><strong>${escapeHtml(trainer.name)}<small>Powered by Lorenzo's Dog Training</small></strong></div><nav class="mock-nav"><a href="#services">Services</a><a href="#about">About</a><a href="#reviews">Reviews</a><a href="#contact">Contact</a></nav></header>
    <section class="hero-preview public-hero" style="background-image:linear-gradient(90deg, rgba(3,24,51,.92), rgba(3,24,51,.26)), url('${trainer.image || layoutImages[0]}')"><div><span class="selected-template-pill light">${escapeHtml(layout.name)}</span><h2>${escapeHtml(layout.headline)}</h2><p>${escapeHtml(trainer.bio)}</p><div class="row-actions"><a class="btn btn-red" href="#contact">Schedule Phone Consultation</a><a class="btn btn-outline" href="#services">View Services</a></div><p class="powered-copy">Powered by Lorenzo's Dog Training</p></div></section>
    <section class="service-preview" id="services"><p class="step-label">Training Services</p><h2>Training plans guided by Lorenzo's office and delivered through approved trainers.</h2><div class="service-cards">${["Obedience Training", "Behavior Modification", "Puppy Training", "Specialty Training"].map(service => `<article>${icon("shield")}<strong>${service}</strong><p class="panel-copy">Office-guided consultation and trainer matching.</p></article>`).join("")}</div></section>
    <section class="service-preview" id="contact"><p class="step-label">Start With The Office</p><h2>Schedule a phone consultation.</h2><p class="panel-copy">Our office will contact you at your selected time to help get you connected with the right trainer.</p><div class="contact-card"><input placeholder="Your name"><input placeholder="Phone"><input placeholder="Dog name"><select><option>Obedience Training</option><option>Behavior Modification</option><option>Protection / Specialty Training</option></select><button class="btn btn-red">Request Office Call</button></div></section>
  </div>`;
}

function renderPublicSite() {
  const params = new URLSearchParams(window.location.search);
  const trainer = trainerById(params.get("trainer") || state.selectedTrainerId);
  document.getElementById("publicSite").innerHTML = `<div class="site-canvas public-canvas">${publicSiteMarkup(trainer)}</div>`;
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

document.addEventListener("click", event => {
  const loginRole = event.target.closest("[data-login-role]");
  if (loginRole) {
    saveSession(loginRole.dataset.loginRole);
    state.activeView = "dashboard";
    saveState(`${loginRole.dataset.loginRole === "admin" ? "Admin" : "Trainer"} portal opened`);
    return;
  }
  const trainerSelect = event.target.closest("[data-select-trainer]");
  if (trainerSelect) state.selectedTrainerId = trainerSelect.dataset.selectTrainer;
  const view = event.target.closest("[data-view]");
  if (view) {
    state.activeView = view.dataset.view;
    saveState();
    return;
  }
  const previewTrainer = event.target.closest("[data-preview-trainer]");
  if (previewTrainer) {
    window.open(`site.html?trainer=${previewTrainer.dataset.previewTrainer}`, "_blank", "noopener");
    return;
  }
  const toggleLock = event.target.closest("[data-toggle-lock]");
  if (toggleLock) {
    const trainer = trainerById(toggleLock.dataset.toggleLock);
    trainer.locked = !trainer.locked;
    if (trainer.locked) trainer.pageStatus = "Published";
    saveState(trainer.locked ? "Trainer page published and locked" : "Trainer page unlocked as office draft");
    return;
  }
  const assignLayout = event.target.closest("[data-assign-layout]");
  if (assignLayout) {
    trainerById().layout = assignLayout.dataset.assignLayout;
    saveState("Approved layout assigned by office");
    return;
  }
  const clientFilter = event.target.closest("[data-client-filter]");
  if (clientFilter) {
    state.clientFilter = clientFilter.dataset.clientFilter;
    saveState();
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
    saveState("Submission approved");
    return;
  }
  const decline = event.target.closest("[data-decline-submission]");
  if (decline) {
    const sub = state.submissions.find(s => s.id === decline.dataset.declineSubmission);
    if (sub) sub.status = "Declined";
    saveState("Submission declined");
    return;
  }
  if (event.target.id === "submitDemoContent") {
    const type = document.querySelector('[name="submission-type"]')?.value || "Photo";
    const title = document.querySelector('[name="submission-title"]')?.value || `${type} submission`;
    const note = document.querySelector('[name="submission-note"]')?.value || "Submitted by trainer for office approval.";
    state.submissions.unshift({ id: `sub-${Date.now()}`, trainerId: currentTrainerId(), type, title, note, status: "Pending" });
    saveState("Submitted for admin approval");
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
    rowsToImport.forEach(row => {
      const duplicate = state.clients.find(c => sameContact(c, row));
      if (duplicate && ["Update", "Merge"].includes(row.action)) Object.assign(duplicate, approvedClientRecord(row), { id: duplicate.id });
      if (!duplicate && row.action === "Create") state.clients.unshift(approvedClientRecord(row));
    });
    state.importedPreview = [];
    state.clientFilter = "Active";
    saveState("Clients imported into local demo database");
    return;
  }
  if (event.target.id === "addTrainer") {
    const id = `trainer-${Date.now()}`;
    state.trainers.unshift({ id, name: "New Trainer", market: "Market Pending", serviceArea: "Service area pending", phone: "(866) 436-4959", email: "trainer@lorenzosdogtrainingteam.com", bio: "Office needs to approve this trainer bio.", layout: "classic", pageStatus: "No Site Started", locked: false, clicks: 0, forms: 0, conversions: 0, image: layoutImages[0] });
    state.selectedTrainerId = id;
    state.activeView = "trainers";
    saveState("Trainer created as office draft");
    return;
  }
  if (event.target.id === "saveTrainerProfile") {
    saveState("Trainer profile saved by office");
    return;
  }
  if (event.target.id === "resetDemo") {
    localStorage.removeItem(STORE_KEY);
    state = structuredClone(defaultState);
    saveState("Demo data reset");
    return;
  }
  if (event.target.id === "logoutBtn") {
    session = { loggedIn: false, role: "" };
    sessionStorage.removeItem(SESSION_KEY);
    render();
  }
});

document.addEventListener("input", event => {
  const field = event.target;
  if (field.name?.startsWith("admin-trainer-")) {
    const trainer = trainerById();
    const key = field.name.replace("admin-trainer-", "");
    trainer[key] = key === "locked" ? field.value === "true" : field.value;
    saveState(null, true);
  }
  if (field.dataset.leadNote) {
    const lead = state.leads.find(l => l.id === field.dataset.leadNote);
    if (lead) lead.note = field.value;
    saveState(null, true);
  }
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

document.addEventListener("change", event => {
  const statusField = event.target.closest("[data-lead-status]");
  if (statusField) {
    const lead = state.leads.find(l => l.id === statusField.dataset.leadStatus);
    if (lead) lead.status = statusField.value;
    saveState("Lead status updated");
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
    saveState("Trainer profile field updated");
  }
});

document.addEventListener("submit", event => {
  event.preventDefault();
  if (event.target.id === "loginForm") {
    const username = event.target.elements.username.value.trim().toLowerCase();
    saveSession(username === "admin" ? "admin" : "trainer");
    state.activeView = "dashboard";
    saveState("Portal opened");
  }
});

render();
