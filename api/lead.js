import { saveLead, addMessage, getConversation, markLeadNotified } from './_lib/db.js';
import {
  json, sanitise, isUuid, isValidEmail, isValidPhone, isValidCountryCode,
} from './_lib/guard.js';

const OWNER_EMAIL = 'samarthm04edu@gmail.com';

/* Web3Forms refuses server-side submissions on the free plan (403: "Use our API
   in client side"). So the server validates and stores the lead, then hands the
   browser a ready-made payload to deliver. Their access keys are public by design. */
function notifyPayload(lead) {
  const key = process.env.WEB3FORMS_ACCESS_KEY;
  if (!key) return null;

  const phone = lead.phone ? `${lead.country_code || ''} ${lead.phone}`.trim() : 'not given';
  const lines = [
    `Name:  ${lead.name}`,
    `Email: ${lead.email || 'not given'}`,
    `Phone: ${phone}`,
    '',
    lead.note,
  ];
  if (lead.conversation_id) {
    lines.push('', `Transcript: https://samarthmadhivanan.com/admin.html#c/${lead.conversation_id}`);
  }

  return {
    endpoint: 'https://api.web3forms.com/submit',
    payload: {
      access_key: key,
      subject: `New enquiry — ${lead.name}`,
      from_name: "Samarth's Assistant",
      /* Web3Forms uses `email` as reply-to, so it must always be a real address. */
      email: lead.email || OWNER_EMAIL,
      name: lead.name,
      phone,
      message: lines.join('\n'),
      botcheck: '',
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    /* The browser reporting back whether the notification email actually went out. */
    if (body.confirmLeadId) {
      if (!isUuid(body.confirmLeadId)) return json(res, 400, { error: 'Bad lead id' });
      if (body.delivered) await markLeadNotified(body.confirmLeadId);
      else console.warn('lead notification not delivered', body.confirmLeadId, body.reason || '');
      return json(res, 200, { ok: true });
    }

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

    const saved = await saveLead(lead);

    if (conversationId) {
      await addMessage(
        conversationId,
        'system',
        `Note taken — ${name} | ${email || 'no email'} | ${phone ? `${countryCode} ${phone}` : 'no phone'}\n${note}`
      );
    }

    const notify = notifyPayload(lead);
    if (!notify) console.warn('WEB3FORMS_ACCESS_KEY not set — lead saved but no email sent');

    /* The lead is safely stored either way; `notify` is best-effort delivery. */
    return json(res, 200, { ok: true, leadId: saved.id, notify });
  } catch (error) {
    console.error('lead handler', error);
    return json(res, 500, { error: `Could not save that. Email ${OWNER_EMAIL} directly.` });
  }
}
