import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel, SupabaseClient, Subscription, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { ensureChatIdentity } from './conversations';
import { MANAGEMENT_BUILD } from './features';
import { adminClient } from './educationAdmin';

export const CHAT_NOTIFICATION_CHANNEL = 'milo-chat';
const PERMISSION_ASKED_KEY = 'milo_chat_notification_permission_asked_v1';

// Shared unread counter so both the in-app banner and navigation tabs update silently in foreground.
let unreadChatCount = 0;
const unreadListeners = new Set<(count: number) => void>();

export function getUnreadChatCount(): number {
  return unreadChatCount;
}

export function setUnreadChatCount(next: number): number {
  unreadChatCount = Math.max(0, Math.floor(next));
  for (const listener of unreadListeners) listener(unreadChatCount);
  void Notifications.setBadgeCountAsync(unreadChatCount).catch(() => undefined);
  return unreadChatCount;
}

export function incrementUnreadChatCount(): number {
  return setUnreadChatCount(unreadChatCount + 1);
}

export function clearUnreadChatCount(): void {
  setUnreadChatCount(0);
}

export function subscribeUnreadChatCount(listener: (count: number) => void): () => void {
  unreadListeners.add(listener);
  listener(unreadChatCount);
  return () => {
    unreadListeners.delete(listener);
  };
}

// Foreground alerts are rendered as a quiet in-app banner by the bridge.
// Background/quit alerts use the OS channel and the sound in the server payload.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export type ChatNotificationOptions = { requireSession?: boolean };

