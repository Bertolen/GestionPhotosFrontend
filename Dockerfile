# Dockerfile pour Angular 19 Frontend - Optimisé pour Raspberry Pi 4 (ARM64)
# Utilisation: docker build -t gestion-photos-frontend --platform linux/arm64 .

# --- Stage 1: Build Angular App ---
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

# Copie des fichiers de dépendances
COPY package.json package-lock.json ./

# Le build Angular nécessite aussi les dépendances de développement (CLI et builder)
RUN npm ci

# Copie des fichiers source
COPY . .

# Build de l'application Angular en production
RUN npm run build -- --configuration production

# --- Stage 2: Serveur Nginx ---
FROM nginx:alpine

# Copie de la configuration Nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Suppression du contenu par défaut de Nginx
RUN rm -rf /usr/share/nginx/html/*

# Angular application builder places browser assets in a nested browser directory
COPY --from=builder /app/dist/gestion-photos-frontend/browser /usr/share/nginx/html

# Exposition du port 80
EXPOSE 80

# Démarrage de Nginx
CMD ["nginx", "-g", "daemon off;"]
