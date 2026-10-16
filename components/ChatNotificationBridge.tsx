import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { isSupabaseConfigured } from '@/lib/pairing';
import { startChatNotifications } from '@/lib/chatNotifications';

const IS_ADMIN_APP = Constants.expoConfig?.extra?.appRole === 'admin'
  || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';

/** Routes a tapped alert only to first-party screens. */
function routeForData(data: Record<string, unknown>): { pathname: string; params?: Record<string, string> } | null {
  const conversationId = typeof data.conversationId === 'string' ? data.conversationId : null;
  if (conversationId) {
    return { pathname: '/conversations/human/[conversationId]', params: { conversationId } };
  }
  if (data.route === '/conversations') return { pathname: '/conversations' };
  if (data.route === '/admin') return { pathname: '/admin' };
  return null;
}

/** Keeps chat alerts active outside conversation screens and opens the exact
 * conversation (or the manager panel for registrations) on tap. Mounted in
 * both builds so the admin phone also registers for offline push. */
export function ChatNotificationBridge() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web' || !isSupabaseConfigured()) return;
    let active = true;
    let stop: (() => Promise<void>) | null = null;

    void startChatNotifications({ requireSession: IS_ADMIN_APP }).then(cleanup => {
      if (active) stop = cleanup;
      else void cleanup();
    }).catch(() => {
      // A denied permission never blocks app startup or chat itself.
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
      const route = routeForData(data);
      if (!route) return;
      router.push({ pathname: route.pathname, params: route.params } as never);
    });

    return () => {
      active = false;
      responseSubscription.remove();
      if (stop) void stop();
    };
  }, [router]);

  return null;
}
