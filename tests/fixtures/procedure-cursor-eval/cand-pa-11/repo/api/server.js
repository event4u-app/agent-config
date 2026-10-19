const fastify = require('fastify')();

fastify.post('/ingest', async (request) => ({ received: Array.isArray(request.body) ? request.body.length : 0 }));
fastify.listen({ port: 8080, host: '0.0.0.0' });
