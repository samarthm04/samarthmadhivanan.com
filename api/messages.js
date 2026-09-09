import { getMessages, getConversation } from './_lib/db.js';
import { json, isUuid } from './_lib/guard.js';

/* The visitor's widget polls this so Samarth's replies appear live once he joins. */
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  try {
    const conversationId = req.query?.conversationId;
    if (!isUuid(conversationId)) return json(res, 400, { error: 'Bad conversation id' });

    const conversation = await getConversation(conversationId);
    if (!conversation) return json(res, 404, { error: 'Unknown conversation' });

    const since = Number.parseInt(req.query?.since, 10);
    const rows = await getMessages(conversationId, Number.isFinite(since) ? since : 0, 50);

    /* Only surface what the visitor should see — never internal system notes. */
    const visible = rows
      .filter((m) => m.role === 'assistant' || m.role === 'samarth')
      .map((m) => ({ id: m.id, role: m.role, content: m.content, at: m.created_at }));

    return json(res, 200, {
      messages: visible,
      handover: conversation.admin_joined,
      lastId: rows.length ? rows[rows.length - 1].id : since || 0,
    });
  } catch (error) {
    console.error('messages handler', error);
    return json(res, 500, { error: 'Something went wrong' });
  }
}
