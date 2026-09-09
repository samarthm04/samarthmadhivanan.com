import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, NOTE_SIGNAL } from './_lib/prompt.js';
import {
  createConversation, getConversation, addMessage, bumpConversation, getMessages,
} from './_lib/db.js';
import {
  json, sanitise, hashIp, isUuid,
  MAX_MESSAGE_LEN, MAX_MESSAGES_PER_CONVERSATION, MAX_HISTORY_TURNS,
} from './_lib/guard.js';

const MODEL = 'claude-haiku-4-5';

const FALLBACK_REPLY =
  "I'm having trouble thinking straight just now. Let me take your details and Samarth will come back to you.";

let anthropic = null;
function client() {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

/* DB roles -> API roles. The API only accepts user/assistant, and the history
   must begin with a user turn. */
function toApiMessages(rows) {
  const mapped = rows
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'visitor' ? 'user' : 'assistant',
      content: m.role === 'samarth' ? `(Samarth replied directly) ${m.content}` : m.content,
    }));
  while (mapped.length && mapped[0].role !== 'user') mapped.shift();
  return mapped;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const message = sanitise(body.message, MAX_MESSAGE_LEN);
    if (!message) return json(res, 400, { error: 'Empty message' });

    let conversationId = isUuid(body.conversationId) ? body.conversationId : null;
    let conversation = conversationId ? await getConversation(conversationId) : null;

    if (!conversation) {
      conversation = await createConversation({
        ipHash: hashIp(req),
        userAgent: req.headers['user-agent'],
      });
      conversationId = conversation.id;
    }

    if (conversation.message_count >= MAX_MESSAGES_PER_CONVERSATION) {
      return json(res, 429, {
        conversationId,
        reply: "We've covered a lot here. Let me take your details so Samarth can pick it up properly.",
        takeNote: true,
      });
    }

    const visitorRow = await addMessage(conversationId, 'visitor', message);
    await bumpConversation(conversationId, 1);

    /* Samarth is in the chat — the assistant stays quiet and the visitor
       polls /api/messages for his reply. */
    if (conversation.admin_joined) {
      return json(res, 200, { conversationId, reply: null, handover: true, lastId: visitorRow.id });
    }

    const history = await getMessages(conversationId, 0, 200);
    const apiMessages = toApiMessages(history).slice(-MAX_HISTORY_TURNS);

    let text = '';
    try {
      const response = await client().messages.create({
        model: MODEL,
        max_tokens: 300,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
        messages: apiMessages,
      });
      for (const block of response.content) {
        if (block.type === 'text') text += block.text;
      }
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return json(res, 200, {
          conversationId,
          reply: "I'm getting a lot of questions at once. Give me a moment and try again.",
          takeNote: false,
          lastId: visitorRow.id,
        });
      }
      if (error instanceof Anthropic.APIError) {
        console.error('Anthropic API error', error.status, error.message);
      } else {
        console.error('Chat failure', error);
      }
      const row = await addMessage(conversationId, 'assistant', FALLBACK_REPLY);
      return json(res, 200, { conversationId, reply: FALLBACK_REPLY, takeNote: true, lastId: row.id });
    }

    const takeNote = text.includes(NOTE_SIGNAL);
    let reply = text.split(NOTE_SIGNAL).join('').trim();
    if (!reply) reply = "Let me take your details and Samarth will get back to you.";

    const row = await addMessage(conversationId, 'assistant', reply);
    await bumpConversation(conversationId, 1);

    return json(res, 200, { conversationId, reply, takeNote, lastId: row.id });
  } catch (error) {
    console.error('chat handler', error);
    return json(res, 500, { error: 'Something went wrong' });
  }
}
