// Photos + logo: change, move, resize (portal chain step 5, DO-NOT-BREAK rule 76). Proves:
//   1. Page Studio (lib/ad-page-template.js normalizeContent) keeps logo {photo,w,x,y} and each
//      photo's photoW / photoX / photoY as CLAMPED INTEGERS, drops junk, and leaves the keys OUT
//      when empty — so a page nobody sized stores and renders exactly what it did before;
//   2. nothing the office types reaches CSS: only integers; "100%;background:url(x)" is dropped;
//      logo.photo goes through safeUrl (javascript: / data: refused);
//   3. rendering: the size/move style appears only when set, the phone rule only when something
//      was moved, the editor-only data-ps-media hooks only in editor mode;
//   4. publish copy-in (lib/page-durability.js collectMedia) finds an uploaded logo (key "photo"),
//      so a practice upload is copied into the live bucket like any other photo (rules 18 + 27);
//   5. the trainer Page Editor helpers in app.js clamp the same way and round-trip content keys;
//   6. Page Editor opens full screen on entry; Lead Journey Test is off the menu behind a flag (rule 63).
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const T = require("../lib/ad-page-template.js");
const D = require("../lib/page-durability.js");
const app = readFileSync(new URL("../trainer-backoffice/app.js", import.meta.url), "utf8");
const studio = readFileSync(new URL("../trainer-backoffice/page-studio.js", import.meta.url), "utf8");
const portalCss = readFileSync(new URL("../trainer-backoffice/styles.css", import.meta.url), "utf8");

const base = () => T.marketToContent(T.markets.find(m => m.slug === "dog-training-columbus-oh") || T.markets[0]);
const render = (content, editor = false) => T.renderAdPage(content, { editor, base: "/", publicPath: `/ads/${content.slug}` });

test("Page Studio: size/move keys are clamped integers and left out when empty", () => {
  const plain = T.normalizeContent(base());
  assert.equal("logo" in plain, false, "no logo key on an unchanged page");
  assert.equal("photoW" in plain.hero, false);
  assert.equal(plain.sections.some(s => "photoW" in s || "photoX" in s || "photoY" in s), false);

  const c = base();
  c.hero.photoW = "55.4"; c.hero.photoX = 9999; c.hero.photoY = -9999;
  c.logo = { photo: "https://example.test/logo.png", w: 5000, x: "-12", y: 0 };
  const care = c.sections.find(s => s.photo !== undefined);
  care.photoW = 3; care.photoX = "abc"; care.photoY = 40;
  const n = T.normalizeContent(c);
  assert.deepEqual([n.hero.photoW, n.hero.photoX, n.hero.photoY], [55, 400, -300]);
  assert.deepEqual(n.logo, { photo: "https://example.test/logo.png", w: 360, x: -12 });
  const nc = n.sections.find(s => s.id === care.id);
  assert.equal(nc.photoW, 20);
  assert.equal("photoX" in nc, false, "junk is dropped");
  assert.equal(nc.photoY, 40);
  // sections without a photo never get the keys
  const noPhoto = T.normalizeContent({ ...base(), sections: [{ type: "faq", photoW: 50, photoX: 10 }] });
  assert.equal("photoW" in noPhoto.sections[0], false);
});

test("Page Studio: nothing typed reaches CSS; the logo address goes through safeUrl", () => {
  const c = base();
  c.hero.photoW = "100%;background:url(https://evil.test/x)";
  c.hero.photoX = "1px;position:fixed";
  c.logo = { photo: "javascript:alert(1)", w: "120px\"><script>", x: true };
  const n = T.normalizeContent(c);
  assert.equal("photoW" in n.hero, false);
  assert.equal("photoX" in n.hero, false);
  assert.equal("logo" in n, false, "a bad logo address and junk numbers leave no logo key");
  assert.equal(T.normalizeContent({ ...base(), logo: { photo: "data:image/png;base64,AAAA" } }).logo, undefined);
  const html = render(c);
  assert.equal(/evil\.test|position:fixed|javascript:|<script>alert/.test(html), false);
  assert.equal(T.photoStyle({ photoW: 50, photoX: 10, photoY: -5 }), "max-width:50%;margin-inline:auto;display:block;translate:10px -5px;");
  assert.equal(T.logoStyle({ w: 200 }), "width:200px;height:auto;max-width:46vw;");
  assert.equal(T.photoStyle({}), "");
  assert.equal(T.logoStyle(null), "");
});

