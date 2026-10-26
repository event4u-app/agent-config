import { formatPrice } from './money';

export function cartLine(name: string, amount: number, currency: string): string {
    return `${name}: ${formatPrice(amount)}`;
}
