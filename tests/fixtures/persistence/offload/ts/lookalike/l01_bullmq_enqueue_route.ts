// S0.5 fixture — LOOKALIKE: route handler enqueueing via bullmq — the correct shape, must NOT fire.
import express from 'express';
import { queue } from '../queues/mail';

const app = express();

app.post('/register', async (req, res) => {
    const user = await createUser(req.body);
    await queue.add('welcome-mail', { userId: user.id });
    res.status(201).json(user);
});
