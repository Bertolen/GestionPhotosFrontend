#!/bin/bash

# Script de déploiement MANUEL de secours (si GitLab est indisponible).
# En temps normal, la CI GitLab déploie automatiquement au push sur master (issue #1).
#
# Usage: ./scripts/deploy.sh
#
# Valeurs réelles de la prod : frontend sur 80, backend Spring Boot sur 8080,
# hostname nuestra-traviesa (résolu par le DNS de la box).

set -e

echo "=== Déploiement manuel de GestionPhotos Frontend sur la Raspberry Pi ==="

# Chargement des variables d'environnement
if [ -f .env ]; then
    source .env
fi

# Variables par défaut (peuvent être écrasées par .env)
IMAGE_NAME=${IMAGE_NAME:-gestion-photos-frontend}
IMAGE_TAG=${IMAGE_TAG:-latest}
RASPBERRY_HOST=${RASPBERRY_HOST:-nuestra-traviesa}
RASPBERRY_USER=${RASPBERRY_USER:-pi}
RASPBERRY_SSH_PORT=${RASPBERRY_SSH_PORT:-22}
RASPBERRY_DOCKER_PORT=${RASPBERRY_DOCKER_PORT:-80}
API_BASE_URL=${API_BASE_URL:-http://nuestra-traviesa:8080}

FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
TAR_FILE="${IMAGE_NAME}-${IMAGE_TAG}.tar"

echo "Image: $FULL_IMAGE_NAME"
echo "Raspberry Pi: ${RASPBERRY_USER}@${RASPBERRY_HOST}:${RASPBERRY_SSH_PORT}"
echo "Port de déploiement: ${RASPBERRY_DOCKER_PORT}"

# Étape 1: Construire l'image pour ARM64
echo ""
echo "=== Construction de l'image Docker pour ARM64 ==="
docker build --platform linux/arm64 -t "$FULL_IMAGE_NAME" .

# Étape 2: Sauvegarder l'image dans un fichier tar
echo ""
echo "=== Sauvegarde de l'image ==="
docker save "$FULL_IMAGE_NAME" > "$TAR_FILE"

# Étape 3: Transférer l'image vers la Raspberry Pi
echo ""
echo "=== Transfert vers Raspberry Pi ==="
scp -P "$RASPBERRY_SSH_PORT" "$TAR_FILE" "${RASPBERRY_USER}@${RASPBERRY_HOST}:/tmp/"

# Étape 4: Charger et démarrer sur la Raspberry Pi
echo ""
echo "=== Déploiement sur Raspberry Pi ==="
ssh -p "$RASPBERRY_SSH_PORT" "${RASPBERRY_USER}@${RASPBERRY_HOST}" << EOF
    set -e
    echo "Chargement de l'image Docker..."
    docker load < /tmp/${TAR_FILE}

    echo "Arrêt du container existant..."
    docker stop ${IMAGE_NAME} 2>/dev/null || true
    docker rm ${IMAGE_NAME} 2>/dev/null || true

    echo "Démarrage du nouveau container..."
    docker run -d \
        --name ${IMAGE_NAME} \
        -p ${RASPBERRY_DOCKER_PORT}:80 \
        -e "API_BASE_URL=${API_BASE_URL}" \
        --restart unless-stopped \
        ${FULL_IMAGE_NAME}

    rm /tmp/${TAR_FILE}

    echo "Vérification que le frontend répond..."
    sleep 3
    if curl -fsS http://localhost:${RASPBERRY_DOCKER_PORT}/ | grep -qi '<app-root'; then
        echo "Container démarré avec succès !"
        echo "Accès: http://${RASPBERRY_HOST}:${RASPBERRY_DOCKER_PORT}"
    else
        echo "ATTENTION: le container est démarré mais ne sert pas l'index Angular."
        echo "Vérifiez: docker logs ${IMAGE_NAME}"
        exit 1
    fi
EOF

# Étape 5: Nettoyage local
echo ""
echo "=== Nettoyage local ==="
rm "$TAR_FILE"

echo ""
echo "=== Déploiement terminé avec succès ! ==="
echo "Application disponible sur: http://${RASPBERRY_HOST}:${RASPBERRY_DOCKER_PORT}"
echo ""
echo "Note: au prochain déploiement CI, le conteneur manuel sera remplacé"
echo "automatiquement par le conteneur docker compose."
