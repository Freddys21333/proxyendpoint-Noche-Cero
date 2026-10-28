# Investigación de fuentes para P-05

Fecha de consulta: 2026-10-28. Estado: **fuente candidata identificada; P-05 sigue abierto**. Seguimiento de metadatos realizado el mismo día.

## Fuentes localizadas

1. El [archivo de gacetas vectoriales del MSP](https://www.salud.gob.ec/gacetas-vectoriales/) publica boletines por semana epidemiológica. La [gaceta MSP de SE 16 de 2025](https://www.salud.gob.ec/wp-content/uploads/2025/04/Enfermedades-Transmitidas-por-Vectores-SE-16.pdf) reporta dengue y cuadros provinciales, incluido Manabí. Es evidencia oficial útil para contrastar agregados, pero los informes PDF por sí solos requieren extracción y revisión antes de formar una serie semanal.
2. OBSALUD publica una [base de casos de dengue MSP, enero de 2021 a agosto de 2025](https://obsalud.org/biblioteca/bases-de-datos-abiertos/base-dengue-descarga/), indicando que recibió la información mediante la solicitud de acceso SAIP-2025-0000037380. La página ofrece una hoja de datos y un diccionario; describe desagregación por parroquia, edad y sexo.
3. Como contexto técnico, la OMS describe el dengue como transmisión por mosquitos *Aedes*, lo que requiere revisar el desajuste con el modelo actual de transmisión por contactos humanos antes de calibrar sus parámetros: [ficha OMS](https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue).

## Seguimiento de metadatos y validación oficial

- La página de OBSALUD confirma el período enero de 2021–agosto de 2025, el mecanismo SAIP-2025-0000037380, la granularidad declarada y enlaces separados al XLSX y al diccionario. Los enlaces resuelven a `Datos_Dengue_MSP_Ene2021_Ago2025.xlsx` y `Diccionario-variables-datos-dengue.xlsx`, pero la página no muestra licencia ni términos de reutilización. La disponibilidad para descarga no demuestra permiso de redistribución.
- El catálogo oficial [Datos Abiertos Ecuador](https://www.datosabiertos.gob.ec/dataset/?organization=ministerio-de-salud-publica&q=) presenta otros conjuntos del MSP; la búsqueda revisada no identificó una ficha de dengue. El MSP describe el mecanismo de publicación de datos abiertos y define estos como datos con condiciones técnicas y jurídicas para libre reutilización ([página oficial](https://www.salud.gob.ec/datos-abiertos-2/), [servicio de publicación](https://www.salud.gob.ec/atencion-a-demanda-ciudadana-para-publicacion-de-datos-abiertos/)). No se encontró en esas páginas una licencia asociada al XLSX de OBSALUD.
- La [gaceta MSP SE16-2025](https://www.salud.gob.ec/wp-content/uploads/2025/04/Enfermedades-Transmitidas-por-Vectores-SE-16.pdf) informa 17.112 casos confirmados de dengue a escala nacional hasta SE16 y 2.403 para Manabí en la tabla provincial; además incluye una serie gráfica semanal para Manabí. El mismo informe advierte que los datos pueden variar. Este corte sirve como referencia de contraste agregada, no sustituye la extracción de serie ni acredita una licencia para republicar el libro OBSALUD.
- El índice de herramientas consultado no admite abrir el formato XLSX (error de tipo MIME). No se inspeccionaron ni importaron las hojas del libro en esta iteración; por tanto, nombres de columnas, fechas, faltantes y granularidad efectiva siguen sin verificar.

## Decisiones y brechas

- La base OBSALUD es una candidata más estructurada que transcribir tablas de PDF, pero su esquema exacto, unidad temporal, definiciones, valores faltantes y condiciones de reutilización todavía deben inspeccionarse en los archivos descargables. No se importaron ni copiaron los XLSX.
- La granularidad declarada podría incluir combinaciones de parroquia, edad y sexo. Antes de incorporar datos se debe comprobar si son agregados y si la reducción a provincia/semana elimina campos innecesarios. No se deben guardar datos personales ni publicar registros de granularidad sensible.
- Los boletines del MSP pueden servir para contrastar totales y documentar revisiones, pero no se reconstruirá incidencia semanal restando acumulados hasta comprobar que los cortes y revisiones son comparables.
- No se estableció una licencia abierta explícita para la base OBSALUD en la página consultada; la disponibilidad para descarga no se tratará como autorización de redistribución. Se debe registrar la condición de uso y conservar únicamente la tabla agregada si la licencia lo permite.
- El modelo SEIR actual no representa mosquitos ni ciclo vectorial. Importar datos no autoriza a llamar “calibrado de dengue” al modelo actual; P-06 debe decidir y validar una función de observación y una extensión compatible antes del ajuste.

## Siguiente aceptación de P-05

Obtener e inspeccionar el diccionario y el libro fuente en una sesión local con lector XLSX; registrar URL directa, hash SHA-256, fecha/corte y condiciones de uso; definir un agregado parroquia/provincia y semana que descarte campos no requeridos; comparar el corte compatible con los 2.403 casos reportados para Manabí hasta SE16-2025; documentar faltantes, revisiones y diferencias. Si no se aclara la licencia/permiso de reutilización o el libro contiene campos con riesgo de reidentificación, no versionar datos: solicitar aclaración o limitarse a un dataset oficial con licencia. Hasta entonces P-05 sigue abierto y P-06 bloqueado por dependencia.
