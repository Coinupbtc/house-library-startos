import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v1_0_0_0 = VersionInfo.of({
  version: '1.0.0:0',
  releaseNotes: {
    en_US:
      'First release. Serves English Wikipedia without pictures and the WikEM medical reference. The books download onto this server after install.',
    es_ES:
      'Primera versión. Sirve la Wikipedia en inglés sin imágenes y la referencia médica WikEM. Los libros se descargan en este servidor después de instalar.',
    de_DE:
      'Erste Ausgabe. Stellt die englische Wikipedia ohne Bilder und die medizinische Referenz WikEM bereit. Die Bücher werden nach der Installation auf diesen Server geladen.',
    pl_PL:
      'Pierwsze wydanie. Udostępnia angielską Wikipedię bez obrazków i poradnik medyczny WikEM. Książki pobierają się na ten serwer po instalacji.',
    fr_FR:
      'Première version. Sert le Wikipédia anglais sans images et la référence médicale WikEM. Les livres se téléchargent sur ce serveur après l’installation.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
