/**
 * sync-cardtrader.js — Vercel Serverless Function
 * POST /api/sync-cardtrader
 */

const CT_BASE = 'https://api.cardtrader.com/api/v2';

const COND_MAP = {
  'NM': 'near_mint', 'EX': 'excellent', 'VG': 'very_good',
  'GD': 'good', 'LP': 'lightly_played', 'PL': 'played', 'PO': 'poor'
};

const GAME_MAP = { 'mtg': 1, 'pokemon': 3, 'yugioh': 5, 'onepiece': 18, 'lorcana': 19 };

const LANG_MAP = {
  'Italian': 'it', 'English': 'en', 'Japanese': 'jp',
  'Deutsch': 'de', 'Français': 'fr', 'Spanish': 'es',
  'IT': 'it', 'EN': 'en', 'JP': 'jp', 'DE': 'de', 'FR': 'fr'
};

async function ctFetch(path, token, options = {}) {
  const resp = await fetch(CT_BASE + path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'dark-forge-vendor/1.0',
      ...(options.headers || {}),
    },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`CT API ${resp.status}: ${txt.slice(0, 200)}`);
  }
  return resp.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { token, items } = req.body || {};

  if (!token) return res.status(400).json({ error: 'Token CardTrader mancante' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Nessuna carta da sincronizzare' });

  let synced = 0, skipped = 0;
  const errors = [];
  const bpCache = {};

  for (const item of items) {
    try {
      const gameId = GAME_MAP[item.tcg || 'mtg'] || 1;
      const cacheKey = `${item.name}__${gameId}`;

      if (!bpCache[cacheKey]) {
        const search = await ctFetch(
          `/blueprints/search?q=${encodeURIComponent(item.name)}&game_id=${gameId}&per_page=5`,
          token
        );
        const bp = (search.blueprints || search || []).find(
          b => b.name?.toLowerCase() === item.name.toLowerCase()
        ) || (search.blueprints || search || [])[0];

        if (!bp) { skipped++; errors.push(`Blueprint non trovato: ${item.name}`); continue; }
        bpCache[cacheKey] = bp.id;
      }

      const blueprintId = bpCache[cacheKey];
      const condition = COND_MAP[item.condition] || 'near_mint';
      const locale = LANG_MAP[item.language] || 'en';
      const priceInCents = Math.round((item.price || 0) * 100);

      await ctFetch('/offers', token, {
        method: 'POST',
        body: JSON.stringify({
          blueprint_id: blueprintId,
          price: priceInCents,
          quantity: item.qty || 1,
          description: item.foil ? 'Foil' : '',
          user_data: { condition, foil: !!item.foil, signed: false, altered: false },
          graded: false,
          locale,
        }),
      });

      synced++;
      await new Promise(r => setTimeout(r, 120));

    } catch (e) {
      errors.push(`${item.name}: ${e.message}`);
      skipped++;
    }
  }

  return res.status(200).json({ synced, skipped, errors: errors.slice(0, 20) });
}
