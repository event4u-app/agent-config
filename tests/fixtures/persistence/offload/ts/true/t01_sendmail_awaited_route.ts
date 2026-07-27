// S0.5 fixture — TRUE F9: awaited nodemailer sendMail inside an express route handler.
import express from 'express';
import { transporter } from '../mailer';

const app = express();

app.post('/register', async (req, res) => {
    const user = await createUser(req.body);
    await transporter.sendMail({ to: user.email, subject: 'Welcome', text: 'Hi' });
    res.status(201).json(user);
});
