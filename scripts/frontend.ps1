# Usa Node/npm locales si están preparados; de otro modo usa npm del equipo.
$integrationRoot = Split-Path -Parent $PSScriptRoot
$integrationNode = Join-Path $integrationRoot '.tools/node/node.exe'
$integrationNpm = Join-Path $integrationRoot '.tools/node/node_modules/npm/bin/npm-cli.js'
$integrationOldPath = $env:PATH
$integrationExit = 1
Push-Location (Join-Path $integrationRoot 'frontend')
try {
    if ((Test-Path -LiteralPath $integrationNode) -and (Test-Path -LiteralPath $integrationNpm)) {
        $integrationBin = Join-Path $integrationRoot '.tools/node/node_modules/.bin'
        $env:PATH = "$(Split-Path -Parent $integrationNode);$integrationBin;$env:PATH"
        & $integrationNode $integrationNpm @args
    } else {
        & npm @args
    }
    $integrationExit = $LASTEXITCODE
} finally {
    $env:PATH = $integrationOldPath
    Pop-Location
}
exit $integrationExit
