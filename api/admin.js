import {
  listConversations, listLeads, getMessages, addMessage, bumpConversation, setTakeover, getConversation,
} from './_lib/db.js';
import {
  json, sanitise, isUuid, safeEqual, adminToken, requireAdmin,
} from './_lib/guard.js';

export default async function handler(req, res) {
  const action = req.query?.action;

  try {
    /* ── login: the only unauthenticated action ── */
    if (action === 'login') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const secret = process.env.ADMIN_PASSWORD;
      if (!secret) return json(res, 500, { error: 'ADMIN_PASSWORD is not set on the server' });
      if (!safeEqual(body.password || '', secret)) {
        await new Promise((r) => setTimeout(r, 400));
        return json(res, 401, { error: 'Wrong password' });
      }
      return json(res, 200, { token: adminToken() });
    }

    if (!requireAdmin(req, res)) return;

    if (action === 'conversations') {
      return json(res, 200, { conversations: await listConversations() });
    }

    if (action === 'leads') {
      return json(res, 200, { leads: await listLeads() });
    }

    if (action === 'messages') {
      const conversationId = req.query?.conversationId;
      if (!isUuid(conversationId)) return json(res, 400, { error: 'Bad conversation id' });
      const since = Number.parseInt(req.query?.since, 10);
      const conversation = await getConversation(conversationId);
      if (!conversation) return json(res, 404, { error: 'Unknown conversation' });
      const rows = await getMessages(conversationId, Number.isFinite(since) ? since : 0, 200);
      return json(res, 200, {
        messages: rows,
        handover: conversation.admin_joined,
        lastId: rows.length ? rows[rows.length - 1].id : since || 0,
      });
    }

    if (action === 'reply') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!isUuid(body.conversationId)) return json(res, 400, { error: 'Bad conversation id' });
      const text = sanitise(body.text, 2000);
      if (!text) return json(res, 400, { error: 'Empty reply' });

      /* Replying implies joining, so the assistant stops answering. */
      await setTakeover(body.conversationId, true);
      const row = await addMessage(body.conversationId, 'samarth', text);
      await bumpConversation(body.conversationId, 1);
      return json(res, 200, { ok: true, message: row });
    }

    if (action === 'takeover') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!isUuid(body.conversationId)) return json(res, 400, { error: 'Bad conversation id' });
      const on = !!body.on;
      await setTakeover(body.conversationId, on);
      await addMessage(
        body.conversationId,
        'system',
        on ? 'Samarth joined the chat.' : 'Samarth left — the assistant is answering again.'
      );
      return json(res, 200, { ok: true, handover: on });
    }

    return json(res, 400, { error: 'Unknown action' });
  } catch (error) {
    console.error('admin handler', error);
    return json(res, 500, { error: 'Something went wrong' });
  }
}
