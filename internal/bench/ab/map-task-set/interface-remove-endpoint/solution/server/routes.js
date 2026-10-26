import express from 'express';

export const router = express.Router();

router.get('/api/v2/stats', (req, res) => res.json({ visits: 0 }));
