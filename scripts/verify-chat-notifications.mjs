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
check(/table: 'learning_contacts'/.test(notifications), 'accepted contact requests receive a notification');
check(/addNotificationResponseReceivedListener/.test(bridge) && /conversationId/.test(bridge), 'tapping an alert opens the exact conversation');
check(/CREATE TABLE IF NOT EXISTS public\.chat_push_tokens/.test(migration), 'push token storage migration exists');
check(/ENABLE ROW LEVEL SECURITY/.test(migration) && /user_id = auth\.uid\(\)/.test(migration), 'push tokens are protected by owner RLS');
check(/conversation_members/.test(edge) && /chat_push_tokens/.test(edge), 'server push resolves only conversation recipients');
check(/exp\.host\/--\/api\/v2\/push\/send/.test(edge), 'server push uses Expo delivery');
check(/CHAT_WEBHOOK_SECRET/.test(edge), 'database webhook endpoint requires a dedicated secret');

console.log(`${checks} chat notification and dynamic keyboard checks passed.`);
