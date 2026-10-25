import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { defaultBooks, defaultEncyclopedia } from '../utils'

// Which books the owner picked with the Choose Books action. Ids are the
// `id` field of startos/shelf.json; an id the shelf no longer has is ignored.
const shape = z.looseObject({
  encyclopedia: z.string().catch(defaultEncyclopedia),
  books: z.array(z.string()).catch(defaultBooks),
})

export const choiceJson = FileHelper.json(
  { base: sdk.volumes.library, subpath: 'choice.json' },
  shape,
)
