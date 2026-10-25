<p align="center">
  <img src="icon.svg" alt="House Library Logo" width="21%">
</p>

# House Library on StartOS

> Everything not listed in this document should behave the same as upstream
> Kiwix Serve. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

House Library is Kiwix Serve plus a downloader and a home page. The owner picks books from a fixed shelf of about forty ZIM files from the Kiwix catalog. The service downloads the chosen books onto this server, checks each against a pinned SHA256, and serves them in a browser.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [The Shelf](#the-shelf)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

The image is built from the Dockerfile in this repository. It installs static `kiwix-serve` and `kiwix-manage` from the kiwix-tools release tarball pinned in the Dockerfile, plus `nginx` and `wget`. tini is PID 1 and runs `entrypoint.sh`.

| Property | Value |
| --- | --- |
| Image | built here (`library`) |
| Architectures | x86_64, aarch64 |
| Command | image entrypoint |

| Subcontainer | Purpose |
| --- | --- |
| `library-sub` | The `primary` daemon. Attach here. |

nginx listens on port 8080 and proxies to `kiwix-serve` on `127.0.0.1:8081`. Both start in the first second, with whatever books are already verified (none on a fresh install). `kiwix-serve` runs with `--library /data/house/library.xml --monitorLibrary --nodatealiases --customIndex /data/house/index.html --skipInvalid`.

nginx is there because `kiwix-serve` closes the connection after every response (`Connection: close`). Through the StartOS edge, about four in ten responses over a few hundred KB arrived cut short (`ERR_CONTENT_LENGTH_MISMATCH`, curl exit 18), which left video books such as Crash Course blank. The same files fetched straight from the container were always whole. nginx keeps the edge connection alive and streams without temp files (`conf/nginx.conf`). The edge still cuts about one in four such responses when the client itself sends `Connection: close` (measured 7 of 30 through the edge, 0 of 30 direct). Browsers and curl keep the connection open and are not affected; a script that reads the library over HTTP should do the same. If either server exits, the entrypoint exits and StartOS restarts the service.

`entrypoint.sh` then works through the chosen books, smallest first. A book that finishes and passes its checksum is added to `library.xml`, and Kiwix picks it up within a few seconds. The reader does not restart. A failed download is retried every ten minutes. A book that fails its checksum twice is left alone until the next start. When every chosen book is ready, books that are no longer chosen are deleted.

## Volume and Data Layout

One volume.

| Path on `library` (`/data`) | Written by | Purpose |
| --- | --- | --- |
| `choice.json` | Choose Books action | Which books the owner picked |
| `zim/<file>.zim` | entrypoint | A downloaded book |
| `zim/<file>.zim.sha256` | entrypoint | Checksum stamp. A book counts as ready only with a stamp that matches its pinned sum |
| `zim/<file>.zim.partial` | entrypoint | Interrupted download. `wget -c` resumes it |
| `house/wanted.tsv` | `main.ts` | The chosen books: file, URL, SHA256, bytes, title |
| `house/shelf.json` | `main.ts` | The same books as the home page shows them |
| `house/index.html` | entrypoint | The home page: `www/home.html` with `shelf.json` spliced in |
| `house/library.xml` | entrypoint | Kiwix library of every verified book on disk |
| `house/status` | entrypoint | `key=value` progress lines read by the Books health check |

## File Models

| File | Format | Shape |
| --- | --- | --- |
| `choice.json` on `library` | JSON | `{ encyclopedia: <book id or "none">, books: <book id>[] }` |

Both keys fall back to the shelf's defaults. `init` seeds the file on install and on an update from a release without it, so an install from before Choose Books keeps its books and gains the other defaults. An id that is not on the shelf is ignored.

## The Shelf

`startos/shelf.json` lists every book the package offers. Each entry has an `id` (Kiwix name plus flavour), a group, a title and note for the form and home page, a hand-set `videos` flag, and the pins: `file`, `url`, `sha256`, `bytes`, `search`, `pictures`. `scripts/pin-shelf.py` writes the pins from the public Kiwix OPDS catalog and the `.sha256` file next to each ZIM. See `UPDATING.md`.

Groups: Wikipedia (one edition: text only, top million with pictures, or complete with pictures), Health and medicine, Home repair and cooking, Emergencies and self-reliance, Learning and video, Reference and reading. The default shelf has 19 books, about 84 GB: English Wikipedia without pictures, WikEM, MDWiki, MedlinePlus, NHS Medicines, iFixit, three Stack Exchange sites, Appropedia, four preparedness libraries, Crash Course, Blender Open Movies, PhET, Wikivoyage and the CIA World Factbook.

`search: false` marks books Kiwix tags with several languages (the TED collections). Kiwix refuses a search that mixes languages, so the home page leaves them out of the all-books search. They are still readable.

## Dependencies

None.

## Network Access and Interfaces

One interface.

| Interface | Id | Type | Port | Description |
| --- | --- | --- | --- | --- |
| Library | `ui` | ui | 8080 | The reader |

The port is bound on the `ui` MultiHost and is not masked. The package does not choose who can open it.

The reader has no login of its own. Whoever can open the address can read the books.

The service reaches `download.kiwix.org` over HTTPS to fetch books. Reading needs no internet.

## Installation and First-Run Flow

Install and start the service. The Web Interface check passes as soon as Kiwix is listening. The home page lists every chosen book; books still downloading are greyed out and turn into links as they finish. The page checks every 20 seconds.

The home page's **Discover** row shows four cards, alternating video and picture. Video cards come from books with `videos` that publish `playlists.json` (the YouTube scraper's format: Crash Course, Blender Open Movies); each card links to the video's `index/<slug>` page. Picture cards come from Wikipedia and Wikivoyage editions with pictures: the page fetches `/random`, takes the first JPEG whose `data-file-width` is at least 500 px and is not a map, logo, icon or flag, and links to the article. A book that yields nothing three times sits out the rest of the visit, so other video books (TED, Post-Disaster) cost one 404 each. The row is hidden when no ready book qualifies.

