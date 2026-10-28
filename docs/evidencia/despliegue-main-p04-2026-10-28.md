# Main desplegado con P-04 — 28 de octubre de 2026

Despliegue solicitado por el usuario. Revisión de aplicación:
`4e9d3d2296591193015316114c607072957b6f98`; región `us-east-2`.

- Sitio: https://staging.d2uefmypgx02e9.amplifyapp.com
- API: https://n75ovr6vb5.execute-api.us-east-2.amazonaws.com/v1
- Health: https://n75ovr6vb5.execute-api.us-east-2.amazonaws.com/v1/health
- Amplify deployment 1: `SUCCEED`.
- Terraform: 83 altas, cero cambios y cero destrucciones. Se reutiliza el bootstrap.
- Flags: `asyncJobs:true`, `jobBackend:aws`, máximo 1000 réplicas; un trabajo activo,
  dos workers, tres admisiones por día UTC y límite de 50 millones arista-día-réplica.

## Verificación base

```sh
node --experimental-strip-types scripts/verify_aws_base.mjs https://n75ovr6vb5.execute-api.us-east-2.amazonaws.com/v1 --jobs-enabled
```

Preview, comparación y PDF correctos. Perfil inicial N200/T20/R30: comparación
HTTP 2,725 s, PDF 2,002 s en una muestra. PDF del documento importado de
9 673 398 bytes correcto (8 275 bytes). El escenario grande original es rechazado
antes de simular. No acredita p95 ni el benchmark original N1000/T90/R30.

## P-04 real: 100 réplicas

```sh
node --experimental-strip-types scripts/verify_aws_jobs.mjs https://n75ovr6vb5.execute-api.us-east-2.amazonaws.com/v1 100
```

Trabajo `57b4510b-50d9-5232-819b-027c6d411f38`, N60/T7, raíz 20261026,
tres políticas pareadas. Se comprobó idempotencia y progreso real 0→100,
agregación y resultado privado. **100/100 completadas, cero fallidas**.

Step Functions: `SUCCEEDED`, inicio 09:06:54.755 UTC, fin 09:07:25.446 UTC.
El script midió 31,850 s desde la respuesta inicial de creación hasta descargar
el resultado (incluye sondeo y validación del cliente).

Hash: `sha256:af81a59752ecb3fc60f763ef38bc6b9fce5d7f1a0f1981cffd60f612191ba931`.
Reproducido correctamente en proceso nuevo con Python 3.12.15 y dependencias
del manifiesto:

```sh
.tools/aws-repro/Scripts/python.exe scripts/reproduce.py .tools/p04-aws-1793178447067/experiment.json
```

Se observaron 20 invocaciones worker, lotes de cinco. CloudWatch REPORT suma
32,7854375 GB-s facturables de esos workers. Estimación de **solo su cómputo**:
`32.7854375 * 0.0000166667 = USD 0.00054642505118125`, calculada con Python.
No es costo total ni factura: excluye API, preparación/agregación, Step Functions,
S3, DynamoDB, CloudWatch, Amplify, solicitudes y transferencia. Precio de referencia:
[Lambda x86](https://aws.amazon.com/lambda/pricing/). Créditos/free tier no se descontaron.
Budget consultado: `SpookyThon2026-PRO`, USD20; entrega de alertas no verificada.

## Navegador público

Edge/Playwright: preview, comparación real y descargas JSON, ZIP/CSV y PDF.
Vista móvil 390 px sin desbordamiento; cero errores de página.

PRO creó un segundo trabajo de **dos réplicas**:
`7e7e39df-8e18-5850-b60c-58f158c5f96f`. Resultado completo obtenido desde S3
con HTTP200 y sin reenviar `X-Job-Token` al bucket. Hash:
`sha256:4837113b871dd64173799502192da31092e2f2e8fb0e93e7fdd1ad41bf6367bc`.

El contador DynamoDB confirmó **dos admisiones consumidas** el 28/10 UTC: queda
una para ese día. No se enviaron correos ni códigos de verificación.

## Evidencia y pendientes

Logs/planes y resultados crudos bajo `.tools/deploy-main-*`, `.tools/p04-aws-*`
y `.tools/aws-smoke-*`, ignorados por Git. No guardar tokens ni enlaces firmados.

No se ejecutaron 1000 réplicas ni una prueba de cancelación en AWS. La aceptación
de miles de réplicas, costos completos, aceptación humana y T-23 siguen pendientes.
La prueba de 100 es funcional, no una nueva matriz científica T-22; v1 intacto.
Ver [operación y retirada](../../infra/P04-OPERACION.md).
