import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { isSupabaseConfigured } from '@/lib/pairing';
import { MANAGEMENT_BUILD } from '@/lib/features';
import { startChatNotifications } from '@/lib/chatNotifications';

type Banner = { title: string; body: string; conversationId: string | null };

/** Server push opens chats from the background; foreground pushes become a
 * quiet in-app banner and never interrupt another screen with sound/vibration. */
export function ChatNotificationBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentEventIds = useRef(new Set<string>());

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    let stop: (() => Promise<void>) | null = null;

    if (isSupabaseConfigured()) {
      void startChatNotifications({ requireSession: MANAGEMENT_BUILD }).then(cleanup => {
        if (active) stop = cleanup;
        else void cleanup();
      }).catch(() => {
        // Denied permissions, missing EAS config, or no manager session never block startup.
      });
    }

    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      if (AppState.currentState !== 'active') return;
      const content = notification.request.content;
      const data = content.data || {};
      const eventId = typeof data.eventId === 'string' ? data.eventId : notification.request.identifier;
      if (recentEventIds.current.has(eventId)) return;
      recentEventIds.current.add(eventId);
      if (recentEventIds.current.size > 100) {
        recentEventIds.current = new Set([...recentEventIds.current].slice(-50));
      }

      const conversationId = typeof data.conversationId === 'string' ? data.conversationId : null;
      const currentConversation = conversationId
        ? `/conversations/human/${conversationId}`
        : null;
      if (currentConversation && pathname.replace(/\/$/, '') === currentConversation) return;

      setUnreadCount(previous => {
        const next = previous + 1;
        void Notifications.setBadgeCountAsync(next).catch(() => undefined);
        return next;
      });
      setBanner({
        title: content.title || 'پیام تازه',
        body: content.body || 'برای دیدن پیام، گفتگو را باز کنید.',
        conversationId,
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setBanner(null), 7000);
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
      } else if (data.route === '/admin') {
        router.push('/admin' as never);
      }
      setUnreadCount(0);
      void Notifications.setBadgeCountAsync(0).catch(() => undefined);
      setBanner(null);
    });

    return () => {
      active = false;
      receivedSubscription.remove();
      responseSubscription.remove();
      if (timer.current) clearTimeout(timer.current);
      if (stop) void stop();
    };
  }, [pathname, router]);

  if (!banner) return null;
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${banner.title}. ${banner.body}`}
        onPress={() => {
          if (banner.conversationId) {
            router.push({
              pathname: '/conversations/human/[conversationId]',
              params: { conversationId: banner.conversationId },
            } as never);
          } else {
            router.push('/conversations' as never);
          }
          setUnreadCount(0);
          void Notifications.setBadgeCountAsync(0).catch(() => undefined);
          setBanner(null);
        }}
        style={styles.card}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>{banner.title}</Text>
          <Text style={styles.body}>{banner.body}</Text>
        </View>
        {unreadCount > 0 && (
          <View style={styles.counter}><Text style={styles.counterText}>{unreadCount > 99 ? '۹۹+' : unreadCount}</Text></View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 10, left: 12, right: 12, zIndex: 1000, elevation: 30 },
  card: {
    minHeight: 68, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E7FA',
    shadowColor: '#123E76', shadowOpacity: 0.16, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
  copy: { flex: 1, gap: 3 },
  title: { fontFamily: 'Vazir-Bold', fontSize: 13, color: '#123E76', textAlign: 'right' },
  body: { fontFamily: 'Vazir', fontSize: 11, color: '#52667C', textAlign: 'right' },
  counter: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2878DE' },
  counterText: { color: '#FFFFFF', fontFamily: 'Vazir-Bold', fontSize: 11 },
});
