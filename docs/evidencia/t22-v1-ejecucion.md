# Ejecución T-22 v1

Fecha de ejecución: 2026-10-28T02:28:31.342078Z.
Protocolo: `t22-v1`, SHA-256 `cb6b3e62795de8a6ec87f1a7e4c972c692ebbcb5144d3546ec6f622a92ffbb8b`.
Commit de origen: `0e90ff4b8b646d65165c7793c500d46c598aac39`.
Intento: `.tools\t22-v1-attempt-02` (ignorado en Git).
Entorno: Python 3.12.14, NumPy 2.5.4, NetworkX 3.7, Windows-11-10.0.22631-SP0.

## Decisión: **APROBADO**

Las cinco raíces primarias y los controles técnicos están completos y válidos; ambas diferencias sumadas son positivas.

## Resumen primario combinado

| Métrica | Valor |
|---|---:|
| Réplicas primarias | 150 |
| Media none | 713.6 |
| Media random | 575.1 |
| Media targeted | 359.2 |
| Suma D_none | 53160 |
| Media D_none | 354.4 |
| Victorias D_none | 121/150 |
| Suma D_random | 32385 |
| Media D_random | 215.9 |
| Victorias D_random | 112/150 |

La estimación combinada usa las 150 réplicas con igual peso. No se calculó un bootstrap global: los intervalos por raíz que siguen son los del backend.

## Primario por raíz

| Raíz | n | none | random | targeted | D_none | D_random | victorias random | Recomendación backend |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| base-root-0 | 30 | 776.6 | 597.3 | 437.9 | 338.7 | 159.4 | 23/30 | backend: supported, ganador targeted |
| base-root-1 | 30 | 655.5 | 519.9 | 306.8 | 348.6 | 213.0 | 20/30 | backend: supported, ganador targeted |
| base-root-2 | 30 | 691.0 | 601.0 | 356.7 | 334.3 | 244.3 | 24/30 | backend: supported, ganador targeted |
| base-root-3 | 30 | 686.9 | 573.5 | 344.2 | 342.6 | 229.3 | 23/30 | backend: supported, ganador targeted |
| base-root-4 | 30 | 758.1 | 583.9 | 350.4 | 407.7 | 233.5 | 22/30 | backend: supported, ganador targeted |

Bootstrap pareado por raíz de `random − targeted` (2000 remuestras, 95 %):

- base-root-0: [68.3, 250.8]
- base-root-1: [134.3, 308.1]
- base-root-2: [165.1, 333.2]
- base-root-3: [122.6, 344.6]
- base-root-4: [115.0, 341.6]

## Controles técnicos

| Control | Estado | Fallos |
|---|---|---|
| control-zero-vaccines | PASA | 0 |
| control-zero-transmission | PASA | 0 |
| control-zero-efficacy | PASA | 0 |
| control-full-coverage | PASA | 0 |
| control-terminal-intervention | PASA | 0 |

## Contrastes descriptivos

| Experimento | n | none | random | targeted | D_none | D_random |
|---|---:|---:|---:|---:|---:|---:|
| higher-transmission | 30 | 949.3 | 789.3 | 743.1 | 206.2 | 46.2 |
| scarce-vaccines | 30 | 776.6 | 697.7 | 591.8 | 184.8 | 105.9 |
| partial-efficacy | 30 | 776.6 | 726.2 | 681.8 | 94.9 | 44.5 |
| market-origin | 30 | 776.6 | 597.3 | 437.9 | 338.7 | 159.4 |
| delayed-intervention | 30 | 776.6 | 673.8 | 495.8 | 280.9 | 178.1 |

Los contrastes no forman parte del gate primario y no se usan para sustituir el escenario base.

## Inventario y reproducciones

| Run | Tipo | JSON | Hash | Reproducciones | Tiempo export (s) |
|---|---|---|---|---|---:|
| base-root-0 | primary | `.tools\t22-v1-attempt-02\base-root-0.json` | `sha256:36395…` | 3/3 | 50.8 |
| base-root-1 | primary | `.tools\t22-v1-attempt-02\base-root-1.json` | `sha256:d855c…` | 1/1 | 29.4 |
| base-root-2 | primary | `.tools\t22-v1-attempt-02\base-root-2.json` | `sha256:f1440…` | 1/1 | 29.1 |
| base-root-3 | primary | `.tools\t22-v1-attempt-02\base-root-3.json` | `sha256:5f9f0…` | 1/1 | 29.6 |
| base-root-4 | primary | `.tools\t22-v1-attempt-02\base-root-4.json` | `sha256:960c3…` | 1/1 | 31.3 |
| higher-transmission | descriptive-contrast | `.tools\t22-v1-attempt-02\higher-transmission.json` | `sha256:cc410…` | 1/1 | 30.5 |
| scarce-vaccines | descriptive-contrast | `.tools\t22-v1-attempt-02\scarce-vaccines.json` | `sha256:ed3d9…` | 1/1 | 30.6 |
| partial-efficacy | descriptive-contrast | `.tools\t22-v1-attempt-02\partial-efficacy.json` | `sha256:57dd8…` | 1/1 | 32.7 |
| market-origin | descriptive-contrast | `.tools\t22-v1-attempt-02\market-origin.json` | `sha256:47452…` | 1/1 | 31.3 |
| delayed-intervention | descriptive-contrast | `.tools\t22-v1-attempt-02\delayed-intervention.json` | `sha256:6f6ce…` | 1/1 | 29.9 |
| control-zero-vaccines | technical-control | `.tools\t22-v1-attempt-02\control-zero-vaccines.json` | `sha256:df667…` | 1/1 | 2.3 |
| control-zero-transmission | technical-control | `.tools\t22-v1-attempt-02\control-zero-transmission.json` | `sha256:539aa…` | 1/1 | 1.8 |
| control-zero-efficacy | technical-control | `.tools\t22-v1-attempt-02\control-zero-efficacy.json` | `sha256:4c486…` | 1/1 | 1.7 |
| control-full-coverage | technical-control | `.tools\t22-v1-attempt-02\control-full-coverage.json` | `sha256:80666…` | 1/1 | 2.0 |
| control-terminal-intervention | technical-control | `.tools\t22-v1-attempt-02\control-terminal-intervention.json` | `sha256:fff92…` | 1/1 | 1.5 |

