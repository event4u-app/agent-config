import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: { payeeId: string } }) {
  return NextResponse.json({ payeeId: params.payeeId, verified: false });
}
