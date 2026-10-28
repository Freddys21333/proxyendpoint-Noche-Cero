# Rendimiento completo de API local

Estado actual: incremento 2026-10-28 verificado localmente; ≤25 s observado en 6/6 comparaciones (n=3 por modo); aceptación de rendimiento en staging/AWS pendiente. Antecedente: medición 2026-10-27. Solicitud explícita: medir recepción, simulación, exportación/validación, serialización, gzip, transferencia y lectura del resultado. RNF-04 / I-01; sin AWS ni cambio de protocolo T-22.

Se medirá por HTTP real en loopback con servidor aislado, defaults publicados N1000/T90/R30 y semilla sin cambios; modos sin frames y con frames, tal como los consume la UI. Registrar preview y comparación por separado, primera respuesta y repeticiones secuenciales; mediana, máximo y percentil descriptivo con n visible. Un n local reducido no equivale a las 20 ejecuciones de staging del TRD ni certifica p95 AWS.

Instrumentación solo en el ejecutable de benchmark, no en el contrato público: envoltorios temporales miden funciones originales sin cambiar argumentos/resultados; sin caches de simulaciones. Se conserva estado de RNG y se restaura cada función al finalizar. Medir tiempo hasta cabeceras, recepción de cuerpo comprimido, descompresión y parseo; validación/reproducción adicional de evidencia se declara fuera del cronómetro HTTP. No incluir renderizado de UI en tiempos backend.

Aceptar solo respuestas completas, hashes coincidentes entre repeticiones/modos y datos derivados coherentes. Guardar JSON fuente y reporte en `.tools/`, resumen sin secretos en `docs/evidencia/`. Si se optimiza, comparar antes/después misma configuración y conservar JSON descomprimido, hashes, límites y errores 413. Ningún timeout se amplía para ocultar un incumplimiento.

Primer hallazgo: el costo principal adicional al motor es validación/exportación, no gzip. La optimización mantiene Draft202012Validator y su respaldo: solo evita crear validadores por propiedades escalares nativas que satisfacen subesquemas planos exactos (enteros/números con límites y enums de cadenas). `required`, campos extra, formatos y restricciones adicionales conservan su recorrido normal. Context se resuelve en la copia privada únicamente si coincide su definición plana y sin recursos `$id` internos. No se cambian cálculos, respuestas, límites, nivel de gzip ni esquema compartido.

Segundo cambio interno: `prepare_experiment` produce documento y JSON final validados; la ruta compare entrega inmediatamente esos bytes a `_response`, evitando serializar otra vez después de comprobar el tamaño. La función pública `export_experiment` conserva su retorno dict; no hay cache global, no se reutilizan simulaciones y no se modifican documentos después de prepararlos. Las validaciones de tamaño decodificado y envoltorio proxy se siguen aplicando a los bytes reales. Pruebas exigen igualdad completa de respuesta gzip/base64 entre ambos caminos y rechazo 413 idéntico.

Evidencia: [mediciones completas y límites](../docs/evidencia/api-performance-2026-10-27.md). 478 pruebas backend pasan; hash y documentos conservados.

## Iteración 2026-10-28, verificada localmente

Aceptación: medir antes/después sobre el mismo árbol fusionado, N1000/T90/R30, sin/con frames; preservar todos los datos, hashes, límites y diagnósticos. Reducir el recorrido de listas de registros planos solo si el esquema soportado y cada valor cumplen exactamente las restricciones; cualquier estructura no soportada vuelve a Draft. Medir además PDF HTTP, ZIP local (no existe endpoint ZIP) y ciclo de jobs local, distinguiendo creación, espera y descarga. No declarar p95 de staging desde muestras locales ni usar CPU/tiempo del script como aceptación humana.

Resultado: [mediciones y límites](../docs/evidencia/rendimiento-backend-2026-10-28.md). Medianas sin/con frames 18,46/19,56 s; PDF 4,94 s, ZIP local 4,36 s. Jobs N1000/T90/R30 rechazados por límite existente; medición con R9 y tres trabajos sobre dos workers. 510 pruebas backend, Ruff/mypy correctos, documentos/PDF/ZIP/hashes conservados. No se certifica p95 staging.
