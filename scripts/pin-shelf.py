#!/usr/bin/env python3
"""Pin every book in startos/shelf.json to the newest file in the Kiwix catalog.

For each entry it looks up `name` + `flavour` in the public OPDS catalog and
writes back the exact file, download URL, size in bytes, SHA256 (from the
`.sha256` published next to the ZIM), and whether the book can join the
all-books search (Kiwix only searches books of one language together).
`videos` is set by hand: the catalog tags most scraped sites as having video.

    python3 scripts/pin-shelf.py           # rewrite startos/shelf.json
    python3 scripts/pin-shelf.py --check   # list books with a newer file, change nothing
"""
import json
import pathlib
import sys
import urllib.request
import xml.etree.ElementTree as ET

CATALOG = "https://opds.library.kiwix.org/catalog/v2/entries?lang=eng&count=-1"
MIRROR = "https://download.kiwix.org/zim/"
ATOM = {"a": "http://www.w3.org/2005/Atom"}
SHELF = pathlib.Path(__file__).resolve().parent.parent / "startos" / "shelf.json"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "house-library-pin/1"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def catalog() -> dict:
    root = ET.fromstring(fetch(CATALOG))
    out = {}
    for e in root.findall("a:entry", ATOM):
        def text(tag: str) -> str:
            node = e.find(tag, ATOM)
            return (node.text or "") if node is not None else ""

        link = next(
            (l for l in e.findall("a:link", ATOM) if l.get("type") == "application/x-zim"),
            None,
        )
        if link is None:
            continue
        out[(text("a:name"), text("a:flavour"))] = {
            "href": link.get("href", ""),
            "bytes": int(link.get("length") or 0),
            "language": text("a:language"),
            "tags": text("a:tags").split(";"),
        }
    return out


def main() -> int:
    check = "--check" in sys.argv[1:]
    shelf = json.loads(SHELF.read_text())
    cat = catalog()
    newer = 0
    for book in shelf["books"]:
        hit = cat.get((book["name"], book.get("flavour", "")))
        if hit is None:
            print(f"missing from catalog: {book['id']}", file=sys.stderr)
            return 1
        rel = hit["href"].split("/zim/", 1)[1].removesuffix(".meta4")
        file = rel.rsplit("/", 1)[1]
        if check:
            if file != book.get("file"):
                newer += 1
                print(f"{book['id']}: {book.get('file')} -> {file}")
            continue
        url = MIRROR + rel
        sha = fetch(url + ".sha256").decode().split()[0]
        if len(sha) != 64:
            print(f"bad checksum file for {file}", file=sys.stderr)
            return 1
        book.update(
            file=file,
            url=url,
            sha256=sha,
            bytes=hit["bytes"],
            search=hit["language"] == "eng",
            pictures="_pictures:yes" in hit["tags"],
        )
        print(f"pinned {file} {hit['bytes'] / 2**30:.2f} GiB")
    if check:
        print(f"{newer} book(s) have a newer file")
        return 0
    SHELF.write_text(json.dumps(shelf, indent=2, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
