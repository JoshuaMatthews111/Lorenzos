const STORE_KEY = "lorenzoTrainerSitesPortal.v2";
const SESSION_KEY = "lorenzoTrainerSitesSession.v1";

const templates = [
  {
    key: "local-service",
    name: "Local Service",
    label: "Dog Training Near Me",
    description: "For obedience, puppy structure, behavior modification, and local family leads."
  },
  {
    key: "premium-authority",
    name: "Premium Authority",
    label: "Professional Trainer",
    description: "For established trainers who need proof, reviews, leadership, and a polished consultation path."
  },
  {
    key: "advanced-specialty",
    name: "Advanced Specialty",
    label: "Specialty Training",
    description: "For protection, service dog, assistance, scent work, retrieval, utility, and advanced control."
  }
];

const services = [
  ["Obedience Training", "Heel, sit, stay, come, down, sit-stay, and down-stay."],
  ["Behavior Modification", "Jumping, chewing, barking, house soiling, leash pulling, and aggression concerns."],
  ["Puppy Training", "Housebreaking, manners, family structure, and early boundaries."],
  ["Protection Training", "Advanced protection training for qualified businesses, homes, and handlers."],
  ["Service Dog Training", "Task support for owners with physical disabilities or handicap-related needs."],
  ["Scent Work & Retrieval", "Scent work, object retrieval, utility tasks, and focused advanced work."]
];

const demoLeads = [
  {
    id: "lead-1",
    name: "Stephanie Palmer",
    phone: "(216) 555-0198",
    email: "stephanie@example.com",
    dog: "Hunter",
    need: "Behavior modification",
    message: "My dog pulls on leash and reacts around other dogs. I want an evaluation.",
    status: "new"
  },
  {
    id: "lead-2",
    name: "Rebecca Rottman",
    phone: "(440) 555-0144",
    email: "rebecca@example.com",
    dog: "Maverick",
    need: "Obedience training",
    message: "We need help with commands, boundaries, and reliable listening at home.",
    status: "contacted"
  },
  {
    id: "lead-3",
    name: "Rene Stephan",
    phone: "(330) 555-0138",
    email: "rene@example.com",
    dog: "Koda",
    need: "Trainer career path",
    message: "I am interested in becoming a certified trainer and building a territory.",
    status: "evaluation-booked"
  }
];

const TEMP_TRAINER_PASSWORD = "doglovers26";

const demoTrainers = [
  {
    id: "trainer-eric-beck",
    trainerName: "Eric Beck",
    businessName: "Cleveland Dog Training by Lorenzo's Team",
    market: "Cleveland",
    state: "OH",
    phone: "(866) 436-4959",
    email: "trainer@lorenzosdogtrainingteam.com",
    serviceArea: "Cleveland, Garfield Heights, Akron, and surrounding Northeast Ohio communities.",
    portalStatus: "ready",
    temporaryPassword: TEMP_TRAINER_PASSWORD
  },
  {
    id: "trainer-robert",
    trainerName: "Robert",
    businessName: "Lorenzo's Dog Training Team",
    market: "Northeast Ohio",
    state: "OH",
    phone: "(866) 436-4959",
    email: "office@lorenzosdogtrainingteam.com",
    serviceArea: "Ohio dog training clients",
    portalStatus: "ready",
    temporaryPassword: TEMP_TRAINER_PASSWORD
  },
  {
    id: "trainer-bruce-maldonado",
    trainerName: "Bruce Maldonado",
    businessName: "Lorenzo's Dog Training Team",
    market: "Local Market",
    state: "US",
    phone: "(866) 436-4959",
    email: "office@lorenzosdogtrainingteam.com",
    serviceArea: "Local dog training service area",
    portalStatus: "ready",
    temporaryPassword: TEMP_TRAINER_PASSWORD
  }
];

const pipelineStages = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["evaluation-booked", "Evaluation Booked"],
  ["follow-up-scheduled", "Follow-up Scheduled"],
  ["program-offered", "Program Offered"],
  ["client-won", "Client Won"],
  ["lost", "Lost"]
];

