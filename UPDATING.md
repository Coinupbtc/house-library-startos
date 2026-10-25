# Updating the upstream version

Upstream is the kiwix-tools release tarball plus the books pinned in `startos/shelf.json`. The manifest does not pin a registry tag. The Dockerfile downloads the tarball, and `entrypoint.sh` downloads the books the owner chose.

## Determining the upstream version

- The tarball name and its SHA256 are `KIWIX_SHA_AMD64` and `KIWIX_SHA_ARM64` in the Dockerfile. The file name in that same `RUN` is the kiwix-tools release.
- Each book's file, URL, SHA256 and size are in `startos/shelf.json`.
- `python3 scripts/pin-shelf.py --check` lists the books that have a newer file in the Kiwix catalog.

## Applying the bump

1. For kiwix-tools: change the tarball name, both architecture checksums, and the `--version` checks in the Dockerfile together.
2. For books: run `python3 scripts/pin-shelf.py`. It rewrites the pins of every book from the catalog and the `.sha256` files on `download.kiwix.org`. Then run `npx prettier --write startos`.
3. Bump `startos/versions/current.ts`. A re-pinned book is a new file name, so installs that chose it download the new file and delete the old one once everything is ready.
4. Build both architectures. An unpinned `pending` checksum fails the image build on purpose.

## Adding or removing a book

Add an entry to `startos/shelf.json` with `id`, `group`, `name`, `flavour`, `title`, `note`, `default` and `videos`, then run the pin script. Set `videos` only for real video collections; the catalog's video tag is on most scraped sites. `name` and `flavour` are the Kiwix catalog's. Removing an entry drops the book from installs that had chosen it.
