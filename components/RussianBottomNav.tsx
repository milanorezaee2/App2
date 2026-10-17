import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { BookOpen, ClipboardList, MessageCircle, RefreshCw, Volume2 } from 'lucide-react-native';
import { Radius, Typography } from '@/lib/theme';
import { EnglishPalette as Palette } from '@/components/EnglishSupplementTask';

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

  return (
    <View style={styles.shell}>
      {items.map(item => {
        const active = item.path === '/learn/ru'
          ? pathname === '/learn/ru'
            || (pathname.startsWith('/learn/ru/')
              && !pathname.startsWith('/learn/ru/library')
              && !pathname.startsWith('/learn/ru/pronunciation')
              && !pathname.startsWith('/learn/ru/review'))
          : pathname === item.path || pathname.startsWith(`${item.path}/`);
        const Icon = item.icon;
        return (
          <Pressable
            key={item.path}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={styles.item}
            onPress={() => router.replace(item.path as never)}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon size={18} color={active ? Palette.primary : Palette.muted} strokeWidth={active ? 2.4 : 2} />
            </View>
            <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 62,
    marginHorizontal: 10,
    marginBottom: 8,
    paddingTop: 5,
    paddingBottom: 6,
    paddingHorizontal: 5,
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
  item: { flex: 1, minWidth: 48, alignItems: 'center', gap: 1 },
  iconWrap: { width: 36, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: Palette.primarySoft },
  label: { fontFamily: Typography.fontFamily, fontSize: 10, color: Palette.muted, textAlign: 'center' },
  labelActive: { color: Palette.primaryDark, fontWeight: Typography.weights.bold },
});
