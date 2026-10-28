# Revisión RNF: SEO, carga y coherencia visual

Fecha: 2026-10-28. Alcance: cambios verificables sin dominio público ni despliegue.

## SEO del documento inicial

`frontend/index.html` ya declaraba `lang="es"`, viewport y título. Se añadieron descripción en español, `theme-color` Noche Cero, Open Graph (`title`, `description`, `type`, `locale`) y Twitter Card. La descripción deja claro que el brote y la población son ficticios/sintéticos y que el sistema no predice brotes reales.

No se fijaron `canonical`, `og:url`, sitemap ni URLs sociales porque no existe una URL pública confirmada. La prueba `frontend/src/lib/seo.test.ts` verifica metadatos y evita canonicals inventados.

## Carga

Validación de producción: `npm run build` pasó, incluidos typecheck y Vite. Los chunks ya están divididos por pantalla; el JS de entrada es 371,66 kB sin comprimir y 122,07 kB gzip. ComparisonResults es 376,17 kB / 108,32 kB gzip, mapa 180,45 kB / 54,63 kB gzip y PRO 21,97 kB / 6,28 kB gzip. Esto confirma code splitting y tamaño de artefactos; no equivale a medir descarga real, render ni Core Web Vitals.

LCP, INP, CLS, rendimiento móvil y rastreo desde el dominio público siguen pendientes. El build local y el runtime Vite no sustituyen Lighthouse/PageSpeed en producción.

## Coherencia de paleta

Se retiraron del CSS de PRO los colores claros verdes/blancos duplicados y se usan tokens existentes de Noche Cero (`--night-card`, `--night-raised`, `--night-border`, `--ink`, `--muted`, `--pumpkin`, `--lime`) más tokens semánticos para éxito, aviso y error. La captura en navegador muestra el espacio PRO sobre el tema oscuro de la aplicación.

Contraste calculado con la fórmula WCAG 2.1, texto normal, sobre las superficies declaradas:

| Combinación | Contraste |
|---|---:|
| Texto principal `#f1ece4` sobre tarjeta `#24212d` | 13,42:1 |
| Texto atenuado `#b6aebd` sobre tarjeta `#24212d` | 7,35:1 |
| Acento claro `#ffb281` sobre tarjeta `#24212d` | 8,97:1 |
| Texto oscuro `#111019` sobre botón naranja `#ff8250` | 7,70:1 |
| Éxito `#d9e9cd` sobre `#26312b` | 10,59:1 |
| Aviso `#f4d78c` sobre `#332d21` | 9,72:1 |
| Error `#ffb6a5` sobre `#382522` | 8,58:1 |
| Lima `#bde76b` sobre `#26312b` | 9,51:1 |

Los valores superan 4,5:1 en las combinaciones verificadas. Falta revisar todos los estados hover/focus/disabled y la paleta de los SVG/mapa/gráficas; por tanto, no se declara cerrado RNF-06 integral.

## Verificación

- `node --experimental-strip-types --test src/lib/seo.test.ts`: pasó tras añadir metadatos; el primer recorrido falló por ausencia de ellos.
- `npm test -- --run`: 15 archivos de prueba, todos pasan.
- `npm run build`: typecheck y bundle de producción pasan.
- `frontend/src/lib/geographic-map.test.ts`: ya verifica centro de Manta, `fitBounds` de agentes, cámara y recentrado. No se modificó la coordenada porque ese requisito ya estaba implementado.
