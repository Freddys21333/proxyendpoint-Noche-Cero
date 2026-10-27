# Lectura del grafo y evolución PRO

## Qué representa la pantalla del laboratorio

- **Nodo:** una persona sintética, sin identidad ni coordenada real. Su color cambia con el estado SEIR: S susceptible, E expuesto, I infeccioso, R recuperado o inmunizado. R reúne recuperación natural y vacunación eficaz.
- **Arista:** posibilidad de contacto en un contexto. Hogar, colegio, bus, mercado y barrio tienen pesos distintos. El filtro visual muestra una capa; ocultar líneas no cambia la simulación. En bus y mercado el contacto efectivo se sortea por día.
- **Día:** la animación enseña estados tras los intervalos de transmisión de ese día. Si se vacuna el día 7, la protección empieza en el intervalo 7→8. La gráfica animada corresponde a una sola réplica y no debe interpretarse como el promedio.
- **Curvas y tarjetas:** resumen de infectados acumulados para `none`, `random` y `targeted`. La comparación usa la misma red, origen y sorteos externos por réplica. P05–P95 describe la variación entre réplicas; no es un intervalo de confianza.

La disposición de los nodos es esquemática en la vista **Red**. En la pantalla se dibuja una muestra de nodos y conexiones para mantenerla legible; el cálculo usa la red completa configurada. La vista **Mapa** (feature [P-09](../specs/p09-geographic-map.md)) sitúa a las mismas personas sintéticas sobre polígonos residenciales de OpenStreetMap de Manta usados solo como referencia visual: no son domicilios, densidad ni riesgo real. No hay observaciones epidemiológicas reales en ninguna de las dos vistas.

## Orden recomendado para PRO

| Etapa | Capacidad | Qué debe demostrar antes de presentarse como funcionalidad |
|---|---|---|
| 1 | Base validada | Contrato `/v1`, motor Python reproducible, pruebas de invariantes, benchmark y comparación pareada; publicación AWS tras verificar permisos, región y alertas. |
| 2 | PRO-6, grafo animado | Elegir la réplica representativa por cercanía a la mediana, identificar índice/semilla y permitir filtrar capa, política y día sin alterar métricas. |
| 2b | P-09, mapa geográfico | Mostrar personas sintéticas sobre polígonos OSM versionados y posiciones deterministas, con atribución, selección y sincronización; sin cambiar modelo, hashes ni datos epidemiológicos. |
| 3 | PRO-1/2/3, decisiones operativas | Cierres, fumigación simulada, recursos diarios, costos y política adaptativa con esquemas/versiones nuevas. Comparar políticas con el mismo presupuesto y reportar el costo social supuesto. |
| 4 | PRO-4, escala | Jobs con idempotencia, cancelación, almacenamiento y progreso real; medir costo y duración antes de aumentar réplicas. |
| 5 | PRO-5/7, evidencia y comunicación | Preset calibrado con fuente pública y transformación reproducible; informe determinista que cite configuración, resultados, incertidumbre y límites. |

Estado resumido al 2026-10-27: verificado localmente P-01 (inventario diario), el incremento educativo PRO-1/PRO-2 (cierre, brigadas, costos y presupuesto), la reproducción PRO-6/P-07 y el mapa de presentación P-09. No están completos: política adaptativa (P-02), jobs Monte Carlo (P-03/P-04), datos reales (P-05), calibración (P-06) ni informe (P-08). El motor formal debe conservar los acuerdos de `specs/agreements.md`; los números del laboratorio no sirven como evidencia de aceptación.

### Actualización 2026-10-27: estado real del laboratorio

El laboratorio ya incluye más que la primera exploración:

- **PRO-1/PRO-2 parcial, verificado localmente:** vacunas, cierre temporal de una capa, brigadas simuladas, costos educativos, presupuesto, entregas diarias e inventario (P-01).
- **PRO-6 parcial:** reproducción por día, política y réplica, con red y mapa sincronizados.
- **P-09 verificado como presentación:** mapa OSM de Manta con trece polígonos versionados y posiciones sintéticas deterministas; no altera el modelo ni los hashes.

Siguen **no iniciados**: política adaptativa completa (P-02), jobs Monte Carlo locales (P-03), Distributed Map en AWS (P-04), datos reales de dengue (P-05), calibración fuera de muestra (P-06) e informe PDF (P-08). P-07 continúa en progreso hasta aceptar rendimiento, accesibilidad y transiciones.

Los números del laboratorio siguen siendo educativos y no sirven como evidencia de aceptación científica ni de despliegue.
