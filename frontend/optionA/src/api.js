export async function fetchStatus(index) {
    const res = await fetch("http://localhost:8000/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    if (!res.ok) throw new Error("API error");
    return res.json(); // { km, message, ... }
  }
  