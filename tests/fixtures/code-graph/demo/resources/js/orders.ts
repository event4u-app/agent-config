import { listOrders, stockOf } from './api';

export async function openOrderCount(): Promise<number> {
    return (await listOrders()).filter((o) => o.status === 'open').length;
}

export async function lowStock(skus: string[]): Promise<string[]> {
    const levels = await Promise.all(skus.map((s) => stockOf(s)));
    return skus.filter((_, i) => (levels[i] ?? 0) < 5);
}
