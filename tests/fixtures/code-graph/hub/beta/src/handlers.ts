export function orderById(): string {
    return 'order';
}

export function orderLines(): string[] {
    return [];
}

export async function stock(): Promise<unknown> {
    const res = await fetch('https://api.partner.example/v2/stock', { signal: AbortSignal.timeout(3000) });
    return res.json();
}
