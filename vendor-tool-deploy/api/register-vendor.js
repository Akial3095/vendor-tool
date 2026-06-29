/**
 * register-vendor.js — Vercel Serverless Function
 * POST /api/register-vendor
 */

import crypto from 'crypto';

const SUPABASE_URL = 'https://vylcnyjneierhqjdjvin.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bGNueWpuZWllcmhxamRqdmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODA5NDIsImV4cCI6MjA5Nzk1Njk0Mn0.cAdIM--q6h8st8HuK_0r6IcgenzFkKsNq-PdUIzPMPE';

function b64uEncode(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  const VENDOR_SECRET = process.env.VENDOR_SECRET;
  if (!VENDOR_SECRET) return res.status(500).json({ success: false, error: 'Configurazione server mancante.' });

  let { email, shopName, city } = req.body || {};
  email = (email || '').trim().toLowerCase();
  shopName = (shopName || '').trim();
  city = (city || '').trim();

  if (!email || !shopName) {
    return res.status(400).json({ success: false, error: 'Email e nome negozio obbligatori.' });
  }

  const vendorId = 'v_' + b64uEncode(Buffer.from(email));
  const password = 'dfv_' + vendorId.slice(0, 24);

  // Crea account Supabase
  const signUpRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body: JSON.stringify({ email, password }),
  });
  const signUpData = await signUpRes.json();

  const alreadyExists = (signUpData.error?.message || '').toLowerCase().includes('already registered')
    || (signUpData.error?.message || '').toLowerCase().includes('already been registered');

  if (signUpData.error && !alreadyExists) {
    return res.status(200).json({ success: false, error: 'Errore registrazione: ' + signUpData.error.message });
  }

  // Genera Vendor Key
  const payload = { email, name: shopName, zone: city, radius: 30, id: vendorId };
  const payB64 = b64uEncode(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac('sha256', Buffer.from(VENDOR_SECRET, 'utf8'))
    .update(Buffer.from(payB64, 'utf8')).digest();
  const vendorKey = `${payB64}.${b64uEncode(sig)}`;

  // Salva registrazione in Supabase
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/vendor_registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email, shop_name: shopName, city, vendor_id: vendorId, already_existed: alreadyExists }),
    });
  } catch (e) {
    console.warn('vendor_registrations insert fallita:', e.message);
  }

  return res.status(200).json({ success: true, vendorKey, shopName, email });
}
