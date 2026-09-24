// Audit 2026-09-24: no link a client, a trainer or the office can reach on LIVE may point at the practice
// copy (*.vercel.app). The Lead forms screen answers "not_here" on live (api/lead-forms is 404 there) and
// used to render <a href="https://ldtt-sandbox.vercel.app/staff">. The words stay; the link is gone.
// This pin scans every browser file the live portal and the public site ship for an href/src/action to a
// vercel.app host. Server-only files and comments are not scanned.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = f => readFileSync(resolve(root, f), "utf8");
const shipped = [
  ...readdirSync(resolve(root, "trainer-backoffice")).filter(f => /\.(js|html|css)$/.test(f)).map(f => `trainer-backoffice/${f}`),
  "script.js", "market-landing.js", "ad-funnel.js", "staff.html",
  ...readdirSync(root).filter(f => f.endsWith(".html"))
];
const LINK_TO_VERCEL = /(href|src|action)\s*=\s*\\?["'`]https?:\/\/[a-z0-9.-]*vercel\.app/i;

test("no shipped browser file links to a *.vercel.app host", () => {
  const hits = [];
  for (const file of shipped) {
    read(file).split("\n").forEach((line, i) => { if (LINK_TO_VERCEL.test(line)) hits.push(`${file}:${i + 1}`); });
  }
  assert.deepEqual(hits, [], `links to a vercel.app host: ${hits.join(", ")}`);
});

test("the live Lead forms fallback still tells the office where forms are edited", () => {
  const src = read("trainer-backoffice/form-editor.js");
  const block = src.slice(src.indexOf('if (S.error === "not_here")'), src.indexOf('if (!S.data) return panel("Lead forms"'));
  assert.match(block, /Lead forms are edited on the practice copy for now/);
  assert.match(block, /Send to live, as a draft/);
  assert.doesNotMatch(block, /vercel\.app/);
});
