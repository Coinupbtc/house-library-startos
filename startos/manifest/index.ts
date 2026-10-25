import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'house-library',
  title: 'House Library',
  license: 'GPL-3.0-or-later',
  packageRepo: 'https://github.com/coinupbtc/house-library-startos',
  upstreamRepo: 'https://github.com/kiwix/kiwix-tools',
  marketingUrl: 'https://kiwix.org',
  donationUrl: null,
  description: { short, long },
  volumes: ['library'],
  images: {
    library: {
      source: {
        dockerBuild: {},
      },
      arch: ['x86_64', 'aarch64'],
    },
  },
})