Hash completo, tamaños, rutas ZIP, logs, comandos y tiempos por paso están en `.tools\t22-v1-attempt-02\runs/` y en el resumen JSON.

## Limitaciones y datos ausentes

- Cinco raíces sintéticas fijas; no son datos observados de Manta ni predicen brotes reales.
- Las 30 réplicas de una raíz comparten red; no son 30 redes independientes.
- Los contrastes son descriptivos y no tienen gate de superioridad.
- No se calcularon costos por infectado evitado ni se usó AWS.
- Siguen pendientes la semilla del jurado externo, los tiempos humanos, la aceptación manual/accesibilidad y el benchmark AWS.
- Este informe no declara la aplicación lista para pitch; solo documenta el componente científico T-22.

## Auditoría adicional y lectura de resultados

Se revisaron los 15 JSON/ZIP contra sus inputs congelados, checksums registrados, manifiestos del commit de origen y logs de las 17 reproducciones. Cada ZIP pasó CRC y coincide con configuración/manifiesto del JSON. Los cinco grafos primarios son distintos. [Auditoría y observaciones pareadas completas](t22-v1-auditoria.json); [resumen, intervalos y métricas originales del backend](t22-v1-ejecucion.json).

Resultado combinado frente a none: **121 victorias, 29 empates, 0 pérdidas**. Frente a random: **112 victorias, 33 empates, 5 pérdidas**. Las diferencias sumadas se recalcularon directamente desde los acumulados de cada réplica: 53.160 y 32.385; no se decide usando cifras redondeadas. El criterio de impacto puntual predefinido pasa. No implica victoria en cada réplica ni aceptación del producto completo.

Los cinco IC bootstrap por raíz frente a random excluyen cero; también se muestran los de none. No se construye un IC global con las 150 observaciones como redes independientes.

| Raíz / contraste | Victoria / empate / pérdida vs azar | IC95% none − targeted | IC95% random − targeted | Incluye cero (none / random) |
|---|---|---|---|---|
| base-root-0 | 23 / 5 / 2 | [263.526, 428.576] | [68.255, 250.818] | False / False |
| base-root-1 | 20 / 10 / 0 | [240.966, 467.409] | [134.295, 308.140] | False / False |
| base-root-2 | 24 / 6 / 0 | [242.817, 431.835] | [165.114, 333.177] | False / False |
| base-root-3 | 23 / 6 / 1 | [245.463, 455.403] | [122.572, 344.569] | False / False |
| base-root-4 | 22 / 6 / 2 | [303.729, 518.267] | [115.026, 341.606] | False / False |
| delayed-intervention | 26 / 4 / 0 | [230.833, 329.370] | [141.361, 217.401] | False / False |
| higher-transmission | 27 / 1 / 2 | [146.759, 292.270] | [-66.736, 158.404] | False / True |
| market-origin | 23 / 5 / 2 | [263.526, 428.576] | [68.255, 250.818] | False / False |
| partial-efficacy | 26 / 4 / 0 | [77.798, 110.600] | [32.661, 56.570] | False / False |
| scarce-vaccines | 25 / 4 / 1 | [124.532, 267.007] | [21.631, 198.872] | False / False |

Los intervalos de contrastes se conservan como descripciones del backend; no son pruebas múltiples de superioridad ni reemplazan la primaria.

### Métricas secundarias primarias

Medias por raíz/política. Extinción significa E+I=0; se informa cuántas réplicas la observaron y cuántas quedan censuradas al día 90. Una extinción no observada no tiene duración cero. Todos los estadísticos n/media/mediana/P05/P95 y los valores pareados están en los JSON versionados.

