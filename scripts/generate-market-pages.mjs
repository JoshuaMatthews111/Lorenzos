import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

// The page itself lives in lib/ad-page-template.js and the market records in
// lib/ad-page-markets.js, shared with api/ad-page.js (Page Studio pages served
// from the database) and the Page Studio canvas. This script only decides
// which markets become static files and reads image sizes for them.
const require = createRequire(import.meta.url);
const { markets, marketToContent, renderAdPage } = require("../lib/ad-page-template.js");

/* Frames used to be hard-coded to 4:3 while the actual files are 16:9 or square,
   so object-fit:cover quietly guillotined every photo — most visibly the square
   retrieval shot, which lost the dog's head. Read the real pixel dimensions at
   build time and let each frame take the shape of its own image. */
function imageAspect(relPath) {
  try {
    const buf = readFileSync(resolve(process.cwd(), relPath));
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return `${buf.readUInt32BE(16)}/${buf.readUInt32BE(20)}`;      // PNG
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {                         // JPEG
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xc3) {
          return `${buf.readUInt16BE(i + 7)}/${buf.readUInt16BE(i + 5)}`;
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* fall through to the default below */ }
  return null;
}

export const page = market => renderAdPage(marketToContent(market), { imageAspect, publicPath: `/${market.slug}` });

for (const market of markets) {
  writeFileSync(resolve(`${market.slug}.html`), page(market));
  console.log(`generated ${market.slug}.html`);
}
