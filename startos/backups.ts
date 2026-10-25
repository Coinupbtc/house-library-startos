import { sdk } from './sdk'

// The books are large and can be downloaded again, and house/ is rebuilt on
// every start. Back up the rest of the volume, which is choice.json, so a
// backup does not copy tens of gigabytes.
export const { createBackup, restoreInit } = sdk.setupBackups(async () =>
  sdk.Backups.ofVolumes('library').setOptions({
    exclude: ['zim/', 'house/'],
  }),
)
