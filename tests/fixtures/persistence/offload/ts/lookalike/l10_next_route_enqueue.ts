// S0.5 fixture — LOOKALIKE: Next.js route handler that only enqueues and returns 202 — must NOT fire.
import { reportQueue } from '../../queues/report';

export async function POST(request: Request) {
    const { year } = await request.json();
    await reportQueue.add('annual-report', { year });
    return Response.json({ queued: true }, { status: 202 });
}
