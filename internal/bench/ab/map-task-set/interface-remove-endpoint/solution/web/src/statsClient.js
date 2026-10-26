export async function loadStats() {
    const r = await fetch('/api/v2/stats');
    const body = await r.json();
    return body.visits;
}
