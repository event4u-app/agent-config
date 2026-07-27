// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L13  Order.channel   -> resolved + NOT indexed, but WAIVED via the
//        `no-index` comment directly above                => WAIVED (no gate)
//   L17  Order.reference -> resolved + indexed (@unique)  => OK
//   L21  Order.total     -> resolved + NOT indexed        => VIOLATION (F2)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function web_orders() {
    // no-index: read-heavy analytics column
    return prisma.order.findMany({ where: { channel: 'web' } });
}

export function find_order(reference: string) {
    return prisma.order.findFirst({ where: { reference } });
}

export function big_orders() {
    return prisma.order.findMany({ where: { total: { gt: 100 } } });
}
