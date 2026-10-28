# Comparación, Monte Carlo, ayuda y reproducción

Cambios solicitados por el usuario en main, verificados localmente. Sin despliegue
AWS, ejecuciones cloud ni cambios del motor, semillas o protocolo T-22.

## Cambios

1. Conclusión de resultados generada por backend en
   `decisionSummary.conclusion` (campo opcional aditivo). Con presupuesto explica
   gasto, saldo, beneficio y costo por contagio evitado; distingue mejor impacto
   de menor costo unitario y de menor gasto. Un empate conserva esa condición y
   explica el menor gasto directo entre las opciones empatadas. No monetiza daño
   de contagios ni afirma una optimización económica inexistente.
2. Diferencias pareadas visibles en tres tarjetas cara a cara: estrategia,
   referencia y contagios menos/más o misma media. Mediana, rango P05-P95 e IC
   bootstrap permanecen consultables. Pérdidas y empates no se convierten en éxitos.
3. Navegación y pantalla denominadas **Monte Carlo**. Los identificadores internos
   `pro` y los contratos P-03/P-04 permanecen compatibles.
4. Botones Volver y cerrar de la ayuda con colores legibles Noche Cero.
5. Estado final de la réplica junto a velocidad; botón Reducir movimiento con
   estado explícito, altura mínima 44 px y explicación visible. Cambia animaciones
   CSS, no días, velocidad de reproducción ni resultados científicos.
6. Estado superior muestra solo Servidor disponible/Conectando/Sin conexión,
   eliminando el contexto adicional de la derecha.

## Compatibilidad

La conclusión no entra en el hash científico. Documentos anteriores con
decisionSummary sin conclusión siguen validando y reproduciendo; se comprueban
todos sus campos históricos. Si la conclusión está presente, también se verifica
contra la proyección del backend. El frontend acepta el campo opcional y rechaza
tipos inválidos. Sin resumen nuevo, muestra una explicación de disponibilidad,
sin calcular gastos, rentabilidad o recomendaciones nuevas en React.

## Verificación observada

- Pruebas inicialmente rojas por ausencia de conclusión; después pasan casos de
  ventaja económica, empate, mejor impacto con mayor costo y reproducción legada.
- Suite backend: **522 pruebas**. Tras pulir el texto de empates, sus nueve pruebas
  focalizadas repetidas correctamente. Ruff/formato y mypy correctos (31 módulos).
- Frontend: **154 pruebas**, tipos y build correctos. Prueba explícita de signo
  negativo/positivo/cero y validación del campo de conclusión opcional.
- Protocolo T-22 intacto, SHA-256
  `cb6b3e62795de8a6ec87f1a7e4c972c692ebbcb5144d3546ec6f622a92ffbb8b`;
  cero simulaciones del protocolo ejecutadas.
- Edge contra API local real: N120/T21/R30, vacunas30, presupuesto educativo
  USD2000. Hash `sha256:0445591a8519e8d1f5027c17fd7c9193ddebfae4d51cf731c59403df7ccb9099`.
  Conclusión publicada: Dirigida, gasto USD940, saldo USD1060, evitados18,9 y
  costo por evitado USD49,74; mismo gasto que Aleatoria. Valores del backend.
- Comprobados: tres tarjetas, navegación Monte Carlo, modal de ayuda, seek por
  teclado hasta día21, estado final en grupo de velocidad y toggle de movimiento.
  El toggle cambia `aria-pressed` y reduce transición CSS a `0.00001s`.
- Anchos 320, 390 y 768 px sin desbordamiento horizontal; cero errores de página.
  Capturas y resultados locales ignorados en `.tools/requested-ux-*`.

La prueba automatizada no sustituye aceptación humana. La versión AWS permanece
anterior hasta desplegar conjuntamente backend y frontend con autorización.
