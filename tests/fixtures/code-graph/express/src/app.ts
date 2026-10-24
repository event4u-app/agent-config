import express from 'express';
import { createUser, listUsers } from './handlers';

const app = express();
const router = express.Router();
const cache = new Map<string, unknown>();

app.get('/users', listUsers);
router.post('/users', authenticate, createUser);
app.get('/health', (_req, res) => res.send('ok'));
cache.get('/users');

function authenticate(): void {}

export default app;
