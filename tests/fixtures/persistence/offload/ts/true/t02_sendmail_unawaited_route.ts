// S0.5 fixture — TRUE F11: un-awaited sendMail in a route handler — fire-and-forget
// must-not-lose work, silently dropped on process kill.
import express from 'express';
import { transporter } from '../mailer';

const app = express();

app.post('/invoices/:id/send', async (req, res) => {
    const invoice = await markSent(req.params.id);
    transporter.sendMail({ to: invoice.email, subject: 'Invoice', text: invoice.number });
    res.json({ ok: true });
});
