#!/bin/bash
mkdir -p src/routes src/services tests
cat > package.json <<'J'
{ "name": "orders-api", "version": "1.4.0", "type": "module", "scripts": { "start": "node src/server.js", "test": "node --test" }, "dependencies": { "express": "^4.19.0", "pg": "^8.11.0" } }
J
echo "import express from 'express'; import { orders } from './routes/orders.js'; const app = express(); app.use('/orders', orders); app.listen(3000);" > src/server.js
echo "import { Router } from 'express'; import { listOrders } from '../services/orders.js'; export const orders = Router(); orders.get('/', async (_q, r) => r.json(await listOrders()));" > src/routes/orders.js
echo "import pg from 'pg'; const pool = new pg.Pool(); export const listOrders = async () => (await pool.query('select id, total from orders')).rows;" > src/services/orders.js
echo "import test from 'node:test'; test('placeholder', () => {});" > tests/orders.test.js
git init -q && git add -A && git -c user.email=a@example.com -c user.name=a commit -qm init
