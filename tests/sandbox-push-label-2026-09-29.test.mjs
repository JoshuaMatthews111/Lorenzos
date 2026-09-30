// Joshua 2026-09-29: Harrison pressed the sandbox Publish and thought it changed the live website. On the
// practice copy every page editor's publish button says "Push live on the sandbox" and its confirm says the live
// site does NOT change; on live the buttons keep their old words.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("sandbox publish buttons say 'Push live on the sandbox'; live keeps 'Publish'", () => {
  const sb = read("trainer-backoffice/site-builder.js");
  assert.match(sb, /\$\("#sbPublishBtn"\)\.textContent = \(sb\.page\.sandbox \|\| window\.LDTT_IS_SANDBOX\) \? "Push live on the sandbox" : \(sb\.page\.status === "published" \? "Publish changes" : "Publish"\);/);
  assert.match(read("trainer-backoffice/page-studio.js"), /id="psPublishBtn">\$\{window\.LDTT_IS_SANDBOX \? "Push live on the sandbox" : "Publish"\}<\/button>/);
  assert.match(read("trainer-backoffice/ad2-studio.js"), /data-a2-publish>\$\{window\.LDTT_IS_SANDBOX \? "Push live on the sandbox" : "Publish"\}<\/button>/);
  for (const f of ["site-builder", "page-studio", "ad2-studio"]) assert.match(read(`trainer-backoffice/${f}.js`), /Pushing here does NOT change the live website\. To change the live site, use Send to live/, f);
});

test("Harrison 2026-09-29: design d1 draws the founder video play button only when a founder video is uploaded; the editor offers it", async () => {
  const { createRequire } = await import("node:module");
  const T = createRequire(import.meta.url)("../lib/ad2-page-template.js");
  const d1 = T.fromStarter("d1", { market: "Cleveland, OH", newSlug: "cleveland-test" });
  const founderSec = html => (html.match(/<section class="sec founder"[\s\S]*?<\/section>/) || [""])[0];
  assert.doesNotMatch(founderSec(T.renderPage(d1)), /class="o play"/, "no video: no button, bytes as before");
  const withVideo = { ...d1, videos2: { ...(d1.videos2 || {}), founder: "https://www.youtube.com/embed/abc123" } };
  assert.match(founderSec(T.renderPage(withVideo)), /class="o play" data-video="https:\/\/www\.youtube\.com\/embed\/abc123"/);
  assert.match(read("trainer-backoffice/site-builder.js"), /if \(slot === "founder" && \(design === "d2" \|\| design === "d1"\)\) return "founder";/);
});
