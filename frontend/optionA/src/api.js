export async function fetchCoach(stats) {
    const res = await fetch("http://localhost:8000/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stats),
    });
    if (!res.ok) throw new Error("API error");
    return res.json();     
  }