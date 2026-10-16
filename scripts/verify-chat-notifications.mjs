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
const migration = read('supabase/migrations/202610140001_chat_push_notifications.sql');
const offlinePush = read('supabase/migrations/202610160001_offline_push_triggers.sql');
const edge = read('supabase/functions/chat-push/index.ts');
const layout = read('app/_layout.tsx');
const humanChat = read('app/conversations/human/[conversationId].tsx');
const emmaChat = read('app/conversations/emma.tsx');

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
check(/table: 'learning_contacts'/.test(notifications), 'accepted contact requests receive a notification');
check(/addNotificationResponseReceivedListener/.test(bridge) && /conversationId/.test(bridge), 'tapping an alert opens the exact conversation');
check(/CREATE TABLE IF NOT EXISTS public\.chat_push_tokens/.test(migration), 'push token storage migration exists');
check(/ENABLE ROW LEVEL SECURITY/.test(migration) && /user_id = auth\.uid\(\)/.test(migration), 'push tokens are protected by owner RLS');
check(/conversation_members/.test(edge) && /chat_push_tokens/.test(edge), 'server push resolves only conversation recipients');
check(/exp\.host\/--\/api\/v2\/push\/send/.test(edge), 'server push uses Expo delivery');
check(/CHAT_WEBHOOK_SECRET/.test(edge), 'database webhook endpoint requires a dedicated secret');

// Offline delivery: database triggers push through Expo even when the
// receiving app (learner or manager) is closed or the admin is offline.
check(/CREATE TRIGGER chat_push_on_message/.test(offlinePush) && /AFTER INSERT ON public\.messages/.test(offlinePush), 'new messages trigger server push');
check(/CREATE TRIGGER chat_push_on_registration/.test(offlinePush) && /AFTER INSERT ON public\.app_user_profiles/.test(offlinePush), 'new registrations trigger server push');
check(/education_admins/.test(offlinePush) && /chat_push_tokens/.test(offlinePush), 'registration push resolves manager tokens server-side');
check(/http_post/.test(offlinePush) && /exp\.host\/--\/api\/v2\/push\/send/.test(offlinePush), 'triggers deliver through the Expo push service');
check(/SECURITY DEFINER/.test(offlinePush), 'push trigger bypasses RLS safely as owner');
check(/app_user_profiles/.test(edge) && /route: '\/admin'/.test(edge), 'edge webhook also routes registrations to the manager panel');

// Both builds register push tokens; the manager APK waits for manager login.
check(!/!IS_ADMIN_APP && <ChatNotificationBridge/.test(layout), 'notification bridge mounts in learner and admin builds');
check(/requireSession/.test(notifications) && /adminClient\(\)/.test(notifications), 'manager session registers its own push tokens');
check(/pushCoversThisDevice/.test(notifications), 'foreground realtime skips alerts already covered by push');

// The composer stack rides fully above the keyboard on every Android version.
check(/KeyboardCompensationView/.test(humanChat) && !/KeyboardAvoidingView/.test(humanChat), 'human chat composer uses keyboard compensation');
check(/KeyboardCompensationView/.test(emmaChat) && !/KeyboardAvoidingView/.test(emmaChat), 'Emma composer uses keyboard compensation');
check(/closedWindowHeight/.test(keyboardRuntime) && /useReanimatedKeyboardAnimation/.test(keyboardRuntime), 'compensation subtracts system resize to avoid double avoidance');

console.log(`${checks} chat notification and dynamic keyboard checks passed.`);
