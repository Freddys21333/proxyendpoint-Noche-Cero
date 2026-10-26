import { lazy, Suspense, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  GitBranch,
  Globe2,
  Info,
  Layers3,
  Menu,
  Network,
  RotateCcw,
  Settings2,
  Shield,
  SlidersHorizontal,
  Target,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
const ContactNetwork = lazy(() =>
  import("@/components/ContactNetwork").then((module) => ({
    default: module.ContactNetwork,
  })),
);
const ComparisonChart = lazy(() => import("@/components/ComparisonChart"));
import {
  defaults,
  applyPreset,
  validateScenario,
  type Preset,
  type Scenario,
} from "@/lib/scenario";

const originLabels: Record<string, string> = {
  random: "Aleatorio",
  household: "Hogar",
  school: "Colegio",
  bus: "Ruta de bus",
  market: "Mercado",
  neighborhood: "Barrio",
  node: "Nodo específico",
};
const nf = new Intl.NumberFormat("es-EC");

const presets: {
  id: Preset;
  title: string;
  detail: string;
  icon: typeof Zap;
}[] = [
  {
    id: "double_beta",
    title: "Contagio intensificado",
    detail: "Duplicar la tasa de transmisión",
    icon: Zap,
  },
  {
    id: "half_vaccines",
    title: "Escasez de vacunas",
    detail: "Reducir las dosis a la mitad",
    icon: Shield,
  },
  {
    id: "market_origin",
    title: "Foco en el mercado",
    detail: "Trasladar el origen al mercado",
    icon: Network,
  },
  {
    id: "partial_efficacy_50",
    title: "Protección parcial",
    detail: "Reducir la eficacia al 50 %",
    icon: Target,
  },
];
type Modal = "help" | "export" | "run" | null;

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
  const [tab, setTab] = useState("Consola");
  const [layer, setLayer] = useState("All layers");
  const [resetKey, setResetKey] = useState(0);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [base, setBase] = useState<Scenario>({ ...defaults });
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const update = (key: keyof Scenario, value: number | string) => {
    setScenario((s) => ({ ...s, [key]: value }));
    setPreset(null);
    setNotice(
      "Configuración modificada. La red y la gráfica son ejemplos independientes de estos parámetros.",
    );
    setErrors([]);
  };
  const selectPreset = (id: Preset) => {
    const source = preset ? base : { ...scenario };
    setBase(source);
    setScenario(applyPreset(source, id));
    setPreset(id);
    setErrors([]);
    setNotice(
      "Perturbación aplicada sobre la configuración base. La comparación real requiere conectar la API.",
    );
  };
  const reset = () => {
    setScenario({ ...defaults });
    setBase({ ...defaults });
    setPreset(null);
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
          .replace("Node ID", "ID del nodo")
          .replace("Choose a valid origin.", "Seleccione un origen válido."),
      ),
    );
    if (!issues.length) setModal("run");
  };
  const navigate = (name: string) => {
    setTab(name);
    setMobileNav(false);
  };

  return (
    <div className="app-frame">
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobileNav ? "is-open" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMobileNav(false);
        }}
      >
        <button
          type="button"
          className="sidebar-close"
          aria-label="Cerrar navegación"
          onClick={() => setMobileNav(false)}
        >
          <X size={18} />
        </button>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Consola");
          }}
          aria-label="Inicio de Mantalab"
        >
          <span className="brand-symbol">
            <svg
              width="34"
              height="38"
              viewBox="0 0 34 38"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M17 2 31 7v11c0 8-5.5 14-14 18C8.5 32 3 26 3 18V7L17 2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9 17c0-5 3-8 8-8s8 3 8 8v5l-3 2v4H12v-4l-3-2v-5Z"
                fill="currentColor"
              />
              <path
                d="m12 16 4 3m0-3-4 3m9-3v3m-7 4h7m-5-1v3m3-3v3"
                stroke="#173E32"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="m20 9-3 4m1-3 2 2"
                stroke="#C45C47"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span>
            Manta<span className="brand-light">lab</span>
            <small>ZOMBIE CONTAINMENT</small>
          </span>
        </a>
        <div className="workspace-label">Operaciones</div>
        <nav aria-label="Navegación principal">
          {[
            { name: "Consola", icon: Layers3 },
            { name: "Configuración", icon: SlidersHorizontal },
            { name: "Resultados", icon: Activity },
            { name: "Brote sorpresa", icon: Zap },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${tab === name ? "active" : ""}`}
              onClick={() => navigate(name)}
              aria-current={tab === name ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{name}</span>
              {tab === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-section">Documentación</div>
        <button className="nav-item" onClick={() => setModal("help")}>
          <BookOpen size={18} />
          Modelo y metodología
          <ArrowUpRight size={13} className="nav-end" />
        </button>
        <button className="nav-item" onClick={() => setModal("export")}>
          <ArrowDownToLine size={18} />
          Exportar configuración
        </button>
        <div className="sidebar-bottom">
          <div className="project-note">
            <span className="live-dot" />
            Protocolo de contención
            <p>
              Entorno experimental. Población sintética, decisiones trazables.
            </p>
          </div>
          <button className="help-link" onClick={() => setModal("help")}>
            <CircleHelp size={16} />
            Guía del laboratorio
            <ArrowUpRight size={14} />
          </button>
          <div className="user">
            <span className="avatar">MC</span>
            <div>
              <strong>Comité de Manta</strong>
              <small>Equipo de investigación</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu"
              onClick={() => setMobileNav(!mobileNav)}
              aria-controls="workspace-navigation"
              aria-expanded={mobileNav}
              aria-label={mobileNav ? "Cerrar navegación" : "Abrir navegación"}
            >
              <Menu size={19} />
            </button>
            <span>Operaciones</span>
            <ChevronRight size={13} />
            <strong>Consola epidemiológica</strong>
          </div>
          <div className="topbar-right">
            <span className="educational">
              <span className="live-dot" />
              Demo · API sin conectar
            </span>
            <button onClick={() => setModal("help")} aria-label="Ayuda">
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <main className="main-sheet">
          <div className="page-heading compact-heading">
            <div>
              <h1>Escenario de contención</h1>
            </div>
            <Button variant="outline" onClick={reset}>
              <RotateCcw size={14} />
              Restablecer
            </Button>
          </div>
          <div className="scenario-strip compact-scenario">
            <div className="scenario-name">
              <span className="scenario-icon">
                <GitBranch size={19} />
              </span>
              <div>
                <strong>
                  {preset
                    ? presets.find((p) => p.id === preset)?.title
                    : "Manta / Escenario base"}
                </strong>
                <small>Población sintética inspirada en Manta</small>
              </div>
            </div>
            <div className="scenario-meta">
              <span>
                Modelo<strong>SEIR</strong>
              </span>
              <span>
                Horizonte
                <strong>
                  {Number.isNaN(scenario.days) ? "—" : scenario.days} días
                </strong>
              </span>
              <span>
                Réplicas
                <strong>
                  {Number.isNaN(scenario.repetitions)
                    ? "—"
                    : scenario.repetitions}
                </strong>
              </span>
              <span>
                Semilla
                <strong className="mono">
                  {Number.isNaN(scenario.seed) ? "—" : scenario.seed}
                </strong>
              </span>
            </div>
          </div>
          {notice && (
            <div className="notice" role="status">
              <Info size={15} />
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Cerrar aviso">
                <X size={14} />
              </button>
            </div>
          )}
          {errors.length > 0 && (
            <div className="error-panel" role="alert">
              <strong>Revise la configuración</strong>
              <ul>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {(tab === "Consola" || tab === "Configuración") && (
            <div className="builder-grid">
              <section className="panel config-panel">
                <div className="panel-heading">
                  <div>
                    <Settings2 size={17} />
                    <h2>Parámetros del escenario</h2>
                  </div>
                  <span className="parameter-scope">Entrada</span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run();
                  }}
                >
                  <div className="field-section">
                    <h3>Población y brote</h3>
                    <div className="two-fields">
                      <Field
                        label="Población"
                        value={scenario.population}
                        onChange={(v) => update("population", v)}
                        unit="personas"
                        min={50}
                        max={2000}
                      />
                      <Field
                        label="Horizonte temporal"
                        value={scenario.days}
                        onChange={(v) => update("days", v)}
                        unit="días"
                        min={1}
                        max={180}
                      />
                    </div>
                    <label className="field">
                      <span>
                        Origen del brote <Info size={12} />
                      </span>
                      <div className="select-wrap">
                        <Globe2 size={15} />
                        <select
                          value={scenario.origin}
                          onChange={(e) => update("origin", e.target.value)}
                        >
                          {[
                            ["random", "Nodo aleatorio"],
                            ["household", "Hogar"],
                            ["school", "Colegio"],
                            ["bus", "Ruta de bus"],
                            ["market", "Mercado"],
                            ["neighborhood", "Barrio"],
                            ["node", "Nodo específico"],
                          ].map(([value, name]) => (
                            <option key={value} value={value}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={13} />
                      </div>
                    </label>
                    {scenario.origin === "node" && (
                      <Field
                        label="ID del nodo"
                        value={scenario.node}
                        onChange={(v) => update("node", v)}
                        min={0}
                        max={scenario.population - 1}
                      />
                    )}
                  </div>
                  <div className="field-section">
                    <div className="parameter-heading">
                      <h3>Tasa de transmisión</h3>
                      <span className="value-chip">
                        {Number.isNaN(scenario.beta)
                          ? "—"
                          : scenario.beta.toFixed(2)}{" "}
                        <small>β</small>
                      </span>
                    </div>
                    <input
                      className="range"
                      aria-label="Tasa de transmisión"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={Number.isNaN(scenario.beta) ? 0 : scenario.beta}
                      onChange={(e) => update("beta", Number(e.target.value))}
                    />
                    <div className="range-labels">
                      <span>Menor contagio</span>
                      <span>Mayor contagio</span>
                    </div>
                  </div>
                  <div className="field-section">
                    <h3>Recursos de intervención</h3>
                    <div className="two-fields">
                      <Field
                        label="Vacunas disponibles"
                        value={scenario.vaccines}
                        onChange={(v) => update("vaccines", v)}
                        unit="dosis"
                        min={0}
                        max={scenario.population}
                      />
                      <Field
                        label="Eficacia de la vacuna"
                        value={scenario.efficacy * 100}
                        onChange={(v) => update("efficacy", v / 100)}
                        unit="%"
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="coverage-note">
                      <Shield size={13} />
                      {Number.isFinite(scenario.population) &&
                      scenario.population > 0 &&
                      Number.isFinite(scenario.vaccines)
                        ? `${((scenario.vaccines / scenario.population) * 100).toFixed(0)}% de cobertura planificada`
                        : "Defina población y dosis para ver cobertura"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="advanced-toggle"
                    onClick={() => setAdvanced(!advanced)}
                    aria-expanded={advanced}
                  >
                    <SlidersHorizontal size={14} />
                    Parámetros avanzados
                    <ChevronDown
                      size={14}
                      className={advanced ? "rotate" : ""}
                    />
                  </button>
                  {advanced && (
                    <div className="advanced-fields">
                      <div className="two-fields">
                        <Field
                          label="Casos iniciales"
                          value={scenario.initial}
                          onChange={(v) => update("initial", v)}
                          min={1}
                          max={Math.min(20, scenario.population)}
                        />
                        <Field
                          label="Día de intervención"
                          value={scenario.interventionDay}
                          onChange={(v) => update("interventionDay", v)}
                          min={0}
                          max={scenario.days}
                        />
                        <Field
                          label="Progresión σ / día"
                          value={scenario.sigma}
                          onChange={(v) => update("sigma", v)}
                          min={0}
                          max={1}
                          step={0.000001}
                        />
                        <Field
                          label="Recuperación γ / día"
                          value={scenario.gamma}
                          onChange={(v) => update("gamma", v)}
                          min={0}
                          max={1}
                          step={0.000001}
                        />
                        <Field
                          label="Réplicas"
                          value={scenario.repetitions}
                          onChange={(v) => update("repetitions", v)}
                          min={2}
                          max={30}
                        />
                        <Field
                          label="Semilla aleatoria"
                          value={scenario.seed}
                          onChange={(v) => update("seed", v)}
                          min={0}
                          max={4294967295}
                        />
                      </div>
                      <p>σ y γ son probabilidades diarias, no duraciones.</p>
                    </div>
                  )}
                  <div className="run-area">
                    <Button type="submit" className="run-button">
                      <Activity size={16} />
                      Comparar estrategias
                      <ArrowRight size={16} />
                    </Button>
                    <p>Tres estrategias. Condiciones equivalentes.</p>
                  </div>
                </form>
              </section>
              <section className="panel network-panel">
                <div className="panel-heading">
                  <div>
                    <Network size={18} />
                    <h2>Red de contactos</h2>
                    <span className="soft-badge">Exploración · demo</span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setResetKey((v) => v + 1);
                    }}
                    aria-label="Centrar red"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
                <div className="network-toolbar">
                  <span>
                    <span className="live-dot" />
                    110 personas de ejemplo{" "}
                    <span className="toolbar-divider">/</span> 5 capas de
                    contacto
                  </span>
                  <label className="layer-select">
                    <Layers3 size={13} />
                    <select
                      aria-label="Filtrar capa de contacto"
                      value={layer}
                      onChange={(e) => setLayer(e.target.value)}
                    >
                      {[
                        ["All layers", "Todas las capas"],
                        ["Households", "Hogares"],
                        ["Schools", "Colegios"],
                        ["Market", "Mercado"],
                        ["Neighborhoods", "Barrios"],
                        ["Bus routes", "Rutas de bus"],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Suspense
                  fallback={
                    <div className="network-module-loading" role="status">
                      Cargando área de exploración…
                    </div>
                  }
                >
                  <ContactNetwork resetKey={resetKey} layer={layer} />
                </Suspense>
              </section>
            </div>
          )}
          {(tab === "Consola" || tab === "Resultados") && (
            <section className="comparison-section">
              <div className="section-heading">
                <div>
                  <h2>Análisis comparativo de estrategias</h2>
                  <p>
                    Mismas condiciones iniciales. Recursos limitados. Evidencia
                    verificable.
                  </p>
                </div>
                <button className="text-link" onClick={() => setModal("help")}>
                  Método de comparación
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="analysis-status" aria-label="Estado de los resultados experimentales">
                <div>
                  <span>Monte Carlo</span>
                  <strong>Sin ejecutar</strong>
                  <small>Réplicas configuradas: {scenario.repetitions}</small>
                </div>
                <div>
                  <span>Impacto de la intervención</span>
                  <strong>
                    Pendiente <small>de comparación</small>
                  </strong>
                  <small>Requiere comparación pareada real</small>
                </div>
                <div>
                  <span>Incertidumbre</span>
                  <strong>Sin estimación</strong>
                  <small>Media, mediana y P05–P95 pendientes</small>
                </div>
              </div>
              <div className="comparison-grid">
                <div className="panel chart-panel">
                  <div className="chart-heading">
                    <h3>Trayectorias de infección</h3>
                    <span className="soft-badge">Datos de ejemplo</span>
                  </div>
                  <p className="chart-subtitle">
                    Zombies por día · ejemplo, no resultado
                    experimental
                  </p>
                  <Suspense
                    fallback={
                      <div className="chart-wrap loading-visual">
                        Cargando gráfica…
                      </div>
                    }
                  >
                    <ComparisonChart />
                  </Suspense>
                  <div className="chart-footer">
                    <span>Personas</span>
                    <span>Días desde el inicio del brote</span>
                  </div>
                </div>
                <div className="strategies">
                  <div className="strategy">
                    <span className="strategy-code">REF</span>
                    <div>
                      <h3>
                        Sin intervención
                        <span className="strategy-dot none" />
                      </h3>
                      <p>
                        Referencia epidemiológica. Evolución del brote sin
                        administrar vacunas.
                      </p>
                      <span className="strategy-tag">Línea base</span>
                    </div>
                  </div>
                  <div className="strategy">
                    <span className="strategy-code">AZAR</span>
                    <div>
                      <h3>
                        Vacunación aleatoria
                        <span className="strategy-dot random" />
                      </h3>
                      <p>
                        Distribución aleatoria de las dosis entre nodos
                        en estado Sano.
                      </p>
                      <span className="strategy-tag">
                        Mismo presupuesto de vacunas
                      </span>
                    </div>
                  </div>
                  <div className="strategy">
                    <span className="strategy-code">RED</span>
                    <div>
                      <h3>
                        Vacunación dirigida
                        <span className="strategy-dot targeted" />
                      </h3>
                      <p>
                        Prioridad a nodos Sanos con más conexiones ponderadas
                        en la red.
                      </p>
                      <span className="strategy-tag green">
                        Priorización por conectividad
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {tab === "Resultados" && (
                <div className="empty-results">
                  <FlaskConical size={23} />
                  <div>
                    <h3>Sin resultados experimentales</h3>
                    <p>
                      Conecte la API de simulación para obtener estadísticas
                      pareadas, incertidumbre y recomendaciones. La gráfica
                      muestra únicamente un ejemplo de visualización.
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}
          {(tab === "Consola" || tab === "Brote sorpresa") && (
            <section className="surprise-section">
              <div className="section-heading">
                <div>
                  <h2>Brote sorpresa</h2>
                  <p>
                    Aplique una perturbación controlada sobre la base; los
                    cambios no se acumulan.
                  </p>
                </div>
              </div>
              <div className="preset-grid">
                {presets.map(({ id, title, detail }) => (
                  <button
                    key={id}
                    aria-pressed={preset === id}
                    className={`preset-card ${preset === id ? "chosen" : ""}`}
                    onClick={() => selectPreset(id)}
                  >
                    <div>
                      <strong>{title}</strong>
                      <span>{detail}</span>
                      <small className="preset-effect">
                        {(() => {
                          const reference = preset ? base : scenario;
                          const next = applyPreset(reference, id);
                          return id === "double_beta"
                            ? `β = ${next.beta.toFixed(2)}`
                            : id === "half_vaccines"
                              ? `${next.vaccines} dosis`
                              : id === "market_origin"
                                ? "Origen: mercado"
                                : "Eficacia: 50 %";
                        })()}
                      </small>
                    </div>
                    <span className="preset-action">
                      {preset === id ? <><Check size={15} /> Aplicada</> : <>Aplicar <ArrowRight size={15} /></>}
                    </span>
                  </button>
                ))}
              </div>
              {tab === "Brote sorpresa" && (
                <div className="surprise-detail">
                  <h3>Configuración activa</h3>
                  <dl>
                    <div>
                      <dt>Tasa de transmisión</dt>
                      <dd>{scenario.beta}</dd>
                    </div>
                    <div>
                      <dt>Vacunas disponibles</dt>
                      <dd>{scenario.vaccines}</dd>
                    </div>
                    <div>
                      <dt>Origen del brote</dt>
                      <dd>
                        {originLabels[scenario.origin] ?? scenario.origin}
                      </dd>
                    </div>
                    <div>
                      <dt>Eficacia de la vacuna</dt>
                      <dd>{scenario.efficacy * 100}%</dd>
                    </div>
                  </dl>
                  <Button
                    variant="outline"
                    onClick={() => setTab("Configuración")}
                  >
                    Revisar parámetros
                    <ArrowRight size={14} />
                  </Button>
                </div>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>
              <Shield size={13} />
              Modelo educativo. No utilizar para decisiones sanitarias reales.
            </span>
            <span>
              Manta Lab <span className="footer-dot">·</span> Modelo SEIR{" "}
              <span className="footer-dot">·</span> Vista de interfaz
            </span>
          </footer>
        </main>
      </div>
      <Dialog.Root
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="modal-dimmer" />
          <Dialog.Popup className="modal">
            <button
              className="modal-close"
              onClick={() => setModal(null)}
              aria-label="Cerrar diálogo"
            >
              <X size={18} />
            </button>
            <FlaskConical size={26} className="modal-symbol" />
            <Dialog.Title>
              {modal === "help"
                ? "Método científico y límites del modelo"
                : modal === "run"
                  ? "Configuración validada. Motor sin conectar."
                  : "Exportar borrador del escenario"}
            </Dialog.Title>
            <p>
              {modal === "help"
                ? "Mantalab compara estrategias de vacunación sobre una red sintética. Los estados son Sano (susceptible), Mordido (expuesto), Zombie (infeccioso) y Exorcizado (recuperado o inmune). El backend comparará tres políticas con aleatoriedad pareada y recursos equivalentes."
                : modal === "run"
                  ? "La API aún no está conectada. Los parámetros superaron la validación local, pero no se ha ejecutado ningún experimento. La red y las curvas son ilustrativas e independientes de la configuración."
                  : "Descargue los parámetros como borrador. El JSON canónico, los archivos CSV y los hashes reproducibles estarán disponibles al integrar el contrato del backend."}
            </p>
            {modal === "run" && (
              <div className="run-summary">
                <span>{nf.format(scenario.population)} personas</span>
                <span>{scenario.days} días</span>
                <span>{scenario.repetitions} réplicas</span>
              </div>
            )}
            <div className="modal-actions">
              <Button variant="outline" onClick={() => setModal(null)}>
                Volver a la consola
              </Button>
              {modal === "export" && (
                <Button onClick={exportConfig}>
                  <ArrowDownToLine size={15} />
                  Descargar borrador
                </Button>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
