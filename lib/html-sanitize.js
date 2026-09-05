// Rich-text sanitiser for the Site Builder.
//
// The office's Rich text block keeps a SMALL subset of HTML (paragraphs, bold,
// italic, links, lists, headings, quotes, images). Everything else is thrown
// away here, on the server before it is stored and in the browser before it is
// previewed. The output is rebuilt from scratch: only the tags in ALLOWED are
// ever emitted, every attribute is dropped unless it is in the per-tag list and
// passes its checker, and every piece of text is re-escaped. A <script>, an
// onerror=, a javascript: link or a broken tag therefore cannot survive — the
// output never contains a byte the office typed as markup.
//
// CommonJS + browser global on purpose (same pattern as lib/ad-page-template.js).
(function (root, factory) {
  const mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.LDTT_HTML_SANITIZE = mod;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", copy: "©", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", middot: "·", trade: "™", reg: "®" };
  const decodeEntities = value => String(value ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (!Number.isFinite(code) || code < 32 && code !== 10 && code !== 9 || code > 0x10ffff) return "";
      try { return String.fromCodePoint(code); } catch { return ""; }
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, name.toLowerCase()) ? ENTITIES[name.toLowerCase()] : match;
  });

  // Links: http(s), mailto, tel, root-relative paths and in-page anchors only.
  const safeHref = value => {
    const href = decodeEntities(String(value ?? "")).replace(/[\u0000-\u001f\u007f\s]/g, "").trim();
    if (!href) return "";
    if (/^(https?:\/\/[^"'<>\\]+|mailto:[^"'<>\\\s]+|tel:\+?[0-9()\-. ]+)$/i.test(href)) return href.slice(0, 500);
    if (/^\/(?!\/)[a-z0-9_\-./%?=&#+]*$/i.test(href) && !href.includes("..")) return href.slice(0, 300);
    if (/^#[a-z0-9_-]{1,80}$/i.test(href)) return href;
    return "";
  };
  // Images: https or the site's own assets / uploads.
  const safeSrc = value => {
    const src = decodeEntities(String(value ?? "")).replace(/[\u0000-\u001f\u007f\s]/g, "").trim();
    if (!src) return "";
    if (/^https:\/\/[^"'<>\\]+$/i.test(src)) return src.slice(0, 700);
    if (/^\/?(assets|trainer-backoffice|uploads)\/[a-z0-9_\-./%]+$/i.test(src) && !src.includes("..")) return (src.startsWith("/") ? src : `/${src}`).slice(0, 300);
    return "";
  };
  const plainAttr = max => value => decodeEntities(String(value ?? "")).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);

  // tag → { attrs: { name: checker }, void: bool, block: bool }
  const ALLOWED = {
    p: { block: true }, br: { void: true }, strong: {}, em: {}, u: {}, s: {},
    a: { attrs: { href: safeHref } },
    ul: { block: true }, ol: { block: true }, li: { block: true },
    h2: { block: true }, h3: { block: true }, h4: { block: true },
    blockquote: { block: true },
    img: { void: true, attrs: { src: safeSrc, alt: plainAttr(200) }, block: true }
  };
  // Tags whose whole content is dropped, not just the tag.
  const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript", "textarea", "select", "form", "head", "title", "video", "audio", "canvas"]);
  // Renamed on the way in.
  const ALIAS = { b: "strong", i: "em", strike: "s", del: "s", h1: "h2", h5: "h4", h6: "h4", div: "p", section: "p", article: "p", header: "p", footer: "p", main: "p", figure: "p", figcaption: "p", dd: "p", dt: "p", pre: "p", tr: "p", td: "p", th: "p", table: "p", tbody: "", thead: "", tfoot: "" };

  // Reads one tag starting at `i` (html[i] === "<"). Handles quoted attribute
  // values that contain ">". Returns null when this "<" is not a tag.
  function readTag(html, i) {
    const close = html[i + 1] === "/";
    let j = i + (close ? 2 : 1);
    const nameStart = j;
    while (j < html.length && /[a-zA-Z0-9:-]/.test(html[j])) j += 1;
    const name = html.slice(nameStart, j).toLowerCase();
    if (!name || !/^[a-z]/.test(name)) return null;
    const attrs = {};
    let selfClosing = false;
    while (j < html.length && html[j] !== ">") {
      const ch = html[j];
      if (/\s/.test(ch)) { j += 1; continue; }
      if (ch === "/") { selfClosing = true; j += 1; continue; }
      const attrStart = j;
      while (j < html.length && !/[\s=>\/]/.test(html[j])) j += 1;
      const attrName = html.slice(attrStart, j).toLowerCase();
      let value = "";
      while (j < html.length && /\s/.test(html[j])) j += 1;
      if (html[j] === "=") {
        j += 1;
        while (j < html.length && /\s/.test(html[j])) j += 1;
        const quote = html[j];
        if (quote === '"' || quote === "'") {
          const end = html.indexOf(quote, j + 1);
          value = end === -1 ? html.slice(j + 1) : html.slice(j + 1, end);
          j = end === -1 ? html.length : end + 1;
        } else {
          const valueStart = j;
          while (j < html.length && !/[\s>]/.test(html[j])) j += 1;
          value = html.slice(valueStart, j);
        }
      }
      if (attrName && !attrs[attrName]) attrs[attrName] = value;
      if (j === attrStart) j += 1; // never stall
    }
    return { name, attrs, close, selfClosing, end: Math.min(j + 1, html.length) };
  }

  // Tokenises a fragment: [{ type:"text", value }] and [{ type:"open"|"close", name, attrs }].
  function tokenize(html) {
    const src = String(html ?? "");
    const tokens = [];
    let i = 0;
    let text = "";
    const flush = () => { if (text) { tokens.push({ type: "text", value: decodeEntities(text) }); text = ""; } };
    while (i < src.length) {
      const ch = src[i];
      if (ch === "<") {
        if (src.startsWith("<!--", i)) { const end = src.indexOf("-->", i + 4); i = end === -1 ? src.length : end + 3; continue; }
        if (src.startsWith("<!", i) || src.startsWith("<?", i)) { const end = src.indexOf(">", i); i = end === -1 ? src.length : end + 1; continue; }
        const tag = readTag(src, i);
        if (!tag) { text += "<"; i += 1; continue; }
        flush();
        if (tag.close) tokens.push({ type: "close", name: tag.name });
        else { tokens.push({ type: "open", name: tag.name, attrs: tag.attrs }); if (tag.selfClosing && !ALLOWED[tag.name]?.void) tokens.push({ type: "close", name: tag.name }); }
        i = tag.end;
        continue;
      }
      text += ch; i += 1;
    }
    flush();
    return tokens;
  }

  // The sanitiser. Returns a fragment made only of allowed tags and escaped text.
  function sanitizeRichText(html, options = {}) {
    const maxLength = Number(options.maxLength || 20000);
    const tokens = tokenize(String(html ?? "").slice(0, maxLength * 4));
    const out = [];
    const stack = [];
    let dropDepth = 0; let dropName = "";
    let emitted = 0;
    for (const token of tokens) {
      if (dropDepth) {
        if (token.type === "open" && token.name === dropName) dropDepth += 1;
        else if (token.type === "close" && token.name === dropName) dropDepth -= 1;
        continue;
      }
      if (token.type === "text") {
        const value = token.value;
        if (!value) continue;
        emitted += value.length;
        if (emitted > maxLength) break;
        out.push(escapeHtml(value));
        continue;
      }
      let name = token.name;
      if (DROP_WITH_CONTENT.has(name)) { if (token.type === "open") { dropDepth = 1; dropName = name; } continue; }
      if (Object.prototype.hasOwnProperty.call(ALIAS, name)) name = ALIAS[name];
      const spec = ALLOWED[name];
      if (!spec) continue; // unknown tag: keep its text, drop the tag
      if (token.type === "open") {
        if (spec.void) {
          const attrs = attrString(spec, token.attrs);
          if (name === "img" && !/ src="/.test(attrs)) continue; // an image without a safe source is nothing
          out.push(`<${name}${attrs}>`);
          continue;
        }
        // li outside a list becomes a paragraph; a block inside an inline is closed first.
        if (name === "li" && !stack.some(s => s === "ul" || s === "ol")) name = "p";
        if (ALLOWED[name].block) { while (stack.length && !ALLOWED[stack[stack.length - 1]].block) out.push(`</${stack.pop()}>`); }
        if (name === "p" && stack.length && stack[stack.length - 1] === "p") out.push(`</${stack.pop()}>`);
        if (name === "a" && stack.includes("a")) continue; // no nested links
        out.push(`<${name}${attrString(ALLOWED[name], token.attrs)}>`);
        stack.push(name);
      } else {
        const at = stack.lastIndexOf(name);
        if (at === -1) continue;
        while (stack.length > at) out.push(`</${stack.pop()}>`);
      }
    }
    while (stack.length) out.push(`</${stack.pop()}>`);
    return out.join("")
      .replace(/<p>\s*<\/p>/g, "")
      .replace(/<(ul|ol)>\s*<\/\1>/g, "")
      .trim();
  }

  function attrString(spec, attrs) {
    if (!spec.attrs) return "";
    let out = "";
    for (const [key, check] of Object.entries(spec.attrs)) {
      const value = check(attrs[key]);
      if (value) out += ` ${key}="${escapeHtml(value)}"`;
    }
    if (spec.attrs.href && / href="https?:/i.test(out)) out += ' target="_blank" rel="noopener"';
    return out;
  }

  // Plain words only: every tag gone, entities decoded, whitespace collapsed.
  function textOnly(html, max = 100000) {
    const words = [];
    let drop = 0; let dropName = "";
    for (const token of tokenize(String(html ?? "").slice(0, max * 4))) {
      if (drop) { if (token.type === "open" && token.name === dropName) drop += 1; else if (token.type === "close" && token.name === dropName) drop -= 1; continue; }
      if (token.type === "open" && DROP_WITH_CONTENT.has(token.name)) { drop = 1; dropName = token.name; continue; }
      if (token.type === "text") words.push(token.value);
    }
    return words.join(" ").replace(/\s+/g, " ").trim().slice(0, max);
  }

  return { sanitizeRichText, textOnly, tokenize, decodeEntities, escapeHtml, safeHref, safeSrc, ALLOWED_TAGS: Object.keys(ALLOWED) };
});
