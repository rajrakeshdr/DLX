import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, system = 'You are a helpful AI assistant.', model = 'llama-3.1-70b-versatile', temperature = 0.3 } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Missing query' });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return res.status(500).json({ error: 'Missing GROQ_API_KEY on server' });
    }

    const groq = new Groq({ apiKey: groqApiKey });
    const completion = await groq.chat.completions.create({
      model,
      temperature: Math.max(0, Math.min(1, Number(temperature) || 0.3)),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: query }
      ]
    });

    const answer = completion?.choices?.[0]?.message?.content || '';

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        await supabase.from('search_logs').insert({ prompt: query, answer, model, temperature });
      } catch (_) {
        // ignore logging errors
      }
    }

    return res.status(200).json({ answer });
  } catch (err) {
    const message = err?.message || 'Unexpected error';
    return res.status(500).json({ error: message });
  }
}


