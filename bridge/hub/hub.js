const conn = document.getElementById('conn');
const lanHint = document.getElementById('lan-hint');

lanHint.textContent = `You are on ${location.host}. On a phone, open http://${location.host}/phone/ while on the same Wi‑Fi.`;

async function refresh() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    const clients = data.clients || {};
    const ext = clients.extension || 0;
    if (ext > 0) {
      conn.textContent = 'Extension connected — ready for inputs';
      conn.className = 'conn gnaa-chip gnaa-chip--ok';
    } else {
      conn.textContent = 'Bridge online — waiting for the Chrome extension';
      conn.className = 'conn gnaa-chip gnaa-chip--warn';
    }
  } catch {
    conn.textContent = 'Could not reach this bridge';
    conn.className = 'conn gnaa-chip gnaa-chip--danger';
  }
}

refresh();
setInterval(refresh, 3000);
