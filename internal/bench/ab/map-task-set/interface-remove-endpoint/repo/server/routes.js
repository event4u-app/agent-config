import express from 'express';

export const router = express.Router();

router.get('/api/v2/stats', (req, res) => res.json({ visits: 0 }));
router.get('/api/v1/legacy-stats', (req, res) => res.json({ hits: 0 }));
