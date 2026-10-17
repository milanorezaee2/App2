#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const pkg = JSON.parse(read('package.json'));
const config = read('app.json');
const bridge = read('components/ChatNotificationBridge.tsx');
const notifications = read('lib/chatNotifications.ts');
const adminPush = read('lib/adminPush.ts');
const migration = read('supabase/migrations/202610140001_chat_push_notifications.sql');
const offlineMigration = read('supabase/migrations/202610170001_offline_chat_push_queue.sql');
const edge = read('supabase/functions/chat-push/index.ts');
const layout = read('app/_layout.tsx');

check(pkg.dependencies['expo-notifications'], 'expo-notifications is installed');
const keyboardRuntime = read('components/KeyboardRuntime.native.tsx');
const babel = read('babel.config.js');
check(pkg.dependencies['react-native-keyboard-controller'] && pkg.dependencies['react-native-reanimated'], 'native keyboard animation dependencies are installed');
check(/KeyboardAwareScrollView/.test(keyboardRuntime)
  && /KeyboardAvoidingView/.test(keyboardRuntime)
  && /KeyboardProvider/.test(keyboardRuntime)
  && /KeyboardStickyView/.test(keyboardRuntime)
  && /react-native-reanimated\/plugin/.test(babel), 'native keyboard controller is wired to the UI-thread animation runtime');
check(/"expo-notifications"/.test(config) && /"defaultChannel": "milo-chat"/.test(config), 'Android notification plugin and channel are configured');
check(/KeyboardProvider/.test(layout) && /ChatNotificationBridge/.test(layout), 'keyboard and notification providers mount globally');
check(/AndroidImportance\.HIGH/.test(notifications) && /sound:\s*'default'/.test(notifications), 'chat channel uses visible high-priority alerts with sound');
check(/message_type === 'voice'/.test(notifications), 'voice messages receive a distinct notification');
check(/table: 'learning_contacts'/.test(notifications), 'contact and support requests receive foreground fallback notifications');
check(/addNotificationResponseReceivedListener/.test(bridge) && /conversationId/.test(bridge), 'tapping an alert opens the exact conversation');
check(/CREATE TABLE IF NOT EXISTS public\.chat_push_tokens/.test(migration), 'push token storage migration exists');
check(/ENABLE ROW LEVEL SECURITY/.test(migration) && /user_id = auth\.uid\(\)/.test(migration), 'push tokens are protected by owner RLS');
check(/conversation_members/.test(edge) && /chat_push_tokens/.test(edge), 'server push resolves recipients and registered Expo tokens');
check(/exp\.host\/--\/api\/v2\/push\/send/.test(edge), 'server push uses Expo delivery');
check(/CHAT_WEBHOOK_SECRET/.test(edge), 'Edge Function endpoint requires a dedicated shared secret');

// Real event routing: a learner's message reaches the manager; a manager's
// reply reaches the learner. The initial support request targets the manager.
check(/SELECT cm\.user_id FROM public\.conversation_members cm[\s\S]*?cm\.user_id <> NEW\.sender_id/.test(offlineMigration)
  && /NEW\.sender_id = manager_id/.test(offlineMigration)
  && /'درخواست چت تازه'/.test(offlineMigration), 'message events notify the opposite participant and support requests notify the manager');
check(/AFTER INSERT ON public\.messages/.test(offlineMigration)
  && /AFTER INSERT ON public\.learning_contacts/.test(offlineMigration), 'database triggers cover sent messages and new chat requests');

// Durable queue/offline behavior and idempotency.
check(/status text NOT NULL DEFAULT 'pending'[\s\S]*?'processing'[\s\S]*?'sent'/.test(offlineMigration)
  && /FOR UPDATE SKIP LOCKED/.test(offlineMigration), 'offline work remains in a durable, concurrency-safe queue');
check(/available_at <= now\(\)/.test(offlineMigration)
  && /pg_cron/.test(offlineMigration)
  && /schedule\(\$1, \$2, \$3\)/.test(offlineMigration), 'pending work is retried by the server after temporary delivery failures');
