// Vercel Edge Middleware — lets a PUBLISHED Site Builder page win over a static
// file at the same clean path (/about, /contact, /services …), and nothing else.
//
// Why middleware: vercel.json rewrites run AFTER the filesystem, so a rewrite
// can never beat about.html. This runs before it. It asks
// /api/pages-manifest (edge-cached 60 s) which clean paths are published and
// rewrites only those to /api/ad-page?slug=<path>&via=site. Everything else —
// trainer pages, market pages, the ten recruiting pages, assets, the portal —
// passes through untouched.
//
// Fallback order (durability, 2026-09-05):
//   1. the manifest says the page is published  → the page route (database)
//   2. the manifest is down or slow (> 900 ms)   → site/pages/index.json, the
//      exported copy that ships with every deploy; if the slug is there, the
//      request is rewritten to /site/pages/<slug> (the same bytes the route
//      served at export time)
//   3. neither knows the slug, or anything throws → the request continues to
//      the static site exactly as before (fail OPEN)
//
// Also: /sitemap.xml → /api/sitemap (static sitemap + published pages; the
// static file is the fallback inside that route too).

export const config = {
  // One path segment, no dot (no files), not the API / portal / assets / ads / p / site.
  matcher: ["/((?!api/|trainer-backoffice/|assets/|lib/|ads/|p/|site/|_vercel|favicon\\.ico)[^/.]+)", "/sitemap.xml"]
};

const RESERVED = new Set(["", "index", "staff", "onboarding", "trainer-application", "trainer-profile", "terms", "privacy-policy", "find-a-trainer", "become-a-trainer", "specialty-advanced", "robots.txt", "sitemap.xml"]);
const next = () => new Response(null, { headers: { "x-middleware-next": "1" } });
const rewrite = url => new Response(null, { headers: { "x-middleware-rewrite": url.toString() } });

async function fetchWithin(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, headers: { "x-ldtt-middleware": "1" } });
  } finally {
    clearTimeout(timer);
  }
}

// Step 2: the exported copy bundled with the deploy (durability).
async function exportedFallback(url, slug) {
  try {
    const response = await fetchWithin(new URL("/site/pages/index.json", url), 500);
    if (!response.ok) return next();
    const index = await response.json();
    const hit = (Array.isArray(index?.pages) ? index.pages : []).find(p => p.slug === slug && p.page_type !== "ad");
    return hit ? rewrite(new URL(`/site/pages/${slug}`, url)) : next();
  } catch {
    return next();
  }
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const slug = url.pathname.replace(/^\/+|\/+$/g, "");
  if (slug === "sitemap.xml") return rewrite(new URL("/api/sitemap", url));
  if (RESERVED.has(slug) || !/^[a-z0-9-]{2,80}$/.test(slug)) return next();
  if (url.searchParams.get("ldtt_static") === "1") return next(); // the importer / office can always see the file
  try {
    const response = await fetchWithin(new URL("/api/pages-manifest", url), 900);
    if (!response.ok) return exportedFallback(url, slug);
    const data = await response.json();
    if (data?.ok === false) return exportedFallback(url, slug);
    const paths = Array.isArray(data?.paths) ? data.paths : [];
    if (!paths.includes(slug)) return next();
    const target = new URL("/api/ad-page", url);
    target.searchParams.set("slug", slug);
    target.searchParams.set("via", "site");
    return rewrite(target);
  } catch {
    return exportedFallback(url, slug);
  }
}
