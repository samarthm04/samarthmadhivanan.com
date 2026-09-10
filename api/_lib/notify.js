/* Lead notifications. Everything here runs server-side — no key ever reaches
   the browser, and one round trip from the visitor is enough.

   Channels are opt-in by env var and independent: whichever are configured get
   tried, and a failure in one doesn't block the other. If none are configured
   the lead is still saved and visible in /admin.html, which is the guaranteed
   record — these are just so you don't have to go look. */

const OWNER_EMAIL = 'samarthm04edu@gmail.com';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lines(lead) {
  const phone = lead.phone ? `${lead.country_code || ''} ${lead.phone}`.trim() : 'not given';
  const out = [
    `Name:  ${lead.name}`,
    `Email: ${lead.email || 'not given'}`,
    `Phone: ${phone}`,
    '',
    lead.note,
  ];
  if (lead.conversation_id) {
    out.push('', `Transcript: https://www.samarthmadhivanan.com/admin.html#c/${lead.conversation_id}`);
  }
  return out;
}

async function viaResend(lead) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_TO || OWNER_EMAIL;
  /* onboarding@resend.dev works before you own a domain; once
     samarthmadhivanan.com is verified in Resend, switch LEAD_NOTIFY_FROM. */
  const from = process.env.LEAD_NOTIFY_FROM || "Samarth's Assistant <onboarding@resend.dev>";

  const body = lines(lead);
  const payload = {
    from,
    to: [to],
    subject: `New enquiry — ${lead.name}`,
    text: body.join('\n'),
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${esc(body.join('\n'))}</pre>`,
  };
  /* Only set reply_to when it's a real address, or the send is rejected. */
  if (lead.email) payload.reply_to = lead.email;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { channel: 'resend', ok: false, reason: data.message || `http ${res.status}` };
    }
    return { channel: 'resend', ok: true, id: data.id };
  } catch (error) {
    return { channel: 'resend', ok: false, reason: String(error && error.message) };
  }
}

async function viaTelegram(lead) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const text = ['New enquiry', ''].concat(lines(lead)).join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return { channel: 'telegram', ok: false, reason: data.description || `http ${res.status}` };
    }
    return { channel: 'telegram', ok: true };
  } catch (error) {
    return { channel: 'telegram', ok: false, reason: String(error && error.message) };
  }
}

export async function sendLeadNotification(lead) {
  const jobs = [];
  if (process.env.RESEND_API_KEY) jobs.push(viaResend(lead));
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) jobs.push(viaTelegram(lead));

  if (!jobs.length) {
    console.warn('No notification channel configured — lead saved, see /admin.html');
    return { delivered: false, channels: [] };
  }

  const channels = await Promise.all(jobs);
  channels.filter((c) => !c.ok).forEach((c) => console.error(`lead notify via ${c.channel} failed: ${c.reason}`));
  return { delivered: channels.some((c) => c.ok), channels };
}
