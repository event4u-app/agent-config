export interface Order {
    id: number;
    status: string;
}

export async function listOrders(): Promise<Order[]> {
    const res = await fetch('/orders');
    return (await res.json()) as Order[];
}

export async function stockOf(sku: string): Promise<number> {
    const res = await fetch(`/api/stock/${sku}`);
    return ((await res.json()) as { level: number }).level;
}
