#!/usr/bin/env python3
"""Check the JSON files in data/ before you push.

Usage (from the site folder):  python3 scripts/validate.py

Errors (exit code 1): invalid JSON, missing required fields, bad dates.
Warnings: local files that don't exist yet, PLACEHOLDER text still present.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
KNOWN_SECTIONS = {"about", "news", "publications", "tutorials", "talks", "responsibilities", "teaching"}
DATE_RE = re.compile(r"^\d{4}(-(0[1-9]|1[0-2])(-\d{2})?)?$")

errors, warnings = [], []


def err(file, msg):
    errors.append(f"{file}: {msg}")


def warn(file, msg):
    warnings.append(f"{file}: {msg}")


def load(name):
    path = DATA / f"{name}.json"
    if not path.exists():
        err(f"data/{name}.json", "file not found")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        err(f"data/{name}.json", f"invalid JSON at line {e.lineno}, column {e.colno}: {e.msg}")
        return None


def check_url(file, where, url):
    if not isinstance(url, str) or not url.strip():
        err(file, f"{where}: url is empty")
        return
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.\-]*:", url):
        if not re.match(r"^(https?:|mailto:|tel:)", url, re.I):
            err(file, f"{where}: unsupported URL scheme in '{url}'")
    elif not (ROOT / url.split("#")[0].split("?")[0]).exists():
        warn(file, f"{where}: local file '{url}' does not exist yet")


def check_links(file, where, links):
    if links is None:
        return
    if not isinstance(links, list):
        err(file, f"{where}: 'links' must be a list")
        return
    for j, link in enumerate(links):
        w = f"{where}.links[{j}]"
        if not isinstance(link, dict) or not link.get("label"):
            err(file, f"{w}: needs a 'label'")
            continue
        check_url(file, w, link.get("url"))


def check_date(file, where, item, required):
    d = item.get("date")
    if d is None:
        if required:
            err(file, f"{where}: missing 'date' (use YYYY, YYYY-MM or YYYY-MM-DD)")
        return
    if not isinstance(d, str) or not DATE_RE.match(d):
        err(file, f"{where}: bad date {d!r} (use YYYY, YYYY-MM or YYYY-MM-DD)")


def items_of(file, data):
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        err(file, "needs an 'items' list")
        return []
    return items


def check_news(data):
    f = "data/news.json"
    for i, it in enumerate(items_of(f, data)):
        w = f"items[{i}]"
        if not isinstance(it, dict):
            err(f, f"{w}: must be an object")
            continue
        check_date(f, w, it, required=not it.get("date_label"))
        if not it.get("text"):
            err(f, f"{w}: missing 'text'")


def check_papers(name, data, venue_required):
    f = f"data/{name}.json"
    for i, it in enumerate(items_of(f, data)):
        w = f"items[{i}]"
        if not isinstance(it, dict):
            err(f, f"{w}: must be an object")
            continue
        if not it.get("title"):
            err(f, f"{w}: missing 'title'")
        if not isinstance(it.get("authors"), list) or not it.get("authors"):
            err(f, f"{w}: 'authors' must be a non-empty list of names")
        published = it.get("status", "published") == "published"
        check_date(f, w, it, required=published)
        if published and venue_required and not it.get("venue_short"):
            warn(f, f"{w}: published item without 'venue_short'")
        if it.get("venue_url"):
            check_url(f, f"{w}.venue_url", it["venue_url"])
        check_links(f, w, it.get("links"))


def check_talks(data):
    f = "data/talks.json"
    for i, it in enumerate(items_of(f, data)):
        w = f"items[{i}]"
        if not isinstance(it, dict):
            err(f, f"{w}: must be an object")
            continue
        if not it.get("title"):
            err(f, f"{w}: missing 'title'")
        check_date(f, w, it, required=not it.get("date_label"))
        if it.get("event_url"):
            check_url(f, f"{w}.event_url", it["event_url"])
        check_links(f, w, it.get("links"))


def check_list(name, data):
    f = f"data/{name}.json"
    for i, it in enumerate(items_of(f, data)):
        text = it if isinstance(it, str) else (it.get("text") if isinstance(it, dict) else None)
        if not text:
            err(f, f"items[{i}]: must be a string or an object with 'text'")


def check_about(data):
    f = "data/about.json"
    paras = data.get("paragraphs") if isinstance(data, dict) else None
    if not isinstance(paras, list) or not all(isinstance(p, str) for p in paras):
        err(f, "needs 'paragraphs': a list of strings")


def check_profile(data):
    f = "data/profile.json"
    name = data.get("name") if isinstance(data, dict) else None
    if not isinstance(name, dict) or not name.get("first"):
        err(f, "needs name.first (and name.last)")
    if data.get("photo"):
        check_url(f, "photo", data["photo"])
    check_links(f, "profile", data.get("links"))


def main():
    site = load("site")
    profile = load("profile")
    if profile is not None:
        check_profile(profile)

    sections = []
    if site is not None:
        sections = site.get("sections")
        if not isinstance(sections, list) or not sections:
            err("data/site.json", "needs a non-empty 'sections' list")
            sections = []
        for s in sections:
            if s not in KNOWN_SECTIONS:
                err("data/site.json", f"unknown section '{s}' (known: {', '.join(sorted(KNOWN_SECTIONS))})")

    checkers = {
        "about": check_about,
        "news": check_news,
        "publications": lambda d: check_papers("publications", d, True),
        "tutorials": lambda d: check_papers("tutorials", d, False),
        "talks": check_talks,
        "responsibilities": lambda d: check_list("responsibilities", d),
        "teaching": lambda d: check_list("teaching", d),
    }
    for s in sections:
        if s in checkers:
            data = load(s)
            if data is not None:
                checkers[s](data)

    # Files in data/ that the site never loads
    for p in sorted(DATA.glob("*.json")):
        if p.stem not in sections and p.stem not in ("site", "profile"):
            warn(f"data/{p.name}", "not listed in site.json 'sections', so it is not shown on the site")

    placeholders = sum(
        (DATA / f"{n}.json").read_text(encoding="utf-8").count("PLACEHOLDER")
        for n in KNOWN_SECTIONS if (DATA / f"{n}.json").exists()
    )
    if placeholders:
        warn("data/", f"{placeholders} entries still say PLACEHOLDER")

    for w in warnings:
        print(f"warning: {w}")
    for e in errors:
        print(f"ERROR:   {e}")
    if errors:
        print(f"\n{len(errors)} error(s) - fix these before pushing.")
        return 1
    print(f"\nOK - all data files are valid ({len(warnings)} warning(s)).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
