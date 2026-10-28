# Investigación de fuentes para P-05

Fecha de consulta: 2026-10-28. Estado: **fuente candidata identificada; P-05 sigue abierto**.

## Fuentes localizadas

1. El [archivo de gacetas vectoriales del MSP](https://www.salud.gob.ec/gacetas-vectoriales/) publica boletines por semana epidemiológica. La [gaceta MSP de SE 16 de 2025](https://www.salud.gob.ec/wp-content/uploads/2025/04/Enfermedades-Transmitidas-por-Vectores-SE-16.pdf) reporta dengue y cuadros provinciales, incluido Manabí. Es evidencia oficial útil para contrastar agregados, pero los informes PDF por sí solos requieren extracción y revisión antes de formar una serie semanal.
2. OBSALUD publica una [base de casos de dengue MSP, enero de 2021 a agosto de 2025](https://obsalud.org/biblioteca/bases-de-datos-abiertos/base-dengue-descarga/), indicando que recibió la información mediante la solicitud de acceso SAIP-2025-0000037380. La página ofrece una hoja de datos y un diccionario; describe desagregación por parroquia, edad y sexo.
3. Como contexto técnico, la OMS describe el dengue como transmisión por mosquitos *Aedes*, lo que requiere revisar el desajuste con el modelo actual de transmisión por contactos humanos antes de calibrar sus parámetros: [ficha OMS](https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue).

## Decisiones y brechas

- La base OBSALUD es una candidata más estructurada que transcribir tablas de PDF, pero su esquema exacto, unidad temporal, definiciones, valores faltantes y condiciones de reutilización todavía deben inspeccionarse en los archivos descargables. No se importaron ni copiaron los XLSX.
- La granularidad declarada podría incluir combinaciones de parroquia, edad y sexo. Antes de incorporar datos se debe comprobar si son agregados y si la reducción a provincia/semana elimina campos innecesarios. No se deben guardar datos personales ni publicar registros de granularidad sensible.
- Los boletines del MSP pueden servir para contrastar totales y documentar revisiones, pero no se reconstruirá incidencia semanal restando acumulados hasta comprobar que los cortes y revisiones son comparables.
- No se estableció una licencia abierta explícita para la base OBSALUD en la página consultada; la disponibilidad para descarga no se tratará como autorización de redistribución. Se debe registrar la condición de uso y conservar únicamente la tabla agregada si la licencia lo permite.
- El modelo SEIR actual no representa mosquitos ni ciclo vectorial. Importar datos no autoriza a llamar “calibrado de dengue” al modelo actual; P-06 debe decidir y validar una función de observación y una extensión compatible antes del ajuste.

## Siguiente aceptación de P-05

Inspeccionar el diccionario y el libro fuente; registrar URL directa, hash SHA-256, fecha/corte, licencia/condiciones y método de extracción; definir un agregado parroquia/provincia y semana que descarte campos no requeridos; comparar totales con la gaceta MSP del mismo corte; documentar faltantes, revisiones y diferencias. Hasta entonces P-05 está en investigación y P-06 permanece bloqueado por dependencia.
