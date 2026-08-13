import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const approvedRoot = "/Volumes/mindfulssd/lorenzo_concept1_site";
const root = realpathSync(resolve(import.meta.dirname, ".."));
const requestedTarget = cleanTarget(process.argv[2]);
const target = requestedTarget || "production";
if (root !== approvedRoot) {
  throw new Error(`Release builds must run from ${approvedRoot}. Current root: ${root}`);
}

function cleanTarget(value) {
  const normalized = String(value || "").replace(/^--target=?/, "").trim().toLowerCase();
  if (!normalized) return "";
  if (!["preview", "production"].includes(normalized)) throw new Error("Release target must be preview or production.");
  return normalized;
}

const run = (command, args) => execFileSync(command, args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"]
});

run(process.execPath, ["scripts/generate-trainer-opportunity-pages.mjs"]);
run(process.execPath, ["scripts/generate-market-pages.mjs"]);
run("vercel", ["build", "--target", target, "--yes"]);

const outputRoot = resolve(root, ".vercel/output");
const removeMetadata = directory => {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    if (name === ".DS_Store" || name.startsWith("._")) {
      rmSync(path, { force: true, recursive: true });
      continue;
    }
    if (statSync(path).isDirectory()) removeMetadata(path);
  }
};
removeMetadata(outputRoot);

const requiredApis = [
  "approved-homepage-reviews",
  "ensure-trainer-user",
  "form-delivery",
  "manage-portal-user",
  "operational-data",
  "operational-mutation",
  "reset-portal-password",
  "submit-content-review",
  "trainer-media-upload-url"
];
const citySlugs = [
  "ann-arbor-mi", "atlanta-ga", "chicago-il", "cleveland-oh", "columbus-oh",
  "lexington-ky", "miramar-beach-fl", "san-antonio-tx", "san-diego-ca", "tallahassee-fl"
];
const marketSlugs = [
  "dog-training-cleveland-oh",
  "dog-training-columbus-oh",
  "dog-training-atlanta-ga",
  "dog-training-san-diego-ca",
  "dog-training-san-antonio-tx",
  "dog-training-chicago-il",
  "dog-training-tallahassee-fl",
  "dog-training-miramar-beach-fl",
  "dog-training-lexington-ky",
  "dog-training-ann-arbor-mi"
];
const googleAdsId = "AW-11463464040";
const paidConsultationConversion = "AW-11463464040/kLPdCPzSo4oaEOiomtoq";
const paidPdfConversion = "AW-11463464040/EkfvCK6B8o8ZEOiomtoq";
const contactConversion = "AW-11463464040/WIE3CMK0kr0aEOiomtoq";
const requiredAttributionFields = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "landing_url"
];
const requiredOutput = [
  ...requiredApis.map(name => `functions/api/${name}.func/.vc-config.json`),
  ...citySlugs.map(slug => `static/trainer-opportunity-${slug}.html`),
  ...marketSlugs.map(slug => `static/${slug}.html`),
  "static/index.html",
  "static/staff.html",
  "static/contact.html",
  "static/trainer-application.html",
  "static/onboarding.html",
  "static/trainer-backoffice/app.js",
  "static/trainer-backoffice/supabase.js",
  "static/assets/trainer-bio-photos/karemela-sefferin-candid.jpg",
  "static/assets/trainer-videos/karemela-sefferin.mp4",
  "static/assets/trainer-videos/karemela-sefferin.jpg",
  "static/sitemap.xml",
  "config.json"
];
const missing = requiredOutput.filter(path => !existsSync(resolve(outputRoot, path)));
if (missing.length) throw new Error(`Release output is incomplete:\n${missing.join("\n")}`);

