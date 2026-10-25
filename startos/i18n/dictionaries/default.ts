export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Starting House Library!': 0,
  'Web Interface': 1,
  'The web interface is ready': 2,
  'The web interface is not ready': 3,
  Books: 4,
  'Checking the books': 5,
  'No books are chosen. Run Choose Books to pick some': 6,
  'All ${total} books are ready': 7,
  'Not enough free disk for ${title}. Free some space or untick books. It is tried again every few minutes': 8,
  '${titles} failed its checksum twice. Restart the service to try again': 9,
  '${ready} of ${total} ready. Checking ${title}': 10,
  '${ready} of ${total} ready. Downloading ${title}: ${pct}% of ${size}': 11,
  '${ready} of ${total} ready. ${titles} did not finish and will be tried again in a few minutes': 12,
  '${ready} of ${total} ready': 13,
  // interfaces.ts
  Library: 14,
  'Read the books on this server in a browser': 15,
  // actions/chooseBooks.ts
  'Choose Books': 16,
  'Pick which books this server keeps. New books download in the background and appear in the library as each one finishes.': 17,
  'Books you untick are deleted from this server once the other downloads finish. Ticking one again downloads it again.': 18,
  Wikipedia: 19,
  'One edition at a time. When you switch, the old edition stays readable until the new one has downloaded.': 20,
  'No Wikipedia': 21,
  'Health and medicine': 22,
  'Home, repair and cooking': 23,
  'Emergencies and self-reliance': 24,
  'Learning and video': 25,
  'Reference and reading': 26,
  'Shelf updated': 27,
  '${count} books on the shelf, ${size} in all.': 28,
  '${count} to download (${size}): ${titles}.': 29,
  'Nothing new to download.': 30,
  'Removed once the downloads finish: ${titles} (${size}).': 31,
  'The Books status on the service page shows download progress. If the service is stopped, the change applies when it starts.': 32,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
