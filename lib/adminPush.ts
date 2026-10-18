import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { adminClient } from './educationAdmin';
import { CHAT_NOTIFICATION_CHANNEL, requestChatNotificationPermissionOnce } from './chatNotifications';

/**
 * Registers the education-admin device for offline push alerts (new learner
 * registrations and support/chat messages). Runs only from the admin panel,
 * using the admin session, so the token row belongs to the manager's user id.
 */
export async function registerAdminPushToken(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    const { data: sessionData } = await adminClient().auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHAT_NOTIFICATION_CHANNEL, {
        name: 'پیام‌ها و درخواست‌های چت',
        description: 'پیام متنی، پیام صوتی و ثبت‌نام کاربر جدید',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 100, 180],
        lightColor: '#2878DE',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    if (!(await requestChatNotificationPermissionOnce())) return;

    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return;

    await adminClient().from('chat_push_tokens').upsert({
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,expo_push_token' });
  } catch {
    // Push is best effort; the panel works without it.
  }
}
