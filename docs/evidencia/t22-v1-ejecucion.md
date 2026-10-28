# Ejecución T-22 v1

Fecha de ejecución: 2026-10-28T02:54:40.831402Z.
Protocolo: `t22-v1`, SHA-256 `cb6b3e62795de8a6ec87f1a7e4c972c692ebbcb5144d3546ec6f622a92ffbb8b`.
Commit de origen: `d444ccf55028bdb1bb4d83bf983ea20ec1eefebf`.
Intento: `.tools/t22-v1-attempt-01` (ignorado en Git).
Entorno: Python 3.12.15, NumPy 2.5.4, NetworkX 3.7, Linux-7.2.12-200.fc44.x86_64-x86_64-with-glibc2.43.

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

| Raíz | n | none | random | targeted | D_none | D_random | victorias random | IC D_random |
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
| base-root-0 | primary | `.tools/t22-v1-attempt-01/base-root-0.json` | `sha256:ead1e…` | 3/3 | — |
| base-root-1 | primary | `.tools/t22-v1-attempt-01/base-root-1.json` | `sha256:68b86…` | 1/1 | 102.5 |
| base-root-2 | primary | `.tools/t22-v1-attempt-01/base-root-2.json` | `sha256:05d6b…` | 1/1 | 91.8 |
| base-root-3 | primary | `.tools/t22-v1-attempt-01/base-root-3.json` | `sha256:9d603…` | 1/1 | 87.7 |
| base-root-4 | primary | `.tools/t22-v1-attempt-01/base-root-4.json` | `sha256:4d5d5…` | 1/1 | 92.5 |
| higher-transmission | descriptive-contrast | `.tools/t22-v1-attempt-01/higher-transmission.json` | `sha256:f6713…` | 1/1 | 96.9 |
| scarce-vaccines | descriptive-contrast | `.tools/t22-v1-attempt-01/scarce-vaccines.json` | `sha256:2ce68…` | 1/1 | 92.9 |
| partial-efficacy | descriptive-contrast | `.tools/t22-v1-attempt-01/partial-efficacy.json` | `sha256:82fee…` | 1/1 | 91.0 |
| market-origin | descriptive-contrast | `.tools/t22-v1-attempt-01/market-origin.json` | `sha256:a2adc…` | 1/1 | 81.2 |
| delayed-intervention | descriptive-contrast | `.tools/t22-v1-attempt-01/delayed-intervention.json` | `sha256:36710…` | 1/1 | 87.4 |
| control-zero-vaccines | technical-control | `.tools/t22-v1-attempt-01/control-zero-vaccines.json` | `sha256:ab3a0…` | 1/1 | — |
| control-zero-transmission | technical-control | `.tools/t22-v1-attempt-01/control-zero-transmission.json` | `sha256:68916…` | 1/1 | — |
| control-zero-efficacy | technical-control | `.tools/t22-v1-attempt-01/control-zero-efficacy.json` | `sha256:1f04e…` | 1/1 | — |
| control-full-coverage | technical-control | `.tools/t22-v1-attempt-01/control-full-coverage.json` | `sha256:53be1…` | 1/1 | — |
| control-terminal-intervention | technical-control | `.tools/t22-v1-attempt-01/control-terminal-intervention.json` | `sha256:74e19…` | 1/1 | — |

Hash completo, tamaños, rutas ZIP, logs, comandos y tiempos por paso están en `.tools/t22-v1-attempt-01/runs/` y en el resumen JSON.

## Limitaciones y datos ausentes

- Cinco raíces sintéticas fijas; no son datos observados de Manta ni predicen brotes reales.
- Las 30 réplicas de una raíz comparten red; no son 30 redes independientes.
- Los contrastes son descriptivos y no tienen gate de superioridad.
- No se calcularon costos por infectado evitado ni se usó AWS.
- Siguen pendientes la semilla del jurado externo, los tiempos humanos, la aceptación manual/accesibilidad y el benchmark AWS.
- Este informe no declara la aplicación lista para pitch; solo documenta el componente científico T-22.
