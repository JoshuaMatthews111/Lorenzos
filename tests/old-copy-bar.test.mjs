// bookmarks: the old-copy bar and /api/environment canonical host (release 2026-09-05).
// Office fear: "some saved it as a bookmark" and landed on an old copy.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { decide } = require("../trainer-backoffice/old-copy-bar.js");
const PRACTICE = "practice.lorenzosdogtrainingteam.com";
const LIVE = "lorenzosdogtrainingteam.com";

async function environment(env = {}) {
  const saved = { LDTT_SANDBOX: process.env.LDTT_SANDBOX, LDTT_PRACTICE_HOST: process.env.LDTT_PRACTICE_HOST };
  delete process.env.LDTT_SANDBOX; delete process.env.LDTT_PRACTICE_HOST;
  Object.assign(process.env, env);
  const handler = require("../api/environment.js");
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ headers: {} }, res);
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  return res;
}

test("practice copy: a *.vercel.app preview address shows the red bar pointing at the practice host", () => {
  const v = decide("ldtt-site-7flcl0vcs-joshuamatthews111s-projects.vercel.app", { sandbox: true, canonicalHosts: [PRACTICE] });
  assert.equal(v.kind, "practice");
  assert.equal(v.host, PRACTICE);
  assert.equal(v.text, `This is an old copy of the practice portal. Bookmark ${PRACTICE} instead.`);
});

test("practice copy on its own address shows nothing", () => {
  assert.equal(decide(PRACTICE, { sandbox: true, canonicalHosts: [PRACTICE] }), null);
  assert.equal(decide(PRACTICE.toUpperCase(), { sandbox: true, canonicalHosts: [PRACTICE] }), null);
});

test("live on a *.vercel.app address shows the bar pointing at the real domain; live domain and www show nothing", () => {
  const v = decide("ldtt-site-abc.vercel.app", { sandbox: false, canonicalHosts: [LIVE, `www.${LIVE}`] });
  assert.equal(v.kind, "live");
  assert.equal(v.host, LIVE);
  assert.equal(decide(LIVE, { sandbox: false, canonicalHosts: [LIVE, `www.${LIVE}`] }), null);
  assert.equal(decide(`www.${LIVE}`, { sandbox: false, canonicalHosts: [LIVE, `www.${LIVE}`] }), null);
});

test("localhost and a missing answer never show the bar", () => {
  assert.equal(decide("localhost", { sandbox: true, canonicalHosts: [PRACTICE] }), null);
  assert.equal(decide("127.0.0.1", { sandbox: false, canonicalHosts: [LIVE] }), null);
  assert.equal(decide("ldtt-site-abc.vercel.app", {}), null);
  assert.equal(decide("ldtt-site-abc.vercel.app", null), null);
});

test("/api/environment names the practice host on the practice copy (LDTT_PRACTICE_HOST overrides) and the live domain on live", async () => {
  const practice = await environment({ LDTT_SANDBOX: "1" });
  assert.equal(practice.body.sandbox, true);
  assert.deepEqual(practice.body.canonicalHosts, [PRACTICE]);
  assert.equal(practice.body.practiceHost, PRACTICE);
  const custom = await environment({ LDTT_SANDBOX: "1", LDTT_PRACTICE_HOST: "Try.Example.com" });
  assert.deepEqual(custom.body.canonicalHosts, ["try.example.com"]);
  const live = await environment({});
  assert.equal(live.body.sandbox, false);
  assert.deepEqual(live.body.canonicalHosts, [LIVE, `www.${LIVE}`]);
  assert.equal(live.headers["Cache-Control"], "no-store, max-age=0");
});

test("the bar script is loaded by both portal shells on the release tag, and the shells are served no-store", () => {
  for (const file of ["trainer-backoffice/index.html", "staff.html"]) {
    const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(html, /old-copy-bar\.js\?v=[a-z0-9]+/, `${file} loads old-copy-bar.js`); // any tag: the next line proves every portal script shares it
    const tags = [...html.matchAll(/(?:app|supabase|page-studio|site-builder|old-copy-bar)\.js\?v=([a-z0-9]+)/g)].map(m => m[1]);
    assert.ok(tags.length >= 5 && new Set(tags).size === 1, `${file} portal scripts all on one ?v= tag (${tags.join(",")})`);
  }
  const vercel = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const byPath = Object.fromEntries(vercel.headers.map(h => [h.source, h.headers[0].value]));
  for (const source of ["/staff", "/trainer-backoffice", "/trainer-backoffice/", "/trainer-backoffice/index.html", "/trainer-backoffice/(.*)\\.html"]) {
    assert.match(byPath[source] || "", /no-store/, `${source} is no-store`);
  }
});
