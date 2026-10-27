# Validación funcional del flujo manual local

Fecha local: 2026-10-27. Base revisada: d16ad7b más corrección de foco de este incremento. API real vía Vite http://127.0.0.1:5174/v1. Motor 0.1.0/schema 1.0. El servidor ya iniciado anuncia build c01385a9ff40399156ac8563aa3bbe63dd60b92c; es su metadato de arranque, no el commit del frontend. No se desplegó AWS.

## Matriz repetible

[scripts/verify_local_integration.mjs](../../scripts/verify_local_integration.mjs) ejecuta el cliente TypeScript real → proxy Vite → handlers/motor. Los casos y semillas están fijados en el script antes de ejecutar; no se buscan resultados favorables. Node 24:

```powershell
.\.tools\node\node.exe --experimental-strip-types scripts/verify_local_integration.mjs
```

Requiere los servidores de desarrollo iniciados según frontend/README.md. Solo admite localhost/127.0.0.1. Guarda JSON, ZIP y report.json en un directorio nuevo bajo .tools (ignorado en Git). No es una suite E2E automatizada de navegador, ni el protocolo científico T-22 ni un benchmark AWS.

| Caso | Parámetros manuales relevantes | Resultado funcional |
|---|---|---|
| manual | N60/T7/R2, beta .12, I0=2, origen persona7, K12/día2/eficacia .5, semilla314159265 | Completo; acumulados medios none5.5/random5.5/targeted5; recomendación descriptiva |
| no-vaccines | Mismo caso con K0 | Empate; series diarias exactamente iguales en las tres políticas por réplica |
| no-transmission | N50/T4/R2, beta0, I0=1, origen mercado, K8/día0/eficacia0, semilla271828182 | Sin nuevos infectados; ninguna dosis efectiva; empate |

Se comprueban conservación S+E+I+R=N, dosis/elegibilidad/día, respuesta completa mediante guardas del cliente, K0 idéntico y beta0 sin nuevos infectados. Casos negativos reales: expectedGraphHash ajeno →409, K>N →422, cuerpo mayor al límite →413. Ninguno se convierte en éxito.

La ejecución observada registró 2641/1947/999 ms respectivamente para preview+comparación+archivos, sin contar interacción humana. Son comprobaciones pequeñas locales, no p95 ni criterios RNF-04/05.

## Exportación y reproducción

Tres JSON reproducidos con scripts/reproduce.py en procesos Python nuevos, con hashes idénticos. Los tres ZIP se abrieron con zipfile de Python: CRC correcto, once archivos, número de filas daily=R*3*(T+1), eventos solo de representativa.

| Caso | experimentHash |
|---|---|
| manual | sha256:c860fa7271bfce0378b575f18d2f5bc02e5300654141c9c3f5b437b7835baf39 |
| no-vaccines | sha256:f6a8d2949c093b4423069287751339486535bfbd39bb2f623ee94a371f41299e |
| no-transmission | sha256:d21667873a4e9841fd91a72826b9dbc57977fda77a77cfd7ca330075e976bc33 |

La interfaz produjo el mismo hash manual. Se descargaron realmente desde sus botones manta-experiment-314159265.json y .zip. El JSON descargado reprodujo su hash en otro proceso; el ZIP descargado pasó CRC, once archivos, misma configuración/hash y 48 filas diarias. No se confunde el ZIP generado por CLI con la descarga del navegador.

## Interacción observada en navegador

- Editar parámetros, origen persona7, I0=2, intervención día2, eficacia50%, semilla nueva; escribir semilla con teclado y Tab/Enter hasta Consultar red. Preview60 personas, 522 contactos de unión y origen7,14.
- Comparar: medias y hash coinciden con el cliente de la matriz. Descarga JSON/ZIP real, lectura y reproducción verificadas.
- Representativa0: día2 S53/E2/I0/R5; 12 dosis asignadas,3 efectivas; día7 S52/E1/I2/R5. Conteos no se confunden con medias de 2 réplicas.
- Cambiar K a61 con N60: invalidación inmediata del preview/resultados, compare deshabilitado; formulario conserva61 y navegador muestra “El valor debe ser menor de o igual a60”, enfocando vacunas. Comparación muestra ausencia de resultado vigente. Volver al formulario conserva parámetros y semilla.
- Caso K0 también ejecutado manualmente en la UI: empate, medias5.5 en todas las políticas y hash f6a8d2949c093b4423069287751339486535bfbd39bb2f623ee94a371f41299e coincidente con la matriz. Tabla equivalente de Zombies accesible con Enter: ocho días y valores idénticos entre políticas.
- Ayuda abierta con Enter y cerrada con Escape devuelve el foco al botón Ayuda.
- Escape en preview antes de la corrección devolvía foco a la página. Se corrigió y se confirmó regreso al botón Consultar red.

## Corrección de foco

App conserva el destino lógico del diálogo. Para el preview resuelve el ref vigente al cerrar, porque el formulario puede reemplazarse al pasar de demo a red real. Conservar el elemento anterior no funcionaba: ya estaba desconectado. Ayuda/Exportar conservan su control de apertura y solo restauran si sigue conectado. Se usa finalFocus de Base UI según sus tipos locales. Build/TypeScript y 69 pruebas frontend correctos. La regresión de foco se verificó en navegador; no se la presenta como cubierta por las pruebas unitarias de dominio.

## Límites de esta validación

Las semillas nuevas las eligió el operador, no un jurado externo. No hay prueba moderada con un usuario ni certificación AA/contraste completa; no se declara cumplido el tiempo humano≤3min o<5min por el tiempo del script. Falta cerrar casos UI de pérdida, todos los errores y respuestas tardías en una suite automatizada de navegador. T-14..16 siguen abiertos según esos criterios; T-22 requiere su propia matriz predefinida con R30 y análisis científico. AWS, costos, IAM, HTTPS público y rendimiento N1000/T90/R30 siguen pendientes. No se cambia alcance a PRO.
