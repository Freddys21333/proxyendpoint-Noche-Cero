# Borde único en los campos del panel

Se eliminó el borde interior de los inputs contenidos en `.input-wrap` dentro de las intervenciones combinadas. El contenedor conserva su borde exterior y el indicador naranja de foco. Los campos independientes mantienen su borde.

Verificación en navegador local: antes, los inputs de presupuesto, costos, cierre y brigadas tenían borde interior además del exterior. Después, los 16 inputs envueltos presentes en el panel tienen borde interior de 0 px y conservan el exterior. Al enfocar presupuesto, el input no tiene outline y el contenedor mantiene el foco naranja; el valor sigue en 2000.

Comprobaciones: 152 pruebas frontend aprobadas; `npm run build` aprobado. La comprobación final del foco se realizó después de ajustar su selector CSS. No se modificó el comportamiento desplegable del menú.

Alcance del commit: únicamente CSS de bordes y esta evidencia. Otros cambios locales en curso quedan fuera.

Risk: none.
