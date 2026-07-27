// S0.5 fixture — TRUE F11: un-awaited outbound webhook fan-out in a route handler —
// must-not-lose delivery dropped on process death.
import express from 'express';
import axios from 'axios';

const app = express();

app.post('/payments/:id/capture', async (req, res) => {
    const payment = await capture(req.params.id);
    axios.post('https://hooks.customer.example/payment-captured', { id: payment.id });
    res.json(payment);
});
