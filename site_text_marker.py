"""Website text spots (rule 61, Joshua 2026-09-11).

Adds a stable data-edit="<key>" to the plain-text headlines, paragraphs, labels and
button words of the main website pages, and writes site-text-manifest.json (page ->
spots with their code text). The office edits those spots in the Page Editor; the
public page swaps in their published text (script.js, textContent only). Everything
else stays owned by the code.

Rules:
- Only text-only elements (no child elements) outside header/footer/nav/forms/legal
  text are spots. The texting consent wording (rule 47) is never a spot.
- The tag is inserted into the existing start tag; nothing else in the file changes.
- An element that already carries data-edit keeps its key.
- A fresh build (no tags yet) gets its keys back from the manifest by matching spots in
  page order, so a spot keeps its key even after the code changes its words. The office
  text then stays live and the editor shows "the code changed this spot".
Run: python3 site_text_marker.py   (build.py runs it after writing pages)
"""
import difflib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

PAGES = [
    ("home", "index.html", "/", "Home"),
    ("dog-training", "dog-training.html", "/dog-training", "Dog Training"),
    ("basic-obedience", "basic-obedience.html", "/basic-obedience", "Basic Obedience"),
    ("behavior-help", "behavior-help.html", "/behavior-help", "Behavior Help"),
    ("about", "about.html", "/about", "About"),
    ("facility", "facility.html", "/facility", "Our Facility"),
    ("contact", "contact.html", "/contact", "Contact"),
    ("get-started", "get-started.html", "/get-started", "Get Started"),
]
MANIFEST = "site-text-manifest.json"
TARGET = {"h1", "h2", "h3", "h4", "p", "span", "a", "button", "li", "strong"}
SHORT_OK = {"h1", "h2", "h3", "h4", "p", "button"}
SKIP_TAGS = {"header", "footer", "nav", "form", "script", "style", "noscript", "label", "select", "small", "dialog", "svg", "template", "textarea"}
SKIP_CLASS = re.compile(r"(^|\s)(consent[\w-]*|topbar|nav-links|site-header|site-footer|sms[\w-]*|legal[\w-]*)(\s|$)")
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


def slug(text, limit=44):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (s[:limit].rstrip("-") or "text")


class Finder(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.line_starts = [0]
        for m in re.finditer("\n", source):
            self.line_starts.append(m.end())
        self.stack = []
        self.spots = []

    def abs_offset(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.stack:
            self.stack[-1]["child"] = True
        if tag in VOID:
            return
        start = self.abs_offset()
        raw = self.get_starttag_text() or ""
        self.stack.append({"tag": tag, "attrs": a, "text": [], "child": False, "start": start, "raw": raw})

    def handle_startendtag(self, tag, attrs):
        if self.stack:
            self.stack[-1]["child"] = True

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        idx = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                idx = i
                break
        if idx is None:
            return
        closed = self.stack[idx]
        del self.stack[idx:]
        if self.stack:
            self.stack[-1]["child"] = True
        self.consider(closed)

    def consider(self, el):
        tag = el["tag"]
        if tag not in TARGET or el["child"]:
            return
        text = re.sub(r"\s+", " ", "".join(el["text"])).strip()
        if len(text) < 2 or (tag not in SHORT_OK and len(text) < 3):
            return
        for anc in self.stack:
            if anc["tag"] in SKIP_TAGS or SKIP_CLASS.search(anc["attrs"].get("class") or "") or "data-no-edit" in anc["attrs"]:
                return
        if SKIP_CLASS.search(el["attrs"].get("class") or "") or "data-no-edit" in el["attrs"]:
            return
        if "{" in text or "}" in text:
            return
        self.spots.append({"tag": tag, "text": text, "start": el["start"], "raw": el["raw"], "key": el["attrs"].get("data-edit")})

    def handle_data(self, data):
        if self.stack:
            self.stack[-1]["text"].append(data)


def find_spots(source):
    f = Finder(source)
    f.feed(source)
    f.close()
    return sorted(f.spots, key=lambda s: s["start"])


def assign_keys(spots, previous):
    """Keys for spots without one: reuse the manifest's keys by page-order matching."""
    used = {s["key"] for s in spots if s["key"]}
    fresh = [s for s in spots if not s["key"]]
    prev = [p for p in (previous or []) if p["key"] not in used]
    a = [f'{p["tag"]}|{p["text"]}' for p in prev]
    b = [f'{s["tag"]}|{s["text"]}' for s in fresh]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal" or op == "replace":
            for k in range(min(i2 - i1, j2 - j1)):
                p, s = prev[i1 + k], fresh[j1 + k]
                if op == "equal" or p["tag"] == s["tag"]:
                    s["key"] = p["key"]
                    used.add(p["key"])
    for s in fresh:
        if s["key"]:
            continue
        base = f'{s["tag"]}-{slug(s["text"])}'
        key, n = base, 2
        while key in used:
            key, n = f"{base}-{n}", n + 1
        s["key"] = key
        used.add(key)
    return spots


def mark_source(source, previous=None):
    spots = assign_keys(find_spots(source), previous)
    out, last = [], 0
    for s in sorted(spots, key=lambda s: s["start"]):
        raw = s["raw"]
        if 'data-edit="' in raw:
            continue
        end = s["start"] + len(raw)
        cut = end - 2 if raw.endswith("/>") else end - 1
        out.append(source[last:cut])
        out.append(f' data-edit="{s["key"]}"')
        last = cut
    out.append(source[last:])
    return "".join(out), [{"key": s["key"], "tag": s["tag"], "text": s["text"]} for s in spots]


def mark_files(root="."):
    root = Path(root)
    mpath = root / MANIFEST
    old = json.loads(mpath.read_text()) if mpath.exists() else {"pages": {}}
    manifest = {"version": 1, "about": "Website text spots the office may edit (rule 61). Generated by site_text_marker.py.", "pages": {}}
    for page, file, path, label in PAGES:
        fp = root / file
        if not fp.exists():
            continue
        source = fp.read_text()
        marked, spots = mark_source(source, old.get("pages", {}).get(page, {}).get("spots"))
        if marked != source:
            fp.write_text(marked)
        keys = [s["key"] for s in spots]
        assert len(keys) == len(set(keys)), f"duplicate site text key on {file}"
        manifest["pages"][page] = {"file": file, "path": path, "label": label, "spots": spots}
    mpath.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    return manifest


if __name__ == "__main__":
    m = mark_files(Path(__file__).resolve().parent)
    print({p: len(v["spots"]) for p, v in m["pages"].items()})
