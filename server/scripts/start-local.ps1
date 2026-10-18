param([int]$Port = 8080)
$ErrorActionPreference = 'Stop'
$serverRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $serverRoot
$javaHome = $env:JAVA_HOME
if ([string]::IsNullOrWhiteSpace($javaHome)) {
    throw 'Set JAVA_HOME to a JDK 21 installation before running this script.'
}
$mavenVersion = '3.9.11'
$mavenHome = Join-Path $env:LOCALAPPDATA "Guanji\tools\apache-maven-$mavenVersion"
$mavenCmd = Join-Path $mavenHome 'bin\mvn.cmd'

& (Join-Path $PSScriptRoot 'setup-local.ps1') -JavaHome $javaHome -MavenVersion $mavenVersion
if (-not (Test-Path $mavenCmd)) { throw "Maven not found: $mavenCmd" }

$envFile = Join-Path $serverRoot '.env.local'
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
    }
}
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$mavenHome\bin;$env:Path"
$env:GUANJI_SERVER_PORT = $Port
if (-not $env:GUANJI_DB_URL) { $env:GUANJI_DB_URL = "jdbc:postgresql://localhost:$($env:POSTGRES_PORT)/$($env:POSTGRES_DB)" }
if (-not $env:GUANJI_DB_USER) { $env:GUANJI_DB_USER = $env:POSTGRES_USER }
if (-not $env:GUANJI_DB_PASSWORD) { $env:GUANJI_DB_PASSWORD = $env:POSTGRES_PASSWORD }
Write-Host "Starting Guanji thesis backend on 0.0.0.0:$Port (LAN only demo)"
Push-Location $serverRoot
try { & $mavenCmd spring-boot:run } finally { Pop-Location }
