# Auditoría de partida PRO

**Fecha:** 2026-10-27.
**Rama de trabajo:** `feat/pro`, creada desde `feat/front-end`.
**Alcance:** verificar la base local, medir el escenario por defecto, revisar el estado de PRO y registrar las brechas antes de iniciar las iteraciones. **No se ejecutó AWS ni un despliegue.**

## 1. Comandos ejecutados

### Backend

```sh
cd backend
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check src tests
.venv/bin/python -m mypy
```

Resultado:

- `pytest`: **324 passed** en 34,88 s.
- `ruff check`: sin hallazgos.
- `mypy`: sin errores.

### Frontend

```sh
cd frontend
npm test -- --run
npm run typecheck
npm run build
```

Resultado:

- `npm test`: **111 passed**.
- `npm run typecheck`: sin errores.
- `npm run build`: correcto.

> La evidencia anterior `verificacion-base-2026-10-27.md` registra 101 pruebas frontend. El conteo vigente es 111; la diferencia corresponde a pruebas agregadas después de esa verificación.

### Repositorio

- Remoto: `https://github.com/Freddys21333/proxyendpoint-zombie-management.git`.
- La API pública del repositorio respondió HTTP 200.
- Historial real con 67 commits y tres autores.
- Sin secretos evidentes en el árbol de trabajo.
- Sin cambios locales pendientes al iniciar esta auditoría.

## 2. Benchmark del escenario por defecto

Configuración: `populationSize=1000`, `days=90`, `repetitions=30`, `rootSeed=20261026`, `beta=0.08`, `vaccines=100`, `interventionDay=0`, `vaccineEfficacy=1.0`, origen aleatorio, sin frames representativos.

| Política | Media de infectados acumulados |
|---|---:|
| `none` | 723,7 |
| `random` | 575,1 |
| `targeted` | 378,1 |

- Diferencia pareada `targeted - random`: **196,97**.
- IC bootstrap 95 %: **81,62 a 309,59**.
- Resultado por réplica frente a `random`: **22 victorias, 6 empates, 2 derrotas**.
- Decisión observada: `supported`.
- Duración: **377,9 s** (~6 min 18 s), sin frames.

**Lectura:** la estrategia dirigida gana en promedio y en la mayoría de réplicas, pero no en todas. Las dos derrotas observadas fueron grandes (`-633` y `-545`) y varias réplicas no desarrollaron brote. El pitch debe hablar de promedios, rangos y empates, no de victoria garantizada.

## 3. Pruebas exploratorias de robustez

Configuración: `N=1000`, `T=40`, `R=10`, semilla `20261026`.

| Variante | `none` | `random` | `targeted` | Ganancia vs random |
|---|---:|---:|---:|---:|
| Mitad de vacunas (50) | 257,0 | 171,2 | 71,0 | +100,2 |
| Eficacia 50 % | 257,0 | 216,1 | 110,8 | +105,3 |
| Origen mercado | 266,1 | 186,1 | 30,2 | +155,9 |

La dirección de la recomendación se mantiene, pero la tasa de victoria estricta frente a `random` fue del **40 %** por empates cuando el brote no prosperó. Es un resultado válido, no un defecto: el sistema debe explicarlo.

## 4. Estado de las capacidades PRO

| Capacidad | Estado | Brecha principal |
|---|---|---|
| PRO-1/2: intervenciones, costos y presupuesto | Parcial | Falta aceptación integral, no doble cobro y límites visibles en UI. |
| P-01: recursos por días | Verificado local | — |
| P-02: decisiones adaptativas | Parcial | Solo brigadas se recalculan; faltan reglas, motivos y observabilidad. |
| P-03: jobs Monte Carlo locales | No iniciado | Sin contrato, manifiesto, progreso, cancelación ni idempotencia. |
| P-04: AWS Distributed Map | No iniciado | Sin infraestructura ni ejecución distribuida; se deja al final. |
| P-05: datos reales de dengue | No iniciado | Sin fuente importada, normalizada ni trazable. |
| P-06: calibración | No iniciado | Sin variable observada, ajuste ni validación fuera de muestra. |
| P-07: mapa/animación | Parcial | Falta aceptación de sincronización, rendimiento y accesibilidad. |
| P-08: informe para el alcalde | No iniciado | Sin plantilla determinista ni PDF reproducible. |
| P-09: mapa geográfico | Verificado local | — |

## 5. Brechas de entrega

- **Rendimiento:** 377,9 s no cabe en Lambda/API síncrona ni en el Brote Sorpresa de 5 minutos.
- **Gate científico:** T-22 v1 está congelado, pero no ejecutado.
- **AWS:** `infra/` solo tiene `.gitkeep`; no hay URL pública, IaC, CORS, IAM, logs ni alarmas.
- **Costos:** `docs/costos.md` declara que no hay tarifas, fórmula ni estimación.
- **Budget:** existe la captura, pero la alerta tiene `0/2` destinatarios verificados.
- **Arquitectura:** el diagrama está en el TRD; falta SVG y fuente editable.
- **Pitch:** no hay PDF/PPT de presentación.
- **E2E:** no hay suite de navegador ni prueba cronometrada del flujo sorpresa.
- **Documentación:** el README raíz no explica despliegue, pruebas ni limitaciones; `README.md:82` afirmaba que PRO no había iniciado cuando P-01 y P-09 ya estaban verificados.
- **Región:** el README presentaba `us-east-1` como bloqueo; el reto permite elegir región. Se documenta `us-east-2` como decisión, sin convertirla en ambigüedad.

## 6. Fortalezas comprobadas

- Motor SEIR con conservación y causalidad probadas.
- Comparación pareada justa con recursos equivalentes.
- Reproducibilidad con semillas por dominio, hashes canónicos y reproducción en otro proceso.
- Exportación JSON/CSV/ZIP y contratos tipados.
- UI local completa: configuración, preview, comparación, curvas, dosis, animación y mapa.
- Historial de commits real y repositorio público.
- Documentación interna amplia y disposición a registrar resultados desfavorables.

## 7. Decisión

La base sirve para continuar. El orden acordado es:

1. I-01: rendimiento y T-22.
2. I-02: P-02.
3. I-03: P-05.
4. I-04: P-03.
5. I-05: P-06.
6. I-06: P-08.
7. I-07: P-07.
8. I-08: P-04 y AWS.
9. I-09: cierre integral.

El plan vivo, la aceptación por iteración y el protocolo de commits están en [plan-pro-iteraciones.md](../plan-pro-iteraciones.md).
