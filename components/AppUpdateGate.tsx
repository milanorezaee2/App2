import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Download, RefreshCw, ShieldAlert, X } from 'lucide-react-native';
import { CURRENT_APP_PACKAGE, CURRENT_APP_VERSION, fetchReleasePolicy, isAndroidUpdateSupported, loadCachedReleasePolicy, shouldForceUpdate, shouldOfferUpdate, type AppReleasePolicy } from '@/lib/appUpdate';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';

export function AppUpdateGate({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<AppReleasePolicy | null>(null);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAndroidUpdateSupported()) {
      setChecked(true);
      return;
    }
    try {
      const next = await fetchReleasePolicy(CURRENT_APP_PACKAGE);
      setPolicy(next);
      setError('');
      setDismissed(false);
    } catch {
      setError('وضعیت به‌روزرسانی آنلاین بررسی نشد؛ اتصال اینترنت را بررسی کنید.');
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!isAndroidUpdateSupported()) return;
    let active = true;
    void loadCachedReleasePolicy(CURRENT_APP_PACKAGE).then(cached => {
      if (active && cached) setPolicy(cached);
    }).finally(() => {
      if (active) void refresh();
    });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 60_000);
    return () => {
      active = false;
      subscription.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  const openUpdate = async () => {
    if (!policy?.apk_url || opening) return;
    setOpening(true);
    setError('');
    try {
      await Linking.openURL(policy.apk_url);
    } catch {
      setError('بازکردن لینک دانلود انجام نشد. دوباره تلاش کنید.');
    } finally {
      setOpening(false);
    }
  };

  if (!checked && !policy) return <>{children}</>;

  const required = shouldForceUpdate(policy, CURRENT_APP_VERSION);
  const optional = !required && shouldOfferUpdate(policy, CURRENT_APP_VERSION) && !dismissed;

  if (required) {
    return (
      <View style={styles.lockRoot}>
        <View style={styles.lockCard}>
          <View style={styles.lockIcon}><ShieldAlert size={34} color="#B42318" /></View>
          <Text accessibilityRole="header" style={styles.lockTitle}>به‌روزرسانی لازم است</Text>
          <Text style={styles.body}>برای ادامهٔ استفاده باید نسخهٔ جدید Milo MultiLanguage را نصب کنید.</Text>
          <View style={styles.versionBox}>
            <Text style={styles.versionText}>نسخهٔ نصب‌شده: {CURRENT_APP_VERSION}</Text>
            <Text style={styles.versionText}>نسخهٔ لازم: {policy?.minimum_version}</Text>
          </View>
          {!!policy?.release_notes && <Text style={styles.notes}>{policy.release_notes}</Text>}
          <Pressable accessibilityRole="button" disabled={opening} onPress={() => void openUpdate()} style={[styles.primaryButton, opening && styles.disabled]}>
            {opening ? <ActivityIndicator color="#FFFFFF" /> : <Download size={19} color="#FFFFFF" />}
            <Text style={styles.primaryText}>دانلود و نصب به‌روزرسانی</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retryButton}>
            <RefreshCw size={16} color={Colors.primary[300]} />
            <Text style={styles.retryText}>بررسی دوباره بعد از نصب</Text>
          </Pressable>
          <Text style={styles.systemNote}>Android برای نصب APK اجازهٔ کاربر را می‌خواهد. اگر کلید این ساخت موقت باشد، پیش از نصب نسخهٔ تازه باید برنامهٔ قبلی را حذف کنید؛ ممکن است دادهٔ محلی پاک شود.</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {!checked && <ActivityIndicator color={Colors.primary[400]} />}
        </View>
      </View>
    );
  }

  return (
    <>
      {children}
      {optional ? (
        <View pointerEvents="box-none" style={styles.optionalOverlay}>
          <View style={styles.optionalCard}>
            <Pressable accessibilityRole="button" accessibilityLabel="بعداً" onPress={() => setDismissed(true)} style={styles.close}>
              <X size={18} color={Colors.neutral[500]} />
            </Pressable>
            <View style={styles.optionalCopy}>
              <Text style={styles.optionalTitle}>نسخهٔ تازهٔ Milo MultiLanguage آماده است</Text>
              <Text style={styles.optionalBody}>نسخهٔ {policy?.latest_version}{policy?.release_notes ? ` · ${policy.release_notes}` : ''}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void openUpdate()} style={styles.optionalButton}>
              <Download size={16} color="#FFFFFF" />
              <Text style={styles.optionalButtonText}>به‌روزرسانی</Text>
            </Pressable>
          </View>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  lockRoot: { flex: 1, minHeight: '100%', backgroundColor: '#F4F8FD', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  lockCard: { width: '100%', maxWidth: 480, borderRadius: 25, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F7', padding: Spacing.xl, alignItems: 'center', gap: 13 },
  lockIcon: { width: 70, height: 70, borderRadius: 24, backgroundColor: '#FFF0EF', alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontFamily: Typography.boldFontFamily, fontSize: 22, color: '#102A56', textAlign: 'center' },
  body: { fontFamily: Typography.fontFamily, fontSize: 13, color: '#52667C', lineHeight: 22, textAlign: 'center' },
  versionBox: { width: '100%', borderRadius: 14, backgroundColor: '#F4F8FD', padding: 13, gap: 5 },
  versionText: { fontFamily: Typography.fontFamily, fontSize: 12, color: '#344761', textAlign: 'right' },
  notes: { fontFamily: Typography.fontFamily, fontSize: 12, lineHeight: 21, color: '#52667C', textAlign: 'right', alignSelf: 'stretch' },
  primaryButton: { width: '100%', minHeight: 50, borderRadius: Radius.lg, backgroundColor: '#1769D2', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { fontFamily: Typography.boldFontFamily, fontSize: 13, color: '#FFFFFF' },
  retryButton: { minHeight: 40, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  retryText: { fontFamily: Typography.fontFamily, fontSize: 12, color: Colors.primary[300] },
  systemNote: { fontFamily: Typography.fontFamily, fontSize: 10, color: '#7D8C9E', lineHeight: 18, textAlign: 'center' },
  error: { fontFamily: Typography.fontFamily, fontSize: 11, color: '#B42318', textAlign: 'center', lineHeight: 18 },
  optionalOverlay: { position: 'absolute', top: 8, left: 8, right: 8, zIndex: 1100, elevation: 20 },
  optionalCard: { minHeight: 74, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 10, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E7FA', shadowColor: '#123E76', shadowOpacity: .16, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  close: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  optionalCopy: { flex: 1, gap: 3 },
  optionalTitle: { fontFamily: Typography.boldFontFamily, fontSize: 12, color: '#123E76', textAlign: 'right' },
  optionalBody: { fontFamily: Typography.fontFamily, fontSize: 10, color: '#52667C', textAlign: 'right' },
  optionalButton: { minHeight: 38, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#1769D2', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  optionalButtonText: { fontFamily: Typography.boldFontFamily, fontSize: 10, color: '#FFFFFF' },
  disabled: { opacity: .5 },
});
