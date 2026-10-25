import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { choiceJson } from './fileModels/choice.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  defaultBooks,
  defaultEncyclopedia,
  gib,
  homeJson,
  uiPort,
  wantedBooks,
  wantedTsv,
} from './utils'

// entrypoint.sh writes one key=value per line to house/status as it works.
async function readStatus(): Promise<Record<string, string> | null> {
  const text = await sdk.volumes.library
    .readFile('house/status', 'utf8')
    .catch(() => null)
  if (text === null) return null
  return Object.fromEntries(
    String(text)
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  )
}

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting House Library!'))

  // Re-runs when Choose Books writes a new choice, which restarts the daemon
  // below because its environment carries a hash of the list.
  const choice = (await choiceJson.read().const(effects)) ?? {
    encyclopedia: defaultEncyclopedia,
    books: defaultBooks,
  }
  const books = wantedBooks(choice)
  const tsv = wantedTsv(books)
  await mkdir(sdk.volumes.library.subpath('house'), { recursive: true })
  await sdk.volumes.library.writeFile('house/wanted.tsv', tsv)
  await sdk.volumes.library.writeFile('house/shelf.json', homeJson(books))
  const rev = createHash('sha256').update(tsv).digest('hex').slice(0, 16)

  return sdk.Daemons.of(effects)
    .addDaemon('primary', {
      subcontainer: sdk.SubContainer.of(
        effects,
        { imageId: 'library' },
        sdk.Mounts.of().mountVolume({
          volumeId: 'library',
          subpath: null,
          mountpoint: '/data',
          readonly: false,
        }),
        'library-sub',
      ),
      exec: {
        command: sdk.useEntrypoint(),
        // tini is the image entrypoint and has to be PID 1.
        runAsInit: true,
        env: { HOUSE_SHELF_REV: rev },
      },
      ready: {
        display: i18n('Web Interface'),
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, uiPort, {
            successMessage: i18n('The web interface is ready'),
            errorMessage: i18n('The web interface is not ready'),
          }),
      },
      requires: [],
    })
    .addHealthCheck('books', {
      ready: {
        display: i18n('Books'),
        trigger: sdk.trigger.cooldownTrigger(10_000),
        fn: async () => {
          const s = await readStatus()
          if (s === null || s.rev !== rev) {
            return { result: 'starting', message: i18n('Checking the books') }
          }
          const params = { ready: Number(s.ready), total: Number(s.total) }
          if (params.total === 0) {
            return {
              result: 'disabled',
              message: i18n(
                'No books are chosen. Run Choose Books to pick some',
              ),
            }
          }
          if (s.ready === s.total) {
            return {
              result: 'success',
              message: i18n('All ${total} books are ready', params),
            }
          }
          if (s.nospace) {
            return {
              result: 'failure',
              message: i18n(
                'Not enough free disk for ${title}. Free some space or untick books. It is tried again every few minutes',
                { title: s.nospace },
              ),
            }
          }
          if (s.badsum && !s.current) {
            return {
              result: 'failure',
              message: i18n(
                '${titles} failed its checksum twice. Restart the service to try again',
                { titles: s.badsum },
              ),
            }
          }
          if (s.current && s.stage === 'checking') {
            return {
              result: 'loading',
              message: i18n('${ready} of ${total} ready. Checking ${title}', {
                ...params,
                title: s.current,
              }),
            }
          }
          if (s.current) {
            const done = Number(s.current_bytes)
            const size = Number(s.current_total)
            return {
              result: 'loading',
              message: i18n(
                '${ready} of ${total} ready. Downloading ${title}: ${pct}% of ${size}',
                {
                  ...params,
                  title: s.current,
                  pct: size ? Math.floor((100 * done) / size) : 0,
                  size: gib(size),
                },
              ),
            }
          }
          if (s.waiting) {
            return {
              result: 'loading',
              message: i18n(
                '${ready} of ${total} ready. ${titles} did not finish and will be tried again in a few minutes',
                { ...params, titles: s.waiting },
              ),
            }
          }
          return {
            result: 'loading',
            message: i18n('${ready} of ${total} ready', params),
          }
        },
      },
      requires: ['primary'],
    })
})
