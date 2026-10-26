export async function listInvoices(): Promise<unknown> {
    const res = await fetch(process.env.BILLING_URL + '/invoices', { method: 'GET' });
    return res.json();
}

export async function invoice(id: string): Promise<unknown> {
    const res = await fetch(`${process.env.BILLING_URL}/invoices/${id}`, { signal: AbortSignal.timeout(3000) });
    return res.json();
}
