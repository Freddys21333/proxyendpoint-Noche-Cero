# Rendimiento backend local — 2026-10-28

Iteración sobre el merge `a08cb44`, sin cambios de motor, datos, protocolo T-22, RNG, hashes, precisión, timeouts ni límites. Windows 11, Python 3.12.14. [Todas las muestras y fases](rendimiento-backend-2026-10-28.json).

## Comparación HTTP

N1000/T90/R30, semilla 20261026; tres muestras secuenciales por modo/versión. Se incluye el recorrido hasta descomprimir y parsear JSON en el cliente; no renderizado UI.

| Modo | Antes: muestras (s) | Después: muestras (s) | Mediana antes → después | Máximo después |
|---|---|---|---|---|
| Sin frames | 22.04, 20.41, 20.06 | 18.09, 19.09, 18.46 | 20.41 → 18.46 | 19.09 |
| Con frames | 21.75, 23.99, 40.79 | 18.82, 19.56, 19.87 | 23.99 → 19.56 | 19.87 |

Las seis comparaciones finales observadas quedaron por debajo de 25 s; máximo 19,87 s. Esto es evidencia local limitada, **no certifica** consistencia universal, p95 de staging, capacidad multiusuario o AWS. El objetivo se observó en esta tanda; el gate de rendimiento de staging sigue pendiente. Se conserva el valor anterior de 40,79 s. La variación del motor/carga del equipo impide atribuir toda diferencia al código; hubo pruebas focalizadas breves parcialmente solapadas con la tanda inicial, mientras la tanda final no tuvo otros ensayos pesados propios simultáneos. No se ocultaron muestras ni se promediaron modos.

Mediana de validación incluida dentro de exportación:

- Sin frames: 5.36 → 3.38 s.
- Con frames: 6.22 → 3.64 s.

No sumar validación a exportación: es una fase anidada. Los percentiles de los JSON son descriptivos con n=3, no IC ni p95 de aceptación.

## PDF, ZIP y trabajo individual

Mismo experimento completo con frames como entrada; tres muestras PDF/ZIP. PDF es POST HTTP real e incluye envío del cuerpo, validación, render y recepción. El reloj comienza después de serializar la solicitud en el cliente. ZIP se mide mediante la función backend local; **no existe endpoint ZIP** y la UI usa su exportador cliente.

| Operación | Mediana antes | Mediana después | Muestras |
|---|---:|---:|---:|
| PDF HTTP | 7.03 s | 4.94 s | 3 / versión |
| ZIP backend local | 6.16 s | 4.36 s | 3 / versión |
| Crear trabajo | 1.97 s | 2.07 s | 1 / versión |
| Hasta trabajo listo, incluye creación y sondeo | 12.95 s | 11.93 s | 1 / versión |
| Descargar/parsear resultado de trabajo | 5.94 s | 3.99 s | 1 / versión |

El default N1000/T90/R30 solicita 160.307.100 arista-día-réplicas frente al límite local de 50.000.000: se comprobó su rechazo 422, sin ampliar límites. El ensayo de jobs usa N1000/T90/**R9**, que sí cabe; su hash se compara antes/después, sin confundirlo con R30. Todas las mediciones del trabajo son descriptivas, n=1; se conservan también las repeticiones adicionales del ensayo de carga.

PDF (8.275 bytes) y ZIP (767.647 bytes) conservan exactamente sus SHA-256 antes/después. Las dos comparaciones completas (con/sin frames) coinciden campo por campo salvo requestId/generatedAt. El experimento final R30 se reprodujo en proceso nuevo con el mismo hash científico.

## Cambio y seguridad de validación

Se preparan comprobadores acotados de registros planos a partir de una copia privada del esquema: campos permitidos/obligatorios, enteros/números nativos acotados, enums de texto y listas de enteros con longitud/unicidad. Se resuelven Edge/Daily en la copia privada, sin modificar el contrato compartido. Solo un éxito completo evita recorrer cada registro mediante Draft202012Validator; tipos alternativos válidos (como 1.0 entero), campos no soportados, restricciones nuevas o errores vuelven al recorrido original. El cache está limitado a 128 esquemas y no conserva simulaciones ni documentos.

TDD del cambio: 14 fallos y 8 éxitos antes de implementar el atajo; 22 pruebas nuevas de equivalencia/respaldos pasan después. Suite completa: **510 pruebas**, Ruff/formato y mypy correctos; se volvió a verificar el arnés con tres trabajos pequeños tras añadir el ensayo de carga. No se tocó frontend ni se reinició la API compartida :8000, para conservar sus trabajos en memoria.

## Reproducir

```powershell
backend/.venv/Scripts/python.exe -X utf8 scripts/benchmark_api.py --samples 3 --output-dir .tools/backend-perf-repeat
backend/.venv/Scripts/python.exe -X utf8 scripts/benchmark_backend_outputs.py .tools/backend-perf-repeat/experiment-frames.json --samples 3 --load-probe --output .tools/backend-outputs-repeat.json
backend/.venv/Scripts/python.exe -X utf8 scripts/reproduce.py .tools/backend-perf-repeat/experiment-frames.json
```

Para comparar salidas con la validación previa se usó `--reference-configuration .tools/backend-perf-20261028-reference.py`, una copia exacta de `git show a08cb44:backend/src/domain/configuration.py`. Esa opción es exclusiva del ejecutable de medición y solo debe cargar código de confianza del repositorio. El archivo de referencia y los JSON completos están en `.tools/`, ignorados por Git. Los SHA de ambos validadores están en la evidencia JSON.

Se conservan T-22 y sus pérdidas/empates. No se vuelven a seleccionar semillas ni se modifica el protocolo. Los siguientes gates externos siguen abiertos: staging/AWS, aceptación humana y T-23.

## Tanda de carga local

Se enviaron tres trabajos iguales N1000/T90/R9 al límite existente de dos workers, con capacidades e idempotencia independientes. El tercero pasó por pending/running/aggregating/completed. Se consultó health y estado después de enviar los tres; no se midió health durante las solicitudes de creación ni durante una comparación síncrona. La descarga de resultados se midió tras completar los tres, validando integridad y el mismo hash en todos. Una sola tanda por versión; no constituye un percentil ni una prueba general de capacidad multiusuario.

| Dato | Antes | Después |
|---|---:|---:|
| Trabajo 1 listo desde primer envío | 31.63 s | 21.62 s |
| Trabajo 2 listo desde primer envío | 41.02 s | 25.52 s |
| Trabajo 3 listo desde primer envío | 50.89 s | 33.41 s |
| Máximo health observado con jobs activos | 0.495 s | 0.528 s |

Health no mejoró en su máximo observado (0,50 → 0,53 s); se conserva. La tanda adicional previa mostró PDF 13,18 s y ZIP 11,70 s, más lentos que las tres muestras principales anteriores (aproximadamente 7 y 6 s). Toda esa variación y sus muestras están en el JSON; no se atribuye toda reducción de la tanda al optimizador. No hay promesa de latencia bajo cualquier carga o equipo.

Integración real del cliente contra API aislada :18011: comparación manual, sin vacunas, sin transmisión, variante adaptativa y flujo de jobs (cancelación, idempotencia, token y rechazo de parcial) pasan. Los hashes de esos escenarios siguen coincidiendo con las verificaciones anteriores. La API compartida :8000 se mantuvo intacta.

Implementación publicada en el commit `f490daf9e53502574f398881cfbac01ba77339f1`; el SHA-256 del archivo de validación medido está en el resumen JSON.