| Raíz | Política | Pico I | Primer día pico | I final | Extinción observada / censurada | Dosis asignadas / efectivas / sin usar |
|---|---|---|---|---|---|---|
| base-root-0 | none | 203.07 | 39.17 | 4.47 | 7 / 23 | 0.00 / 0.00 / 100.00 |
| base-root-0 | random | 145.47 | 37.43 | 6.70 | 9 / 21 | 100.00 / 100.00 / 0.00 |
| base-root-0 | targeted | 77.97 | 53.43 | 40.43 | 7 / 23 | 100.00 / 100.00 / 0.00 |
| base-root-1 | none | 171.27 | 32.47 | 4.57 | 10 / 20 | 0.00 / 0.00 / 100.00 |
| base-root-1 | random | 123.43 | 32.00 | 5.37 | 13 / 17 | 100.00 / 100.00 / 0.00 |
| base-root-1 | targeted | 54.63 | 37.57 | 24.90 | 14 / 16 | 100.00 / 100.00 / 0.00 |
| base-root-2 | none | 176.63 | 33.47 | 2.80 | 11 / 19 | 0.00 / 0.00 / 100.00 |
| base-root-2 | random | 139.87 | 35.70 | 5.37 | 8 / 22 | 100.00 / 100.00 / 0.00 |
| base-root-2 | targeted | 59.40 | 47.53 | 31.97 | 10 / 20 | 100.00 / 100.00 / 0.00 |
| base-root-3 | none | 179.13 | 33.27 | 3.83 | 12 / 18 | 0.00 / 0.00 / 100.00 |
| base-root-3 | random | 138.30 | 32.67 | 4.63 | 9 / 21 | 100.00 / 100.00 / 0.00 |
| base-root-3 | targeted | 59.83 | 40.37 | 28.43 | 12 / 18 | 100.00 / 100.00 / 0.00 |
| base-root-4 | none | 200.23 | 37.70 | 5.40 | 6 / 24 | 0.00 / 0.00 / 100.00 |
| base-root-4 | random | 142.80 | 35.77 | 7.27 | 8 / 22 | 100.00 / 100.00 / 0.00 |
| base-root-4 | targeted | 63.57 | 46.50 | 31.37 | 11 / 19 | 100.00 / 100.00 / 0.00 |

**Límite del horizonte:** targeted tiene más infecciosos al día 90 que random en las cinco raíces, aunque tiene menos infectados acumulados. El gate evalúa acumulados hasta T=90; no demuestra menor duración del brote ni menor carga infecciosa en cualquier día. No se extendió el horizonte después de observar el resultado.

### Contraste de mercado redundante

En `market-origin`, los 1.000 nodos del grafo exportado tienen `marketId` no nulo. El generador acumula esa pertenencia durante el calendario y el selector de origen usa ese atributo. Con este input, los candidatos coinciden con toda la población; el grafo y las 30 réplicas son idénticos a `base-root-0`. La configuración y el hash de experimento sí son distintos, como corresponde al cambio de origin. Se conserva el contraste, pero **no aporta evidencia independiente de sensibilidad al lugar de origen**. Resolver la definición temporal del origen requiere un diseño explícito y una nueva evaluación v2, conservando v1; no se modifica aquí el motor ni el protocolo.

### Entorno, comandos y verificación

CPU Intel Core i7-1255U (10 núcleos/12 procesadores lógicos); memoria física 12.596.011.008 bytes. La ejecución comenzó el 27 de octubre de 2026 en America/Guayaquil y sus timestamps UTC corresponden al 28 de octubre. Duración aproximada del lote: 14 minutos, incluidos exportación, validación, ZIP y reproducciones; no es benchmark AWS ni de API. El verificador de protocolo indica simulationsExecuted=0 porque solo comprueba el registro; los conteos de ejecución real están en executionCounts.

```powershell
backend/.venv/Scripts/python.exe -X utf8 scripts/check_validation_protocol.py
backend/.venv/Scripts/python.exe -X utf8 scripts/run_t22.py --attempt .tools/t22-v1-attempt-02 --group all
```

Para una nueva ejecución, usar un directorio nuevo; no sobrescribir este intento. Para reproducir una fila: `backend/.venv/Scripts/python.exe -X utf8 scripts/reproduce.py .tools/t22-v1-attempt-02/base-root-0.json`. Fuente fijada en el commit indicado al principio del informe; dependencias en backend/uv.lock.

**Verificación:** suite completa 486 pruebas pasa; Ruff y formato (55 archivos) y mypy (28 archivos) correctos. Las 8 pruebas nuevas cubren decisión estricta, informe desfavorable, censura/métricas secundarias y vinculación de artefactos. [Preparación y TDD](t22-ejecutor-2026-10-27.md). Sin cambios en motor, semillas ni archivos congelados; SHA-256 del protocolo verificado antes y después.

T-22 científico queda ejecutado y aprobado. T-23, semilla externa, aceptación humana/UI, rendimiento consistente ≤25 s, staging/AWS y entrega integral permanecen pendientes.

Archivo local para conservar o compartir manualmente los crudos: `.tools/t22-v1-attempt-02-evidence.zip` (17078053 bytes), SHA-256 `d7c4b7800ef0fc7948f873f136d5a78ef885801222a299d8582599101b96b969`. Incluye los JSON/ZIP/logs/entorno/hardware y una copia del protocolo; está ignorado por Git.
