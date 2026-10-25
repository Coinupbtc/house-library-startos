import { choiceJson } from '../fileModels/choice.json'
import { sdk } from '../sdk'

// Install, and the update from 1.0.0, both arrive without choice.json. Merging
// nothing writes the default shelf; on a file that exists it changes nothing.
export const seedChoice = sdk.setupOnInit(async (effects) => {
  await choiceJson.merge(effects, {})
})
