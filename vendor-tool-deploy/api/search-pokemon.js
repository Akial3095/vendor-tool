/**
 * search-pokemon.js — Vercel Serverless Function
 * GET /api/search-pokemon?q=pikachu
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const q = req.query.q || '';
  if (q.length < 2) return res.status(400).json({ data: [], error: 'Query troppo corta' });

  const POKEMONTCG_KEY = process.env.POKEMONTCG_KEY || '';
  const encoded = encodeURIComponent('name:"' + q + '*"');
  const url = `https://api.pokemontcg.io/v2/cards?q=${encoded}&pageSize=20&orderBy=name`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'dark-forge-vendor/1.0',
        ...(POKEMONTCG_KEY ? { 'X-Api-Key': POKEMONTCG_KEY } : {}),
      },
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ data: [], error: 'Errore API Pokémon: ' + resp.status });
    }

    const json = await resp.json();
    return res.status(200).json({ data: json.data || [] });

  } catch (e) {
    return res.status(500).json({ data: [], error: 'Errore di rete verso PokéTCG.' });
  }
}
