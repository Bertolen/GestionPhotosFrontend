<#
.SYNOPSIS
    Script de déploiement Docker pour Raspberry Pi 4
.DESCRIPTION
    Construit l'image Docker pour ARM64, la transfère sur la Raspberry Pi et la déploye.
.EXAMPLE
    .\scripts\deploy.ps1
#>

param (
    [string]$ImageName = "gestion-photos-frontend",
    [string]$ImageTag = "latest",
    [string]$RaspberryIp = "192.168.1.100",
    [string]$RaspberryUser = "pi",
    [int]$RaspberrySshPort = 22,
    [int]$RaspberryDockerPort = 8080,
    [string]$ApiBaseUrl = "http://localhost:8080"
)

Write-Host "=== Déploiement de GestionPhotos Frontend sur Raspberry Pi 4 ===" -ForegroundColor Cyan

# Charger les variables d'environnement si .env existe
if (Test-Path ".env") {
    Write-Host "Chargement de la configuration depuis .env..." -ForegroundColor Gray
    $envContent = Get-Content ".env" -Raw
    $envVars = @{}
    $envContent -split "`n" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.+)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $envVars[$key] = $value
        }
    }
    
    if ($envVars.ContainsKey("IMAGE_NAME")) { $ImageName = $envVars["IMAGE_NAME"] }
    if ($envVars.ContainsKey("IMAGE_TAG")) { $ImageTag = $envVars["IMAGE_TAG"] }
    if ($envVars.ContainsKey("RASPBERRY_IP")) { $RaspberryIp = $envVars["RASPBERRY_IP"] }
    if ($envVars.ContainsKey("RASPBERRY_USER")) { $RaspberryUser = $envVars["RASPBERRY_USER"] }
    if ($envVars.ContainsKey("RASPBERRY_SSH_PORT")) { $RaspberrySshPort = [int]$envVars["RASPBERRY_SSH_PORT"] }
    if ($envVars.ContainsKey("RASPBERRY_DOCKER_PORT")) { $RaspberryDockerPort = [int]$envVars["RASPBERRY_DOCKER_PORT"] }
    if ($envVars.ContainsKey("API_BASE_URL")) { $ApiBaseUrl = $envVars["API_BASE_URL"] }
}

$FullImageName = "$ImageName`:$ImageTag"
$TarFile = "$ImageName`-$ImageTag.tar"

Write-Host "Image: $FullImageName" -ForegroundColor Yellow
Write-Host "Raspberry Pi: $RaspberryUser@$RaspberryIp`:$RaspberrySshPort" -ForegroundColor Yellow
Write-Host "Port de déploiement: $RaspberryDockerPort" -ForegroundColor Yellow

# Étape 1: Construire l'image pour ARM64
Write-Host "`n=== Construction de l'image Docker pour ARM64 ===" -ForegroundColor Green
try {
    docker build --platform linux/arm64 -t $FullImageName .
    if ($LASTEXITCODE -ne 0) {
        throw "Build Docker échoué"
    }
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Étape 2: Sauvegarder l'image dans un fichier tar
Write-Host "`n=== Sauvegarde de l'image ===" -ForegroundColor Green
try {
    docker save $FullImageName | Out-File -FilePath $TarFile -Encoding byte
    if ($LASTEXITCODE -ne 0) {
        throw "Sauvegarde Docker échouée"
    }
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Étape 3: Transférer l'image vers la Raspberry Pi
Write-Host "`n=== Transfert vers Raspberry Pi ===" -ForegroundColor Green
try {
    # Utilisation de scp via WinSCP ou OpenSSH Windows
    if (Get-Command scp -ErrorAction SilentlyContinue) {
        scp -P $RaspberrySshPort $TarFile $RaspberryUser@$RaspberryIp`:/tmp/
    } elseif (Get-Command pscp -ErrorAction SilentlyContinue) {
        pscp -P $RaspberrySshPort -pw (Read-Host "Mot de passe SSH" -AsSecureString | ConvertFrom-SecureString) $TarFile $RaspberryUser@$RaspberryIp`:/tmp/
    } else {
        throw "SCP non trouvé. Installez OpenSSH Client (Windows Feature) ou WinSCP"
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "Transfert SCP échoué"
    }
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Vous pouvez copier manuellement le fichier $TarFile vers /tmp/ sur la Raspberry" -ForegroundColor Yellow
    Write-Host "Puis exécuter: ssh $RaspberryUser@$RaspberryIp `"docker load < /tmp/$TarFile && docker run -d -p $RaspberryDockerPort:80 -e API_BASE_URL=$ApiBaseUrl --name $ImageName $FullImageName`"" -ForegroundColor Yellow
    exit 1
}

# Étape 4: Charger et démarrer sur la Raspberry Pi
Write-Host "`n=== Déploiement sur Raspberry Pi ===" -ForegroundColor Green
try {
    $sshCommand = @"
    echo "Chargement de l'image Docker..."
    docker load < /tmp/$TarFile
    
    echo "Arrêt du container existant..."
    docker stop $ImageName 2>/dev/null || true
    docker rm $ImageName 2>/dev/null || true
    
    echo "Démarrage du nouveau container..."
    docker run -d `
        --name $ImageName `
        -p $RaspberryDockerPort:80 `
        -e API_BASE_URL='$ApiBaseUrl' `
        --restart unless-stopped `
        $FullImageName
    
    echo "Nettoyage..."
    rm /tmp/$TarFile
    
    echo "Container démarré avec succès!"
    echo "Accès: http://$RaspberryIp`:$RaspberryDockerPort"
"@
    
    # Utilisation de ssh
    if (Get-Command ssh -ErrorAction SilentlyContinue) {
        ssh -p $RaspberrySshPort $RaspberryUser@$RaspberryIp $sshCommand
    } elseif (Get-Command plink -ErrorAction SilentlyContinue) {
        plink -P $RaspberrySshPort $RaspberryUser@$RaspberryIp $sshCommand
    } else {
        throw "SSH non trouvé"
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "Déploiement SSH échoué"
    }
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Exécutez manuellement sur la Raspberry:" -ForegroundColor Yellow
    Write-Host "  docker load < /tmp/$TarFile" -ForegroundColor Yellow
    Write-Host "  docker stop $ImageName 2>/dev/null || true && docker rm $ImageName 2>/dev/null || true" -ForegroundColor Yellow
    Write-Host "  docker run -d --name $ImageName -p $RaspberryDockerPort:80 -e API_BASE_URL=$ApiBaseUrl --restart unless-stopped $FullImageName" -ForegroundColor Yellow
    exit 1
}

# Étape 5: Nettoyage local
Write-Host "`n=== Nettoyage local ===" -ForegroundColor Green
try {
    Remove-Item $TarFile -Force
} catch {
    Write-Host "Avertissement: Impossible de supprimer $TarFile" -ForegroundColor Yellow
}

Write-Host "`n=== Déploiement terminé avec succès! ===" -ForegroundColor Green
Write-Host "Application disponible sur: http://$RaspberryIp`:$RaspberryDockerPort" -ForegroundColor Cyan
