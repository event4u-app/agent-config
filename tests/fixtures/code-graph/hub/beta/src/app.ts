import express from 'express';
import { orderById, orderLines } from './handlers';

const app = express();

app.get('/orders/:id', orderById);
app.get('/orders/:id/lines', orderLines);

export default app;
