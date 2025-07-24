import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine  
} from "recharts";

export default function Dashboard({
  done_km,
  remain_km,
  pace_obj,
  pace_real,
  pace_avg,
  paceHist,  
  hr_now,
  hrHist,
  dist_next_km,
  timeSec,
  time_next_change_sec,
  time_next_change_obj_sec,
  pace_gap,
  eta_gap_sec,
  pace_cv,
  hr_avg,
}) {
  return (
    <div style={{ width: 300, background: "#fff", color: "#000", padding: 16, fontFamily: "sans-serif", borderLeft: "1px solid #ccc", overflowY: "auto" }}>
      <h3 style={{ marginTop: 0 }}>Live stats</h3>

      <p><strong>Done&nbsp;:</strong> {done_km.toFixed(2)} km</p>
      <p><strong>Remain&nbsp;:</strong> {remain_km.toFixed(2)} km</p>
      <p><strong>Pace&nbsp;objective&nbsp;:</strong> {pace_obj.toFixed(2)} min/km</p>
      <p><strong>Pace&nbsp;real&nbsp;:</strong> {pace_real.toFixed(2)} min/km</p>
      <p><strong>Pace&nbsp;gap&nbsp;:</strong> {pace_gap >= 0 ? "+" : ""}{pace_gap.toFixed(2)} min/km</p>
      <p><strong>Time&nbsp;to&nbsp;next&nbsp;pace&nbsp;change&nbsp;:</strong>{Math.floor(time_next_change_sec / 60)}:{String(time_next_change_sec % 60).padStart(2, "0")}</p>
      <p><strong>Time&nbsp;to&nbsp;next&nbsp;pace&nbsp;change&nbsp;(target)&nbsp;:</strong>{Math.floor(time_next_change_obj_sec / 60)}:{String(time_next_change_obj_sec % 60).padStart(2, "0")}</p>
      <p><strong>ETA&nbsp;gap&nbsp;:</strong>{eta_gap_sec >= 0 ? "+" : "−"}{`${Math.floor(Math.abs(eta_gap_sec) / 60)} min ${String(Math.abs(eta_gap_sec) % 60).padStart(2, "0")} s`}</p> 
      <p><strong>CV&nbsp;pace&nbsp;:</strong> {(pace_cv * 100).toFixed(1)} %</p>
      <p><strong>Pace&nbsp;avg&nbsp;:</strong> {pace_avg.toFixed(2)} min/km</p>
      <p><strong>HR&nbsp;now&nbsp;:</strong> {hr_now} bpm</p>
      <p><strong>HR&nbsp;avg&nbsp;:</strong> {hr_avg} bpm</p>
      <p><strong>Next&nbsp;pace&nbsp;change&nbsp;in&nbsp;:</strong> {dist_next_km.toFixed(2)} km</p>
      <p><strong>Time&nbsp;elapsed&nbsp;:</strong> {
        new Date(timeSec * 1000).toISOString().substr(11, 8) 
      }</p>

      {}
      {paceHist.length > 2 && (
        <>
          <h4 style={{ margin: "14px 0 4px" }}>Real-pace trend (min/km)</h4>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={paceHist} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="t" hide />
              <YAxis
                domain={["dataMin - 0.2", "dataMax + 0.2"]}
                width={40}                     
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => Number(v).toPrecision(3)} 
              />
              <Tooltip formatter={(v) => `${v.toFixed(2)} min/km`} labelFormatter={(l) => `${l}s`} />
              <Line type="monotone" dataKey="pace" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceLine
              y={pace_obj}              
              stroke="#28a745"         
              strokeDasharray="6 3"
              strokeWidth={3}
              isFront={true}           
            />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {}
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