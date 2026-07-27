// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L12  Post.authorId  (where)   -> resolved + indexed (@@index)  => OK
//   L13  Post.createdAt (orderBy) -> resolved + NOT indexed        => VIOLATION (F2)
//   L19  Post.status    (where, operator object) -> resolved + indexed => OK

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function posts_by_author(authorId: number) {
    return prisma.post.findMany({
        where: { authorId },
        orderBy: { createdAt: 'desc' },
    });
}

export function posts_in_status(statuses: string[]) {
    return prisma.post.findMany({ where: { status: { in: statuses } } });
}
