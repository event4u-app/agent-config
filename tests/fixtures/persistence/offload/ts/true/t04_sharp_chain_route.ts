// S0.5 fixture — TRUE F9: heavy sharp processing chain in an express route handler.
import express from 'express';
import sharp from 'sharp';

const router = express.Router();

router.post('/media', async (req, res) => {
    const out = await sharp(req.file.buffer).resize(1600).webp({ quality: 80 }).toBuffer();
    await save(out);
    res.json({ ok: true });
});
