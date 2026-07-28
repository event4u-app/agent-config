// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L13  where: <variable>  -> dynamic filter object  => UNRESOLVED (never a Finding)
//   L17  $queryRaw          -> raw SQL                => UNRESOLVED (never a Finding)

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export function filter_users(where: Prisma.UserWhereInput) {
    return prisma.user.findMany({ where });
}

export function search_posts(title: string) {
    return prisma.$queryRaw`SELECT * FROM "Post" WHERE lower(title) = ${title}`;
}
