export async function fetchCoach(body) {
  const res = await fetch("http://localhost:8000/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
export async function sendTick(body) {
  await fetch("http://localhost:8000/tick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}