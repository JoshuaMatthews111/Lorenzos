// Rule 87 (office 2026-09-15; meeting 2026-09-14 16:30 Tim; meeting 2026-09-12 "Track 500 - Schedule Eval"): the lead
// timeline shows what really happened and the words in use; Track 500 on the trainer + Tim texts (practice data),
// the office emails and a tag on pipeline leads. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("the timeline shows real sends and the words in use; no more 'wording not supplied'", () => {
  const app = read("trainer-backoffice/app.js");
  assert.ok(!/Wording not supplied yet/.test(app));
  assert.ok(!/the bot is not live yet/.test(app));
  assert.match(app, /fetch\("\/api\/pipeline\?op=texts_in_use"/);
  assert.match(app, /case "link": return fromRecord\(pipeline\.new_lead_text, "Sent"\)/);
  assert.match(app, /case "email": \{/);
  assert.ok((app.match(/\$\{serviceDogTag\(lead\)\}\$\{track500Tag\(lead\)\}/g) || []).length >= 4, "Track 500 tag beside the service-dog tag");
  const api = read("api/pipeline.js");
  assert.match(api, /if \(op === "texts_in_use"\) \{/);
  const block = api.slice(api.indexOf('if (op === "texts_in_use")'), api.indexOf('if (op === "followup")'));
  assert.ok(!/templates|draft/.test(block.replace(/\/\/[^\n]*/g, "")), "read-only: words in use only");
});

test("office emails say Track 500", () => {
  const M = require("../lib/office-email.js");
  const email = M.buildBookingEmail({ lead: { id: "l1", raw_payload: {} }, booking: { when_label: "Thu, Sep 17, 8:00 AM CDT", trainer_name: "Lorenzo Miller", client: { first_name: "Sam", last_name: "Carter" }, dogs: [] } });
  assert.match(email.subject, /^(\[PRACTICE COPY\] )?Track 500 · Eval booked: Sam Carter with Lorenzo Miller, Thu, Sep 17, 8:00 AM CDT/);
});
