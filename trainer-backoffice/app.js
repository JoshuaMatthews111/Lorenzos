const STORE_KEY = "lorenzoTrainerNetworkVisualPortal.v1";
const SESSION_KEY = "lorenzoTrainerNetworkSession.v1";
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

const trainers = [
  ["Eric Beck", "Cleveland, OH", 18, 8, 6, "Live"],
  ["Stephanie Palmer", "Akron, OH", 12, 5, 3, "Live"],
  ["Robert Stephan", "Mentor, OH", 9, 4, 2, "Live"],
  ["Jenn Studer", "Medina, OH", 7, 3, 2, "Draft"],
  ["Ariel Kapela", "Parma, OH", 6, 3, 1, "Live"],
  ["Mike Davis", "Youngstown, OH", 5, 2, 1, "Draft"]
];

const leads = [
  ["Sarah Johnson", "Max", "Goldendoodle", "Website", "Obedience Training", "New", "May 13, 2025 10:00 AM", "Lorenzo office scheduled this lead for Friday 2:00 PM."],
  ["Mike Davis", "Rocky", "German Shepherd", "Google", "Behavior Modification", "Contacted", "May 14, 2025 3:30 PM", "Follow-up scheduled."],
  ["Jessica Miller", "Luna", "Labrador Retriever", "Referral", "Puppy Training", "Evaluation Booked", "May 16, 2025 11:00 AM", ""],
  ["Emily Wilson", "Teddy", "French Bulldog", "Facebook", "Obedience Training", "Follow-Up Scheduled", "May 19, 2025 2:00 PM", ""],
  ["Chris Brown", "Bailey", "Golden Retriever", "Website", "Board & Train", "Program Offered", "May 20, 2025 6:00 PM", ""],
  ["Amanda Lee", "Bella", "Husky", "Referral", "Board & Train", "Client Won", "-", "Great fit. Training begins 5/26/25."],
  ["Robert Johnson", "Duke", "Pit Bull Mix", "Google", "Aggression Rehab", "Lost", "-", "Lost: Chose another trainer closer to home."]
];

const availabilityDays = ["Mon 24", "Tue 25", "Wed 26", "Thu 27", "Fri 28", "Sat 29", "Sun 30"];
const availabilityTimes = ["9:00 AM", "10:30 AM", "12:00 PM", "1:30 PM", "3:00 PM", "4:30 PM", "6:00 PM"];

const themes = [
  ["Lorenzo Classic", "Service-First Local Trainer", "Real Training. Real Results.", "Best for Obedience"],
  ["Lorenzo Classic", "Trainer Authority Bio", "Leadership. Relationship. Results.", "Best for Authority"],
  ["Lorenzo Classic", "Reviews & Results", "Trusted by dog owners. Proven by results.", "Best for Reviews"],
  ["Lorenzo Classic", "Evaluation-First Conversion", "Start with an evaluation. End with results.", "Best for Conversions"],
  ["Premium Local Pro", "Modern Local Expert", "Cleveland's Premier Dog Training Expert", "Best for Local SEO"],
  ["Premium Local Pro", "Family Obedience Specialist", "Better behavior. Stronger family bond.", "Best for Families"],
  ["Premium Local Pro", "Behavior Modification Specialist", "Real change starts with understanding.", "Best for Behavior Issues"],
  ["Premium Local Pro", "Clean Consultation Page", "Let's create the right plan for your dog.", "Best for Lead Conversion"],
  ["Advanced Specialty", "Protection Training", "Protect. Deter. Defend.", "Best for Protection"],
  ["Advanced Specialty", "Service & Assistance Dogs", "Trained to serve. Built to help.", "Best for Service Dogs"],
  ["Advanced Specialty", "Scent Work / Retrieval", "Scent. Focus. Retrieve.", "Best for Scent Work"],
  ["Advanced Specialty", "Business & Facility Training", "Training for your team. Results for your business.", "Best for Businesses"]
];

const themeImages = [
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1551717743-49959800b1f6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1525253013412-55c1a69a5738?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1560743173-567a3b5658b1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1554692918-08fa0fdc9db3?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80"
];

const mediaImages = [
  "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1529472119196-cb724127a98e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1551717743-49959800b1f6?auto=format&fit=crop&w=800&q=80"
];

const defaultState = {
  role: "",
  activeView: "dashboard",
  selectedTheme: 0,
  inviteDraft: { name: "", email: "", phone: "", market: "" },
  stagedInvites: [],
  availability: {
    selected: ["Mon 24|9:00 AM", "Mon 24|1:30 PM", "Tue 25|10:30 AM", "Wed 26|3:00 PM", "Thu 27|9:00 AM", "Fri 28|4:30 PM"],
    slotType: "In-person consultation",
    interval: "30 min",
    slotModes: {
      "Mon 24|9:00 AM": "In-person consultation",
      "Mon 24|1:30 PM": "Online consultation",
      "Tue 25|10:30 AM": "Online consultation",
      "Wed 26|3:00 PM": "In-person consultation",
      "Thu 27|9:00 AM": "In-person consultation",
      "Fri 28|4:30 PM": "Online consultation"
    }
  },
  trainer: {
    companyName: "Lorenzo's Dog Training Team",
    logoData: "",
    trainerName: "Eric Beck",
    title: "Certified Lorenzo Trainer",
    slogan: "Professional dog training in Cleveland backed by Lorenzo's proven system.",
    phone: "(866) 436-4959",
    email: "trainer@lorenzosdogtrainingteam.com",
    market: "Cleveland, OH",
    serviceArea: "Cleveland, Garfield Heights, Akron, and surrounding Northeast Ohio areas",
    instagram: "https://instagram.com/yourcompany",
    facebook: "https://facebook.com/yourcompany",
    google: "https://g.page/yourcompany",
    headline: "Professional dog training in Cleveland backed by Lorenzo's proven system.",
    subheadline: "Obedience training, behavior modification, puppy training, and more for real results in the real world.",
    cta: "Book an Evaluation"
  }
};

let state = loadState();
let session = loadSession();
applyUrlState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    const merged = { ...structuredClone(defaultState), ...saved };
    merged.trainer = { ...structuredClone(defaultState.trainer), ...(saved.trainer || {}) };
    merged.availability = { ...structuredClone(defaultState.availability), ...(saved.availability || {}) };
    if (!merged.trainer.companyName || merged.trainer.companyName === "Your Company Name") {
      merged.trainer.companyName = defaultState.trainer.companyName;
    }
    if (!merged.availability.interval && merged.availability.buffer) merged.availability.interval = merged.availability.buffer;
    if (!merged.availability.slotModes) merged.availability.slotModes = {};
    merged.availability.selected.forEach((slot, index) => {
      if (!merged.availability.slotModes[slot]) {
        merged.availability.slotModes[slot] = index % 2 ? "Online consultation" : "In-person consultation";
      }
    });
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

