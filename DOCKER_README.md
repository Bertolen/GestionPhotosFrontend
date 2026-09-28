# Docker - GestionPhotos Frontend

Ce projet contient la configuration Docker pour déployer l'application Angular **GestionPhotos Frontend** sur une **Raspberry Pi 4** (architecture ARM64).

## Prérequis

### Sur votre machine de développement
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) avec **Buildx** activé
- Git Bash ou terminal compatible (pour les scripts)
- SSH configuré pour accéder à votre Raspberry Pi

### Sur la Raspberry Pi 4
- Raspberry Pi OS (64-bit)
- Docker installé : `sudo apt install docker.io`
- Docker Compose (optionnel) : `sudo apt install docker-compose-plugin`
- Votre utilisateur doit faire partie du groupe docker : `sudo usermod -aG docker $USER`

---

## Structure des fichiers

```
gestion-photos-frontend/
├── Dockerfile              # Configuration du build Docker
├── nginx.conf              # Configuration Nginx pour Angular
├── docker-compose.yml      # Configuration Docker Compose (optionnel)
├── .dockerignore           # Fichiers à ignorer lors du build
├── .env.example            # Variables d'environnement exemple
└── scripts/
    ├── deploy.sh           # Script de déploiement principal
    └── deploy-compose.sh   # Script de déploiement avec Compose
```

---

## Utilisation

### 1. Configuration

Copiez et modifiez le fichier `.env` :

```bash
cp .env.example .env
```

Éditez `.env` avec vos informations :

```env
IMAGE_NAME=gestion-photos-frontend
IMAGE_TAG=latest
RASPBERRY_IP=192.168.1.100
RASPBERRY_USER=pi
RASPBERRY_SSH_PORT=22
RASPBERRY_DOCKER_PORT=8080
```

> **Note** : Si vous utilisez Docker Compose, le port sera celui défini dans `docker-compose.yml`.

---

### 2. Build de l'image Docker

#### Build pour ARM64 (Raspberry Pi)

```bash
# Avec npm
npm run docker:build

# Ou directement avec Docker
# Sur Windows (Git Bash)
docker build --platform linux/arm64 -t gestion-photos-frontend:latest .
```

#### Build local pour test

```bash
# Build pour votre plateforme locale (pour test)
npm run docker:build:local

# Exécuter localement
npm run docker:run:local
# Accès : http://localhost:8080
```

---

### 3. Déploiement sur Raspberry Pi

#### Méthode 1: Script de déploiement simple (recommandé)

```bash
# Donnez les permissions d'exécution
chmod +x scripts/deploy.sh

# Exécutez le déploiement
npm run docker:deploy

# Ou directement
./scripts/deploy.sh
```

Ce script :
1. Construit l'image pour ARM64
2. Sauvegarde l'image dans un fichier `.tar`
3. Transfère l'image via SCP vers la Raspberry
4. Charge et démarre le container sur la Raspberry

#### Méthode 2: Avec Docker Compose

```bash
chmod +x scripts/deploy-compose.sh
./scripts/deploy-compose.sh
```

---

### 4. Déploiement manuel

Si vous préférez faire les étapes manuellement :

**Sur votre machine :**

```bash
# Build pour ARM64
docker build --platform linux/arm64 -t gestion-photos-frontend:latest .

# Sauvegarder l'image
docker save gestion-photos-frontend:latest > gestion-photos-frontend.tar

# Transférer vers la Raspberry
scp gestion-photos-frontend.tar pi@192.168.1.100:/tmp/
```

**Sur la Raspberry Pi :**

```bash
# Charger l'image
docker load < /tmp/gestion-photos-frontend.tar

# Démarrer le container
docker run -d \
  --name gestion-photos-frontend \
  -p 8080:80 \
  --restart unless-stopped \
  gestion-photos-frontend:latest

# Nettoyer
rm /tmp/gestion-photos-frontend.tar
```

---

### 5. Docker Compose (optionnel)

Pour utiliser Docker Compose sur la Raspberry :

```bash
# Copier les fichiers nécessaires
scp docker-compose.yml nginx.conf pi@192.168.1.100:~/

# Sur la Raspberry
cd ~
docker compose down 2>/dev/null || true
docker compose up -d
```

---

## Commandes utiles

### Sur la Raspberry Pi

```bash
# Voir les containers en cours
docker ps

# Voir les logs du container
docker logs gestion-photos-frontend

# Arrêter le container
docker stop gestion-photos-frontend

# Redémarrer le container
docker start gestion-photos-frontend

# Supprimer le container
docker rm gestion-photos-frontend

# Supprimer l'image
docker rmi gestion-photos-frontend

# Nettoyer Docker (attention!)
docker system prune -a --volumes
```

---

## Résolution des problèmes

### Problème : Build échoue sur Windows

Assurez-vous que Docker Desktop est en mode **Linux containers** et que Buildx est activé.

### Problème : Image trop grosse

L'image finale est basée sur `nginx:alpine` (~20MB) + votre application buildée (~few MB). 
C'est normal et optimisé pour ARM.

### Problème : Erreur de permission sur deploy.sh

```bash
chmod +x scripts/deploy.sh
```

### Problème : SSH ne fonctionne pas

Vérifiez que :
- La Raspberry est allumée et connectée au réseau
- SSH est activé : `sudo raspi-config` > Interface Options > SSH
- Vous pouvez vous connecter manuellement : `ssh pi@192.168.1.100`

### Problème : Port déjà utilisé

Modifiez `RASPBERRY_DOCKER_PORT` dans `.env` ou arrêtez le service qui utilise le port :

```bash
sudo lsof -i :8080
sudo kill <PID>
```

---

## Personnalisation

### Changer le port Nginx

Modifiez `nginx.conf` et mettez à jour le port dans `docker-compose.yml`.

### Ajouter des variables d'environnement

Modifiez `nginx.conf` pour ajouter des en-têtes ou des proxy_pass si nécessaire.

### HTTPS avec Let's Encrypt (optionnel)

Pour HTTPS, utilisez un reverse proxy comme Traefik ou Nginx Proxy Manager.

---

## Architecture Docker

### Dockerfile

Le Dockerfile utilise une approche **multi-stage** :

1. **Stage 1 (builder)** : Utilise `node:20-alpine` pour installer les dépendances et builder l'application Angular
2. **Stage 2** : Utilise `nginx:alpine` pour servir les fichiers statiques buildés

Cela permet d'avoir une image finale très légère (~20-30MB).

### Pourquoi nginx:alpine ?

- **Alpine Linux** : Distro ultra-légère
- **Nginx** : Serveur HTTP performant pour servir des fichiers statiques
- **Configuration optimisée** : Gzip, cache, routage Angular

---

## Bonnes pratiques

1. **Toujours builder avec `--platform linux/arm64`** pour Raspberry Pi
2. **Utilisez `.dockerignore`** pour exclure les fichiers inutiles
3. **Tagguez vos images** avec des versions pour le rollback
4. **Testez localement** avant de déployer sur la Raspberry
5. **Surveillez les logs** avec `docker logs`

---

## Accès à l'application

Après déploiement, l'application sera accessible à :

```
http://<RASPBERRY_IP>:<RASPBERRY_DOCKER_PORT>
```

Exemple : `http://192.168.1.100:8080`

---

## Notes supplémentaires

- L'application est configurée pour **rediriger toutes les routes vers index.html** (nécessaire pour Angular Routing)
- Les **assets statiques sont cacheés pour 1 an** (bon pour la performance)
- **index.html n'est pas cacheé** (pour les mises à jour)
- Le container redémarre automatiquement (`--restart unless-stopped`)
