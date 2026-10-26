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
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.8px"
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
- A dark green navigation rail beside a light workspace.
- Sans-serif labels with monospaced identifiers and data.

## Colors

Containment Green anchors navigation and headings; Paper supports the working area; Alert Clay marks warnings and emphasis. Ink supplies primary text, Muted supports secondary labels, Line separates panels, and Surface carries white containers. SEIR states retain their distinct colors and non-color indicators from the implementation.

## Typography

IBM Plex Sans carries interface text and headings. IBM Plex Mono distinguishes identifiers and data. Preserve readable labels and the implemented hierarchy rather than turning every label into a miniature caption.

## Layout

Desktop uses a fixed 212px navigation rail and an offset workspace. A 288px parameter column accompanies the dominant network. The top bar is 54px tall; the main sheet uses 28px horizontal padding. Responsive layouts reflow controls and expose mobile navigation. The network is the dark working canvas within the light interface.

## Elevation & Depth

Flat, with borders and tonal separation. Panels use strokes and surface changes for grouping. Dialog overlays are functional layers, not a reason to add shadows to every container.

## Shapes

Controls commonly use restrained 3px corners. Preserve the network's different node shapes as state information. Small status dots are indicators rather than decorative motifs.

## Components

Buttons, fields, navigation, chips, and panels are practical and confident. Primary actions use the established green; secondary actions use outlined or transparent treatments. Focus-visible controls use a 3px green outline with a 3px offset. Button color and background transitions last 0.15s.

Fields retain visible labels and units. Navigation maintains the green rail and clear active states. White containers use the Line border. Network controls and temporal playback remain visibly distinct from scientific experiment results.

## Do's and Don'ts

### Do:
- Do preserve the existing green navigation and light workspace relationship.
- Do use borders and tonal separation to group controls.
- Do preserve letters, shapes, and line patterns alongside scientific colors.

### Don't:
- Don't replace the flat interface with decorative raised cards.
- Don't present illustrative network or curve data as measured simulation output.

