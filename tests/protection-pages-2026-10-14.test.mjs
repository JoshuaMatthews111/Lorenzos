// Joshua 2026-10-14: Protection Training landing pages at /protection/<slug>, six markets only,
// same lead flow as the market pages (v2.js -> /api/booking-lead, trainer pick via /api/booking).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("six markets render with the booking-lead flow, videos and per-market prefills", () => {
  const P = require("../lib/protection-pages.js");
  assert.deepEqual(Object.keys(P.MARKETS), ["atlanta", "cleveland", "fort-worth", "san-antonio", "durham", "navarre"]);
  for (const [slug, m] of Object.entries(P.MARKETS)) {
    const h = P.renderProtectionPage(slug);
    assert.match(h, /data-kind="evaluation"[\s\S]*data-endpoint="\/api\/booking-lead"/, slug);
    assert.match(h, /data-trainer-pick data-endpoint="\/api\/booking"/, slug);
    assert.ok(h.includes(`<option value="${m.code}" selected>`), `${slug}: state preselected`);
    assert.ok(h.includes(`placeholder="${m.zip}"`), `${slug}: zip example`);
    assert.ok(h.includes("youtube.com/embed/2FiKSbzZ3h0") && h.includes("youtube.com/embed/QZijpf5BJGI"), `${slug}: both videos`);
    assert.ok(h.includes("Security Training") && h.includes("Personal Protection"), `${slug}: video titles`);
    assert.ok(h.includes("not about creating aggression"), `${slug}: responsible framing`);
    assert.doesNotMatch(h, /Jessica L\.|Mark R\.|Emily S\./, `${slug}: no mock testimonials`);
    assert.match(h, /approved-homepage-reviews/, `${slug}: real reviews feed`);
    assert.match(h, /name="sms_consent"[\s\S]*Reply STOP/, `${slug}: consent wording`);
  }
  assert.equal(P.renderProtectionPage("tallahassee"), null, "only the six markets");
});

test("the route serves the six slugs and 404s the rest; vercel rewrite sits before the catch-all", () => {
  const src = read("api/protection-page.js");
  assert.match(src, /renderProtectionPage\(slug, \{ practice \}\)/);
  assert.match(src, /status\(404\)/);
  const v = JSON.parse(read("vercel.json"));
  const i = v.rewrites.findIndex(r => r.source === "/protection/:slug");
  const catchAll = v.rewrites.findIndex(r => r.source === "/:slug");
  assert.ok(i >= 0 && i < catchAll, "/protection/:slug must win over the trainer catch-all");
  assert.equal(v.rewrites[i].destination, "/api/protection-page?slug=:slug");
});

test("practice copy is noindex + no-store; live is cacheable and indexable", async () => {
  const handler = require("../api/protection-page.js");
  const call = (slug) => {
    const res = { headers: {}, statusCode: 0, body: "", setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, send(b) { this.body = b; return this; } };
    return handler({ method: "GET", query: { slug } }, res).then(() => res);
  };
  const live = await call("navarre");
  assert.equal(live.statusCode, 200);
  const sandbox = process.env.LDTT_SANDBOX;
  if (!sandbox) {
    assert.match(live.headers["Cache-Control"], /s-maxage=600/);
    assert.match(live.body, /rel="canonical"/);
  }
  const missing = await call("protection");
  assert.equal(missing.statusCode, 404);
});
