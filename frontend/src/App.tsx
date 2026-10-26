import { lazy, Suspense, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownToLine, ChevronDown, CircleHelp, FlaskConical, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defaults, validateScenario, type Scenario } from "@/lib/scenario";

const ContactNetwork = lazy(() =>
  import("@/components/ContactNetwork").then((module) => ({ default: module.ContactNetwork })),
);
const ComparisonChart = lazy(() => import("@/components/ComparisonChart"));
const nf = new Intl.NumberFormat("es-EC");
type Modal = "help" | "export" | "run" | null;
type WorkspaceView = "simulator" | "results";

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
  const [view, setView] = useState<WorkspaceView>("simulator");
  const [layer, setLayer] = useState("All layers");
  const [resetKey, setResetKey] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [advanced, setAdvanced] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const update = (key: keyof Scenario, value: number | string) => {
    setScenario((current) => ({ ...current, [key]: value }));
    setNotice("Configuración modificada. La demo no cambia con estos parámetros.");
    setErrors([]);
  };
  const reset = () => {
    setScenario({ ...defaults });
    setErrors([]);
    setNotice("Configuración base restaurada.");
  };
  const exportConfig = () => {
    const payload = {
      kind: "configuration-draft",
      simulated: false,
      schemaVersion: "1.0",
      scenario,
      notice:
        "UI configuration draft only. Not a canonical experiment request or reproducible result.",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manta-configuration-draft.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setModal(null);
    setNotice("Borrador descargado. No incluye resultados de simulación.");
  };
  const run = () => {
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
    if (!issues.length) setModal("run");
  };

  const parameterPanel = (
    <section className="configuration-panel" aria-labelledby="parameters-title">
      <div className="configuration-heading">
        <h2 id="parameters-title">Parámetros</h2>
        <button type="button" className="plain-action" onClick={reset}>
          <RotateCcw size={16} /> Restablecer
        </button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); run(); }}>
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
          <Field label="Vacunas disponibles" value={scenario.vaccines} onChange={(value) => update("vaccines", value)} unit="dosis" min={0} max={scenario.population} />
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
        {errors.length > 0 && (
          <div className="configuration-errors" role="alert">
            <strong>Revise la configuración</strong>
            <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        )}
        <div className="configuration-actions">
          <Button type="submit" className="validate-button">Validar configuración</Button>
          <button type="button" className="plain-action" onClick={() => setModal("export")}>
            <ArrowDownToLine size={17} /> Exportar
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <div className="minimal-workspace">
      <header className="simulation-header">
        <a className="simulation-brand" href="#" onClick={(event) => { event.preventDefault(); setView("simulator"); }} aria-label="Mantalab, inicio">
          <FlaskConical size={25} strokeWidth={1.6} /> Mantalab
        </a>
        <nav aria-label="Navegación principal" className="simulation-navigation">
          <button type="button" aria-current={view === "simulator" ? "page" : undefined} onClick={() => setView("simulator")}>Simulador</button>
          <button type="button" aria-current={view === "results" ? "page" : undefined} onClick={() => setView("results")}>Comparación</button>
          <button type="button" onClick={() => setModal("help")}><CircleHelp size={17} /> Ayuda</button>
        </nav>
        <span className="simulation-status">Demo · API sin conectar</span>
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
            <div className="simulation-toolbar">
              <div><h1>Simulador</h1><p>Manta · población sintética</p></div>
              <div className="simulation-tools">
                <label className="simulation-layer"><span>Capas</span>
                  <select value={layer} onChange={(event) => setLayer(event.target.value)}>
                    {[["All layers", "Todas las capas"], ["Households", "Hogares"], ["Schools", "Colegios"], ["Market", "Mercado"], ["Neighborhoods", "Barrios"], ["Bus routes", "Rutas de bus"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <button type="button" className="plain-action" onClick={() => setResetKey((current) => current + 1)}><RotateCcw size={17} /> Centrar red</button>
              </div>
            </div>
            <Suspense fallback={<div className="simulation-loading" role="status">Cargando simulador…</div>}>
              <ContactNetwork resetKey={resetKey} layer={layer}>{parameterPanel}</ContactNetwork>
            </Suspense>
          </>
        ) : (
          <section className="results-view" aria-labelledby="results-title">
            <div className="results-heading"><h1 id="results-title">Comparación de estrategias</h1><p>Sin resultados experimentales. El motor aún no está conectado.</p></div>
            <div className="results-example">
              <h2>Ejemplo de trayectorias</h2>
              <p>Datos ilustrativos: no corresponden a la configuración ni demuestran la eficacia de una estrategia.</p>
              <Suspense fallback={<div className="simulation-loading" role="status">Cargando gráfica…</div>}><ComparisonChart /></Suspense>
              <div className="results-axis"><span>Personas</span><span>Días desde el inicio del brote</span></div>
            </div>
            <dl className="results-strategies">
              <div><dt>Sin intervención</dt><dd>Brote sin administrar vacunas.</dd></div>
              <div><dt>Aleatoria</dt><dd>Dosis distribuidas al azar entre personas Sanas.</dd></div>
              <div><dt>Dirigida</dt><dd>Prioridad a personas Sanas con más conexiones ponderadas.</dd></div>
            </dl>
            <button type="button" className="plain-action" onClick={() => setView("simulator")}>Volver al simulador</button>
          </section>
        )}
        <footer className="simulation-footer">Modelo educativo · No utilizar para decisiones sanitarias reales.</footer>
      </main>
      <Dialog.Root open={modal !== null} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="modal-dimmer" />
          <Dialog.Popup className="modal minimal-dialog">
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Cerrar diálogo"><X size={19} /></button>
            <Dialog.Title>{modal === "help" ? "Acerca de esta demo" : modal === "run" ? "Configuración validada" : "Exportar configuración"}</Dialog.Title>
            <p>{modal === "help"
              ? "La red y la curva muestran una demo independiente de los parámetros. Sano (S), Mordido (E), Zombie (I) y Exorcizado (R) representan los estados del modelo SEIR. La comparación real de estrategias requiere conectar el motor de simulación."
              : modal === "run"
                ? "Los parámetros son válidos. La API aún no está conectada: no se ha ejecutado un experimento y la demo no cambia."
                : "Descargue un borrador de los parámetros en JSON. No incluye resultados de simulación ni un experimento reproducible."}</p>
            {modal === "run" && <div className="run-summary"><span>{nf.format(scenario.population)} personas</span><span>{scenario.days} días</span><span>{scenario.repetitions} réplicas</span></div>}
            <div className="modal-actions">
              <Button variant="outline" onClick={() => setModal(null)}>Volver</Button>
              {modal === "export" && <Button onClick={exportConfig}><ArrowDownToLine size={17} /> Descargar borrador</Button>}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
