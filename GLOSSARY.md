# GestionPhotos Frontend

Application Angular de gestion de photos (upload, téléchargement, tri par date), servie par nginx sur une Raspberry Pi du réseau domestique, appuyée sur un backend Spring Boot.

## Language

**Déploiement** :
L'acte de mettre une nouvelle version du frontend en production sur la Pi, sur le port 80.
_Avoid_ : Mise en production, release, publish (pour la prod).

**Déploiement manuel de secours** :
Déploiement exécuté depuis le PC de développement par script (deploy.sh / deploy.ps1), utilisé uniquement quand GitLab est indisponible. Il produit un conteneur hors compose que le prochain déploiement CI remplace.
_Avoid_ : Déploiement manuel (tout court), fallback.

**Runner Pi** :
Le runner auto-hébergé sur la Raspberry Pi, taggé `rpi`, qui n'exécute que le job `deploy`. Les builds et tests tournent ailleurs, sur les runners partagés GitLab.com.
_Avoid_ : Runner local, mini-runner.

**Smoke test** :
La vérification post-déploiement que le port 80 sert l'index Angular et non le JSON d'erreur du backend — elle distingue « le conteneur tourne » de « le frontend est servi ».
_Avoid_ : Test de déploiement, health check.

**Wizard** :
Le script d'installation du runner Pi à exécuter par le propriétaire, auto-vérifiant à chaque étape. Il n'installe que le runner de déploiement, jamais les builds.
_Avoid_ : Script d'installation, setup.

**Configuration d'exécution** :
Les valeurs lues par le conteneur au démarrage (URL du backend) sans rebuild, portées par le `.env` local à la Pi — par opposition à ce qui est figé dans l'image.
_Avoid_ : Variables d'environnement de build, configuration Docker.

**Miniature** :
La version réduite d'une photo (360 px de long côté, JPEG ~0.8) générée côté serveur et servie par nginx depuis `/thumbs/` — la grille n'affiche jamais les originaux.
_Avoid_ : Vignette, thumb, thumbnail.

**Original** :
La photo pleine résolution telle qu'envoyée, conservée dans le stockage ; elle ne quitte le serveur que pour un téléchargement, jamais pour l'affichage en grille.
_Avoid_ : Photo (tout court) quand on veut désigner le fichier source.

**Backfill** :
Le rattrapage unique qui génère les miniatures des photos antérieures à la mise en place ; idempotent (il ne régénère pas une miniature existante), relancé au démarrage du serveur, il sert aussi de filet après un arrêt en plein travail.
_Avoid_ : Migration, import initial.

**Vue mois** :
La tranche de la galerie affichant les photos d'un seul mois civil, défini par le mois de création de chaque photo.
_Avoid_ : Page, galerie du mois.

**Navigation par mois** :
Le passage d'une vue mois à une autre en sautant les mois vides ; le mois affiché par défaut est le plus récent qui contient des photos.
_Avoid_ : Pagination, scroll infini (pour ce mécanisme).

**Mois vide** :
Un mois civil ne contenant aucune photo ; la navigation par mois l'ignore.
_Avoid_ : Mois manquant.

**Filtre libre** :
Une plage de dates arbitraire choisie par l'utilisateur, option avancée qui remplace la vue mois tant qu'elle est active.
_Avoid_ : Filtre personnalisé, filtre avancé.
