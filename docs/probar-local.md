# Probar el sitio local

La versión revisada funciona con la API local y Vite. No requiere desplegar AWS.

## Abrir

Con los servicios iniciados, entra a **http://127.0.0.1:5174**. La API responde en http://127.0.0.1:8000/v1/health.

Si necesitas iniciarlos, abre dos terminales desde la raíz del repositorio:

```powershell
backend/.venv/Scripts/python.exe scripts/serve_api.py
```

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

## Recorrido principal

1. Espera «Servidor disponible».
2. Ajusta el escenario y pulsa «Consultar red».
3. Pulsa «Comparar estrategias». Se ejecutan las tres políticas con la misma configuración; espera el resultado.
4. Revisa medias, variación y diferencias. Vuelve a «Explorar red» y abre «Reproducción y estrategia» para recorrer los días de una réplica.
5. Descarga JSON para reproducir, ZIP para analizar tablas y PDF/HTML para leer el informe.

Para una prueba rápida puedes usar 60 personas, 7 días y 10 dosis. El escenario predeterminado de 1000 personas/90 días/30 repeticiones también se comprobó. Cambiar parámetros invalida la red y comparación anteriores: consulta la red de nuevo.

## Trabajos PRO

Consulta primero la red y abre PRO. El formulario muestra el máximo admitido **para esa red**, calculado con los límites publicados por la API. En el escenario predeterminado revisado, el máximo local es 9 réplicas por trabajo; no es un máximo universal. Si escribiste más, el valor se conserva y se explica cómo corregirlo. Puedes elegir la cantidad rápida 2 para probar.

La semilla corresponde a la vista previa. Para cambiarla, ve a «Explorar red» → «Parámetros avanzados», edita la semilla y vuelve a consultar la red. Después inicia el trabajo, espera a que complete y pulsa «Leer resultado completo». También puedes cancelar y reintentar.

Los trabajos son locales y viven en memoria: reiniciar la API los elimina. Recargar la página conserva el acceso a los trabajos de esta sesión si el servidor sigue funcionando. Quitar un trabajo de la sesión no equivale a eliminarlo del servidor; hay límites de retención y cola.

## Errores y límites visibles

- Un campo inválido conserva el valor y evita enviar la consulta hasta corregirlo.
- Ante un problema de conexión, conserva las entradas, inicia/revisa la API y vuelve a consultar la red.
- Presupuesto agotado puede impedir acciones aunque haya inventario; no es un error del simulador.
- Si ya no quedan susceptibles, las dosis restantes pueden quedar sin usar.
- El presupuesto y los costos del simulador son educativos. El mapa y las posiciones son sintéticos; las teselas de OSM necesitan conexión y la vista Red permanece como alternativa.

## Repetir las comprobaciones técnicas

Desde la raíz, con ambos servicios activos:

```powershell
node --experimental-strip-types scripts/verify_local_integration.mjs http://127.0.0.1:5174/v1
$env:API_BASE='http://127.0.0.1:5174/v1'
node --experimental-strip-types scripts/verify_adaptive_integration.mjs
node --experimental-strip-types scripts/verify_jobs_flow.mjs
```

Prueba opcional en Edge mediante Playwright CLI:

```powershell
npx --yes @playwright/cli -s=local-check open http://127.0.0.1:5174 --browser=msedge
npx --yes @playwright/cli -s=local-check run-code --filename=scripts/verify_local_stability.browser.js
```

El guion usa datos sintéticos, crea un trabajo local y descarga archivos al directorio de pruebas del navegador. No es una prueba humana ni un benchmark de AWS. [Resultados observados, hashes y pendientes](evidencia/estabilidad-local-2026-10-28.md).
