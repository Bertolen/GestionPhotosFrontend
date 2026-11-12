#!/usr/bin/env bash
#
# Wizard d'installation du runner CI GestionPhotos sur la Raspberry Pi.
#
# À exécuter SUR LA PI, en SSH, par le propriétaire (issue #1) :
#   ssh pi@nuestra-traviesa
#   git clone https://gitlab.com/nuestra-traviesa/GestionPhotosFrontend.git
#   cd GestionPhotosFrontend && sudo bash scripts/setup-pi-runner.sh
#
# Chaque étape vérifie ses prérequis avant de continuer et échoue avec un
# message actionnable. Le wizard n'installe QUE le runner de déploiement :
# les builds et tests tournent sur les runners partagés GitLab.com, la Pi
# n'exécute que le job « deploy » (pull d'image + compose up + smoke test).

set -euo pipefail

PROJECT_WEB_URL="https://gitlab.com/nuestra-traviesa/GestionPhotosFrontend"
PROJECT_API_PATH="nuestra-traviesa%2FGestionPhotosFrontend"
RUNNER_TAG="rpi"
ENV_DIR="/home/pi/gestion-photos"
ENV_FILE="$ENV_DIR/.env"
API_BASE_URL_DEFAULT="http://nuestra-traviesa:8080"

info() { echo -e "\e[1;34m[INFO]\e[0m $*"; }
ok()   { echo -e "\e[1;32m[OK]\e[0m $*"; }
warn() { echo -e "\e[1;33m[ATTENTION]\e[0m $*"; }
fail() { echo -e "\e[1;31m[ERREUR]\e[0m $*" >&2; echo -e "\e[1;31mLe wizard s'est arrêté. Corrigez le problème ci-dessus puis relancez-le : il reprendra là où il en était.\e[0m" >&2; exit 1; }

confirm() {
    local reponse
    read -rp "$1 (o/N) : " reponse
    case "$reponse" in [oO]|[oO]ui*) return 0 ;; *) return 1 ;; esac
}

trap 'echo -e "\e[1;31m[ERREUR]\e[0m Échec inattendu — voir le message ci-dessus." >&2' ERR

echo "============================================================"
echo "  GestionPhotos — installation du runner CI sur la Pi"
echo "  (déploiement automatique au push sur master, issue #1)"
echo "============================================================"
echo

# --- Étape 1 : prérequis ---------------------------------------------------

info "Étape 1/8 : vérification des prérequis..."

[ "$(uname -m)" = "aarch64" ] || fail "L'OS doit être un Raspberry Pi OS 64 bits (aarch64). OS actuel : $(uname -m)."

command -v curl >/dev/null 2>&1 || fail "curl est manquant : sudo apt-get update && sudo apt-get install -y curl"

if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
else
    command -v sudo >/dev/null 2>&1 || fail "sudo est manquant : exécutez ce wizard en root ou installez sudo."
    SUDO="sudo"
fi

$SUDO docker info >/dev/null 2>&1 || fail "Docker ne répond pas. Installez-le : curl -fsSL https://get.docker.com | sh puis relancez."
ok "Docker est installé et répond."

$SUDO docker compose version >/dev/null 2>&1 || fail "Le plugin docker compose est manquant : sudo apt-get install -y docker-compose-plugin"
ok "Le plugin docker compose est présent."

# --- Étape 2 : conteneur existant sur le port 80 ----------------------------

info "Étape 2/8 : conteneur existant sur le port 80..."

EXISTING_ON_80="$($SUDO docker ps --filter "publish=80" --format '{{.Names}}|{{.Image}}' || true)"
if [ -n "$EXISTING_ON_80" ]; then
    while IFS='|' read -r name image; do
        if [ "$name" = "gestion-photos-frontend" ]; then
            if [ -n "$($SUDO docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$name" 2>/dev/null || true)" ]; then
                ok "Le frontend est déjà géré par docker compose."
            else
                info "Conteneur manuel « $name » détecté (démarré à la main)."
                info "Le job deploy de la CI le remplacera automatiquement au premier déploiement : rien à faire."
            fi
        else
            warn "Le conteneur « $name » ($image) occupe le port 80."
            warn "Le premier déploiement CI échouera s'il reste là (conflit de port)."
            if confirm "L'arrêter et le supprimer maintenant ?"; then
                $SUDO docker rm -f "$name"
                ok "Conteneur « $name » supprimé."
            else
                warn "Il faudra le retirer avant le premier déploiement CI."
            fi
        fi
    done <<< "$EXISTING_ON_80"
else
    ok "Aucun conteneur n'occupe le port 80."
fi

# --- Étape 3 : installation de gitlab-runner --------------------------------

info "Étape 3/8 : installation de gitlab-runner..."

if command -v gitlab-runner >/dev/null 2>&1; then
    ok "gitlab-runner est déjà installé : $(gitlab-runner --version 2>/dev/null | head -n1)"
