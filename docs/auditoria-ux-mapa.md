# Revisión de usabilidad: mapa de agentes

Contexto: web educativa, equipo/jurado que configura y compara escenarios sintéticos. Revisión acotada con ux-heuristics-audit de uxcel-lab/product-skills, instalada el 2026-10-27. No es una auditoría de accesibilidad completa.

## Major

- Concentración de hogares por desempates de barrios sintéticos: dificultaba reconocer que se mostraba toda la población y se repetía al consultar. Heurística 2, correspondencia con el mundo del usuario. Corrección: asignar hogares de forma equilibrada entre todas las áreas OSM verificadas, con permutación determinada por semilla; los barrios del modelo conservan sus IDs y no se presentan como barrios geográficos reales.
- Solapamiento visual: marcadores grandes y hogares cercanos dificultaban seleccionar agentes. Heurísticas 7 y 8, eficiencia y diseño mínimo. Corrección: elegir el ancla mejor separada entre hasta 16 candidatos interiores y usar marcadores más pequeños; conservar Canvas y capas reutilizadas.

## Minor

- Confusión entre distribución aleatoria y movimiento al reproducir. Heurística 1, visibilidad del estado. Corrección: documentar semilla y namespace geográfico v2; una semilla/configuración conserva posiciones al reproducir, mientras otra cambia la distribución. No se usa Math.random por fotograma.

## Working well

La atribución OpenStreetMap permanece visible (4); el selector permite localizar agentes (6); el mapa comparte día, política y réplica con la red (4); los datos sintéticos se identifican como tales (2).

Top 3 prioridades: distribuir todos los hogares entre las áreas; separar anclas y reducir solapamiento; mantener y explicar posiciones reproducibles. Implementadas en este incremento. Los servidores Overpass devolvieron rechazo o timeout; la API principal sí respondió y permitió ampliar de 5 a 13 polígonos residenciales con evidencia y validación. No se inventó suelo residencial nuevo.
