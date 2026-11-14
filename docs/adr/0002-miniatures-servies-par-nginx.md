# Miniatures servies par nginx, générées à l'avance

La galerie affiche aujourd'hui les originaux pleine résolution (3–8 Mo) dans des cases de 180 px, sans aucun header de cache — ~15 s à chaque visite en WiFi. Plutôt que de faire générer et servir les vignettes par Spring Boot (un thread Tomcat par requête, octets via le heap JVM, pas de sendfile, aucun header de cache), la spec retient des **miniatures uniques de 360 px de long côté** (JPEG q~0.8, ~15–40 Ko), générées **à l'avance** côté backend (Thumbnailator, asynchrone à l'upload + backfill idempotent au démarrage, uploads prioritaires sur la file) et **servies par le nginx du conteneur frontend** via un bind mount read-only de `${PHOTO_STORAGE_PATH}/thumbs` — le couplage des deux `docker-compose.yml` sur le même chemin hôte est assumé. L'URL `/thumbs/{id}.jpg` est une convention construite par le frontend (le DTO `Photo` ne change pas), servie avec `expires 30d` + ETag (304 automatiques) et sans purge à la suppression.

## Conséquences

- Spring ne sert jamais les vignettes : nginx les envoie par sendfile à coût quasi nul, même pendant que le CPU de la Pi produit les miniatures manquantes (fenêtre de backfill : 5 000 photos ≈ 1–1,5 h, 2 workers max, heap plafonnée `-Xmx384m`).
- Une carte sans miniature (fenêtre de backfill ou minute qui suit un upload) montre le placeholder « 📷 » avec un re-essai plafonné (~1–2 min), puis un placeholder définitif ; les cartes au-delà du plafond restent en placeholder jusqu'à rechargement de la page.
- WebP reste une v2 documentée (−25–34 % à qualité égale, mais natifs ARM à embarquer et encodage 10–17× plus lent) — la porte reste ouverte.
- Détail de la décision : ticket wayfinder « Décision — Stratégie miniatures et cache des images » (GestionPhotosFrontend #6) ; recherche sur la branche jetable `research/miniatures-spring-boot-pi` ; termes dans `GLOSSARY.md` (« Miniature », « Original », « Backfill »).
