import { experimentZip } from '@/lib/export-experiment';
import { CombinedInterventions } from '@/components/CombinedInterventions';
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownToLine, ChevronDown, CircleHelp, Network, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seirColors } from "@/components/seir-colors";
import { ApiErrorPanel } from "@/components/ApiErrorPanel";
import { defaults, validateScenario, fromConfiguration, applyServerDefaults, matchesLoadedScenario, type Scenario } from "@/lib/scenario";
import { ApiError, createApiClient, toConfiguration, type PreviewResponse, type CompareResponse, type HealthResponse, type ConfigResponse } from "@/lib/api";
import { numericInputError, percentInputValue, probabilityFromPercent } from "@/lib/parameter-input";

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
type Modal = "help" | "export" | null;
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
  help,
  maxMessage,
  percentage = false,
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  min: number;
  max: number;
  step?: number | "any";
  help?: string;
  maxMessage?: string;
  percentage?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputValue = percentage ? percentInputValue(value, focused) : Number.isNaN(value) ? "" : value;
  const exactValue = percentage && Number.isFinite(value) ? Number(percentInputValue(value, true)) : value;
  const error = numericInputError(exactValue, min, max, step === 1, maxMessage);
  const showError = touched && Boolean(error);
  const approximate = percentage && !compact && !focused && inputValue !== percentInputValue(value, true);
  const descriptions = [help && !compact ? `${id}-help` : '', percentage && !compact ? `${id}-precision` : '', showError ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field parameter-field${percentage ? " parameter-field--percentage" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap${approximate ? " input-wrap--approximate" : ""}`}>
        {approximate && <span className="input-approx" aria-hidden="true">≈</span>}
        <input
          id={id}
          name={label}
          autoComplete="off"
          inputMode={step === 1 ? "numeric" : "decimal"}
          type="number"
          aria-label={`${label}${unit ? ` (${unit})` : ""}`}
          aria-describedby={descriptions}
          aria-invalid={showError || undefined}
          value={inputValue}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTouched(true); }}
          onInvalid={() => setTouched(true)}
          onChange={(e) => {
            const next = percentage ? probabilityFromPercent(e.target.value) : e.target.value === "" ? NaN : Number(e.target.value);
            if (!Object.is(next, value)) onChange(next);
          }}
          min={min}
          max={max}
          step={step}
          required
        />
        <span className="input-unit" aria-hidden="true">{unit}</span>
      </div>
      {help && !compact && <small id={`${id}-help`} className="parameter-help">{help}</small>}
      {percentage && !compact && <small id={`${id}-precision`} className="parameter-precision">{approximate ? "≈ Valor redondeado. Al editar verás todos los decimales." : "De 0 a 100 %. Al editar se conserva la precisión completa."}</small>}
      {showError && <small id={`${id}-error`} className="parameter-error" role="alert">{error}</small>}
    </div>
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
    if (remotePreview) previewSubmit.current?.focus({ preventScroll: true });
  }, [remotePreview]);


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
          .replace("Transmission must be between 0 and 1.", "La facilidad de contagio debe estar entre 0 y 100.")
          .replace("Progression must be between 0 and 1.", "La probabilidad diaria de pasar de mordido a zombie debe estar entre 0 y 100 %.")
          .replace("Recovery must be between 0 and 1.", "La probabilidad diaria de recuperación debe estar entre 0 y 100 %.")
          .replace("Efficacy must be between 0 and 1.", "La eficacia de la vacuna debe estar entre 0 y 100 %.")
          .replace(" must be an integer from ", " debe ser un entero entre ")
          .replace(" must be between ", " debe estar entre ")
          .replace(" to ", " y ")
          .replace(" and ", " y ")
          .replace("Population", "Población")
          .replace("Horizon", "Duración")
          .replace("Initial cases", "Casos iniciales")
          .replace("Vaccines", "Vacunas")
          .replace("Intervention day", "Día de vacunación")
          .replace("Replicates", "Repeticiones del experimento")
          .replace("Seed", "Semilla")
          .replace("Transmission", "Transmisión")
          .replace("Progression", "Progresión")
          .replace("Recovery", "Recuperación")
          .replace("Efficacy", "Eficacia")
          .replace("Node ID", "Número de persona")
          .replace("Choose a valid origin.", "Elige un origen válido."),
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
      setNotice(`Red lista: ${nf.format(result.graph.nodes.length)} personas y ${nf.format(result.graph.edges.length)} contactos. Ya puedes comparar estrategias.`);
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
        <h2 id="parameters-title">Escenario</h2>
        <button type="button" className="plain-action" onClick={reset}>
          <RotateCcw size={16} /> Restablecer
        </button>
      </div>
      {!serverConfig && <p role="status">{serverStatus === 'checking' ? 'Cargando configuración; puedes editar mientras esperas.' : 'Servidor no disponible. Tus entradas se conservan.'}</p>}
      <form id="scenario-form" onSubmit={(event) => { event.preventDefault(); run(); }}>
        <div className="configuration-fields">
          <Field label="Población" help="50 a 2000 personas." value={scenario.population} onChange={(value) => update("population", value)} unit="personas" min={50} max={2000} />
          <Field label="Duración" help="1 a 180 días." value={scenario.days} onChange={(value) => update("days", value)} unit="días" min={1} max={180} />
          <label className="field origin-field">
            <span>Origen del brote</span>
            <div className="select-wrap">
              <select aria-label="Origen del brote" aria-describedby="origin-help" value={scenario.origin} onChange={(event) => update("origin", event.target.value)}>
                {[["random", "Origen aleatorio"], ["household", "Hogar"], ["school", "Colegio"], ["bus", "Ruta de bus"], ["market", "Mercado"], ["neighborhood", "Barrio"], ["node", "Persona específica"]].map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
            <small id="origin-help" className="parameter-help">Dónde comienza el brote.</small>
          </label>
          <div className="field transmission-field" role="group" aria-label="Facilidad de contagio" aria-describedby="transmission-help">
            <Field label="Facilidad de contagio" value={scenario.beta} onChange={(value) => update("beta", value)} compact percentage unit="de 100" min={0} max={100} step="any" />
            <input className="range" aria-label="Facilidad de contagio" aria-valuetext={Number.isNaN(scenario.beta) ? "Sin valor" : `${percentInputValue(scenario.beta, false)} de 100`} aria-describedby="transmission-help" type="range" min="0" max="100" step="1" value={Number.isFinite(scenario.beta) ? Number(percentInputValue(scenario.beta, false)) : 0} onChange={(event) => update("beta", probabilityFromPercent(event.target.value))} />
            <small className="transmission-scale" aria-hidden="true"><span>0 · Sin nuevos contagios</span><span>100 · Mayor facilidad</span></small>
            <small id="transmission-help" className="parameter-help">Mayor valor, mayor facilidad de contagio.</small>
          </div>
          {scenario.origin === "node" && (
            <Field label="Número de persona" help="Identificador de la persona donde comienza el brote; la numeración empieza en 0." value={scenario.node} onChange={(value) => update("node", value)} min={0} max={scenario.population - 1} maxMessage="El número de persona debe ser menor que la población. Elige un identificador de la red." />
          )}
        </div>
        <fieldset className="scenario-section">
          <legend>Vacunación</legend>
          <div className="configuration-fields">
            <Field label={scenario.combined?.resourceSchedule ? 'Dosis iniciales' : 'Dosis disponibles'} value={scenario.vaccines} onChange={(value) => update("vaccines", value)} unit="dosis" min={0} max={scenario.population} maxMessage="Las dosis no pueden superar la población. Reduce las dosis o aumenta la población." />
            <Field label="Eficacia" value={scenario.efficacy} onChange={(value) => update("efficacy", value)} compact percentage unit="%" min={0} max={100} step="any" />
          </div>
          <Field label="Día de vacunación" help="0 = inicio del brote." value={scenario.interventionDay} onChange={(value) => update("interventionDay", value)} unit="día" min={0} max={scenario.days} maxMessage="La vacunación debe comenzar dentro de la simulación. Reduce el día o aumenta la duración." />
        </fieldset>
        <section className="strategy-explanation" aria-labelledby="strategy-explanation-title">
          <h3 id="strategy-explanation-title">Estrategias que se compararán</h3>
          <dl>
            <div><dt>Sin intervención</dt><dd>No aplica vacunas. Sirve como referencia para medir el efecto de las otras estrategias.</dd></div>
            <div><dt>Aleatoria</dt><dd>Elige al azar a las personas sanas que recibirán las dosis disponibles.</dd></div>
            <div><dt>Dirigida</dt><dd>Prioriza a las personas sanas más conectadas con otras personas sanas, considerando la intensidad de los contactos activos del día.</dd></div>
          </dl>
          <p>Comparar estrategias ejecuta las tres. Después podrás elegir cuál visualizar, sin repetir la comparación.</p>
        </section>
        <button type="button" className="advanced-toggle" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} aria-controls="advanced-parameters">
          Parámetros avanzados <ChevronDown size={16} className={advanced ? "rotate" : ""} />
        </button>
        {advanced && (
          <div className="configuration-advanced" id="advanced-parameters">
            <div className="configuration-fields">
              <Field label="Casos iniciales" help="Infectados al inicio." value={scenario.initial} onChange={(value) => update("initial", value)} unit="personas" min={1} max={Math.min(20, scenario.population)} />
              <Field label="Probabilidad diaria de pasar de mordido a zombie" value={scenario.sigma} onChange={(value) => update("sigma", value)} compact percentage unit="%" min={0} max={100} step="any" />
              <Field label="Probabilidad diaria de recuperación" value={scenario.gamma} onChange={(value) => update("gamma", value)} compact percentage unit="%" min={0} max={100} step="any" />
              <Field label="Repeticiones del experimento" help="2 a 30 repeticiones para medir la variación." value={scenario.repetitions} onChange={(value) => update("repetitions", value)} unit="repeticiones" min={2} max={30} />
              <Field label="Semilla para reproducir el experimento" help="Identifica los sorteos del experimento." value={scenario.seed} onChange={(value) => update("seed", value)} min={0} max={4294967295} />
            </div>
            <p>Para reproducir: misma configuración, semilla y versión del motor.</p>
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
            <strong>Revisa la configuración</strong>
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
    <Button type="submit" form="scenario-form" className={`validate-button${remotePreview ? " validate-button--secondary" : ""}`} ref={previewSubmit} aria-describedby="scenario-next-step" title={!serverConfig ? "Espera a que el servidor esté disponible." : pending ? "La red se está preparando." : "Crea la red de personas y contactos con estos parámetros."} disabled={pending || !serverConfig}>{pending ? "Consultando red…" : "Consultar red"}</Button>
  );
  const compareButton = (
    <Button type="button" variant={remotePreview ? "default" : "outline"} className={remotePreview ? "validate-button comparison-button" : "comparison-button"} aria-describedby="scenario-next-step" title={!remotePreview ? "Primero consulta la red." : comparisonPending ? "La comparación está en curso." : "Compara las estrategias usando el mismo escenario."} disabled={!remotePreview || pending || comparisonPending} onClick={runComparison}>{comparisonPending ? "Comparando…" : "Comparar estrategias"}</Button>
  );
  const cancelComparison = () => {
    invalidateComparison();
    setApiFailure(null);
    setView("simulator");
    setNotice("Comparación cancelada. Tus parámetros se conservan.");
  };
  const configurationActions = (
    <div className="configuration-actions">
      <p id="scenario-next-step" className="scenario-next-step" role="status">{pending ? 'Preparando la población…' : comparisonPending ? 'Comparación en curso…' : remotePreview ? comparison ? 'Revisa la comparación y luego explora los días en Reproducción y estrategia.' : 'Red lista. Compara las tres estrategias.' : 'Configura el escenario y consulta la red para comparar.'}</p>
      {previewButton}{compareButton}
      <button type="button" className="plain-action" title={comparison ? "Elige cómo descargar los resultados del experimento." : "Descarga los parámetros actuales como borrador."} onClick={event => { dialogReturn.current = event.currentTarget; setModal("export"); }}>
        <ArrowDownToLine size={17} /> Exportar
      </button>
      {comparisonPending && <button type="button" className="plain-action cancel-comparison" onClick={cancelComparison}>Cancelar comparación</button>}
    </div>
  );

  return (
    <div className={`minimal-workspace noche-cero${view === "simulator" ? " simulator-page" : ""}`}>
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
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
      <main id="main-content" tabIndex={-1} className="simulation-main">
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
            {comparison && <section className="results-reading-guide" aria-labelledby="reading-guide-title">
              <h2 id="reading-guide-title">Cómo leer la comparación</h2>
              <p>Compara los infectados acumulados y el pico de zombies entre estrategias. Revisa también la variación entre repeticiones: una media menor no garantiza el mismo resultado en cada simulación.</p>
              <p>Después, vuelve a la red y abre <strong>Reproducción y estrategia</strong> para recorrer los días de una repetición. Esa trayectoria no representa el promedio.</p>
            </section>}
            {comparison ? <Suspense fallback={<p role="status">Cargando resultados…</p>}><ComparisonResults result={comparison} region={serverHealth?.region} onExport={exportConfig} onExportCsv={exportCsv} /></Suspense> : <div className="comparison-empty">
              <div className="comparison-empty-content"><h1 id="results-title">Compara las estrategias de vacunación</h1><p role="status">{comparisonPending ? `Ejecutando ${scenario.repetitions} repeticiones con tres estrategias…` : remotePreview ? "La red está lista. Compara las estrategias Sin intervención, Aleatoria y Dirigida con la misma población." : "Configura un escenario y consulta la red antes de comparar."}</p>
              {comparisonPending && <p>El motor está calculando el experimento. Los resultados aparecerán cuando termine.</p>}
              {apiFailure?.operation === "comparison" && <ApiErrorPanel
                error={apiFailure.error}
                operation="comparison"
                onRetry={() => { setApiFailure(null); void runComparison(); }}
                onOpenParameters={() => { setView("simulator"); setApiFailure(null); }}
                onRepreview={() => { setView("simulator"); setApiFailure(null); void run(); }}
              />}
              <div className="comparison-empty-actions">{comparisonPending ? <Button type="button" className="comparison-start" onClick={cancelComparison}>Cancelar comparación</Button> : <Button type="button" className="comparison-start" disabled={!remotePreview || pending} onClick={runComparison}>Comparar estrategias</Button>}<button type="button" className="plain-action" onClick={() => setView("simulator")}>{remotePreview ? "Volver a la red" : "Configurar escenario"}</button></div></div>
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
            <Dialog.Title>{modal === "help" ? "Cómo usar el simulador" : comparison ? "Exportar experimento" : "Exportar configuración"}</Dialog.Title>
            {modal === "help" ? (
              <div className="help-content">
                <p>Explora cómo cambia un brote ficticio en una población sintética de Manta.</p>
                <ol className="help-steps">
                  <li><strong>Consulta la red.</strong> Configura el escenario. Verás las personas y sus contactos al inicio del brote.</li>
                  <li><strong>Compara estrategias.</strong> Revisa Sin intervención, Aleatoria y Dirigida en Comparación. Cada repetición utiliza otros sorteos.</li>
                  <li><strong>Explora los días.</strong> Vuelve a la red y pulsa Reproducir. En Reproducción y estrategia puedes cambiar la estrategia. Se muestra una repetición, no el promedio.</li>
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
                <p className="help-note">Las vacunas se aplican al comparar estrategias, desde el día configurado. Modelo educativo: no usar para decisiones sanitarias reales.</p>
              </div>
            ) : (
              <p>{comparison ? "JSON conserva el experimento para reproducirlo. ZIP incluye tablas CSV para analizar los resultados." : "Descarga los parámetros en JSON. Este borrador no incluye resultados."}</p>
            )}
            <div className="modal-actions">
              <Button variant="outline" onClick={() => setModal(null)}>Volver</Button>
              {modal === "export" && comparison && <Button variant="outline" onClick={exportCsv}>Descargar ZIP con CSV</Button>}
              {modal === "export" && <Button className="action-primary" onClick={exportConfig}><ArrowDownToLine size={17} /> {comparison ? "Descargar experimento" : "Descargar borrador"}</Button>}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