Progress is in the Books health check and in log lines like `library: crashcourse_en_all_2026-05.zim bytes=... of ...`.

## Actions

| Action | Id | Allowed | What it does |
| --- | --- | --- | --- |
| Choose Books | `choose-books` | any status | A form with one Wikipedia select and five checkbox groups. Writes `choice.json`. If the service is running, `main.ts` re-runs, writes a new `wanted.tsv`, and the daemon restarts. The result lists what will download and what will be removed. |

Unticked books stay readable until every chosen book is ready, then they are deleted. If a download lacks disk space, unticked books are deleted first and the space check runs again.

## Tasks

None.

## Health Checks

| Check | Displayed | Method |
| --- | --- | --- |
| `primary` | "Web Interface" | Port 8080 is listening |
| `books` | "Books" | Reads `house/status` every 10 s |

`books` results: `success` when every chosen book is ready; `loading` while a book downloads or is checked, with the percentage; `loading` when a download will be retried; `failure` when there is not enough disk or a book failed its checksum twice; `disabled` when no books are chosen. It reports `starting` until the status file carries the current shelf's hash.

## Backups and Restore

The `library` volume is backed up without `zim/` and `house/`, so a backup holds only `choice.json`. After a restore, the next start downloads the chosen books again.

## Limitations and Differences

1. Books come only from the shelf in this package. There is no way to add an arbitrary ZIM file.
2. Books are pinned to one file each. Newer editions arrive with a package update, not on their own.
3. Backups do not contain the books.
4. Kiwix's own library page is replaced by the House Library home page. `/nojs` still lists every book plainly.
5. The home page, book titles and notes are in English.

---

## Quick Reference for AI Consumers

```yaml
package_id: house-library
image: built from the Dockerfile in this repo
architectures:
  - x86_64
  - aarch64
subcontainers:
  - library-sub
volumes:
  library: /data
file_models:
  - choice.json (library volume)
startos_managed_env_vars:
  - HOUSE_SHELF_REV
dependencies: none
interfaces:
  ui: { type: ui, port: 8080 }
actions:
  - choose-books
tasks: []
health_checks:
  - primary
  - books
```
