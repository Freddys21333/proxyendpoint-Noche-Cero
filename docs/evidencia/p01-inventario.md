# Evidencia local P-01 — 2026-10-27

Alcance: entregas diarias opcionales de vacunas e insumos de brigadas, conservación, pago al usar y reproducción. Contrato en [P-01](../../specs/p01-resource-schedule.md). No incluye estrategia adaptativa nueva, caducidad ni ejecución masiva AWS.

## TDD, verificaciones y regresión

- Rojo observado: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_resource_schedule.py -q` falló inicialmente con `UNKNOWN_FIELD` para resourceSchedule.
- Verde: normalización de entregas duplicadas y por orden, consumo tras recepción, conservación, presupuesto cero, días 0/T, capacidad cero, una dosis por persona aun si falla, límites inválidos y reproducción/ZIP. La prueba adicional de inventario manipulado recalcula hashes para comprobar conservación independientemente de ellos.
- Suite completa del backend: 323 pruebas pasaron antes de añadir la última prueba de manipulación; la suite P-01 final incluye 11 pruebas. Ruff/formato y mypy verifican fuentes; el frontend incluye 101 pruebas y build/tipos.
- Comandos del backend, desde backend/: `../.tools/bin/uv.exe run --locked --offline --cache-dir ../.uv-cache pytest -q`, `ruff check src tests/test_resource_schedule.py`, `ruff format --check src tests/test_resource_schedule.py`, `mypy src` mediante el mismo uv.
- Frontend: `./scripts/frontend.ps1 test` y `./scripts/frontend.ps1 run build`.

## API real y artefactos

`node --experimental-strip-types scripts/verify_resource_schedule_integration.mjs` pasa vía Vite/API local con N=50, T=3, R=2, seed=314159265. Inventario inicial: una dosis, cero insumos; dos entregas el día 2, normalizadas a tres dosis y cuatro insumos. Capacidad diaria dos, eficacia cero y costo por dosis 1000 centavos; atención de brigada 100 centavos por persona/día. Sin cierres.

- Presupuesto cero: saldo de cuatro dosis y cuatro insumos al final, sin consumo ni gasto. Hash `sha256:ae5d2b5be9faf1bb00dc9b622037ed564c80ff18285a929dece9a4c9a7481692`.
- Presupuesto 100000 centavos: Dirigida consume dosis en días 0/2/3 (1/2/1), solo dos insumos en día 2; gasto final 4200 centavos y saldo físico cero dosis/dos insumos. Hash `sha256:bb219e7613e25e2da2eff551384b2d53b3d8134bbb56fc8f1088ef1ba783a8b2`.
- Sin intervención recibe el mismo calendario, no consume ni gasta. El cliente rechaza una copia de respuesta con stock manipulado. El ZIP contiene inventory.csv además de budget.csv.
- Exportaciones locales: `.tools/resource-validation-2026-10-27T12-03-29.810Z/`. Son evidencia funcional, no matriz científica T-22 ni benchmark AWS.

Regresión real con `scripts/verify_local_integration.mjs`: hashes c860fa7271bfce0378b575f18d2f5bc02e5300654141c9c3f5b437b7835baf39 (manual), f6a8d2949c093b4423069287751339486535bfbd39bb2f623ee94a371f41299e (sin vacunas) y d21667873a4e9841fd91a72826b9dbc57977fda77a77cfd7ca330075e976bc33 (sin transmisión) permanecen iguales. `scripts/verify_combined_integration.mjs` conserva también sus tres referencias previas con presupuestos 0/2500/100000 centavos. Los archivos nuevos permanecen bajo .tools/ y no se publican como resultados de aceptación científica.

Verificación manual en navegador: N=50/T=3/R=2, una dosis inicial, cero insumos, envío de tres dosis y cuatro insumos el día 2. Día 0 muestra cero dosis restantes y anuncia la entrega futura; día 2 muestra recepción 3/4, consumo 2/2 y saldo físico 1/2. La tabla conserva el saldo monetario separado. Captura local: `.tools/p01-inventario-diario.png`.
