# Rendimiento HTTP local de API — 2026-10-27

Medición ejecutada en Windows 11, Python 3.12.14, HTTP loopback y servidor aislado. N=1000, T=90, R=30; semilla 20261026 y tres políticas. Incluye generación, simulación, exportación/validación, JSON, gzip, recepción, descompresión y parseo del cliente. No incluye renderizado de UI.

## Resultados completos

Segundos del cliente hasta disponer del JSON. Tres muestras secuenciales por modo; el percentil es descriptivo, no aceptación estadística de staging.

| Etapa | Frames | Muestras (s) | Mediana | Máximo | P95 descriptivo |
|---|---|---|---|---|---|
| antes | False | 30.03, 45.49, 32.05 | 32.05 | 45.49 | 44.14 |
| antes | True | 30.50, 33.63, 23.61 | 30.50 | 33.63 | 33.32 |
| intermedio | False | 25.35, 25.58, 29.80 | 25.58 | 29.80 | 29.37 |
| intermedio | True | 21.29, 20.77, 21.23 | 21.23 | 21.29 | 21.28 |
| final | False | 24.35, 23.31, 24.97 | 24.35 | 24.97 | 24.91 |
| final | True | 23.62, 33.41, 37.19 | 33.41 | 37.19 | 36.82 |

El resultado final sin frames quedó por debajo de 25 s en 3/3 muestras; con frames solo 1/3. El objetivo consistente ≤25 s sigue abierto. Se conserva la ejecución intermedia y todas las muestras lentas. La variación del motor y del grafo entre ejecuciones impide atribuir toda diferencia a los cambios de código. No se ejecutaron las 20 muestras de staging ni AWS.

## Fases finales

Medianas por modo, en segundos. La validación está incluida dentro de exportación; serialización y gzip están incluidos dentro de respuesta. No sumar fases anidadas.

| Frames | Grafo | Motor | Exportación | Validación incluida | Respuesta | Gzip incluido |
|---|---|---|---|---|---|---|
| False | 1.799 | 12.882 | 8.065 | 6.337 | 0.501 | 0.493 |
| True | 1.943 | 12.621 | 11.698 | 9.292 | 0.847 | 0.840 |

Preview final: 5.26 s, una muestra; no permite estimar percentiles. Health/config se consultan realmente en el arnés, sin benchmark de carga independiente.

Sin frames: 8.580.830 bytes decodificados y aproximadamente 878.872 bytes gzip. Con frames: 9.673.406 bytes y aproximadamente 902.068 bytes gzip. Las variaciones mínimas del gzip provienen de metadatos de solicitud.

## Cambios y verificación

- Atajo equivalente de propiedades escalares válidas y resolución privada de Context; casos restantes conservan Draft202012Validator. Pruebas contrastan errores y valores extremos, incluidos booleanos, números enormes y campos extra.
- `prepare_experiment` entrega documento y bytes JSON finales ya validados a compare. Se evita serializar otra vez; export_experiment conserva su contrato dict. Sin caché global ni cambio de motor, gzip, timeouts o límites.
- Igualdad completa de ambos JSON antes/después, omitiendo únicamente requestId/generatedAt. Hash compartido: `sha256:c37de16855e971145b36e30094d5a72159a0425b4770631ad96e1f37ccbd9d97`.
- Reproducción del JSON completo con frames en proceso nuevo: mismo hash.
- 478 pruebas backend pasan; Ruff, formato y mypy correctos. Integración HTTP del cliente: comparación manual, sin vacunas, sin transmisión, adaptativa y trabajos (resultado, cancelación, idempotencia, token y rechazo de parcial) pasan.
- Pruebas conservan igualdad de respuesta gzip/base64 y errores 413 por límites decodificado y de transporte.

## Reproducir y alcance

```powershell
backend/.venv/Scripts/python.exe -X utf8 scripts/benchmark_api.py --samples 3 --output-dir .tools/api-performance-repeat
backend/.venv/Scripts/python.exe -X utf8 scripts/reproduce.py .tools/api-performance-final/experiment-frames.json
```

Datos crudos: `.tools/api-performance-before`, `.tools/api-performance-after`, `.tools/api-performance-final` (ignorados por Git). [Reporte versionado con todas las muestras y fases](api-performance-2026-10-27.json). Los envoltorios miden funciones originales y se restauran al terminar; la validación de evidencia está fuera del cronómetro HTTP.

Esta evidencia mide la ruta completa de comparación y preview; no certifica carga concurrente, memoria, todos los endpoints pesados (PDF/ZIP/jobs), red pública ni Lambda. Las otras rutas tienen comprobaciones funcionales, no un benchmark exhaustivo por endpoint. T-22, aceptación humana y despliegue siguen pendientes. La API compartida :8000 no se reinició para evitar perder trabajos locales.
