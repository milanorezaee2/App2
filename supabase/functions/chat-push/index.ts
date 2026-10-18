import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// public.conversation_members are resolved transactionally by the database trigger;
// this worker only claims the durable outbox and reads public.chat_push_tokens.
type QueueEvent = {
  id: string;
  recipient_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  delivered_tokens: string[];
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

type Delivery = { event: QueueEvent; token: string };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const retryDelaySeconds = (attempt: number) => Math.min(3600, 15 * 2 ** Math.min(attempt, 8));

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = Deno.env.get('CHAT_WEBHOOK_SECRET');
  if (!secret || request.headers.get('x-chat-webhook-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server configuration is incomplete' }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: events, error: claimError } = await admin.rpc('claim_chat_push_events', { p_limit: 100 });
  if (claimError) return json({ error: 'Could not claim queued notifications' }, 500);
  if (!events?.length) return json({ delivered: 0, queued: 0 });

  const queue = events as QueueEvent[];
  const recipientIds = [...new Set(queue.map(event => event.recipient_id))];
  const { data: tokenRows, error: tokenError } = await admin
    .from('chat_push_tokens')
    .select('user_id,expo_push_token')
    .in('user_id', recipientIds);
  if (tokenError) {
    await returnToQueue(admin, queue, tokenError.message);
    return json({ error: 'Could not load recipient tokens' }, 500);
  }

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows || []) {
    const tokens = tokensByUser.get(row.user_id) || [];
    tokens.push(row.expo_push_token);
    tokensByUser.set(row.user_id, tokens);
  }

  const deliveries: Delivery[] = [];
  const deliveredTokens = new Map<string, Set<string>>();
  const ticketIds = new Map<string, string[]>();
  const retryEvents = new Map<string, string>();
  for (const event of queue) {
    const tokens = tokensByUser.get(event.recipient_id) || [];
    if (!tokens.length) retryEvents.set(event.id, 'No registered Expo device token for recipient');
    deliveredTokens.set(event.id, new Set(event.delivered_tokens || []));
    for (const token of tokens) {
      if (!event.delivered_tokens?.includes(token)) deliveries.push({ event, token });
    }
  }

  const deadTokens = new Set<string>();
  for (let offset = 0; offset < deliveries.length; offset += 100) {
    const batch = deliveries.slice(offset, offset + 100);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch.map(({ event, token }) => ({
          to: token,
          title: event.title,
          body: event.body,
          sound: 'default',
          priority: 'high',
          channelId: 'milo-chat',
          ttl: 2419200,
          data: event.data,
        }))),
      });
      if (!response.ok) throw new Error(`Expo returned HTTP ${response.status}`);
      const result = await response.json() as { data?: ExpoTicket[] };
      const tickets = Array.isArray(result.data) ? result.data : [];
      batch.forEach(({ event, token }, index) => {
        const ticket = tickets[index];
        if (ticket?.status === 'ok') {
          deliveredTokens.get(event.id)?.add(token);
          if (ticket.id) ticketIds.set(event.id, [...(ticketIds.get(event.id) || []), ticket.id]);
        } else if (ticket?.details?.error === 'DeviceNotRegistered') {
          deadTokens.add(token);
          retryEvents.set(event.id, ticket.message || 'DeviceNotRegistered');
        } else {
          retryEvents.set(event.id, ticket?.message || 'Expo response did not include a ticket');
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Expo request failed';
      for (const { event } of batch) retryEvents.set(event.id, message);
    }
  }

  if (deadTokens.size) {
    await admin.from('chat_push_tokens').delete().in('expo_push_token', [...deadTokens]);
  }

  const retries: QueueEvent[] = [];
  for (const event of queue) {
    const liveTokens = (tokensByUser.get(event.recipient_id) || []).filter(token => !deadTokens.has(token));
    const delivered = deliveredTokens.get(event.id) || new Set<string>();
    // Each device token is acknowledged separately, so a temporary failure on
    // one phone never resends the same event to a phone Expo already accepted.
    const allDevicesAccepted = liveTokens.length > 0 && liveTokens.every(token => delivered.has(token));
    if (allDevicesAccepted) {
      await admin.from('chat_push_queue').update({
        status: 'sent', sent_at: new Date().toISOString(), locked_until: null,
        delivered_tokens: [...delivered],
        expo_ticket_id: (ticketIds.get(event.id) || []).join(',') || null,
        last_error: null,
      }).eq('id', event.id);
    } else {
      await admin.from('chat_push_queue').update({ delivered_tokens: [...delivered] }).eq('id', event.id);
      retries.push(event);
    }
  }

  await returnToQueue(admin, retries, retries.map(event => retryEvents.get(event.id) || 'Temporary delivery failure').join('; '));
  return json({ delivered: queue.length - retries.length, queued: retries.length, removedDeadTokens: deadTokens.size });
});

async function returnToQueue(
  admin: ReturnType<typeof createClient>,
  events: QueueEvent[],
  error: string,
  fixedDelaySeconds?: number,
): Promise<void> {
  for (const event of events) {
    const { data } = await admin.from('chat_push_queue').select('attempts').eq('id', event.id).maybeSingle();
    const delay = fixedDelaySeconds ?? retryDelaySeconds(Number(data?.attempts || 1));
    await admin.from('chat_push_queue').update({
      status: 'pending', available_at: new Date(Date.now() + delay * 1000).toISOString(),
      locked_until: null, last_error: error.slice(0, 500),
    }).eq('id', event.id);
  }
}