function saveState(message) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  if (message) showToast(message);
  render();
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
  if (role === "admin" || (role === "trainer" && params.get("temp") === TEMP_PASSWORD)) {
    saveSession(role);
  }
  if (view) state.activeView = view;
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
    ["site", "Trainer Network", "globe"],
    ["trainers", "Trainers", "users"],
    ["leads", "Leads", "lead"],
    ["calendar", "Calendar Queue", "calendar"],
    ["clients", "Clients", "users"],
    ["reports", "Reports", "report"],
    ["settings", "Settings", "settings"]
  ];
}

function trainerNav() {
  return [
    ["dashboard", "Trainer Dashboard", "dashboard"],
    ["setup", "Website Setup", "monitor"],
    ["site", "Customize Site", "edit"],
    ["templates", "Design Templates", "monitor"],
    ["leads", "Lead Inbox", "lead", 3],
    ["calendar", "Calendar", "calendar"],
    ["media", "Photos & Videos", "media"],
    ["reviews", "Reviews", "star"],
    ["domains", "Domains & DNS", "globe"],
    ["business", "Trainer Business Path", "shield"],
    ["settings", "Settings", "settings"]
  ];
}

function renderSidebar() {
  const isAdmin = session.role === "admin";
  const isSetupFlow = !isAdmin && ["setup", "templates"].includes(state.activeView);
  if (isSetupFlow) {
    document.getElementById("sidebar").innerHTML = `
      <a class="brand-card" href="../index.html"><img src="../assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"></a>
      <div>
        <p class="portal-tag">Trainer Network Setup</p>
        <h2 style="margin:6px 0 14px;color:#fff">${state.activeView === "templates" ? "Preview Templates" : "Website Setup Wizard"}</h2>
      </div>
      <div class="setup-steps">
        ${["Business Identity","About & Trust","Services","Media Uploads","Availability","Preview Templates","Customize Site","Review & Publish"].map((step, index) => {
          const active = (state.activeView === "setup" && index === 0) || (state.activeView === "templates" && index === 5);
          const complete = state.activeView === "templates" ? index < 5 : index > 0 && index < 5;
          return `<button class="wizard-step ${active ? "active" : ""} ${complete ? "complete" : ""}" data-view="${index === 5 ? "templates" : index === 6 ? "site" : "setup"}"><span class="step-num">${complete ? "✓" : index + 1}</span><div><strong>${step}</strong><span>${active ? "Current step" : complete ? "Completed" : "Coming next"}</span></div></button>`;
        }).join("")}
      </div>
      <div class="side-spacer"></div>
      <div class="progress-box"><strong>Setup Progress</strong><p>${state.activeView === "templates" ? "Step 6 of 8" : "Step 1 of 8"}</p><div class="progress-line"><span style="width:${state.activeView === "templates" ? "75%" : "12.5%"}"></span></div></div>
      <div class="side-help"><strong>Need Help?</strong><p>Our team is here to help you build the perfect site.</p><button class="btn btn-outline btn-full">Contact Support</button></div>
    `;
    return;
  }
  const nav = isAdmin ? adminNav() : trainerNav();
  document.getElementById("sidebar").innerHTML = `
    <a class="brand-card" href="../index.html"><img src="../assets/lorenzo-logo-transparent.png" alt="Lorenzo's Dog Training Team"></a>
    <div>
      <p class="portal-tag">${isAdmin ? "Admin Portal" : "Trainer Network"}</p>
    </div>
    <nav class="side-nav" aria-label="${isAdmin ? "Admin" : "Trainer"} navigation">
      ${nav.map(([view, label, iconName, count]) => `
        <button class="nav-btn ${state.activeView === view ? "active" : ""}" data-view="${view}">
          ${icon(iconName)}
          <span>${label}</span>
          ${count ? `<span class="nav-count">${count}</span>` : ""}
        </button>
      `).join("")}
    </nav>
    <div class="side-spacer"></div>
    <div class="side-help">
      <strong>${isAdmin ? "Trainer Network" : "Supabase-ready"}</strong>
      <p>${isAdmin ? "Invite trainers, monitor leads, track scheduling outcomes, and review site readiness." : "Demo data saves in this browser now. Website setup, media, leads, and calendar screens are staged for backend connection."}</p>
      ${isAdmin ? `<button class="btn btn-outline btn-full" data-view="site">Invite Trainer</button>` : ""}
    </div>
    <div class="side-user">
      <span class="avatar">${isAdmin ? "LO" : `<img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=90&q=60" alt="">`}</span>
      <div><strong>${isAdmin ? "Lorenzo's Office" : "Eric Beck"}</strong><span>${isAdmin ? "Administrator" : "Certified Lorenzo Trainer"}</span></div>
    </div>
  `;
}

function renderTopbar() {
  const isAdmin = session.role === "admin";
  const titles = isAdmin
    ? {
        dashboard: ["Admin Dashboard", "Overview of your trainer network and lead activity"],
        site: ["Trainer Network", "Invite trainers, review readiness, and open trainer site previews"],
        trainers: ["Trainers", "Directory of active and staged trainers"],
        leads: ["Leads Pipeline", "Office lead management and outcome tracking"],
        calendar: ["Calendar Queue", "Requested evaluations and trainer availability"],
        clients: ["Clients", "Client records across the network"],
        reports: ["Reports", "Network activity and lead outcome reporting"],
        settings: ["Settings", "Admin preferences and demo controls"]
      }
    : {
        dashboard: [`Welcome back, ${state.trainer.trainerName}`, "Here's what's happening with your business."],
        setup: ["Website Setup Wizard", "Your business details automatically populate every template."],
        site: [state.trainer.companyName, "Powered by Lorenzo's Dog Training Team"],
        templates: ["Preview Your Trainer Site", "Your details automatically populate every style. Switch styles without losing your information."],
        leads: ["Leads Pipeline", "Track every lead from new contact to client won."],
        calendar: ["Availability Calendar", "Select the times clients can request from your trainer site."],
        media: ["Media & Reviews Library", "Upload training videos, photos, review screenshots, and testimonials."],
        reviews: ["Reviews", "Collect and showcase proof from real training clients."],
        domains: ["Domains & DNS", "Connect a custom domain to your trainer site."],
        business: ["Trainer Business Path", "Build your client base inside Lorenzo's system."],
        settings: ["Settings", "Trainer profile and demo controls."]
      };
  const [title, sub] = titles[state.activeView] || titles.dashboard;
  document.getElementById("topbar").innerHTML = `
    <div class="page-title"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(sub)}</p></div>
    <div class="top-actions">
      ${isAdmin ? `
        <button class="btn btn-outline">May 12 - May 18, 2025</button>
        <button class="btn btn-outline">${icon("settings")} Filters</button>
        <button class="btn btn-red">Export Report</button>
      ` : `
        <a class="btn btn-outline" href="site.html" target="_blank" rel="noopener">View My Site</a>
        <button class="btn btn-red">${state.activeView === "site" ? "Publish Request" : "Book Evaluation"}</button>
      `}
      <span class="bell">${icon("message")}</span>
      <button class="profile-chip"><span class="avatar"><img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=90&q=60" alt=""></span><span><strong>${isAdmin ? "Eric Beck" : state.trainer.trainerName}</strong><small>${isAdmin ? "Administrator" : "Trainer"}</small></span></button>
    </div>
  `;
}

function renderView() {
  const target = document.getElementById("workspaceView");
  const role = session.role;
  if (role === "admin") {
    target.innerHTML = adminScreens[state.activeView]?.() || adminScreens.dashboard();
  } else {
    target.innerHTML = trainerScreens[state.activeView]?.() || trainerScreens.dashboard();
  }
}

const adminScreens = {
  dashboard() {
    return `
      ${metricGrid([
        ["users", "Total Trainers", "48", "+2 this week", "up"],
        ["monitor", "Active Trainers", "42", "87% of total", ""],
        ["lead", "New Leads", "68", "+14 this week", "up"],
        ["calendar", "Evaluation Booked", "26", "+6 this week", "up"],
        ["calendar", "Follow-Up Scheduled", "31", "+5 this week", "up"],
        ["trophy", "Client Won", "18", "+3 this week", "up"],
        ["settings", "Lost Leads", "9", "+2 this week", "down"]
      ])}
      <div class="dashboard-grid">
        ${panel("Downline Performance <small>(This Month)</small>", `<button class="btn btn-outline">View Full Report</button>`, trainerPerformanceTable())}
        ${panel("Calendar Queue <small>(Requested via Trainer Network)</small>", `<button class="btn btn-outline" data-view="calendar">View Calendar</button>`, calendarQueueTable())}
      </div>
      <div class="bottom-grid">
        ${panel("Lead Outcome <small>(Update Lead Status)</small>", "", leadOutcomeTable())}
        ${panel("Lead Outcome Summary <small>(This Month)</small>", "", leadSummary())}
      </div>
    `;
  },
  site() {
    return `
      <div class="admin-network-grid">
        ${panel("Invite Trainer Into Network", `<button class="btn btn-red" id="stageInvite">Stage Invite</button>`, inviteBuilder(), "pad")}
        ${panel("Onboarding Flow", "", onboardingFlow(), "pad")}
      </div>
      <br>
      ${panel("Trainer Network Readiness", `<button class="btn btn-outline">Bulk Import CSV</button>`, trainerCards())}
    `;
  },
  leads() {
    return pipelineScreen(true);
  },
  calendar() {
    return adminCalendarScreen();
  },
  trainers() {
    return panel("Trainer Directory", `<button class="btn btn-red" data-view="site">Invite Trainer</button>`, trainerPerformanceTable());
  },
  clients() {
    return panel("Clients", "", simpleClientTable());
  },
  reports() {
    return `${metricGrid([["lead","Total Leads","127","+18% this month","up"],["trophy","Client Won","18","+3 this week","up"],["calendar","Evaluations","26","+6 this week","up"],["monitor","Active Sites","42","87% of network",""]])}${panel("Lead Outcome Summary", "", leadSummary())}`;
  },
  settings() {
    return panel("Settings", "", `<p class="panel-copy">Demo settings are staged for Supabase Auth, role permissions, email invitations, SMS invitations, and trainer network import rules.</p><button class="btn btn-outline" id="logoutBtn">Log Out</button>`, "pad");
  }
};

const trainerScreens = {
  dashboard() {
    return `
      <div class="trainer-dashboard-grid">
        ${panel("Today's Overview", `<span>May 12, 2025</span>`, `<div class="overview-strip">${overviewItem("27","Total Leads","+3 this week")}${overviewItem("18","Active Clients","+2 this week")}${overviewItem("5","Evaluations","This week")}${overviewItem("7","Follow-Ups","Due this week")}</div>`, "pad")}
        ${panel("My Trainer Site", `<button class="btn btn-outline" data-open-preview>View Site</button>`, `<div class="site-row"><div><span class="status live">Published</span><p class="panel-copy">ericbeckdogtraining.com</p><p><strong>Theme:</strong> ${escapeHtml(themes[state.selectedTheme][1])}</p><small>Last updated: May 10, 2025</small></div><div class="site-thumb">Professional dog training in Cleveland, OH</div></div>`, "pad")}
        ${panel("Site Health", `<button class="btn btn-outline">View All</button>`, healthList(["Domain: Connected","SSL Certificate: Active","SEO: Good","Mobile Friendly: Passed"]), "pad")}
      </div>
      <div class="dashboard-grid">
        ${panel("Lead Pipeline", `<button class="btn btn-red">+ Add Lead</button><button class="btn btn-outline" data-view="leads">View All Leads</button>`, pipelineBody(false))}
        <div class="grid">
          ${panel("Today's Calendar", `<button class="btn btn-outline">Request-Based Scheduling</button><button class="btn btn-outline">View Calendar</button>`, calendarSlots(), "pad")}
          ${panel("Quick Actions", "", `<div class="quick-actions"><button class="btn btn-light">Add New Lead</button><button class="btn btn-light">Book Evaluation</button><button class="btn btn-light" data-view="media">Upload Media</button><button class="btn btn-light">Request Review</button></div>`, "pad")}
        </div>
      </div>
      <div class="dashboard-grid">
        ${panel("Site Performance <small>(This Month)</small>", "", `<div class="overview-strip">${overviewItem("1,248","Website Visitors","+18% last month")}${overviewItem("67","Evaluation Requests","+12% last month")}${overviewItem("23","New Leads","+15% last month")}${overviewItem("8","5-Star Reviews","+2 vs last month")}</div>`, "pad")}
        ${panel("Media Center", "", `<div class="overview-strip">${overviewItem("12","Videos","Files")}${overviewItem("48","Photos","Files")}${overviewItem("6","Review Screenshots","Pending Approval")}</div><button class="btn btn-outline btn-full" data-view="media">Go to Media Library</button>`, "pad")}
      </div>
    `;
  },
  setup() {
    return wizardScreen();
  },
  templates() {
    return themePickerScreen();
  },
  site() {
    return builderScreen();
  },
  leads() {
    return pipelineScreen(false);
  },
  calendar() {
    return trainerAvailabilityScreen();
  },
  media() {
    return mediaLibraryScreen();
  },
  reviews() {
    return mediaLibraryScreen("Reviews");
  },
  domains() {
    return panel("Domains & DNS", "", `<p class="panel-copy">Connect the trainer's custom domain by adding the generated DNS records. Real domain verification will connect after backend setup.</p><div class="staged-link">CNAME www.ericbeckdogtraining.com → trainer-sites.lorenzosdogtrainingteam.com</div>`, "pad");
  },
  business() {
    return panel("Trainer Business Path", "", `<h2>Become a Professional Trainer</h2><p class="panel-copy">Build your client base, manage your territory, and grow inside Lorenzo's Academy / Certification system. In business for yourself, but not by yourself.</p>`, "pad");
  },
  settings() {
    return adminScreens.settings();
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

function trainerPerformanceTable() {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Trainer</th><th>New Leads</th><th>Booked Evaluations</th><th>Client Won</th><th>Active Site</th></tr></thead><tbody>${trainers.map((trainer, index) => `
    <tr><td><div class="row-person"><span class="avatar"><img src="https://images.unsplash.com/photo-${index % 2 ? "1494790108377-be9c29b29330" : "1560250097-0b93528c311a"}?auto=format&fit=crop&w=90&q=60" alt=""></span><div><strong>${trainer[0]}</strong><small>${trainer[1]}</small></div></div></td><td><strong>${trainer[2]}</strong></td><td><strong>${trainer[3]}</strong></td><td><strong>${trainer[4]}</strong></td><td><span class="status ${trainer[5] === "Live" ? "live" : "draft"}">${trainer[5]}</span></td></tr>`).join("")}</tbody></table></div>`;
}

function calendarQueueTable() {
  return `<div class="table-wrap"><table class="data-table queue-table"><thead><tr><th>Date & Time</th><th>Client / Dog</th><th>Requested Service</th><th>Trainer</th><th>Actions</th></tr></thead><tbody>${leads.slice(0, 5).map((lead, index) => `
    <tr><td>May ${12 + index}<small>${index === 0 ? "Today" : index === 1 ? "Today" : "Tomorrow"}, ${index % 2 ? "1:00 PM" : "10:00 AM"}</small></td><td><div class="row-person"><span class="dog-avatar"><img src="${dogImages[index % dogImages.length]}" alt=""></span><div><strong>${lead[0]}</strong><small>${lead[1]} (${lead[2].split(" ")[0]})</small></div></div></td><td>${lead[4]}</td><td><div class="row-person"><span class="avatar"><img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=90&q=60" alt=""></span><div><strong>${trainers[index % trainers.length][0]}</strong><small>${trainers[index % trainers.length][1]}</small></div></div></td><td><button class="btn btn-outline">View</button></td></tr>`).join("")}</tbody></table></div>`;
}

function adminCalendarScreen() {
  return `<div class="admin-calendar-layout">
    ${panel("Calendar Queue", `<button class="btn btn-outline">View Calendar</button>`, calendarQueueTable())}
    ${panel("Trainer Availability Snapshot", `<button class="btn btn-red">Schedule Selected</button>`, availabilitySummary(), "pad")}
  </div>
  <br>
  ${panel("Office Scheduling Outcome", "", `<div class="table-wrap"><table class="data-table"><thead><tr><th>Client / Dog</th><th>Trainer</th><th>Requested Time</th><th>Office Outcome</th><th>Reason / Note</th></tr></thead><tbody>${leads.slice(0, 5).map((lead, index) => `<tr><td><strong>${lead[0]}</strong><small>${lead[1]} (${lead[2]})</small></td><td>${trainers[index % trainers.length][0]}</td><td>${availabilityLabel(index)}</td><td><select class="select-pill"><option>Scheduled</option><option>Follow-up scheduled</option><option>Client did not choose service</option><option>Needs office review</option></select></td><td><input class="select-pill note-input" placeholder="Office note or lost reason"></td></tr>`).join("")}</tbody></table></div>`)}
  `;
}

function leadOutcomeTable() {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Lead Date</th><th>Client / Dog</th><th>Service Interest</th><th>Current Status</th><th>Reason (if Lost)</th><th>Actions</th></tr></thead><tbody>${leads.map((lead, index) => `
    <tr><td>May ${12 - index}, 2025</td><td><div class="row-person"><span class="dog-avatar"><img src="${dogImages[index % dogImages.length]}" alt=""></span><div><strong>${lead[0]}</strong><small>${lead[1]} (${lead[2]})</small></div></div></td><td>${lead[4]}</td><td><select class="select-pill" data-lead-index="${index}">${["New","Contacted","Evaluation Booked","Follow-Up Scheduled","Program Offered","Client Won","Lost"].map(status => `<option ${lead[5] === status ? "selected" : ""}>${status}</option>`).join("")}</select></td><td>${lead[5] === "Lost" ? `<select class="select-pill"><option>Price concern</option><option>No response</option><option>Chose another trainer/company</option><option>Location issue</option></select>` : "—"}</td><td><button class="btn btn-red">Update</button></td></tr>`).join("")}</tbody></table></div>`;
}

function leadSummary() {
  const labels = [["New", 68, "#246bfe"], ["Contacted", 18, "#69b6ff"], ["Evaluation Booked", 14, "#7759d8"], ["Follow-Up Scheduled", 10, "#ff9f1a"], ["Program Offered", 8, "#20a566"], ["Client Won", 18, "#0b7e49"], ["Lost", 9, "#d20f32"]];
  return `<div class="donut-panel"><div class="donut"></div><div class="legend">${labels.map(([name, value, color]) => `<div class="legend-row"><span class="dot" style="background:${color}"></span><span>${name}</span><strong>${value}</strong></div>`).join("")}</div></div>`;
}

function availabilityKey(day, time) {
  return `${day}|${time}`;
}

function isAvailable(day, time) {
  return state.availability.selected.includes(availabilityKey(day, time));
}

function availabilityLabel(index = 0) {
  const selected = state.availability.selected[index % Math.max(state.availability.selected.length, 1)] || "No time selected";
  return selected === "No time selected" ? selected : `${selected.replace("|", " · ")} · ${slotModeLabel(selected)}`;
}

function openCountForDay(day) {
  return state.availability.selected.filter(slot => slot.startsWith(`${day}|`)).length;
}

function selectedTheme() {
  return themes[state.selectedTheme] || themes[0];
}

function selectedThemeImage() {
  return themeImages[state.selectedTheme] || themeImages[0];
}

function themeClass() {
  const group = selectedTheme()[0];
  if (group === "Premium Local Pro") return "theme-premium";
  if (group === "Advanced Specialty") return "theme-advanced";
  return "theme-classic";
}

function companyLogo() {
  return state.trainer.logoData || "../assets/lorenzo-logo-transparent.png";
}

function slotModeLabel(slot) {
  return state.availability.slotModes?.[slot] || state.availability.slotType || "In-person consultation";
}

function slotModeClass(slot) {
  return slotModeLabel(slot).toLowerCase().includes("online") ? "online" : "inperson";
}

function availabilitySummary() {
  const inPerson = state.availability.selected.filter(slot => slotModeClass(slot) === "inperson").length;
  const online = state.availability.selected.filter(slot => slotModeClass(slot) === "online").length;
  return `<div class="availability-summary">
    <div><strong>${state.availability.selected.length}</strong><span>Open request slots</span></div>
    <div><strong>${inPerson} / ${online}</strong><span>In-person / online</span></div>
    <div><strong>${state.availability.interval}</strong><span>Time intervals</span></div>
  </div>
  <div class="available-pill-row">${state.availability.selected.slice(0, 12).map(slot => `<span class="${slotModeClass(slot)}">${slot.replace("|", " · ")} · ${slotModeLabel(slot).replace(" consultation", "")}</span>`).join("") || "<span>No open times selected</span>"}</div>`;
}

function trainerAvailabilityScreen() {
  return `<div class="availability-layout">
    <section class="panel pad">
      <div class="calendar-head">
        <div><p class="step-label">Trainer Availability</p><h2>Select times clients can request.</h2><p class="panel-copy">Choose whether each available window is for an in-person consultation or an online consultation. These times appear on your trainer site exactly as selected.</p></div>
        <div class="row-actions"><button class="btn btn-outline" id="clearAvailability">Clear</button><button class="btn btn-red" id="saveAvailability">Save Availability</button></div>
      </div>
      <div class="availability-tools">
        <label>Availability Type<select name="availability-slotType"><option ${state.availability.slotType === "In-person consultation" ? "selected" : ""}>In-person consultation</option><option ${state.availability.slotType === "Online consultation" ? "selected" : ""}>Online consultation</option></select></label>
        <label>Time Intervals<select name="availability-interval"><option ${state.availability.interval === "15 min" ? "selected" : ""}>15 min</option><option ${state.availability.interval === "30 min" ? "selected" : ""}>30 min</option><option ${state.availability.interval === "45 min" ? "selected" : ""}>45 min</option><option ${state.availability.interval === "60 min" ? "selected" : ""}>60 min</option></select></label>
        <div class="mode-hint"><strong>How to use it</strong><span>Pick a type, then click times below. Click an open time again with another type selected to switch it.</span></div>
      </div>
      <div class="availability-calendar">
        <div class="time-spacer"></div>${availabilityDays.map(day => `<div class="day-head">${day}<small>${openCountForDay(day)} open</small></div>`).join("")}
        ${availabilityTimes.map(time => `<div class="time-head">${time}</div>${availabilityDays.map(day => { const key = availabilityKey(day, time); const available = isAvailable(day, time); return `<button class="slot-cell ${available ? `available ${slotModeClass(key)}` : ""}" data-slot="${key}"><strong>${available ? "Available" : "Closed"}</strong>${available ? `<small class="slot-mode ${slotModeClass(key)}">${slotModeClass(key) === "online" ? "Online" : "In person"}</small>` : `<small>Click to add</small>`}</button>`; }).join("")}`).join("")}
      </div>
    </section>
    ${panel("Site Preview: Requestable Times", `<button class="btn btn-outline" data-view="site">View Site Builder</button>`, availabilitySummary(), "pad")}
  </div>`;
}

function inviteBuilder() {
  const link = `${location.origin}${location.pathname}?role=trainer&temp=${TEMP_PASSWORD}&name=${encodeURIComponent(state.inviteDraft.name || "New Trainer")}&market=${encodeURIComponent(state.inviteDraft.market || "Market Pending")}`;
  return `
    <div class="invite-box">
      <div class="field"><label>Trainer Name<input name="invite-name" value="${escapeHtml(state.inviteDraft.name)}" placeholder="Trainer name"></label></div>
      <div class="field"><label>Email<input name="invite-email" value="${escapeHtml(state.inviteDraft.email)}" placeholder="trainer@email.com"></label></div>
      <div class="field"><label>Phone<input name="invite-phone" value="${escapeHtml(state.inviteDraft.phone)}" placeholder="(555) 555-5555"></label></div>
      <div class="field"><label>Market / Territory<input name="invite-market" value="${escapeHtml(state.inviteDraft.market)}" placeholder="Cleveland, OH"></label></div>
    </div>
    <br><div class="staged-link" id="inviteLink">${escapeHtml(link)}</div>
    <br><div class="row-actions"><button class="btn btn-outline" id="copyInvite">Copy Link</button><a class="btn btn-outline" href="mailto:?subject=Your Lorenzo trainer portal is ready&body=${encodeURIComponent(link)}">Email Invite</a><a class="btn btn-outline" href="sms:?&body=${encodeURIComponent(link)}">Text Invite</a></div>
    ${state.stagedInvites.length ? `<br><h3>Staged Invites</h3>${state.stagedInvites.map(invite => `<div class="staged-link"><strong>${escapeHtml(invite.name)}</strong><br>${escapeHtml(invite.link)}</div>`).join("<br>")}` : ""}
  `;
}

function onboardingFlow() {
  return `<div class="checklist">${["Send onboarding invite","Trainer logs in with doglovers26","Trainer creates permanent password","Portal tutorial starts","Trainer completes site setup","Admin sees Trainer Portal Ready"].map((item, index) => `<div class="checkline"><span class="step-num">${index + 1}</span><div><strong>${item}</strong><small>${index === 0 ? "Copy, email, or text the invite link." : "Connected to backend later."}</small></div></div>`).join("")}</div>`;
}

function trainerCards() {
  return `<div class="trainer-card-grid">${trainers.map((trainer, index) => `<article class="network-card"><div class="site-thumb">${trainer[0]}<br>${trainer[1]}</div><h3>${trainer[0]}</h3><p>${trainer[1]} · Temp password: ${TEMP_PASSWORD}</p><div class="row-actions"><span class="status ${trainer[5] === "Live" ? "live" : "draft"}">${trainer[5] === "Live" ? "Trainer Portal Ready" : "Draft Site"}</span><button class="btn btn-outline" data-open-preview>View Trainer Site</button></div></article>`).join("")}</div>`;
}

function pipelineScreen(admin) {
  return `${panel(admin ? "Leads Pipeline" : "Lead Pipeline", `<button class="btn btn-outline">All Sources</button><button class="btn btn-red">+ Add Lead</button>`, pipelineBody(true), "pad")}`;
}

function pipelineBody(showSearch) {
  const counts = [["New", 27], ["Contacted", 18], ["Evaluation Booked", 12], ["Program Offered", 8], ["Client Won", 24], ["Lost", 6]];
  return `
    <div class="pipeline-tabs">${counts.map(([label, count]) => `<article><span>${label}</span><strong>${count}</strong></article>`).join("")}</div>
    ${showSearch ? `<div class="row-actions" style="margin-bottom:12px"><input class="select-pill" style="min-width:260px" placeholder="Search leads..."><button class="btn btn-outline">Filters</button><button class="btn btn-outline">Export</button></div>` : ""}
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Owner / Dog</th><th>Breed</th><th>Service Interest</th><th>Status</th><th>Next Follow-Up</th><th>Admin Office Note</th></tr></thead><tbody>${leads.map((lead, index) => `<tr><td><div class="row-person"><span class="dog-avatar"><img src="${dogImages[index % dogImages.length]}" alt=""></span><div><strong>${lead[0]}</strong><small>${lead[1]}</small></div></div></td><td>${lead[2]}</td><td>${lead[4]}</td><td><span class="status ${statusClass(lead[5])}">${lead[5]}</span></td><td>${lead[6]}</td><td>${lead[7] || "—"}</td></tr>`).join("")}</tbody></table></div>`;
}

function wizardScreen() {
  return `<div class="wizard-layout wizard-layout-simple">
    <div class="wizard-main">
      <section class="wizard-card"><span class="step-label">Step 1 of 8</span><h2>Business Identity</h2><p class="panel-copy">Let's start with your business details. This information will automatically populate your website templates and pages.</p><div class="info-callout">${icon("lead")}<div><strong>Lorenzo's Dog Training Team appears by default until your company name is added.</strong><br>You only need to enter this once. We'll use it everywhere on your site.</div></div>${businessForm()}</section>
      <section class="panel pad"><div class="row-actions" style="justify-content:space-between"><button class="btn btn-outline">Save Draft</button><div><button class="btn btn-outline">Back</button> <button class="btn btn-red" data-view="templates">Continue</button></div></div></section>
    </div>
    <div class="wizard-side">
      ${panel("Live Header Preview", "", headerPreview(), "pad")}
      ${panel("Completion Checklist", "", completionChecklist(), "pad")}
      ${panel("What's next?", "", `<p class="panel-copy">Next, you'll tell your story and add credentials to build trust with your future clients.</p>`, "pad")}
    </div>
  </div>`;
}

function businessForm() {
  const t = state.trainer;
  const fields = [["companyName","Company Name *"],["slogan","Company Slogan"],["trainerName","Trainer Name *"],["title","Trainer Title"],["phone","Phone *"],["email","Email *"],["market","City / State *"],["serviceArea","Service Area *"]];
  return `<div class="form-grid"><div class="field"><label>Company Logo<input type="file" name="trainer-logoData-file" accept="image/*"></label><div class="logo-preview">${state.trainer.logoData ? `<img src="${state.trainer.logoData}" alt="">` : `<img src="${companyLogo()}" alt="">`}</div></div>${fields.map(([key, label]) => `<div class="field"><label>${label}<input name="trainer-${key}" value="${escapeHtml(t[key])}"></label></div>`).join("")}${["instagram","facebook","google"].map(key => `<div class="field"><label>${key[0].toUpperCase() + key.slice(1)}<input name="trainer-${key}" value="${escapeHtml(t[key])}"></label></div>`).join("")}</div>`;
}

function headerPreview() {
  return `<div class="header-preview"><div class="preview-tabs"><span>Before (Default)</span><span class="active">After (Your Company)</span></div><div class="mock-header"><img src="../assets/lorenzo-logo-transparent.png" alt=""><nav class="mock-nav"><a>Services</a><a>About</a><a>Reviews</a><a>Contact</a><button class="btn btn-red">Book Evaluation</button></nav></div><div class="mock-header"><img src="${companyLogo()}" alt=""><strong>${escapeHtml(state.trainer.companyName)}<small>Powered by Lorenzo's Dog Training Team</small></strong><nav class="mock-nav"><a>Services</a><a>About</a><a>Reviews</a><a>Contact</a><button class="btn btn-red">Book Evaluation</button></nav></div></div>`;
}

function completionChecklist() {
  return `<div class="checklist">${["Company Name","Phone Number","Service Area","At least 1 Social Link"].map((item, index) => `<div class="checkline"><span class="check">${index === 1 ? "✓" : "○"}</span><div><strong>${item}</strong><small>${index === 1 ? "Add your primary phone number" : "Required before continuing"}</small></div></div>`).join("")}</div>`;
}

function themePickerScreen() {
  const groups = ["Lorenzo Classic", "Premium Local Pro", "Advanced Specialty"];
  return `<div class="theme-toolbar"><button class="btn btn-outline" data-view="dashboard">← Back to Trainer Office</button><span class="selected-template-pill">Using: ${escapeHtml(selectedTheme()[1])}</span><a class="btn btn-outline" href="site.html" target="_blank" rel="noopener">Open Selected Site</a></div><div class="theme-layout"><div>${groups.map(group => `<section class="theme-section"><div class="theme-title"><h2>${groups.indexOf(group) + 1}. ${group}</h2><p>${group === "Lorenzo Classic" ? "Timeless layouts with a focus on trust and results." : group === "Premium Local Pro" ? "Modern, premium designs that showcase expertise and local trust." : "Purpose-built layouts for specialty and advanced training businesses."}</p><strong>4 Styles</strong></div><div class="theme-grid">${themes.map((theme, index) => theme[0] === group ? themeCard(theme, index) : "").join("")}</div></section>`).join("")}</div>${profileCard()}</div>`;
}

function themeCard(theme, index) {
  return `<article class="theme-card"><div class="theme-shot" style="background-image:linear-gradient(90deg, rgba(3,24,51,.9), rgba(3,24,51,.18)), url('${themeImages[index]}')"><strong>${theme[2]}</strong><button class="btn btn-red" style="width:max-content;margin-top:10px">Book an Evaluation</button></div><div class="theme-body"><h3>${theme[1]}</h3><p><span class="status live">${theme[3]}</span></p><div class="row-actions"><button class="btn btn-outline" data-theme="${index}">Preview Desktop</button><button class="btn btn-outline" data-theme="${index}">Preview Mobile</button></div><button class="btn btn-red btn-full" data-theme="${index}">${state.selectedTheme === index ? "Selected" : "Use This Style"}</button></div></article>`;
}

function profileCard() {
  return `<aside class="panel profile-card"><button class="btn btn-outline" style="float:right" data-view="setup">Edit Details</button><img class="profile-logo" src="${companyLogo()}" alt=""><h2>Your Saved Site Profile</h2><h3>${escapeHtml(state.trainer.companyName)}</h3><p class="panel-copy">${escapeHtml(state.trainer.slogan)}</p><p><span class="selected-template-pill">Template: ${escapeHtml(selectedTheme()[1])}</span></p><ul class="profile-list"><li>${icon("users")}<div><strong>Trainer Name</strong><span>${escapeHtml(state.trainer.trainerName)}<br>${escapeHtml(state.trainer.title)}</span></div></li><li>${icon("globe")}<div><strong>Location</strong><span>${escapeHtml(state.trainer.market)}<br>Serving Northeast Ohio</span></div></li><li>${icon("message")}<div><strong>Phone</strong><span>${escapeHtml(state.trainer.phone)}</span></div></li><li>${icon("media")}<div><strong>Media Uploaded</strong><span>12 photos, 6 videos, 6 reviews</span></div></li></ul><button class="btn btn-outline btn-full" data-view="setup">Back to Edit Details</button><br><br><button class="btn btn-red btn-full" data-view="site">Continue to Customize Header & Hero</button></aside>`;
}

function builderScreen() {
  return `<div class="builder-layout"><aside class="builder-panel"><button class="btn btn-outline btn-full" data-view="templates">← Back to Templates</button><br><h2>Section Flow</h2><p class="panel-copy">Drag to reorder approved sections.</p><div class="section-stack">${["Header","Hero","Services","Reviews","Training Videos","Photo Gallery","Availability Calendar","Consultation Form","About Trainer","Service Area","FAQ","Final CTA"].map((section, index) => `<div class="section-item ${index < 2 || index === 11 ? "locked" : ""}"><span>${section}</span><span>${index < 2 || index === 11 ? "Locked" : "⋮⋮"}</span></div>`).join("")}</div><br><button class="btn btn-navy btn-full">+ Add Section</button></aside><main class="site-canvas ${themeClass()}">${siteCanvas()}</main><aside class="builder-panel">${heroSettings()}</aside></div>`;
}

function siteCanvas() {
  return `<div class="canvas-top"><strong>Desktop Preview</strong><span class="selected-template-pill">Template: ${escapeHtml(selectedTheme()[1])}</span><div class="canvas-tabs"><button>Lorenzo Default</button><button class="active">Company Name</button><button>Company Logo</button><button>Trainer Name</button></div></div><div class="site-header-preview"><div class="site-company-lockup"><img class="site-company-logo" src="${companyLogo()}" alt=""><strong>${escapeHtml(state.trainer.companyName)}<small>${escapeHtml(state.trainer.market)} · Powered by Lorenzo's Dog Training Team</small></strong></div><nav class="mock-nav"><a>Services</a><a>About</a><a>Reviews</a><a>Contact</a><button class="btn btn-red">Book Evaluation</button></nav></div><section class="hero-preview" style="background-image:linear-gradient(90deg, rgba(3,24,51,.92), rgba(3,24,51,.26)), url('${selectedThemeImage()}')"><div><span class="selected-template-pill light">${escapeHtml(selectedTheme()[0])}</span><div class="editable-box"><h2>${escapeHtml(state.trainer.headline || selectedTheme()[2])}</h2></div><div class="editable-box"><p>${escapeHtml(state.trainer.subheadline)}</p></div><div class="row-actions"><button class="btn btn-red">${escapeHtml(state.trainer.cta)}</button><button class="btn btn-outline">View Services</button></div><p style="margin-top:16px">Powered by Lorenzo's Dog Training Team</p></div></section><section class="service-preview"><p class="step-label">Our Services</p><h2>Training services built for real dogs and real owners.</h2><div class="service-cards">${["Obedience Training","Behavior Modification","Puppy Training","Board & Train"].map(service => `<article>${icon("shield")}<strong>${service}</strong><p class="panel-copy">Real-world results and owner leadership.</p></article>`).join("")}</div></section><section class="availability"><p class="step-label">Upcoming Availability</p><h2>Request an evaluation time.</h2><p class="panel-copy">Choose an available in-person or online consultation time from this trainer.</p><div class="calendar-grid">${state.availability.selected.slice(0, 6).map(slot => `<article><strong>${slot.split("|")[0]}</strong><button class="btn btn-outline">${slot.split("|")[1]}</button><small class="slot-mode ${slotModeClass(slot)}">${slotModeClass(slot) === "online" ? "Online" : "In person"}</small></article>`).join("") || `<article><strong>No times yet</strong><button class="btn btn-outline" data-view="calendar">Set Availability</button></article>`}</div></section>`;
}

function heroSettings() {
  const t = state.trainer;
  return `<h2>Hero Settings</h2><p class="panel-copy">Customize your hero section content.</p><div class="setting-stack"><div class="field"><label>Company Logo<input type="file" name="trainer-logoData-file" accept="image/*"></label><div class="logo-preview">${state.trainer.logoData ? `<img src="${state.trainer.logoData}" alt="">` : `<img src="${companyLogo()}" alt="">`}</div></div><div class="field"><label>Headline<textarea name="trainer-headline">${escapeHtml(t.headline)}</textarea></label></div><div class="field"><label>Subheadline<textarea name="trainer-subheadline">${escapeHtml(t.subheadline)}</textarea></label></div><div class="field"><label>CTA Button Text<input name="trainer-cta" value="${escapeHtml(t.cta)}"></label></div><div class="media-image" style="border-radius:10px;background-image:url('${selectedThemeImage()}')"></div><button class="btn btn-outline btn-full" data-view="templates">Change Template Image</button><div class="toggle-row"><strong>Show Lorenzo trust mark</strong><span class="toggle"></span></div><div class="field"><label>Header Style<select><option>${escapeHtml(selectedTheme()[1])}</option></select></label></div><button class="btn btn-red btn-full">Apply Changes</button></div>`;
}

function mediaLibraryScreen(title = "Media Library") {
  const cards = [["Heel Training Session","Video · trainer media","Published"],["Client Before / After","Video · progress proof","Published"],["Place Command","Video · obedience clip","Pending"],["Recall Practice","Video · field work","Published"],["Trainer Headshot","Photo · profile image","Published"],["Training Dog Gallery","Photo · site gallery","Published"],["Google Review Screenshot","Review · proof asset","Published"],["Facebook Review Screenshot","Review · pending approval","Pending"]];
  return `<section class="panel pad"><div class="panel-head"><h2>${title}</h2><button class="btn btn-red">Upload Now</button></div><p class="panel-copy" style="margin-bottom:14px">Trainer media library for each white-label site: videos, dog photos, review screenshots, logos, and testimonial assets.</p><div class="media-tabs"><button class="active">All</button><button>Videos</button><button>Photos</button><button>Screenshots</button><button>Logos</button><button>Reviews</button><button>Testimonials</button></div><div class="media-grid">${cards.map((card, index) => `<article class="media-card"><div class="media-image" style="background-image:url('${mediaImages[index]}')">${index < 4 ? `<span class="play-badge">▶</span>` : ""}</div><div class="media-body"><h3>${card[0]}</h3><p>${card[1]}</p><span class="status ${card[2] === "Published" ? "live" : "draft"}">${card[2]}</span></div></article>`).join("")}</div><div class="storage-bar"><span></span></div><p class="panel-copy">Storage Used: 2.4 GB of 10 GB</p></section>`;
}

function calendarSlots() {
  const slots = state.availability.selected.slice(0, 6);
  return `<div class="calendar-list">${slots.map(slot => { const [day, time] = slot.split("|"); return `<div class="time-slot"><strong>${time}</strong><div>${day}<small><span class="slot-mode ${slotModeClass(slot)}">${slotModeClass(slot) === "online" ? "Online" : "In person"}</span> · ${state.availability.interval} intervals</small></div><button class="btn btn-outline">Request This Time</button></div>`; }).join("") || `<div class="time-slot"><strong>--</strong><div>No requestable times yet<small>Set availability from Calendar</small></div><button class="btn btn-outline" data-view="calendar">Set Times</button></div>`}</div>`;
}

function overviewItem(value, label, note) {
  return `<div class="overview-item"><strong>${value}</strong><span>${label}</span><small class="up">${note}</small></div>`;
}

function healthList(items) {
  return `<ul class="health-list">${items.map(item => `<li><span><span class="check">✓</span> ${item}</span></li>`).join("")}</ul>`;
}

function simpleClientTable() {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Client</th><th>Dog</th><th>Program</th><th>Status</th></tr></thead><tbody>${leads.slice(0, 5).map((lead, i) => `<tr><td>${lead[0]}</td><td>${lead[1]}</td><td>${lead[4]}</td><td><span class="status ${statusClass(lead[5])}">${lead[5]}</span></td></tr>`).join("")}</tbody></table></div>`;
}

function statusClass(status) {
  if (status === "Client Won") return "won";
  if (status === "Lost") return "lost";
  if (status === "Program Offered") return "offered";
  if (status.includes("Follow")) return "follow";
  if (status.includes("Booked") || status === "New") return "booked";
  return "connected";
}

function renderPublicSite() {
  const target = document.getElementById("publicSite");
  if (!target) return;
  target.innerHTML = `<div class="site-canvas ${themeClass()}" style="border:0;border-radius:0;box-shadow:none">${siteCanvas()}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("click", (event) => {
  const loginRole = event.target.closest("[data-login-role]");
  if (loginRole) {
    saveSession(loginRole.dataset.loginRole);
    state.activeView = "dashboard";
    saveState(`${loginRole.dataset.loginRole === "admin" ? "Admin" : "Trainer"} portal opened`);
    return;
  }
  const view = event.target.closest("[data-view]");
  if (view) {
    state.activeView = view.dataset.view;
    saveState();
    return;
  }
  const theme = event.target.closest("[data-theme]");
  if (theme) {
    state.selectedTheme = Number(theme.dataset.theme);
    saveState("Theme selected");
    return;
  }
  if (event.target.closest("[data-open-preview]")) {
    window.open("site.html", "_blank", "noopener");
    return;
  }
  if (event.target.id === "stageInvite") {
    const link = document.getElementById("inviteLink")?.textContent || "";
    state.stagedInvites.unshift({ name: state.inviteDraft.name || "New Trainer", link });
    saveState("Trainer invite staged");
    return;
  }
  if (event.target.id === "copyInvite") {
    navigator.clipboard?.writeText(document.getElementById("inviteLink")?.textContent || "");
    showToast("Invite link copied");
    return;
  }
  const slot = event.target.closest("[data-slot]");
  if (slot) {
    const value = slot.dataset.slot;
    const currentMode = state.availability.slotModes?.[value];
    const nextMode = state.availability.slotType || "In-person consultation";
    if (!state.availability.slotModes) state.availability.slotModes = {};
    if (state.availability.selected.includes(value)) {
      if (currentMode !== nextMode) {
        state.availability.slotModes[value] = nextMode;
      } else {
        state.availability.selected = state.availability.selected.filter(item => item !== value);
        delete state.availability.slotModes[value];
      }
    } else {
      state.availability.selected = [...state.availability.selected, value];
      state.availability.slotModes[value] = nextMode;
    }
    saveState();
    return;
  }
  if (event.target.id === "clearAvailability") {
    state.availability.selected = [];
    state.availability.slotModes = {};
    saveState("Availability cleared");
    return;
  }
  if (event.target.id === "saveAvailability") {
    saveState("Availability saved to trainer site preview");
    return;
  }
  if (event.target.id === "logoutBtn") {
    session = { loggedIn: false, role: "" };
    sessionStorage.removeItem(SESSION_KEY);
    render();
  }
});

document.addEventListener("input", (event) => {
  const field = event.target;
  if (field.name?.startsWith("trainer-")) {
    if (field.type === "file") return;
    const key = field.name.replace("trainer-", "");
    state.trainer[key] = field.value;
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    render();
  }
  if (field.name?.startsWith("invite-")) {
    const key = field.name.replace("invite-", "");
    state.inviteDraft[key] = field.value;
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    render();
  }
  if (field.name?.startsWith("availability-")) {
    const key = field.name.replace("availability-", "");
    state.availability[key] = field.type === "checkbox" ? field.checked : field.value;
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    render();
  }
});

document.addEventListener("change", (event) => {
  const field = event.target;
  if (field.name === "trainer-logoData-file" && field.files?.[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      state.trainer.logoData = reader.result;
      saveState("Company logo updated");
    };
    reader.readAsDataURL(field.files[0]);
  }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "loginForm") {
    const username = event.target.elements.username.value.trim().toLowerCase();
    saveSession(username === "admin" ? "admin" : "trainer");
    state.activeView = "dashboard";
    saveState("Portal opened");
  }
});

render();
