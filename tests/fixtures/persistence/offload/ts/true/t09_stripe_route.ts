// S0.5 fixture — TRUE F9: payment SDK call inside a Next.js route handler.
import { stripe } from '../../clients';

export async function POST(request: Request) {
    const { amount } = await request.json();
    const intent = await stripe.paymentIntents.create({ amount, currency: 'eur' });
    return Response.json({ clientSecret: intent.client_secret });
}
