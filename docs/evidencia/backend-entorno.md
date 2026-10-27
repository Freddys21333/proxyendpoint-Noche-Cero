# Verificación del entorno backend — T-02

Fecha: 26 de octubre de 2026. Sistema: Windows x86_64, PowerShell. Rama de trabajo: `feat/backend-contratos`. Alcance: entorno local, sin recursos ni credenciales AWS.

## Instalación observada

Se instaló uv 0.13.5 en `.tools/`. Se resolvieron las dependencias con Python 3.12.14 y se creó `backend/.venv`. Tras fijar las versiones directas, se regeneró `backend/uv.lock` desde caché y se ejecutó `uv sync --locked --offline` correctamente: 16 paquetes resueltos, 15 dependencias instaladas/comprobadas.

Se usó el intérprete existente `C:\Users\Carlos.Rezabala\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`; es una ruta de esta máquina, no un requisito portable del repositorio. El Python global 3.15 no se usó para ejecutar el backend.

La comprobación de importación confirmó Python 3.12.14, NumPy 2.5.4 y NetworkX 3.7. Las versiones de herramientas se consultaron mediante `importlib.metadata`: pytest 9.1.1, Ruff 0.17.2 y mypy 1.20.2.

## Comandos y resultados

Ejecutados desde `backend/`, con el entorno ya instalado:

| Comando | Resultado observado |
|---|---|
| `..\.tools\bin\uv.exe lock --check --offline --cache-dir ../.uv-cache` | Código 0; lock coherente; 16 paquetes resueltos. |
| `.\.venv\Scripts\python.exe -m ruff check src tests` | Código 0; All checks passed. |
| `.\.venv\Scripts\python.exe -m ruff format --check src tests` | Código 0; cuatro archivos ya formateados. |
| `.\.venv\Scripts\python.exe -m mypy` | Código 0; sin problemas en cuatro archivos fuente. |
| `.\.venv\Scripts\python.exe -m pytest --collect-only tests` | Código 5; cero pruebas recolectadas. Runner operativo, suite de comportamiento aún inexistente. |

Los comandos equivalentes mediante `uv run --locked --offline` del README se verifican usando la misma instalación y configuración. El entorno es un proyecto sin empaquetado instalable (`tool.uv.package=false`); los módulos iniciales contienen únicamente documentación de su responsabilidad.

## Límites de esta evidencia

No se validó motor, API, esquema, rendimiento ni despliegue. No se ejecutó TDD porque no se añadió comportamiento. La variante de instalación Linux/macOS y el build Lambda quedan pendientes de sus respectivas tareas. El archivo de bloqueo incluye artefactos de otras plataformas, pero esto no sustituye probarlos allí.
