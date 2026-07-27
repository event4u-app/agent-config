// S0.5 fixture — TRUE F9: unbounded prisma updateMany (no where) in a route handler.
import express from 'express';
import { prisma } from '../db';

const app = express();

app.post('/grace-period/extend-all', async (_req, res) => {
    await prisma.subscription.updateMany({ data: { gracePeriodEndsAt: new Date() } });
    res.json({ ok: true });
});
