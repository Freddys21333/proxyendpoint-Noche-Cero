# Laboratorio local del Comité de Contención

Este prototipo permite explorar la red sintética y una simulación SEIR con tres políticas de vacunación. No implementa el contrato `/v1` ni sustituye el backend Python, los esquemas o la validación experimental planificados en `specs/tasks.md`. Sus cifras son exploratorias.

## Ejecutar

Requiere Node.js 20 o superior. No instala dependencias:

```bash
cd prototype
npm test
npm run dev
```

Abrir `http://127.0.0.1:4173`. `PORT=4174 npm run dev` permite otro puerto. Comprobar `GET /api/health`.

## Interpretar

Cada círculo es una persona y cada línea es un contacto sintético de hogar, colegio, bus, mercado o barrio. El color representa S (susceptible), E (expuesto), I (infeccioso) o R (recuperado o inmunizado). La animación enseña la réplica 0 de la política elegida. Solo se dibujan 120 nodos y se muestrean líneas de bus/mercado para mantener legibilidad; la simulación utiliza toda la red. Las posiciones son esquemáticas, no geográficas.

El cierre de una capa entre dos días es una exploración preliminar de PRO-1. Se aplica a las tres políticas y no calcula costos sociales ni presupuesto. La animación explora PRO-6, pero todavía no elige la réplica representativa según el TRD. Las curvas comparan medias de infectados acumulados; P05/P95 describen dispersión, no certeza de una recomendación.

## Límites conocidos

- Red de 20–400 personas, 1–90 días y 1–30 réplicas. Los valores base del PRD son 1.000/90/30 y requieren el motor formal y benchmark.
- PRNG determinista de prototipo. No coincide con `rng-v1`/PCG64 ni con `synthetic-manta-v1` del contrato.
- No incluye intervalos bootstrap, eventos, hashes de experimento, reproducción formal, CSV, presupuestos, trabajos asíncronos, datos abiertos ni despliegue AWS.
- El grafo de bus/mercado muestra pares potenciales; el contacto efectivo diario se sortea durante la simulación.
