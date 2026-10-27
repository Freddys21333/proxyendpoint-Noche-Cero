# P-02: Política adaptativa observable

**Estado:** Implementado  
**Fecha:** 27 de octubre de 2026  
**Referencia:** PRO-3; TRD §6.3  
**Dependencias:** P-01 (inventario diario)

## 1. Propósito y alcance

Formalizar reglas para reasignar recursos (vacunas, brigadas, cierres) según el estado observable del brote: susceptibles, expuestos, infecciosos, recuperados, nuevos casos y saldo de recursos.

La política adaptativa recalcula decisiones cada día basándose únicamente en información observable hasta ese momento, sin conocer el futuro ni los resultados de otras políticas.

---

## 2. Modelo de datos

### 2.1 Configuración

```python
@dataclass(frozen=True, slots=True)
class AdaptiveStrategy:
    model_version: Literal["adaptive-policy-v1"]
    closure_infection_threshold: float
    reopen_infection_threshold: float
    ring_vaccination_priority: bool
    enabled: bool = True
```

**Ubicación:** `backend/src/domain/models.py`

### 2.2 Ejemplo de configuración

```json
{
  "intervention": {
    "combined": {
      "modelVersion": "combined-educational-v1",
      "budgetCents": 50000,
      "adaptiveStrategy": {
        "modelVersion": "adaptive-policy-v1",
        "closureInfectionThreshold": 0.05,
        "reopenInfectionThreshold": 0.02,
        "ringVaccinationPriority": true,
        "enabled": true
      }
    }
  }
}
```

---

## 3. Reglas adaptativas

### 3.1 Cierre dinámico de contexto

**Gatillo de cierre:**
```python
if infectious_fraction >= closure_infection_threshold:
    if remaining_budget >= closure_cost_cents:
        cerrar_contexto()
        registrar("closure_triggered_by_threshold")
    else:
        registrar("closure_budget_exhausted")
```

**Gatillo de reapertura:**
```python
if infectious_fraction < reopen_infection_threshold:
    reabrir_contexto()
    registrar("reopen_triggered_by_threshold")
```

**Características:**
- Se evalúa cada día
- Requiere presupuesto disponible para cerrar
- Reabre automáticamente cuando infecciosos bajan
- Si se agota el presupuesto durante un cierre, se reabre inmediatamente

**Ejemplo:**
- Población: 1000 personas
- `closureInfectionThreshold`: 0.05 (5%) = 50 infecciosos
- `reopenInfectionThreshold`: 0.02 (2%) = 20 infecciosos

Cuando hay ≥50 infecciosos → cierra escuela  
Cuando baja a <20 infecciosos → reabre escuela

### 3.2 Control de brigadas

**Gatillo:**
```python
if current_infectious == 0:
    brigades_allowed = False
    registrar("outbreak_contained_hold_brigades")
```

**Características:**
- Detiene brigadas cuando no hay infecciosos activos
- Ahorra recursos para futuras oleadas
- Se reactiva automáticamente si aparecen nuevos infecciosos

**Justificación:**
Si el brote está completamente contenido (I=0), no tiene sentido desplegar brigadas. Los recursos se conservan para un posible rebrote.

### 3.3 Vacunación de anillo (ring vaccination)

**Gatillo:**
```python
if ring_vaccination_priority and current_infectious > 0:
    priorizar_vecinos_de_infectados()
    registrar("ring_vaccination_active")
```

**Características:**
- Prioriza vacunar susceptibles con contactos directos a infecciosos
- Solo activa cuando hay infecciosos activos
- Cambia el criterio de selección de `targeted` estándar

**Implementación:**
En `strategies/vaccination.py`, cuando `ring_priority=True`:
1. Identificar nodos S con aristas activas hacia nodos I
2. Estos reciben prioridad máxima (desempate: `"ringContact"`)
3. El resto se ordena por suma de pesos S-S como en `targeted` estándar

**Ejemplo:**
- Nodo 5 (S) tiene vecino 3 (I) → prioridad alta
- Nodo 10 (S) tiene muchos vecinos S pero ningún I → prioridad baja

---

## 4. Umbrales recomendados

| Población | Cierre (%) | Reapertura (%) | Justificación |
|---:|---:|---:|---|
| 50-100 | 10% | 4% | Brotes pequeños necesitan respuesta rápida |
| 100-500 | 5% | 2% | Balance entre sensibilidad y recursos |
| 500-1000 | 4% | 1.5% | Poblaciones grandes con más inercia |
| 1000-2000 | 3% | 1% | Umbrales más bajos para evitar saturación |

**Recomendaciones:**
- Umbral de cierre ≥ 2× umbral de reapertura (evitar oscilaciones)
- Ajustar según transmisibilidad: beta alto → umbrales más bajos
- Con presupuesto limitado: umbrales más altos (cierres menos frecuentes)

---

## 5. Exportación de decisiones

### 5.1 Campo `adaptiveDecisions` en daily

Cada día incluye:
```json
{
  "day": 5,
  "s": 800,
  "e": 50,
  "i": 100,
  "r": 50,
  "adaptiveDecisions": {
    "enabled": true,
    "triggers": [
      "closure_triggered_by_threshold",
      "ring_vaccination_active"
    ],
    "infectiousFraction": 0.10,
    "closureActive": true,
    "brigadesAllowed": true,
    "ringVaccinationActive": true
  }
}
```

**Ubicación:** `backend/src/simulation/engine.py`, línea ~355