const defaultState = {
  published: false,
  activeView: "dashboard",
  template: "local-service",
  services: ["Obedience Training", "Behavior Modification", "Puppy Training"],
  auth: {
    trainerPasswordSet: false,
    trainerPassword: TEMP_TRAINER_PASSWORD,
    tutorialDismissed: false
  },
  trainerAccounts: demoTrainers,
  pendingImports: [],
  stagedInvites: [],
  trainer: {
    companyLogoData: "",
    trainerName: "Eric Beck",
    businessName: "Cleveland Dog Training by Lorenzo's Team",
    slogan: "Serious training for real-life results.",
    market: "Cleveland",
    state: "OH",
    phone: "(866) 436-4959",
    email: "trainer@lorenzosdogtrainingteam.com",
    headline: "Professional dog training in Cleveland backed by Lorenzo's proven system.",
    subheadline: "Book an evaluation for dog obedience training, behavior modification, puppy structure, and real-world owner leadership.",
    primaryCta: "Book Evaluation",
    serviceArea: "Cleveland, Garfield Heights, Akron, and surrounding Northeast Ohio communities."
  },
  domain: {
    customDomain: "www.clevelanddogtrainingteam.com",
    slug: "eric-beck-cleveland",
    status: "pending",
    verificationToken: "ldtt-verify-84f2c19a"
  },
  leads: demoLeads
};

let state = loadState();
let session = loadSession();

function loadState() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (!saved) return structuredClone(defaultState);
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      auth: { ...defaultState.auth, ...(parsed.auth || {}) },
      trainer: { ...defaultState.trainer, ...(parsed.trainer || {}) },
      domain: { ...defaultState.domain, ...(parsed.domain || {}) },
      trainerAccounts: parsed.trainerAccounts || structuredClone(defaultState.trainerAccounts),
      pendingImports: parsed.pendingImports || [],
      stagedInvites: parsed.stagedInvites || []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function loadSession() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("role") === "trainer" && params.get("temp") === TEMP_TRAINER_PASSWORD) {
      const linkedSession = { loggedIn: true, role: "trainer" };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(linkedSession));
      window.history.replaceState({}, "", window.location.pathname);
      return linkedSession;
    }
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || { loggedIn: false, role: "" };
  } catch {
    return { loggedIn: false, role: "" };
  }
}

