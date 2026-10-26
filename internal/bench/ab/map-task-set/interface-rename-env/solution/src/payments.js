const BASE = process.env.PAYMENTS_BASE_URL;

export async function charge(amount) {
    return fetch(`${BASE}/charges`, { method: 'POST', body: JSON.stringify({ amount }) });
}
