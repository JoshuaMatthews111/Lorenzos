// Trainer bio page reviews (Joshua 2026-09-16): a "See my reviews" button in the bio page hero and a
// "What clients say about <first name>" block, only when the trainer has a real review to show —
// approved reviews published to the trainer's page, the manual review boxes ticked "Show on page",
// or reviews the reviews API returns for the page. Pure helpers pulled out of trainer-backoffice/app.js;
// nothing here talks to the real project. NOT deployed (tests/ is in .vercelignore).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../trainer-backoffice/app.js", import.meta.url), "utf8");
const siteCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

const fn = name => {
  const match = app.match(new RegExp(`\\n(?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n`));
  assert.ok(match, `${name} is defined in app.js`);
  return match[0];
};
const H = new Function(`${["escapeHtml", "placeholderReviewCopy", "trainerBioReviewList", "trainerBioReviewsButton", "trainerBioReviewDate", "trainerBioReviewsSection"].map(fn).join("\n")}
  return { trainerBioReviewList, trainerBioReviewsButton, trainerBioReviewsSection };`)();

const trainer = (extra = {}) => ({ id: "3c480bd1-b536-48a1-86a3-d9a3750acc7a", name: "Eric Beck", review1Show: false, review2Show: false, review3Show: false, approvedReviews: [], ...extra });
const becca = { id: "sub-becca", reviewer: "Becca L.", review_text: "I honestly owe my sanity to Lorenzo's Dog Training Team, especially Eric.", rating: "5", published_at: "2026-09-16T12:00:00Z" };

test("bio page: no reviews -> no button and no #reviews section", () => {
  const reviews = H.trainerBioReviewList(trainer());
  assert.deepEqual(reviews, []);
  assert.equal(H.trainerBioReviewsButton(reviews), "");
  assert.equal(H.trainerBioReviewsSection(trainer(), reviews), "");
});

test("bio page: an approved review published to the trainer page shows the button and the block", () => {
  const t = trainer({ approvedReviews: [{ submission_id: "sub-1", author: "Barbara F.", copy: "Kane is a whole new dog.", rating: "5", location: "Parma, OH", display: { showLocation: true } }] });
  const reviews = H.trainerBioReviewList(t);
  assert.equal(reviews.length, 1);
  assert.equal(H.trainerBioReviewsButton(reviews), `<a class="btn btn-outline trainer-profile-reviews-link" href="#reviews">See my reviews</a>`);
  const section = H.trainerBioReviewsSection(t, reviews);
  assert.ok(section.includes(`id="reviews"`), "the block carries id=reviews so the button can jump to it");
  assert.ok(section.includes("What clients say about <span data-trainer-profile-first-name>Eric</span>"), "heading uses the first name");
  assert.ok(section.includes("<strong>Barbara F.</strong>"));
  assert.ok(section.includes("<span>Parma, OH</span>"), "location shows when the office ticked it");
  assert.ok(section.includes("Kane is a whole new dog."));
});

test("bio page: manual reviews show only with the 'Show on page' tick; placeholder copy never shows", () => {
  const t = trainer({ review1Author: "Jessica R.", review1Copy: "Calmer dog at home.", review1Show: false, review2Author: "Mike T.", review2Copy: "Clear and professional.", review2Show: true, review3Author: "", review3Copy: "Office-approved client testimonial.", review3Show: true });
  const reviews = H.trainerBioReviewList(t);
  assert.deepEqual(reviews.map(r => [r.id, r.author, r.copy]), [["manual-2", "Mike T.", "Clear and professional."]]);
  assert.ok(H.trainerBioReviewsButton(reviews));
  const off = H.trainerBioReviewList(trainer({ review1Author: "Jessica R.", review1Copy: "Calmer dog at home.", review1Show: "true" }));
  assert.equal(off.length, 0, "only a real true tick counts");
});

test("bio page: API reviews merge in without duplicating the saved copy; media-only reviews are skipped", () => {
  const t = trainer({ approvedReviews: [{ submission_id: "sub-becca", author: "Becca L.", copy: becca.review_text }, { submission_id: "sub-photo", author: "Photo Only", copy: "", media_url: "x.jpg" }] });
  const reviews = H.trainerBioReviewList(t, [becca, { id: "sub-steph", reviewer: "Stephanie P.", review_text: "Robert truly changed my life.", rating: 5, published_at: "2026-09-16T12:00:00Z" }]);
  assert.deepEqual(reviews.map(r => r.id), ["sub-becca", "sub-steph"]);
  const section = H.trainerBioReviewsSection(t, reviews);
  assert.equal((section.match(/<article class="trainer-profile-review">/g) || []).length, 2);
  assert.ok(section.includes("<time datetime=\"2026-09-16\">"), "an API review carries its published date");
  assert.ok(!section.includes("Photo Only"));
});

test("bio page: review text is escaped and the star rating is clamped", () => {
  const t = trainer({ approvedReviews: [{ submission_id: "s", author: "<b>x</b>", copy: "<script>alert(1)</script>", rating: "9" }] });
  const section = H.trainerBioReviewsSection(t, H.trainerBioReviewList(t));
  assert.ok(!section.includes("<script>"));
  assert.ok(section.includes("&lt;b&gt;x&lt;/b&gt;"));
  assert.ok(section.includes(`aria-label="5 star review"`));
});

test("bio page template wires the button next to Schedule This Trainer, the block after the bio, and the API refresh", () => {
  const markup = fn("publicTrainerProfileMarkup");
  assert.ok(markup.includes(`>Schedule This Trainer</a>\${trainerBioReviewsButton(reviews)}`), "button sits next to the existing call-to-action");
  assert.ok(markup.includes("</section>${trainerBioReviewsSection(trainer, reviews)}"), "block follows the bio section");
  assert.ok(fn("renderPublicTrainerProfile").includes("refreshPublicTrainerBioReviews(trainer);"));
  const refresh = fn("refreshPublicTrainerBioReviews");
  assert.ok(refresh.includes("destination_type=trainer_page&destination_id="), "asks the reviews API for this trainer page");
  assert.ok(siteCss.includes(".trainer-profile-reviews{") && siteCss.includes(".trainer-profile-review-grid{"), "site stylesheet styles the block");
});
