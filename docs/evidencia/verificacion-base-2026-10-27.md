# Verificación de base antes de continuar PRO

**Fecha:** 2026-10-27.
**Rama:** `feat/front-end` (commit base `2435c78`, más los cambios de documentación y el ajuste de prueba de esta sesión).
**Alcance:** comprobar que la base local sigue en verde, registrar el mapa como P-09 y dejar constancia reproducible para continuar PRO. No se ejecutó AWS ni un despliegue.

## Entorno

- Linux x86_64.
- Node.js 24.21.0 y npm 11.19.0.
- uv 0.13.5 instalado localmente en `/tmp/opencode/uv`.
- CPython 3.12.15 descargado por uv (`requires-python ==3.12.*`; `.python-version` fija `3.12`).
- Dependencias backend resueltas desde `backend/uv.lock` (NumPy 2.5.4, NetworkX 3.7, pytest 9.1.1, Ruff 0.17.2, mypy 1.20.2).
- Frontend instalado con `npm ci` (396 paquetes, `package-lock.json`).

## Comandos y resultados

### Backend (`backend/`)

```sh
uv sync --locked --python 3.12
uv run --locked pytest tests -q
uv run --locked ruff check src tests
uv run --locked ruff format --check src tests
uv run --locked mypy
```

Resultado final:

- `pytest`: **324 passed** en 51,67 s.
- `ruff check`: **All checks passed**.
- `ruff format --check`: **32 files already formatted**.
- `mypy`: **Success: no issues found in 19 source files**.

### Frontend (`frontend/`)

```sh
npm ci
npm test
npm run typecheck
npm run build
```

Resultado:

- `npm test`: **101 passed**, 0 failed en 2,53 s.
- `npm run typecheck`: sin errores.
- `npm run build`: correcto; 2.696 módulos transformados y bundles de red, mapa y comparación generados.

## Incidencia encontrada y corrección

La primera ejecución backend dio **323 passed, 1 failed**:

```text
AssertionError: assert '3.12.15' == '3.12.14'
tests/test_exports.py:51: test_full_schema_and_real_manifest
```

La prueba fijaba el parche exacto de Python, pero el proyecto solo exige la serie 3.12 (`requires-python ==3.12.*` y `.python-version` `3.12`). El manifiesto era correcto para el intérprete en uso. Se cambió la aserción para comparar contra `sys.version_info` del proceso que ejecuta la prueba; así se sigue verificando que el manifiesto registra la versión real sin romper en otro parche 3.12.x. No se cambió código de producción.

## Documentación registrada

- Nueva feature **P-09 — Mapa geográfico y capa de agentes**: [ficha](../specs/p09-geographic-map.md).
- Actualizados: [hoja de ruta PRO](../../specs/pro-roadmap.md), [frentes PRO](../../specs/pro-workstreams.md) con tabla de trazabilidad, [tareas](../../specs/tasks.md), [PRD §4.2](../../PRD.md), [índice de specs](../../specs/README.md), [procedencia geográfica](../manta-geography.md), [lectura y PRO](../lectura-y-pro.md), [README raíz](../../README.md) y [README frontend](../../frontend/README.md).
- P-09 queda como presentación verificada localmente; no altera modelo, contratos ni hashes y no acredita P-05/P-06/P-08.

## Conclusión para continuar PRO

La base local está verde y sirve para avanzar sin deuda de pruebas conocida. Orden sugerido tras esta verificación:

1. **P-02** — completar política adaptativa explícita, reglas, motivos y comparación reproducible.
2. **P-05** — investigar una serie oficial utilizable de dengue en Manabí antes de P-06.
3. **P-03** — contratos y ejecución local de jobs Monte Carlo antes de P-04.
4. **P-07** — cerrar aceptación de animación/rendimiento sin mezclarla con P-09.
5. **P-08** — informe PDF cuando exista un experimento validado que citar.

Siguen sin verificar: AWS, despliegue, datos reales, calibración, jobs y gate científico T-22. Este documento no los declara resueltos.
