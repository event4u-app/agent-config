const { Worker } = require('bullmq');
const { connection } = require('../queue');
const { renderReport } = require('../render');

const worker = new Worker('report-mail', async (job) => {
  const body = renderReport(job.data.reportId);
  console.log(`mailing report ${job.data.reportId} to ${job.data.recipient} (${body.length} bytes)`);
}, { connection });

module.exports = worker;
