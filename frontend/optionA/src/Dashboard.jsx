export default function Dashboard({ done_km, remain_km, pace_now, pace_avg }) {
    return (
      <div
        style={{
          width: 300,
          background: "#ffffff",
          color: "#000",
          padding: 16,
          fontFamily: "sans-serif",
          borderLeft: "1px solid #ccc",
          overflowY: "auto",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Live stats</h3>
  
        <p>
          <strong>Done&nbsp;:</strong> {done_km.toFixed(2)} km
        </p>
        <p>
          <strong>Remain&nbsp;:</strong> {remain_km.toFixed(2)} km
        </p>
        <p>
          <strong>Pace&nbsp;now&nbsp;:</strong> {pace_now.toFixed(2)} min/km
        </p>
        <p>
          <strong>Pace&nbsp;avg&nbsp;:</strong> {pace_avg.toFixed(2)} min/km
        </p>
      </div>
    );
  }