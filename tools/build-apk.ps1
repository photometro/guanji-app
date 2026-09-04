[CmdletBinding()]
param(
    [ValidateSet('debug', 'release')]
    [string] $Mode = 'debug',
    [switch] $Install,
    [switch] $SkipSync,
    [switch] $NoBuildCache,
    [switch] $NoDaemon,
    [switch] $Stacktrace
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$expectedRoot = 'C:\Users\43124\Desktop\test\guanji-app'
$debugDir = Join-Path $projectRoot 'debug'
$buildStarted = Get-Date
$buildStamp = $buildStarted.ToString('yyyyMMdd-HHmmss')
$logPath = Join-Path $debugDir ("apk-build-{0}.log" -f $buildStamp)
$summaryPath = Join-Path $debugDir 'apk-build-summary.json'
$lockPath = Join-Path $debugDir '.apk-build.lock'
$lockStream = $null
$tempDeviceApk = $null
$currentStage = 'preflight'
$stageStarted = $buildStarted
$stageDurations = [ordered]@{}
$exitCode = 0
$failure = $null
$device = [ordered]@{
    requested = [bool]$Install
    serial = $null
    status = if ($Install) { 'not_checked' } else { 'not_requested' }
    package = $null
    installedVersion = $null
    installedSignature = $null
    apkSignature = $null
    install = if ($Install) { 'not_started' } else { 'not_requested' }
    error = $null
}
$summary = [ordered]@{
    status = 'running'
    mode = $Mode
    package = $null
    variantTask = $null
    versionName = $null
    versionCode = $null
    apkPath = $null
    apkSizeBytes = $null
    apkLastWriteTime = $null
    sha256 = $null
    apkSignature = $null
    apkReused = $false
    projectRoot = $projectRoot
    buildStartedAt = $buildStarted.ToString('o')
    buildFinishedAt = $null
    stages = [ordered]@{}
    device = $device
    error = $null
}

function Write-Log {
    param([Parameter(Mandatory = $true)][string] $Message)
    $line = "[{0}] {1}" -f (Get-Date).ToString('HH:mm:ss'), $Message
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Set-BuildStage {
    param([Parameter(Mandatory = $true)][string] $Name)
    $now = Get-Date
    if ($script:stageStarted) {
        $script:stageDurations[$script:currentStage] = [math]::Round(($now - $script:stageStarted).TotalSeconds, 3)
    }
    $script:currentStage = $Name
    $script:stageStarted = $now
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string] $Name,
        [Parameter(Mandatory = $true)][string] $Executable,
        [Parameter(Mandatory = $true)][string[]] $Arguments
    )
    Write-Log ("[{0}] {1} {2}" -f $Name, $Executable, ($Arguments -join ' '))
    $captured = @()
    $previousErrorAction = $ErrorActionPreference
    try {
        # 原生程序经常把正常诊断信息（例如 JAVA_TOOL_OPTIONS）写到 stderr。
        # 在 Stop 模式下 PowerShell 会将其升级为异常，因此仅对该调用暂时放宽。
        $ErrorActionPreference = 'Continue'
        & $Executable @Arguments 2>&1 | ForEach-Object {
            $text = $_.ToString()
            $captured += $text
            Add-Content -LiteralPath $logPath -Value $text -Encoding UTF8
            Write-Host $text
        }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
    $script:lastExternalOutput = ($captured -join "`n")
    if ($code -ne 0) {
        throw "[$Name] exited with code $code"
    }
}

function Invoke-Captured {
    param(
        [Parameter(Mandatory = $true)][string] $Name,
        [Parameter(Mandatory = $true)][string] $Executable,
        [Parameter(Mandatory = $true)][string[]] $Arguments,
        [int[]] $AllowedExitCodes = @(0)
    )
    Write-Log ("[{0}] {1} {2}" -f $Name, $Executable, ($Arguments -join ' '))
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $lines = @(& $Executable @Arguments 2>&1 | ForEach-Object {
            $text = $_.ToString()
            Add-Content -LiteralPath $logPath -Value $text -Encoding UTF8
            Write-Host $text
            $text
        })
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($AllowedExitCodes -notcontains $code) {
        throw "[$Name] exited with code $code"
    }
    return ($lines -join "`n")
}

function Test-WriteProbe {
    param([Parameter(Mandatory = $true)][string] $Directory)
    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }
    $probe = Join-Path $Directory (".guanji-build-probe-{0}.tmp" -f $PID)
    [System.IO.File]::WriteAllText($probe, 'guanji-build-probe')
    $readback = [System.IO.File]::ReadAllText($probe)
    Remove-Item -LiteralPath $probe -Force
    if ($readback -ne 'guanji-build-probe') {
        throw "write probe failed: $Directory"
    }
}

