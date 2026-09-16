// Site Builder 2.0 (Joshua 2026-09-15: "one editor ... save changes, add block, change text, font, background,
// rearrange sections and elements, layout selections, colour schemes, upload video, duplicate ad landing pages and all
// pages, trainer bios page, full screen editor with instructions"). DO-NOT-BREAK rule 89. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const S = require("../lib/site-page-template.js");
const A2 = require("../lib/ad2-page-template.js");
const D = require("../lib/page-durability.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const fixedIds = content => { content.blocks.forEach((b, i) => { b.id = `${b.type}-fixed${i}`; }); return content; };

test("a page saved before 2.0 renders byte-for-byte the same; the new looks add CSS only when used", () => {
  for (const st of S.STARTERS) {
    const content = fixedIds(S.starter(st.id, { city: "Toledo", state: "OH" }));
    const html = S.renderSitePage(content, { base: "/", publicPath: `/${content.slug}` });
    assert.ok(!html.includes(".lay-slider"), `${st.id}: no 2.0 CSS on an old page`);
    assert.ok(!/data-sb-(edit|img|richedit)/.test(html), `${st.id}: no editor hooks on the public page`);
  }
  const block = S.normalizeBlock({ ...S.blankBlock("testimonials"), layout: "slider" });
  const html = S.renderSitePage({ pageType: "site", slug: "t", title: "T", blocks: [block] }, {});
  assert.ok(html.includes("lay-slider") && html.includes(".lay-slider"), "a slider layout carries its CSS");
});

test("layouts, design extras and fonts are whitelists; unknown values fall back", () => {
  assert.equal(S.normalizeBlock({ type: "hero", layout: "<script>" }).layout, "left");
  assert.equal(S.normalizeBlock({ type: "gallery", layout: "masonry" }).layout, "masonry");
  const d = S.normalizeBlock({ type: "richtext", html: "<p>x</p>", design: { gradFrom: "#112233", gradTo: "red", gradAngle: 999, overlay: "abc", textColor: "#ffffff", headSize: "huge", font: "comic", headFont: "oswald", bgVideo: "javascript:alert(1)" } }).design;
  assert.deepEqual([d.gradFrom, d.gradTo, d.gradAngle, d.overlay, d.textColor, d.headSize, d.font, d.headFont, d.bgVideo], ["#112233", "", 360, "", "#ffffff", "", "", "oswald", ""]);
  const theme = S.normalizeTheme({ logoWidth: 9999, headScale: "lg" });
  assert.deepEqual([theme.logoWidth, theme.headScale], [360, "lg"]);
  for (const scheme of S.COLOR_SCHEMES) assert.deepEqual(S.themeWarnings({ colors: scheme.colors }), [], `${scheme.id} is readable`);
  // a background photo's address can no longer break the style attribute (it used raw double quotes before)
  const bg = S.renderSitePage({ pageType: "site", slug: "t", title: "T", blocks: [{ ...S.blankBlock("richtext"), design: { ...S.blankDesign(), bgImage: "assets/x.jpg" } }] }, {});
  assert.match(bg, /background-image:url\(&quot;\/assets\/x\.jpg&quot;\)/);
});

test("the Video block takes an uploaded file (controls on by default) and the checklist asks for it", () => {
  const v = S.normalizeBlock({ type: "video", provider: "file", src: "https://abc.supabase.co/storage/v1/object/public/trainer-page-videos/site/a.mp4", autoplay: true, loop: true });
  assert.deepEqual([v.provider, v.controls, v.autoplay, v.loop], ["file", true, true, true]);
  const html = S.renderSitePage({ pageType: "site", slug: "t", title: "T", blocks: [v] }, {});
  assert.match(html, /<video class="sb-video-file" src="https:\/\/abc\.supabase\.co\/[^"]+\.mp4" controls autoplay muted loop playsinline preload="metadata"><\/video>/);
  const empty = S.sitePublishChecklist({ pageType: "site", slug: "t", title: "T", seo: { description: "x" }, blocks: [{ ...S.blankBlock("hero") }, { type: "video", provider: "file" }] });
  assert.ok(empty.failures.some(f => /upload the video file/.test(f.fix)));
});

test("editor-only hooks: words, rich text and photos are clickable on the canvas only", () => {
  const content = fixedIds(S.starter("services", {}));
  const editor = S.renderSitePage(content, { editor: true });
  assert.match(editor, /data-sb-edit="blocks\.0\.headline"/);
  assert.match(editor, /data-sb-edit="blocks\.1\.items\.0\.title"/);
  assert.match(editor, /class="sb-photo-btn" data-sb-img="blocks\.0\.image"/);
  const publicHtml = S.renderSitePage(content, {});
  assert.ok(!/data-sb-|sb-photo-btn/.test(publicHtml));
});

test("block kit: blocks on a page that is not a block page, form refused, no H1, scoped CSS", () => {
  const blocks = S.normalizeKitBlocks([{ ...S.blankBlock("testimonials"), after: "founder" }, { ...S.blankBlock("form"), after: "hero" }, { ...S.blankBlock("hero"), after: "nowhere" }], ["hero", "founder"]);
  assert.deepEqual(blocks.map(b => [b.type, b.after]), [["testimonials", "founder"], ["hero", "end"]]);
  const html = S.renderKitBlocks(blocks.map((block, index) => ({ block, index })), {});
  assert.ok(!/<h1/.test(html), "a kit block never makes an H1");
  assert.equal((html.match(/<div class="ldtt-bk">/g) || []).length, 2);
  const style = S.kitStyle(blocks, { colors: { primary: "#001f42", accent: "#d10f2d" } });
  assert.match(style, /\.ldtt-bk\{--navy:#001f42;--navy2:#[0-9a-f]{6};--red:#d10f2d;\}/);
});

test("2.0 ad pages: unchanged pages stay byte-identical; blocks, order, hide and logo work; editor hooks only in the editor", () => {
  for (const starter of A2.STARTERS) {
    const n = A2.normalizeContent(starter);
    assert.deepEqual(["blocks", "logo", "hidden", "order"].filter(k => k in n), [], "no new keys on an old page");
  }
  const c = JSON.parse(JSON.stringify(A2.STARTERS[1])); // d2
  c.blocks = [{ ...S.blankBlock("video"), provider: "file", src: "https://abc.supabase.co/storage/v1/object/public/trainer-page-videos/site/a.mp4", after: "rvs" }, { ...S.blankBlock("form"), after: "hero" }];
  c.hidden = ["ebook", "hdr"]; c.order = ["svc", "founder2"]; c.logo = { photo: "https://abc.supabase.co/storage/v1/object/public/trainer-page-assets/site/l.png", size: 999 };
  const n = A2.normalizeContent(c);
  assert.deepEqual(n.blocks.map(b => [b.type, b.after]), [["video", "rvs"]], "the lead form block is refused");
  assert.deepEqual(n.hidden, ["ebook"], "the header can never be hidden");
  assert.equal(n.logo.size, 220);
  const html = A2.renderPage(n, { practice: true });
  assert.ok(html.indexOf('class="sec svc') < html.indexOf('class="sec founder2'), "Training cards moved above the founder");
  assert.ok(!html.includes('class="sec ebook'), "the booklet is hidden");
  assert.ok(html.indexOf('<video class="sb-video-file"') > html.indexOf('class="sec rvs'), "the video sits after the reviews section");
  assert.equal((html.match(/ldtt-custom-logo/g) || []).length, 2, "header + footer logo");
  assert.ok(!/data-sb-/.test(html));
  const editor = A2.renderPage(n, { practice: true, preview: true, editor: true });
  assert.match(editor, /data-sb-sec="rvs"/);
  assert.match(editor, /data-sb-add-btn="after:rvs"/);
  assert.match(editor, /data-sb-hidden-sec="ebook"/);
  assert.match(editor, /data-sb-img="logo\.photo" class="a hdr-logo"/);
});

test("durability: an uploaded video counts as the site's own storage and is never copied into the photo bucket", () => {
  const url = "https://ptnzaeprvkgjgtupmcty.supabase.co/storage/v1/object/public/trainer-page-videos/site/a.mp4";
  assert.equal(D.classifyMedia(url).kind, "own-bucket");
  assert.ok(D.MEDIA_KEYS.has("bgVideo"));
  assert.match(read("lib/page-durability.js"), /const bucket = \/\^video\\\/\/i\.test\(String\(contentType \|\| ""\)\) \? VIDEO_BUCKET : ASSET_BUCKET;/);
});

test("big uploads: office login, signed one-time address, videos up to 50 MB and photos up to 10 MB only", async () => {
  const pages = require("../api/pages.js");
  const calls = [];
  const realFetch = pages.deps.fetch;
  pages.deps.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET" });
    if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "u1", email: "office@x.co" }), { status: 200 });
    if (String(url).includes("/rest/v1/portal_users")) return new Response(JSON.stringify([{ user_id: "u1", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "office@x.co", first_name: "O", last_name: "A" }]), { status: 200 });
    if (String(url).includes("/storage/v1/object/upload/sign/")) return new Response(JSON.stringify({ url: "/object/upload/sign/trainer-page-videos/site/x.mp4?token=abc" }), { status: 200 });
    return new Response("[]", { status: 200 });
  };
  const call = async body => { const res = { statusCode: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } }; await pages({ method: "POST", headers: { authorization: "Bearer t" }, body }, res); return res; };
  try {
    const ok = await call({ operation: "upload_url", name: "My Clip.MP4", type: "video/mp4", size: 30 * 1024 * 1024 });
    assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
    assert.match(ok.body.signedUrl, /\/storage\/v1\/object\/upload\/sign\/trainer-page-videos\/site\/x\.mp4\?token=abc$/);
    assert.match(ok.body.publicUrl, /\/storage\/v1\/object\/public\/trainer-page-videos\/site\/[a-z0-9]+-my-clip\.mp4$/);
    assert.equal((await call({ operation: "upload_url", name: "big.mp4", type: "video/mp4", size: 51 * 1024 * 1024 })).statusCode, 413);
    assert.equal((await call({ operation: "upload_url", name: "big.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 })).statusCode, 413);
    assert.equal((await call({ operation: "upload_url", name: "x.exe", type: "application/octet-stream", size: 10 })).statusCode, 400);
  } finally { pages.deps.fetch = realFetch; }
});

test("the Site Builder is the one editor: wiring for every page type, help, copies, inline editing, trainer save path", () => {
  const sb = read("trainer-backoffice/site-builder.js");
  assert.match(sb, /data-sb-act="help" title="How to use the Site Builder">\? How to use<\/button>/);
  assert.match(sb, /const HELP_STEPS = \[/);
  assert.match(sb, /function runTour\(step = 0\)/);
  assert.match(sb, /function startInlineEdit\(el, event\)/);
  assert.match(sb, /function openPhotoPicker\(path\)/);
  assert.match(sb, /operation: "upload_url"/);
  assert.match(sb, /function duplicatePage\(id\)/);
  assert.match(sb, /data-sb-act="dup-page"/);
  assert.match(sb, /const kindOf = page => \(page\?\.page_type === "ad2" \? "ad2" : "blocks"\);/);
  assert.match(sb, /async function openTrainer\(trainerId\)/);
  // trainer pages save and publish through the Page Editor's own functions (rules 31, 56, 59)
  assert.match(sb, /if \(portalHas\("persistTrainerRecord"\)\) await persistTrainerRecord\(t\);/);
  assert.match(sb, /await runRemoteMutation\("Trainer page published and locked", \(\) => publishTrainerPageWorkflow\(t, true\)/);
  assert.match(sb, /String\(t\.id\) !== String\(trainerId\) && String\(t\.remoteId\) !== String\(trainerId\)/, "never edits a different trainer than the one opened (rule 31)");
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /custom_blocks: Array\.isArray\(trainer\.customBlocks\) \? trainer\.customBlocks : \[\]/);
  assert.match(app, /customBlocks: objectHas\(content, "custom_blocks"\)/);
  assert.match(app, /function applyTrainerCustomBlocksPublic\(trainer\) \{\n  if \(!Array\.isArray\(trainer\?\.customBlocks\) \|\| !trainer\.customBlocks\.length\) return;/, "a trainer page without blocks loads nothing extra (rule 43)");
  assert.match(app, /sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"/, "the Page Editor preview can no longer send the portal away");
  assert.match(read("trainer-backoffice/page-studio.js"), /sbDoor\.dataset\.sbOpen = "current"/);
  assert.match(read("trainer-backoffice/ad2-studio.js"), /if \(!classic && window\.LDTT_SITE_BUILDER\) return window\.LDTT_SITE_BUILDER\.open\(pageId\);/);
});

test("audit fixes (2026-09-15 night): MOV refused, trainer saves write only changed fields, a click that changes nothing writes nothing, Delete (not Backspace) removes a block, \"$\" in a 2.0 logo address is harmless", async () => {
  const pages = read("api/pages.js");
  assert.ok(!/"video\/quicktime": \[/.test(pages), "MOV is not signed for upload");
  assert.match(pages, /That is an iPhone MOV video\. Save it as MP4 first/);
  const sb = read("trainer-backoffice/site-builder.js");
  assert.ok(!/video\/quicktime"/.test(sb.replace(/if \(file\.type === "video\/quicktime"\)/, "")), "the picker no longer offers MOV");
  assert.match(sb, /function applyChangedToTrainer\(t, base, d\)/);
  assert.match(sb, /applyChangedToTrainer\(t, sb\.trainerBase, sb\.draft\); sb\.trainerBase = S\(\)\.clone\(sb\.draft\);/);
  assert.ok(!/applyDraftToTrainer\(t, sb\.draft\)/.test(sb), "no save writes the whole screen back any more");
  assert.match(sb, /if \(after === before\) \{/);
  assert.match(sb, /else if \(event\.key === "Delete"\) \{ event\.preventDefault\(\); blockAction\("remove", index\); \}/);
  assert.ok(!/event\.key === "Backspace"/.test(sb));
  const c = JSON.parse(JSON.stringify(A2.STARTERS[1]));
  c.logo = { photo: "https://example.com/$1-$&-logo.png", size: 100 };
  const html = A2.renderPage(c, { practice: true });
  assert.equal((html.match(/<img class="ldtt-custom-logo" src="https:\/\/example\.com\/\$1-\$&amp;-logo\.png"/g) || []).length, 2, "the address is written as typed, in header and footer");
  const editor = A2.renderPage(A2.STARTERS[0], { practice: true, preview: true, editor: true });
  assert.match(editor, /src="\/assets\/v2\/d1-founder\.webp" data-sb-img="photos\.founder"/, "the design's photos open the photo picker in the editor");
  assert.match(read("trainer-backoffice/app.js"), /const ads = \[\]; \/\/ Page Studio ad pages carry the Meta pixel/);
});

test("Joshua 2026-09-16: the 'Closing call + locations map' block draws on 2.0 pages and plain site pages; saved blocks are normalized", () => {
  const b = S.blankBlock("locations", { market: "Chicago, IL" });
  assert.equal(b.states.length, 12);
  const c = A2.normalizeContent({ design: "d2", slug: "x", blocks: [{ ...b, after: "ebook" }] });
  const html = A2.renderPage(c, { practice: true });
  assert.match(html, /loc-close/); assert.match(html, /loc-map-svg[^>]*><svg/); assert.match(html, /tel:\+18664364959/);
  const noMap = A2.renderPage(A2.normalizeContent({ design: "d3", slug: "x", blocks: [{ ...b, showMap: false, after: "rvs" }] }), { practice: true });
  assert.doesNotMatch(noMap, /<div class="loc-map-svg">/, "the map can be switched off (d3 already has one)");
  const site = S.normalizeSitePage({ slug: "y", title: "y", blocks: [b] });
  assert.ok(S.renderSitePage(site, { base: "/" }).includes("loc-states"));
});
