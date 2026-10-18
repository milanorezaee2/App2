import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { BookOpen, MessageCircle, RefreshCw, Volume2 } from 'lucide-react-native';
import { Radius, Typography } from '@/lib/theme';
import { EnglishPalette as Palette } from '@/components/EnglishSupplementTask';
import { getUnreadChatCount, subscribeUnreadChatCount } from '@/lib/chatNotifications';
import { toPersianDigits } from '@/lib/format';

const items = [
  { path: '/lang', label: 'یادگیری', icon: BookOpen },
  { path: '/learn/en/pronunciation', label: 'تلفظ', icon: Volume2 },
  { path: '/conversations', label: 'مکالمه', icon: MessageCircle },
  { path: '/review', label: 'مرور', icon: RefreshCw },
] as const;

export function AppBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(getUnreadChatCount());

  useEffect(() => subscribeUnreadChatCount(setUnreadCount), []);

  return (
    <View style={styles.shell}>
      {items.map((item) => {
        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
        const Icon = item.icon;
        const showBadge = item.path === '/conversations' && unreadCount > 0 && !active;
        return (
          <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} style={styles.item} onPress={() => router.replace(item.path as never)}>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon size={19} color={active ? Palette.primary : Palette.muted} strokeWidth={active ? 2.4 : 2} />
              {showBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '۹۹+' : toPersianDigits(unreadCount)}</Text>
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
    shadowColor: '#1D2345',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  item: { flex: 1, minWidth: 52, alignItems: 'center', gap: 2 },
  iconWrap: {
    width: 42,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: Palette.primarySoft },
  badge: {
    position: 'absolute',
    top: -3,
    left: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2878DE',
  },
  badgeText: {
    fontFamily: 'Vazir-Bold',
    fontSize: 9,
    lineHeight: 12,
    color: '#FFFFFF',
  },
  label: { fontFamily: Typography.fontFamily, fontSize: 12, color: Palette.muted },
  labelActive: { color: Palette.primaryDark, fontWeight: Typography.weights.bold },
});
