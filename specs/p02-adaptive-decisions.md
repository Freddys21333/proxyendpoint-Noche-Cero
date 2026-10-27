# P-02: Política adaptativa observable (PRO-3)

Estado: **en especificación e implementación backend**.
Dependencia: P-01 (inventario y calendario de entregas) y modelo educativo de intervenciones combinadas.

## 1. Motivación y objetivo

En la versión base y en P-01:
- Las vacunas siguen calendarios fijos (día de intervención y días subsecuentes de entrega).
- Los cierres y brigadas se ejecutan rígidamente dentro de ventanas predeterminadas (`closureStart..closureStart+closureDays`, `brigadeStart..brigadeStart+brigadeDays`).
- Las brigadas seleccionan susceptibles por grado hacia susceptibles (`S-S`), pero no evalúan si el brote está acelerando, estancado o extinto.

**P-02 introduce la toma de decisiones basada en el estado observado día a día:**
1. **Observabilidad sin mirar el futuro:** Al inicio de cada día $d$, el tomador de decisiones observa el snapshot actual: conteos de $S$, $E$, $I$, $R$, tasa de positividad/infecciosos activos ($I_t / N$), casos nuevos detectados e inventario/presupuesto remanente. No tiene acceso a potenciales futuros de transmisión, progresión ni eficacia.
2. **Gatillos adaptativos (Threshold triggers):**
   - **Cierre preventivo o de emergencia:** Se activa si $I_t / N \ge \text{threshold}$ y se desactiva/reabre cuando $I_t / N < \text{threshold}$ o se agota el presupuesto.
   - **Modulación de brigadas:** Aumenta o focaliza la capacidad de brigadas cuando la transmisión es activa ($I > 0$).
   - **Priorización de vacunas en anillo / cerco epidemiológico:** En política adaptativa, se prioriza vacunar a susceptibles que tienen contacto directo con nodos infecciosos conocidos o nodos en contextos con brote activo (ring vaccination).
3. **Registro explicativo de decisiones:**
   - Para cada día de decisión se registra la acción adaptativa, el motivo explícito ("cierre_activado_por_umbral", "presupuesto_insuficiente", "brote_bajo_control", "priorizacion_anillo"), el gasto realizado y los recursos consumidos.

## 2. Contrato y esquema de datos

Se define la configuración adaptativa opcional en `intervention.combined.adaptiveStrategy` (o modelo versionado `adaptive-policy-v1`).
Si no se especifica, se mantiene el comportamiento estándar de P-01 y base sin cambios ni alteración de hashes.

Campos del modelo adaptativo:
- `modelVersion`: `"adaptive-policy-v1"`
- `closureInfectionThreshold`: float $0.0..1.0$ (fracción de infectados $I/N$ para activar cierre de contexto dinámico). Default: $0.05$ (5%).
- `reopenInfectionThreshold`: float $0.0..1.0$ (fracción de infectados para reabrir). Default: $0.02$ (2%).
- `ringVaccinationPriority`: boolean. Si es `True`, se priorizan susceptibles que tienen aristas activas hacia nodos $I$ (contacto directo con infecciosos).
- `enabled`: boolean.

## 3. Acciones diarias adaptativas y trazabilidad

Cada día $d$:
1. Se calculan las métricas observables del día $d$:
   - $S, E, I, R$ actuales.
   - Proporción infecciosa: $I / N$.
2. Decisión de Cierre:
   - Si $I / N \ge \text{closureInfectionThreshold}$ y no está cerrado: activar cierre si hay presupuesto.
   - Si $I / N < \text{reopenInfectionThreshold}$ y está cerrado: reabrir para ahorrar presupuesto.
3. Decisión de Vacunación:
   - Si `ringVaccinationPriority` está activo:
     - Nodos $S$ con vecinos $I$ reciben puntuación prioritaria (anillo de contención).
     - Si sobran dosis, se continúa con la heurística de mayor conectividad hacia susceptibles ($S-S$).
4. Decisión de Brigadas:
   - Si $I == 0$ (brote contenido): se suspenden brigadas para no malgastar insumos/presupuesto (motivo: `outbreak_extinct_hold_supplies`).
   - Si $I > 0$: se despliegan brigadas prioritarias alrededor de los focos infecciosos.
5. Se genera un registro diario de decisión exportable en `adaptiveDecisions`:
   - `day`: int
   - `action`: list[str] (e.g. `["closure", "ring_vaccination", "brigades"]`)
   - `reasons`: list[str]
   - `activeInfectiousFraction`: float
