# Comité de Contención de Manta

Proyecto de Freddy_Bajaña para SpookyThon 2026, Track B: La Plaga Zombie.

Simulará una plaga SEIR sobre una población sintética inspirada en Manta y comparará vacunación estratégica con no intervenir y vacunar al azar, usando recursos limitados y experimentos reproducibles. Escenario educativo con parámetros del equipo.

**Estado:** preparación documental y estructura inicial. No hay motor, interfaz, dependencias instalables ni despliegue disponible todavía. Los requisitos descritos son objetivos pendientes.

## Documentación

- [PRD: alcance y aceptación](PRD.md).
- [TRD: arquitectura, contratos y metodología](TRD.md).
- [Plan de especificaciones](specs/README.md).
- [Costos y evidencia pendiente](docs/costos.md).

## Estructura

- `backend/src/`: dominio, simulación, estrategias y adaptadores HTTP.
- `backend/tests/`: pruebas del motor y contratos.
- `frontend/src/`: interfaz prevista en React y TypeScript.
- `schemas/`: futuros contratos OpenAPI y JSON Schema.
- `infra/`: futura infraestructura AWS SAM.
- `scripts/`: futuras utilidades de reproducción.
- `specs/`: especificaciones incrementales antes de implementar.
- `docs/evidencia/`: futuras verificaciones y resultados observados.

Se adopta la separación backend/frontend del TRD. La carpeta local vacía `src/` no tiene contenido que versionar y no forma parte de la estructura acordada.

## Trabajo y siguiente incremento

Commits pequeños con mensajes en español y referencia RF/CA cuando corresponda. El comportamiento se desarrolla con TDD: prueba que falla, implementación mínima y refactorización; las verificaciones disponibles deben pasar antes de publicar.

El siguiente incremento será la spec de contratos y configuración canónica. Luego se incorporarán herramientas, dependencias fijadas y pruebas ejecutables. Los comandos de instalación, pruebas, reproducción y despliegue se documentarán cuando existan y se hayan verificado.

## Parámetros previstos

| Parámetro | Valor | Procedencia |
|---|---:|---|
| Población | 1.000 | Supuesto del equipo |
| Horizonte | 90 días | Supuesto del equipo |
| Casos iniciales | 1 | Reto oficial |
| Réplicas | 30 | Supuesto del equipo |
| Vacunas | 100 | Supuesto del equipo |
| Día de intervención | 0 | Supuesto del equipo |
| Eficacia | 100 % | Supuesto del equipo |
| Incubación media | 3 días | Supuesto del equipo |
| Duración infecciosa media | 7 días | Supuesto del equipo |
| Semilla | 20261026 | Supuesto del equipo |

La configuración completa y las fórmulas están en el TRD. Estos valores aún no producen resultados ejecutables. No se afirma que la estrategia supere las líneas base hasta medirlo.

## AWS y entregables pendientes

Región prevista según PRD/TRD: `us-east-2`; el enunciado menciona `us-east-1` por confirmar, por lo que se debe verificar la aceptación de Ohio con la organización antes de desplegar.

El diagrama lógico está en la sección 2 del TRD. Falta exportar el diagrama de entrega a SVG y conservar su fuente editable. También están pendientes la URL pública, resultados, benchmark, pitch y estimación mensual.

Las capturas locales del Budget muestran USD 20 mensuales y alertas reales de 25/50/75/100 % y prevista de 100 %. No se publican aún porque incluyen el nombre del titular. Una captura indica `0/2` correos verificados: queda pendiente verificar destinatarios y preparar imágenes sin datos personales antes de incorporarlas aquí. Una alerta no detiene automáticamente el gasto.

Todas las funciones PRO están **no iniciadas**. No se han ejecutado simulaciones ni creado recursos AWS en esta preparación.
