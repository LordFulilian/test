param([string]$CreatorRoot = 'C:\ProgramData\cocos\editors\Creator\3.8.7', [switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $CreatorRoot 'CocosCreator.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "Cocos Creator 3.8.7 not found: $exe" }
$config = Get-Content -LiteralPath (Join-Path $projectRoot 'build-config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$outputName = $config.outputName
if ($outputName -notmatch '^[a-z0-9-]+$') { throw 'Unsafe output name' }
$stage = if ($config.s4Testing) { 's4' } elseif ($config.contentMaxChapter -eq 2) { 's3' } elseif ($config.contentMaxChapter -eq 1) { 's2' } else { 's1' }
$evidence = Join-Path $projectRoot ('evidence\' + $stage)
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$creatorArgs = '--project "' + $projectRoot + '" --build "configPath=' + (Join-Path $projectRoot 'build-config.json') + '"'
if (-not $VerifyOnly) {
    if ($stage -eq 's4') { node (Join-Path $PSScriptRoot 'prepare-s4.cjs'); if ($LASTEXITCODE -ne 0) { throw 'Invalid S4 fixture content' } }
    if ($stage -in @('s2','s3','s4')) { node (Join-Path $PSScriptRoot 'prepare-stage.cjs'); if ($LASTEXITCODE -ne 0) { throw 'Invalid stage configuration' } }
    $p = Start-Process -FilePath $exe -ArgumentList $creatorArgs -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput (Join-Path $evidence 'creator-build.stdout.log') -RedirectStandardError (Join-Path $evidence 'creator-build.stderr.log')
    # Creator 3.x CLI uses exit 36 for completed build tasks.
    if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 36) { throw "Cocos build failed with exit $($p.ExitCode). See evidence/$stage/creator-build.stdout.log" }
}
$stderr = Get-Content -LiteralPath (Join-Path $evidence 'creator-build.stderr.log') -Raw -Encoding UTF8
# The editor's optional extension-list refresh can fail independently of building.
# Recognize only that exact 502 request and retain its complete raw diagnostic.
$extensionDiagnostic = [regex]::Match($stderr, '(?ms)^AxiosError: Request failed with status code 502\r?\n.*?^}\r?\n')
if ($extensionDiagnostic.Success -and $extensionDiagnostic.Value.Contains('apiQueryExtensionList') -and $extensionDiagnostic.Value.Contains("baseURL: 'https://extension-manager.cocos.com'") -and $extensionDiagnostic.Value.Contains("url: '/module/list'")) {
    Write-Warning 'Creator extension-list refresh returned HTTP 502. Raw diagnostic preserved; this request is separate from the build task.'
    $stderr = $stderr.Replace($extensionDiagnostic.Value, '')
}
# A damaged user-wide window layout is reported during editor startup, separately
# from the builder. Preserve the raw log and surface this exact diagnostic.
$windowDiagnostic = 'SyntaxError: ' + (Join-Path $env:USERPROFILE '.CocosCreator\editor\window.json') + ': Unexpected end of JSON input'
if ($stderr.Contains($windowDiagnostic)) {
    Write-Warning "Creator could not restore its global window layout. Raw diagnostic preserved in evidence/$stage/creator-build.stderr.log."
    $stderr = $stderr.Replace($windowDiagnostic, '')
}
if ($stderr -match 'Error:|Missing class:|Script .*missing or invalid') { throw "Creator reported build errors. See evidence/$stage/creator-build.stderr.log" }
$stdout = Get-Content -LiteralPath (Join-Path $evidence 'creator-build.stdout.log') -Raw -Encoding UTF8
if ($stdout -notmatch ('build Task \(' + [regex]::Escape($outputName) + '\) Finished')) { throw 'Creator did not confirm completion of the configured build task.' }
if ($stdout -match 'Missing class:|Script .*missing or invalid| - error:') { throw "Creator reported asset or build errors. See evidence/$stage/creator-build.stdout.log" }
if ($stderr.Trim()) { Write-Warning "Creator emitted startup/configuration diagnostics; see evidence/$stage/creator-build.stderr.log." }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot ('build\' + $outputName + '\index.html')))) { throw 'Build did not produce the configured index.html' }
Write-Output ('Cocos build complete: build/' + $outputName + '/index.html')
