import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { BookOpen, ClipboardList, Home, MessageCircle, RefreshCw, Volume2 } from 'lucide-react-native';
import { Radius, Typography } from '@/lib/theme';
import { EnglishPalette as Palette } from '@/components/EnglishSupplementTask';
import { getChatUnreadCount, subscribeToChatUnreadCount } from '@/lib/chatNotificationState';
import { useEffect, useState } from 'react';

export type LearningLanguage = 'en' | 'de' | 'ru';

const routes: Record<LearningLanguage, { home: string; pronunciation: string; library: string; review: string }> = {
  en: { home: '/lang', pronunciation: '/learn/en/pronunciation', library: '/lang/library', review: '/review' },
  de: { home: '/learn/de', pronunciation: '/learn/de/pronunciation', library: '/learn/de/library', review: '/learn/de/reviews' },
  ru: { home: '/learn/ru', pronunciation: '/learn/ru/pronunciation', library: '/learn/ru/library', review: '/learn/ru/review' },
};

/** One shared floating navigation design for English, German and Russian. */
export function LanguageBottomNav({ language }: { language: LearningLanguage }) {
  const pathname = usePathname();
  const router = useRouter();
  const [chatUnreadCount, setChatUnreadCount] = useState(getChatUnreadCount());
  const route = routes[language];
  const items = [
    { path: '/languages', label: 'خانه', icon: Home },
    { path: route.home, label: 'یادگیری', icon: BookOpen },
    { path: route.pronunciation, label: 'تلفظ', icon: Volume2 },
    { path: '/conversations', label: 'مکالمه', icon: MessageCircle },
    { path: route.library, label: 'درس‌ها', icon: ClipboardList },
    { path: route.review, label: 'مرور', icon: RefreshCw },
  ];

  useEffect(() => subscribeToChatUnreadCount(setChatUnreadCount), []);

  return (
    <View style={styles.shell}>
      {items.map(item => {
        const active = item.path === route.home
          ? pathname === route.home || (pathname.startsWith(`${route.home}/`)
            && pathname !== route.library && !pathname.startsWith(`${route.library}/`)
            && pathname !== route.pronunciation && !pathname.startsWith(`${route.pronunciation}/`)
            && pathname !== route.review && !pathname.startsWith(`${route.review}/`))
          : pathname === item.path || pathname.startsWith(`${item.path}/`);
        const Icon = item.icon;
        return (
          <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} style={styles.item} onPress={() => router.replace(item.path as never)}>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon size={19} color={active ? Palette.primary : Palette.muted} strokeWidth={active ? 2.4 : 2} />
              {item.path === '/conversations' && chatUnreadCount > 0 ? (
                <View accessibilityLabel={`${chatUnreadCount} پیام خوانده‌نشده`} style={styles.badge}>
                  <Text style={styles.badgeText}>{chatUnreadCount > 9 ? '۹+' : chatUnreadCount.toLocaleString('fa-IR')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row-reverse',
    direction: 'ltr',
    minHeight: 68,
    marginHorizontal: 14,
    marginBottom: Platform.OS === 'web' ? 14 : 38,
    paddingTop: 7,
    paddingBottom: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 22,
    shadowColor: '#1D2345',
    shadowOpacity: .1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  item: { flex: 1, minWidth: 48, alignItems: 'center', gap: 2 },
  iconWrap: { width: 42, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  iconWrapActive: { backgroundColor: Palette.primarySoft },
  badge: { position: 'absolute', top: -4, right: 1, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D63F52', borderWidth: 1, borderColor: Palette.surface },
  badgeText: { color: '#FFFFFF', fontFamily: Typography.boldFontFamily, fontSize: 8, lineHeight: 11, textAlign: 'center' },
  label: { fontFamily: Typography.fontFamily, fontSize: 12, fontWeight: '400', color: Palette.muted, writingDirection: 'rtl' },
  labelActive: { color: Palette.primaryDark, fontWeight: Typography.weights.bold },
});
