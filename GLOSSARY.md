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
