export async function loadStats() {
    const r = await fetch('/api/v1/legacy-stats');
    const body = await r.json();
    return body.hits;
}
