// S0.5 fixture — TRUE F9: ML/AI inference call inside a route handler.
import express from 'express';
import { openai } from '../clients';

const app = express();

app.post('/summarize', async (req, res) => {
    const result = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: req.body.text }],
    });
    res.json({ summary: result.choices[0].message.content });
});
