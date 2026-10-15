import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'messages' | 'learning_contacts';
  schema: 'public';
  record: Record<string, unknown>;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = Deno.env.get('CHAT_WEBHOOK_SECRET');
  if (!secret || request.headers.get('x-chat-webhook-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const payload = await request.json() as WebhookPayload;
  if (payload.type !== 'INSERT' || payload.schema !== 'public') return json({ skipped: true });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server configuration is incomplete' }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let recipientIds: string[] = [];
  let title = 'میلو';
  let body = 'رویداد جدید در گفتگو';
  let conversationId: string | null = null;

  if (payload.table === 'messages') {
    conversationId = String(payload.record.conversation_id || '');
    const senderId = String(payload.record.sender_id || '');
    if (!conversationId || !senderId) return json({ error: 'Invalid message payload' }, 400);
    const { data: members, error } = await admin
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId);
    if (error) return json({ error: error.message }, 500);
    recipientIds = (members || []).map(member => member.user_id);
    const voice = payload.record.message_type === 'voice';
    title = voice ? 'پیام صوتی جدید' : 'پیام جدید';
    body = voice
      ? 'یک پیام صوتی جدید دریافت کردید.'
      : String(payload.record.body || 'یک پیام جدید دریافت کردید.').slice(0, 120);
  } else if (payload.table === 'learning_contacts') {
    const userId = String(payload.record.user_id || '');
    if (!userId) return json({ error: 'Invalid contact payload' }, 400);
    recipientIds = [userId];
    conversationId = String(payload.record.conversation_id || '') || null;
    title = 'درخواست مخاطب تأیید شد';
    body = 'یک گفتگوی خصوصی جدید برای شما فعال شد.';
  } else {
    return json({ skipped: true });
  }

  if (!recipientIds.length) return json({ delivered: 0 });
  const { data: tokens, error: tokenError } = await admin
    .from('chat_push_tokens')
    .select('expo_push_token')
    .in('user_id', recipientIds);
  if (tokenError) return json({ error: tokenError.message }, 500);

  const messages = (tokens || []).map(({ expo_push_token }) => ({
    to: expo_push_token,
    sound: 'default',
    title,
    body,
    priority: 'high',
    channelId: 'milo-chat',
    data: conversationId
      ? { conversationId, route: `/conversations/human/${conversationId}` }
      : { route: '/conversations' },
  }));
  if (!messages.length) return json({ delivered: 0 });

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await response.json();
  if (!response.ok) return json({ error: 'Expo push delivery failed', result }, 502);
  return json({ delivered: messages.length, result });
});
