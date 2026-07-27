// S0.5 fixture — TRUE F11: setTimeout background emailing inside a route handler —
// in-process fire-and-forget, lost on redeploy.
import express from 'express';
import { transporter } from '../mailer';

const app = express();

app.post('/reminders', async (req, res) => {
    setTimeout(() => {
        transporter.sendMail({ to: req.body.email, subject: 'Reminder', text: 'Due soon' });
    }, 5000);
    res.status(202).json({ scheduled: true });
});
