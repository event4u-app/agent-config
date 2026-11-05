#!/bin/bash
set -euo pipefail
mkdir -p apps/api/src/routes apps/api/src/middleware apps/worker/src/jobs packages/db/migrations packages/db/src packages/shared/src config infra
cat > package.json <<'J'
{ "name": "fleet-platform", "private": true, "workspaces": ["apps/*", "packages/*"], "scripts": { "dev": "turbo run dev", "test": "turbo run test" }, "devDependencies": { "turbo": "^2.0.0", "typescript": "^5.4.0" } }
J
echo '{ "pipeline": { "dev": { "cache": false }, "test": {} } }' > turbo.json
echo '{ "compilerOptions": { "strict": true, "module": "nodenext", "target": "es2022" } }' > tsconfig.base.json
cat > apps/api/package.json <<'J'
{ "name": "@fleet/api", "dependencies": { "express": "^4.19.0", "@fleet/db": "*", "@fleet/shared": "*", "bullmq": "^5.4.0" } }
J
echo "import express from 'express'; import { vehicles } from './routes/vehicles'; import { trips } from './routes/trips'; import { auth } from './middleware/auth'; const app = express(); app.use(auth); app.use('/vehicles', vehicles); app.use('/trips', trips); app.listen(Number(process.env.PORT ?? 3000));" > apps/api/src/server.ts
echo "import { Router } from 'express'; import { listVehicles, getVehicle } from '@fleet/db'; export const vehicles = Router(); vehicles.get('/', async (_q, r) => r.json(await listVehicles())); vehicles.get('/:id', async (q, r) => r.json(await getVehicle(q.params.id)));" > apps/api/src/routes/vehicles.ts
echo "import { Router } from 'express'; import { Queue } from 'bullmq'; import { createTrip } from '@fleet/db'; const q = new Queue('trip-events'); export const trips = Router(); trips.post('/', async (req, res) => { const t = await createTrip(req.body); await q.add('trip.created', { id: t.id }); res.status(201).json(t); });" > apps/api/src/routes/trips.ts
echo "import type { RequestHandler } from 'express'; import { verifyToken } from '@fleet/shared'; export const auth: RequestHandler = (req, res, next) => { const t = req.header('authorization')?.slice(7); if (!t || !verifyToken(t)) return res.sendStatus(401); next(); };" > apps/api/src/middleware/auth.ts
cat > apps/worker/package.json <<'J'
{ "name": "@fleet/worker", "dependencies": { "bullmq": "^5.4.0", "@fleet/db": "*" } }
J
echo "import { Worker } from 'bullmq'; import { onTripCreated } from './jobs/trip-created'; new Worker('trip-events', async (job) => { if (job.name === 'trip.created') await onTripCreated(job.data.id); });" > apps/worker/src/index.ts
echo "import { getTrip, updateMileage } from '@fleet/db'; export async function onTripCreated(id: string) { const trip = await getTrip(id); await updateMileage(trip.vehicleId, trip.distanceKm); }" > apps/worker/src/jobs/trip-created.ts
echo '{ "name": "@fleet/db", "main": "src/index.ts", "dependencies": { "pg": "^8.11.0" } }' > packages/db/package.json
echo "import pg from 'pg'; export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });" > packages/db/src/pool.ts
echo "import { pool } from './pool'; export const listVehicles = async () => (await pool.query('select * from vehicles')).rows; export const getVehicle = async (id: string) => (await pool.query('select * from vehicles where id = \$1', [id])).rows[0]; export const createTrip = async (t: { vehicleId: string; distanceKm: number }) => (await pool.query('insert into trips (vehicle_id, distance_km) values (\$1, \$2) returning *', [t.vehicleId, t.distanceKm])).rows[0]; export const getTrip = async (id: string) => (await pool.query('select * from trips where id = \$1', [id])).rows[0]; export const updateMileage = async (v: string, km: number) => pool.query('update vehicles set mileage_km = mileage_km + \$2 where id = \$1', [v, km]);" > packages/db/src/index.ts
echo "create table vehicles (id uuid primary key, plate text not null, mileage_km numeric not null default 0);" > packages/db/migrations/001_vehicles.sql
echo "create table trips (id uuid primary key default gen_random_uuid(), vehicle_id uuid references vehicles(id), distance_km numeric not null, created_at timestamptz default now());" > packages/db/migrations/002_trips.sql
echo '{ "name": "@fleet/shared", "main": "src/index.ts", "dependencies": { "jsonwebtoken": "^9.0.0" } }' > packages/shared/package.json
echo "import jwt from 'jsonwebtoken'; export const verifyToken = (t: string) => { try { return jwt.verify(t, process.env.JWT_SECRET ?? ''); } catch { return null; } };" > packages/shared/src/index.ts
echo "export const config = { port: Number(process.env.PORT ?? 3000), redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379' };" > config/index.ts
printf 'services:\n  db:\n    image: postgres:16\n  redis:\n    image: redis:7\n' > infra/docker-compose.yml
git init -q
git add -A
git -c user.email=dev@example.com -c user.name=dev commit -qm "initial import"
