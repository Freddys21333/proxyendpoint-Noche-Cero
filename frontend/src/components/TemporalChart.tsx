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
  s: { label: "Sano", color: "#487e66" },
  e: { label: "Mordido", color: "#9c711a" },
  i: { label: "Zombie", color: "#b55340" },
  r: { label: "Exorcizado", color: "#3974a3" },
};
export default function TemporalChart({
  day,
  daily,
}: {
  day: number;
  daily: DemoDaily[];
}) {
  const [metric, setMetric] = useState<keyof typeof series>("i");
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
            Guion manual · estado {series[metric].label} hasta el día{" "}
            {day}
          </p>
        </div>
        <label>
          Estado en curva
          <select
            aria-label="Estado en curva"
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as keyof typeof series)
            }
          >
            {Object.entries(series).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <strong style={{ color: series[metric].color }}>
          {daily[day][metric]} <small>personas</small>
        </strong>
      </div>
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
              domain={[0, Math.max(1, ...daily.map((row) => row[metric]))]}
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
            <Line
              type="linear"
              name={series[metric].label}
              dataKey={metric}
              stroke={series[metric].color}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
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
