# Rendimiento de carga/exportación sin cambios científicos · 2026-10-27

Estado: verificado localmente. [Aceptación](../../specs/performance-exports.md) y [mediciones completas](rendimiento-validacion-2026-10-27.json). Sin cambios del motor, RNG, cálculos, escenarios, semillas, versiones científicas o protocolo T-22. No se desplegó AWS.

## Perfil y cambio

El perfil de una exportación real pequeña mostró `validate_contract` como costo dominante, con dos invocaciones completas consecutivas desde `load_export`. Se elimina la primera: `_validate` conserva esquema, hashes y control temporal P-07.

Se mantiene jsonschema 4.26.0. La extensión de validación solo acelera arrays de enteros nativos 0..180 y arrays de los cuatro estados SEIR cuando el subesquema coincide exactamente. Booleanos, floats y otros casos pasan por la implementación estándar; por ejemplo, 1.0 conserva la semántica de entero de JSON Schema. Longitud, duplicados, formatos, campos desconocidos, finitud, lectura JSON estricta, hashes y causalidad temporal siguen comprobándose.

La referencia plana State se resuelve una vez sobre una copia privada del esquema, sin cambiar archivos, definiciones compartidas ni datos; se desactiva esa transformación si cambia la definición o hay recursos `$id` internos. Los errores conservan la ruta estándar. No hay nuevas dependencias.

## Mediciones sobre el mismo archivo

Windows 11, Python 3.12.14, NumPy 2.5.4. Fuente real N1000/T90/**R2**, semilla 20261026, 100 dosis, frames presentes, 7.582.827 bytes. Hash `sha256:552ee085bd085acb0a6212471af25fd8d63f621c64510b7185200065a122f4df`.

| Operación | Antes: primera tanda | Después: primera tanda final | Antes: repetición secuencial | Después: repetición secuencial |
|---|---:|---:|---:|---:|
| Carga completa | 32,75 s | 6,17 s | 44,36 s | **6,05 s** |
| Reexportación | 21,51 s | 13,28 s | 18,18 s | **12,14 s** |

La repetición secuencial usa una copia del código confirmado en `5822783` y el código actual, ejecutados uno después del otro con el mismo archivo. Son mediciones individuales con variación del equipo, no p95 ni garantías de latencia. La primera mejora es aproximadamente 5,3× en carga; la repetición muestra 7,3×. La reexportación mejora entre 1,5× y 1,6×.

El benchmark exige igualdad de diccionarios y bytes canónicos completos entre fuente y reexportación, restaurando únicamente `generatedAt` para comparar esa propiedad volátil. El hash científico coincide sin normalizaciones adicionales. El tiempo de exportar incluye copia, metadatos, validación y tamaño del documento; no es solo serialización JSON.

Comando actual desde raíz:

```powershell
backend/.venv/Scripts/python.exe -X utf8 scripts/benchmark_exports.py .tools/p07-backend/experiment.json --output .tools/exports-after-controlled.json
```

La fuente puede regenerarse con `scripts/verify_playback.py`. Código anterior usado: `.tools/performance-baseline-5822783`, preparado con `git archive HEAD backend/src schemas scripts/benchmark_engine.py` antes de este commit y una copia del mismo benchmark de exportación. Datos grandes y perfiles permanecen en `.tools/`.

## Motor: comprobación independiente antes/después

Se ejecutó el benchmark por defecto **N1000/T90/R30**, semilla 20261026, sin frames, en procesos separados y secuenciales sobre ambas versiones:

```powershell
backend/.venv/Scripts/python.exe -X utf8 scripts/benchmark_engine.py --output .tools/engine-after-controlled.json
```

- Antes: **13,603 s**; después: **13,796 s**. Diferencia pequeña entre ejecuciones; no se atribuye una mejora al motor.
- Configuración, `graphHash`, `randomnessHash`, estadísticas, todas las diferencias pareadas, intervalos y recomendación: **idénticos**.
- Infectados medios: sin intervención 723,7; aleatoria 575,1; dirigida 378,13. Se mantienen empates y pérdidas en las diferencias pareadas del JSON adjunto.
- La referencia histórica de 44,319 s procede de **Linux 7.2.12**, no del Windows actual. No se compara como una aceleración producida por este cambio. El objetivo ≤25 s se observó en esta corrida local del motor; no demuestra p95, tiempo HTTP total ni rendimiento AWS.
- La consola Windows CP1252 falló inicialmente al imprimir el signo Unicode de los motivos, después de escribir correctamente el JSON. Se repitieron los comandos con `-X utf8`; la comparación usa los archivos JSON, no texto de consola incompleto.

## Corrección y reproducción

Antes: 418 pruebas backend pasan. Las 14 pruebas iniciales de equivalencia con Draft estándar pasaban antes del cambio y fijaron el comportamiento que se debía conservar; esta optimización no introduce comportamiento funcional nuevo y no se inventa una fase roja.

Después: **443 pruebas backend pasan** (53,27 s), Ruff y formato correctos, mypy sin problemas en 27 archivos. Los 25 casos nuevos comparan con Draft202012Validator independiente para límites, tipos, booleanos, float integral, duplicados, estados inválidos, longitudes y conservación del esquema compartido. Las pruebas existentes de motor, cálculos, inventario, costos, adaptación, exportación, hashes, reproducción y PDF permanecen verdes.

```powershell
# Desde backend/
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m ruff check src tests
.venv/Scripts/python.exe -m ruff format --check src tests
.venv/Scripts/python.exe -m mypy

# Desde raíz: proceso nuevo, reconstruye y compara todos los resultados
backend/.venv/Scripts/python.exe -X utf8 scripts/reproduce.py .tools/p07-backend/experiment.json
backend/.venv/Scripts/python.exe -X utf8 scripts/reproduce.py .tools/p08-final/experiment.json
```

Ambas reproducciones pasan: hash base `552ee085…f4df`; PRO con presupuesto/entregas R30 `646b5928…bee1`. El CLI compara también eventos, frames y derivados, además del hash científico.

API aislada `:18008`: pasan `verify_local_integration.mjs`, `verify_adaptive_integration.mjs` y `verify_jobs_flow.mjs`, usando el cliente frontend real. Los hashes de los escenarios manual, cero dosis, transmisión cero, adaptación y job coinciden con los registrados antes de optimizar. Informe `.tools/validation-2026-10-28T00-43-29.914Z/report.json` (marca UTC; fecha local 2026-10-27). No se modificó frontend.

## Pendientes

No se ejecutó T-22 completo ni se aprobaron gates científicos. Los JSON grandes aún tienen costo apreciable de carga/exportación y consumo de memoria. Los resultados no acreditan capacidad AWS, latencia p95 ni aceptación humana. La validación estándar permanece como respaldo de entradas no reconocidas; cualquier ampliación del esquema debe conservar las pruebas de equivalencia.
