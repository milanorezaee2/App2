import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { ensureChatIdentity } from './conversations';

export const CHAT_NOTIFICATION_CHANNEL = 'milo-chat';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice || Platform.OS === 'web') return;
  try {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (!token) return;
    await supabase.from('chat_push_tokens').upsert({
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,expo_push_token' });
  } catch {
    // Realtime/local alerts remain active if this build has no EAS project id yet.
  }
}

export async function startChatNotifications(): Promise<() => Promise<void>> {
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

  const user = await ensureChatIdentity();
  await registerPushToken(user.id);

  const messageChannel = supabase
    .channel(`chat-notifications:messages:${user.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const row = payload.new as { sender_id?: string; conversation_id?: string; message_type?: string; body?: string | null };
      if (!row.conversation_id || row.sender_id === user.id) return;
      const voice = row.message_type === 'voice';
      void scheduleChatNotification(
        voice ? 'پیام صوتی جدید' : 'پیام جدید',
        voice ? 'یک پیام صوتی جدید دریافت کردید.' : (row.body?.trim().slice(0, 120) || 'یک پیام جدید دریافت کردید.'),
        row.conversation_id,
      );
    })
    .subscribe();

  const contactChannel = supabase
    .channel(`chat-notifications:contacts:${user.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'learning_contacts', filter: `user_id=eq.${user.id}` },
      payload => {
        const row = payload.new as { conversation_id?: string };
        void scheduleChatNotification('درخواست مخاطب تأیید شد', 'یک گفتگوی خصوصی جدید برای شما فعال شد.', row.conversation_id);
      },
    )
    .subscribe();

  return async () => {
    await Promise.all([removeChannel(messageChannel), removeChannel(contactChannel)]);
  };
}

async function removeChannel(channel: RealtimeChannel): Promise<void> {
  try { await supabase.removeChannel(channel); } catch { /* cleanup is best effort */ }
}
