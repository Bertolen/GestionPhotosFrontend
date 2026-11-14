# Spec — Optimisation de la performance : galerie & upload massif

> Assemblée par le ticket wayfinder « Assembler la spec et la découper en tickets d'implémentation »
> (GestionPhotosFrontend#8), à partir des décisions « Service de la liste des photos à l'échelle » (#5),
> « Stratégie miniatures et cache des images » (#6) et « Upload massif avec progression » (#7),
> appuyées sur les recherches « Miniatures côté Spring Boot sur Raspberry Pi 3 » (#3) et
> « Mécanismes d'upload massif robuste » (#4). Le pourquoi vit dans les ADR 0001–0003 ; cette spec
> porte le quoi et l'ordre.

## Objectif et budget

| Exigence | Budget |
| --- | --- |
| Galerie **utilisable à chaque visite** (téléphone en WiFi, Raspberry Pi 3 Model B) | **< 2 s** (aujourd'hui ~15 s, miniatures incluses) |
| **Upload massif sans échec, progression visible** | un lot de plusieurs centaines de JPEG passe sans échec, avec état par fichier |
| Croissance | plusieurs centaines de photos/mois, **sans maximum prévu** — aucune vue ne doit se dégrader avec la taille de la bibliothèque |
| Formats | JPEG aujourd'hui ; vidéos en évolution future — la spec ne doit pas leur fermer la porte |

Environnement de prod : Raspberry Pi 3 Model B (ARM Cortex-A53, 1 Go RAM, WiFi partagé) ; nginx :80
(conteneur frontend Angular 19) + Spring Boot :8080 ; stockage de fichiers plats, sans BDD ; l'API est
le seul écrivain du stockage.

## Les trois chantiers

1. **Liste à l'échelle** (ADR 0001) : index mémoire backend + navigation par mois — le payload servi
   est borné par l'activité mensuelle, plus par la taille de la bibliothèque.
2. **Miniatures** (ADR 0002) : une vignette unique 360 px servie par nginx — la grille n'affiche plus
   jamais les originaux.
3. **Upload** (ADR 0003) : une requête par fichier, concurrence 3, états par fichier — le lot devient
   annulable, rejouable, et les limites dures disparaissent.

---

## Chantier 1 — Liste à l'échelle

### Backend (repo `GestionPhotosBackend`)

**Index mémoire.** Un index des photos construit une fois au démarrage (scan du stockage) remplace
le `Files.walk` par requête. Toutes les lectures passent par lui : liste, `getPhotoById` (fin du
parcours disque par image servie), filtre par dates, compteurs, et **contrôle anti-doublon** à
l'upload (fin du `Files.walk` par fichier stocké — la règle de détection reste inchangée : timestamp
`YYYYMMDD_HHmmss` + extension, rejet 409). Mis à jour **synchrone à l'upload et à la suppression**
(l'API est le seul écrivain). **Endpoint de rebuild manuel** en filet de sécurité. Ni WatchService,
ni TTL.

**API de navigation par mois.**

- `GET /api/photos/months` → `[{ "month": "YYYY-MM", "count": n }, …]` tri par mois croissant — le
  frontend en dérive le mois par défaut (dernière entrée) et les sauts de mois vides.
- `GET /api/photos?month=YYYY-MM` → **contenu complet du mois**, tri `creationDate` décroissant.
  Le paramètre `month` est **requis** (400 sans lui) ; `GET /api/photos` sans paramètre disparaît.
- `GET /api/photos/by-date` conservé pour le filtre libre.
- `Cache-Control: no-store` sur `/months`, `?month=` et `/by-date` (le cache des images relève du
  chantier 2).

**Contingence différée** (notée, pas en v1) : pagination intra-mois si un mois dépasse ~2 000 photos.

### Frontend (repo `GestionPhotosFrontend`)

- **Vue mois par défaut** : le mois le plus récent contenant des photos ; précédent/suivant
  **sautent les mois vides** ; le mois affiché est dérivable de `GET /months`.
- **Filtre libre par plage de dates** : conservé en option avancée ; il **remplace la vue mois tant
  qu'il est actif** (navigation par mois masquée) ; fetch complet de la plage — trou O(plage) accepté
  car explicite.
- **« Tout sélectionner »** = toute la vue courante (mois affiché ou résultats du filtre), côté
  client ; actions groupées inchangées.
- **Rendu** : `trackBy` sur le `*ngFor`, `ChangeDetectionStrategy.OnPush`, skeletons de chargement ;
  `loading="lazy"` conservé. Virtualisation différée (déclencheur mesuré : jank de scroll au-delà
  de ~2 000 cartes).
- **Modèle** : `PaginatedPhotoResponse` et `PageInfo` retirés de `photo.model.ts`.

---

## Chantier 2 — Miniatures et cache des images

### Backend (repo `GestionPhotosBackend`)

- **Lib** : Thumbnailator 0.4.21 (`net.coobird:thumbnailator`). Une seule déclinaison : **360 px de
  long côté, JPEG q~0.8**, pas de `srcset` (couvre desktop DPR 2 et mobile DPR 3 ; ~15–40 Ko contre
  3–8 Mo par original). WebP documenté en v2, pas décidé.
- **Stockage** : `<storage>/thumbs/<id>.jpg`, dossier plat dans le volume déjà monté par le backend.
- **Génération à l'avance, asynchrone à l'upload** : file en mémoire, 2 workers dédiés — jamais dans
  la réponse HTTP. La miniature est **supprimée en même temps que la photo** (unitaire et groupée).
- **Backfill** : scan idempotent « vignettes manquantes » à chaque démarrage (reboot en plein
  travail = reprise sans régénérer l'existant), 2 workers max, heap JVM plafonnée `-Xmx384m`,
  **les uploads sont prioritaires** sur la file. Ordre de grandeur : 5 000 photos ≈ 1–1,5 h.
  **Calibrer sur ~20 photos réelles** avant de figer la fenêtre (les chiffres CPU de la recherche
  sont des estimations dérivées de benchmarks C).

### Frontend / infra (repo `GestionPhotosFrontend`)

- **nginx (conteneur frontend) sert les miniatures** : bind mount read-only de
  `${PHOTO_STORAGE_PATH}/thumbs` dans `docker-compose.yml` + `location /thumbs/` dans `nginx.conf`
  — le couplage des deux `docker-compose.yml` sur le même chemin hôte est assumé. Spring ne sert
  jamais les vignettes.
- **URL par convention** : le front construit `/thumbs/{id}.jpg` (URL relative, même origine que la
  page — pas de CORS) ; **le DTO `Photo` reste inchangé**. Les originaux ne servent plus qu'au
  téléchargement.
- **Cache** : `expires 30d` + `Cache-Control: public` + ETag nginx (304 automatiques) ; **pas de
  purge** à la suppression. Pas de gzip (JPEG non compressible).
- **Carte sans miniature** : placeholder « 📷 Miniature indisponible » existant + **re-essai
  automatique plafonné** (une douzaine d'essais, ~1–2 min) puis placeholder définitif ; seules les
  cartes visibles re-essaient (`loading="lazy"`). Conséquence assumée : pendant la fenêtre de
  backfill, les cartes au-delà du plafond restent en placeholder jusqu'à un rechargement de page.
- **Dev (`ng serve`)** : proxy `/thumbs/` vers un environnement qui a les miniatures.

---

## Chantier 3 — Upload massif avec progression

### Frontend (repo `GestionPhotosFrontend`)

- **Une requête par fichier** via l'endpoint existant `/upload/single-with-date`, **concurrence 3**,
  file FIFO dans l'ordre de sélection. Repli `/upload` pour un fichier sans `lastModified`
  exploitable.
- **Session d'upload dans un service singleton** : elle survit à la navigation (quitter/revenir à
  `/upload` retrouve l'état) ; **entrée fichier verrouillée pendant un lot** ; **rechargement de
  page = lot perdu** (assumé, pas de persistance) — les fichiers déjà envoyés restent sur le serveur.
- **Barre globale « X/N fichiers »**, pas de pourcentage par fichier ; la liste de sélection devient
  la surface d'état par fichier (statut, sans %).
- **Trois états terminaux** : **réussie ✅**, **ignorée — déjà présente** (409 anti-doublon :
  information, pas erreur, pas rejouable), **échouée ❌** avec message. Un échec n'arrête pas le lot.
- **Rejeu manuel** : « Rejouer » par fichier échoué + « Rejouer les échecs » ; pas de rejeu
  automatique.
- **Timeout ~2 min par requête** : fichier marqué échoué, slot libéré.
- **Annuler** : fichiers restants annulés, en-cours abandonnés, déjà envoyés conservés.
- **Fin de lot** : bilan (X réussies, Y ignorées, Z échouées) + bouton « Aller à la galerie ».
  **Pas de rafraîchissement live** de la galerie (elle recharge à chaque navigation ; la miniature
  asynchrone est couverte par le re-essai plafonné du placeholder 📷).
- **ZIP rejeté** (gain ≈ 3 % sur de vrais JPEG, extraction sur le Pi, tout-ou-rien, aucune
  progression par fichier) ; tus/chunked rejeté (surdimensionné pour des fichiers de quelques Mo sur
  LAN).
- **Modèle** : `uploadPhotos` et `uploadPhotosWithDates` retirés de `PhotoService` avec
  `PhotoUploadMultipleResponse`.

### Backend (repo `GestionPhotosBackend`)

- **Endpoints lot retirés** : `/upload/multiple` et `/upload/multiple-with-date` (contrôleur,
  service, exceptions, tests), et la limite `max-files-per-upload` avec eux — une seule voie de code.
  Les limites dures associées (100 fichiers/contrôleur, 210 parts Tomcat) cessent de mordre.
- **`max-file-size` conservé à 1 Go par fichier** (multipart Spring + propriété custom) — porte
  volontairement ouverte à l'évolution vidéo ; la validation MIME images-only reste le garde-fou.
- **Corps d'erreur JSON `{code, message}`** sur toutes les réponses d'erreur d'upload (400, 409,
  413, 500 — aujourd'hui vides).
- **`MaxUploadSizeExceededException` → 413** avec message.
- **Anti-doublon via l'index mémoire** (chantier 1) au lieu du `Files.walk` par fichier stocké.

---

## Tickets d'implémentation et ordre

Chaque ticket vit dans le tracker de son repo (issues normales, labels `ready-for-agent` /
`ready-for-human`). Les dépendances **code** sont notées « Blocked by » ; les dépendances
**déploiement** sont notées « À déployer après ».

| # | Ticket | Repo | Dépendances |
| --- | --- | --- | --- |
| 1 | Index mémoire des photos | Backend | — |
| 2 | API de navigation par mois | Backend | Blocked by 1 |
| 3 | Génération des miniatures à l'upload | Backend | — |
| 4 | Backfill des miniatures au démarrage | Backend | Blocked by 3 |
| 5 | Corps d'erreur JSON et 413 sur l'upload | Backend | — |
| 6 | Retrait des endpoints d'upload en lot | Backend | À déployer après 13 (frontend en ligne) |
| 7 | nginx et compose servent `/thumbs/` | Frontend | — |
| 8 | Galerie : navigation par mois | Frontend | À déployer après 2 (API mois en ligne) |
| 9 | Galerie : miniatures dans la grille | Frontend | Blocked by 7, 8 ; à déployer après 3 |
| 10 | Galerie : trackBy, OnPush, skeletons | Frontend | Blocked by 8 (mêmes fichiers) |
| 11 | Upload : service de session — une requête par fichier | Frontend | — |
| 12 | Upload : UI de progression sur la session | Frontend | Blocked by 11 |
| 13 | *déploiement frontend (tickets 7–12)* | Frontend | — |
| 14 | Mesurer la référence de performance avant tout changement | Frontend | Avant tout déploiement |
| 15 | Vérifier le budget : galerie < 2 s, upload sans échec | Frontend | Après toutes les phases |

**Ordre de déploiement recommandé** (les déploiements backend peuvent être batchés) :

- **Phase 0** — ticket 14 : mesure de référence, avant tout changement en prod.
- **Phase 1** — backend : tickets 1, 3, 5 → déployer.
- **Phase 2** — backend : tickets 2, 4 → déployer.
- **Phase 3** — frontend : tickets 7, 8 puis 9, 10 ; en parallèle 11 puis 12 → déployer le frontend.
- **Phase 4** — backend : ticket 6 (le frontend phase 3 n'appelle plus les endpoints lot).
- **Phase 5** — ticket 15 : vérification du budget.

## Vérification du budget

**Mesure de référence (avant tout déploiement).** Sur la Pi, téléphone en WiFi, cache navigateur
vide : visiter la galerie et chronométrer jusqu'à la grille complète, miniatures incluses (référence
attendue : ~15 s) ; uploader un lot de ~50 photos et noter durée et comportement. Consigner les
chiffres dans le ticket.

**Scénario d'acceptation (après le déploiement complet).** Mêmes conditions (téléphone en WiFi,
serveur la Pi) :

1. **Visite à froid** (cache vide) : la vue mois par défaut est interactive — squelettes affichés,
   navigation et sélection utilisables — en **< 2 s** ; les premières miniatures visibles arrivent
   en **< 2 s** ; le reste du mois streame sans bloquer l'interaction.
2. **Re-visite** (cache chaud) : **< 2 s**, miniatures servies en 304 (`Cache-Control` 30 j + ETag).
3. **Navigation entre mois** : précédent/suivant saute les mois vides, la vue se charge
   quasi instantanément (payload borné par le mois).
4. **Upload d'un gros lot** (≥ 100 JPEG) : progression « X/N » visible et régulière, concurrence 3,
   **aucun échec** en WiFi ; les doublons s'affichent « ignorées » ; le bilan est exact ; « Aller à
   la galerie » fonctionne.
5. **Fenêtre de backfill** : les cartes sans miniature montrent le placeholder 📷 avec re-essai
   plafonné ; après le backfill et un rechargement, plus aucun placeholder.

## Hors périmètre

- **Support des vidéos** (évolution future déclarée) — la spec ne doit pas leur fermer la porte
  (`max-file-size` 1 Go conservé, MIME images-only en garde-fou).
- Optimisation du téléchargement groupé (`POST /download/bulk`) — aucun symptôme rapporté.
- Refontes hors performance (UI, nouvelles fonctionnalités).

## Contingences différées (déclencheurs mesurés, pas en v1)

- Pagination intra-mois si un mois dépasse ~2 000 photos.
- Virtualisation du DOM si le scroll décroche au-delà de ~2 000 cartes rendues.
- WebP pour les miniatures (−25 à −34 % à qualité égale, natifs ARM et encodage 10–17× plus lent).
