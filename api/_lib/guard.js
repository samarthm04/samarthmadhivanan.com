import crypto from 'node:crypto';

export const MAX_MESSAGE_LEN = 1000;
export const MAX_MESSAGES_PER_CONVERSATION = 60;
export const MAX_HISTORY_TURNS = 16;

export function json(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/* Hash rather than store the IP — enough for abuse control, not a PII record. */
export function hashIp(req) {
  const salt = process.env.IP_SALT || 'samarth-site';
  return crypto.createHash('sha256').update(clientIp(req) + salt).digest('hex').slice(0, 32);
}

/* Drop control characters (keeping tab/newline/CR) without embedding literal
   control bytes in a regex. */
function stripControl(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c === 9 || c === 10 || c === 13 || c >= 32) out += ch;
  }
  return out;
}

export function sanitise(text, maxLen = MAX_MESSAGE_LEN) {
  if (typeof text !== 'string') return '';
  return stripControl(text).replace(/\n{4,}/g, '\n\n\n').trim().slice(0, maxLen);
}

export function isValidEmail(v) {
  return typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
}

export function isValidCountryCode(v) {
  return typeof v === 'string' && /^\+\d{1,4}$/.test(v.trim());
}

export function isValidPhone(v) {
  return typeof v === 'string' && /^[\d][\d\s-]{4,16}$/.test(v.trim());
}

export function isUuid(v) {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/* Constant-time compare so the admin password can't be probed by timing. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function adminToken() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('ADMIN_PASSWORD not set');
  return crypto.createHash('sha256').update('admin:' + secret).digest('hex');
}

export function requireAdmin(req, res) {
  const sent = req.headers['x-admin-token'];
  if (!sent || !safeEqual(sent, adminToken())) {
    json(res, 401, { error: 'Unauthorised' });
    return false;
  }
  return true;
}
