# P-06: SEIR calibrado contra dengue de Manabí y preset versionado

**Fecha:** 2026-10-27
**Rama:** `feat/backend-contratos`
**Iteración:** I-05 del [plan PRO](../plan-pro-iteraciones.md)
**Hito:** existe un ajuste reproducible de la forma SEIR del motor a los casos notificados de Manabí (P-05), con ventanas de ajuste y validación fijadas antes de mirar resultados, incertidumbre por bootstrap, perfil de verosimilitud publicado y un preset versionado para la UI. **El resultado de validación es desfavorable** y se publica tal cual: el preset queda `fitted-not-validated`, no «calibrado y validado».

## 1. Qué se entregó

| Pieza | Archivo | Función |
|---|---|---|
| Lógica pura | `backend/src/data/calibration.py` | SEIR semanal, verosimilitud NB, `fit`, `profile_beta`, bootstrap, intervalos predictivos, métricas y referencias. Sin red, sin PDF, sin estado global. |
| Pruebas | `backend/tests/test_p06_calibration.py` | 22 pruebas que fijan el protocolo, el resultado desfavorable y el contrato del preset. |
| Pipeline | `scripts/p06_calibrate.py` | `fit`, `verify`, `summary`; identificabilidad y puente al motor. |
| Preset publicado | `data/p06/dengue-preset-v1.json` | Parámetros, ventanas, incertidumbre, métricas, perfil, puente, límites y hashes. |
| Copia para la UI | `frontend/src/lib/dengue-preset.json` | Subconjunto validado por el frontend; se compara con el preset del backend en una prueba. |
| Validador | `frontend/src/lib/dengue-preset.ts` | Lee y valida el preset; traduce `R₀` al escenario del motor. La UI no recalcula nada. |
| Panel | `frontend/src/components/DenguePresetPanel.tsx` (+ `.css`) | Muestra estado, ventanas, error retenido, desviación del motor, identificabilidad y límites; carga y restaura el modo ficticio. |
| Figura | `docs/evidencia/figuras/p06-preset-dengue.jpeg` | Panel real con el preset cargado en el navegador. |

Sin cambios de contrato científico, semillas base, hashes de T-22 ni del motor. El modo ficticio sigue siendo el predeterminado.

## 2. Protocolo y datos

