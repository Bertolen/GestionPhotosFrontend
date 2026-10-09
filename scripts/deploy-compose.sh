#!/bin/bash

# Script de déploiement alternatif utilisant docker-compose
# Usage: ./scripts/deploy-compose.sh

set -e

echo "=== Déploiement avec Docker Compose sur Raspberry Pi 4 ==="

# Chargement des variables d'environnement
if [ -f .env ]; then
    source .env
fi

# Variables par défaut
IMAGE_NAME=${IMAGE_NAME:-gestion-photos-frontend}
IMAGE_TAG=${IMAGE_TAG:-latest}
RASPBERRY_IP=${RASPBERRY_IP:-192.168.1.100}
RASPBERRY_USER=${RASPBERRY_USER:-pi}
RASPBERRY_SSH_PORT=${RASPBERRY_SSH_PORT:-22}
COMPOSE_FILE="docker-compose.yml"

echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Raspberry Pi: ${RASPBERRY_USER}@${RASPBERRY_IP}:${RASPBERRY_SSH_PORT}"

# Étape 1: Construire l'image pour ARM64
echo ""
echo "=== Construction de l'image Docker ==="
docker build --platform linux/arm64 -t "${IMAGE_NAME}:${IMAGE_TAG}" .

# Étape 2: Sauvegarder l'image et le docker-compose
echo ""
echo "=== Sauvegarde des fichiers ==="
docker save "${IMAGE_NAME}:${IMAGE_TAG}" > "${IMAGE_NAME}-${IMAGE_TAG}.tar"

# Étape 3: Transférer vers la Raspberry
echo ""
echo "=== Transfert vers Raspberry Pi ==="
scp -P "$RASPBERRY_SSH_PORT" "${IMAGE_NAME}-${IMAGE_TAG}.tar" "${COMPOSE_FILE}" "nginx.conf" "${RASPBERRY_USER}@${RASPBERRY_IP}:/tmp/"

# Étape 4: Déployer sur la Raspberry
echo ""
echo "=== Déploiement sur Raspberry Pi ==="
ssh -p "$RASPBERRY_SSH_PORT" "${RASPBERRY_USER}@${RASPBERRY_IP}" << EOF
    echo "Chargement de l'image Docker..."
    docker load < /tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar
    
    echo "Copie des fichiers de configuration..."
    cp /tmp/docker-compose.yml /tmp/nginx.conf .
    rm /tmp/docker-compose.yml /tmp/nginx.conf
    
    echo "Arrêt des services existants..."
    docker compose down 2>/dev/null || true
    
    echo "Démarrage avec Docker Compose..."
    API_BASE_URL="${API_BASE_URL:-http://localhost:8080}" docker compose -f docker-compose.yml up -d
    
    echo "Nettoyage..."
    rm /tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar
    
    echo "Déploiement terminé!"
EOF

# Étape 5: Nettoyage local
echo ""
echo "=== Nettoyage local ==="
rm "${IMAGE_NAME}-${IMAGE_TAG}.tar"

echo ""
echo "=== Déploiement terminé ==="