const readOutputText = relativePath => readFileSync(resolve(outputRoot, relativePath), "utf8");
const contentFailures = [];
for (const slug of marketSlugs) {
  const relativePath = `static/${slug}.html`;
  const html = readOutputText(relativePath);
  if (!html.includes(googleAdsId)) contentFailures.push(`${relativePath}: missing Google Ads tag ${googleAdsId}`);
  if (!html.includes(paidConsultationConversion)) contentFailures.push(`${relativePath}: missing consultation conversion ${paidConsultationConversion}`);
  if (!html.includes(paidPdfConversion)) contentFailures.push(`${relativePath}: missing PDF conversion ${paidPdfConversion}`);
  for (const field of requiredAttributionFields) {
    if (!html.includes(`name="${field}"`)) contentFailures.push(`${relativePath}: missing hidden attribution field ${field}`);
  }
  if (/Investor network|Donor(?: or|\/) project support/i.test(html)) {
    contentFailures.push(`${relativePath}: paid pages must not include investor or donor options`);
  }
}

const contactHtml = readOutputText("static/contact.html");
if (!contactHtml.includes(googleAdsId)) contentFailures.push(`static/contact.html: missing Google Ads tag ${googleAdsId}`);
if (!contactHtml.includes(contactConversion)) contentFailures.push(`static/contact.html: missing contact conversion ${contactConversion}`);

const marketLandingJs = readOutputText("static/market-landing.js");
const adFunnelJs = readOutputText("static/ad-funnel.js");
if (!marketLandingJs.includes("pdf-optin")) contentFailures.push("static/market-landing.js: guide form is missing pdf-optin class");
if (!adFunnelJs.includes("pdf-optin")) contentFailures.push("static/ad-funnel.js: exit guide form is missing pdf-optin class");
if (/Investor network|Donor(?: or|\/) project support/i.test(`${marketLandingJs}\n${adFunnelJs}`)) {
  contentFailures.push("market guide scripts must not include investor or donor paid-page options");
}
if (contentFailures.length) throw new Error(`Release content verification failed:\n${contentFailures.join("\n")}`);

const files = [];
const walk = directory => {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(outputRoot);
const outputHash = createHash("sha256");
for (const path of files.sort()) {
  outputHash.update(relative(outputRoot, path));
  outputHash.update(readFileSync(path));
}

const gitRevision = run("git", ["rev-parse", "HEAD"]).trim();
const dirtyEntries = run("git", ["status", "--porcelain", "--untracked-files=all"])
  .split("\n")
  .filter(Boolean);
const report = {
  generatedAt: new Date().toISOString(),
  root,
  target: `${target}-build`,
  gitRevision,
  dirtyEntryCount: dirtyEntries.length,
  outputFileCount: files.length,
  outputHash: outputHash.digest("hex"),
  requiredApis,
	  cityPages: citySlugs.map(slug => `/trainer-opportunity-${slug}`),
	  marketPages: marketSlugs.map(slug => `/${slug}`),
	  publicBundles: ["/script.js", "/styles.css", "/trainer-roster.js"],
  staffBundles: ["/trainer-backoffice/app.js", "/trainer-backoffice/supabase.js", "/trainer-backoffice/styles.css"],
  protectedAssets: [
    "/assets/trainer-bio-photos/karemela-sefferin-candid.jpg",
    "/assets/trainer-videos/karemela-sefferin.mp4",
    "/assets/trainer-videos/karemela-sefferin.jpg"
  ],
  migrationRequired: "supabase/migrations/20260806015000_unified_operational_recovery.sql",
	  checks: {
	    generatedCityPages: true,
	    generatedMarketPages: true,
	    apiFunctionsPresent: true,
	    staffBundlePresent: true,
	    karemelaMediaPresent: true,
	    sitemapPresent: true,
	    generatedMetadataRemoved: true,
	    googleAdsTagPresent: true,
	    paidConversionsPresent: true,
	    hiddenAdAttributionPresent: true,
	    paidInvestorDonorOptionsRemoved: true
	  }
	};

const reportDir = resolve(root, "release-reports");
mkdirSync(reportDir, { recursive: true });
const reportPath = resolve(reportDir, `latest-${target}-build-manifest.json`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, reportPath, ...report }, null, 2));
