# Ciclo de vida del canvas del mapa

Estado: verificado localmente, 2026-10-28. Alcance P-07/P-09: evitar clearRect sobre un canvas retirado al reemplazar población, cambiar de pantalla o desmontar React StrictMode. No cambia posiciones, estados, API ni ciencia.

Aceptación: un redibujado encolado mientras la capa existe dibuja normalmente; después de destroy debe ser inocuo, sin tocar el canvas retirado. Destroy sigue siendo idempotente y conserva la eliminación de capas, renderer y listeners. Comprobar prueba roja/verde y repetir preview/comparación, navegación PRO/red y actualización de población en navegador real, capturando pageerror.

Resultado: [evidencia y regresión](../docs/evidencia/mapa-ciclo-vida-2026-10-28.md), prueba roja/verde, 150 pruebas frontend y navegador con cero pageErrors. El acceso interno Leaflet exige repetir esta prueba al actualizar la dependencia.
