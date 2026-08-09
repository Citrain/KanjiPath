#Requires -Version 5.1
# Script de lancement KanjiPath
# Verifie les outils, demarre MariaDB, cree/migre les bases, puis lance le dev.
# Utilisation :
#   .\dev.ps1              -> setup complet + lancement des serveurs
#   .\dev.ps1 -SetupOnly   -> setup complet (sans lancer les serveurs)
#   .\dev.ps1 -Voice       -> ajoute Ollama et le STT local avant le web/API
#   .\dev.ps1 -Voice -VoicevoxPath "C:\...\VOICEVOX.exe" -> démarre aussi VOICEVOX

param(
  [switch]$SetupOnly,
  [switch]$Voice,
  [string]$VoicevoxPath
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Step([string]$msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok([string]$msg)    { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Info([string]$msg)  { Write-Host "    $msg" -ForegroundColor DarkGray }
function Warn([string]$msg)  { Write-Host "    [!] $msg" -ForegroundColor Yellow }
function Fail([string]$msg)  { Write-Host "    [x] $msg" -ForegroundColor Red; exit 1 }

function Get-EnvValue([string]$name, [string]$fallback) {
  $processValue = [Environment]::GetEnvironmentVariable($name, 'Process')
  if ($processValue) { return $processValue }
  $pattern = '(?m)^\s*' + [regex]::Escape($name) + '\s*=\s*"?([^\r\n"]+)"?\s*$'
  $match = [regex]::Match($envText, $pattern)
  if ($match.Success) { return $match.Groups[1].Value.Trim() }
  return $fallback
}

function Test-LoopbackPort([int]$port) {
  return $null -ne (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-LoopbackPort([int]$port, [string]$service, [int]$timeoutSeconds = 30) {
  for ($attempt = 0; $attempt -lt $timeoutSeconds; $attempt += 1) {
    if (Test-LoopbackPort $port) { return }
    Start-Sleep -Seconds 1
  }
  Fail "$service ne demarre pas sur 127.0.0.1:$port. Consultez sa fenetre de logs."
}

# ---------------------------------------------------------------------------
Step "1/7 Verification des outils"
# ---------------------------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js introuvable. Installez Node.js 24 LTS." }
Ok ("node " + (node --version))

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Warn "pnpm introuvable, installation globale..."
  npm install -g pnpm | Out-Null
}
Ok ("pnpm " + (pnpm --version))

# Client mysql / mariadb
$mysqlExe = $null
$searchPatterns = @(
  'C:\Program Files\MariaDB *\bin\mysql.exe',
  'C:\Program Files (x86)\MariaDB *\bin\mysql.exe',
  'C:\Program Files\MySQL *\bin\mysql.exe'
)
foreach ($pattern in $searchPatterns) {
  $found = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $mysqlExe = $found.FullName; break }
}
if (-not $mysqlExe) {
  $inPath = Get-Command mysql -ErrorAction SilentlyContinue
  if ($inPath) { $mysqlExe = $inPath.Source }
}
if (-not $mysqlExe) { Fail "Client mysql.exe introuvable. Installez MariaDB ou ajoutez-le au PATH." }
Ok "mysql.exe trouve : $mysqlExe"

# ---------------------------------------------------------------------------
Step "2/7 Lecture de la configuration (.env)"
# ---------------------------------------------------------------------------
if (-not (Test-Path '.env')) {
  if (Test-Path '.env.example') {
    Copy-Item '.env.example' '.env'
    Warn ".env cree depuis .env.example - mettez a jour le mot de passe MariaDB si besoin."
  } else {
    Fail ".env et .env.example introuvables."
  }
}

$envText = Get-Content '.env' -Raw
$dbUser = 'root'; $dbPass = ''; $dbHost = 'localhost'; $dbPort = '3306'
if ($envText -match 'DATABASE_URL\s*=\s*"?mysql://([^:@"]+):?([^@"]*)@([^:/"]+):?(\d+)?/') {
  $dbUser = $Matches[1]
  if ($Matches[2]) { $dbPass = $Matches[2] }
  $dbHost = $Matches[3]
  if ($Matches[4]) { $dbPort = $Matches[4] }
  Ok "DATABASE_URL parsee (user=$dbUser, host=$dbHost, port=$dbPort)"
} else {
  Warn "Impossible de parser DATABASE_URL, utilisation de root@localhost:3306."
}

if ($Voice) {
  # -------------------------------------------------------------------------
  Step "Services vocaux locaux (option -Voice)"
  # -------------------------------------------------------------------------
  $env:LOCAL_AI_ENABLED = 'true'
  # The STT process is started separately, so explicitly forward its .env settings.
  $env:STT_MODEL = Get-EnvValue 'STT_MODEL' 'large-v3-turbo'
  $env:STT_DEVICE = Get-EnvValue 'STT_DEVICE' 'cpu'
  $env:STT_COMPUTE_TYPE = Get-EnvValue 'STT_COMPUTE_TYPE' 'int8'
  $sttPython = Join-Path $PSScriptRoot 'services\stt\.venv\Scripts\python.exe'
  if (-not (Test-Path $sttPython)) {
    $pythonCandidates = @(
      (Get-Command python -ErrorAction SilentlyContinue | ForEach-Object Source),
      (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe')
    ) | Where-Object { $_ -and (Test-Path $_) }
    $bootstrapPython = $pythonCandidates | Select-Object -First 1
    if (-not $bootstrapPython) {
      Fail "Python 3.12 est requis pour le STT. Installez-le puis relancez avec -Voice."
    }
    Info "Creation de l'environnement STT..."
    & $bootstrapPython -m venv 'services\stt\.venv'
    & $sttPython -m pip install --upgrade pip
    & $sttPython -m pip install -r 'services\stt\requirements.txt'
    Ok "Environnement STT installe."
  }

  if ($env:STT_DEVICE -eq 'cuda') {
    $sttNvidiaPath = Join-Path $PSScriptRoot 'services\stt\.venv\Lib\site-packages\nvidia'
    $sttCudaPaths = @(
      (Join-Path $sttNvidiaPath 'cublas\bin'),
      (Join-Path $sttNvidiaPath 'cudnn\bin'),
      (Join-Path $sttNvidiaPath 'cuda_runtime\bin'),
      (Join-Path $sttNvidiaPath 'cuda_nvrtc\bin')
    )
    if ($sttCudaPaths.Where({ -not (Test-Path $_) }).Count -gt 0) {
      Fail "Runtime CUDA STT absent : installez les wheels NVIDIA CUDA 12/cuDNN 9 dans le venv STT."
    }
    $env:PATH = "$(($sttCudaPaths + $env:PATH) -join ';')"
    $env:STT_CUDA_LIBRARY_PATH = $sttCudaPaths -join ';'
  }

  if (Test-LoopbackPort 8765) {
    Ok "STT deja disponible sur 127.0.0.1:8765."
  } else {
    Info "Demarrage du STT dans une fenetre separee..."
    Start-Process -FilePath $sttPython -ArgumentList @('-m', 'uvicorn', 'app:app', '--app-dir', 'services\stt', '--host', '127.0.0.1', '--port', '8765') -WorkingDirectory $PSScriptRoot
    Wait-LoopbackPort 8765 'STT' 300
    Ok "STT demarre sur 127.0.0.1:8765."
  }

  $ollamaCandidates = @(
    (Get-Command ollama -ErrorAction SilentlyContinue | ForEach-Object Source),
    (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }
  $ollamaExe = $ollamaCandidates | Select-Object -First 1
  if (-not $ollamaExe) { Fail "Ollama introuvable. Installez-le puis relancez avec -Voice." }
  if (Test-LoopbackPort 11434) {
    Ok "Ollama deja disponible sur 127.0.0.1:11434."
  } else {
    Info "Demarrage d'Ollama..."
    Start-Process -FilePath $ollamaExe -ArgumentList 'serve'
    Wait-LoopbackPort 11434 'Ollama'
    Ok "Ollama demarre sur 127.0.0.1:11434."
  }
  $ollamaModel = Get-EnvValue 'OLLAMA_MODEL' 'qwen3.5:9b-q8_0'
  $ollamaModels = @((Invoke-RestMethod 'http://127.0.0.1:11434/api/tags').models | ForEach-Object name)
  if ($ollamaModels -notcontains $ollamaModel) {
    $installedFallback = 'qwen3:14b'
    if ($ollamaModels -contains $installedFallback) {
      Warn "Modele configure '$ollamaModel' introuvable; utilisation de '$installedFallback'."
      $ollamaModel = $installedFallback
      $env:OLLAMA_MODEL = $ollamaModel
    } else {
      Info "Telechargement du modele $ollamaModel..."
      & $ollamaExe pull $ollamaModel
    }
  }
  Ok "Modele Ollama disponible : $ollamaModel"

  if (-not $VoicevoxPath) {
    $wingetVoicevox = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'VOICEVOX' } | Select-Object -First 1
    if ($wingetVoicevox.InstallLocation) {
      $detectedVoicevoxPath = Join-Path $wingetVoicevox.InstallLocation 'VOICEVOX\VOICEVOX.exe'
      if (Test-Path $detectedVoicevoxPath) {
        $VoicevoxPath = $detectedVoicevoxPath
        Info "VOICEVOX detecte via Winget."
      }
    }
  }
  if (Test-LoopbackPort 50021) {
    Ok "VOICEVOX deja disponible sur 127.0.0.1:50021."
  } elseif ($VoicevoxPath) {
    if (-not (Test-Path $VoicevoxPath)) { Fail "VOICEVOX introuvable : $VoicevoxPath" }
    Info "Demarrage de VOICEVOX..."
    Start-Process -FilePath $VoicevoxPath
    Wait-LoopbackPort 50021 'VOICEVOX'
    Ok "VOICEVOX demarre sur 127.0.0.1:50021."
  } else {
    Warn "VOICEVOX n'est pas lance. Demarrez-le ou relancez avec -VoicevoxPath pour activer l'audio japonais."
  }
}

function Invoke-MySql([string]$sql) {
  $args = @('-u', $dbUser, '-h', $dbHost, '-P', $dbPort, '-e', $sql)
  if ($dbPass) { $args = @('-u', $dbUser, "-p$dbPass", '-h', $dbHost, '-P', $dbPort, '-e', $sql) }
  & $mysqlExe @args
}

# ---------------------------------------------------------------------------
Step "3/7 Demarrage du service MariaDB"
# ---------------------------------------------------------------------------
$svc = Get-Service -Name 'MariaDB' -ErrorAction SilentlyContinue
if (-not $svc) { $svc = Get-Service -Name 'MySQL' -ErrorAction SilentlyContinue }
if ($svc) {
  if ($svc.Status -eq 'Running') {
    Ok "Service '$($svc.Name)' deja en cours d'execution."
  } else {
    Info "Demarrage du service '$($svc.Name)'..."
    try {
      Start-Service -Name $svc.Name
      Start-Sleep -Seconds 3
      Ok "Service demarre."
    } catch {
      Fail "Impossible de demarrer le service '$($svc.Name)'. Lancez-le manuellement (peut requerir admin) puis re-executes."
    }
  }
} else {
  Warn "Aucun service MariaDB/MySQL detecte ; on suppose qu'il tourne deja."
}

# Test de connexion
try {
  $version = Invoke-MySql 'SELECT VERSION();' 2>&1
  Ok "Connexion MariaDB reussie ($($version | Select-Object -Last 1))"
} catch {
  Fail "Echec de connexion a MariaDB avec user=$dbUser. Verifiez le mot de passe dans .env."
}

# ---------------------------------------------------------------------------
Step "4/7 Creation des bases (si absentes)"
# ---------------------------------------------------------------------------
$createSql = @"
CREATE DATABASE IF NOT EXISTS kanjipath CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS kanjipath_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
"@
Invoke-MySql $createSql
Ok "Bases 'kanjipath' et 'kanjipath_test' presentes."

# ---------------------------------------------------------------------------
Step "5/7 Installation des dependances"
# ---------------------------------------------------------------------------
pnpm install
Ok "Dependances installees."

# ---------------------------------------------------------------------------
Step "6/7 Prisma : generation du client + migrations"
# ---------------------------------------------------------------------------
pnpm db:generate | Out-Null
Ok "Client Prisma genere."

# Migration base de dev (kanjipath) via le script (dotenv -> DATABASE_URL dev)
pnpm db:deploy
Ok "Migrations appliquees sur 'kanjipath'."

# Migration base de test (kanjipath_test)
$testUrl = "mysql://${dbUser}:$dbPass@${dbHost}:$dbPort/kanjipath_test"
$env:DATABASE_URL = $testUrl
pnpm --filter @kanjipath/api exec prisma migrate deploy | Out-Null
Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
Ok "Migrations appliquees sur 'kanjipath_test'."

# ---------------------------------------------------------------------------
Step "7/7 Lancement des serveurs de developpement"
# ---------------------------------------------------------------------------
if ($SetupOnly) {
  Write-Host ""
  Ok "Setup termine (-SetupOnly). Lancez 'pnpm dev' pour demarrer les serveurs."
  exit 0
}

Write-Host ""
Write-Host "    Web : http://localhost:5173" -ForegroundColor Magenta
Write-Host "    API : http://localhost:3001/api/v1/health" -ForegroundColor Magenta
Write-Host "    Arret : Ctrl+C" -ForegroundColor DarkGray
Write-Host ""
pnpm dev
