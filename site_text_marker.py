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
PHONE = re.compile(r"\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
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
        href = (el["attrs"].get("href") or "").lower()
        if href.startswith(("tel:", "mailto:")) or PHONE.search(text) or "@" in text:
            return  # phone numbers, emails and call/mail links stay code-owned
        def sig(node):
            classes = ".".join(sorted((node["attrs"].get("class") or "").split()))
            return f'{node["tag"]}.{classes}' if classes else node["tag"]
        ctx = ">".join(sig(a) for a in self.stack[-3:]) + ">" + sig(el)
        self.spots.append({"tag": tag, "text": text, "ctx": ctx, "start": el["start"], "raw": el["raw"], "key": el["attrs"].get("data-edit")})

    def handle_data(self, data):
        if self.stack:
            self.stack[-1]["text"].append(data)



def find_spots(source):
    f = Finder(source)
    f.feed(source)
    f.close()
    spots = sorted(f.spots, key=lambda s: s["start"])
    # Headings in page order (tagged or not), to anchor look-alike spots to their section.
    # A heading's own anchor is its parent heading (a higher level), so deleting or rewording a
    # sibling card never changes the anchor of the next card's heading.
    heads = sorted((m.start(), int(m.group(1)[1]), re.sub(r"<[^>]+>|\s+", " ", m.group(2)).strip()) for m in re.finditer(r"<(h[1-4])\b[^>]*>(.*?)</\1>", source, re.S | re.I))
    for sp in spots:
        level = int(sp["tag"][1]) if re.fullmatch(r"h[1-4]", sp["tag"]) else 9
        prior = [t for pos, lv, t in heads if pos < sp["start"] and t and lv < level]
        sp["anchor"] = prior[-1] if prior else ""
    # Look-alike spots (same tag, place and words) are told apart by their nearest heading;
    # spots that still cannot be told apart are not editable at all (code-owned).
    base = {}
    for sp in spots:
        base.setdefault((sp["tag"], sp["ctx"], sp["text"]), []).append(sp)
    keep = []
    for sp in spots:
        group = base[(sp["tag"], sp["ctx"], sp["text"])]
        if len(group) == 1:
            keep.append(sp)  # keeps its heading too: a class moving between cards cannot carry a key along
            continue
        twins = [g for g in group if g["anchor"] == sp["anchor"]]
        if len(twins) == 1:
            keep.append(sp)
    return keep


def assign_keys(spots, previous, report=None, retired=None):
    """Give every spot a key, reusing the manifest's keys only when it is certain.

    A key is reused only for an EXACT match: same tag, same place on the page (classes
    of the element and its 3 nearest ancestors) and the same words. Matches are made in
    page order; a spot that only moved keeps its key when its signature is unique on both
    sides. Identical spots (e.g. two "Book Evaluation" buttons in the same kind of place)
    are paired only when their count did not change. Everything else gets a NEW key, and
    retired keys are never handed out again, so office text can never land on a different
    spot. (The public page also hides office text whose code words changed: api/site-text.js.)
    """
    prev = list(previous or [])
    legacy = any("ctx" not in p for p in prev)  # manifest from before ctx existed: match on tag+words
    def sig(x):
        return f'{x["tag"]}|{x["text"]}' if legacy else f'{x["tag"]}|{x.get("ctx", "")}|{x.get("anchor", "")}|{x["text"]}'
    a = [sig(p) for p in prev]
    b = [sig(s_) for s_ in spots]
    count_a, count_b = {}, {}
    for x in a: count_a[x] = count_a.get(x, 0) + 1
    for x in b: count_b[x] = count_b.get(x, 0) + 1
    used = set()
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op != "equal":
            continue
        for k in range(i2 - i1):
            p, s_ = prev[i1 + k], spots[j1 + k]
            if count_a[a[i1 + k]] == count_b[b[j1 + k]] and p["key"] not in used:
                s_["key"] = p["key"]
                used.add(p["key"])
    # a spot that only moved: exact, unique on both sides
    free_prev = {sig(p): p for p in prev if p["key"] not in used and count_a[sig(p)] == 1}
    for s_ in spots:
        if s_.get("key"):
            continue
        p = free_prev.get(sig(s_))
        if p and count_b[sig(s_)] == 1 and p["key"] not in used:
            s_["key"] = p["key"]
            used.add(p["key"])
            if report is not None:
                report.append(f'moved     {p["key"]}: "{s_["text"][:40]}"')
    blocked = used | {p["key"] for p in prev} | set(retired or [])
    for s_ in spots:
        if s_.get("key"):
            continue
        base = f'{s_["tag"]}-{slug(s_["text"])}'
        key, n = base, 2
        while key in blocked:
            key, n = f"{base}-{n}", n + 1
        s_["key"] = key
        blocked.add(key)
        if report is not None and prev:
            report.append(f'new spot  {key}: "{s_["text"][:40]}"')
    gone = [p["key"] for p in prev if p["key"] not in used]
    if report is not None:
        for p in prev:
            if p["key"] not in used:
                report.append(f'removed   {p["key"]}: "{p["text"][:40]}" (office text for it is kept, flagged, never reused)')
    return spots, gone


def mark_source(source, previous=None, report=None, retired=None):
    # Start from the page without tags, so a spot that stopped qualifying loses its tag.
    source = re.sub(r' data-edit="[^"]*"', "", source)
    spots = [dict(s, key=None) for s in find_spots(source)]
    spots, gone = assign_keys(spots, previous, report, retired)
    out, last = [], 0
    for s in sorted(spots, key=lambda s: s["start"]):
        raw = s["raw"]
        end = s["start"] + len(raw)
        cut = end - 2 if raw.endswith("/>") else end - 1
        out.append(source[last:cut])
        out.append(f' data-edit="{s["key"]}"')
        last = cut
    out.append(source[last:])
    if retired is not None:
        retired.extend(k for k in gone if k not in retired)
    return "".join(out), [{"key": s["key"], "tag": s["tag"], "ctx": s["ctx"], "anchor": s.get("anchor", ""), "text": s["text"]} for s in spots]


def mark_files(root="."):
    root = Path(root)
    mpath = root / MANIFEST
    old = json.loads(mpath.read_text()) if mpath.exists() else {"pages": {}}
    manifest = {"version": 1, "about": "Website text spots the office may edit (rule 61). Generated by site_text_marker.py.", "pages": {}}
    for page, file, path, label in PAGES:
        fp = root / file
        if not fp.exists():
            if page in old.get("pages", {}):
                manifest["pages"][page] = old["pages"][page]  # keep its spots and retired keys
            continue
        source = fp.read_text()
        report = []
        retired = list(old.get("pages", {}).get(page, {}).get("retired", []))
        marked, spots = mark_source(source, old.get("pages", {}).get(page, {}).get("spots"), report, retired)
        for line in report:
            print(f"site text [{page}] {line}")
        if marked != source:
            fp.write_text(marked)
        keys = [s["key"] for s in spots]
        assert len(keys) == len(set(keys)), f"duplicate site text key on {file}"
        manifest["pages"][page] = {"file": file, "path": path, "label": label, "spots": spots, "retired": retired}
    mpath.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    return manifest


if __name__ == "__main__":
    m = mark_files(Path(__file__).resolve().parent)
    print({p: len(v["spots"]) for p, v in m["pages"].items()})
