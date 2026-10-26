import { lowStock } from './orders';

export async function checkLowStock(): Promise<boolean> {
    return (await lowStock([])).length === 0;
}
