const BASE = process.env.PAYMENT_API_URL;

export async function charge(amount) {
    return fetch(`${BASE}/charges`, { method: 'POST', body: JSON.stringify({ amount }) });
}
