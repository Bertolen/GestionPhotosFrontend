# Docker & déploiement — GestionPhotos Frontend

Ce projet contient la configuration Docker du frontend Angular **GestionPhotos**, déployé sur une **Raspberry Pi 3 B+** (ARM64, 1 Go de RAM), hostname `nuestra-traviesa` (résolu par le DNS de la box).

## Topologie réelle de la prod

| Service  | Port sur la Pi        | Remarques                          |
| -------- | --------------------- | ---------------------------------- |
| Frontend | **80** (nginx:alpine) | Conteneur `gestion-photos-frontend` |
| Backend  | **8080** (Spring Boot)| Repo séparé, hors périmètre ici     |

L'URL du backend (`API_BASE_URL`, ex. `http://nuestra-traviesa:8080`) est injectée au démarrage du conteneur via `runtime-config.js` : la changer ne nécessite **aucun rebuild**.

---

## Chaîne CI/CD (chemin principal)

Définie dans `.gitlab-ci.yml` (spec : issue #1) :

- **Merge request** : `install` (npm ci, cache), `build` (Angular production), `test` (34 tests unitaires headless), `docker-build` (image ARM64 via buildx/QEMU, sans publication). Une MR rouge ne peut pas être mergée (merge check « Pipelines must succeed »).
- **Push ou merge sur master** : les mêmes jobs + publication de l'image dans le Container Registry GitLab (tag = SHA court du commit + `latest`), puis **déploiement automatique sur la Pi** : pull de l'image, `docker compose up -d`, smoke test (le port 80 doit servir l'index Angular, pas le JSON Spring Boot).
- Les builds et tests tournent sur les **runners partagés GitLab.com** ; la Pi n'exécute que le job `deploy` (environ 30 Mo à tirer), via un runner auto-hébergé taggé `rpi` limité à 1 job à la fois.
- **Rollback** (~2 min, sans rebuild) : Build > Environments > `production` > déploiement précédent > Rollback.

Les pipelines ne se déclenchent que sur les MR et sur master ; master n'est pas protégée (push directs autorisés, déployés s'ils passent build + tests).

### Installation du runner sur la Pi (une seule fois)

Le wizard `scripts/setup-pi-runner.sh` est auto-vérifiant : prérequis (aarch64, Docker, plugin compose), installation de gitlab-runner, enregistrement avec le token créé dans l'UI GitLab, groupe docker, fichier `.env`, activation du merge check, test de bout en bout.

```bash
ssh pi@nuestra-traviesa
git clone https://gitlab.com/nuestra-traviesa/GestionPhotosFrontend.git
cd GestionPhotosFrontend
sudo bash scripts/setup-pi-runner.sh
```

### Configuration d'exécution sur la Pi

- `/home/pi/gestion-photos/.env` : contient `API_BASE_URL=http://nuestra-traviesa:8080`. Le job deploy le lit (`docker compose --env-file ...`). Créé par le wizard.
- `docker-compose.yml` : mapping **80:80**, image `${FRONTEND_IMAGE:-gestion-photos-frontend:latest}`. La CI positionne `FRONTEND_IMAGE` sur l'image du registry taggée par le SHA du commit.

---

## Déploiement manuel de secours (GitLab indisponible)

Les scripts `scripts/deploy.sh` (bash) et `scripts/deploy.ps1` (PowerShell) construisent l'image ARM64, la transfèrent par scp et la démarrent sur la Pi avec `docker run`, en lisant `.env` local :

```bash
cp .env.example .env   # valeurs réelles déjà remplies
./scripts/deploy.sh   # ou : powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

Le conteneur manuel porte le même nom que le conteneur compose : au prochain déploiement CI, il est remplacé automatiquement.

---

## Build local (développement)

```bash
npm run docker:build:local   # image pour la plateforme locale
npm run docker:run:local     # accessible sur http://localhost:8080
```

L'image finale (multi-stage : `node:20-alpine` pour le build, `nginx:alpine` pour servir) fait environ 20–30 Mo.

---

## Commandes utiles sur la Pi

```bash
docker ps                          # conteneurs en cours
docker logs gestion-photos-frontend # logs du frontend
docker inspect gestion-photos-frontend -f '{{.Config.Image}}'  # image déployée (SHA tracé)
sudo gitlab-runner list            # runner enregistré
sudo systemctl status gitlab-runner
```

## Dépannage

- **Le job deploy reste en attente** : le runner taggé `rpi` n'est pas en ligne — relancez le wizard, puis `sudo gitlab-runner verify`.
- **Conflit de port au déploiement** : le backend occupe le 8080 ; le frontend doit rester sur le 80. Vérifiez `docker ps --filter publish=80`.
- **Le smoke test échoue (JSON Spring)** : un conteneur backend répond sur le port 80 — confusion de port/conteneur ; vérifiez le mapping de `docker-compose.yml`.
- **Changer l'URL du backend** : éditez `/home/pi/gestion-photos/.env` puis relancez un déploiement (ou `docker compose --env-file /home/pi/gestion-photos/.env up -d` sur la Pi).
- **SSH ne fonctionne pas** : vérifiez `ssh pi@nuestra-traviesa` (SSH activé via `raspi-config`).

## Hors périmètre

Pas de HTTPS (HTTP sur le LAN), pas d'image multi-architecture (ARM64 seul), pas de CI/CD du repo backend, pas de zero-downtime (quelques secondes d'interruption acceptées à chaque déploiement).
