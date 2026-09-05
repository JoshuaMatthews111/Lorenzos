// Vercel Edge Middleware — lets a PUBLISHED Site Builder page win over a static
// file at the same clean path (/about, /contact, /services …), and nothing else.
//
// Why middleware: vercel.json rewrites run AFTER the filesystem, so a rewrite
// can never beat about.html. This runs before it. It asks
// /api/pages-manifest (edge-cached 60 s) which clean paths are published and
// rewrites only those to /api/ad-page?slug=<path>&via=site. Everything else —
// trainer pages, market pages, the ten recruiting pages, assets, the portal —
// passes through untouched. Any error or slow answer (> 900 ms) fails OPEN:
// the request continues to the static site exactly as before.
//
// Also: /sitemap.xml → /api/sitemap (static sitemap + published pages; the
// static file is the fallback inside that route too).

export const config = {
  // One path segment, no dot (no files), not the API / portal / assets / ads / p.
  matcher: ["/((?!api/|trainer-backoffice/|assets/|lib/|ads/|p/|_vercel|favicon\\.ico)[^/.]+)", "/sitemap.xml"]
};

const RESERVED = new Set(["", "index", "staff", "onboarding", "trainer-application", "trainer-profile", "terms", "privacy-policy", "find-a-trainer", "become-a-trainer", "specialty-advanced", "robots.txt", "sitemap.xml"]);
const next = () => new Response(null, { headers: { "x-middleware-next": "1" } });
const rewrite = url => new Response(null, { headers: { "x-middleware-rewrite": url.toString() } });

export default async function middleware(request) {
  const url = new URL(request.url);
  const slug = url.pathname.replace(/^\/+|\/+$/g, "");
  if (slug === "sitemap.xml") return rewrite(new URL("/api/sitemap", url));
  if (RESERVED.has(slug) || !/^[a-z0-9-]{2,80}$/.test(slug)) return next();
  if (url.searchParams.get("ldtt_static") === "1") return next(); // the importer / office can always see the file
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 900);
    const response = await fetch(new URL("/api/pages-manifest", url), { signal: controller.signal, headers: { "x-ldtt-middleware": "1" } });
    clearTimeout(timer);
    if (!response.ok) return next();
    const data = await response.json();
    const paths = Array.isArray(data?.paths) ? data.paths : [];
    if (!paths.includes(slug)) return next();
    const target = new URL("/api/ad-page", url);
    target.searchParams.set("slug", slug);
    target.searchParams.set("via", "site");
    return rewrite(target);
  } catch {
    return next();
  }
}
