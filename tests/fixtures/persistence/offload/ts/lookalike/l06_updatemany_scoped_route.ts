// S0.5 fixture — LOOKALIKE: bounded updateMany scoped by where — must NOT fire.
import express from 'express';
import { prisma } from '../db';

const app = express();

app.post('/teams/:id/pause', async (req, res) => {
    await prisma.subscription.updateMany({ data: { status: 'paused' }, where: { teamId: req.params.id } });
    res.json({ ok: true });
});
