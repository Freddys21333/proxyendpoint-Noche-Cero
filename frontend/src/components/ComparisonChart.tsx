import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CompareResponse, CurveMetric } from "@/lib/api";
import { comparisonRows, metricLabels, policyLabels } from "@/lib/comparison";

const policies = ["none", "random", "targeted"] as const;
const colors = { none: "#ff9b68", random: "#87c7e5", targeted: "#bde76b" };
export default function ComparisonChart({ result, metric }: { result: CompareResponse; metric: CurveMetric }) {
  const rows = comparisonRows(result, metric);
  return <>
    <p className="chart-axis-guide">Eje horizontal: días desde el inicio. Eje vertical: personas.</p>
    <div className="plot-legend" aria-label="Leyenda de estrategias">{policies.map(policy => <span key={policy}><i className={`line-sample ${policy === "none" ? "baseline" : policy}`} />{policyLabels[policy]}</span>)}</div>
    <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{ top: 12, right: 18, bottom: 6, left: -8 }}>
      <CartesianGrid vertical={false} stroke="#4a414e" />
      <XAxis dataKey="day" type="number" domain={[0, result.configuration.scenario.days]} tickLine={false} axisLine={false} />
      <YAxis domain={[0, 'auto']} allowDecimals={false} tickLine={false} axisLine={false} />
      <Tooltip labelFormatter={value => `Día ${value}`} formatter={value => {
        const format = (item: unknown) => typeof item === "number" ? item.toLocaleString("es-EC", { maximumFractionDigits: 3 }) : String(item ?? "");
        return Array.isArray(value) ? value.map(format).join(" – ") : format(value);
      }} />
      {policies.map(policy => <Area key={`${policy}-range`} type="linear" dataKey={`${policy}Range`} name={`${policyLabels[policy]} P05–P95`} fill={colors[policy]} fillOpacity={0.08} stroke="none" isAnimationActive={false} />)}
      {policies.map(policy => <Line key={policy} type="linear" dataKey={policy} name={`${policyLabels[policy]} media`} stroke={colors[policy]} strokeWidth={2.5} strokeDasharray={policy === "none" ? "7 4" : policy === "random" ? "3 3" : undefined} dot={false} isAnimationActive={false} />)}
    </ComposedChart></ResponsiveContainer></div>
    <details className="chart-table"><summary>Consultar datos de la curva</summary><div><table><caption>{metricLabels[metric]}: medias calculadas por el backend</caption><thead><tr><th>Día</th>{policies.map(policy => <th key={policy}>{policyLabels[policy]}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.day}><th scope="row">{row.day}</th>{policies.map(policy => <td key={policy}>{row[policy].toLocaleString('es-EC', { maximumFractionDigits: 3 })}</td>)}</tr>)}</tbody></table></div></details>
  </>;
}
