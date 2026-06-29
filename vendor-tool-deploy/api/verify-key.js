/**
 * verify-key.js — Vercel Serverless Function
 * POST /api/verify-key
 */

import crypto from 'crypto';

function b64uDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

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

  const { email, vendorKey } = req.body || {};

  try {
    const parts = (vendorKey || '').trim().split('.');
    if (parts.length !== 2) return res.status(200).json({ success: false, error: 'Formato Vendor Key non valido.' });

    const [payB64, sigB64] = parts;

    const expected = crypto.createHmac('sha256', Buffer.from(VENDOR_SECRET, 'utf8'))
      .update(Buffer.from(payB64, 'utf8')).digest();
    const received = b64uDecode(sigB64);

    // Confronto constant-time
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return res.status(200).json({ success: false, error: 'Vendor Key non valida.' });
    }

    let payload;
    try {
      payload = JSON.parse(b64uDecode(payB64).toString('utf8'));
    } catch {
      return res.status(200).json({ success: false, error: 'Vendor Key corrotta.' });
    }

    if (payload.email && payload.email.toLowerCase() !== (email || '').toLowerCase()) {
      return res.status(200).json({ success: false, error: 'Email non corrisponde alla Vendor Key.' });
    }

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return res.status(200).json({ success: false, error: 'Vendor Key scaduta.' });
    }

    const vendorId = payload.id || 'v_' + b64uEncode(Buffer.from(payload.email || ''));

    return res.status(200).json({
      success: true,
      email: payload.email,
      vendorName: payload.name || (payload.email || '').split('@')[0],
      zone: payload.zone || 'N/A',
      token: vendorKey,
      vendorId,
      coverageRadius: payload.radius || 30,
    });

  } catch (e) {
    return res.status(200).json({ success: false, error: 'Vendor Key corrotta.' });
  }
}
