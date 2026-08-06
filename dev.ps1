#Requires -Version 5.1
# Script de lancement KanjiPath
# Verifie les outils, demarre MariaDB, cree/migre les bases, puis lance le dev.
# Utilisation :
#   .\dev.ps1              -> setup complet + lancement des serveurs
#   .\dev.ps1 -SetupOnly   -> setup complet (sans lancer les serveurs)

param(
  [switch]$SetupOnly
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Step([string]$msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok([string]$msg)    { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Info([string]$msg)  { Write-Host "    $msg" -ForegroundColor DarkGray }
function Warn([string]$msg)  { Write-Host "    [!] $msg" -ForegroundColor Yellow }
function Fail([string]$msg)  { Write-Host "    [x] $msg" -ForegroundColor Red; exit 1 }

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
