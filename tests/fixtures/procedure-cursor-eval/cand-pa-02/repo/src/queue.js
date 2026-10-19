const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
const reportQueue = new Queue('report-mail', { connection });

module.exports = { reportQueue, connection };
