// Audit 2026-09-24. Standing rule (lib/pipeline.js DEFAULT_RECIPIENTS, the owner's memory note): the owner is
// "Lorenzo", never "Tim", on any screen. The portal's PORTAL_STAFF_DIRECTORY still named his personal login
// "Tim Miller", and that entry is the display-name fallback (portalDisplayName -> staffForPortalUser) for his
// office-note bylines, the Users list and every "who did this" line. This pins the name and scans every
// browser file the site and portals ship for the word "Tim" outside comments.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = f => readFileSync(resolve(root, f), "utf8");

test("the owner's personal login is named Lorenzo in the staff directory", () => {
  const app = read("trainer-backoffice/app.js");
  const dir = app.slice(app.indexOf("const PORTAL_STAFF_DIRECTORY = ["), app.indexOf("];", app.indexOf("const PORTAL_STAFF_DIRECTORY = [")));
  assert.match(dir, /\{ name: "Lorenzo Miller", email: "tmillerk999@gmail\.com", permission: "super_admin" \}/);
  assert.doesNotMatch(dir, /\bTim\b/);
});

test("no shipped browser file says \"Tim\" outside a comment", () => {
  const files = [
    ...readdirSync(resolve(root, "trainer-backoffice")).filter(f => /\.(js|html)$/.test(f)).map(f => `trainer-backoffice/${f}`),
    "script.js", "market-landing.js", "ad-funnel.js", "staff.html",
    ...readdirSync(root).filter(f => f.endsWith(".html"))
  ];
  const hits = [];
  for (const file of files) {
    read(file).split("\n").forEach((line, i) => {
      const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, "").replace(/\s\/\/\s.*$/, "").replace(/<!--.*?-->/g, "");
      if (/\bTim\b/.test(code)) hits.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, []);
});
