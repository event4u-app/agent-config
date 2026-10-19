import { NextResponse } from 'next/server';
import { z } from 'zod';

const PayoutInput = z.object({ payeeId: z.string(), amountCents: z.number().int().positive() });

export async function GET() {
  return NextResponse.json({ payouts: [] });
}

export async function POST(request: Request) {
  const input = PayoutInput.parse(await request.json());
  return NextResponse.json({ id: crypto.randomUUID(), ...input }, { status: 201 });
}
