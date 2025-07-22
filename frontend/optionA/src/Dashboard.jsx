import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

/* tableau + graphes HR & Pace */
export default function Dashboard({
  done_km,
  remain_km,
  pace_obj,
  pace_real,
  pace_avg,
  paceHist,   // ← historique du pace réel
  hr_now,
  hrHist,
}) {
  return (
    <div style={{ width: 300, background: "#fff", color: "#000", padding: 16, fontFamily: "sans-serif", borderLeft: "1px solid #ccc", overflowY: "auto" }}>
      <h3 style={{ marginTop: 0 }}>Live stats</h3>

      <p><strong>Done&nbsp;:</strong> {done_km.toFixed(2)} km</p>
      <p><strong>Remain&nbsp;:</strong> {remain_km.toFixed(2)} km</p>
      <p><strong>Pace&nbsp;objective&nbsp;:</strong> {pace_obj.toFixed(2)} min/km</p>
      <p><strong>Pace&nbsp;real&nbsp;:</strong> {pace_real.toFixed(2)} min/km</p>
      <p><strong>Pace&nbsp;avg&nbsp;:</strong> {pace_avg.toFixed(2)} min/km</p>
      <p><strong>HR&nbsp;now&nbsp;:</strong> {hr_now} bpm</p>

      {/* ---- courbe Pace réel ---- */}
      {paceHist.length > 2 && (
        <>
          <h4 style={{ margin: "14px 0 4px" }}>Real-pace trend (min/km)</h4>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={paceHist} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="t" hide />
              <YAxis domain={["dataMin - 0.2", "dataMax + 0.2"]} width={30} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v.toFixed(2)} min/km`} labelFormatter={(l) => `${l}s`} />
              <Line type="monotone" dataKey="pace" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {/* ---- courbe HR ---- */}
      {hrHist.length > 2 && (
        <>
          <h4 style={{ margin: "14px 0 4px" }}>Heart-rate trend (bpm)</h4>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={hrHist} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="t" hide />
              <YAxis domain={[80, 200]} ticks={[100, 120, 140, 160, 180, 200]} width={30} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v} bpm`} labelFormatter={(l) => `${l}s`} />
              <Line type="monotone" dataKey="hr" stroke="#d73027" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}