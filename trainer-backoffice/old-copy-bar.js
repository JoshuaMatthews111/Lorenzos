// Old-copy bar (release 2026-09-05).
//
// Office fear: "some saved it as a bookmark" and landed on an old copy. Every
// Vercel preview gets its own *.vercel.app address and never goes away, so a
// bookmarked preview keeps opening long after it is stale. This file runs on
// its own (before the portal boots, on the login page too) and asks
// /api/environment which address this deployment should be reached at:
//   practice copy  -> practice.lorenzosdogtrainingteam.com (LDTT_PRACTICE_HOST)
//   live           -> lorenzosdogtrainingteam.com / www.
// When the address bar shows anything else, a red bar that cannot be closed
// says so and links to the right address. localhost and file: are ignored.
function ldttOldCopyDecide(hostname, info) {
  var host = String(hostname || "").toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || /\.local$/.test(host)) return null;
  var canonical = Array.isArray(info && info.canonicalHosts) && info.canonicalHosts.length
    ? info.canonicalHosts.map(function (h) { return String(h).toLowerCase(); })
    : [String((info && info.canonicalHost) || "").toLowerCase()].filter(Boolean);
  if (!canonical.length) return null;
  if (canonical.indexOf(host) !== -1) return null;
  if (info && info.sandbox) {
    return { kind: "practice", host: canonical[0], text: "This is an old copy of the practice portal. Bookmark " + canonical[0] + " instead." };
  }
  if (/\.vercel\.app$/.test(host)) {
    return { kind: "live", host: canonical[0], text: "This is an old copy of the staff portal. Bookmark " + canonical[0] + " instead." };
  }
  return null;
}

(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var decide = ldttOldCopyDecide;

  function show(verdict) {
    if (!verdict || document.getElementById("oldCopyBar")) return;
    var style = document.createElement("style");
    style.id = "oldCopyBarStyle";
    style.textContent = "#oldCopyBar{position:sticky;top:0;z-index:100000;background:#c8102e;color:#fff;font:700 14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:10px 16px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.25)}#oldCopyBar a{color:#fff;text-decoration:underline;font-weight:900;margin-left:6px;white-space:nowrap}";
    var bar = document.createElement("div");
    bar.id = "oldCopyBar";
    bar.className = "old-copy-bar old-copy-bar-" + verdict.kind;
    bar.setAttribute("role", "alert");
    var path = window.location.pathname + window.location.search;
    var link = document.createElement("a");
    link.href = "https://" + verdict.host + path;
    link.textContent = "Open " + verdict.host;
    var span = document.createElement("span");
    span.textContent = verdict.text;
    bar.appendChild(span);
    bar.appendChild(link);
    document.head.appendChild(style);
    var mount = function () {
      if (document.body) document.body.prepend(bar); else document.addEventListener("DOMContentLoaded", function () { document.body.prepend(bar); });
    };
    mount();
    window.LDTT_OLD_COPY = verdict;
    // The portal redraws the body's children but never removes the first
    // node; belt and braces: put it back if anything ever does.
    if (window.MutationObserver && document.body) {
      new MutationObserver(function () { if (!document.getElementById("oldCopyBar") && document.body) document.body.prepend(bar); }).observe(document.body, { childList: true });
  }
  }

  window.LDTT_OLD_COPY_DECIDE = decide;
  if (window.LDTT_OLD_COPY_BAR_DISABLED) return;
  fetch("/api/environment", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (info) { show(decide(window.location.hostname, info)); })
    .catch(function () { /* not served from a deployment (local file): nothing to say */ });
})();
if (typeof module !== "undefined" && module.exports) module.exports = { decide: ldttOldCopyDecide };
