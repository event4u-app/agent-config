import * as money from '../money';

export function row(order: { total: number; currency: string }): string[] {
    return [money.formatPrice(order.total, order.currency)];
}
