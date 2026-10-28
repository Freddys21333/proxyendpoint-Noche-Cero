# Pruebas de intervenciones combinadas y presupuesto

Fecha: 2026-10-28. Entorno: backend local. No usa datos reales ni AWS.

## Ejecución

```sh
backend/.venv/bin/python -m pytest -q backend/tests/test_combined.py backend/tests/test_resource_schedule.py
```

Resultado: **20 pruebas aprobadas en 2,10 s**.

## Cobertura y resultados comprobados

- El costo diario coincide con vacunas usadas × costo unitario, brigadas activas × costo unitario y cierre activo; el gasto acumulado suma esos importes y el saldo nunca es negativo. `none` no incurre costos.
- Un presupuesto de cero no permite consumir recursos ni cambia los frames de enfermedad o la aleatoriedad pareada de las políticas.
- Un presupuesto limitado reduce las dosis disponibles; las dosis fallidas siguen contando como recurso consumido.
- Entregas duplicadas del mismo día se normalizan. En el escenario de prueba, 3 vacunas y 4 insumos de brigada llegan el día 2; ninguna unidad se usa antes de su llegada. Las políticas activas usan 4 vacunas y 2 insumos de brigada, quedan 2 insumos y gastan 4.200 centavos; `none` conserva inventario y gasta cero.
- La exportación ZIP incluye la tabla de presupuesto/inventario y el documento se reproduce con el mismo `experimentHash`.

## Límite de aceptación

Esto verifica el motor, el presupuesto compartido y la exportación mediante pruebas automatizadas. No sustituye la aceptación visual/humana de T-13..T-16 ni una matriz de uso de la interfaz con varias configuraciones elegidas por operadores.
