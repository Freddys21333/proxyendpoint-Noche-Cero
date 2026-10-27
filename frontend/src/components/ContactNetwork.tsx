import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import cytoscape from "cytoscape";
import {
  Crosshair,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildDemoNetwork,
  describeDemoNode,
  type DemoState,
} from "@/lib/contact-network";

import {
  temporalDemo,
  readDemoFrame,
  playbackReducer,
  initialPlayback,
} from "@/lib/temporal-demo";
import "./ContactNetwork.css";
import { seirColors } from "./seir-colors";
import type { PreviewResponse } from "@/lib/api";
import { PreviewNetwork } from "./PreviewNetwork";

const elements = buildDemoNetwork();
const FIT_PADDING = 16;
const TemporalChart = lazy(() => import("@/components/TemporalChart"));
const nodes = elements.filter((element) => "state" in element.data);
const layers: Record<string, string> = {
  Households: "Hogares",
  Schools: "Colegios",
  Market: "Mercado",
  Neighborhoods: "Barrios",
  "Bus routes": "Rutas de bus",
};
const states: Record<
  DemoState,
  { label: string; nodeLabel: string; description: string; color: string }
> = {
  S: { label: "Sano", nodeLabel: "Sano", description: "Susceptible", color: seirColors.S.marker },
  E: { label: "Mordido", nodeLabel: "Mordido", description: "Expuesto", color: seirColors.E.marker },
  I: { label: "Zombie", nodeLabel: "Zombie", description: "Infeccioso", color: seirColors.I.marker },
  R: { label: "Exorcizado", nodeLabel: "Exorcizado", description: "Recuperado o inmune", color: seirColors.R.marker },
};

export function ContactNetwork(props: { resetKey: number; layer: string; children?: ReactNode; preview?: PreviewResponse | null }) {
  const lastPreview = useRef<PreviewResponse | null>(null);
  if (props.preview) lastPreview.current = props.preview;
  return lastPreview.current
    ? <PreviewNetwork {...props} preview={lastPreview.current} active={Boolean(props.preview)} />
    : <DemoContactNetwork {...props} />;
}

