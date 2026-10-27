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
import { seirColors } from "./seir-colors";

const series = {
  s: { label: "Sano", color: seirColors.S.stroke },
  e: { label: "Mordido", color: seirColors.E.stroke },
  i: { label: "Zombie", color: seirColors.I.stroke },
  r: { label: "Exorcizado", color: seirColors.R.stroke },
};
type StateKey = keyof typeof series;
const selectedKeys = Object.keys(series) as StateKey[];
export default function TemporalChart({
  day,
  daily,
}: {
  day: number;
  daily: DemoDaily[];
}) {
  const visible = daily.slice(0, day + 1);
  return (
    <section
      className="temporal-chart-panel"
      aria-label="Curva sincronizada de la demostración"
    >
      <div className="temporal-chart-heading">
        <div>
          <h3>Evolución</h3>
          <p>Demo · día {day}</p>
        </div>
      </div>
        <div className="temporal-series-legend" aria-label="Estados en el día actual">
          {selectedKeys.map((key) => (
            <span key={key}>
              <svg width="22" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="22" y2="5" stroke={series[key].color} strokeWidth="2.5" />
              </svg>
              <span>{series[key].label}</span> <strong>{daily[day][key]}</strong>
            </span>
          ))}
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
              tick={{ fontSize: 13, fill: "#53624d" }}
            />
            <YAxis
              domain={[0, Math.max(1, ...daily.flatMap((row) => selectedKeys.map((key) => row[key])))]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 13, fill: "#53624d" }}
            />
            <Tooltip
              isAnimationActive={false}
              labelFormatter={(value) => `Día ${value} · demostración`}
              contentStyle={{ fontSize: 15, borderRadius: 4 }}
            />
            <ReferenceLine x={day} stroke="#6a8260" strokeDasharray="3 3" />
            {selectedKeys.map((key) => <Line
              key={key}
              type="linear"
              name={series[key].label}
              dataKey={key}
              stroke={series[key].color}
              strokeWidth={2.5}
              strokeLinecap="round"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="temporal-chart-caption">
        <span>Personas</span>
        <span>Día</span>
      </div>
      <details className="temporal-data-table">
        <summary>Ver datos diarios</summary>
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
