#!/bin/bash

# Script de déploiement pour Raspberry Pi 4
# Usage: ./scripts/deploy.sh

set -e

echo "=== Déploiement de GestionPhotos Frontend sur Raspberry Pi 4 ==="

# Chargement des variables d'environnement
if [ -f .env ]; then
    source .env
fi

# Variables par défaut (peuvent être écrasées par .env)
IMAGE_NAME=${IMAGE_NAME:-gestion-photos-frontend}
IMAGE_TAG=${IMAGE_TAG:-latest}
RASPBERRY_IP=${RASPBERRY_IP:-192.168.1.100}
RASPBERRY_USER=${RASPBERRY_USER:-pi}
RASPBERRY_SSH_PORT=${RASPBERRY_SSH_PORT:-22}
RASPBERRY_DOCKER_PORT=${RASPBERRY_DOCKER_PORT:-8080}

FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
TAR_FILE="${IMAGE_NAME}-${IMAGE_TAG}.tar"

echo "Image: $FULL_IMAGE_NAME"
echo "Raspberry Pi: ${RASPBERRY_USER}@${RASPBERRY_IP}:${RASPBERRY_SSH_PORT}"
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
scp -P "$RASPBERRY_SSH_PORT" "$TAR_FILE" "${RASPBERRY_USER}@${RASPBERRY_IP}:/tmp/"

# Étape 4: Charger et démarrer sur la Raspberry Pi
echo ""
echo "=== Déploiement sur Raspberry Pi ==="
ssh -p "$RASPBERRY_SSH_PORT" "${RASPBERRY_USER}@${RASPBERRY_IP}" << EOF
    echo "Chargement de l'image Docker..."
    docker load < /tmp/${TAR_FILE}
    
    echo "Arrêt du container existant..."
    docker stop ${IMAGE_NAME} 2>/dev/null || true
    docker rm ${IMAGE_NAME} 2>/dev/null || true
    
    echo "Démarrage du nouveau container..."
    docker run -d \
        --name ${IMAGE_NAME} \
        -p ${RASPBERRY_DOCKER_PORT}:80 \
        --restart unless-stopped \
        ${FULL_IMAGE_NAME}
    
    echo "Nettoyage..."
    rm /tmp/${TAR_FILE}
    
    echo "Container démarré avec succès!"
    echo "Accès: http://${RASPBERRY_IP}:${RASPBERRY_DOCKER_PORT}"
EOF

# Étape 5: Nettoyage local
echo ""
echo "=== Nettoyage local ==="
rm "$TAR_FILE"

echo ""
echo "=== Déploiement terminé avec succès! ==="
echo "Application disponible sur: http://${RASPBERRY_IP}:${RASPBERRY_DOCKER_PORT}"
