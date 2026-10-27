# Preparación T-22 v1

Fecha local: 2026-10-27. [Protocolo y comandos](../../specs/validation/t22-v1/README.md). Este incremento prepara la evaluación y no ejecuta experimentos científicos.

Artefactos: protocol.json, 15 configuraciones completas/normalizadas, SHA256SUMS, atributos LF para los mismos bytes en Windows/Linux y scripts/check_validation_protocol.py. Cinco raíces primarias por SHA-256 público, cinco contrastes descriptivos y cinco controles; R30 en cada fila (450 unidades pareadas,150 primarias). La decisión primaria no mezcla escenarios ni elimina pérdidas. Se presenta incertidumbre por raíz y no se trata el conjunto como150 redes independientes.

Comprobación ejecutada:

```text
protocolId=t22-v1
experiments=15
pairedReplicates=450
primaryReplicates=150
protocolSHA256=cb6b3e62795de8a6ec87f1a7e4c972c692ebbcb5144d3546ec6f622a92ffbb8b
simulationsExecuted=0
```

El checker valida las configuraciones contra el normalizador existente; no llama a generate_graph, run_experiment ni reproduce. Se probó una copia temporal bajo .tools: modificar bytes de un input sin actualizar el registro produjo rechazo; una ruta ../outside.json en SHA256SUMS fue rechazada antes de leer fuera de la matriz. Los originales permanecieron válidos. Ruff/formato y mypy del nuevo verificador correctos. No se ejecuta la suite científica ni se presenta una prueba de impacto en esta preparación.

La casilla T-22 permanece abierta: faltan las ejecuciones, exportaciones/reproducciones, controles y decisión científica con resultados reales. También permanecen pendientes semilla de jurado externo, tiempos humanos, aceptación completa y AWS. Para cambios posteriores al registro crear versión nueva con motivo y conservar v1/resultados; no cambiar semillas para ocultar un fallo. El protocolo no añade presets obligatorios a la interfaz ni inicia PRO.
