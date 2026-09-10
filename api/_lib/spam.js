/* Spam scoring for inbound leads.

   Design rule: this NEVER discards a lead. A flagged lead is still saved and
   still appears in /admin.html — it just doesn't trigger a notification. So a
   false positive costs a ping, not a customer. That lets the thresholds be
   reasonably aggressive without risking real enquiries. */

const DISPOSABLE = [
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'throwawaymail.com', 'yopmail.com', 'trashmail.com',
  'sharklasers.com', 'getnada.com', 'maildrop.cc', 'fakeinbox.com',
  'dispostable.com', 'mailnesia.com', 'spam4.me', 'grr.la',
];

/* Blocklists, split by how safely each term can be matched.

   LONG terms are distinctive enough to find anywhere, even with the separators
   stripped out, so "b-a-n-c-h-o-d" still trips.

   SHORT terms are embedded inside innocent words — "paki" in Pakistan, "spic"
   in suspicious, "chut" in chutney, "coon" in raccoon — so they are only ever
   matched as whole words. Getting this wrong silently eats real enquiries,
   which is far worse than missing a rude one. */
const ABUSE_LONG = [
  'banchod', 'bhenchod', 'behenchod', 'madarchod', 'madharchod', 'chutiya',
  'chutiye', 'bhosdi', 'motherfucker', 'dickhead', 'asshole', 'wanker', 'bastard',
];

/* Whole word, but a short suffix is allowed: fucking, bitches, shitty. */
const ABUSE_STEMS = ['fuck', 'shit', 'bitch', 'slut', 'whore', 'twat', 'cunt'];

/* Whole word, exact. No suffix — that's what protects Pakistan and suspicious. */
const ABUSE_EXACT = ['chut', 'randi', 'gandu', 'lauda', 'harami', 'retard'];

const SLURS_LONG = ['nigger', 'nigga', 'faggot', 'wetback', 'tranny'];
const SLURS_EXACT = ['paki', 'spic', 'gook', 'chink', 'kike', 'fag', 'dyke', 'coon'];

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function foldLeet(text) {
  return String(text || '').toLowerCase().split('').map((ch) => LEET[ch] || ch).join('');
}

/* Letters only — defeats "f-u-c-k" and "n 1 g g a". */
const collapsed = (text) => foldLeet(text).replace(/[^a-z]/g, '');
/* Letters and spaces — preserves word boundaries. */
const spaced = (text) => foldLeet(text).replace(/[^a-z]+/g, ' ').trim();

const anywhere = (text, list) => list.some((w) => text.includes(w));
const wholeWord = (text, list, suffix) =>
  list.some((w) => new RegExp(`\\b${w}${suffix ? '\\w{0,3}' : ''}\\b`).test(text));

/* National-number digit counts for the codes offered in the form.
   Anything outside these is almost certainly made up. */
const PHONE_DIGITS = {
  '+91': [10], '+1': [10], '+44': [10, 11], '+61': [9], '+65': [8],
  '+971': [9], '+49': [10, 11], '+33': [9], '+31': [9], '+81': [10],
  '+86': [11], '+27': [9], '+55': [10, 11], '+64': [8, 9], '+353': [9],
  '+41': [9], '+46': [9], '+34': [9], '+39': [9, 10], '+7': [10],
};

export function phoneLooksReal(phone, countryCode) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) return false;
  const allowed = PHONE_DIGITS[countryCode];
  if (allowed && !allowed.includes(digits.length)) return false;
  /* 1111111111, 1234567890 and friends. */
  if (/^(\d)\1+$/.test(digits)) return false;
  if ('01234567890123456789'.includes(digits)) return false;
  return true;
}

/* The contact form prepends "Interested in: …" and "Company: …" to the note.
   Strip that so the quality checks judge what the person actually typed. */
function writtenPart(note) {
  return String(note || '')
    .split('\n')
    .filter((line) => !/^\s*(interested in|company)\s*:/i.test(line))
    .join('\n')
    .trim();
}

/* Returns { score, reasons }. score >= 3 is treated as spam. */
export function scoreLead({ name, email, phone, countryCode, note, recentCount }) {
  const reasons = [];
  let score = 0;
  const message = writtenPart(note);
  const domain = (email || '').split('@')[1] || '';

  /* Check every field a person can type into, not just the message — the name
     and the email local part are just as likely to carry the abuse. */
  const raw = [name, (email || '').split('@')[0], message].join(' ');
  const flat = collapsed(raw);
  const wordText = spaced(raw);

  const slur = anywhere(flat, SLURS_LONG) || wholeWord(wordText, SLURS_EXACT, false);
  const abusive =
    slur ||
    anywhere(flat, ABUSE_LONG) ||
    wholeWord(wordText, ABUSE_STEMS, true) ||
    wholeWord(wordText, ABUSE_EXACT, false);

  if (slur) { score += 6; reasons.push('slur'); }
  else if (abusive) { score += 4; reasons.push('abusive language'); }

  const words = message.split(/\s+/).filter(Boolean);
  if (message.length < 12) { score += 2; reasons.push('message too short'); }
  if (words.length < 3) { score += 2; reasons.push('message not a sentence'); }

  /* Gibberish: a long single token with a digit jammed in, like "Thasag1m8". */
  if (words.length === 1 && /\d/.test(words[0] || '') && (words[0] || '').length >= 6) {
    score += 2; reasons.push('gibberish message');
  }

  if (/https?:\/\/|www\.|\[url|<a\s/i.test(message)) { score += 3; reasons.push('link in message'); }
  if (DISPOSABLE.includes(domain)) { score += 3; reasons.push('disposable email'); }
  if (phone && !phoneLooksReal(phone, countryCode)) { score += 2; reasons.push('implausible phone'); }
  if (recentCount >= 2) { score += 2; reasons.push('repeat submission'); }

  /* `abusive` is surfaced separately: it's grounds for ending the conversation,
     not just for withholding a notification. */
  return { score, reasons, spam: score >= 3, abusive: abusive || slur };
}
