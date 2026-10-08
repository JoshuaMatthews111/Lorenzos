// Office 2026-10-07: trainer applications also get a Resend copy to recruiting@ (FormSubmit unchanged), and the
// alert bell treats an application with an accepted Resend copy as delivered.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("application email names the applicant and skips spam-trap fields", () => {
  const FD = require("../api/form-delivery.js");
  const p = FD.applicationEmailParts({ first_name: "Lily", last_name: "Ford", city: "Austin", state: "Texas", company_website: "", _honey: "x", why: "Love dogs <3" });
  assert.equal(p.subject, "New Trainer Application: Lily Ford (Austin, Texas)");
  assert.ok(!/_honey|company website/.test(p.html));
  assert.ok(p.html.includes("Love dogs &lt;3"));
});

test("FormSubmit stays; applications add a resend_application_email delivery", () => {
  const src = fs.readFileSync(new URL("../api/form-delivery.js", import.meta.url), "utf8");
  assert.match(src, /const APPLICATION_EMAIL = "https:\/\/formsubmit\.co\/ajax\/recruiting@lorenzosdogtrainingteam\.com";/);
  assert.match(src, /deliveries\.push\(\{ destination: "resend_application_email"/);
});

test("alert bell skips a failed FormSubmit copy when the Resend copy was accepted", () => {
  const SA = require("../lib/system-alerts.js");
  const now = Date.parse("2026-10-07T18:00:00Z"); const t = "2026-10-06T18:54:31Z";
  const base = [{ submission_id: "web-1", entity_id: "app-1", destination: "formsubmit_email", status: "failed", error_summary: "Failed to fetch", created_at: t }];
  assert.equal(SA.deliveryAlerts(base, new Map(), now).length, 1);
  assert.equal(SA.deliveryAlerts([...base, { submission_id: "web-1", entity_id: "app-1", destination: "resend_application_email", status: "accepted", created_at: t }], new Map(), now).length, 0);
});
