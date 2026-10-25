import { sdk } from '../sdk'
import { chooseBooks } from './chooseBooks'

export const actions = sdk.Actions.of().addAction(chooseBooks)
