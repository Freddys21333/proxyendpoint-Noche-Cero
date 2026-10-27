# Comité de Contención de Manta

Simulador de propagación y comparación de estrategias de contención sobre una población sintética.

Simulará una plaga SEIR sobre una población sintética inspirada en Manta y comparará vacunación estratégica con no intervenir y vacunar al azar, usando recursos limitados y experimentos reproducibles. Escenario educativo con parámetros del equipo.

**Estado:** especificaciones, entorno backend, contratos, normalizador de configuración, primitivas de reproducibilidad y experimentos SEIR con exportación y reproducción verificados localmente. El backend ejecuta y resume none/random/targeted, exporta JSON/CSV y reproduce el hash en otro proceso. Los cuatro handlers API están integrados y verificados localmente; la interfaz ya muestra la red real del preview, mientras la conexión de comparación/curvas y el despliegue siguen pendientes.

## Documentación

- [PRD: alcance y aceptación](PRD.md).
- [TRD: arquitectura, contratos y metodología](TRD.md).
- [Especificaciones compartidas](specs/README.md): [requisitos](specs/requirements.md), [diseño](specs/design.md) y [tareas](specs/tasks.md).
- [Costos y evidencia pendiente](docs/costos.md).
- [Instalación y verificación del backend](backend/README.md).
- [Contratos de API y ejemplos para frontend/backend](schemas/README.md).

## Estructura

- `backend/src/`: dominio, simulación, estrategias y adaptadores HTTP.
- `backend/tests/`: pruebas del motor y contratos.
- `frontend/src/`: interfaz prevista en React y TypeScript.
- `schemas/`: futuros contratos OpenAPI y JSON Schema.
- `infra/`: futura infraestructura AWS con Terraform.
- `scripts/`: futuras utilidades de reproducción.
- `specs/`: especificaciones incrementales antes de implementar.
- `docs/evidencia/`: futuras verificaciones y resultados observados.

Se adopta la separación backend/frontend del TRD. La carpeta local vacía `src/` no tiene contenido que versionar y no forma parte de la estructura acordada.

## Trabajo y siguiente incremento

Commits pequeños con mensajes en español y referencia RF/CA cuando corresponda. El comportamiento se desarrolla con TDD: prueba que falla, implementación mínima y refactorización; las verificaciones disponibles deben pasar antes de publicar.

Las interfaces y decisiones de diseño están fijadas en [los acuerdos técnicos](specs/agreements.md). T-02..T-11 están verificados localmente. Frontend puede avanzar con T-12..16 y los contratos/mocks de `schemas/examples/`; infraestructura debe cerrar T-17/18 antes de desplegar. El gate científico T-22 sigue pendiente. Infraestructura puede avanzar según las dependencias de `specs/tasks.md`. Los comandos locales del backend están documentados; exportación/reproducción ya están documentadas; despliegue se documentará al implementarse y verificarse.

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

La configuración completa y las fórmulas están en el TRD. Estos valores ya permiten ejecutar localmente experimentos y resúmenes Monte Carlo; el gate científico de T-22 y el benchmark AWS siguen pendientes. No se afirma que la estrategia supere las líneas base hasta medirlo.

## AWS y pendientes técnicos

Región prevista según PRD/TRD: `us-east-2`; el enunciado menciona `us-east-1` por confirmar, por lo que se debe verificar la aceptación de Ohio con la organización antes de desplegar.

El diagrama lógico está en la sección 2 del TRD. Falta exportar el diagrama de entrega a SVG y conservar su fuente editable. También están pendientes la URL pública, resultados, benchmark y estimación mensual.

### AWS Budget — evidencia provisional

Presupuesto `SpookyThon2026-PRO` configurado por **USD 20 mensuales**, con umbrales de costo real al **25/50/75/100 %** y de costo previsto al **100 %**.

**Pendiente:** la captura muestra `0/2` destinatarios verificados. El envío de verificación está bloqueado por permisos de `notifications-contacts` en la experiencia simplificada de AWS; al intentar modificar el rol, la consola solicita activar características avanzadas. La recepción de notificaciones aún no está confirmada y el requisito de alerta operativa no se declara completado.

Las siguientes capturas documentan la configuración observada, no una consulta en tiempo real ni el gasto final del evento. No muestran las direcciones de correo de los destinatarios; la barra superior conserva el nombre visible del titular.

![Detalle del AWS Budget: USD 20 mensuales y destinatarios pendientes de verificación](docs/budget.png)

![Cinco umbrales configurados para alertas de costo real y previsto](docs/budget2.png)

Una alerta de Budget no detiene automáticamente el gasto. Se actualizará la evidencia cuando se resuelva la verificación de destinatarios.

Todas las funciones PRO están **no iniciadas**. Se han ejecutado simulaciones y pruebas locales; la aplicación todavía no se ha desplegado en AWS.
