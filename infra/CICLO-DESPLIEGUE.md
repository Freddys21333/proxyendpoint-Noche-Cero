# Publicar, retirar y volver a publicar

Para incluir los trabajos Monte Carlo P-04, seguir además
[P04-OPERACION.md](P04-OPERACION.md): requieren `enable_aws_jobs=true` explícito.
El procedimiento base de este documento los deja deshabilitados.

Ejecutar desde la raíz con PowerShell, Terraform >=1.10, AWS CLI, Node y el
entorno Python backend disponible. Iniciar sesión con `aws login` y comprobar
`aws sts get-caller-identity`. No guardar credenciales en archivos versionados.

## Publicar de nuevo

El bucket bootstrap existente se conserva; no volver a crearlo. Si se parte de
otra cuenta, seguir primero el bootstrap de README.md con nombre único.

```powershell
terraform -chdir=infra init -backend-config="bucket=zombie-management-tfstate-661614508387-us-east-2" -backend-config="key=staging/terraform.tfstate" -backend-config="region=us-east-2" -backend-config="encrypt=true" -backend-config="use_lockfile=true"
backend/.venv/Scripts/python.exe scripts/package_lambda.py
$package = (Resolve-Path .tools/build/backend.zip).Path
$commit = git rev-parse HEAD
terraform -chdir=infra plan "-var=backend_zip_path=$package" "-var=build_commit=$commit" -var="compare_reserved_concurrency=-1" -out="staging.tfplan"
# Revisar las altas/cambios y después aplicar exactamente ese plan.
terraform -chdir=infra apply staging.tfplan
$outputs = terraform -chdir=infra output -json | ConvertFrom-Json
$env:VITE_API_BASE_URL = $outputs.api_base_url.value
$env:VITE_BUILD_COMMIT = $commit
$env:VITE_SCHEMA_VERSION = '1.0'
Push-Location frontend
npm ci
npm run build
Pop-Location
backend/.venv/Scripts/python.exe scripts/deploy_amplify.py --app-id $outputs.amplify_app_id.value
node --experimental-strip-types scripts/verify_aws_base.mjs $outputs.api_base_url.value
$outputs.frontend_url.value
```

Ejecutar las pruebas del README antes de aplicar. Detenerse si cualquier comando
falla. Las URLs y el ID Amplify cambian al recrear recursos: usar siempre outputs
actuales, no copiar la URL histórica. Comprobar también el estado SUCCEED en
Amplify y el flujo en navegador. El ZIP de frontend se carga manualmente; no hay
pipeline automático GitHub. Los paquetes y planes quedan fuera de Git.

## Retirar la aplicación

```powershell
$package = (Resolve-Path .tools/build/backend.zip).Path
$commit = git rev-parse HEAD
terraform -chdir=infra plan -destroy "-var=backend_zip_path=$package" "-var=build_commit=$commit" -var="compare_reserved_concurrency=-1" -out="destroy.tfplan"
# Revisar que solo se eliminan recursos de la aplicación.
terraform -chdir=infra apply destroy.tfplan
terraform -chdir=infra state list
```

El último comando debe devolver lista vacía. Se eliminan Amplify (sitio y
despliegues), HTTP API, Lambdas, roles/políticas, logs y alarmas de este stack.
Los logs eliminados no se recuperan al republicar. Terraform conserva el código
y el estado remoto vacío. Para volver a publicar, repetir la primera sección.

## Recursos que se conservan

El bucket bootstrap privado/versionado y sus versiones históricas permanecen,
protegidos por `prevent_destroy`. Pueden generar un cargo pequeño de S3. El
Budget existente tampoco pertenece a este stack y permanece. Retirar el sitio
no elimina cargos ya incurridos. No ejecutar destroy del bootstrap ni borrar el
estado para retirar la aplicación: perdería su trazabilidad.

El perfil sigue limitado a N=200/T=20/R=30 y 3 000 000 arista-día-réplica;
los trabajos distribuidos P-04 siguen pendientes. Ver README.md de esta carpeta.
