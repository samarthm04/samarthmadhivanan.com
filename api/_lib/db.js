import { createClient } from '@supabase/supabase-js';

/* Service-role client. Server-side only — never expose these env vars to the browser.
   RLS is enabled with no public policies, so the service role is the only way in. */
let client = null;
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase env vars missing');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export async function createConversation({ ipHash, userAgent }) {
  const { data, error } = await db()
    .from('conversations')
    .insert({ ip_hash: ipHash, user_agent: (userAgent || '').slice(0, 300) })
    .select('id, admin_joined, message_count')
    .single();
  if (error) throw error;
  return data;
}

export async function getConversation(id) {
  const { data, error } = await db()
    .from('conversations')
    .select('id, admin_joined, message_count, status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function addMessage(conversationId, role, content) {
  const { data, error } = await db()
    .from('messages')
    .insert({ conversation_id: conversationId, role, content })
    .select('id, role, content, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function bumpConversation(conversationId, by = 1) {
  const { error } = await db().rpc('bump_conversation', {
    conv_id: conversationId,
    inc: by,
  });
  if (error) throw error;
}

export async function getMessages(conversationId, sinceId = 0, limit = 100) {
  const { data, error } = await db()
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .gt('id', sinceId)
    .order('id', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* Conversations started and messages sent by this visitor in the last N minutes.
   One round trip; used to stop anyone farming the assistant for tokens. */
export async function recentActivity(ipHash, minutes) {
  if (!ipHash) return { conversations: 0, messages: 0 };
  const { data, error } = await db().rpc('recent_activity', { ip: ipHash, mins: minutes });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    conversations: row?.conversation_count || 0,
    messages: row?.message_count || 0,
  };
}

export async function closeConversation(conversationId) {
  const { error } = await db()
    .from('conversations')
    .update({ status: 'closed' })
    .eq('id', conversationId);
  if (error) throw error;
}

/* How many leads this visitor has sent recently — the rate limit and one of the
   spam signals both use it. */
export async function recentLeadCount(ipHash, minutes) {
  if (!ipHash) return 0;
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const { count, error } = await db()
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);
  if (error) throw error;
  return count || 0;
}

export async function markLeadNotified(leadId) {
  const { error } = await db().from('leads').update({ notified: true }).eq('id', leadId);
  if (error) throw error;
}

export async function saveLead(lead) {
  const { data, error } = await db().from('leads').insert(lead).select('id').single();
  if (error) throw error;

  if (lead.conversation_id) {
    await db()
      .from('conversations')
      .update({
        visitor_name: lead.name,
        visitor_email: lead.email,
        visitor_phone: lead.phone,
        country_code: lead.country_code,
        status: 'lead',
      })
      .eq('id', lead.conversation_id);
  }
  return data;
}

/* ── admin ── */

export async function listConversations(limit = 60) {
  const { data, error } = await db()
    .from('conversations')
    .select('id, created_at, last_message_at, visitor_name, visitor_email, visitor_phone, country_code, admin_joined, message_count, status')
    .order('last_message_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function listLeads(limit = 100) {
  const { data, error } = await db()
    .from('leads')
    .select('id, conversation_id, name, email, phone, country_code, note, notified, flagged, spam_reason, triage, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function setTakeover(conversationId, on) {
  const { error } = await db()
    .from('conversations')
    .update({ admin_joined: !!on })
    .eq('id', conversationId);
  if (error) throw error;
}
