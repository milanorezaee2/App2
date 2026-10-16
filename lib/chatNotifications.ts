import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { RealtimeChannel, Subscription } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { ensureChatIdentity } from './conversations';
import { FEATURES } from './features';
import { adminClient } from './educationAdmin';

export const CHAT_NOTIFICATION_CHANNEL = 'milo-chat';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type ChatNotificationOptions = {
  /**
   * Management builds never create an anonymous chat identity: they wait for
   * the manager login so push tokens belong to the real manager account and
   * registration/message alerts reach the admin phone while it is offline.
   */
  requireSession?: boolean;
};

async function scheduleChatNotification(
  title: string,
  body: string,
  conversationId?: string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: conversationId ? { conversationId, route: `/conversations/human/${conversationId}` } : { route: '/conversations' },
    },
    trigger: null,
  });
}

/** Registers this device for server-side Expo push. Returns true when the
 * server can reach the app while it is closed, so the foreground realtime
 * bridge can skip duplicate local alerts. */
async function registerPushToken(userId: string): Promise<boolean> {
  if (!Device.isDevice || Platform.OS === 'web') return false;
  try {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (!token) return false;
    const { error } = await supabase.from('chat_push_tokens').upsert({
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,expo_push_token' });
    return !error;
  } catch {
    // Realtime/local alerts remain active if this build has no EAS project id yet.
    return false;
  }
}

/** The learner session wins; management builds fall back to the manager session. */
async function resolveSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  if (FEATURES.adminPanel) {
    try {
      const { data: admin } = await adminClient().auth.getSession();
      if (admin.session?.user) return admin.session.user.id;
    } catch {
      // Panel disabled or not configured: no manager identity to register.
    }
  }
  return null;
}

export async function startChatNotifications(
  options: ChatNotificationOptions = {},
): Promise<() => Promise<void>> {
  if (Platform.OS === 'web' || !Device.isDevice) return async () => undefined;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHAT_NOTIFICATION_CHANNEL, {
      name: 'پیام‌ها و درخواست‌های چت',
      description: 'پیام متنی، پیام صوتی و درخواست مخاطب',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: '#2878DE',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return async () => undefined;

  let stopped = false;
  let activeUserId: string | null = null;
  // True once this device's token is stored server-side: Expo push then covers
  // foreground, background and fully-closed states, so the realtime bridge must
  // not schedule a second local alert for the same event.
  let pushCoversThisDevice = false;
  let channels: RealtimeChannel[] = [];

  const teardownUserScope = async () => {
    const current = channels;
    channels = [];
    await Promise.all(current.map(removeChannel));
  };

  const setupUserScope = async (userId: string) => {
    await teardownUserScope();
    if (stopped) return;
    activeUserId = userId;
    pushCoversThisDevice = await registerPushToken(userId);

    const messageChannel = supabase
      .channel(`chat-notifications:messages:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const row = payload.new as { sender_id?: string; conversation_id?: string; message_type?: string; body?: string | null };
        if (!row.conversation_id || row.sender_id === userId) return;
        // Server push already alerts this device (even when the app is closed);
        // a second local alert would only duplicate the banner.
        if (pushCoversThisDevice) return;
        const voice = row.message_type === 'voice';
        void scheduleChatNotification(
          voice ? 'پیام صوتی جدید' : 'پیام جدید',
          voice ? 'یک پیام صوتی جدید دریافت کردید.' : (row.body?.trim().slice(0, 120) || 'یک پیام جدید دریافت کردید.'),
          row.conversation_id,
        );
      })
      .subscribe();

    const contactChannel = supabase
      .channel(`chat-notifications:contacts:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'learning_contacts', filter: `user_id=eq.${userId}` },
        payload => {
          const row = payload.new as { conversation_id?: string };
          if (pushCoversThisDevice) return;
          void scheduleChatNotification('درخواست مخاطب تأیید شد', 'یک گفتگوی خصوصی جدید برای شما فعال شد.', row.conversation_id);
        },
      )
      .subscribe();

    channels = [messageChannel, contactChannel];
  };

  const activate = async () => {
    if (stopped) return;
    let userId = await resolveSessionUserId();
    if (!userId && !options.requireSession) {
      userId = (await ensureChatIdentity()).id;
    }
    if (stopped) return;
    if (!userId) {
      // Management build before manager login: auth listeners below will retry.
      activeUserId = null;
      pushCoversThisDevice = false;
      await teardownUserScope();
      return;
    }
    if (userId === activeUserId) return;
    await setupUserScope(userId);
  };

  await activate();

  const authSubscriptions: Subscription[] = [
    supabase.auth.onAuthStateChange(() => { void activate(); }).data.subscription,
  ];
  if (FEATURES.adminPanel) {
    try {
      authSubscriptions.push(
        adminClient().auth.onAuthStateChange(() => { void activate(); }).data.subscription,
      );
    } catch {
      // Manager session events are best effort outside the panel.
    }
  }

  return async () => {
    stopped = true;
    for (const subscription of authSubscriptions) subscription.unsubscribe();
    await teardownUserScope();
  };
}

async function removeChannel(channel: RealtimeChannel) {
  try { await supabase.removeChannel(channel); } catch { /* cleanup is best effort */ }
}
