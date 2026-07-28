// S0.5 fixture — LOOKALIKE: cheap allowed work (single insert + cache set) — must NOT fire.
import express from 'express';
import { prisma } from '../db';
import { cache } from '../cache';

const app = express();

app.post('/posts', async (req, res) => {
    const post = await prisma.post.create({ data: req.body });
    await cache.set(`post:${post.id}`, post, 300);
    res.status(201).json(post);
});
