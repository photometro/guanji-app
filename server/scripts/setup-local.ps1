param(
    [string]$JavaHome = 'C:\Users\43124\Android\jdk-21',
    [string]$MavenVersion = '3.9.11'
)

$ErrorActionPreference = 'Stop'
$serverRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $serverRoot
$toolsRoot = Join-Path $env:LOCALAPPDATA 'Guanji\tools'
$mavenHome = Join-Path $toolsRoot "apache-maven-$MavenVersion"
$mavenCmd = Join-Path $mavenHome 'bin\mvn.cmd'
$envFile = Join-Path $serverRoot '.env.local'

if (-not (Test-Path (Join-Path $JavaHome 'bin\java.exe'))) {
    throw "JDK 21 not found: $JavaHome"
}

New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null

if (-not (Test-Path $mavenCmd)) {
    $archive = Join-Path $env:TEMP "apache-maven-$MavenVersion-bin.zip"
    $url = "https://archive.apache.org/dist/maven/maven-3/$MavenVersion/binaries/apache-maven-$MavenVersion-bin.zip"
    Write-Host "Downloading Maven $MavenVersion..."
    Invoke-WebRequest -Uri $url -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsRoot -Force
    Remove-Item -LiteralPath $archive -Force
}

if (-not (Test-Path $envFile)) {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    $password = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    @(
        'POSTGRES_DB=guanji_thesis'
        'POSTGRES_USER=guanji'
        "POSTGRES_PASSWORD=$password"
        'POSTGRES_PORT=5432'
    ) | Set-Content -LiteralPath $envFile -Encoding utf8
    Write-Host "Created local database configuration: $envFile"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI not found. Install and start Docker Desktop.'
}

Push-Location $serverRoot
try {
    docker compose --env-file .env.local -f compose.yaml up -d db
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL container failed to start.' }
    for ($i = 0; $i -lt 24; $i++) {
        $health = docker inspect --format '{{.State.Health.Status}}' guanji-thesis-postgres 2>$null
        if ($health -eq 'healthy') { break }
        Start-Sleep -Seconds 2
    }
    $health = docker inspect --format '{{.State.Health.Status}}' guanji-thesis-postgres 2>$null
    if ($health -ne 'healthy') { throw "PostgreSQL health check failed (status: $health)." }
}
finally {
    Pop-Location
}

Write-Host "JDK 21: $JavaHome"
Write-Host "Maven: $mavenHome"
Write-Host 'PostgreSQL: 127.0.0.1:5432/guanji_thesis'
Write-Host 'Environment ready. Run server/scripts/start-local.ps1 to start Spring Boot.'
