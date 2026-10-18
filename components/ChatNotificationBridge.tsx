import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { isSupabaseConfigured } from '@/lib/pairing';
import { startChatNotifications } from '@/lib/chatNotifications';

/** Keeps chat alerts active outside conversation screens and opens the exact
 * conversation when the user taps a notification. */
export function ChatNotificationBridge() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web' || !isSupabaseConfigured()) return;
    let active = true;
    let stop: (() => Promise<void>) | null = null;

    void startChatNotifications().then(cleanup => {
      if (active) stop = cleanup;
      else void cleanup();
    }).catch(() => {
      // A denied permission never blocks app startup or chat itself.
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const conversationId = typeof data.conversationId === 'string' ? data.conversationId : null;
      if (conversationId) {
        router.push({
          pathname: '/conversations/human/[conversationId]',
          params: { conversationId },
        } as never);
      } else if (data.route === '/conversations') {
        router.push('/conversations' as never);
      }
    });

    return () => {
      active = false;
      responseSubscription.remove();
      if (stop) void stop();
    };
  }, [router]);

  return null;
}
