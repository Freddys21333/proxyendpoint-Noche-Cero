# I-01: rendimiento del motor

**Fecha:** 2026-10-27.
**Alcance:** optimizar el recorrido de aristas del motor SEIR sin cambiar resultados, semillas, hashes ni contratos. **No se ejecutó T-22 ni AWS.**

## 1. Problema de partida

El benchmark documentado en la [auditoría PRO](auditoria-pro-2026-10-27.md) tardó **377,9 s** para el escenario por defecto (`N=1000`, `T=90`, `R=30`, semilla `20261026`, sin frames). El perfil mostró que `step_day` consumía la mayor parte del tiempo recorriendo ~59.373 aristas en Python puro, día, política y réplica.

## 2. Cambios realizados

- `step_day` usa una vista NumPy de las aristas y máscaras vectorizadas para transmisión, progresión y selección de la arista de menor ID por destino.
- `_EdgeIndex` valida y precomputa aristas y días activos una vez por experimento.
- Cada política recibe una copia aislada de los pesos; la topología y los días activos se comparten.
- `Potentials.randomness_hash` se calcula una vez por réplica mediante `cached_property`.
- Se conserva la ruta de referencia conceptual: la semántica de contacto, el desempate por `edgeId` y el umbral estricto no cambian.
- Nuevo `scripts/benchmark_engine.py` para repetir la medición y guardar JSON.

## 3. Verificación de equivalencia

Se cargó la versión anterior de `engine.py` desde Git y se comparó el hash completo de las trazas (`daily`, `events`, `frames`, `entries`, `selections`, hashes) contra la versión nueva:

| Caso | Réplicas | Resultado |
|---|---:|---|
| Base `N=50`, `T=7`, vacunas 10 | 2 | hash idéntico |
| Combinado con presupuesto, cierre y brigadas | 2 | hash idéntico |
| Default `N=1000`, `T=90` | 0 y 2 | hash idéntico |

También se verificaron los conteos y hashes del benchmark: `none=723,7`, `random=575,1`, `targeted=378,1`, ganancia `196,97`, IC `81,62–309,59` y `targetedWinRateVsRandom=0,7333`. Son los mismos valores de la auditoría de partida.

## 4. Resultado medido

Comando:

```sh
backend/.venv/bin/python scripts/benchmark_engine.py --repetitions 30 \
  --output docs/evidencia/benchmark-default-2026-10-27-after.json
```

Resultado de la corrida registrada:

- Duración: **44,319 s**.
- `none`: media 723,7.
- `random`: media 575,1.
- `targeted`: media 378,13.
- Ganancia pareada `targeted - random`: 196,97.
- IC bootstrap 95 %: 81,62 a 309,59.
- `targeted` gana a `random` en 22/30 réplicas (73,3 %).
- Recomendación: `targeted`, confianza `supported`.
- Reducción aproximada: **8,5×** frente a los 377,9 s de partida.

El desglose orientativo de una corrida manual fue: generación de grafo ~6,5 s, ejecución de 30 réplicas ~31,9 s, agregación ~0,4 s y representativa ~1,3 s. La variación entre corridas es esperable por carga del equipo; el orden de magnitud se mantiene.

## 5. Límites

- **No se alcanzó el objetivo de ≤25 s backend** del TRD; sí se cumplió el objetivo local de ≤60 s total. Antes de P-04 hay que decidir si se optimiza más o si el flujo asíncrono absorbe el costo.
- El benchmark es local, no Lambda/API Gateway ni una prueba de 5 minutos.
- T-22 sigue pendiente; no se declara gate científico.
- La optimización no cambia el modelo, pero cualquier cambio futuro del motor debe repetir la comparación de hashes.

## 6. Próximo paso

Ejecutar T-22 v1 completo con el motor optimizado, registrar el gate y continuar con P-02. No se inicia P-04 hasta cerrar rendimiento y T-22.
