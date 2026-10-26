# Backend

Entorno inicial de T-02. Python **3.12**, NumPy y NetworkX para el motor; pytest para TDD, Ruff para lint/formato y mypy en modo estricto. Todavía no hay endpoints, contratos ejecutables ni simulación implementados.

## Instalación en Windows (PowerShell)

Desde la raíz del repositorio, instalar uv localmente. `.tools/`, `.uv-cache/` y `.venv/` están excluidos de Git:

```powershell
python -m pip install --target .tools uv==0.13.5
cd backend
..\.tools\bin\uv.exe sync --locked --python 3.12 --cache-dir ../.uv-cache
```

Si no encuentra Python 3.12, uv puede descargarlo; también se puede indicar un intérprete existente con `--python 'C:\ruta\a\python.exe'`. No usar el Python 3.15 predeterminado para el backend. La instalación verificada en este equipo usa Python 3.12.14 con la ruta explícita del runtime disponible.

En Linux/macOS, con uv 0.13.5 disponible y Python 3.12, ejecutar `uv sync --locked` desde `backend/`. Esta variante no se ha ejecutado en esta preparación; el empaquetado Linux de Lambda se verificará por separado.

`pyproject.toml` fija las dependencias directas. `uv.lock` fija las versiones transitivas y hashes de los artefactos para los distintos sistemas soportados. Ambos se versionan. Los paquetes de desarrollo no forman parte del futuro artefacto Lambda.

## Verificaciones

Desde `backend/`, sin activar manualmente el entorno virtual:

```powershell
..\.tools\bin\uv.exe lock --check --offline --cache-dir ../.uv-cache
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache ruff check src tests
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache ruff format --check src tests
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache mypy
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache pytest tests
```

El modo offline requiere haber instalado las dependencias primero. Actualmente `pytest tests` devuelve **5: no hay pruebas**; no significa que una suite haya pasado. No normalizar ese código en el pipeline futuro: al agregar comportamiento se deben incorporar pruebas reales y exigir código 0. Para inspeccionar la colección se puede ejecutar `pytest --collect-only tests` con el mismo prefijo uv.

La estructura `src/domain`, `src/simulation`, `src/strategies` y `src/api` es importable. Pytest agrega `src` a su ruta de importación; no hace falta instalar un paquete editable. La distribución de Lambda conservará esos módulos en la raíz del ZIP.

## Dependencias y actualizaciones

Dependencias principales verificadas: NumPy 2.5.4 y NetworkX 3.7. Herramientas: pytest 9.1.1, Ruff 0.17.2, mypy 1.20.2 y types-networkx 3.6.1.20261024. uv usado: 0.13.5.

Cuando se cambie una dependencia, actualizar su versión en `pyproject.toml`, ejecutar `uv lock`, sincronizar y verificar. No editar `uv.lock` manualmente ni actualizarlo silenciosamente al ejecutar checks. Cualquier cambio que altere resultados del motor necesitará evidencia y versión coherentes con el manifiesto.

## Siguiente tarea

T-03: materializar [los acuerdos](../specs/agreements.md) en OpenAPI, JSON Schema y ejemplos. Después, T-04 implementa configuración canónica con pruebas que fallen primero por el comportamiento ausente. No se agregan tests artificiales de carpetas ni un motor de ejemplo para cerrar T-02.

Resultado observado de esta preparación: [evidencia de T-02](../docs/evidencia/backend-entorno.md).
