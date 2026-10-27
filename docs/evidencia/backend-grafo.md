# Grafo, calendario y origen — T-06

Fecha: 26 de octubre de 2026. Rama feat/backend-contratos.
Windows x86_64, Python 3.12.14, NumPy 2.5.4, NetworkX 3.7.
Referencias: RF-03, RNF-01/03, D-03/04 y CA-06/07 de reproducibilidad local.

## Implementación

`simulation.network` genera población synthetic-manta-v1, cliques de hogares, roles, salones Watts–Strogatz, rutas, vendedores/visitantes y barrios. Grupos primero, contactos por día/contexto/pares ordenados, unión por u/v/context e IDs consecutivos. Conserva capas entre un mismo par. Calendario incluye 0..T; domingo no opera colegio/bus/mercado y lunes se reactivan. Hogar y barrio son fijos; bus y mercado tienen contactos diarios. Aristas sobre el límite producen 413 GRAPH_TOO_LARGE sin truncamiento.

`select_initial` respeta origen aleatorio/contexto/nodo para el primer caso y elige restantes sin reemplazo de toda población. Contexto vacío devuelve ORIGIN_EMPTY 422 y nodo ajeno VALIDATION_ERROR 422. RNG de inicialización independiente por réplica. No modifica el grafo recibido.

`build_preview` devuelve payload de dominio con configuración, grafo/hash, posiciones circulares independientes y estado inicial/hash. El hash inicial cubre graphHash e IDs iniciales ordenados antes de vacunación. Se documentó esta proyección y el orden exacto de grupos en agreements.md §2. No implementa el envoltorio HTTP de T-11.

## TDD y verificaciones observadas

Rojo: antes del módulo, `pytest backend/tests/test_network.py -q` devolvió código 1 por ModuleNotFoundError: simulation.network. Verde y refactor: implementación, formato y pruebas adicionales.

Desde raíz, prefijo `.\.tools\bin\uv.exe`:

| Argumentos | Resultado |
|---|---|
| `run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | **185 passed in 29.71s**, código 0; 21 pruebas nuevas |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests` | Sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff format --check backend/src backend/tests` | 14 archivos formateados |
| `run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src` | 9 fuentes sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | OK |

Se probaron esquemas reales de grafo/preview, cliques/pertenencias/roles, tamaños no divisibles (50/51/103/104/108/200), salones finales de uno/dos estudiantes, límite de aristas, origen, calendario domingo/lunes, independencia de eficacia/beta/réplicas/origen respecto de red, cambios de semilla/T/pesos, layout fuera del hash y tres procesos con PYTHONHASHSEED distinto. Fixture N=100/T=7/semilla default: 1.169 aristas, graphHash `sha256:4a99b4e7aec1256b5b3d599f17aee19036b50d1fae6bd774ac907184672d293a`.

Smoke de configuración default real: N=1000/T=90 produjo 59.373 aristas, graphHash `sha256:e3b4dc8ce30bcd95d36eaa9d43d37c82b44790f203c7646d5df532601f1ff5ea`. Esto verifica generación local, no rendimiento de simulación ni benchmark AWS. pytest requirió permisos para temporales/procesos fuera del sandbox.

## Checkov y límites

Checkov **3.3.30** instalado en `.tools/checkov-env`, separado del backend para preservar su NetworkX 3.7 (Checkov requiere 2.6.3). `scripts/checkov.ps1 --version` devolvió 3.3.30, código 0. Instalación y comando de escaneo documentados en backend/README.md. No hay Terraform aún en infra: no se afirma auditoría aprobada ni infraestructura desplegada. Entorno y caché quedan ignorados en Git.

Pendientes: motor SEIR T-07, políticas/estadísticas/exportación y handlers T-08..11. No hay servidor, transmisión, resultados epidemiológicos ni despliegue AWS. La red por encima del límite se rechaza aunque los parámetros individuales estén en rango; no se recorta ni se oculta ese error.
