import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

export default function Dashboard({ done_km, remain_km, pace_now, pace_avg, hr_now, hrHist }) {
  return (
    <div style={{
      width: 300,
      background: "#ffffff",
      color: "#000",
      padding: 16,
      fontFamily: "sans-serif",
      borderLeft: "1px solid #ccc",
      overflowY: "auto",
    }}>
      <h3 style={{ marginTop: 0 }}>Live stats</h3>

      <p><strong>Done&nbsp;:</strong> {done_km.toFixed(2)} km</p>
      <p><strong>Remain&nbsp;:</strong> {remain_km.toFixed(2)} km</p>
      <p><strong>Pace&nbsp;now&nbsp;:</strong> {pace_now.toFixed(2)} min/km</p>
      <p><strong>Pace&nbsp;avg&nbsp;:</strong> {pace_avg.toFixed(2)} min/km</p>
      <p><strong>HR&nbsp;now&nbsp;:</strong> {hr_now} bpm</p>

      {hrHist.length > 2 && (
        <>
          <h4 style={{ margin: "12px 0 4px" }}>Heart-rate trend (bpm)</h4>

          <ResponsiveContainer width="100%" height={140}>
            <LineChart
              data={hrHist}                         
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              {}
              <XAxis dataKey="t" hide />

              {}
              <YAxis
                domain={[80, 200]}
                ticks={[100, 120, 140, 160, 180, 200]}
                width={30}
                tick={{ fontSize: 10 }}
              />

              {}
              {}

              <Tooltip
                formatter={(v) => `${v} bpm`}
                labelFormatter={(l) => `${l}s`}
              />

              <Line
                type="monotone"
                dataKey="hr"
                stroke="#d73027"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}