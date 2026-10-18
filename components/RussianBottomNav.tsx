import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { BookOpen, ClipboardList, MessageCircle, RefreshCw, Volume2 } from 'lucide-react-native';
import { Radius, Typography } from '@/lib/theme';
import { EnglishPalette as Palette } from '@/components/EnglishSupplementTask';
import { getChatUnreadCount, subscribeToChatUnreadCount } from '@/lib/chatNotificationState';

// Right-to-left order (like the English navigation): Learning first on the right.
const items = [
  { path: '/learn/ru', label: 'یادگیری', icon: BookOpen },
  { path: '/learn/ru/library', label: 'درس‌ها', icon: ClipboardList },
  { path: '/learn/ru/pronunciation', label: 'تلفظ', icon: Volume2 },
  { path: '/conversations', label: 'مکالمه', icon: MessageCircle },
  { path: '/learn/ru/review', label: 'مرور', icon: RefreshCw },
] as const;

export function RussianBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [chatUnreadCount, setChatUnreadCount] = useState(getChatUnreadCount());

  useEffect(() => subscribeToChatUnreadCount(setChatUnreadCount), []);

  return (
    <View style={styles.shell}>
      {items.map(item => {
        const active = item.path === '/learn/ru' ? pathname === '/learn/ru' : pathname.startsWith(item.path);
        const Icon = item.icon;
        return (
          <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} style={styles.item} onPress={() => router.replace(item.path as never)}>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon size={19} color={active ? Palette.primary : Palette.muted} strokeWidth={active ? 2.4 : 2} />
              {item.path === '/conversations' && chatUnreadCount > 0 && (
                <View accessibilityLabel={`${chatUnreadCount} پیام خوانده‌نشده`} style={styles.badge}>
                  <Text style={styles.badgeText}>{chatUnreadCount > 9 ? '۹+' : chatUnreadCount.toLocaleString('fa-IR')}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { minHeight: 68, marginHorizontal: 14, marginBottom: 38, paddingTop: 7, paddingBottom: 9, paddingHorizontal: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-around', backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, borderRadius: 22, shadowColor: '#1D2345', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  item: { flex: 1, minWidth: 52, alignItems: 'center', gap: 2 },
  iconWrap: { width: 42, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  iconWrapActive: { backgroundColor: Palette.primarySoft },
  badge: { position: 'absolute', top: -4, right: 1, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D63F52', borderWidth: 1, borderColor: Palette.surface },
  badgeText: { color: '#FFFFFF', fontFamily: Typography.boldFontFamily, fontSize: 8, lineHeight: 11, textAlign: 'center' },
  label: { fontFamily: Typography.fontFamily, fontSize: 12, color: Palette.muted },
  labelActive: { color: Palette.primaryDark, fontWeight: Typography.weights.bold },
});
