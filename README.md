# Carnet Lean Bulk

Web app installable sur iPhone pour suivre une prise de masse lean en parallèle d'un programme de reprise de 24 semaines (Upper/Lower).

- **Accueil** : semaine du programme et consignes du bloc, pesée du jour, prochain repas, courses restantes, rappel photo.
- **Suivi** : pesées quotidiennes, moyenne et tendance hebdo, tour de taille, calories, verdict d'ajustement ; photos avant / maintenant.
- **Repas** : 4 menus en rotation hebdomadaire avec recettes, repas du jour à cocher (remis à zéro chaque jour).
- **Courses** : liste générée pour 7 jours, prix Alcampo / Lidl, meilleur magasin par produit, prix corrigeables.

Toutes les données (pesées, photos, listes, prix corrigés) restent sur l'appareil (localStorage + IndexedDB). Réglages → Exporter une sauvegarde pour les conserver.

## Installer sur iPhone
1. Ouvre l'adresse GitHub Pages du dépôt dans **Safari**.
2. Partager → **Sur l'écran d'accueil**.

## Mettre à jour
Modifier les fichiers puis incrémenter `VERSION` dans `sw.js` : l'app propose alors « Mettre à jour » à la prochaine ouverture.