function Normalize-Digest {
    param([AllowNull()][string] $Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    return (($Value -replace '[^0-9A-Fa-f]', '').ToUpperInvariant())
}

function Get-Sha256Digest {
    param([Parameter(Mandatory = $true)][string] $Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $stream = $null
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        return ([BitConverter]::ToString($sha.ComputeHash($stream)) -replace '-', '').ToUpperInvariant()
    } finally {
        if ($stream) { $stream.Dispose() }
        $sha.Dispose()
    }
}

function Read-ApkMetadata {
    param([Parameter(Mandatory = $true)][string] $Apk)
    $text = Invoke-Captured -Name 'aapt-badging' -Executable $script:aaptPath -Arguments @('dump', 'badging', $Apk)
    $packageMatch = [regex]::Match($text, "package: name='([^']+)' versionCode='([^']+)' versionName='([^']*)'")
    if (-not $packageMatch.Success) { throw '无法从 APK badging 读取包名和版本' }
    $activityMatch = [regex]::Match($text, "launchable-activity: name='([^']+)'")
    return [ordered]@{
        package = $packageMatch.Groups[1].Value
        versionCode = [int]$packageMatch.Groups[2].Value
        versionName = $packageMatch.Groups[3].Value
        activity = if ($activityMatch.Success) { $activityMatch.Groups[1].Value } else { $null }
    }
}

function Read-ApkSignature {
    param([Parameter(Mandatory = $true)][string] $Apk)
    $text = Invoke-Captured -Name 'apksigner-cert' -Executable $script:apksignerPath -Arguments @('verify', '--print-certs', $Apk)
    $match = [regex]::Match($text, 'SHA-256 digest:\s*([0-9A-Fa-f:]+)')
    if (-not $match.Success) { throw '无法从 APK 读取签名指纹' }
    return Normalize-Digest $match.Groups[1].Value
}

function Assert-AssetsInSync {
    $pairs = @(
        @('www\index.html', 'android\app\src\main\assets\public\index.html'),
        @('www\js\app.js', 'android\app\src\main\assets\public\js\app.js'),
        @('www\js\ai.js', 'android\app\src\main\assets\public\js\ai.js')
    )
    foreach ($pair in $pairs) {
        $source = Join-Path $projectRoot $pair[0]
        $target = Join-Path $projectRoot $pair[1]
        if (-not (Test-Path -LiteralPath $source) -or -not (Test-Path -LiteralPath $target)) {
            throw "Capacitor assets 缺失：$($pair[0]) / $($pair[1])"
        }
        $sourceHash = Get-Sha256Digest $source
        $targetHash = Get-Sha256Digest $target
        if ($sourceHash -ne $targetHash) {
            throw "Capacitor assets 不一致：$($pair[0])"
        }
    }
}

try {
    New-Item -ItemType Directory -Path $debugDir -Force | Out-Null
    New-Item -ItemType File -Path $logPath -Force | Out-Null
    Write-Log "projectRoot=$projectRoot"
    if ($projectRoot -ne $expectedRoot) {
        throw "必须从实际项目根目录执行：$expectedRoot；当前为 $projectRoot"
    }

    # 固定 Android/Gradle 用户目录，避免使用第二份 debug.keystore。
    $env:ANDROID_HOME = 'C:\Users\43124\Android'
    $env:JAVA_HOME = 'C:\Users\43124\Android\jdk-21'
    $env:GRADLE_USER_HOME = 'C:\Users\43124\.gradle'
    $env:JAVA_TOOL_OPTIONS = '-Duser.home=C:\Users\43124'
    $env:ANDROID_USER_HOME = 'C:\Users\43124\.android'
    Remove-Item Env:ANDROID_PREFS_ROOT -ErrorAction SilentlyContinue

    $nodeCommand = Get-Command node -ErrorAction Stop
    $nodePath = $nodeCommand.Source
    $capPath = Join-Path $projectRoot 'node_modules\.bin\cap.cmd'
    $gradlePath = Join-Path $projectRoot 'android\gradlew.bat'
    $javaPath = Join-Path $env:JAVA_HOME 'bin\java.exe'
    $adbPath = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
    $wrapperJar = Join-Path $projectRoot 'android\gradle\wrapper\gradle-wrapper.jar'
    $script:aaptPath = (Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Recurse -Filter 'aapt.exe' | Sort-Object FullName | Select-Object -Last 1).FullName
    $script:apksignerPath = (Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Recurse -Filter 'apksigner.bat' | Sort-Object FullName | Select-Object -Last 1).FullName
    $required = @($nodePath, $capPath, $gradlePath, $javaPath, $adbPath, $wrapperJar, $script:aaptPath, $script:apksignerPath)
    foreach ($path in $required) {
        if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path)) {
            throw "构建依赖缺失：$path"
        }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'www') -PathType Container)) { throw 'www 目录缺失' }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'android') -PathType Container)) { throw 'android 目录缺失' }
    Write-Log "ANDROID_HOME=$env:ANDROID_HOME"
    Write-Log "JAVA_HOME=$env:JAVA_HOME"
    Write-Log "GRADLE_USER_HOME=$env:GRADLE_USER_HOME"
    Write-Log "JAVA_TOOL_OPTIONS=$env:JAVA_TOOL_OPTIONS"
    Write-Log "ANDROID_USER_HOME=$env:ANDROID_USER_HOME"
    Write-Log "node=$nodePath ($((& node --version).Trim()))"
    Write-Log "java=$javaPath"
    # Java 将版本信息写到 stderr；PowerShell 5.1 在 Stop 模式下会把它当成异常。
    # 临时允许该只读探针输出，再恢复严格错误策略，避免误判构建失败。
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $javaVersionLines = @(& $javaPath -version 2>&1)
        foreach ($javaVersionLine in $javaVersionLines) {
            Write-Log ([string]$javaVersionLine)
        }
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }

    if ($Mode -eq 'release') {
        foreach ($name in @('GUANJI_RELEASE_KEYSTORE', 'GUANJI_RELEASE_STORE_PASSWORD', 'GUANJI_RELEASE_KEY_ALIAS', 'GUANJI_RELEASE_KEY_PASSWORD')) {
            if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
                throw "release 模式缺少 $name；不会构建未签名或错误签名的正式包"
            }
        }
        if (-not (Test-Path -LiteralPath $env:GUANJI_RELEASE_KEYSTORE -PathType Leaf)) {
            throw "正式签名 keystore 不存在：$env:GUANJI_RELEASE_KEYSTORE"
        }
    }

    foreach ($probeDir in @(
        $env:GRADLE_USER_HOME,
        (Join-Path $projectRoot 'android\build'),
        (Join-Path $projectRoot 'android\app\build'),
        (Join-Path $projectRoot 'node_modules\@capacitor\android\build'),
        (Join-Path $projectRoot 'android\capacitor-cordova-android-plugins\build')
    )) { Test-WriteProbe $probeDir }

    $activeBuilds = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '^(java|gradle|gradlew)(\.exe|\.bat)?$' -and $_.CommandLine -and $_.CommandLine.Contains($projectRoot)
    })
    if ($activeBuilds.Count -gt 0) { throw '检测到同项目已有 Gradle/Java 构建进程，拒绝并行构建' }

    try {
        $lockStream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $lockBytes = [Text.Encoding]::UTF8.GetBytes("pid=$PID`nmode=$Mode`nstarted=$($buildStarted.ToString('o'))")
        $lockStream.Write($lockBytes, 0, $lockBytes.Length)
        $lockStream.Flush()
    } catch {
        throw "无法取得构建锁：$lockPath；可能已有构建在运行"
    }

    if (-not $SkipSync) {
        Set-BuildStage 'capacitor-sync'
        try {
            Invoke-External -Name 'cap-sync' -Executable $capPath -Arguments @('sync', 'android')
        } catch {
            $syncLog = Get-Content -LiteralPath $logPath -Raw -ErrorAction SilentlyContinue
            if ($syncLog -notmatch 'uv_os_get_passwd') { throw }
            Write-Log '检测到 uv_os_get_passwd ENOMEM，只进行一次本地 CLI shim 重试'
            $shim = "const os=require('os'); os.userInfo=()=>({shell:process.env.ComSpec}); process.argv=['node','capacitor','sync','android']; require('./node_modules/@capacitor/cli/bin/capacitor')"
            Invoke-External -Name 'cap-sync-shim' -Executable $nodePath -Arguments @('-e', $shim)
        }
    }
    Assert-AssetsInSync

    switch ($Mode) {
        'debug' {
            # 日常真机调试：正式包名 + 固定 Android Debug 签名，允许覆盖既有安装。
            $variantTask = ':app:assembleDebug'
            $apkPath = Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
        }
        'release' {
            $variantTask = ':app:assembleRelease'
            $apkPath = Join-Path $projectRoot 'android\app\build\outputs\apk\release\app-release.apk'
        }
    }
    $summary.variantTask = $variantTask
    Set-BuildStage 'gradle-build'
    $gradleArguments = @('-p', 'android', $variantTask, '--offline')
    if ($NoBuildCache) {
        Write-Log '本次构建显式禁用 Gradle build cache（用于清理受锁定/权限影响的派生产物）'
        $gradleArguments += '--no-build-cache'
    } else {
        $gradleArguments += '--build-cache'
    }
    if ($NoDaemon) {
        Write-Log '本次构建禁用 Gradle daemon（用于规避 Windows 派生产物锁定）'
        $gradleArguments += '--no-daemon'
    }
    if ($Stacktrace) {
        $gradleArguments += '--stacktrace'
    }
    Invoke-External -Name 'gradle' -Executable $gradlePath -Arguments $gradleArguments
    if (-not (Test-Path -LiteralPath $apkPath -PathType Leaf)) { throw "构建完成但 APK 不存在：$apkPath" }
    $apkInfo = Get-Item -LiteralPath $apkPath
    if ($apkInfo.LastWriteTime -lt $buildStarted) {
        # Gradle 在输入未变化时会安全地复用 UP-TO-DATE/FROM-CACHE 产物；
        # 只有构建没有明确复用时，才把旧 APK 视为风险并阻断。
        if ($script:lastExternalOutput -match '(?m)(UP-TO-DATE|FROM-CACHE)') {
            $summary.apkReused = $true
            Write-Log 'Gradle 报告产物为 UP-TO-DATE/FROM-CACHE，复用已校验的 APK'
        } else {
            throw 'APK 修改时间早于本次构建开始时间，且 Gradle 未报告可安全复用旧产物'
        }
    }
    $metadata = Read-ApkMetadata $apkPath
    $apkSignature = Read-ApkSignature $apkPath
    $summary.package = $metadata.package
    $summary.versionName = $metadata.versionName
    $summary.versionCode = $metadata.versionCode
    $summary.apkPath = $apkPath
    $summary.apkSizeBytes = $apkInfo.Length
    $summary.apkLastWriteTime = $apkInfo.LastWriteTime.ToString('o')
    $summary.sha256 = Get-Sha256Digest $apkPath
    $summary.apkSignature = $apkSignature
    $device.package = $metadata.package
    $device.apkSignature = $apkSignature

    if ($Install) {
        Set-BuildStage 'device-preflight'
        $deviceText = Invoke-Captured -Name 'adb-devices' -Executable $adbPath -Arguments @('devices')
        $online = @($deviceText -split "`r?`n" | Where-Object { $_ -match '\sdevice$' -and $_ -notmatch '^List of devices' })
        if ($online.Count -eq 0) { throw '未检测到在线 Android 设备' }
        $device.serial = (($online[0] -split '\s+')[0]).Trim()
        $device.status = 'online'
        # pm path 对未安装的包返回 1，这是可接受的首次安装场景。
        $installedPathText = Invoke-Captured -Name 'adb-pm-path' -Executable $adbPath -Arguments @('-s', $device.serial, 'shell', 'pm', 'path', $metadata.package) -AllowedExitCodes @(0, 1)
        $remoteApk = ''
        $remoteLines = @($installedPathText -split "`r?`n" | Where-Object { $_ -match '^package:' } | Select-Object -First 1)
        if ($remoteLines.Count -gt 0) {
            $remoteApk = (([string]$remoteLines[0]) -replace '^package:', '').Trim()
        }
        if (-not [string]::IsNullOrWhiteSpace($remoteApk)) {
            $installedDump = Invoke-Captured -Name 'adb-dumpsys-package' -Executable $adbPath -Arguments @('-s', $device.serial, 'shell', 'dumpsys', 'package', $metadata.package)
            $installedVersionMatch = [regex]::Match($installedDump, 'versionName=([^\s]+)')
            $device.installedVersion = if ($installedVersionMatch.Success) { $installedVersionMatch.Groups[1].Value } else { $null }
            $tempDeviceApk = Join-Path $debugDir ("device-{0}-{1}.apk" -f ($device.serial), $PID)
            Invoke-External -Name 'adb-pull-installed-apk' -Executable $adbPath -Arguments @('-s', $device.serial, 'pull', $remoteApk, $tempDeviceApk)
            $device.installedSignature = Read-ApkSignature $tempDeviceApk
            if ($device.installedSignature -ne $apkSignature) {
                $device.status = 'online_signature_mismatch'
                $device.install = 'blocked_signature_mismatch'
                throw "设备已安装包签名与 $Mode APK 不一致；禁止覆盖安装（installed=$($device.installedSignature), apk=$apkSignature）"
            }
        }
        Set-BuildStage 'device-install'
        Invoke-External -Name 'adb-install' -Executable $adbPath -Arguments @('-s', $device.serial, 'install', '-r', $apkPath)
        $device.install = 'passed'
        Set-BuildStage 'device-launch'
        Invoke-External -Name 'adb-launch' -Executable $adbPath -Arguments @('-s', $device.serial, 'shell', 'monkey', '-p', $metadata.package, '-c', 'android.intent.category.LAUNCHER', '1')
        $device.status = 'installed_and_launched'
    }
    $summary.status = 'passed'
} catch {
    $exitCode = 1
    $failure = $_.Exception.Message
    $summary.status = 'failed'
    $summary.error = $failure
    $device.error = $failure
    Write-Log "FAILED stage=$currentStage error=$failure"
} finally {
    if ($tempDeviceApk -and (Test-Path -LiteralPath $tempDeviceApk)) {
        Remove-Item -LiteralPath $tempDeviceApk -Force -ErrorAction SilentlyContinue
    }
    if ($lockStream) {
        $lockStream.Dispose()
    }
    if (Test-Path -LiteralPath $lockPath) {
        Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
    }
    $summary.buildFinishedAt = (Get-Date).ToString('o')
    $summary.stages = $stageDurations
    $summary.stages[$currentStage] = [math]::Round(((Get-Date) - $stageStarted).TotalSeconds, 3)
    $summary.stages.last = $currentStage
    $summary.totalDurationSeconds = [math]::Round(((Get-Date) - $buildStarted).TotalSeconds, 3)
    $summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
    Write-Log "summary=$summaryPath"
}

if ($exitCode -ne 0) {
    Write-Error $failure
    exit $exitCode
}
Write-Output ("APK build passed: {0}" -f $summary.apkPath)
