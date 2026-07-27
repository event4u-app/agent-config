// S0.5 fixture — LOOKALIKE: outbound HTTP inside a queued job processor file — must NOT fire.
export async function processErpSync(payload: { orderId: string }): Promise<void> {
    const order = await loadOrder(payload.orderId);
    await fetch('https://erp.partner.example/api/orders', {
        method: 'POST',
        body: JSON.stringify(order),
    });
}
