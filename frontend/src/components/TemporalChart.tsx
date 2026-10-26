import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DemoDaily } from "@/lib/temporal-demo";

const series = {
  s: { label: "Sano", color: "#487e66", dash: "0" },
  e: { label: "Mordido", color: "#9c711a", dash: "6 3" },
  i: { label: "Zombie", color: "#b55340", dash: "2 3" },
  r: { label: "Exorcizado", color: "#3974a3", dash: "8 3 2 3" },
};
type StateKey = keyof typeof series;
export default function TemporalChart({
  day,
  daily,
}: {
  day: number;
  daily: DemoDaily[];
}) {
  const [metric, setMetric] = useState<StateKey | "all">("i");
  const selectedKeys: StateKey[] = metric === "all"
    ? ["s", "e", "i", "r"]
    : [metric];
  const visible = daily.slice(0, day + 1);
  return (
    <section
      className="temporal-chart-panel"
      aria-label="Curva sincronizada de la demostración"
    >
      <div className="temporal-chart-heading">
        <div>
          <h3>Evolución de esta demo</h3>
          <p>
            Guion manual · {metric === "all" ? "todos los estados" : `estado ${series[metric].label}`} hasta el día{" "}
            {day}
          </p>
        </div>
        <label>
          Estado en curva
          <select
            aria-label="Estado en curva"
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as StateKey | "all")
            }
          >
            <option value="all">Todos los estados</option>
            {Object.entries(series).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <strong style={{ color: metric === "all" ? "#202c28" : series[metric].color }}>
          {metric === "all"
            ? selectedKeys.reduce((total, key) => total + daily[day][key], 0)
            : daily[day][metric]} <small>personas{metric === "all" ? " en total" : ""}</small>
        </strong>
      </div>
      {metric === "all" && (
        <div className="temporal-series-legend" aria-label="Estados en el día actual">
          {selectedKeys.map((key) => (
            <span key={key}>
              <svg width="22" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="22" y2="5" stroke={series[key].color} strokeWidth="2" strokeDasharray={series[key].dash} />
              </svg>
              {series[key].label} <strong>{daily[day][key]}</strong>
            </span>
          ))}
        </div>
      )}
      <div className="temporal-chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={visible}
            margin={{ top: 10, right: 16, left: -15, bottom: 4 }}
          >
            <CartesianGrid vertical={false} stroke="#e2e9dc" />
            <XAxis
              type="number"
              dataKey="day"
              domain={[0, 20]}
              ticks={[0, 5, 10, 15, 20]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#53624d" }}
            />
            <YAxis
              domain={[0, Math.max(1, ...daily.flatMap((row) => selectedKeys.map((key) => row[key])))]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#53624d" }}
            />
            <Tooltip
              isAnimationActive={false}
              labelFormatter={(value) => `Día ${value} · demostración`}
              contentStyle={{ fontSize: 12, borderRadius: 3 }}
            />
            <ReferenceLine x={day} stroke="#6a8260" strokeDasharray="3 3" />
            {selectedKeys.map((key) => <Line
              key={key}
              type="linear"
              name={series[key].label}
              dataKey={key}
              stroke={series[key].color}
              strokeDasharray={metric === "all" ? series[key].dash : undefined}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="temporal-chart-caption">
        <span>Personas</span>
        <span>Día de la demostración</span>
      </div>
      <details className="temporal-data-table">
        <summary>Consultar estados diarios de la demo</summary>
        <div>
          <table>
            <caption>Datos del guion, hasta el día {day}</caption>
            <thead>
              <tr>
                <th>Día</th>
                <th>S</th>
                <th>E</th>
                <th>I</th>
                <th>R</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.day}>
                  <th scope="row">{row.day}</th>
                  <td>{row.s}</td>
                  <td>{row.e}</td>
                  <td>{row.i}</td>
                  <td>{row.r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
