// Writes the six static protection pages (protection-<slug>.html) from lib/protection-pages.js.
// Static files so site_text_marker.py can tag the text spots for the office Page Editor (rule 61).
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const P = require("../lib/protection-pages.js");
for (const slug of Object.keys(P.MARKETS)) {
  fs.writeFileSync(new URL(`../protection-${slug}.html`, import.meta.url), P.renderProtectionPage(slug));
  console.log(`protection-${slug}.html`);
}
