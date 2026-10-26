import { formatPrice } from './money';

export function receipt(total: number, currency: string): string {
    return 'Total ' + formatPrice(total, currency);
}