function DemoContactNetwork({
  resetKey,
  layer,
  children,
}: {
  resetKey: number;
  layer: string;
  children?: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const network = useRef<cytoscape.Core | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const pickerId = useId();
  const [playback, dispatch] = useReducer(playbackReducer, initialPlayback);
  const frame = useMemo(() => readDemoFrame(playback.day), [playback.day]);
  const counts = frame.counts;
  const baseDetail = describeDemoNode(elements, selectedId);
  const detail = baseDetail
    ? { ...baseDetail, state: frame.states[Number(baseDetail.id)] }
    : undefined;
  const history = temporalDemo.events.filter(
    (event) => event.nodeId === Number(selectedId) && event.day <= playback.day,
  );

  useEffect(() => {
    if (!playback.playing) return;
    const timer = window.setInterval(
      () => dispatch({ type: "tick" }),
      900 / playback.speed,
    );
    return () => window.clearInterval(timer);
  }, [playback.playing, playback.speed]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) dispatch({ type: "pause" });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements: buildDemoNetwork().map((element) =>
        "state" in element.data
          ? {
              ...element,
              data: {
                ...element.data,
                state: readDemoFrame(0).states[Number(element.data.id)],
              },
            }
          : element,
      ),
      layout: { name: "preset" },
      selectionType: "single",
      boxSelectionEnabled: false,
      minZoom: 0.25,
      maxZoom: 3,
      style: [
        {
          selector: "node",
          style: {
            width: 17,
            height: 17,
            "background-color": states.S.color,
            "border-width": 1.5,
            "border-color": "#334155",
            "overlay-opacity": 0,
          },
        },
        {
          selector: 'node[state="E"]',
          style: {
            "background-color": states.E.color,
            shape: "ellipse",
            width: 19,
            height: 19,
          },
        },
        {
          selector: 'node[state="I"]',
          style: {
            "background-color": states.I.color,
            shape: "ellipse",
            width: 25,
            height: 25,
            "border-width": 2,
            "border-color": "#713f36",

            "font-size": 14,
            color: "#934534",
            "text-margin-y": -13,
            "text-valign": "top",
            "text-background-color": "#f8fbf8",
            "text-background-opacity": 0.9,
            "text-background-padding": "4px",
          },
        },
        {
          selector: 'node[state="R"]',
          style: {
            "background-color": states.R.color,
            shape: "ellipse",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#a8c0b2",
            opacity: 0.6,
            "curve-style": "straight",
          },
        },
        ...[
          ["0", "Hogares"],
          ["26", "Colegios"],
          ["46", "Mercado"],
          ["70", "Barrios"],
          ["92", "Rutas de bus"],
        ].map(([id, label]) => ({
          selector: `node[id="${id}"]`,
          style: {
            label,
            color: "#365b4a",
            "font-size": 16,
            "text-valign": "top" as const,
            "text-margin-y": -16,
            "text-background-color": "#f8fbf8",
            "text-background-opacity": 0.9,
            "text-background-padding": "4px",
          },
        })),
        { selector: ".outside-layer", style: { opacity: 0.1 } },
        {
          selector: 'node[id="8"]',
          style: {
            label: "Paciente cero",
            color: "#934534",
            "font-size": 16,
            "text-valign": "top",
            "text-margin-y": -13,
            "text-background-color": "#f8fbf8",
            "text-background-opacity": 0.9,
            "text-background-padding": "4px",
          },
        },
        {
          selector: "node.day-event",
          style: { "border-color": "#906d2e", "border-width": 3 },
        },
        {
          selector: "node.day-vaccine",
          style: { "border-color": seirColors.R.stroke, "border-width": 3 },
        },
        {
          selector: "edge.connected",
          style: { "line-color": "#315d47", width: 2, opacity: 1 },
        },
        {
          selector: "node.neighbor",
          style: { "border-color": "#315d47", "border-width": 2 },
        },
        {
          selector: "node:selected",
          style: {
            opacity: 1,
            "border-color": "#173e32",
            "border-width": 3,
            "overlay-opacity": 0,
          },
        },
        {
          selector: "edge.day-contact",
          style: { "line-color": seirColors.I.stroke, width: 2.6, opacity: 1 },
        },
      ],
    });
    network.current = cy;
    cy.on("tap", "node", (event) => setSelectedId(event.target.id()));
    cy.on("tap", (event) => {
      if (event.target === cy) setSelectedId("");
    });
    // Adapt positions only when the viewport changes category; no force layout or animation.
    let previousCompact: boolean | undefined;
    const compactCenters: Record<string, [number, number, number, number]> = {
      Households: [95, 100, 185, 160],
      Schools: [270, 110, 400, 100],
      Market: [90, 270, 590, 205],
      Neighborhoods: [270, 280, 375, 300],
      "Bus routes": [170, 440, 155, 355],
    };
    const resizeViewport = () => {
      cy.resize();
      const compact = cy.width() < 450;
      if (compact !== previousCompact) {
        cy.batch(() => {
          for (const element of elements)
            if ("position" in element) {
              const [x, y, originalX, originalY] =
                compactCenters[element.data.group];
              cy.getElementById(element.data.id).position(
                compact
                  ? {
                      x: x + (element.position.x - originalX) * 0.65,
                      y: y + (element.position.y - originalY) * 0.65,
                    }
                  : element.position,
              );
            }
        });
        previousCompact = compact;
        cy.fit(undefined, FIT_PADDING);
      }
    };
    const resize = new ResizeObserver(resizeViewport);
    resize.observe(container.current);
    resizeViewport();
    return () => {
      resize.disconnect();
      cy.destroy();
      network.current = null;
    };
  }, []);

  useEffect(() => {
    network.current?.fit(undefined, FIT_PADDING);
  }, [resetKey]);
  useEffect(() => {
    const cy = network.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("outside-layer connected neighbor");
      cy.nodes().unselect();
      if (layer !== "All layers")
        cy.elements()
          .filter((element) => element.data("group") !== layer)
          .addClass("outside-layer");
      if (selectedId) {
        const node = cy.getElementById(selectedId);
        node.select();
        node.connectedEdges().addClass("connected");
        node.neighborhood("node").addClass("neighbor");
      }
    });
  }, [layer, selectedId]);

  useEffect(() => {
    const cy = network.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("day-contact day-event day-vaccine");
      frame.states.forEach((state, id) =>
        cy.getElementById(String(id)).data("state", state),
      );
      for (const event of frame.events) {
        cy.getElementById(String(event.nodeId)).addClass(
          event.cause === "vaccine" ? "day-vaccine" : "day-event",
        );
        if (event.edgeId !== null)
          cy.getElementById(temporalDemo.edges[event.edgeId].visualId).addClass(
            "day-contact",
          );
      }
    });
  }, [frame]);

  function zoom(factor: number) {
    const cy = network.current;
    if (cy)
      cy.zoom({
        level: Math.max(
          cy.minZoom(),
          Math.min(cy.maxZoom(), cy.zoom() * factor),
        ),
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
  }

  return (
    <div className="simulator-workbench network-workbench">
      <section className="network-demo-panel" aria-label="Red de contactos de demostración">
        <header className="network-demo-heading">
          <h2>Red de contactos</h2>
          <span>Demo · 110 personas · 20 días</span>
        </header>
        <p className="network-meaning" id={`${pickerId}-guide`}>
          Cada punto (nodo) es una persona; cada línea, un contacto.
        </p>
      <div
        className="seir-instrument"
        aria-label="Estados de las 110 personas de demostración"
      >
        {(Object.keys(states) as DemoState[]).map((state) => (
          <div
            key={state}
            title={states[state].description}
            aria-label={`${states[state].label}: ${counts[state]}. ${states[state].description}`}
            style={{ "--state-color": states[state].color } as CSSProperties}
          >
            <span className="seir-instrument-label">
              <span className="seir-status-dot" aria-hidden="true" />
              <b>{state}</b> {states[state].label}
            </span>
            <strong>{counts[state]}</strong>
          </div>
        ))}
      </div>
        <div className="network-view">
          <div
            ref={container}
            className="network-canvas"
            role="img"
            aria-label="Red de demostración de 110 personas sintéticas. Seleccione una persona en el grafo o use el selector del panel contextual."
            aria-describedby={`${pickerId}-guide`}
          />
          <div className="graph-day-label">
            Día {playback.day} · {frame.events.length} {frame.events.length === 1 ? "evento" : "eventos"}
          </div>
          <div
            className="network-zoom"
            aria-label="Herramientas de exploración"
          >
            <button
              type="button"
              aria-label="Acercar red"
              onClick={() => zoom(1.25)}
            >
              <ZoomIn size={17} />
            </button>
            <button
              type="button"
              aria-label="Alejar red"
              onClick={() => zoom(0.8)}
            >
              <ZoomOut size={17} />
            </button>
            <button
              type="button"
              aria-label="Ajustar grafo a la vista"
              onClick={() => network.current?.fit(undefined, FIT_PADDING)}
            >
              <Crosshair size={17} />
            </button>
          </div>
          <p className="graph-interaction-hint" id="graph-exploration-help">
            <MousePointer2 size={13} />
            Arrastrar · ampliar · seleccionar
          </p>
        </div>
      <div
        className="network-playback"
        aria-label="Reproductor de demostración temporal"
        aria-describedby="network-playback-status"
      >
        <div className="playback-time">
          <span>Día actual</span>
          <strong data-testid="playback-day">
            {playback.day} <small>/ {temporalDemo.days}</small>
          </strong>
        </div>
        <div className="playback-actions">
          <Button
            variant="ghost"
            disabled={playback.playing}
            aria-label="Reproducir demostración"
            onClick={() => dispatch({ type: "play" })}
          >
            <Play size={16} />
          </Button>
          <Button
            variant="ghost"
            disabled={!playback.playing}
            aria-label="Pausar demostración"
            onClick={() => dispatch({ type: "pause" })}
          >
            <Pause size={16} />
          </Button>
          <Button
            variant="ghost"
            aria-label="Reiniciar demostración"
            onClick={() => dispatch({ type: "reset" })}
          >
            <RotateCcw size={16} />
          </Button>
          <Button
            variant="ghost"
            disabled={playback.day === temporalDemo.days}
            aria-label="Avanzar un día"
            onClick={() => dispatch({ type: "step" })}
          >
            <StepForward size={16} />
          </Button>
        </div>
        <label className="playback-timeline">
          <span>
            {playback.playing
              ? "Reproduciendo"
              : playback.day === temporalDemo.days
                ? "Finalizada"
                : "Día de la demo"}
          </span>
          <input
            aria-label="Día de la demostración"
            type="range"
            min="0"
            max={temporalDemo.days}
            value={playback.day}
            onChange={(event) =>
              dispatch({ type: "seek", day: Number(event.target.value) })
            }
          />
        </label>
        <label className="playback-speed">
          <span>Velocidad</span>
          <select
            aria-label="Velocidad de reproducción"
            value={playback.speed}
            onChange={(event) =>
              dispatch({ type: "speed", value: Number(event.target.value) })
            }
          >
            <option value="0.5">0,5×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
        </label>
      </div>
        <p className="network-playback-status" id="network-playback-status">
          Demo independiente de los parámetros.
        </p>
        <details
          className="node-inspector"
          open={Boolean(detail)}
          aria-label="Información de la persona seleccionada"
        >
          <summary>Explorar personas</summary>
          <p className="network-reading-guide">
            Las personas son sintéticas. Los grupos no son ubicaciones reales.
          </p>
          <div className="node-inspector-heading">
            <h3>Persona seleccionada</h3>
            {detail && (
              <button
                aria-label="Limpiar selección"
                onClick={() => setSelectedId("")}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <label htmlFor={pickerId}>Buscar persona por número</label>
          <select
            id={pickerId}
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">Seleccione una persona</option>
            {nodes.map(({ data }) => (
              <option key={data.id} value={data.id}>
                Persona {data.id.padStart(3, "0")} · {layers[data.group]}
              </option>
            ))}
          </select>
          <div className="node-context" aria-live="polite" aria-atomic="true">
            {detail ? (
              <>
                <div className="node-context-id">
                  Persona <strong>{detail.id.padStart(3, "0")}</strong>
                </div>
                <div
                  className="node-state-tag"
                  title={states[detail.state].description}
                  style={
                    {
                      "--state-color": states[detail.state].color,
                    } as CSSProperties
                  }
                >
                  <span
                    className="seir-status-dot"
                  />
                  <strong>{detail.state}</strong>
                  {states[detail.state].nodeLabel}
                </div>
                <dl>
                  <div>
                    <dt>Contexto de contacto</dt>
                    <dd>{layers[detail.group]}</dd>
                  </div>
                  <div>
                    <dt>Contactos directos</dt>
                    <dd>{detail.contacts}</dd>
                  </div>
                </dl>
                <div className="node-timeline">
                  <h4>Historial hasta el día {playback.day}</h4>
                  {history.length ? (
                    <ol>
                      {history.map((event, index) => (
                        <li key={index}>
                          <span>Día {event.day}</span>
                          <strong>
                            {event.cause === "initial"
                              ? "Zombie inicial"
                              : event.cause === "contact"
                                ? `Mordido por la persona ${event.sourceNodeId}`
                                : event.cause === "vaccine"
                                  ? "Vacunación"
                                  : event.to === "I"
                                    ? "Transformación en Zombie"
                                    : "Exorcizado"}
                          </strong>
                          <small>
                            {event.from} → {event.to}
                          </small>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Esta persona aún no tiene eventos registrados.</p>
                  )}
                </div>
                {layer !== "All layers" && detail.group !== layer && (
                  <p className="node-layer-notice">
                    Esta persona no pertenece al grupo mostrado.
                  </p>
                )}
                <Button
                  variant="outline"
                  className="node-focus-button"
                  onClick={() => {
                    const cy = network.current;
                    if (cy)
                      cy.fit(
                        cy.getElementById(detail.id).closedNeighborhood(),
                        45,
                      );
                  }}
                >
                  <Crosshair size={14} />
                  Enfocar conexiones
                </Button>
              </>
            ) : (
              <p>Seleccione una persona en la red o por su ID.</p>
            )}
          </div>
        </details>
      </section>
      <div className="simulator-control-column">
      <Suspense
        fallback={
          <p className="temporal-chart-loading">Cargando curva de la demo…</p>
        }
      >
        <TemporalChart day={playback.day} daily={temporalDemo.daily} />
      </Suspense>
        {children}
      </div>
    </div>
  );
}
