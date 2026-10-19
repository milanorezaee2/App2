import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { BookOpen, BookOpenCheck, MessageCircle, RefreshCw, Volume2 } from 'lucide-react-native';
import { Radius, Typography } from '@/lib/theme';
import { GermanPalette as Palette } from '@/components/germanTheme';
import { getChatUnreadCount, subscribeToChatUnreadCount } from '@/lib/chatNotificationState';

const items = [
  { path: '/learn/de', label: 'یادگیری', icon: BookOpen },
  { path: '/learn/de/library', label: 'کتابخانه', icon: BookOpenCheck },
  { path: '/learn/de/pronunciation', label: 'تلفظ', icon: Volume2 },
  { path: '/conversations', label: 'مکالمه', icon: MessageCircle },
  { path: '/learn/de/reviews', label: 'مرور', icon: RefreshCw },
] as const;

export function GermanBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [chatUnreadCount, setChatUnreadCount] = useState(getChatUnreadCount());

  useEffect(() => subscribeToChatUnreadCount(setChatUnreadCount), []);

  return (
    <View style={styles.shell}>
      {items.map(item => {
        const active = item.path === '/learn/de'
          ? pathname === '/learn/de' || pathname.startsWith('/learn/de/')
            && !pathname.startsWith('/learn/de/library')
            && !pathname.startsWith('/learn/de/pronunciation')
            && !pathname.startsWith('/learn/de/review')
          : pathname.startsWith(item.path);
        const Icon = item.icon;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={item.path}
            style={styles.item}
            onPress={() => router.replace(item.path as never)}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon size={19} color={active ? Palette.primary : Palette.muted} strokeWidth={active ? 2.4 : 2} />
              {item.path === '/conversations' && chatUnreadCount > 0 && <View accessibilityLabel={`${chatUnreadCount} پیام خوانده‌نشده`} style={styles.badge}><Text style={styles.badgeText}>{chatUnreadCount > 9 ? '۹+' : chatUnreadCount.toLocaleString('fa-IR')}</Text></View>}
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
    minHeight: 60,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingTop: 5,
    paddingBottom: 6,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 22,
    shadowColor: '#173E34',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  item: { flex: 1, minWidth: 52, alignItems: 'center', gap: 2 },
  iconWrap: { width: 42, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: { position: 'absolute', top: -4, right: 1, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D63F52', borderWidth: 1, borderColor: Palette.surface },
  badgeText: { color: '#FFFFFF', fontFamily: Typography.boldFontFamily, fontSize: 8, lineHeight: 11, textAlign: 'center' },
  iconWrapActive: { backgroundColor: Palette.primarySoft },
  label: { fontFamily: Typography.fontFamily, fontSize: 12, color: Palette.muted },
  labelActive: { color: Palette.primaryDark, fontWeight: Typography.weights.bold },
});
