// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L11  User.email -> resolved + indexed (@unique)  => OK
//   L15  User.name  -> resolved + NOT indexed        => VIOLATION (F2)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function find_user_by_email(email: string) {
    return prisma.user.findUnique({ where: { email } });
}

export function find_users_by_name(name: string) {
    return prisma.user.findMany({ where: { name } });
}
