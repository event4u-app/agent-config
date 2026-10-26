export async function order(id: string): Promise<unknown> {
    const res = await fetch(`${process.env.BETA_URL}/api/v1/orders/${id}`, { signal: AbortSignal.timeout(3000) });
    return res.json();
}

export async function audit(): Promise<unknown> {
    const res = await fetch(`${process.env.BETA_URL}/audit-log`, { method: 'POST', signal: AbortSignal.timeout(3000) });
    return res.json();
}

export async function stock(): Promise<unknown> {
    const res = await fetch('https://api.partner.example/v2/stock', { signal: AbortSignal.timeout(3000) });
    return res.json();
}
