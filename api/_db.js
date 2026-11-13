// Shared helpers for the form endpoints. Without DATABASE_URL every endpoint answers 503 "not_configured"
// and the site tells the visitor that nothing was sent.
const { neon } = require('@neondatabase/serverless');

let sql = null;
function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HANDLE = /^@?[A-Za-z0-9._]{1,30}$/;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function isUrl(v) {
  try { const u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.'); } catch (e) { return false; }
}
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}
function slugify(name) {
  const base = name.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s_]+/g, '-').slice(0, 48) || 'photographer';
  return base + '-' + Math.random().toString(36).slice(2, 6);
}
// Wraps a handler: method check, honeypot, database check, error handling.
function endpoint(method, handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== method) { res.setHeader('Allow', method); return res.status(405).json({ ok: false, error: 'method_not_allowed' }); }
    const data = method === 'POST' ? body(req) : req.query || {};
    if (method === 'POST' && text(data.company, 100)) return res.status(200).json({ ok: true }); // bots fill the hidden field
    const q = db();
    if (!q) return res.status(503).json({ ok: false, error: 'not_configured' });
    try { return await handler(q, data, res); }
    catch (e) { console.error(e); return res.status(500).json({ ok: false, error: 'server_error' }); }
  };
}
const invalid = (res, errors) => res.status(400).json({ ok: false, errors });

module.exports = { endpoint, invalid, text, isUrl, slugify, EMAIL, HANDLE };