function saveSession(role) {
  session = { loggedIn: true, role };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function logout() {
  session = { loggedIn: false, role: "" };
  sessionStorage.removeItem(SESSION_KEY);
  document.body.classList.remove("is-logged-in");
  document.body.classList.add("is-logged-out");
  showToast("Logged out");
}

function saveState(message = "Saved") {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  showToast(message);
  render();
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function selectedTemplate() {
  return templates.find((template) => template.key === state.template) || templates[0];
}

function selectedServices() {
  return state.services.length ? state.services : ["Obedience Training", "Behavior Modification", "Puppy Training"];
}

function render() {
  if (document.getElementById("publicSite")) {
    renderPublicSite();
    return;
  }

  renderAuthState();
  if (!session.loggedIn) return;
  renderNavigation();
  renderRoleChrome();
  renderMetrics();
  renderChecklist();
  renderForms();
  renderTemplates();
  renderServices();
  renderDns();
  renderLeads();
  renderTrainerDirectory();
  renderOnboardingLinks();
  renderFirstLoginFlow();
  renderPreview("dashboardPreview", false);
  renderPreview("sitePreview", true);
}

function renderAuthState() {
  document.body.classList.toggle("is-logged-in", Boolean(session.loggedIn));
  document.body.classList.toggle("is-logged-out", !session.loggedIn);
  document.body.classList.toggle("role-admin", session.role === "admin");
  document.body.classList.toggle("role-trainer", session.role === "trainer");
}

function renderRoleChrome() {
  const isAdmin = session.role === "admin";
  const portalKicker = document.getElementById("portalKicker");
  const portalTitle = document.getElementById("portalTitle");
  const sideCard = document.querySelector(".side-card p");
  const navLabels = isAdmin
    ? {
        dashboard: "Dashboard",
        site: "Trainer Sites",
        templates: "Trainers",
        domains: "Domains & DNS",
        leads: "Trainer Leads",
        business: "Calendar Queue",
        settings: "Settings"
      }
    : {
        dashboard: "Dashboard",
        site: "My Trainer Site",
        templates: "Design Templates",
        domains: "Domains & DNS",
        leads: "Lead Inbox",
        business: "Trainer Business Path",
        settings: "Settings"
      };

  document.querySelectorAll(".side-nav button").forEach((button) => {
    const label = navLabels[button.dataset.view];
    if (label) button.textContent = label;
  });

  if (portalKicker) portalKicker.textContent = isAdmin ? "Admin Portal" : "Trainer Portal";
  if (portalTitle) portalTitle.textContent = isAdmin ? "Network Command Center" : "Trainer Website System";
  if (sideCard) {
    sideCard.textContent = isAdmin
      ? "Demo data shows how Lorenzo's office can manage trainers, trainer sites, leads, clients, and the calendar queue."
      : "Demo data saves in this browser now. Trainers can set up their site, media, leads, calendar availability, and domain.";
  }

  setText("publishedMetricLabel", isAdmin ? "Active Trainer Sites" : "Site Status");
  setText("leadMetricLabel", isAdmin ? "Network Leads" : "Total Leads");
  setText("bookedMetricLabel", isAdmin ? "Evaluations Booked" : "Booked Evaluations");
  setText("domainMetricLabel", isAdmin ? "Pending Domains" : "Domain Status");
  setText("checklistKicker", isAdmin ? "Office Checklist" : "Launch Checklist");
  setText("checklistTitle", isAdmin ? "Keep the trainer network moving." : "Get the trainer site ready to convert.");
  setText("focusKicker", isAdmin ? "Admin Overview" : "Trainer Site Network");
  setText("focusTitle", isAdmin ? "Manage trainers, sites, leads, and scheduling." : "In business for yourself, but not by yourself.");
  setText("focusCopy", isAdmin
    ? "The admin portal gives Lorenzo's office the overview of trainer sites, lead outcomes, calendar requests, and the whole downline."
    : "The trainer owns their local business development while staying connected to Lorenzo's proven dog training system, professional standards, and brand trust.");
  setText("focusButton", isAdmin ? "Open Calendar Queue" : "Open Business Path");
}

function renderNavigation() {
  document.querySelectorAll(".side-nav button").forEach((button) => {
    const isActive = button.dataset.view === state.activeView;
    button.classList.toggle("active", isActive);
  });

  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  const active = document.getElementById(`${state.activeView}View`);
  if (active) active.classList.add("active");

  const titles = {
    dashboard: session.role === "admin" ? "Admin Dashboard" : "Trainer Dashboard",
    site: session.role === "admin" ? "Trainer Sites" : "My Trainer Site",
    templates: "Design Templates",
    domains: "Domains & DNS",
    leads: session.role === "admin" ? "Trainer Leads" : "Lead Inbox",
    business: session.role === "admin" ? "Trainer Network" : "Trainer Business Path",
    settings: "Settings"
  };
  const title = document.getElementById("viewTitle");
  if (title) title.textContent = titles[state.activeView] || titles.dashboard;
}

function renderMetrics() {
  const isAdmin = session.role === "admin";
  setText("publishedMetric", isAdmin ? String(state.trainerAccounts.length) : state.published ? "Live" : "Draft");
  setText("leadMetric", String(state.leads.length));
  setText("bookedMetric", String(state.leads.filter((lead) => ["evaluation-booked", "client-won", "booked", "won"].includes(lead.status)).length));
  setText("domainMetric", isAdmin ? "6" : state.domain.status === "active" ? "Active" : "Pending");
}

function renderChecklist() {
  const items = [
    ["Business identity", Boolean(state.trainer.trainerName && state.trainer.phone && state.trainer.businessName), "Company, trainer name, phone, email, and market are set."],
    ["Company logo", Boolean(state.trainer.companyLogoData), state.trainer.companyLogoData ? "Logo uploaded for the trainer site header." : "Optional logo can be uploaded for the trainer site header."],
    ["Landing page copy", Boolean(state.trainer.headline && state.trainer.subheadline), "Hero headline and supporting copy are ready."],
    ["Services selected", state.services.length >= 3, "At least three services are selected."],
    ["Template chosen", Boolean(state.template), `Selected: ${selectedTemplate().name}.`],
    ["Domain prepared", Boolean(state.domain.customDomain), "Custom domain DNS records are generated."],
    ["Site published", state.published, "Publish when ready for client traffic."]
  ];

  const target = document.getElementById("checklist");
  if (!target) return;
  target.innerHTML = items.map(([name, done, detail]) => `
    <article class="check-item ${done ? "done" : ""}">
      <span class="check-dot">${done ? "✓" : "•"}</span>
      <div><strong>${name}</strong><span>${detail}</span></div>
    </article>
  `).join("");
}

function renderForms() {
  const form = document.getElementById("siteForm");
  if (form) {
    Object.entries(state.trainer).forEach(([key, value]) => {
      const field = form.elements[key];
      if (field && field.type !== "file" && field.value !== value) field.value = value;
    });
    renderLogoPreview();
  }

  const domainForm = document.getElementById("domainForm");
  if (domainForm) {
    domainForm.elements.domain.value = state.domain.customDomain || "";
    domainForm.elements.slug.value = `${state.domain.slug}.lorenzosdogtrainingteam.com`;
  }
}

function renderLogoPreview() {
  const target = document.getElementById("companyLogoPreview");
  if (!target) return;
  target.innerHTML = state.trainer.companyLogoData
    ? `<img src="${state.trainer.companyLogoData}" alt="${escapeHtml(siteBrandName())} logo">`
    : "No logo uploaded yet";
}

function renderTemplates() {
  const target = document.getElementById("templateGrid");
  if (!target) return;
  target.innerHTML = templates.map((template) => `
    <article class="template-card ${state.template === template.key ? "active" : ""}" data-template="${template.key}">
      <span>${template.label}</span>
      <h3>${template.name}</h3>
      <p>${template.description}</p>
      <button class="btn ${state.template === template.key ? "btn-red" : "btn-outline"}" data-template="${template.key}">${state.template === template.key ? "Selected" : "Use Template"}</button>
    </article>
  `).join("");
}

function renderServices() {
  const target = document.getElementById("servicePicker");
  if (!target) return;
  target.innerHTML = services.map(([name, description]) => `
    <label class="service-option">
      <input type="checkbox" value="${name}" ${state.services.includes(name) ? "checked" : ""}>
      <span><strong>${name}</strong><span>${description}</span></span>
    </label>
  `).join("");
}

function renderDns() {
  const target = document.getElementById("dnsRecords");
  if (!target) return;
  const domain = cleanDomain(state.domain.customDomain);
  const apex = domain.replace(/^www\./, "");
  const records = [
    ["TXT", `_lorenzo-verify.${apex}`, state.domain.verificationToken, "Proves the trainer owns the domain."],
    ["CNAME", `www.${apex}`, "trainer-sites.lorenzosdogtrainingteam.com", "Routes www traffic to the trainer site."],
    ["ALIAS / ANAME", apex, "trainer-sites.lorenzosdogtrainingteam.com", "Routes the root domain when supported by the DNS provider."]
  ];
  target.innerHTML = records.map(([type, host, value, note]) => `
    <article class="dns-record">
      <span>${type}</span>
      <code>Host: ${host}</code>
      <code>Value: ${value}</code>
      <p>${note}</p>
      <button class="btn btn-outline" data-copy="${host} ${value}">Copy Record</button>
    </article>
  `).join("");
}

function cleanDomain(domain) {
  return (domain || "www.trainerdomain.com").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function renderLeads() {
  const list = document.getElementById("leadList");
  if (list) {
    list.innerHTML = state.leads.map((lead) => `
      <article class="lead-card">
        <div>
          <span class="pill ${lead.status}">${statusLabel(lead.status)}</span>
          <h3>${lead.name}</h3>
          <p><strong>${lead.need}</strong> for ${lead.dog || "dog"}</p>
          <p>${lead.message}</p>
          <p>${lead.phone} · ${lead.email}</p>
        </div>
        <div class="lead-actions">
          ${pipelineStages.map(([status, label]) => `
            <button class="btn btn-outline" data-lead="${lead.id}" data-status="${status}">${label}</button>
          `).join("")}
        </div>
      </article>
    `).join("");
  }

  const pipeline = document.getElementById("pipeline");
  if (pipeline) {
    pipeline.innerHTML = pipelineStages.map(([stage, label]) => {
      const count = state.leads.filter((lead) => lead.status === stage).length;
      return `<article><strong>${label}</strong><span>${count} lead${count === 1 ? "" : "s"}</span></article>`;
    }).join("");
  }
}

function renderTrainerDirectory() {
  const target = document.getElementById("trainerDirectory");
  if (target) {
    target.innerHTML = state.trainerAccounts.map((trainer) => `
      <article class="trainer-row">
        <div>
          <h3>${escapeHtml(trainer.trainerName || "Unnamed Trainer")}</h3>
          <p>${escapeHtml(trainer.businessName || "Lorenzo's Dog Training Team")}</p>
        </div>
        <div>
          <strong>${escapeHtml([trainer.market, trainer.state].filter(Boolean).join(", ") || "Market pending")}</strong>
          <span>${escapeHtml(trainer.serviceArea || "Service area pending")}</span>
        </div>
        <div>
          <strong>${escapeHtml(trainer.phone || "(866) 436-4959")}</strong>
          <span>${escapeHtml(trainer.email || "office@lorenzosdogtrainingteam.com")}</span>
        </div>
        <div>
          <span class="status-badge ${trainer.portalStatus === "ready" ? "ready" : "pending"}">${trainer.portalStatus === "ready" ? "Trainer Portal Ready" : "Pending Review"}</span>
          <span class="temp-password">Temp: ${escapeHtml(trainer.temporaryPassword || TEMP_TRAINER_PASSWORD)}</span>
        </div>
      </article>
    `).join("");
  }

  const pending = document.getElementById("pendingImports");
  if (pending) {
    pending.innerHTML = state.pendingImports.length ? state.pendingImports.map((file) => `
      <article>
        <strong>${escapeHtml(file.name)}</strong>
        <p>${escapeHtml(file.type || "Document")} uploaded for office review. CSV imports populate immediately; documents will connect to parsing after Supabase and backend processing are added.</p>
      </article>
    `).join("") : "";
  }
}

function trainerOnboardingUrl() {
  return `${window.location.origin}${window.location.pathname}?role=trainer&temp=${TEMP_TRAINER_PASSWORD}`;
}

function renderOnboardingLinks() {
  const link = trainerOnboardingUrl();
  setText("trainerOnboardingLink", link);
  const email = document.getElementById("emailOnboardingLink");
  const sms = document.getElementById("smsOnboardingLink");
  const body = `Your Lorenzo trainer portal is ready.\n\nLogin link: ${link}\nTemporary password: ${TEMP_TRAINER_PASSWORD}\n\nAfter your first login, create your permanent password and follow the portal tutorial.`;
  if (email) {
    email.href = `mailto:?subject=${encodeURIComponent("Your Lorenzo trainer portal is ready")}&body=${encodeURIComponent(body)}`;
  }
  if (sms) {
    sms.href = `sms:?&body=${encodeURIComponent(body)}`;
  }
}

function renderFirstLoginFlow() {
  const dashboard = document.getElementById("dashboardView");
  if (!dashboard || session.role !== "trainer") return;
  dashboard.querySelectorAll(".trainer-first-login").forEach((node) => node.remove());

  if (!state.auth.trainerPasswordSet) {
    dashboard.insertAdjacentHTML("afterbegin", `
      <section class="panel password-setup trainer-first-login">
        <p class="micro">First Login Security</p>
        <h2>Create your permanent trainer password.</h2>
        <p class="panel-copy">You are signed in with the temporary password <strong>${TEMP_TRAINER_PASSWORD}</strong>. Create a permanent password before continuing through the trainer portal walkthrough.</p>
        <form id="permanentPasswordForm">
          <label>Permanent Password<input name="permanentPassword" type="password" placeholder="Create permanent password" minlength="6"></label>
          <button class="btn btn-red" type="submit">Save Password & Start Tutorial</button>
        </form>
      </section>
    `);
    return;
  }

  if (!state.auth.tutorialDismissed) {
    dashboard.insertAdjacentHTML("afterbegin", `
      <section class="panel tutorial-card trainer-first-login">
        <p class="micro">Trainer Portal Tutorial</p>
        <h2>Welcome to your back office.</h2>
        <p class="panel-copy">This walkthrough shows how to finish the trainer site, add services, manage leads, prepare domain records, and share calendar availability with Lorenzo's office.</p>
        <div class="tutorial-steps">
          <article><strong>1. Profile</strong><span>Add company name, logo, slogan, trainer name, market, phone, and email.</span></article>
          <article><strong>2. Website</strong><span>Edit hero copy, choose services, upload media, and preview templates without retyping details.</span></article>
          <article><strong>3. Leads</strong><span>Track New, Contacted, Evaluation Booked, Program Offered, Client Won, or Lost outcomes.</span></article>
          <article><strong>4. Calendar</strong><span>Use availability slots so the office can schedule in-person or online consultations.</span></article>
        </div>
        <button class="btn btn-navy" id="dismissTutorialBtn" type="button">Finish Tutorial</button>
      </section>
    `);
  }
}

function renderPreview(targetId, compact) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const template = selectedTemplate();
  const trainer = state.trainer;
  const selected = selectedServices();
  const heroTitle = compact ? "h2" : "h2";

  target.innerHTML = `
    <div class="${compact ? "site-mini" : "site-mini"}">
      ${siteBrandRow()}
      <section class="site-hero">
        <div class="site-hero-content">
          <p class="micro">${siteBrandName()}</p>
          <${heroTitle}>${trainer.headline}</${heroTitle}>
          <p>${trainer.subheadline}</p>
          <a class="btn btn-red" href="tel:${trainer.phone.replace(/[^0-9]/g, "")}">${trainer.primaryCta}</a>
        </div>
      </section>
      <div class="site-strip">
        <div><strong>${trainer.market}, ${trainer.state}</strong><span>Local market</span></div>
        <div><strong>${template.name}</strong><span>Site template</span></div>
        <div><strong>${state.published ? "Published" : "Draft"}</strong><span>Site status</span></div>
      </div>
      <section class="site-section">
        <h3>Dog training services</h3>
        <div class="site-services">
          ${selected.slice(0, compact ? 3 : 6).map((service) => `<article><h3>${service}</h3><p>${serviceDescription(service)}</p></article>`).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderPublicSite() {
  const target = document.getElementById("publicSite");
  if (!target) return;
  const trainer = state.trainer;
  const template = selectedTemplate();
  const selected = selectedServices();
  renderPublicHeader();

  target.innerHTML = `
    <div class="site-full">
      <section class="site-hero">
        <div class="site-hero-content">
          <p class="micro">${trainer.businessName}</p>
          <h1>${trainer.headline}</h1>
          <p>${trainer.subheadline}</p>
          <a class="btn btn-red" href="tel:${trainer.phone.replace(/[^0-9]/g, "")}">${trainer.primaryCta}</a>
        </div>
      </section>
      <div class="site-body">
        <div class="site-strip">
          <div><strong>${trainer.trainerName}</strong><span>Certified Lorenzo trainer</span></div>
          <div><strong>${trainer.market}, ${trainer.state}</strong><span>${trainer.serviceArea}</span></div>
          <div><strong>${trainer.phone}</strong><span>${trainer.email}</span></div>
        </div>
        <section class="site-section" id="services">
          <p class="micro">${template.label}</p>
          <h2>Training services built for real homes and real owner leadership.</h2>
          <div class="site-services">
            ${selected.map((service) => `<article><h3>${service}</h3><p>${serviceDescription(service)}</p></article>`).join("")}
          </div>
        </section>
        <section class="site-section" id="method">
          <p class="micro">The Technique Behind Our Training</p>
          <h2>Professional evaluation first. A tailored path after that.</h2>
          <p>Lorenzo's system is built around technique, timing, communication, leadership, rules, and boundaries. The trainer evaluates the dog, the owner, the environment, and the goals before recommending a training path.</p>
        </section>
        <section class="eval-card" id="evaluation">
          <div>
            <h2>Ready to start with ${trainer.trainerName}?</h2>
            <p>Book an evaluation for obedience, behavior modification, specialty training, or the next right step for your dog.</p>
          </div>
          <a class="btn btn-red" href="tel:${trainer.phone.replace(/[^0-9]/g, "")}">Call ${trainer.phone}</a>
        </section>
      </div>
    </div>
  `;
}

function renderPublicHeader() {
  const header = document.getElementById("publicHeader");
  if (!header) return;
  header.innerHTML = `
    <a class="public-brand" href="index.html">
      ${brandLogoMarkup()}
      <span><strong>${escapeHtml(siteBrandName())}</strong><span>Powered by Lorenzo's Dog Training Team</span></span>
    </a>
    <nav>
      <a href="#services">Services</a>
      <a href="#method">Method</a>
      <a href="#evaluation">Book Evaluation</a>
    </nav>
  `;
}

function siteBrandName() {
  return state.trainer.businessName?.trim() || "Lorenzo's Dog Training Team";
}

function brandLogoMarkup() {
  const src = state.trainer.companyLogoData || "../assets/lorenzo-logo-transparent.png";
  return `<img src="${src}" alt="${escapeHtml(siteBrandName())}">`;
}

function siteBrandRow() {
  return `
    <div class="site-brand-row">
      ${brandLogoMarkup()}
      <div><strong>${escapeHtml(siteBrandName())}</strong><span>Powered by Lorenzo's Dog Training Team</span></div>
    </div>
  `;
}

function serviceDescription(service) {
  const found = services.find(([name]) => name === service);
  return found ? found[1] : "Professional training backed by Lorenzo's proven system.";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusLabel(status) {
  return pipelineStages.find(([key]) => key === status)?.[1] || titleCase(String(status || "new").replaceAll("-", " "));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeTrainer(row, index) {
  const get = (...keys) => {
    for (const key of keys) {
      const normalized = key.toLowerCase();
      const underscored = normalized.replace(/\s+/g, "_");
      if (row[normalized]) return row[normalized];
      if (row[underscored]) return row[underscored];
      if (row[key]) return row[key];
    }
    return "";
  };
  const trainerName = get("trainer name", "name", "trainer", "full name") || `Imported Trainer ${index + 1}`;
  const market = get("market", "city", "location") || "Local Market";
  const stateCode = get("state", "st") || "";
  return {
    id: `trainer-${Date.now()}-${index}`,
    trainerName,
    businessName: get("company name", "business name", "company") || "Lorenzo's Dog Training Team",
    market,
    state: stateCode,
    phone: get("phone", "phone number", "mobile") || "(866) 436-4959",
    email: get("email", "email address") || "office@lorenzosdogtrainingteam.com",
    serviceArea: get("service area", "territory", "area") || [market, stateCode].filter(Boolean).join(", "),
    domain: get("domain", "website", "url"),
    portalStatus: "ready",
    temporaryPassword: TEMP_TRAINER_PASSWORD
  };
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      current.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (value || current.length) {
        current.push(value.trim());
        rows.push(current);
        current = [];
        value = "";
      }
      if (char === "\r" && next === "\n") i += 1;
    } else {
      value += char;
    }
  }

  if (value || current.length) {
    current.push(value.trim());
    rows.push(current);
  }

  const headers = (rows.shift() || []).map((header) => header.trim().toLowerCase());
  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function importTrainerFile(file) {
  if (!file) {
    showToast("Choose a trainer list first");
    return;
  }

  const ext = file.name.split(".").pop().toLowerCase();
  if (["csv", "txt"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = () => {
      const imported = parseCsv(String(reader.result || "")).map(normalizeTrainer);
      if (!imported.length) {
        showToast("No trainer rows found");
        return;
      }
      state.trainerAccounts = [...imported, ...state.trainerAccounts];
      saveState(`${imported.length} trainer portal${imported.length === 1 ? "" : "s"} ready`);
    };
    reader.readAsText(file);
    return;
  }

  state.pendingImports.unshift({
    name: file.name,
    type: ext.toUpperCase(),
    uploadedAt: new Date().toISOString()
  });
  saveState("Trainer document uploaded for review");
}

function loginAs(role) {
  saveSession(role);
  state.activeView = "dashboard";
  render();
  showToast(role === "admin" ? "Admin portal opened" : "Trainer portal opened");
}

document.addEventListener("click", (event) => {
  const quickLogin = event.target.closest("[data-login-role]");
  if (quickLogin) {
    loginAs(quickLogin.dataset.loginRole);
    return;
  }

  const nav = event.target.closest(".side-nav button");
  if (nav) {
    state.activeView = nav.dataset.view;
    saveState("View changed");
    return;
  }

  const jump = event.target.closest("[data-jump]");
  if (jump) {
    state.activeView = jump.dataset.jump;
    saveState("Opened section");
    return;
  }

  const template = event.target.closest("[data-template]");
  if (template) {
    state.template = template.dataset.template;
    saveState("Template selected");
    return;
  }

  const statusButton = event.target.closest("[data-lead][data-status]");
  if (statusButton) {
    const lead = state.leads.find((item) => item.id === statusButton.dataset.lead);
    if (lead) lead.status = statusButton.dataset.status;
    saveState("Lead updated");
    return;
  }

  const copyButton = event.target.closest("[data-copy]");
  if (copyButton) {
    navigator.clipboard?.writeText(copyButton.dataset.copy);
    showToast("DNS record copied");
    return;
  }

  if (event.target.id === "publishBtn") {
    state.published = true;
    saveState("Trainer site published");
    return;
  }

  if (event.target.id === "saveBtn") {
    saveState("Draft saved");
    return;
  }

  if (event.target.id === "verifyDomainBtn") {
    state.domain.status = "pending";
    state.domain.verificationToken = `ldtt-verify-${Math.random().toString(16).slice(2, 10)}`;
    saveState("DNS records generated");
    return;
  }

  if (event.target.id === "addLeadBtn") {
    const count = state.leads.length + 1;
    state.leads.unshift({
      id: `lead-${Date.now()}`,
      name: `New Dog Owner ${count}`,
      phone: "(216) 555-0100",
      email: `lead${count}@example.com`,
      dog: "Bella",
      need: "Dog obedience training",
      message: "I need help with leash pulling, jumping, and better listening at home.",
      status: "new"
    });
    saveState("Demo lead added");
    return;
  }

  if (event.target.id === "seedTrainersBtn") {
    state.trainerAccounts = structuredClone(demoTrainers);
    saveState("Demo trainer list loaded");
    return;
  }

  if (event.target.id === "copyOnboardingLink") {
    navigator.clipboard?.writeText(trainerOnboardingUrl());
    showToast("Onboarding link copied");
    return;
  }

  if (event.target.id === "stageInviteBtn") {
    state.stagedInvites.unshift({
      link: trainerOnboardingUrl(),
      temporaryPassword: TEMP_TRAINER_PASSWORD,
      stagedAt: new Date().toISOString()
    });
    saveState("Trainer invite staged for later sending");
    return;
  }

  if (event.target.id === "dismissTutorialBtn") {
    state.auth.tutorialDismissed = true;
    saveState("Tutorial completed");
    return;
  }

  if (event.target.id === "resetBtn") {
    state = structuredClone(defaultState);
    saveState("Demo data reset");
    return;
  }

  if (event.target.id === "logoutBtn") {
    logout();
  }
});

document.addEventListener("input", (event) => {
  const field = event.target;
  if (field.closest("#siteForm") && field.name) {
    state.trainer[field.name] = field.value;
    if (["trainerName", "market"].includes(field.name)) {
      state.domain.slug = slugify(`${state.trainer.trainerName}-${state.trainer.market}`);
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    renderMetrics();
    renderChecklist();
    renderPreview("dashboardPreview", false);
    renderPreview("sitePreview", true);
  }

  if (field.closest("#domainForm") && field.name === "domain") {
    state.domain.customDomain = field.value;
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    renderDns();
  }

  if (field.closest("#servicePicker")) {
    state.services = Array.from(document.querySelectorAll("#servicePicker input:checked")).map((input) => input.value);
    saveState("Services updated");
  }
});

document.addEventListener("change", (event) => {
  const field = event.target;
  if (field.name === "companyLogoFile" && field.files?.[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      state.trainer.companyLogoData = String(reader.result || "");
      saveState("Company logo uploaded");
    };
    reader.readAsDataURL(field.files[0]);
  }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();

  if (event.target.id === "trainerImportForm") {
    importTrainerFile(document.getElementById("trainerImportFile")?.files?.[0]);
    event.target.reset();
    return;
  }

  if (event.target.id === "permanentPasswordForm") {
    const password = event.target.elements.permanentPassword.value.trim();
    if (password.length < 6) {
      showToast("Use at least 6 characters");
      return;
    }
    state.auth.trainerPassword = password;
    state.auth.trainerPasswordSet = true;
    state.auth.tutorialDismissed = false;
    saveState("Permanent password saved");
    return;
  }

  if (event.target.id !== "loginForm") return;
  const username = event.target.elements.username.value.trim().toLowerCase();
  const role = username === "admin" ? "admin" : "trainer";
  loginAs(role);
});

render();
