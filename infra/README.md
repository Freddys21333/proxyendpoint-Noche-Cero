# Infraestructura base

Región: `us-east-2`. Cinco funciones Python 3.12 x86_64 (health, config,
preview, compare e informe PDF), HTTP API y Amplify Hosting estático. Sin VPC,
NAT, servidores permanentes ni trabajos locales en producción. Los trabajos
distribuidos P-04 y los servicios de IA quedan para otra iteración.

La primera publicación usa una carga manual de Amplify: evita guardar tokens
GitHub en Terraform. La conexión automática del repositorio se configura después
de autorizar la aplicación GitHub. Terraform administra app y rama igualmente.

## Preparación

1. Iniciar sesión AWS, verificar identidad, región, cuotas y Budget.
2. Ejecutar las pruebas backend/frontend.
3. Ejecutar `backend/.venv/Scripts/python.exe scripts/package_lambda.py`.
   Descarga wheels Linux compatibles con Amazon Linux 2023; no copia el venv
   Windows. Docker no es obligatorio. La comprobación definitiva del runtime es
   el smoke desplegado; construir el ZIP por sí solo no la acredita.
4. Desde `infra/bootstrap`, ejecutar `terraform init`, `terraform plan` y
   `terraform apply` con `state_bucket_name` único. Conservar su estado local
   fuera de Git: permite administrar el bucket de estado que se protege contra
   destrucción. No ejecutar `destroy` del bootstrap.
5. Desde `infra`, inicializar con `-backend-config=bucket=...`,
   `-backend-config=key=staging/terraform.tfstate`,
   `-backend-config=region=us-east-2`, `-backend-config=encrypt=true` y
   `-backend-config=use_lockfile=true`.
6. Planificar con `backend_zip_path` absoluto, `build_commit` del código
   empaquetado y orígenes adicionales explícitos. Revisar el plan antes de apply.
   En cuentas con cuota Lambda 10, usar `compare_reserved_concurrency=-1`:
   la reserva requiere capacidad no reservada mínima que esta cuenta no tiene.
   API limita a 2 solicitudes/s, ráfaga 4; esto no es un tope de gasto.
7. Compilar frontend con `VITE_API_BASE_URL` del output, `VITE_BUILD_COMMIT`
   y `VITE_SCHEMA_VERSION=1.0`. Publicar ZIP con el contenido de `frontend/dist`
   en su raíz mediante CreateDeployment, carga firmada y StartDeployment.
8. Verificar health/config, preview/compare, gzip, CORS y PDF desde el dominio
   público. Registrar resultados reales y tiempos, sin declarar P-04 terminado.

El PDF acepta JSON o gzip (4 MiB comprimidos, 32 MiB descomprimidos). El cliente
envía gzip para respetar el límite de invocación Lambda. Conserva hashes y
validación del documento; no modifica el motor.

Los logs se retienen 7 días. Las alarmas Errors son visibles en CloudWatch,
sin destinatarios de correo configurados. El Budget no detiene gasto. El estado,
planes, credenciales y paquetes no se versionan. Las lockfiles sí.

## Retirada

Revisar `terraform plan -destroy` del stack de aplicación antes de destruirlo.
Conservar el bootstrap y su historial. Eliminar el sitio no borra cargos ya
incurridos ni convierte una alerta de Budget en límite de consumo.

## Perfil operativo de staging

Las mediciones iniciales del caso N=1000/T=90/R=30 agotaron 28 s en Lambda,
tanto con 2048 como con 3008 MB. La cuenta rechazó 4096 MB: máximo 3008.
Por ello el despliegue publica explícitamente defaults N=200/T=20/R=30
(`DEPLOYMENT_PROFILE=staging-bounded-v1`) y rechaza antes del motor cargas que
superen 3 000 000 arista-día-réplica (`MAX_SYNC_EDGE_DAY_REPLICATES`). El perfil
local conserva los defaults anteriores; no cambia ninguna semilla ni el motor.
El error 422 permite reducir la carga. No se acredita el benchmark original.

