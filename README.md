# Forge

Web app installable sur iPhone pour suivre sa nutrition et sa forme, quel que soit l'objectif.

- **Profil** : sexe, âge, taille, poids, activité, séances, objectif (prise de masse, maintien, sèche, performance/endurance) et magasins. Calcul du métabolisme de base (Mifflin-St Jeor), de la maintenance, de l'objectif calorique et des protéines. Objectif personnalisé possible.
- **Accueil** : objectif du jour (avec bouton « sortie » pour l'endurance), pesée du jour, prochain repas, courses restantes, rappel photo. Programme Upper/Lower 24 semaines en option.
- **Suivi** : pesées, moyenne et tendance hebdo, tour de taille, verdict adapté à l'objectif ; photos avant / maintenant.
- **Repas** : 40 recettes à la carte (petit-déj, gamelles midi/soir, collations), quantités ajustées à l'objectif, planning de la semaine en portions, repas du jour à cocher.
- **Courses** : liste générée depuis le planning, coût par magasin (1 ou 2 au choix), prix corrigeables.

Toutes les données restent sur l'appareil (localStorage + IndexedDB). Réglages → Exporter une sauvegarde pour les conserver.

## Installer sur iPhone
1. Ouvre https://romain-garnier-dev.github.io/Carnet-Lean-Bulk/ dans **Safari**.
2. Partager → **Sur l'écran d'accueil**.

## Mettre à jour
Modifier les fichiers puis incrémenter `VERSION` dans `sw.js` : l'app propose alors « Mettre à jour » à la prochaine ouverture.