test("Page Studio render: unchanged page identical, styles only when set, phone rule only when moved, hooks only in the editor", () => {
  const c = base();
  const before = render(c);
  assert.equal(render(T.normalizeContent(c)), before, "normalizing an unchanged page changes nothing");
  assert.equal(before.includes("data-ps-media"), false, "no editor hooks on the public page");
  assert.equal(before.includes('img[style*="translate:"]'), false, "no phone rule when nothing moved");
  assert.ok(before.includes('<img class="logo" src="/assets/lorenzo-logo-white.png" alt="Lorenzo\'s Dog Training Team">'), "standard logo markup unchanged");

  const sized = base(); sized.hero.photoW = 60; sized.logo = { w: 220 };
  const sizedHtml = render(sized);
  assert.ok(sizedHtml.includes("max-width:60%;margin-inline:auto;display:block;"));
  assert.ok(sizedHtml.includes('style="width:220px;height:auto;max-width:46vw;"'));
  assert.equal(sizedHtml.includes('img[style*="translate:"]'), false, "size alone ships no phone rule");

  const moved = base(); moved.logo = { photo: "https://example.test/l.png", x: 30, y: -4 };
  const movedHtml = render(moved);
  assert.ok(movedHtml.includes('src="https://example.test/l.png"'));
  assert.ok(movedHtml.includes("translate:30px -4px;"));
  assert.ok(movedHtml.includes('@media (max-width:700px){img[style*="translate:"]{translate:none!important}}'), "a move ships the phone rule");

  const editorHtml = render(base(), true);
  assert.ok(editorHtml.includes('data-ps-media="logo"'));
  assert.ok(/data-ps-media="(hero|care-\d+)"/.test(editorHtml));
});

test("publish copy-in finds an uploaded logo (key photo), like every other photo", () => {
  const n = T.normalizeContent({ ...base(), logo: { photo: "https://x.supabase.co/storage/v1/object/public/practice-trainer-page-assets/site/a-logo.png", w: 150 } });
  const found = D.collectMedia(JSON.parse(JSON.stringify(n))).map(m => m.path.join("."));
  assert.ok(found.includes("logo.photo"), `collectMedia saw: ${found.join(", ")}`);
});

