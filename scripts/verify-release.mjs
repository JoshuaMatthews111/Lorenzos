import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const target = String(process.argv[2] || "").replace(/\/$/, "");
const ignoredNames = new Set([".git", ".vercel", "node_modules", "_originals", "tmp", "output"]);
const ignoredFile = name => name === ".DS_Store" || name.startsWith("._") || /\.bak(?:-|$)/.test(name);

const requiredFiles = [
  "index.html",
  "staff.html",
  "contact.html",
  "trainer-application.html",
  "api/operational-data.js",
  "api/operational-mutation.js",
  "api/form-delivery.js",
  "api/approved-homepage-reviews.js",
  "api/trainer-media-upload-url.js",
  "trainer-backoffice/app.js",
  "trainer-backoffice/supabase.js",
  "terms.html",
  "privacy-policy.html",
  "find-a-trainer.html",
  "karemelasefferin.html",
  "assets/trainer-bio-photos/karemela-sefferin-candid.jpg",
  "assets/trainer-videos/karemela-sefferin.mp4",
  "sitemap.xml"
];

const citySlugs = [
  "ann-arbor-mi", "atlanta-ga", "chicago-il", "cleveland-oh", "columbus-oh",
  "lexington-ky", "miramar-beach-fl", "san-antonio-tx", "san-diego-ca", "tallahassee-fl"
];

const files = [];
const walk = directory => {
  for (const name of readdirSync(directory)) {
    if (ignoredNames.has(name) || ignoredFile(name)) continue;
    const path = resolve(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(root);
execFileSync(process.execPath, ["scripts/audit-office-requirements.mjs"], { cwd: root, stdio: "pipe" });

const missingFiles = [
  ...requiredFiles,
  ...citySlugs.map(slug => `trainer-opportunity-${slug}.html`)
].filter(path => !existsSync(resolve(root, path)));

const sourceHash = createHash("sha256");
for (const path of files.sort()) {
  sourceHash.update(relative(root, path));
  sourceHash.update(readFileSync(path));
}

const report = {
  ok: missingFiles.length === 0,
  root,
  fileCount: files.length,
  sourceHash: sourceHash.digest("hex"),
  requiredFileCount: requiredFiles.length + citySlugs.length,
  missingFiles,
  target: target || null,
  vercelProtected: false,
  routeChecks: []
};

if (target) {
  try {
    const protectionProbe = await fetch(target, { redirect: "manual" });
    report.vercelProtected = protectionProbe.status === 302
      && /vercel\.com\/sso-api/i.test(protectionProbe.headers.get("location") || "");
  } catch {
    report.vercelProtected = false;
  }
  const checks = [
    ["/", 200],
    ["/staff.html", 200],
    ["/contact.html", 200],
    ["/trainer-application.html", 200],
    ["/terms", 200],
    ["/privacy-policy", 200],
    ["/find-a-trainer", 200],
    ["/karemelasefferin", 200],
    ["/trainer-bio-karemela-sefferin", 200],
    ["/carolinadon", 200, "/carolinaperez"],
    ["/api/approved-homepage-reviews", 200],
    ["/api/operational-data", 403],
    ["/api/operational-mutation", 405],
    ["/api/form-delivery", 405],
    ["/api/manage-portal-user", 405],
    ["/api/trainer-media-upload-url", 405],
    ["/assets/trainer-videos/karemela-sefferin.mp4", 200],
    ...citySlugs.map(slug => [`/trainer-opportunity-${slug}.html`, 200])
  ];
  for (const [path, expected, expectedFinalPath] of checks) {
    try {
      let finalUrl = "";
      const actual = report.vercelProtected
        ? Number(execFileSync("vercel", [
            "curl",
            path,
            "--deployment",
            target,
            "--",
            "--silent",
            "--show-error",
            "--location",
            "--output",
            "/dev/null",
            "--write-out",
            "%{http_code}"
          ], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim())
        : await (async () => {
            const response = await fetch(`${target}${path}`, { redirect: "follow" });
            finalUrl = response.url;
            return response.status;
          })();
      const finalPathPass = !expectedFinalPath || report.vercelProtected || new URL(finalUrl).pathname === expectedFinalPath;
      const pass = actual === expected && finalPathPass;
      report.routeChecks.push({ path, expected, actual, expectedFinalPath: expectedFinalPath || null, finalUrl: finalUrl || null, pass });
      if (!pass) report.ok = false;
    } catch (error) {
      report.routeChecks.push({ path, expected, actual: null, pass: false, error: error.message });
      report.ok = false;
    }
  }
}

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
