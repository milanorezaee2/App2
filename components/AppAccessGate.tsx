import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { ShieldX, RefreshCw } from 'lucide-react-native';
import { MANAGEMENT_BUILD } from '@/lib/features';
import { fetchAppAccess, loadCachedAppAccess, type AppAccessState } from '@/lib/appAccess';
import { isSupabaseConfigured } from '@/lib/supabaseConfig';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';

export function AppAccessGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AppAccessState | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (MANAGEMENT_BUILD || !isSupabaseConfigured()) return;
    setChecking(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = data.session?.user.id;
      if (!userId) {
        setAccess(null);
        return;
      }
      const cached = await loadCachedAppAccess(userId);
      if (cached) setAccess(cached);
      const remote = await fetchAppAccess(userId);
      if (remote) setAccess(remote);
      setError('');
    } catch {
      setError('برای دریافت وضعیت دسترسی، اتصال اینترنت را بررسی و دوباره تلاش کنید.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const authSubscription = supabase.auth.onAuthStateChange(() => {
      // Defer the fetch until Supabase finishes its auth callback transaction.
      setTimeout(() => void refresh(), 0);
    });
    const appSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 45_000);
    return () => {
      authSubscription.data.subscription.unsubscribe();
      appSubscription.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  if (access?.blocked) {
    return (
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.icon}><ShieldX size={34} color="#B42318" /></View>
          <Text accessibilityRole="header" style={styles.title}>دسترسی این حساب موقتاً بسته است</Text>
          <Text style={styles.description}>{access.reason || 'مدیر دسترسی برنامه را موقتاً متوقف کرده است. برای بازگشت، با پشتیبانی Milo تماس بگیرید.'}</Text>
          <Pressable accessibilityRole="button" disabled={checking} onPress={() => void refresh()} style={[styles.button, checking && styles.disabled]}>
            {checking ? <ActivityIndicator color="#FFFFFF" /> : <RefreshCw size={17} color="#FFFFFF" />}
            <Text style={styles.buttonText}>بررسی دوباره</Text>
          </Pressable>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Text style={styles.footnote}>اگر مدیر دسترسی را دوباره فعال کرده، به اینترنت وصل شوید و «بررسی دوباره» را بزنید.</Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100%', backgroundColor: '#F4F8FD', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  card: { width: '100%', maxWidth: 450, padding: Spacing.xl, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F7', alignItems: 'center', gap: 13 },
  icon: { width: 68, height: 68, borderRadius: 23, backgroundColor: '#FFF0EF', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Typography.boldFontFamily, fontSize: 20, color: '#102A56', textAlign: 'center' },
  description: { fontFamily: Typography.fontFamily, fontSize: 13, lineHeight: 22, color: '#52667C', textAlign: 'center' },
  button: { minWidth: 170, minHeight: 46, paddingHorizontal: 18, borderRadius: Radius.lg, backgroundColor: Colors.primary[500], flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { fontFamily: Typography.boldFontFamily, fontSize: 12, color: '#FFFFFF' },
  error: { fontFamily: Typography.fontFamily, fontSize: 11, lineHeight: 18, color: '#B42318', textAlign: 'center' },
  footnote: { fontFamily: Typography.fontFamily, fontSize: 10, lineHeight: 18, color: '#7D8C9E', textAlign: 'center' },
  disabled: { opacity: .55 },
});
