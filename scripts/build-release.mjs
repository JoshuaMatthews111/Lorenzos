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
const requiredOutput = [
  ...requiredApis.map(name => `functions/api/${name}.func/.vc-config.json`),
  ...citySlugs.map(slug => `static/trainer-opportunity-${slug}.html`),
  "static/index.html",
  "static/staff.html",
  "static/contact.html",
  "static/trainer-application.html",
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
    apiFunctionsPresent: true,
    staffBundlePresent: true,
    karemelaMediaPresent: true,
    sitemapPresent: true,
    generatedMetadataRemoved: true
  }
};

const reportDir = resolve(root, "release-reports");
mkdirSync(reportDir, { recursive: true });
const reportPath = resolve(reportDir, `latest-${target}-build-manifest.json`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, reportPath, ...report }, null, 2));
