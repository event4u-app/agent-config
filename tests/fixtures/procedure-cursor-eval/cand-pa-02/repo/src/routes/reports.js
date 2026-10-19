const { Router } = require('express');
const { reportQueue } = require('../queue');

const router = Router();

router.post('/:reportId/send', async (req, res) => {
  await reportQueue.add('send-report', { reportId: req.params.reportId, recipient: req.body.recipient });
  res.status(202).json({ queued: true });
});

module.exports = router;