test("trainer Page Editor helpers clamp the same way and round-trip content keys", () => {
  const pick = name => app.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`))[0];
  const src = ["trainerMediaSpec", "cleanTrainerMediaNumber", "trainerMediaValues", "trainerMediaStyle", "trainerMediaFromContent", "trainerMediaToContent"].map(pick).join("\n");
  const M = new Function(`${src}; return { trainerMediaStyle, trainerMediaFromContent, trainerMediaToContent, cleanTrainerMediaNumber };`)();
  assert.equal(M.trainerMediaStyle({}, "logo"), "", "nothing set = the design's own");
  assert.equal(M.trainerMediaStyle({ logoWidth: "999", logoX: "-500", logoY: "7" }, "logo"), "width:320px;height:auto;max-width:46vw;translate:-150px 7px;");
  assert.equal(M.trainerMediaStyle({ heroPhotoWidth: "12" }, "hero"), "width:30%;height:auto;min-height:0;max-height:none;margin-inline:auto;display:block;");
  assert.equal(M.trainerMediaStyle({ bioPhotoWidth: "50%;background:url(x)", bioPhotoX: "1e9" }, "bio"), "translate:300px 0px;");
  assert.equal(M.cleanTrainerMediaNumber(true, 0, 10), "");
  const ui = M.trainerMediaFromContent({ logo_width: 150, hero_photo_x: -20, bio_photo_width: "80" });
  assert.equal(ui.logoWidth, 150); assert.equal(ui.heroPhotoX, -20); assert.equal(ui.bioPhotoWidth, 80); assert.equal(ui.logoX, "");
  const back = M.trainerMediaToContent(ui);
  assert.deepEqual(Object.keys(back).sort(), ["bio_photo_width", "bio_photo_x", "bio_photo_y", "hero_photo_width", "hero_photo_x", "hero_photo_y", "logo_width", "logo_x", "logo_y"]);
  assert.equal(back.logo_width, 150); assert.equal(back.bio_photo_y, "");
  // wired into load, save, the three renders, the controls and the preview drag
  assert.ok(app.includes("...trainerMediaFromContent(content), // rule 76"));
  assert.ok(app.includes("...trainerMediaToContent(trainer), // rule 76"));
  assert.ok(app.includes('trainerMediaStyle(trainer, "hero")') && app.includes('trainerMediaStyle(trainer, "bio")') && app.includes('trainerMediaStyle(trainer, "logo")'));
  assert.ok(app.includes('mediaPart: "logo"') && app.includes('mediaPart: "hero"') && app.includes('mediaPart: "bio"'));
  assert.ok(app.includes("wireTrainerMediaDrag(doc); // rule 76"));
  assert.ok(/@media \(max-width: 700px\) \{ img\[style\*="translate:"\] \{ translate: none !important; \} \}/.test(portalCss), "phones keep the design's place");
});

test("Page Studio wiring: upload through api/pages.js, sliders, logo in Style, preview drag", () => {
  assert.ok(studio.includes('api({ operation: "upload", name: file.name, type: prepared.type, data: prepared.data })'), "same upload path as the Site Builder");
  assert.ok(studio.includes("const UPLOAD_RAW_LIMIT = 3 * 1024 * 1024;"), "stays under Vercel's request limit after base64");
  assert.ok(studio.includes('mediaControls(`sections.${index}`, section)') && studio.includes('mediaControls("hero", h)') && studio.includes('mediaControls("logo", logo, "logo")'));
  assert.ok(studio.includes("${logoFields(d)}"));
  assert.ok(studio.includes("function wireMediaDrag(doc)"));
});

test("Page Editor opens full screen on entry; Lead Journey Test is off the menu behind a flag", () => {
  assert.ok(/const shown = Boolean\(\$\("\.page-editor-shell\.fullscreen-builder"\)\);\s*if \(shown && !builderShown\) setBuilderFullscreen\(true\);/.test(studio), "entry turns full screen on");
  assert.equal(studio.includes('localStorage.getItem("ps-builder-fullscreen") === "1"'), false, "no longer depends on a remembered choice");
  assert.ok(/\.ps-overlay\{position:fixed;inset:0;z-index:9500/.test(readFileSync(new URL("../trainer-backoffice/page-studio.css", import.meta.url), "utf8")), "Page Studio editor is a full-screen overlay");
  const flagSrc = app.match(/function leadJourneyTestEnabled\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(flagSrc.includes("const LEAD_JOURNEY_TEST_IN_MENU = false;"));
  const enabled = new Function("window", `${flagSrc}; return leadJourneyTestEnabled();`);
  assert.equal(enabled({ LDTT_IS_SANDBOX: true }), false, "hidden even on the practice copy");
  const on = new Function("window", `${flagSrc.replace("= false;", "= true;")}; return leadJourneyTestEnabled();`);
  assert.equal(on({ LDTT_IS_SANDBOX: true }), true, "flip the flag and it comes back (practice copy)");
  assert.equal(on({ LDTT_IS_SANDBOX: false }), false, "never on live");
  assert.ok(app.includes('...(leadJourneyTestEnabled() ? [["pathwayTest", "Lead Journey Test", "message"]] : [])'));
  assert.ok(app.includes('if (view === "pathwayTest") return leadJourneyTestEnabled();'));
  assert.ok(app.includes("function pathwayTestScreen()"), "the screen code is kept");
});
