import {
  saveLead, addMessage, getConversation, markLeadNotified, recentLeadCount, closeConversation,
} from './_lib/db.js';
import { sendLeadNotification } from './_lib/notify.js';
import { scoreLead, phoneLooksReal } from './_lib/spam.js';
import { triageLead } from './_lib/triage.js';
import {
  json, sanitise, isUuid, hashIp, isValidEmail, isValidPhone, isValidCountryCode,
} from './_lib/guard.js';

const OWNER_EMAIL = 'samarthm04business@gmail.com';
const MAX_LEADS_PER_HOUR = 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    /* Honeypot: a field hidden from humans. Anything that fills it is a bot.
       Answer as if it worked so it doesn't retry with a different shape. */
    if (sanitise(body.website, 200)) {
      console.warn('lead honeypot tripped');
      return json(res, 200, { ok: true, notified: false });
    }

    const name = sanitise(body.name, 100);
    const note = sanitise(body.note, 2000);
    const email = sanitise(body.email, 200);
    const phone = sanitise(body.phone, 20);
    const countryCode = sanitise(body.countryCode, 6);
    const conversationId = isUuid(body.conversationId) ? body.conversationId : null;

    if (name.length < 2) return json(res, 400, { error: 'Please give a name.', field: 'name' });
    if (note.length < 6) {
      return json(res, 400, { error: 'Tell me a bit more than that.', field: 'note' });
    }
    if (!email && !phone) {
      return json(res, 400, { error: 'An email or a phone number, so Samarth can reply.', field: 'email' });
    }
    if (email && !isValidEmail(email)) {
      return json(res, 400, { error: "That email doesn't look right.", field: 'email' });
    }
    if (phone) {
      if (!isValidPhone(phone)) {
        return json(res, 400, { error: "That phone number doesn't look right.", field: 'phone' });
      }
      if (!isValidCountryCode(countryCode)) {
        return json(res, 400, { error: 'Pick a country code.', field: 'countryCode' });
      }
      /* Wrong digit count for the country. Reject rather than silently flag, so a
         real person with a typo is told, and a made-up number never gets through. */
      if (!phoneLooksReal(phone, countryCode)) {
        return json(res, 400, {
          error: `That doesn't look like a valid ${countryCode} number.`,
          field: 'phone',
        });
      }
    }

    if (conversationId && !(await getConversation(conversationId))) {
      return json(res, 400, { error: 'Unknown conversation' });
    }

    const ipHash = hashIp(req);
    const recentCount = await recentLeadCount(ipHash, 60);

    /* Scored before the rate-limit gate: abuse is grounds for ending the
       conversation, and that shouldn't depend on which limit trips first. */
    const heuristic = scoreLead({ name, email, phone, countryCode, note, recentCount });

    if (heuristic.abusive && conversationId) {
      await closeConversation(conversationId, 'abuse');
      await addMessage(conversationId, 'system', 'Conversation closed — abusive submission.');
      console.warn(`conversation ${conversationId} closed: abusive lead`);
    }

    if (recentCount >= MAX_LEADS_PER_HOUR) {
      return json(res, 429, {
        error: "That's a few messages in a short time. Try again later, or email " + OWNER_EMAIL + '.',
        closed: heuristic.abusive,
      });
    }

    /* Abuse is already decided; don't spend a model call confirming it. */
    const triage = heuristic.abusive
      ? { verdict: 'SPAM', reason: 'abusive submission', ok: true }
      : await triageLead({ name, email, phone, countryCode, note });

    const isSpam =
      heuristic.spam ||
      triage.verdict === 'SPAM' ||
      (triage.verdict === 'SUSPICIOUS' && heuristic.score >= 2);

    const reasons = heuristic.reasons.slice();
    if (triage.verdict !== 'GENUINE') reasons.push(`assistant: ${triage.reason}`);

    const lead = {
      conversation_id: conversationId,
      name,
      email: email || null,
      phone: phone || null,
      country_code: phone ? countryCode : null,
      note,
      ip_hash: ipHash,
      flagged: isSpam,
      spam_reason: isSpam ? reasons.join(', ') : null,
      triage: `${triage.verdict} — ${triage.reason}`,
    };

    /* Always saved — a flagged lead is still visible in the console. */
    const saved = await saveLead(lead);

    if (conversationId) {
      await addMessage(
        conversationId,
        'system',
        `Note taken — ${name} | ${email || 'no email'} | ${phone ? `${countryCode} ${phone}` : 'no phone'}` +
          (isSpam ? ` | FLAGGED: ${lead.spam_reason}` : '') +
          `\n${note}`
      );
    }

    /* Only real-looking leads are worth interrupting Samarth for. */
    if (isSpam) {
      console.warn(`lead flagged (heuristic ${heuristic.score}, ${triage.verdict}): ${lead.spam_reason}`);

      /* Say so rather than pretending it was delivered. Telling someone their
         message went through when it didn't is a small lie, and if the filter
         has misjudged a real person this is what lets them route around it. */
      /* Note the asymmetry: the polite decline hands over the direct email so a
         misjudged enquiry has a route through. The abusive one does not. */
      const declined = heuristic.abusive
        ? "That's not acceptable. I'm not passing it on, and I'm closing this conversation."
        : `I don't think this is something I should pass on to Samarth. If I've got that wrong, email him directly at ${OWNER_EMAIL}.`;

      return json(res, 200, {
        ok: true,
        notified: false,
        rejected: true,
        message: declined,
        /* Abuse ends it. A misjudged enquiry can rephrase or email. */
        closed: heuristic.abusive,
      });
    }

    /* Got through, but the assistant wasn't fully convinced — say so in the ping. */
    const caution = triage.verdict === 'SUSPICIOUS' ? `Worth a look first — ${triage.reason}` : null;
    const result = await sendLeadNotification({ ...lead, caution });
    if (result.delivered) {
      try { await markLeadNotified(saved.id); } catch (e) { console.error('markLeadNotified', e); }
    }

    return json(res, 200, { ok: true, notified: result.delivered });
  } catch (error) {
    console.error('lead handler', error);
    return json(res, 500, { error: `Could not save that. Email ${OWNER_EMAIL} directly.` });
  }
}
