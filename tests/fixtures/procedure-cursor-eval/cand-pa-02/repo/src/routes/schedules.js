const { Router } = require('express');

const router = Router();
const schedules = new Map();

router.get('/', (req, res) => res.json([...schedules.values()]));
router.put('/:id', (req, res) => {
  schedules.set(req.params.id, { id: req.params.id, cron: req.body.cron });
  res.json(schedules.get(req.params.id));
});

module.exports = router;
