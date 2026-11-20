#!/usr/bin/env python3
"""Download the product photos for the Things page.

For every item in data/things.json that has both "image" (where the file should
live, inside images/things/) and "image_source" (a URL to download it from), this
saves the picture if the file is not there yet.

Usage (from the site folder):
    python3 scripts/fetch_things_images.py            # only download missing images
    python3 scripts/fetch_things_images.py --force    # re-download everything

Uses the system `curl`. On a Mac it also shrinks big pictures with `sips`.
Product photos are normally the manufacturer's copyright: prefer your own photos
or official press images, and check the terms before publishing.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = (ROOT / "images" / "things").resolve()
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
MAX_SIDE = "1000"  # longest side in pixels after shrinking (macOS only)


def looks_like_image(path):
    head = path.read_bytes()[:12]
    return (head.startswith(b"\x89PNG") or head.startswith(b"\xff\xd8\xff")
            or head.startswith(b"GIF8") or (head[:4] == b"RIFF" and head[8:12] == b"WEBP"))


def main():
    force = "--force" in sys.argv
    items = json.loads((ROOT / "data" / "things.json").read_text(encoding="utf-8")).get("items", [])
    todo = [i for i in items if i.get("image") and i.get("image_source")]
    if not todo:
        print("No items with both 'image' and 'image_source'.")
        return 0

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    ok = failed = skipped = 0
    for it in todo:
        target = (ROOT / it["image"]).resolve()
        if IMG_DIR not in target.parents:
            print(f"SKIP  {it['name']}: image path must be inside images/things/ ({it['image']})")
            failed += 1
            continue
        if target.exists() and not force:
            skipped += 1
            continue
        src = it["image_source"]
        if not src.startswith(("https://", "http://")):
            print(f"SKIP  {it['name']}: image_source must be an http(s) URL")
            failed += 1
            continue
        tmp = target.with_suffix(target.suffix + ".part")
        r = subprocess.run(["curl", "-fsSL", "--max-time", "60", "-A", UA, "-o", str(tmp), src],
                           capture_output=True, text=True)
        if r.returncode != 0 or not tmp.exists() or not looks_like_image(tmp):
            tmp.unlink(missing_ok=True)
            print(f"FAIL  {it['name']}: could not download an image from {src}\n      {r.stderr.strip()[:150]}")
            failed += 1
            continue
        tmp.replace(target)
        if shutil.which("sips"):
            subprocess.run(["sips", "-Z", MAX_SIDE, str(target)], capture_output=True)
        print(f"OK    {it['name']} -> {it['image']}")
        ok += 1

    print(f"\n{ok} downloaded, {skipped} already there, {failed} failed.")
    if failed:
        print("For failures, save the picture yourself to the path shown in 'image', or fix 'image_source'.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
