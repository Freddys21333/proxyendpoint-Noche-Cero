import { experimentZip } from '@/lib/export-experiment';
import { CombinedInterventions } from '@/components/CombinedInterventions';
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownToLine, ChevronDown, CircleHelp, Network, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seirColors } from "@/components/seir-colors";
import { ApiErrorPanel } from "@/components/ApiErrorPanel";
import { defaults, validateScenario, fromConfiguration, applyServerDefaults, matchesLoadedScenario, type Scenario } from "@/lib/scenario";
import { ApiError, createApiClient, toConfiguration, type PreviewResponse, type CompareResponse, type HealthResponse, type ConfigResponse } from "@/lib/api";

const ContactNetwork = lazy(() =>
  import("@/components/ContactNetwork").then((module) => ({ default: module.ContactNetwork })),
);
const ComparisonResults = lazy(() => import("@/components/ComparisonResults").then(module => ({ default: module.ComparisonResults })));
const ProWorkspace = lazy(() => import("@/pro/ProWorkspace").then(module => ({ default: module.ProWorkspace })));
const nf = new Intl.NumberFormat("es-EC");
const seirHelp = [
  ["S", "Sano", "Sin infección."],
  ["E", "Mordido", "Expuesto, aún no transmite."],
  ["I", "Zombie", "Infectado y transmite."],
  ["R", "Exorcizado", "Recuperado o inmune."],
] as const;
const api = createApiClient(import.meta.env.VITE_API_BASE_URL || "/v1");
type Modal = "help" | "export" | "run" | null;
type WorkspaceView = "simulator" | "results" | "pro";
type ApiOperation = "startup" | "preview" | "comparison";

function Field({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          type="number"
          value={Number.isNaN(value) ? "" : value}
          onChange={(e) =>
            onChange(e.target.value === "" ? NaN : Number(e.target.value))
          }
          min={min}
          max={max}
          step={step}
          required
        />
        <span className="input-unit">{unit}</span>
      </div>
    </label>
  );
}

