# Checkov usa un entorno aislado para no alterar dependencias del motor.
$checkovPython = Join-Path $PSScriptRoot '../.tools/checkov-env/Scripts/python.exe'
$checkovEntry = Join-Path $PSScriptRoot '../.tools/checkov-env/Scripts/checkov'
if (-not (Test-Path -LiteralPath $checkovPython)) {
    throw 'Instala Checkov siguiendo backend/README.md antes de ejecutar este script.'
}
& $checkovPython $checkovEntry @args
exit $LASTEXITCODE
