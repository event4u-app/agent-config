import { openOrderCount } from './orders';
import { host } from './runtime';

export async function boot(): Promise<string> {
    return `${host ?? 'local'}: ${await openOrderCount()} open orders`;
}