export async function requestChatNotificationPermissionOnce(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;

  const alreadyAsked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
  if (alreadyAsked === 'true') return false;
  await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function notificationClient(): SupabaseClient {
  return MANAGEMENT_BUILD ? adminClient() : supabase;
}

async function registerPushToken(client: SupabaseClient, userId: string): Promise<boolean> {
  if (!Device.isDevice || Platform.OS === 'web') return false;
  try {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return false;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return false;
    const { error } = await client.from('chat_push_tokens').upsert({
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,expo_push_token' });
    return !error;
  } catch {
    return false;
  }
}

async function resolveNotificationUser(client: SupabaseClient, requireSession: boolean): Promise<User | null> {
  const { data } = await client.auth.getSession();
  if (data.session?.user) return data.session.user;
  if (requireSession || MANAGEMENT_BUILD) return null;
  return ensureChatIdentity();
}

type QueuedFallbackAlert = {
  title: string;
  body: string;
  eventId: string;
  conversationId?: string;
};

const deliveredFallbackEvents = new Set<string>();
const pendingOfflineFallbackQueue = new Map<string, QueuedFallbackAlert>();

async function isInternetReachable(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

async function deliverQuietFallbackNow(alert: QueuedFallbackAlert): Promise<void> {
  if (deliveredFallbackEvents.has(alert.eventId)) return;
  deliveredFallbackEvents.add(alert.eventId);
  if (deliveredFallbackEvents.size > 200) {
    const oldest = deliveredFallbackEvents.values().next().value;
    if (oldest) deliveredFallbackEvents.delete(oldest);
  }
  await Notifications.scheduleNotificationAsync({
    identifier: alert.eventId,
    content: {
      title: alert.title,
      body: alert.body,
      data: {
        eventId: alert.eventId,
        ...(alert.conversationId
          ? { conversationId: alert.conversationId, route: `/conversations/human/${alert.conversationId}` }
          : { route: '/conversations' }),
      },
    },
    trigger: null,
  });
}

async function flushOfflineFallbackQueue(): Promise<void> {
  if (!pendingOfflineFallbackQueue.size) return;
  if (!(await isInternetReachable())) return;
  const queued = [...pendingOfflineFallbackQueue.values()];
  pendingOfflineFallbackQueue.clear();
  for (const item of queued) {
    await deliverQuietFallbackNow(item);
  }
}

async function scheduleQuietFallback(
  title: string,
  body: string,
  eventId: string,
  conversationId?: string,
): Promise<void> {
  if (deliveredFallbackEvents.has(eventId) || pendingOfflineFallbackQueue.has(eventId)) return;
  const item: QueuedFallbackAlert = { title, body, eventId, conversationId };
  if (!(await isInternetReachable())) {
    pendingOfflineFallbackQueue.set(eventId, item);
    return;
  }
  await deliverQuietFallbackNow(item);
}

export async function startChatNotifications(
  options: ChatNotificationOptions = {},
): Promise<() => Promise<void>> {
  if (Platform.OS === 'web' || !Device.isDevice) return async () => undefined;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHAT_NOTIFICATION_CHANNEL, {
      name: 'پیام‌ها و درخواست‌های چت',
      description: 'پیام‌ها و درخواست‌های پشتیبانی',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: '#2878DE',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }
  if (!(await requestChatNotificationPermissionOnce())) return async () => undefined;

  const client = notificationClient();
  const channels: RealtimeChannel[] = [];
  const authSubscriptions: Subscription[] = [];
  let activeUserId: string | null = null;
  let pushCoversThisDevice = false;
  let stopped = false;

  const netSubscription = Network.addNetworkStateListener(state => {
    if (state.isConnected !== false && state.isInternetReachable !== false) {
      void flushOfflineFallbackQueue();
    }
  });

  const clearChannels = async () => {
    const oldChannels = channels.splice(0);
    await Promise.all(oldChannels.map(async channel => {
      try { await client.removeChannel(channel); } catch { /* cleanup is best effort */ }
    }));
  };

  const activate = async () => {
    if (stopped) return;
    const user = await resolveNotificationUser(client, options.requireSession ?? false);
    if (stopped) return;
    if (!user) {
      activeUserId = null;
      pushCoversThisDevice = false;
      await clearChannels();
      return;
    }
    if (activeUserId === user.id) return;
    await clearChannels();
    activeUserId = user.id;
    pushCoversThisDevice = await registerPushToken(client, user.id);

    const messageChannel = client
      .channel(`chat-notifications:messages:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const row = payload.new as {
          id?: string; sender_id?: string; conversation_id?: string; message_type?: string;
        };
        if (!row.id || !row.conversation_id || row.sender_id === user.id || pushCoversThisDevice) return;
        void scheduleQuietFallback(
          row.message_type === 'voice' ? 'پیام صوتی تازه' : 'پیام تازه',
          'برای دیدن پیام، گفتگو را باز کنید.',
          `message:${row.id}:${user.id}`,
          row.conversation_id,
        );
      })
      .subscribe();
    channels.push(messageChannel);

    const contactChannel = client
      .channel(`chat-notifications:contacts:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'learning_contacts', filter: `user_id=eq.${user.id}`,
      }, payload => {
        const row = payload.new as { conversation_id?: string };
        if (!row.conversation_id || pushCoversThisDevice) return;
        const eventId = MANAGEMENT_BUILD
          ? `support-request:${row.conversation_id}:${user.id}`
          : `contact:${row.conversation_id}:${user.id}`;
        void scheduleQuietFallback(
          MANAGEMENT_BUILD ? 'درخواست چت تازه' : 'گفتگوی تازه',
          MANAGEMENT_BUILD ? 'یک زبان‌آموز درخواست پشتیبانی دارد.' : 'یک گفتگوی تازه برای شما فعال شد.',
          eventId,
          row.conversation_id,
        );
      })
      .subscribe();
    channels.push(contactChannel);

    const supportStatusChannel = client
      .channel(`chat-notifications:support-status:${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'support_chat_requests', filter: `learner_id=eq.${user.id}`,
      }, payload => {
        const row = payload.new as { conversation_id?: string; status?: string; status_version?: number };
        if (!row.conversation_id || pushCoversThisDevice) return;
        const eventId = `support-status:${row.conversation_id}:${row.status_version ?? 0}:${user.id}`;
        void scheduleQuietFallback(
          'وضعیت درخواست پشتیبانی تغییر کرد',
          row.status === 'resolved' ? 'درخواست شما رسیدگی شد.' : 'درخواست شما دوباره فعال شد.',
          eventId,
          row.conversation_id,
        );
      })
      .subscribe();
    channels.push(supportStatusChannel);
  };

  const authChange = client.auth.onAuthStateChange(() => { void activate(); }).data.subscription;
  authSubscriptions.push(authChange);
  await activate();

  return async () => {
    stopped = true;
    netSubscription.remove();
    for (const subscription of authSubscriptions) subscription.unsubscribe();
    await clearChannels();
  };
}
