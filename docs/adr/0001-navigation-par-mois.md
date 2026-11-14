# Navigation par mois pour la galerie

La galerie doit rester utilisable en < 2 s sur un téléphone en WiFi alors que la bibliothèque croît sans maximum prévu (plusieurs centaines de photos par mois) sur un serveur Raspberry Pi 3. Plutôt que de paginer la liste des photos (fetch complet ou pagination keyset), la galerie affiche **un mois civil à la fois** — le mois de création des photos — avec une navigation précédent/suivant qui saute les mois vides, servie par `GET /api/photos/months` (les mois non vides avec leurs compteurs) et `GET /api/photos?month=YYYY-MM` (le contenu complet du mois). Le mois borne le payload par l'activité mensuelle et non par la taille de la bibliothèque : la vue par défaut reste constante (~30–200 Ko) quelle que soit la croissance, et « tout sélectionner » reste un concept purement client (toute la vue courante). Le filtre libre par plage de dates subsiste en option avancée qui remplace la vue mois tant qu'il est actif, au prix d'un fetch complet de la plage — un trou O(plage) accepté parce qu'explicite.

## Conséquences

- `GET /api/photos` sans paramètre disparaît (paramètre `month` requis) ; les interfaces `PaginatedPhotoResponse`/`PageInfo` sont retirées du modèle frontend.
- Contingences différées derrière un déclencheur mesuré : pagination intra-mois si un mois dépasse ~2 000 photos ; virtualisation du DOM si le scroll décroche au-delà de ~2 000 cartes rendues.
- Détail de la décision : ticket wayfinder « Décision — Service de la liste des photos à l'échelle » (GestionPhotosFrontend #5) ; termes dans `GLOSSARY.md` (« Vue mois », « Navigation par mois », « Mois vide », « Filtre libre »).