### 5.2 Archivo CSV `adaptive-decisions.csv`

Columnas:
- `replicateIndex`: índice de réplica
- `policy`: `none`, `random`, `targeted`
- `day`: día de simulación
- `enabled`: si adaptativa está activa
- `infectiousFraction`: fracción I/N
- `closureActive`: si el contexto está cerrado
- `brigadesAllowed`: si brigadas están permitidas
- `ringVaccinationActive`: si ring vaccination está activa
- `triggers`: array JSON de gatillos activados

**Ubicación:** `backend/src/simulation/exports.py`, función `export_zip`

---

## 6. Casos de uso

### 6.1 Brote ascendente con cierre automático

**Configuración:**
```json
{
  "scenario": {"populationSize": 1000, "beta": 0.15},
  "intervention": {
    "combined": {
      "closureCostCents": 500,
      "budgetCents": 50000,
      "adaptiveStrategy": {
        "closureInfectionThreshold": 0.05,
        "reopenInfectionThreshold": 0.02
      }
    }
  }
}
```

**Comportamiento esperado:**
1. Día 0-3: Brote crece lentamente, contexto abierto
2. Día 4: Infecciosos >50 → cierra escuela
3. Día 5-8: Cierre reduce transmisión
4. Día 9: Infecciosos <20 → reabre escuela

### 6.2 Presupuesto limitado

**Configuración:**
```json
{
  "budgetCents": 5000,
  "closureCostCents": 500,
  "vaccineCostCents": 1000,
  "adaptiveStrategy": {
    "closureInfectionThreshold": 0.08,
    "enabled": true
  }
}
```

**Comportamiento esperado:**
1. Prioriza vacunas (más costo-efectivas)
2. Solo cierra si quedan fondos después de vacunar
3. Si se agota presupuesto durante cierre, reabre inmediatamente

### 6.3 Ring vaccination en brote localizado

**Configuración:**
```json
{
  "adaptiveStrategy": {
    "ringVaccinationPriority": true,
    "enabled": true
  }
}
```

**Comportamiento esperado:**
1. Identificar contactos directos de infecciosos
2. Vacunar primero a los vecinos de nodos I
3. Luego continuar con estrategia `targeted` estándar

---

## 7. Limitaciones conocidas

### 7.1 Solo para política `targeted`
La adaptativa solo se aplica cuando `policy="targeted"` y `enabled=True`. Las políticas `none` y `random` no se ven afectadas.

### 7.2 Observación perfecta
El sistema asume que los estados S/E/I/R son completamente observables cada día, lo cual es un supuesto educativo. En un escenario real:
- E (expuestos) no son detectables sin pruebas
- I puede estar subnotificado (asintomáticos)

### 7.3 No hay anticipación
Las decisiones se basan solo en el estado actual, sin modelos predictivos ni aprendizaje de patrones anteriores.

### 7.4 Umbrales fijos
Los umbrales no se ajustan automáticamente según el comportamiento del brote. Un futuro P-02+ podría incluir umbrales adaptativos.

### 7.5 Cierre de un solo contexto
Solo se puede cerrar dinámicamente un contexto a la vez (el especificado en `closureContext`). No hay lógica para cerrar múltiples capas.

---

## 8. Pruebas y validación

### 8.1 Casos de prueba implementados

1. **`test_adaptive_ring_vaccination_priority_targets_infected_neighbors`**
   - Verifica que ring priority cambia la selección

2. **`test_adaptive_strategy_simulation_runs_and_preserves_budget`**
   - Conservación de presupuesto con adaptativa activa

3. **`test_adaptive_decisions_exported_in_daily`**
   - Campo `adaptiveDecisions` presente en resultado

4. **`test_adaptive_decisions_exported_in_csv`**
   - Archivo `adaptive-decisions.csv` en ZIP

5. **`test_adaptive_closure_triggers_and_reopens`**
   - Cierre se activa y reabre según umbrales

6. **`test_adaptive_brigades_stop_when_outbreak_contained`**
   - Brigadas se detienen con I=0

7. **`test_adaptive_only_affects_targeted_policy`**
   - Independencia de políticas

8. **`test_adaptive_threshold_edge_cases`**
   - Umbrales exactos (≥ vs >)

**Ubicación:** `backend/tests/test_adaptive.py`, `backend/tests/test_adaptive_export.py`

### 8.2 Reproducibilidad

Con misma semilla, versión y configuración:
- Mismo `adaptiveDecisions` cada día
- Mismo orden de triggers
- Mismos hashes de réplica

---

## 9. Siguientes pasos (futuros)

### Posibles extensiones (no comprometidas):
- **Umbrales adaptativos:** Ajustar según velocidad de crecimiento
- **Múltiples contextos:** Cerrar varias capas simultáneamente
- **Anticipación:** Cerrar antes de alcanzar umbral según tendencia
- **Aprendizaje:** Ajustar umbrales basándose en efectividad observada
- **Cuarentenas individuales:** Además de cierres de capa

---

## 10. Referencias

- **Roadmap:** `specs/pro-roadmap.md` §P-02
- **TRD:** `TRD.md` §6.3 (extensiones PRO)
- **Código:** `backend/src/simulation/engine.py`, líneas 233-263
- **Pruebas:** `backend/tests/test_adaptive*.py`
- **Evidencia:** `docs/evidencia/p02-adaptive.md` (pendiente)

---

**Última actualización:** 2026-10-27  
**Responsable:** Freddy Bajaña  
**Estado:** Implementado, pendiente de verificación