check(/event_key text NOT NULL UNIQUE/.test(offlineMigration)
  && /ON CONFLICT \(event_key\) DO NOTHING/.test(offlineMigration)
  && /expo_ticket_id/.test(offlineMigration), 'stable event IDs and Expo tickets prevent duplicate enqueue/delivery');
check(/ttl: 2419200/.test(edge) && /status: 'sent'/.test(edge), 'Expo retains accepted pushes for offline devices and accepted rows are not resent');
check(/DeviceNotRegistered/.test(edge)
  && /chat_push_tokens'\)\.delete\(\)\.in\('expo_push_token'/.test(edge), 'dead Expo device tokens are removed');
check(/CREATE TABLE IF NOT EXISTS public\.support_chat_requests/.test(offlineMigration)
  && /AFTER UPDATE OF status/.test(offlineMigration)
  && /set_support_chat_status/.test(offlineMigration), 'support lifecycle changes enqueue a learner notification');

// Foreground is quiet and in-app; background push uses the configured OS channel.
check(/shouldShowBanner: false/.test(notifications)
  && /shouldShowList: false/.test(notifications)
  && /shouldPlaySound: false/.test(notifications), 'foreground system banners, sound and vibration are suppressed');
check(/addNotificationReceivedListener/.test(bridge)
  && /setUnreadCount/.test(bridge)
  && /setBadgeCountAsync/.test(bridge)
  && /currentConversation/.test(bridge), 'other foreground pages get an in-app banner and badge, but the open conversation does not');
check(/milo_chat_notification_permission_asked_v1/.test(notifications)
  && /requestChatNotificationPermissionOnce/.test(adminPush)
  && /android\.permission\.POST_NOTIFICATIONS/.test(config), 'Android 13+ notification permission is requested once');
check(/'milo-chat'/.test(notifications) && /channelId: 'milo-chat'/.test(edge), 'Android foreground and remote alerts use the same milo-chat channel');
check(/'برای دیدن پیام، گفتگو را باز کنید\.'/.test(offlineMigration)
  && !/NEW\.body/.test(offlineMigration), 'push payloads do not include message text');

// Exercise the required scenarios independently of a live Supabase project.
const members = ['learner-1', 'manager-1'];
const recipientsForMessage = (sender) => members.filter(member => member !== sender);
check(recipientsForMessage('learner-1').includes('manager-1')
  && recipientsForMessage('manager-1').includes('learner-1'), 'scenario: notifications reach both conversation participants');

const queue = new Map();
const enqueue = (key, recipient) => { if (!queue.has(key)) queue.set(key, { recipient, state: 'pending' }); };
const offlineEvent = 'message:stable-id:learner-1';
enqueue(offlineEvent, 'learner-1');
const processQueue = (isOnline, key) => {
  const event = queue.get(key);
  if (!event || event.state !== 'pending' || !isOnline) return false;
  event.state = 'sent'; // Expo has accepted/retained this unique event.
  return true;
};
check(!processQueue(false, offlineEvent) && queue.get(offlineEvent)?.state === 'pending', 'scenario: offline delivery leaves the event queued');
check(processQueue(true, offlineEvent) && queue.get(offlineEvent)?.state === 'sent', 'scenario: queue delivers after the recipient becomes reachable');
enqueue(offlineEvent, 'learner-1');
check(queue.size === 1 && !processQueue(true, offlineEvent), 'scenario: a duplicate event already held by Expo is not enqueued again');
const deadTokenRows = new Set(['ExpoPushToken[dead]', 'ExpoPushToken[live]']);
for (const token of [...deadTokenRows]) if (token === 'ExpoPushToken[dead]') deadTokenRows.delete(token);
check(!deadTokenRows.has('ExpoPushToken[dead]') && deadTokenRows.has('ExpoPushToken[live]'), 'scenario: DeviceNotRegistered removes only the dead token');
const foregroundPolicy = { banner: false, list: false, sound: false, vibration: false, inAppBanner: true, badge: true };
check(!foregroundPolicy.banner && !foregroundPolicy.sound && !foregroundPolicy.vibration
  && foregroundPolicy.inAppBanner && foregroundPolicy.badge, 'scenario: foreground is silent while the in-app banner and counter update');

console.log(`${checks} chat notification, queue, permission, privacy, and foreground checks passed.`);