export default function App() {
  const [scenario, setScenario] = useState<Scenario>({ ...defaults });
  const [serverConfig, setServerConfig] = useState<ConfigResponse | null>(null);
  const editedFields = useRef(new Set<keyof Scenario>());
  const [view, setView] = useState<WorkspaceView>("simulator");
  const [layer, setLayer] = useState("All layers");
  const [resetKey, setResetKey] = useState(0);
  const previewSubmit = useRef<HTMLButtonElement>(null);
  const dialogReturn = useRef<HTMLElement | 'preview' | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [advanced, setAdvanced] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [apiFailure, setApiFailure] = useState<{ operation: ApiOperation; error: ApiError } | null>(null);
  const [configRetry, setConfigRetry] = useState(0);
  const [serverStatus, setServerStatus] = useState<"checking" | "ready" | "offline">("checking");
  const [remotePreview, setRemotePreview] = useState<PreviewResponse | null>(null);
  const [pending, setPending] = useState(false);
  const previewController = useRef<AbortController | null>(null);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [comparisonPending, setComparisonPending] = useState(false);
  const [comparisonErrors, setComparisonErrors] = useState<string[]>([]);
  const [serverHealth, setServerHealth] = useState<HealthResponse | null>(null);
  const comparisonController = useRef<AbortController | null>(null);
  const loadedScenario = useRef<{ preview: PreviewResponse; comparison: CompareResponse | null } | null>(null);


  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.health(controller.signal), api.config(controller.signal)])
      .then(([health, config]) => { if (!controller.signal.aborted) { setServerStatus("ready"); setApiFailure(null); setServerHealth(health); setServerConfig(config); setScenario(current => applyServerDefaults(current, config.defaults, editedFields.current)); } })
      .catch((error) => { if (!controller.signal.aborted) { setServerStatus("offline"); setApiFailure({ operation: "startup", error: error instanceof ApiError ? error : new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor.") }); } });
    return () => { controller.abort(); previewController.current?.abort(); comparisonController.current?.abort(); };
  }, [configRetry]);

  const invalidateComparison = () => {
    comparisonController.current?.abort();
    comparisonController.current = null;
    setComparison(null);
    setComparisonPending(false);
    setComparisonErrors([]);
  };

  const invalidatePreview = () => {
    invalidateComparison();
    previewController.current?.abort();
    previewController.current = null;
    setRemotePreview(null);
    setPending(false);
    setModal((current) => current === "run" ? null : current);
  };


  const applyScenario = (next: Scenario) => {
    invalidatePreview();
    setScenario(next);
    const loaded = loadedScenario.current;
    if (loaded && matchesLoadedScenario(next, loaded.preview.configuration)) {
      setRemotePreview(loaded.preview);
      setComparison(loaded.comparison);
      setNotice("Parámetros del escenario cargado restaurados. La visualización vuelve a estar disponible.");
    } else {
      setNotice("Configuración modificada. Consulta la red para aplicar los nuevos parámetros.");
    }
    setErrors([]);
    setApiFailure(null);
  };
  const update = (key: keyof Scenario, value: number | string) => {
    editedFields.current.add(key);
    applyScenario({ ...scenario, [key]: value });
  };
  const reset = () => {
    editedFields.current.clear();
    applyScenario(serverConfig ? fromConfiguration(serverConfig.defaults) : { ...defaults });
  };
  const exportConfig = () => {
    const payload = comparison ?? {
      kind: "configuration-draft",
      simulated: false,
      schemaVersion: "1.0",
      scenario,
      notice:
        "UI configuration draft only. Not a canonical experiment request or reproducible result.",
    };
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = comparison ? `manta-experiment-${comparison.configuration.rootSeed}.json` : "manta-configuration-draft.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setModal(null);
    setNotice(comparison ? "Experimento JSON descargado con configuración, semillas, resultados y versiones." : "Borrador descargado. No incluye resultados de simulación.");
  };
  const exportCsv = () => {
    if (!comparison) return;
    try {
      const blob = new Blob([experimentZip(comparison)], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `manta-experiment-${comparison.configuration.rootSeed}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setModal(null);
      setNotice('ZIP descargado con CSV de resultados y metadatos. Conserva también el JSON para reproducir el experimento.');
    } catch {
      setNotice('No se pudo generar el ZIP del experimento. Puedes descargar el JSON e intentarlo nuevamente.');
    }
  };
  const run = async () => {
    if (!serverConfig) { setErrors(["Espera a que se cargue la configuración del servidor."]); return; }
    setApiFailure(null);
    const issues = validateScenario(scenario);
    setErrors(
      issues.map((message) =>
        message
          .replace(" must be an integer from ", " debe ser un entero entre ")
          .replace(" must be between ", " debe estar entre ")
          .replace(" to ", " y ")
          .replace(" and ", " y ")
          .replace("Population", "Población")
          .replace("Horizon", "Horizonte")
          .replace("Initial cases", "Casos iniciales")
          .replace("Vaccines", "Vacunas")
          .replace("Intervention day", "Día de intervención")
          .replace("Replicates", "Réplicas")
          .replace("Seed", "Semilla")
          .replace("Transmission", "Transmisión")
          .replace("Progression", "Progresión")
          .replace("Recovery", "Recuperación")
          .replace("Efficacy", "Eficacia")
          .replace("Node ID", "Número de persona")
          .replace("Choose a valid origin.", "Seleccione un origen válido."),
      ),
    );
    if (issues.length) return;
    setApiFailure(null);
    invalidateComparison();
    previewController.current?.abort();
    const controller = new AbortController();
    previewController.current = controller;
    setRemotePreview(null);
    setPending(true);
    try {
      const result = await api.preview(toConfiguration(scenario, serverConfig.defaults), controller.signal, serverConfig.limits);
      if (controller.signal.aborted) return;
      loadedScenario.current = { preview: result, comparison: null };
      setRemotePreview(result);
      setServerStatus("ready");
      dialogReturn.current = 'preview';
      setModal("run");
      setNotice("Vista previa recibida. La red muestra los contactos iniciales de tus parámetros.");
    } catch (error) {
      if (controller.signal.aborted) return;
      const apiError = error instanceof ApiError ? error : new ApiError(0, "NETWORK_ERROR", "No se pudo consultar la red.");
      setErrors([]);
      setApiFailure({ operation: "preview", error: apiError });
      if (apiError.status === 0) setServerStatus("offline");
    } finally {
      if (previewController.current === controller) {
        previewController.current = null;
        setPending(false);
      }
    }
  };

  const runComparison = async () => {
    if (!remotePreview || pending || comparisonPending) return;
    comparisonController.current?.abort();
    const controller = new AbortController();
    comparisonController.current = controller;
    setComparison(null);
    setComparisonErrors([]);
    setApiFailure(null);
    setComparisonPending(true);
    setView("results");
    setModal(null);
    try {
      const result = await api.compareForPlayback(remotePreview.configuration, remotePreview.graphHash, controller.signal, serverConfig?.limits);
      if (controller.signal.aborted) return;
      loadedScenario.current = { preview: remotePreview, comparison: result };
      setComparison(result);
      setNotice("Comparación completada con resultados reales del motor.");
    } catch (error) {
      if (controller.signal.aborted) return;
      const apiError = error instanceof ApiError ? error : new ApiError(0, "NETWORK_ERROR", "No se pudo completar la comparación.");
      setComparisonErrors([apiError.code]);
      setErrors([]);
      setApiFailure({ operation: "comparison", error: apiError });
      if (apiError.status === 0) setServerStatus("offline");
      if (apiError.status === 409) { setRemotePreview(null); loadedScenario.current = null; }
    } finally {
      if (comparisonController.current === controller) { comparisonController.current = null; setComparisonPending(false); }
    }
  };

  const parameterPanel = (
    <section className="configuration-panel" aria-labelledby="parameters-title">
      <div className="configuration-heading">
        <h2 id="parameters-title">Parámetros</h2>
        <button type="button" className="plain-action" onClick={reset}>
          <RotateCcw size={16} /> Restablecer
        </button>
      </div>
      <p role="status">{serverConfig ? 'Valores predeterminados del servidor cargados. Restablecer recupera esos valores.' : serverStatus === 'checking' ? 'Cargando configuración del servidor; puedes editar los campos mientras esperas.' : 'Configuración del servidor no disponible. Tus entradas están conservadas.'}</p>
      <form id="scenario-form" onSubmit={(event) => { event.preventDefault(); run(); }}>
        <div className="configuration-fields">
          <Field label="Población" value={scenario.population} onChange={(value) => update("population", value)} unit="personas" min={50} max={2000} />
          <Field label="Horizonte" value={scenario.days} onChange={(value) => update("days", value)} unit="días" min={1} max={180} />
          <label className="field">
            <span>Origen del brote</span>
            <div className="select-wrap">
              <select value={scenario.origin} onChange={(event) => update("origin", event.target.value)}>
                {[["random", "Origen aleatorio"], ["household", "Hogar"], ["school", "Colegio"], ["bus", "Ruta de bus"], ["market", "Mercado"], ["neighborhood", "Barrio"], ["node", "Persona específica"]].map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          </label>
          <label className="field transmission-field">
            <span>Tasa de transmisión <output>{Number.isNaN(scenario.beta) ? "—" : scenario.beta.toFixed(2)}</output></span>
            <input className="range" aria-label="Tasa de transmisión" type="range" min="0" max="1" step="0.01" value={Number.isNaN(scenario.beta) ? 0 : scenario.beta} onChange={(event) => update("beta", Number(event.target.value))} />
          </label>
          {scenario.origin === "node" && (
            <Field label="Número de persona" value={scenario.node} onChange={(value) => update("node", value)} min={0} max={scenario.population - 1} />
          )}
          <Field label={scenario.combined?.resourceSchedule ? 'Vacunas iniciales' : 'Vacunas disponibles'} value={scenario.vaccines} onChange={(value) => update("vaccines", value)} unit="dosis" min={0} max={scenario.population} />
          <Field label="Eficacia de la vacuna" value={scenario.efficacy * 100} onChange={(value) => update("efficacy", value / 100)} unit="%" min={0} max={100} />
        </div>
        <button type="button" className="advanced-toggle" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} aria-controls="advanced-parameters">
          Parámetros avanzados <ChevronDown size={16} className={advanced ? "rotate" : ""} />
        </button>
        {advanced && (
          <div className="configuration-advanced" id="advanced-parameters">
            <div className="configuration-fields">
              <Field label="Casos iniciales" value={scenario.initial} onChange={(value) => update("initial", value)} min={1} max={Math.min(20, scenario.population)} />
              <Field label="Día de intervención" value={scenario.interventionDay} onChange={(value) => update("interventionDay", value)} min={0} max={scenario.days} />
              <Field label="Progresión σ / día" value={scenario.sigma} onChange={(value) => update("sigma", value)} min={0} max={1} step={0.000001} />
              <Field label="Recuperación γ / día" value={scenario.gamma} onChange={(value) => update("gamma", value)} min={0} max={1} step={0.000001} />
              <Field label="Réplicas" value={scenario.repetitions} onChange={(value) => update("repetitions", value)} min={2} max={30} />
              <Field label="Semilla aleatoria" value={scenario.seed} onChange={(value) => update("seed", value)} min={0} max={4294967295} />
            </div>
            <p>σ y γ son probabilidades diarias, no duraciones.</p>
          </div>
        )}
        <CombinedInterventions value={scenario.combined} days={scenario.days} population={scenario.population} onChange={combined => {
          editedFields.current.add('combined');
          const next = { ...scenario };
          if (combined) next.combined = combined; else delete next.combined;
          applyScenario(next);
        }} />
        {errors.length > 0 && (
          <div className="configuration-errors" role="alert">
            <strong>Revise la configuración</strong>
            <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        )}
        {apiFailure && (apiFailure.operation === "startup" || apiFailure.operation === "preview") && <ApiErrorPanel
          error={apiFailure.error}
          operation={apiFailure.operation}
          onRetry={apiFailure.operation === "startup" ? () => setConfigRetry(value => value + 1) : () => { setApiFailure(null); void run(); }}
          onOpenParameters={() => { setView("simulator"); setApiFailure(null); previewSubmit.current?.focus(); }}
          onRepreview={() => { setView("simulator"); setApiFailure(null); void run(); }}
        />}
      </form>
    </section>
  );

  const previewButton = (
    <Button type="submit" form="scenario-form" className={`validate-button${remotePreview ? " validate-button--secondary" : ""}`} ref={previewSubmit} disabled={pending || !serverConfig}>{pending ? "Consultando red…" : "Consultar red"}</Button>
  );
  const compareButton = (
    <Button type="button" variant={remotePreview ? "default" : "outline"} className={remotePreview ? "validate-button comparison-button" : "comparison-button"} disabled={!remotePreview || pending || comparisonPending} onClick={runComparison}>{comparisonPending ? "Comparando…" : "Comparar estrategias"}</Button>
  );
  const cancelComparison = () => {
    invalidateComparison();
    setApiFailure(null);
    setView("simulator");
    setNotice("Comparación cancelada. Tus parámetros se conservan.");
  };
  const configurationActions = (
    <div className="configuration-actions">
      {remotePreview ? <>{compareButton}{previewButton}</> : <>{previewButton}{compareButton}</>}
      <button type="button" className="plain-action" onClick={event => { dialogReturn.current = event.currentTarget; setModal("export"); }}>
        <ArrowDownToLine size={17} /> Exportar
      </button>
      {comparisonPending && <button type="button" className="plain-action cancel-comparison" onClick={cancelComparison}>Cancelar comparación</button>}
    </div>
  );

  return (
    <div className={`minimal-workspace noche-cero${view === "simulator" ? " simulator-page" : ""}`}>
      <header className="simulation-header">
        <a className="simulation-brand" href="#" onClick={(event) => { event.preventDefault(); setView("simulator"); }} aria-label="Noche Cero, inicio">
          <span className="brand-sigil" aria-hidden="true"><Network size={24} strokeWidth={1.9} /></span>
          <span className="brand-wordmark">NOCHE <strong>CERO</strong><small>LABORATORIO DE PROPAGACIÓN</small></span>
        </a>
        <nav aria-label="Navegación principal" className="simulation-navigation">
          <button type="button" aria-current={view === "simulator" ? "page" : undefined} onClick={() => setView("simulator")}>Explorar red</button>
          <button type="button" aria-current={view === "results" ? "page" : undefined} onClick={() => setView("results")}>Comparación</button>
          <button type="button" aria-current={view === "pro" ? "page" : undefined} onClick={() => setView("pro")} title="Experimentos Monte Carlo">PRO</button>
          <button type="button" onClick={event => { dialogReturn.current = event.currentTarget; setModal("help"); }}><CircleHelp size={17} /> Ayuda</button>
        </nav>
        <span className={`simulation-status simulation-status--${serverStatus}`} role="status"><span className="status-beacon" aria-hidden="true" />{serverStatus === "ready" ? "Servidor disponible" : serverStatus === "checking" ? "Conectando" : "Servidor sin conexión"}<span className="simulation-status-context"> · {view === "pro" ? "PRO · trabajos de ejemplo" : comparison ? "Experimento real" : remotePreview ? "Vista previa real" : "Sin vista previa actual"}</span></span>
      </header>
      <main className="simulation-main">
        {notice && (
          <div className="simulation-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso"><X size={17} /></button>
          </div>
        )}
        {view === "simulator" ? (
          <>
            <h1 className="sr-only">Explorar la población y simular el brote</h1>
            <Suspense fallback={<div className="simulation-loading" role="status">Cargando simulador…</div>}>
              <ContactNetwork resetKey={resetKey} layer={layer} preview={remotePreview} comparison={comparison} comparisonState={comparisonPending ? 'running' : comparisonErrors.length ? 'error' : 'idle'} panelActions={configurationActions} renderTools={visualizerView => <section className="visualizer-tools" aria-label="Controles de la vista"><div className="simulation-tools">
                <label className="simulation-layer"><span>Tipo de contacto{visualizerView === 'map' ? ' · solo Red' : ''}</span>
                  <select value={layer} disabled={visualizerView === 'map'} aria-describedby={visualizerView === 'map' ? 'contact-filter-help' : undefined} onChange={(event) => setLayer(event.target.value)}>
                    {[["All layers", "Todos los tipos"], ["Households", "Hogares"], ["Schools", "Colegios"], ["Market", "Mercado"], ["Neighborhoods", "Barrios"], ["Bus routes", "Rutas de bus"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <button type="button" className="plain-action" onClick={() => setResetKey((current) => current + 1)}><RotateCcw size={17} />{visualizerView === 'map' ? 'Centrar mapa' : 'Centrar red'}</button>
              </div>{visualizerView === 'map' && <p id="contact-filter-help" className="contact-filter-help">Cambia a Red para filtrar contactos. El mapa muestra todas las personas.</p>}</section>}>{parameterPanel}</ContactNetwork>
            </Suspense>
          </>
        ) : view === "results" ? (
          <section className="results-view" aria-labelledby="results-title">
            {comparison ? <Suspense fallback={<p role="status">Cargando resultados…</p>}><ComparisonResults result={comparison} region={serverHealth?.region} onExport={exportConfig} onExportCsv={exportCsv} /></Suspense> : <div className="comparison-empty">
              <div className="comparison-empty-content"><h1 id="results-title">Las decisiones necesitan evidencia.</h1><p role="status">{comparisonPending ? `Ejecutando ${scenario.repetitions} réplicas con tres estrategias…` : remotePreview ? "La red está lista. Ejecuta la comparación para medir las tres estrategias bajo el mismo escenario." : "Consulta primero la red para generar una población sintética y luego compara las estrategias."}</p>
              {comparisonPending && <p>El motor está calculando el experimento. Los resultados aparecerán cuando termine.</p>}
              {apiFailure?.operation === "comparison" && <ApiErrorPanel
                error={apiFailure.error}
                operation="comparison"
                onRetry={() => { setApiFailure(null); void runComparison(); }}
                onOpenParameters={() => { setView("simulator"); setApiFailure(null); }}
                onRepreview={() => { setView("simulator"); setApiFailure(null); void run(); }}
              />}
              <div className="comparison-empty-actions">{comparisonPending ? <Button type="button" className="comparison-start" onClick={cancelComparison}>Cancelar comparación</Button> : <Button type="button" className="comparison-start" disabled={!remotePreview || pending} onClick={runComparison}>Comparar estrategias</Button>}<button type="button" className="plain-action" onClick={() => setView("simulator")}>{remotePreview ? "Volver a la red" : "Configurar escenario"}</button></div></div>
              <div className="comparison-empty-steps" aria-label="Pasos de la comparación"><span><b>01</b> Consulta la red</span><span><b>02</b> Ejecuta réplicas</span><span><b>03</b> Examina resultados</span></div>
            </div>}
            {comparison && <button type="button" className="plain-action" onClick={() => setView("simulator")}>Volver a la red</button>}
          </section>
        ) : (
          <Suspense fallback={<div className="simulation-loading" role="status">Cargando PRO…</div>}>
            <ProWorkspace comparison={comparison} comparisonPending={comparisonPending} onShowSimulator={() => setView("simulator")} onShowResults={() => setView("results")} />
          </Suspense>
        )}
      </main>
      <Dialog.Root open={modal !== null} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="modal-dimmer" />
          <Dialog.Popup className={`modal minimal-dialog noche-dialog${modal === "help" ? " help-dialog" : ""}`} finalFocus={() => { const target = dialogReturn.current === 'preview' ? previewSubmit.current : dialogReturn.current; return target?.isConnected ? target : false; }}>
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Cerrar diálogo"><X size={19} /></button>
            <Dialog.Title>{modal === "help" ? "Acerca del simulador" : modal === "run" ? "Vista previa de la población" : comparison ? "Exportar experimento" : "Exportar configuración"}</Dialog.Title>
            {modal === "help" ? (
              <div className="help-content">
                <p>Este simulador trabaja con una población sintética de Manta y el motor real del servidor.</p>
                <ol className="help-steps">
                  <li><strong>Consulta la red.</strong> Ajusta la población y los contactos; el servidor devuelve la red inicial con ubicaciones sintéticas.</li>
                  <li><strong>Compara estrategias.</strong> Ejecuta las tres políticas con réplicas reales y revisa medias y dispersión en Comparación.</li>
                  <li><strong>Reproduce una réplica.</strong> Vuelve al simulador, cambia de estrategia y recorre los días. Esa trayectoria no es el promedio.</li>
                </ol>
                <section className="help-section" aria-labelledby="help-seir-title">
                  <h3 id="help-seir-title">Estados SEIR</h3>
                  <dl className="help-states">
                    {seirHelp.map(([key, label, detail]) => (
                      <div key={key}>
                        <dt><span className="help-state-dot" style={{ background: seirColors[key].marker }} aria-hidden="true" />{key} · {label}</dt>
                        <dd>{detail}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <p className="help-note">Antes de comparar, el grafo representa el estado inicial. Las vacunas se aplican al ejecutar la simulación. Modelo educativo: no usar para decisiones sanitarias reales.</p>
              </div>
            ) : (
              <p>{modal === "run"
                ? "La red se calculó en el servidor con tus parámetros. El explorador muestra esta red real y su estado inicial; todavía no se ejecutó una comparación."
                : comparison ? "Descarga el experimento completo con parámetros, versiones, semillas y resultados reproducibles." : "Descargue un borrador de los parámetros en JSON. No incluye resultados de simulación ni un experimento reproducible."}</p>
            )}
            {modal === "run" && remotePreview && <div className="run-summary"><span>{nf.format(remotePreview.graph.nodes.length)} personas</span><span>{nf.format(remotePreview.graph.edges.length)} contactos</span><span>Semilla {remotePreview.configuration.rootSeed}</span></div>}
            <div className="modal-actions">
              <Button variant="outline" onClick={() => setModal(null)}>Volver</Button>
              {modal === "run" && <Button className="action-primary" disabled={comparisonPending} onClick={runComparison}>Comparar estrategias</Button>}
              {modal === "export" && comparison && <Button variant="outline" onClick={exportCsv}>Descargar ZIP con CSV</Button>}
              {modal === "export" && <Button className="action-primary" onClick={exportConfig}><ArrowDownToLine size={17} /> {comparison ? "Descargar experimento" : "Descargar borrador"}</Button>}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
