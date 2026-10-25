import shelfData from './shelf.json'

// The reader listens here. The health check and the interface both use it.
export const uiPort = 8080

// Every book the package offers, pinned by scripts/pin-shelf.py.
export type Book = (typeof shelfData.books)[number]
export const shelf: readonly Book[] = shelfData.books

export const groups = [
  'encyclopedia',
  'health',
  'home',
  'prepared',
  'learning',
  'reference',
] as const
export type Group = (typeof groups)[number]

export const noEncyclopedia = 'none'

export const defaultEncyclopedia =
  shelf.find((b) => b.group === 'encyclopedia' && b.default)?.id ??
  noEncyclopedia

export const defaultBooks = shelf
  .filter((b) => b.group !== 'encyclopedia' && b.default)
  .map((b) => b.id)

export const inGroup = (group: Group) => shelf.filter((b) => b.group === group)

export const gib = (bytes: number) =>
  bytes >= 1000 * 2 ** 20
    ? `${(bytes / 2 ** 30).toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 2 ** 20))} MB`

// A label for a checkbox or select option: title, what it is, and its size.
export const optionLabel = (b: Book) =>
  `${b.title} · ${b.note} · ${gib(b.bytes)}${b.videos ? ' · video' : ''}`

// The books a choice resolves to, in shelf order.
export function wantedBooks(choice: {
  encyclopedia: string
  books: readonly string[]
}): Book[] {
  const ids = new Set([choice.encyclopedia, ...choice.books])
  return shelf.filter((b) => ids.has(b.id))
}

// The download list entrypoint.sh reads: file, url, sha256, bytes, title.
// Smallest first, so the shelf fills quickly.
export const wantedTsv = (books: Book[]) =>
  [...books]
    .sort((a, b) => a.bytes - b.bytes)
    .map((b) => [b.file, b.url, b.sha256, b.bytes, b.title].join('\t') + '\n')
    .join('')

// The data the home page renders. `<` is escaped so the JSON can sit inside
// a <script> element without closing it.
export const homeJson = (books: Book[]) =>
  JSON.stringify(
    books.map((b) => ({
      stem: b.file.replace(/\.zim$/, ''),
      group: b.group,
      title: b.title,
      note: b.note,
      bytes: b.bytes,
      search: b.search,
      pictures: b.pictures,
      videos: b.videos,
    })),
  ).replace(/</g, '\\u003c')
