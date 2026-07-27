// S0.5 fixture — TRUE F9: awaited third-party HTTP call inside a route handler.
import express from 'express';
import axios from 'axios';

const app = express();

app.post('/orders/:id/sync', async (req, res) => {
    const order = await loadOrder(req.params.id);
    await axios.post('https://erp.partner.example/api/orders', order);
    res.status(204).end();
});
