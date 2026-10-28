# Color moderado y zoom animado

Se retiró el filtro de escala de grises. Las teselas conservan sus colores con saturación 0,65, brillo 0,76 y contraste 0,95. El filtro solo afecta al mapa base; los colores de las personas permanecen intactos.

Se restauró `zoomAnimation: true`, desactivada en el ajuste anterior. La rueda continúa habilitada y las capas del mapa y el canvas de personas vuelven a usar la transición de zoom de Leaflet.

Verificación: test de montaje observado fallando antes de restaurar la animación; 152 pruebas frontend aprobadas después y compilación correcta. En navegador local con 100 personas se comprobó acercar y alejar con la rueda, los colores de las teselas y la clase `leaflet-zoom-animated` en el canvas. Las teselas de una escala nueva siguen dependiendo de su carga desde OSM.

Los cambios pendientes en los editores de intervenciones no forman parte de este ajuste.

Risk: none.
