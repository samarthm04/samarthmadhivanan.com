import { saveLead, addMessage, getConversation, markLeadNotified } from './_lib/db.js';
import { sendLeadNotification } from './_lib/notify.js';
import {
  json, sanitise, isUuid, isValidEmail, isValidPhone, isValidCountryCode,
} from './_lib/guard.js';

const OWNER_EMAIL = 'samarthm04edu@gmail.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    const name = sanitise(body.name, 100);
    const note = sanitise(body.note, 2000);
    const email = sanitise(body.email, 200);
    const phone = sanitise(body.phone, 20);
    const countryCode = sanitise(body.countryCode, 6);
    const conversationId = isUuid(body.conversationId) ? body.conversationId : null;

    if (name.length < 2) return json(res, 400, { error: 'Please give a name.', field: 'name' });
    if (note.length < 2) return json(res, 400, { error: 'Tell me what to pass on.', field: 'note' });
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
    }

    if (conversationId && !(await getConversation(conversationId))) {
      return json(res, 400, { error: 'Unknown conversation' });
    }

    const lead = {
      conversation_id: conversationId,
      name,
      email: email || null,
      phone: phone || null,
      country_code: phone ? countryCode : null,
      note,
    };

    /* Saving is what must not fail — the console is the guaranteed record.
       Notification is best effort on top of it. */
    const saved = await saveLead(lead);

    if (conversationId) {
      await addMessage(
        conversationId,
        'system',
        `Note taken — ${name} | ${email || 'no email'} | ${phone ? `${countryCode} ${phone}` : 'no phone'}\n${note}`
      );
    }

    const result = await sendLeadNotification(lead);
    if (result.delivered) {
      try { await markLeadNotified(saved.id); } catch (e) { console.error('markLeadNotified', e); }
    }

    return json(res, 200, { ok: true, notified: result.delivered });
  } catch (error) {
    console.error('lead handler', error);
    return json(res, 500, { error: `Could not save that. Email ${OWNER_EMAIL} directly.` });
  }
}
