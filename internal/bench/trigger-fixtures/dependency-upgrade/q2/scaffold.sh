#!/bin/bash
set -euo pipefail
mkdir -p .github/workflows
echo "20" > .nvmrc
cat > package.json <<'J'
{ "name": "billing-service", "version": "2.3.1", "engines": { "node": ">=20 <21" }, "scripts": { "start": "node index.js" }, "dependencies": { "fastify": "^4.26.0" } }
J
echo "import Fastify from 'fastify'; const app = Fastify(); app.get('/health', async () => ({ ok: true })); app.listen({ port: 8080 });" > index.js
cat > Dockerfile <<'D'
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
CMD ["node", "index.js"]
D
cat > .github/workflows/ci.yml <<'Y'
name: ci
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
Y
