import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;

// Groq client
const groqApiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: groqApiKey });

// Supabase (optional)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Serve static UI
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/search', async (req, res) => {
  try {
    const { query, system = 'You are a helpful AI assistant.', model = 'qwen/qwen3-32b', temperature = 0.3 } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Missing query' });
    }
    if (!groqApiKey) {
      return res.status(500).json({ error: 'Missing GROQ_API_KEY on server' });
    }

    const completion = await groq.chat.completions.create({
      model,
      temperature: Math.max(0, Math.min(1, Number(temperature) || 0.3)),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: query }
      ]
    });

    const answer = completion?.choices?.[0]?.message?.content || '';

    // fire-and-forget log to Supabase
    if (supabase) {
      supabase
        .from('search_logs')
        .insert({ prompt: query, answer, model, temperature })
        .then(() => {})
        .catch(() => {});
    }

    res.json({ answer });
  } catch (err) {
    const message = err?.message || 'Unexpected error';
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`AI Search server listening on http://localhost:${PORT}`);
});


