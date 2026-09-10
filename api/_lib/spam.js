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

/* Blocklist. Matched against a normalised copy of the text (lowercased, leetspeak
   folded, non-letters stripped) so "n1gg4" and "f-u-c-k" don't slip through. */
const ABUSE = [
  'banchod', 'bhenchod', 'behenchod', 'madarchod', 'madharchod', 'chutiya',
  'chutiye', 'gandu', 'bhosdi', 'randi', 'lauda', 'harami',
  'fuck', 'bitch', 'asshole', 'cunt', 'bastard', 'dickhead', 'twat', 'wanker',
  'motherfucker', 'slut', 'whore', 'retard',
];

/* Slurs are an automatic flag on their own, wherever they appear. */
const SLURS = [
  'nigger', 'nigga', 'chink', 'gook', 'spic', 'kike', 'paki', 'wetback',
  'tranny', 'faggot', 'fag', 'dyke', 'coon',
];

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

/* Fold leetspeak and strip separators so obfuscation doesn't defeat the list. */
function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] || ch)
    .join('')
    .replace(/[^a-z]/g, '');
}

/* National-number digit counts for the codes offered in the form.
   Anything outside these is almost certainly made up. */
const PHONE_DIGITS = {
  '+91': [10], '+1': [10], '+44': [10, 11], '+61': [9], '+65': [8],
  '+971': [9], '+49': [10, 11], '+33': [9], '+31': [9], '+81': [10],
  '+86': [11], '+27': [9], '+55': [10, 11], '+64': [8, 9], '+353': [9],
  '+41': [9], '+46': [9], '+34': [9], '+39': [9, 10], '+7': [10],
};

const has = (text, list) => list.some((w) => text.includes(w));

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
  const typed = normalise([name, (email || '').split('@')[0], message].join(' '));

  const abusive = has(typed, ABUSE);
  const slur = has(typed, SLURS);
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
