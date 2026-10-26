import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const previewCurve = [
  { day: 0, none: 1, random: 1, targeted: 1 },
  { day: 10, none: 18, random: 12, targeted: 8 },
  { day: 20, none: 106, random: 64, targeted: 33 },
  { day: 30, none: 268, random: 175, targeted: 82 },
  { day: 40, none: 348, random: 238, targeted: 111 },
  { day: 50, none: 267, random: 187, targeted: 93 },
  { day: 60, none: 151, random: 105, targeted: 54 },
  { day: 70, none: 65, random: 44, targeted: 22 },
  { day: 80, none: 22, random: 14, targeted: 7 },
  { day: 90, none: 5, random: 3, targeted: 1 },
];
export default function ComparisonChart() {
  return (
    <>
      <div className="plot-legend" aria-label="Leyenda de estrategias">
        <span>
          <i className="line-sample baseline" />
          Sin intervención
        </span>
        <span>
          <i className="line-sample random" />
          Aleatoria
        </span>
        <span>
          <i className="line-sample targeted" />
          Dirigida
        </span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={previewCurve}
            margin={{ top: 12, right: 18, bottom: 6, left: -8 }}
          >
            <CartesianGrid vertical={false} stroke="#edf0ee" />
            <XAxis
              dataKey="day"
              type="number"
              domain={[0, 90]}
              ticks={[0, 15, 30, 45, 60, 75, 90]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "#59665f" }}
            />
            <YAxis
              domain={[0, 400]}
              ticks={[0, 100, 200, 300, 400]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "#59665f" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 3,
                fontSize: 12,
                border: "1px solid #e2e8e4",
              }}
              labelFormatter={(v) => `Día ${v} · ejemplo`}
            />
            <Area
              type="linear"
              dataKey="none"
              name="Sin intervención"
              stroke="#a4664e"
              strokeDasharray="7 4"
              fill="#a4664e"
              fillOpacity={0.025}
              strokeWidth={2.2}
            />
            <Area
              type="linear"
              dataKey="random"
              name="Vacunación aleatoria"
              stroke="#587f98"
              strokeDasharray="3 3"
              fill="#587f98"
              fillOpacity={0.025}
              strokeWidth={2.2}
            />
            <Area
              type="linear"
              dataKey="targeted"
              name="Vacunación dirigida"
              stroke="#173E32"
              fill="#173E32"
              fillOpacity={0.06}
              strokeWidth={2.8}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-table">
        <summary>Consultar tabla de datos de ejemplo</summary>
        <div>
          <table>
            <caption>
              Zombies de ejemplo; valores independientes del
              escenario
            </caption>
            <thead>
              <tr>
                <th>Día</th>
                <th>Sin intervención</th>
                <th>Aleatoria</th>
                <th>Dirigida</th>
              </tr>
            </thead>
            <tbody>
              {previewCurve.map((row) => (
                <tr key={row.day}>
                  <th scope="row">{row.day}</th>
                  <td>{row.none}</td>
                  <td>{row.random}</td>
                  <td>{row.targeted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
