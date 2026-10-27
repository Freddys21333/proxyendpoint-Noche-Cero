---
name: The Containment Desk
description: Technical, focused, analytical scientific operations interface.
colors:
  containment-green: "#173e32"
  paper: "#f5f5f0"
  alert-clay: "#c45c47"
  ink: "#202c28"
  muted: "#5f6b64"
  line: "#dce2da"
  surface: "#ffffff"
typography:
  headline:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "23px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.4px"
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
  data:
    fontFamily: "IBM Plex Mono, monospace"
rounded:
  control: "3px"
spacing:
  compact: "8px"
  panel: "16px"
---
# Design System: The Containment Desk

## Overview

**Creative North Star: "The Containment Desk"**

Technical, focused, analytical. The existing interface treats scenario controls, contact networks, and comparison data as scientific instruments. Controls feel practical and confident.

**Key Characteristics:**
- Flat surfaces with borders and tonal separation.
- A compact top navigation above a light simulation workspace.
- Sans-serif labels with monospaced identifiers and data.

## Colors

Containment Green anchors navigation and headings; Paper supports the working area; Alert Clay marks warnings and emphasis. Ink supplies primary text, Muted supports secondary labels, Line separates panels, and Surface carries white containers. SEIR states use vivid green, yellow, red and blue from the shared presentation palette, with contrasting chart strokes and explicit labels.

## Typography

IBM Plex Sans carries interface text and headings. Field labels and inputs use 16px; supporting text uses 15px. IBM Plex Mono distinguishes identifiers and data where useful. Preserve readable labels and the implemented hierarchy rather than turning every label into a miniature caption.

## Layout

Desktop uses a compact top navigation with Simulador, Comparación and Ayuda. The dominant light network canvas sits on the left; synchronized evolution and scenario parameters share the right column. Playback sits beneath the network, while person details use a disclosure. The top bar is 72px tall; the main workspace uses 28px horizontal padding. Narrow layouts stack the workbench, wrap controls and retain visible navigation labels.

## Elevation & Depth

Flat, with borders and tonal separation. Panels use strokes and surface changes for grouping. Dialog overlays are functional layers, not a reason to add shadows to every container.

## Shapes

Controls commonly use restrained 3px corners. Network people and state indicators use circles, as requested by the user. State letters and labels accompany color so interpretation does not depend on color alone.

## Components

Buttons, fields, navigation, chips, and panels are practical and confident. Primary actions use the established green; secondary actions use outlined or transparent treatments. Focus-visible controls use a 3px green outline with a 3px offset. Button color and background transitions last 0.15s.

Fields retain visible labels and units, with person-facing terms such as Origen aleatorio, Número de persona and Tipo de contacto. Navigation uses a clear active underline. White containers use the Line border. State totals sit in equal centered columns beneath their labels; indicator circles are 14px without borders. Evolution displays the four SEIR series together with solid colored lines, a labeled legend and an equivalent daily table. Network controls and temporal playback remain visibly distinct from scientific experiment results. Complete-network fit uses 16px padding and native wheel sensitivity.

## Do's and Don'ts

### Do:
- Do preserve the green identity, restrained top navigation and light workspace.
- Do use borders and tonal separation to group controls.
- Do preserve state letters, labels, and the daily table alongside scientific colors.

### Don't:
- Don't replace the flat interface with decorative raised cards.
- Don't present illustrative network or curve data as measured simulation output.
