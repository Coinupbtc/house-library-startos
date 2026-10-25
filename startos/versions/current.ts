import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.1.0:0',
  releaseNotes: {
    en_US:
      'A shelf of about forty books to choose from with the new Choose Books action: medicine with pictures, iFixit repair guides, home and cooking answers, emergency guides, Crash Course and other videos, travel and reference. A new home page searches every book at once, suggests titles as you type, and shows which books are still downloading. A Discover row puts a few videos and travel pictures on the home page, picked at random. The Books status shows download progress. Wikipedia and WikEM stay on disk and are not downloaded again.',
    es_ES:
      'Una estantería de unos cuarenta libros para elegir con la nueva acción Elegir libros: medicina con imágenes, guías de reparación de iFixit, respuestas de hogar y cocina, guías de emergencia, Crash Course y otros vídeos, viajes y consulta. Una nueva página de inicio busca en todos los libros a la vez, sugiere títulos mientras escribe y muestra qué libros aún se descargan. Una fila Descubrir muestra en la página de inicio algunos vídeos y fotos de viaje elegidos al azar. El estado Libros muestra el progreso de la descarga. Wikipedia y WikEM se quedan en el disco y no se vuelven a descargar.',
    de_DE:
      'Ein Regal mit rund vierzig Büchern zur Auswahl über die neue Aktion „Bücher auswählen“: Medizin mit Bildern, iFixit-Reparaturanleitungen, Antworten zu Haus und Küche, Notfallratgeber, Crash Course und weitere Videos, Reisen und Nachschlagewerke. Eine neue Startseite durchsucht alle Bücher auf einmal, schlägt beim Tippen Titel vor und zeigt, welche Bücher noch laden. Eine Reihe „Entdecken“ zeigt auf der Startseite einige zufällig gewählte Videos und Reisebilder. Der Status „Bücher“ zeigt den Download-Fortschritt. Wikipedia und WikEM bleiben auf der Platte und werden nicht erneut geladen.',
    pl_PL:
      'Półka około czterdziestu książek do wyboru w nowej akcji „Wybierz książki”: medycyna z ilustracjami, poradniki naprawcze iFixit, odpowiedzi o domu i gotowaniu, poradniki na sytuacje awaryjne, Crash Course i inne filmy, podróże i informatory. Nowa strona główna przeszukuje wszystkie książki naraz, podpowiada tytuły podczas pisania i pokazuje, które książki jeszcze się pobierają. Rząd „Odkrywaj” pokazuje na stronie głównej kilka losowo wybranych filmów i zdjęć z podróży. Status „Książki” pokazuje postęp pobierania. Wikipedia i WikEM zostają na dysku i nie są pobierane ponownie.',
    fr_FR:
      'Une étagère d’une quarantaine de livres à choisir avec la nouvelle action Choisir les livres : médecine illustrée, guides de réparation iFixit, réponses sur la maison et la cuisine, guides d’urgence, Crash Course et d’autres vidéos, voyage et référence. Une nouvelle page d’accueil cherche dans tous les livres à la fois, propose des titres pendant la saisie et montre les livres encore en téléchargement. Une rangée Découvrir affiche sur la page d’accueil quelques vidéos et photos de voyage choisies au hasard. Le statut Livres montre la progression. Wikipédia et WikEM restent sur le disque et ne sont pas retéléchargés.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