else
    info "Ajout du dépôt officiel gitlab-runner..."
    curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | $SUDO bash \
        || fail "Impossible d'ajouter le dépôt gitlab-runner. Vérifiez la connexion internet."
    $SUDO apt-get install -y gitlab-runner \
        || fail "Échec de l'installation du paquet gitlab-runner."
    ok "gitlab-runner installé : $(gitlab-runner --version 2>/dev/null | head -n1)"
fi

$SUDO systemctl enable --now gitlab-runner >/dev/null 2>&1 || true
$SUDO systemctl is-active gitlab-runner >/dev/null || fail "Le service gitlab-runner n'est pas actif : sudo systemctl status gitlab-runner"
ok "Le service gitlab-runner est actif."

# --- Étape 4 : création du runner dans l'interface GitLab -------------------

info "Étape 4/8 : création du runner dans l'interface GitLab (nécessite le propriétaire)."
echo
echo "  1. Ouvrez : $PROJECT_WEB_URL/-/settings/ci_cd (Settings > CI/CD > Runners)"
echo "  2. Cliquez sur « New project runner »."
echo "  3. Description : gestion-photos-pi"
echo "  4. Tags : $RUNNER_TAG   <-- IMPORTANT : le job deploy est taggé « $RUNNER_TAG »"
echo "  5. Ne cochez PAS « Protected » (la branche master n'est pas protégée)"
echo "  6. Ne cochez PAS « Run untagged jobs »"
echo "  7. Créez le runner puis copiez le token affiché (il commence par glrt-)."
echo
read -rsp "Collez le token du runner ici (entrée cachée) : " RUNNER_TOKEN
echo
[ -n "$RUNNER_TOKEN" ] || fail "Token vide. Créez le runner dans l'interface puis relancez le wizard."

# --- Étape 5 : enregistrement du runner --------------------------------------

info "Étape 5/8 : enregistrement du runner..."

if $SUDO gitlab-runner list 2>/dev/null | grep -q "gestion-photos-pi\|Executor.*shell"; then
    warn "Un runner est déjà enregistré dans la configuration locale."
    confirm "Le réenregistrer avec le nouveau token ?" || { info "Enregistrement existant conservé."; }
fi

$SUDO gitlab-runner register --non-interactive \
    --url "https://gitlab.com" \
    --token "$RUNNER_TOKEN" \
    --executor shell \
    || fail "Enregistrement échoué. Vérifiez le token (un runner ne peut être enregistré qu'une fois) et la connexion à gitlab.com."

$SUDO gitlab-runner verify >/dev/null 2>&1 \
    || fail "Le runner ne parvient pas à contacter GitLab : sudo gitlab-runner verify pour le détail."
ok "Le runner est enregistré et contacte GitLab."

# --- Étape 6 : concurrence limitée à 1 ---------------------------------------

info "Étape 6/8 : limitation de la concurrence à 1 job..."

CONFIG_FILE="/etc/gitlab-runner/config.toml"
if $SUDO grep -q '^concurrent' "$CONFIG_FILE"; then
    $SUDO sed -i 's/^concurrent = .*/concurrent = 1/' "$CONFIG_FILE"
else
    $SUDO sed -i '1i concurrent = 1' "$CONFIG_FILE"
fi
$SUDO systemctl restart gitlab-runner
$SUDO grep -q '^concurrent = 1' "$CONFIG_FILE" || fail "Impossible de fixer concurrent = 1 dans $CONFIG_FILE"
ok "Le runner traitera un job à la fois."

# --- Étape 7 : utilisateur du runner + groupe docker + .env ------------------

info "Étape 7/8 : accès Docker et fichier .env..."

RUNNER_USER="$($SUDO systemctl show gitlab-runner -p User --value)"
if [ -z "$RUNNER_USER" ] || [ "$RUNNER_USER" = "root" ]; then
    info "Le service gitlab-runner tourne en root : accès Docker direct, aucun groupe à ajouter."
else
    if ! $SUDO id -nG "$RUNNER_USER" | grep -qw docker; then
        $SUDO usermod -aG docker "$RUNNER_USER"
        $SUDO systemctl restart gitlab-runner
        ok "Utilisateur « $RUNNER_USER » ajouté au groupe docker."
    else
        ok "L'utilisateur « $RUNNER_USER » est déjà dans le groupe docker."
    fi
fi

echo
info "Le job deploy lit la configuration du frontend dans : $ENV_FILE"
read -rp "URL du backend Spring Boot (Entrée = $API_BASE_URL_DEFAULT) : " API_BASE_URL
API_BASE_URL="${API_BASE_URL:-$API_BASE_URL_DEFAULT}"

