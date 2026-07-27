// S0.5 fixture — LOOKALIKE: waivered synchronous payment call — reported waived, must NOT count.
import express from 'express';
import { stripe } from '../clients';

const app = express();

app.post('/checkout', async (req, res) => {
    // sync-required: immediate card authorization result needed for the checkout UI, 300ms P99
    const intent = await stripe.paymentIntents.create({ amount: req.body.amount, currency: 'eur' });
    res.json({ clientSecret: intent.client_secret });
});
