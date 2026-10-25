import { readdir } from 'node:fs/promises'
import { choiceJson } from '../fileModels/choice.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  defaultBooks,
  defaultEncyclopedia,
  gib,
  Group,
  inGroup,
  noEncyclopedia,
  optionLabel,
  wantedBooks,
} from '../utils'

const { InputSpec, Value } = sdk

const options = (group: Group): Record<string, string> =>
  Object.fromEntries(inGroup(group).map((b) => [b.id, optionLabel(b)]))

const ticked = (group: Group, ids: readonly string[]) =>
  inGroup(group)
    .map((b) => b.id)
    .filter((id) => ids.includes(id))

const shelfGroup = (group: Exclude<Group, 'encyclopedia'>, name: string) =>
  Value.multiselect({
    name,
    default: ticked(group, defaultBooks),
    values: options(group),
  })

const editions: Record<string, string> = {
  ...options('encyclopedia'),
  [noEncyclopedia]: i18n('No Wikipedia'),
}

const inputSpec = InputSpec.of({
  encyclopedia: Value.select({
    name: i18n('Wikipedia'),
    description: i18n(
      'One edition at a time. When you switch, the old edition stays readable until the new one has downloaded.',
    ),
    default: defaultEncyclopedia,
    values: editions,
  }),
  health: shelfGroup('health', i18n('Health and medicine')),
  home: shelfGroup('home', i18n('Home, repair and cooking')),
  prepared: shelfGroup('prepared', i18n('Emergencies and self-reliance')),
  learning: shelfGroup('learning', i18n('Learning and video')),
  reference: shelfGroup('reference', i18n('Reference and reading')),
})

// Files that finished downloading and passed their checksum.
async function verifiedFiles(): Promise<Set<string>> {
  const names = await readdir(sdk.volumes.library.subpath('zim')).catch(
    () => [] as string[],
  )
  return new Set(
    names
      .filter((n) => n.endsWith('.zim.sha256'))
      .map((n) => n.replace(/\.sha256$/, '')),
  )
}

export const chooseBooks = sdk.Action.withInput(
  'choose-books',

  async () => ({
    name: i18n('Choose Books'),
    description: i18n(
      'Pick which books this server keeps. New books download in the background and appear in the library as each one finishes.',
    ),
    warning: i18n(
      'Books you untick are deleted from this server once the other downloads finish. Ticking one again downloads it again.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async () => {
    const choice = (await choiceJson.read().once()) ?? {
      encyclopedia: defaultEncyclopedia,
      books: defaultBooks,
    }
    const encyclopedia = inGroup('encyclopedia').some(
      (b) => b.id === choice.encyclopedia,
    )
      ? choice.encyclopedia
      : noEncyclopedia
    return {
      encyclopedia,
      health: ticked('health', choice.books),
      home: ticked('home', choice.books),
      prepared: ticked('prepared', choice.books),
      learning: ticked('learning', choice.books),
      reference: ticked('reference', choice.books),
    }
  },

  async ({ effects, input }) => {
    const before = wantedBooks(
      (await choiceJson.read().once()) ?? { encyclopedia: '', books: [] },
    )
    const choice = {
      encyclopedia: input.encyclopedia,
      books: [
        ...input.health,
        ...input.home,
        ...input.prepared,
        ...input.learning,
        ...input.reference,
      ],
    }
    await choiceJson.merge(effects, choice)

    const after = wantedBooks(choice)
    const onDisk = await verifiedFiles()
    const toFetch = after.filter((b) => !onDisk.has(b.file))
    const removed = before.filter((b) => !after.some((a) => a.id === b.id))
    const sum = (list: typeof after) =>
      gib(list.reduce((n, b) => n + b.bytes, 0))

    const lines = [
      i18n('${count} books on the shelf, ${size} in all.', {
        count: after.length,
        size: sum(after),
      }),
      toFetch.length
        ? i18n('${count} to download (${size}): ${titles}.', {
            count: toFetch.length,
            size: sum(toFetch),
            titles: toFetch.map((b) => b.title).join(', '),
          })
        : i18n('Nothing new to download.'),
    ]
    if (removed.length) {
      lines.push(
        i18n('Removed once the downloads finish: ${titles} (${size}).', {
          titles: removed.map((b) => b.title).join(', '),
          size: sum(removed),
        }),
      )
    }
    lines.push(
      i18n(
        'The Books status on the service page shows download progress. If the service is stopped, the change applies when it starts.',
      ),
    )

    return {
      version: '1',
      title: i18n('Shelf updated'),
      message: lines.join('\n\n'),
      result: null,
    }
  },
)