El protocolo se fijó **antes** de ajustar y está en [specs/pro-roadmap.md](../../specs/pro-roadmap.md#p-06--modelo-y-preset-calibrado-validación-fuera-de-muestra-pro-5) (tabla «Protocolo fijado antes de ajustar», 2026-10-27). Resumen:

| Elemento | Decisión |
|---|---|
| Variable observada | Casos semanales notificados de dengue en Manabí (`weekly_cases`, P-05) |
| Modelo | SEIR determinista de mezcla homogénea, pasos diarios, escala provincial |
| Observación | `y_w ~ NB(μ_w, k)` con `μ_w = ρ · Σ_{d∈w} σ·E_d` |
| Fijados | `σ = 0.333333`, `γ = 0.142857` (valores del motor), `N = 1 661 447` |
| Estimados | `β`, `ρ` (dado `N`), `k` en rejilla |
| Semilla inicial | `E₀ = y₁/(7ρσ)`, `I₀ = σE₀/β`; la semana 1 solo condiciona |
| Ventanas | 2025 ajuste S1–S35 / validación S36–S53; 2026 ajuste S1–S27 / validación S28–S41 |
| Referencias | Persistencia (último valor) y media de la ventana de ajuste |
| Incertidumbre | Bootstrap paramétrico determinista, 120 réplicas, semilla 20261027 |
| Preset | `manabi-dengue-2025-v1`, `β_motor = R₀·γ / w̄` |

Datos: `manabi-dengue-weekly-v1`, 94 semanas, SHA-256 `e51b0858624ccd32349e86fcee57777bc1834579b80416e21ce54b1b11d1913a`. La serie es **provincial y preliminar**, sin granularidad de Manta (límite heredado de P-05).

La regla de dos tercios se aplica por número de semanas (`floor(2n/3)`), no por forma de la curva. La semana 1 nunca entra en la verosimilitud porque solo siembra el estado inicial.

## 3. Ajuste

| Año | Ventana | `β` | `ρ\|N` | `k` | `R₀` | log-verosimilitud | Evaluaciones |
|---|---|---|---|---|---|---|---|
| 2025 | S1–S35 | 0.1678562291 | 0.0121826558 | 50 | 1.174994779 | −159.213067 | 1 981 |
| 2026 | S1–S27 | 0.1725914523 | 0.016842195 | 25 | 1.2081413743 | −131.046371 | 1 981 |

`R₀ = β/γ`. El objetivo **no es suave**: `k` se elige en una rejilla discreta, así que el ajuste es una búsqueda en rejilla (48 × 40) más un refinamiento local de patrón. No es una prueba de óptimo global y así se declara.

### Incertidumbre (bootstrap 120 réplicas, semilla 20261027)

| Parámetro (2025) | P05 | Mediana | P95 |
|---|---|---|---|
| `β` | 0.165540 | 0.167856 | 0.169498 |
| `ρ\|N` | 0.011617 | 0.012254 | 0.012790 |
| `R₀` | 1.158782 | 1.174995 | 1.186487 |
| `k` | 25 | 50 | 100 |

El intervalo estrecho de `β` es **condicional al modelo**, no una prueba de que el modelo sea correcto (ver §5).

## 4. Validación fuera de muestra

Ningún parámetro se reajustó en la ventana retenida.

| Año | Ventana | Métrica | Modelo | Persistencia | Media del ajuste |
|---|---|---|---|---|---|
| 2025 | S36–S53 (18) | MAE | **29.53** | **14.22** | 116.96 |
| 2025 | S36–S53 | Cobertura 95 % | 33.3 % | 61.1 % | 0 % |
| 2026 | S28–S41 (14) | MAE | **268.62** | **48.86** | 209.15 |
| 2026 | S28–S41 | Cobertura 95 % | 0 % | 100 % | 0 % |

En ajuste, el modelo tampoco domina: 2025 MAE 73.52 (cobertura 17.6 %) y 2026 MAE 52.68 (cobertura 92.3 %).

**Resultado publicado:** el modelo pierde frente a persistencia en los dos años y su intervalo predictivo casi no cubre la onda retenida. Esto es coherente con un SEIR de mezcla homogénea y parámetros constantes aplicado a una curva con pico y descenso: el mecanismo no reproduce la forma observada. No se re-tuneó, no se cambiaron ventanas y no se probaron semillas hasta encontrar una favorable. Una prueba automatizada fija esa dirección (`validationMae > persistenceMae`).

## 5. Identificabilidad

Perfil de verosimilitud de `β` en 2025 con `ρ` **reoptimizado** y `β` fijo (rejilla declarada de 0.10 a 0.25, 16 puntos):

| `β` | `R₀` | log-verosimilitud | Δ |
|---|---|---|---|
| 0.10 | 0.700 | −5 885.9 | −5 725.0 |
| 0.14 | 0.980 | −232.5 | −71.6 |
| 0.16 | 1.120 | −175.4 | −14.6 |
| **0.17** | **1.190** | **−160.9** | **0.0** |
| 0.18 | 1.260 | −183.3 | −22.4 |
| 0.25 | 1.750 | −288.1 | −127.3 |

- Mover `β` un ±10 % alrededor del óptimo cuesta **−35.46** (arriba) y **−29.51** (abajo) unidades de log-verosimilitud.
- Dentro de 2 unidades de log-verosimilitud solo cabe `β = 0.17`: `identified = true`.
- **Lectura honesta:** el dato determina `β` con precisión *condicionado al modelo de mezcla homogénea*, a `σ`, `γ`, `N` fijos y a la rejilla de `k`. Eso **no** corrige el mal ajuste de §4 ni la confusión estructural `N`–`ρ`: `N` se fijó con la población implícita de las tasas de 2025 y solo se identifica `ρ·N`.
- El perfil se calcula reoptimizando **solo** `ρ`. Una versión anterior reutilizaba la búsqueda de patrón y devolvía el óptimo global etiquetado con otro `β`; el perfil resultaba engañoso. La corrección está cubierta por `test_profile_does_not_escape_to_the_global_optimum`.

## 6. Puente al motor

El preset no puede reproducir la ventana de ajuste: el motor acepta como máximo 180 días y la ventana de 2025 tiene 371. Se traduce `R₀` al motor con el peso medio diario por persona de la red sintética:

| Magnitud | Valor |
|---|---|
| `w̄` (N=1 000, 90 días, semilla 20261026) | 6.5717655556 |
| `R₀` calibrado | 1.174994779 |
| `β_motor = R₀·γ/w̄` | 0.0255420294 (publicado 0.025542) |
| Réplicas del puente | 10 |
| Brotes extintos | 3 (30 %) |
| Crecimiento teórico (mezcla) | 0.0168997 /día |
| Crecimiento mediano en el motor | 0.0109898 /día |
| Cociente | 0.6502960959 |
| Ataque mediano a 90 días | 2.7 % |

El cociente se publica como **desviación entre aproximaciones**, no como validación: la teoría asume mezcla homogénea y un estado casi estacionario, mientras que el motor parte de 3 infecciosos en 1 000 personas sobre una red heterogénea, donde el brote puede apagarse por azar. Las extinciones se cuentan y se muestran.

## 7. Verificación automática

Backend, desde `backend/`:

| Comando | Resultado |
|---|---|
| `pytest -q` | **391 pruebas, 0 fallos** (22 nuevas de P-06) |
| `ruff check src tests ../scripts/p06_calibrate.py` | All checks passed |
| `ruff format --check src tests ../scripts/p06_calibrate.py` | 45 files already formatted |
| `mypy` | Success: no issues found in 24 source files |

Frontend, desde `frontend/`:

| Comando | Resultado |
|---|---|
| `npm test -- --run` | **135 pruebas, 0 fallos** (5 nuevas de P-06) |
| `npm run typecheck` | sin errores |
| `npm run build` | build correcto |

Pipeline, desde la raíz:

```sh
backend/.venv/bin/python scripts/p06_calibrate.py verify
```

Salida real (2026-10-27):

```json
{"status":"passed","presetId":"manabi-dengue-2025-v1","hash":"sha256:2cde2f34eb1c088611d4f6714756e67d4cec980b8b0a349d0e323fbd56cf8aab","fits":[{"year":2025,"beta":0.1678562291,"reporting":0.0121826558,"r0":1.174994779,"validationMae":29.5293446741,"validationCoverage95":0.3333333333},{"year":2026,"beta":0.1725914523,"reporting":0.016842195,"r0":1.2081413743,"validationMae":268.6159791177,"validationCoverage95":0.0}],"engineBeta":0.025542,"bridgeRatio":0.6502960959,"bridgeExtinctions":3,"identifiabilityWindow":{"min":0.17,"max":0.17,"count":1}}
```

`verify` recalcula el preset completo desde el CSV de P-05 y falla si cambia el hash del dataset, el hash del preset, cualquier parámetro o cualquier métrica.

## 8. Interfaz

El panel «Dengue de Manabí» aparece antes del formulario de escenario y muestra:

- insignia **«Ajustado, no validado»**;
- ventanas `Ajuste S1–S35 · validación S36–S53`;
- `MAE retenido 29,53 · cobertura 95 % 33,33 %`;
- `Motor: 3/10 brotes extintos · crecimiento 0,65× la teoría`;
- identificabilidad condicional y las 9 limitaciones declaradas.

Verificación en navegador real (Chromium de la app, API en `:8000` y Vite en `:5174`):

| Paso | Resultado observado |
|---|---|
| Abrir la vista y leer el panel | Texto anterior completo, sin errores de consola |
| «Cargar preset de dengue» | `β` pasa de 0.08 a 0.03 (0.025542), población 1000, horizonte 90, inicio 3; vacunas 100, eficacia y réplicas intactas; aviso con `R₀ ≈ 1.17` |
| «Consultar red» | `POST /v1/scenarios/preview` → **200** en 12,05 s; 1 000 personas, 59 373 contactos, semilla 20261026 |
| «Volver al brote ficticio» | `β` vuelve a 0.08 y el panel deja de estar activo |

Figura: [p06-preset-dengue.jpeg](figuras/p06-preset-dengue.jpeg).

## 9. Reproducción

```sh
# 1. Reajustar y republicar preset + copia del frontend
backend/.venv/bin/python scripts/p06_calibrate.py fit

# 2. Recalcular desde el CSV y comparar con lo publicado
backend/.venv/bin/python scripts/p06_calibrate.py verify

# 3. Resumen legible por año
backend/.venv/bin/python scripts/p06_calibrate.py summary
```

`fit` es determinista: no hay optimizador estocástico ni semilla de ajuste. El bootstrap usa su propio flujo derivado de `sha256("p06-bootstrap:{seed}:{index}")` con `PCG64`, porque el RNG del motor fija `replicate_index = 0` para el dominio `bootstrap` y repetiría la misma muestra. El flujo queda aislado del motor: no toca semillas, hashes ni fixtures de T-22.

Si cambia la serie de P-05, `verify` falla por hash del dataset. Un cambio de protocolo exige versión nueva (`p06-dengue-preset-v2`) y conservar esta.

## 10. Límites

1. **No es un modelo de dengue.** Es la forma SEIR del motor ajustada a una curva de casos; no incorpora vectores, clima, estacionalidad ni inmunidad específica de serotipo.
2. **La validación es desfavorable.** Pierde frente a persistencia en 2025 y 2026 y el intervalo predictivo no cubre la onda retenida. El preset se etiqueta `fitted-not-validated`.
3. **`N` y `ρ` están confundidos.** Solo se identifica `ρ·N`; `N` se fijó con la población implícita de las tasas de 2025 y se reporta `ρ|N`.
4. **Identificabilidad condicional.** `β` es preciso *dado el modelo*; un parámetro preciso no corrige un modelo mal especificado.
5. **Serie provincial y preliminar.** Sin granularidad de Manta, sin fechas calendario y 2026 solo hasta la SE 41.
6. **El preset no reproduce la ventana de ajuste.** El motor limita a 180 días y 2 000 personas; la ventana de 2025 tiene 371 días. Solo reproduce la dinámica traducida por `R₀` y `w̄`.
7. **El puente es una desviación.** Tasa de crecimiento del motor 0,65× la teoría; 3 de 10 brotes se extinguen por azar con 3 infecciosos iniciales.
8. **Los costos y efectos educativos no se vuelven reales.** Calibrar una curva no valida dosis, eficacia, costos ni recomendaciones.
9. **El objetivo no es suave.** `k` se elige en rejilla y el ajuste es rejilla + refinamiento local: no se demuestra un óptimo global.
10. **El modo ficticio sigue siendo el predeterminado.** El preset es optativo y restaurable.

## 11. Estado de P-06

- [x] Variable observada y función de observación declaradas (`weekly_cases`, NB con `μ_w = ρ·ΣσE_d`).
- [x] Escala y parámetros fijados documentados; `N` fijado con justificación y confusión declarada.
- [x] Ventanas de ajuste y validación separadas antes de observar resultados.
- [x] Identificabilidad (perfil con reoptimización solo de `ρ`) e incertidumbre (bootstrap 120).
- [x] Métricas de ajuste y predicción frente a persistencia y media.
- [x] Resultado desfavorable registrado sin re-tunear.
- [x] Preset `manabi-dengue-2025-v1` versionado, con hashes, rango y límites.
- [x] Otro proceso reproduce el ajuste y la evaluación retenida (`verify`).
- [x] Modo ficticio independiente y predeterminado.
- [x] Panel visible y navegación real en la UI.
- [ ] Aceptación humana integral de T-13..T-16 (no es una prueba de script).
- [ ] Uso del preset en el informe P-08 con cifras y límites.