$SUDO mkdir -p "$ENV_DIR"
printf 'API_BASE_URL=%s\n' "$API_BASE_URL" | $SUDO tee "$ENV_FILE" >/dev/null
$SUDO chmod 644 "$ENV_FILE"
grep -q "^API_BASE_URL=" "$ENV_FILE" || fail "Le fichier $ENV_FILE n'a pas pu être créé."
ok "Fichier $ENV_FILE créé (API_BASE_URL=$API_BASE_URL)."

# --- Étape 8 : merge check + test de bout en bout ----------------------------

info "Étape 8/8 : merge check « Pipelines must succeed » et test de bout en bout..."
echo
info "Le merge check empêche de merger une MR dont la pipeline est rouge (gouvernance de l'issue #1)."
read -rp "Collez un Personal Access Token GitLab avec le scope « api » pour que je l'active via l'API (vide = activation manuelle) : " GITLAB_PAT

if [ -n "$GITLAB_PAT" ]; then
    HTTP_CODE="$(curl -sS -o /tmp/gitlab-merge-check.json -w "%{http_code}" -X PUT \
        -H "PRIVATE-TOKEN: $GITLAB_PAT" \
        "https://gitlab.com/api/v4/projects/$PROJECT_API_PATH?only_allow_merge_if_pipeline_succeeds=true" \
        || echo 000)"
    if [ "$HTTP_CODE" = "200" ]; then
        ok "Merge check « Pipelines must succeed » activé via l'API."
    else
        warn "L'API a répondu HTTP $HTTP_CODE : $(head -c 300 /tmp/gitlab-merge-check.json 2>/dev/null || true)"
        warn "Vérifiez que le token a bien le scope « api » et appartient au propriétaire du projet."
        confirm "Continuer quand même (vous l'activerez dans l'UI) ?" || fail "Merge check non activé."
    fi
else
    echo
    echo "  Activez-le manuellement :"
    echo "  1. $PROJECT_WEB_URL/-/settings/merge_requests (Settings > Merge requests)"
    echo "  2. « Merge checks » : cochez « Pipelines must succeed »"
    echo "  3. « Save changes »"
    echo
    confirm "C'est fait ?" || warn "Le merge check reste désactivé — une MR rouge pourra être mergée tant qu'il ne l'est pas."
fi

echo
echo "------------------------------------------------------------"
echo "  Test de bout en bout"
echo "------------------------------------------------------------"
info "Déclenchez maintenant la première pipeline :"
echo "  - soit depuis votre PC : git push gitlab master"
echo "  - soit dans GitLab : Build > Pipelines > Run pipeline (branche master)"
echo
read -rp "Appuyez sur Entrée quand la pipeline est lancée..."

info "Attente du premier déploiement CI (le job deploy peut rester en attente quelques secondes le temps que le runner le prenne)..."

DEPLOYED=""
for i in $(seq 1 120); do
    if $SUDO docker inspect gestion-photos-frontend >/dev/null 2>&1; then
        IMAGE="$($SUDO docker inspect -f '{{.Config.Image}}' gestion-photos-frontend 2>/dev/null || true)"
        case "$IMAGE" in
            registry.gitlab.com*) DEPLOYED=1; break ;;
        esac
    fi
    sleep 10
done

if [ -z "$DEPLOYED" ]; then
    warn "Le conteneur compose n'est pas encore apparu après 20 minutes."
    warn "Vérifiez la pipeline : $PROJECT_WEB_URL/-/pipelines  (le job deploy doit être vert)"
    fail "Test de bout en bout interrompu : relancez le wizard après correction."
fi
ok "Le conteneur compose tourne avec l'image du registry : $($SUDO docker inspect -f '{{.Config.Image}}' gestion-photos-frontend)"

sleep 3
if curl -fsS --max-time 10 http://localhost/ 2>/dev/null | grep -qi '<app-root'; then
    ok "Le port 80 sert bien l'index Angular."
else
    fail "Le conteneur est lancé mais ne sert pas l'index Angular : docker logs gestion-photos-frontend"
fi

if curl -fsS --max-time 10 http://localhost/runtime-config.js 2>/dev/null | grep -q "$API_BASE_URL"; then
    ok "runtime-config.js expose bien apiBaseUrl=$API_BASE_URL."
else
    warn "runtime-config.js n'expose pas l'URL attendue :"
    curl -fsS --max-time 10 http://localhost/runtime-config.js 2>/dev/null || true
    warn "Vérifiez le contenu de $ENV_FILE et redéployez."
fi

echo
echo "============================================================"
echo "  Installation terminée : la chaîne CI/CD est vivante."
echo "============================================================"
echo
echo "  - Chaque push sur master déploie automatiquement sur la Pi."
echo "  - Suivi des déploiements : $PROJECT_WEB_URL/-/environments (environnement « production »)"
echo "  - Rollback (~2 min, sans rebuild) : environnement « production » > dernier déploiement sain > Rollback"
echo "  - Déploiement manuel de secours (GitLab indisponible) : scripts/deploy.sh ou deploy.ps1"
echo
