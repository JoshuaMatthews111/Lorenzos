// Joshua 2026-09-26 (Missy, Eric Beck's bio): "Update landing page" really updates the LIVE landing page when the page
// is already live; "Publish & Lock Trainer Page" says so; after both, the live page is read back and any change that did
// not reach it is named. The pasted trainer video is saved with the page. DO-NOT-BREAK rule 123 (amends rule 56).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(import.meta.dirname, "..", "trainer-backoffice/app.js"), "utf8");
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

test("the trainer video is saved with the page and read back from it", () => {
  assert.match(app, /trainer_video_url: String\(trainer\.trainerVideoUrl \|\| ""\)/);
  assert.match(app, /trainerVideoUrl: objectHas\(content, "trainer_video_url"\) \? String\(content\.trainer_video_url \|\| ""\)/);
});

test("Update landing page publishes a live page (and checks it); a never-published page stays a draft and says so", () => {
  const handler = block('const syncProfileField = event.target.closest("[data-sync-profile-field]")', 'const syncPublicField');
  assert.match(handler, /const livePage = trainerHasPublishedPage\(trainer\)/);
  assert.match(handler, /livePage \? publishTrainerPageWorkflow\(trainer, true\) : persistTrainerRecord\(trainer, \{\}\)/);
  assert.match(handler, /reportLiveLandingPage\(/);
  assert.match(handler, /saved as a DRAFT: this page has never been published/);
  assert.doesNotMatch(handler, /synced to landing page`,\n/, "the old misleading 'synced' toast is gone");
});

test("both Publish & Lock paths read the live page back and name anything missing", () => {
  const count = (app.match(/await reportLiveLandingPage\(published, "Trainer page published and locked"\)/g) || []).length;
  assert.equal(count, 2);
  const fn = block("async function liveLandingPageMismatches", "async function reportLiveLandingPage");
  assert.match(fn, /loadPublishedTrainer\(slug, \{ includeDraft: false \}\)/, "reads the LIVE (published) page, not the draft");
  for (const key of ["bio", "trainer_video_url", "seo_title"]) assert.match(fn, new RegExp(key));
  const report = block("async function reportLiveLandingPage", "async function publishTrainerPageWorkflow");
  assert.match(report, /does NOT show the new/);
  assert.match(report, /Checked: the live landing page now shows everything you changed/);
});
