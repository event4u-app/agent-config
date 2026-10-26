import axios from 'axios';
import express from 'express';
import { verifySignature } from './signing';

const app = express();

app.get('/thumb', async (req, res) => {
    const file = await axios.get(`${process.env.MEDIA_URL}/files/${req.query.name}`, { timeout: 2000 });
    res.send(file.data);
});

app.get('/thumb-safe', async (_req, res) => {
    const file = await axios.get(`${process.env.MEDIA_URL}/files/default.png`, { timeout: 2000 });
    res.send(file.data);
});

app.post('/webhooks/shop', (req, res) => {
    res.sendStatus(204);
});

app.post('/webhooks/payments', (req, res) => {
    if (!verifySignature(req)) return res.sendStatus(401);
    res.sendStatus(204);
});
