# Rendimiento de validación y exportación

Estado: **verificada localmente**, 2026-10-27. [Mediciones, equivalencia y límites](../docs/evidencia/rendimiento-validacion-2026-10-27.md). Trabajo autorizado: medir y optimizar sin alterar cálculos ni simulación. Referencias: RNF de rendimiento, RF-13/19, I-01; T-22 congelado e independiente.

La carga de un JSON real N1000/T90/R2 tardó 29,73 s en la evidencia P-07. El perfil de carga muestra validación del contrato dominante y dos validaciones completas consecutivas en `load_export`. Se medirá con el mismo archivo antes/después, separando lectura/carga/exportación, sin confundirlo con el motor R30.

Aceptación: preservar exactamente el documento, bytes canónicos y hashes científicos; eliminar solo comprobaciones redundantes. Acelerar `items` únicamente para esquemas primitivos exactos reconocidos, valores nativos que satisfacen todas sus condiciones y sin `prefixItems`. Cualquier otra entrada usa Draft202012Validator estándar. Se mantienen las demás palabras del esquema (longitud, unicidad, referencias, formatos, campos desconocidos), lectura estricta, hashes y validación P-07. Diagnósticos inválidos conservan la ruta estándar.

Pruebas: equivalencia contra Draft202012Validator independiente para límites, booleanos, enteros/float, duplicados, tipos y campos extra; todas las referencias y reproducción existentes; comparar hash y contenido exacto de exportaciones reales base y PRO. Medir motor por defecto con semilla/configuración sin cambios y registrar resultado aunque no mejore. No prometer ≤25 s sin medición.

No se cambian versiones del modelo, semillas, potenciales, orden de operaciones científicas, arquitectura ni dependencias. La mejora se limita al costo de comprobar y transportar resultados ya calculados.

Diseño verificado: `validators.extend` conserva Draft202012Validator y sustituye únicamente la validación `items` para calendarios nativos y estados planos reconocidos. Se resuelve una vez la referencia local State en una copia privada si su definición es exactamente la esperada y no hay `$id` internos; literales `const/enum/default/examples` no se reescriben. Cambios futuros de esas condiciones vuelven al contrato original. Se mantienen formato, unicidad, cardinalidad y diagnóstico estándar para entradas inválidas. `load_export` elimina su primera comprobación de esquema porque `_validate` la ejecuta antes de acceder a campos.
