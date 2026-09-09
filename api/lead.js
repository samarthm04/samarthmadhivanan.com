import { saveLead, addMessage, getConversation } from './_lib/db.js';
import {
  json, sanitise, isUuid, isValidEmail, isValidPhone, isValidCountryCode,
} from './_lib/guard.js';

async function notify(lead) {
  const key = process.env.WEB3FORMS_ACCESS_KEY;
  if (!key) return { sent: false, reason: 'no key configured' };

  const phone = lead.phone ? `${lead.country_code || ''} ${lead.phone}`.trim() : '(not given)';
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: key,
        subject: `New message via Samarth's Assistant — ${lead.name}`,
        from_name: "Samarth's Assistant",
        name: lead.name,
        email: lead.email || 'not given',
        phone,
        message: lead.note,
        conversation: lead.conversation_id
          ? `https://samarthmadhivanan.com/admin.html#c/${lead.conversation_id}`
          : 'n/a',
      }),
    });
    return { sent: res.ok };
  } catch (error) {
    console.error('web3forms notify failed', error);
    return { sent: false };
  }
}

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

    await saveLead(lead);
    const delivery = await notify(lead);

    if (conversationId) {
      await addMessage(
        conversationId,
        'system',
        `Note taken — ${name} | ${email || 'no email'} | ${phone ? `${countryCode} ${phone}` : 'no phone'}\n${note}`
      );
    }

    return json(res, 200, { ok: true, notified: delivery.sent });
  } catch (error) {
    console.error('lead handler', error);
    return json(res, 500, { error: 'Could not save that. Email samarthm04edu@gmail.com directly.' });
  }
}
